import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';

const router = Router();

// ---------------------------------------------------------------------------
// Interface do Ticket
// ---------------------------------------------------------------------------
export interface Ticket {
  id: string;
  conversationId: string | null;
  customerId: string | null;
  phone: string;
  category: string;
  summary: string;
  keyPoints: string[];
  priority: string;
  status: string;
  escalationReason: string | null;
  assignedTo: string | null;
  slaDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  sender: string;
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Armazenamento em memoria (fallback quando o PostgreSQL nao esta disponivel)
// ---------------------------------------------------------------------------
export const inMemoryTickets: Map<string, Ticket> = new Map();
export const inMemoryMessages: Map<string, TicketMessage[]> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ticketFromRow(row: any): Ticket {
  return {
    id: row.id,
    conversationId: row.conversation_id ?? null,
    customerId: row.customer_id ?? null,
    phone: row.phone ?? '',
    category: row.category ?? '',
    summary: row.summary ?? '',
    keyPoints: row.key_points ?? [],
    priority: row.priority ?? 'medium',
    status: row.status ?? 'open',
    escalationReason: row.escalation_reason ?? null,
    assignedTo: row.assigned_to ?? null,
    slaDeadline: row.sla_deadline ? new Date(row.sla_deadline).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

function messageFromRow(row: any): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id ?? row.ticketId,
    sender: row.sender,
    content: row.content,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /tickets - Listar tickets com filtros opcionais
// ---------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, category } = req.query;

    try {
      // Monta query dinamica com filtros
      const conditions: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (status) {
        conditions.push(`t.status = $${idx++}`);
        values.push(status);
      }
      if (priority) {
        conditions.push(`t.priority = $${idx++}`);
        values.push(priority);
      }
      if (category) {
        conditions.push(`t.category = $${idx++}`);
        values.push(category);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `SELECT t.*, c.phone
         FROM tickets t
         LEFT JOIN customers c ON t.customer_id = c.id
         ${where}
         ORDER BY t.created_at DESC`,
        values,
      );

      const tickets = result.rows.map(ticketFromRow);
      return res.json({ tickets });
    } catch {
      // Fallback: retorna tickets em memoria
      let tickets = Array.from(inMemoryTickets.values());

      if (status) {
        tickets = tickets.filter((t) => t.status === status);
      }
      if (priority) {
        tickets = tickets.filter((t) => t.priority === priority);
      }
      if (category) {
        tickets = tickets.filter((t) => t.category === category);
      }

      // Ordena por data de criacao (mais recente primeiro)
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({ tickets });
    }
  } catch (error) {
    console.error('[Tickets] Erro ao listar tickets:', error);
    return res.status(500).json({ error: 'Erro interno ao listar tickets' });
  }
});

// ---------------------------------------------------------------------------
// GET /tickets/:id - Buscar ticket por ID
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `SELECT t.*, c.phone
         FROM tickets t
         LEFT JOIN customers c ON t.customer_id = c.id
         WHERE t.id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }

      return res.json({ ticket: ticketFromRow(result.rows[0]) });
    } catch {
      // Fallback: busca em memoria
      const ticket = inMemoryTickets.get(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }
      return res.json({ ticket });
    }
  } catch (error) {
    console.error('[Tickets] Erro ao buscar ticket:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar ticket' });
  }
});

// ---------------------------------------------------------------------------
// POST /tickets - Criar novo ticket
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      conversationId = null,
      customerId = null,
      phone,
      category,
      summary = '',
      keyPoints = [],
      priority = 'medium',
      status = 'open',
      escalationReason = null,
      assignedTo = null,
      slaDeadline = null,
    } = req.body;

    if (!phone || !category) {
      return res.status(400).json({ error: 'Campos "phone" e "category" sao obrigatorios' });
    }

    const now = new Date().toISOString();
    let ticketId = uuidv4();

    try {
      const result = await pool.query(
        `INSERT INTO tickets (conversation_id, customer_id, category, summary, key_points, priority, status, escalation_reason, assigned_to, sla_deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [conversationId, customerId, category, summary, JSON.stringify(keyPoints), priority, status, escalationReason, assignedTo, slaDeadline],
      );

      const row = result.rows[0];
      // Busca o phone do customer se tiver customerId
      const ticket = ticketFromRow({ ...row, phone });

      return res.status(201).json({ ticket });
    } catch {
      // Fallback: salva em memoria
      const ticket: Ticket = {
        id: ticketId,
        conversationId,
        customerId,
        phone,
        category,
        summary,
        keyPoints,
        priority,
        status,
        escalationReason,
        assignedTo,
        slaDeadline,
        createdAt: now,
        updatedAt: now,
      };

      inMemoryTickets.set(ticketId, ticket);
      return res.status(201).json({ ticket });
    }
  } catch (error) {
    console.error('[Tickets] Erro ao criar ticket:', error);
    return res.status(500).json({ error: 'Erro interno ao criar ticket' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /tickets/:id - Atualizar ticket (status, assigned_to, etc)
// ---------------------------------------------------------------------------
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    try {
      // Monta SET dinamico a partir dos campos enviados
      const allowedFields: Record<string, string> = {
        status: 'status',
        assignedTo: 'assigned_to',
        priority: 'priority',
        category: 'category',
        summary: 'summary',
        escalationReason: 'escalation_reason',
        slaDeadline: 'sla_deadline',
      };

      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, dbCol] of Object.entries(allowedFields)) {
        if (updates[key] !== undefined) {
          setClauses.push(`${dbCol} = $${idx++}`);
          values.push(updates[key]);
        }
      }

      // Quando ticket é fechado/resolvido, limpa assigned_to para liberar conversa para IA
      const newStatus = updates.status as string | undefined;
      if (newStatus && ['closed', 'resolved'].includes(newStatus) && updates.assignedTo === undefined) {
        setClauses.push(`assigned_to = NULL`);
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo valido para atualizar' });
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await pool.query(
        `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        values,
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }

      // Busca phone para completar o ticket
      let phone = '';
      if (result.rows[0].customer_id) {
        try {
          const custResult = await pool.query('SELECT phone FROM customers WHERE id = $1', [result.rows[0].customer_id]);
          phone = custResult.rows[0]?.phone ?? '';
        } catch {
          // ignora
        }
      }

      return res.json({ ticket: ticketFromRow({ ...result.rows[0], phone }) });
    } catch {
      // Fallback: atualiza em memoria
      const ticket = inMemoryTickets.get(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }

      const allowedKeys: (keyof Ticket)[] = [
        'status', 'assignedTo', 'priority', 'category', 'summary', 'escalationReason', 'slaDeadline',
      ];

      for (const key of allowedKeys) {
        if (updates[key] !== undefined) {
          (ticket as any)[key] = updates[key];
        }
      }
      // Quando ticket é fechado/resolvido, limpa assignedTo
      if (ticket.status && ['closed', 'resolved'].includes(ticket.status) && updates.assignedTo === undefined) {
        ticket.assignedTo = null;
      }
      ticket.updatedAt = new Date().toISOString();
      inMemoryTickets.set(id, ticket);

      return res.json({ ticket });
    }
  } catch (error) {
    console.error('[Tickets] Erro ao atualizar ticket:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar ticket' });
  }
});

// ---------------------------------------------------------------------------
// Helper: Encaminha mensagem do atendente ao cliente via n8n -> chat-simulator
// ---------------------------------------------------------------------------
async function forwardAgentMessageToClient(ticketId: string, content: string): Promise<void> {
  try {
    // Busca o phone do cliente associado ao ticket
    const result = await pool.query(
      `SELECT c.phone FROM tickets t
       JOIN customers c ON t.customer_id = c.id
       WHERE t.id = $1`,
      [ticketId],
    );

    const phone = result.rows[0]?.phone;
    if (!phone) {
      console.warn(`[Tickets] Nao foi possivel encontrar phone para ticket ${ticketId}`);
      return;
    }

    // Encaminha para o n8n via webhook agent-response
    const n8nUrl = process.env.N8N_AGENT_RESPONSE_URL || 'http://localhost:5678/webhook/agent-response';

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: phone,
        text: content,
      }),
    });

    if (!response.ok) {
      console.warn(`[Tickets] n8n agent-response retornou ${response.status}`);
    }
  } catch (err) {
    console.warn('[Tickets] Erro ao encaminhar mensagem ao cliente:', err);
  }
}

// ---------------------------------------------------------------------------
// POST /tickets/:id/messages - Adicionar mensagem de atendente ao ticket
// ---------------------------------------------------------------------------
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sender = 'agent', content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Campo "content" e obrigatorio' });
    }

    try {
      // Verifica se o ticket existe
      const ticketResult = await pool.query('SELECT conversation_id FROM tickets WHERE id = $1', [id]);

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }

      const conversationId = ticketResult.rows[0].conversation_id;

      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender, content)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [conversationId, sender, content],
      );

      const message: TicketMessage = {
        id: result.rows[0].id,
        ticketId: id,
        sender: result.rows[0].sender,
        content: result.rows[0].content,
        createdAt: new Date(result.rows[0].created_at).toISOString(),
      };

      // Encaminha ao cliente se for mensagem do atendente
      if (sender === 'agent') {
        void forwardAgentMessageToClient(id, content);
      }

      return res.status(201).json({ message });
    } catch {
      // Fallback: salva em memoria
      // Verifica se o ticket existe em memoria
      if (!inMemoryTickets.has(id)) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }

      const message: TicketMessage = {
        id: uuidv4(),
        ticketId: id,
        sender,
        content,
        createdAt: new Date().toISOString(),
      };

      const existing = inMemoryMessages.get(id) || [];
      existing.push(message);
      inMemoryMessages.set(id, existing);

      // Encaminha ao cliente se for mensagem do atendente (fallback)
      if (sender === 'agent') {
        const ticket = inMemoryTickets.get(id);
        if (ticket?.phone) {
          const n8nUrl = process.env.N8N_AGENT_RESPONSE_URL || 'http://localhost:5678/webhook/agent-response';
          fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: ticket.phone, text: content }),
          }).catch(() => {});
        }
      }

      return res.status(201).json({ message });
    }
  } catch (error) {
    console.error('[Tickets] Erro ao adicionar mensagem:', error);
    return res.status(500).json({ error: 'Erro interno ao adicionar mensagem' });
  }
});

// ---------------------------------------------------------------------------
// GET /tickets/:id/messages - Listar mensagens de um ticket
// ---------------------------------------------------------------------------
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    try {
      // Busca conversation_id do ticket
      const ticketResult = await pool.query('SELECT conversation_id FROM tickets WHERE id = $1', [id]);

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }

      const conversationId = ticketResult.rows[0].conversation_id;

      if (!conversationId) {
        return res.json({ messages: [] });
      }

      const result = await pool.query(
        `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
        [conversationId],
      );

      const messages: TicketMessage[] = result.rows.map((row) => ({
        id: row.id,
        ticketId: id,
        sender: row.sender,
        content: row.content,
        createdAt: new Date(row.created_at).toISOString(),
      }));

      return res.json({ messages });
    } catch {
      // Fallback: busca em memoria
      if (!inMemoryTickets.has(id)) {
        return res.status(404).json({ error: 'Ticket nao encontrado' });
      }

      const messages = inMemoryMessages.get(id) || [];
      return res.json({ messages });
    }
  } catch (error) {
    console.error('[Tickets] Erro ao listar mensagens:', error);
    return res.status(500).json({ error: 'Erro interno ao listar mensagens' });
  }
});

export default router;
