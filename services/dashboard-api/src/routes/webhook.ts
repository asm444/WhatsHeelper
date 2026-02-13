import { Router, Request, Response } from 'express';
import WebSocket from 'ws';
import { broadcastToClients } from '../websocket/handler';
import { inMemoryTickets, Ticket } from './tickets';

const router = Router();

/**
 * Referencia ao WebSocket Server, injetada pelo server.ts na inicializacao.
 * Permite que o webhook envie eventos em tempo real para os clientes conectados.
 */
let wssRef: WebSocket.Server | null = null;

/**
 * Define a referencia do WebSocket Server para uso interno do router.
 */
export function setWebSocketServer(wss: WebSocket.Server): void {
  wssRef = wss;
}

// ---------------------------------------------------------------------------
// POST /webhook - Recebe eventos do business-engine
// ---------------------------------------------------------------------------
router.post('/', (req: Request, res: Response) => {
  try {
    const { event, ticket } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Campo "event" e obrigatorio' });
    }

    console.log(`[Webhook] Evento recebido: ${event}`);

    // Armazena/atualiza o ticket em memoria para consulta posterior
    if (ticket && ticket.id) {
      const now = new Date().toISOString();
      const stored: Ticket = {
        id: ticket.id,
        conversationId: ticket.conversationId ?? null,
        customerId: ticket.customerId ?? null,
        phone: ticket.phone ?? '',
        category: ticket.category ?? '',
        summary: ticket.summary ?? '',
        keyPoints: ticket.keyPoints ?? [],
        priority: ticket.priority ?? 'medium',
        status: ticket.status ?? 'open',
        escalationReason: ticket.escalationReason ?? ticket.reason ?? null,
        assignedTo: ticket.assignedTo ?? null,
        slaDeadline: ticket.slaDeadline ?? null,
        createdAt: ticket.createdAt ?? now,
        updatedAt: now,
      };
      inMemoryTickets.set(ticket.id, stored);
    }

    // Envia o evento para todos os clientes WebSocket conectados
    if (wssRef) {
      broadcastToClients(wssRef, event, ticket ?? {});
    } else {
      console.warn('[Webhook] WebSocket Server nao configurado, evento nao foi transmitido');
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Erro ao processar evento:', error);
    return res.status(500).json({ error: 'Erro interno ao processar webhook' });
  }
});

export default router;
