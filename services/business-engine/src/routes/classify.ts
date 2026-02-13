import { Router, Request, Response } from 'express';
import { classifyMessage } from '../ai/gemini-client';
import { findCategoryByKeywords } from '../rules/categories';
import { checkEscalation } from '../rules/escalation';
import pool from '../db/pool';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, phone, conversationHistory = [], retryCount = 0 } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Campo "message" é obrigatório' });
    }

    // Verifica se já existe um atendente ativo para este telefone
    if (phone) {
      try {
        const agentCheck = await pool.query(
          `SELECT t.id AS ticket_id, t.assigned_to, t.conversation_id
           FROM tickets t
           JOIN customers c ON t.customer_id = c.id
           WHERE c.phone = $1
             AND t.status NOT IN ('closed', 'resolved')
             AND t.assigned_to IS NOT NULL
           ORDER BY t.created_at DESC
           LIMIT 1`,
          [phone],
        );

        if (agentCheck.rows.length > 0) {
          const { ticket_id, assigned_to, conversation_id } = agentCheck.rows[0];

          // Salva a mensagem do cliente na conversa para o atendente ver
          if (conversation_id) {
            await pool.query(
              `INSERT INTO messages (conversation_id, sender, content) VALUES ($1, 'customer', $2)`,
              [conversation_id, message],
            );
          }

          // Notifica o dashboard para atualizar em tempo real
          try {
            const dashboardUrl = process.env.DASHBOARD_API_URL || 'http://localhost:3003';
            await fetch(`${dashboardUrl}/webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'message.new',
                ticketId: ticket_id,
                message: { sender: 'customer', content: message, phone },
              }),
            });
          } catch {
            // Dashboard indisponível, mensagem já está salva no banco
          }

          return res.json({
            agentHandling: true,
            ticketId: ticket_id,
            assignedTo: assigned_to,
            category: null,
            confidence: 0,
            escalation: { shouldEscalate: false, reason: '', priority: '' },
          });
        }
      } catch {
        // Se o banco falhar, continua com classificação normal
      }
    }

    // Primeiro tenta classificação por keywords (rápido, sem API)
    const keywordResult = findCategoryByKeywords(message);

    // Depois usa Gemini para classificação mais precisa
    let aiResult;
    try {
      aiResult = await classifyMessage(message, conversationHistory);
    } catch (err) {
      // Fallback para keywords se Gemini falhar
      if (keywordResult) {
        aiResult = {
          category: keywordResult.category.id,
          confidence: keywordResult.matchScore,
          reasoning: 'Classificação por keywords (Gemini indisponível)',
        };
      } else {
        aiResult = {
          category: 'software',
          confidence: 0.2,
          reasoning: 'Classificação padrão (Gemini indisponível, sem match de keywords)',
        };
      }
    }

    // Verifica escalação
    const escalation = checkEscalation(
      message,
      aiResult.confidence,
      retryCount,
      parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.4'),
      parseInt(process.env.MAX_RETRIES_BEFORE_ESCALATION || '3'),
    );

    return res.json({
      category: aiResult.category,
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      escalation: {
        shouldEscalate: escalation.shouldEscalate,
        reason: escalation.reason,
        priority: escalation.priority,
      },
      keywordMatch: keywordResult
        ? { category: keywordResult.category.id, score: keywordResult.matchScore }
        : null,
    });
  } catch (error) {
    console.error('Erro ao classificar mensagem:', error);
    return res.status(500).json({ error: 'Erro interno ao classificar mensagem' });
  }
});

export default router;
