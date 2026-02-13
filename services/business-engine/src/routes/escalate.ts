import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateSummary } from '../ai/gemini-client';
import { calculateSLADeadline } from '../rules/escalation';
import pool from '../db/pool';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { phone, category, messages = [], reason, priority = 'medium' } = req.body;

    if (!phone || !category) {
      return res.status(400).json({ error: 'Campos "phone" e "category" são obrigatórios' });
    }

    // Gera resumo com IA
    let summary;
    try {
      summary = await generateSummary(messages, category);
    } catch {
      summary = {
        summary: `Cliente (${phone}) precisa de ajuda com ${category}. Motivo da escalação: ${reason || 'não especificado'}`,
        category,
        priority,
        keyPoints: ['Resumo automático indisponível'],
      };
    }

    const effectivePriority = summary.priority || priority;
    const slaDeadline = calculateSLADeadline(effectivePriority);

    // Tenta salvar no banco, mas não falha se o banco não estiver disponível
    let ticketId = uuidv4();
    let customerId: string | null = null;
    let conversationId: string | null = null;
    let isExistingTicket = false;

    try {
      // Busca ou cria customer
      const customerResult = await pool.query(
        `INSERT INTO customers (phone) VALUES ($1)
         ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [phone],
      );
      customerId = customerResult.rows[0].id;

      // Verifica se já existe uma conversa aberta para este customer
      const existingConv = await pool.query(
        `SELECT id FROM conversations
         WHERE customer_id = $1 AND status NOT IN ('closed')
         ORDER BY created_at DESC LIMIT 1`,
        [customerId],
      );

      if (existingConv.rows.length > 0) {
        conversationId = existingConv.rows[0].id;
      } else {
        const convResult = await pool.query(
          `INSERT INTO conversations (customer_id, status, category)
           VALUES ($1, 'escalated', $2)
           RETURNING id`,
          [customerId, category],
        );
        conversationId = convResult.rows[0].id;
      }

      // Salva mensagens na conversa (existente ou nova)
      for (const msg of messages) {
        await pool.query(
          `INSERT INTO messages (conversation_id, sender, content)
           VALUES ($1, $2, $3)`,
          [conversationId, msg.startsWith('Bot:') ? 'bot' : 'customer', msg],
        );
      }

      // Verifica se já existe um ticket aberto para esta conversa
      const existingTicket = await pool.query(
        `SELECT id FROM tickets
         WHERE conversation_id = $1 AND status NOT IN ('closed', 'resolved')
         LIMIT 1`,
        [conversationId],
      );

      if (existingTicket.rows.length > 0) {
        // Reutiliza ticket existente - atualiza resumo com contexto novo
        isExistingTicket = true;
        ticketId = existingTicket.rows[0].id;
        await pool.query(
          `UPDATE tickets SET summary = $1, updated_at = NOW() WHERE id = $2`,
          [summary.summary, ticketId],
        );
      } else {
        const ticketResult = await pool.query(
          `INSERT INTO tickets (conversation_id, customer_id, category, summary, escalation_reason, priority, sla_deadline)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [conversationId, customerId, category, summary.summary, reason, effectivePriority, slaDeadline],
        );
        ticketId = ticketResult.rows[0].id;
      }
    } catch (dbError) {
      console.warn('Banco indisponível, ticket criado somente em memória:', dbError);
    }

    const ticket = {
      id: ticketId,
      conversationId,
      customerId,
      phone,
      category,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      priority: effectivePriority,
      reason,
      slaDeadline: slaDeadline.toISOString(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    // Notifica o dashboard API
    try {
      const dashboardUrl = process.env.DASHBOARD_API_URL || 'http://localhost:3003';
      const event = isExistingTicket ? 'ticket.updated' : 'ticket.created';
      await fetch(`${dashboardUrl}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ticket }),
      });
    } catch {
      console.warn('Dashboard API indisponível para notificação');
    }

    return res.json({ ticket });
  } catch (error) {
    console.error('Erro ao escalar:', error);
    return res.status(500).json({ error: 'Erro interno ao escalar conversa' });
  }
});

export default router;
