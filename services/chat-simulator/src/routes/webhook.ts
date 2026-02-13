import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { parseOutgoingMessage } from '../simulator/waha-format';

/**
 * Cria o router de webhooks/API que simula os endpoints do WAHA.
 * O n8n (ou qualquer automacao) chama esses endpoints para enviar
 * mensagens de volta ao usuario.
 *
 * @param io          - Instancia do Socket.IO server
 * @param messageStore - Armazem de mensagens em memoria (por telefone)
 */
export function createWebhookRouter(
  io: SocketIOServer,
  messageStore: Map<string, Array<{ role: string; text: string; timestamp: number }>>,
): Router {
  const router = Router();

  /**
   * POST /api/sendText
   * Endpoint principal que o WAHA/n8n usa para enviar mensagens ao usuario.
   * Formato: { chatId: "5511999998888@c.us", text: "Resposta do bot", session?: "default" }
   */
  router.post('/api/sendText', (req: Request, res: Response) => {
    try {
      const parsed = parseOutgoingMessage(req.body);

      if (!parsed.text) {
        console.warn('[Webhook] sendText recebido sem texto:', req.body);
        return res.status(400).json({ error: 'Campo "text" e obrigatorio' });
      }

      if (!parsed.phone) {
        console.warn('[Webhook] sendText recebido sem chatId valido:', req.body);
        return res.status(400).json({ error: 'Campo "chatId" e obrigatorio' });
      }

      console.log(`[Webhook] sendText -> ${parsed.phone}: "${parsed.text.substring(0, 80)}${parsed.text.length > 80 ? '...' : ''}"`);

      // Armazena a mensagem do bot
      const messages = messageStore.get(parsed.phone) || [];
      messages.push({
        role: 'bot',
        text: parsed.text,
        timestamp: Date.now(),
      });
      messageStore.set(parsed.phone, messages);

      // Emite para o front-end via Socket.IO
      io.emit('bot_message', {
        phone: parsed.phone,
        chatId: parsed.chatId,
        text: parsed.text,
        timestamp: Date.now(),
        session: parsed.session,
      });

      return res.json({
        sent: true,
        messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        chatId: parsed.chatId,
      });
    } catch (error) {
      console.error('[Webhook] Erro no sendText:', error);
      return res.status(500).json({ error: 'Erro interno ao processar sendText' });
    }
  });

  /**
   * POST /api/messages
   * Endpoint alternativo - mesmo formato do sendText.
   */
  router.post('/api/messages', (req: Request, res: Response) => {
    try {
      const parsed = parseOutgoingMessage(req.body);

      if (!parsed.text) {
        return res.status(400).json({ error: 'Campo "text" e obrigatorio' });
      }

      console.log(`[Webhook] messages -> ${parsed.phone}: "${parsed.text.substring(0, 80)}${parsed.text.length > 80 ? '...' : ''}"`);

      // Armazena a mensagem do bot
      const messages = messageStore.get(parsed.phone) || [];
      messages.push({
        role: 'bot',
        text: parsed.text,
        timestamp: Date.now(),
      });
      messageStore.set(parsed.phone, messages);

      // Emite para o front-end via Socket.IO
      io.emit('bot_message', {
        phone: parsed.phone,
        chatId: parsed.chatId,
        text: parsed.text,
        timestamp: Date.now(),
        session: parsed.session,
      });

      return res.json({
        sent: true,
        messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        chatId: parsed.chatId,
      });
    } catch (error) {
      console.error('[Webhook] Erro no messages:', error);
      return res.status(500).json({ error: 'Erro interno ao processar mensagem' });
    }
  });

  /**
   * GET /api/sessions
   * Retorna lista fake de sessoes WAHA (para compatibilidade).
   */
  router.get('/api/sessions', (_req: Request, res: Response) => {
    console.log('[Webhook] GET /api/sessions (simulado)');
    return res.json([
      {
        name: 'default',
        status: 'WORKING',
        config: {
          proxy: null,
          webhooks: [
            {
              url: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/waha',
              events: ['message'],
            },
          ],
        },
        me: {
          id: 'server@c.us',
          pushName: 'Amaral AllSuport Bot',
        },
      },
    ]);
  });

  /**
   * GET /api/sessions/:session/me
   * Retorna info fake da sessao WAHA (para compatibilidade).
   */
  router.get('/api/sessions/:session/me', (req: Request, res: Response) => {
    const { session } = req.params;
    console.log(`[Webhook] GET /api/sessions/${session}/me (simulado)`);
    return res.json({
      id: 'server@c.us',
      pushName: 'Amaral AllSuport Bot',
      session,
      status: 'WORKING',
      engine: 'WEBJS',
    });
  });

  return router;
}
