import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createWebhookRouter } from './routes/webhook';
import { formatIncomingMessage } from './simulator/waha-format';

// ── Configuracao ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/waha';

// ── Express + HTTP Server ─────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Servir arquivos estaticos (UI do chat)
app.use(express.static(path.join(__dirname, 'public')));

// ── Armazem de mensagens em memoria (por telefone) ────────────────────────────
const messageStore = new Map<string, Array<{ role: string; text: string; timestamp: number }>>();

// ── Rotas ─────────────────────────────────────────────────────────────────────
const webhookRouter = createWebhookRouter(io, messageStore);
app.use('/', webhookRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chat-simulator',
    timestamp: new Date().toISOString(),
    n8nWebhookUrl: N8N_WEBHOOK_URL,
    connectedClients: io.engine.clientsCount,
    activeChats: messageStore.size,
  });
});

// ── Socket.IO: conexoes e eventos ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Cliente conectado: ${socket.id}`);

  // Quando o usuario envia uma mensagem pela UI
  socket.on('user_message', async (data: { phone: string; text: string; name?: string }) => {
    const { phone, text, name } = data;

    if (!phone || !text) {
      console.warn('[Socket.IO] Mensagem recebida sem phone ou text:', data);
      socket.emit('error_message', { error: 'Campos "phone" e "text" sao obrigatorios' });
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, '');
    console.log(`[Socket.IO] Mensagem do usuario (${normalizedPhone}): "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

    // Armazena a mensagem do usuario
    const messages = messageStore.get(normalizedPhone) || [];
    messages.push({
      role: 'user',
      text,
      timestamp: Date.now(),
    });
    messageStore.set(normalizedPhone, messages);

    // Formata no padrao WAHA
    const wahaPayload = formatIncomingMessage(normalizedPhone, text, name);

    // Indica que o bot esta "digitando"
    io.emit('typing', { phone: normalizedPhone, isTyping: true });

    // Envia para o n8n (webhook WAHA)
    try {
      console.log(`[Webhook] Enviando para n8n: ${N8N_WEBHOOK_URL}`);

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wahaPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Webhook] n8n retornou ${response.status}: ${errorBody}`);
        io.emit('typing', { phone: normalizedPhone, isTyping: false });
        socket.emit('error_message', {
          error: `n8n retornou status ${response.status}`,
          details: errorBody.substring(0, 200),
        });
      } else {
        console.log(`[Webhook] n8n respondeu com status ${response.status}`);
        // O typing sera desativado quando a resposta do bot chegar via /api/sendText
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Webhook] Erro ao enviar para n8n: ${errorMessage}`);
      io.emit('typing', { phone: normalizedPhone, isTyping: false });
      socket.emit('error_message', {
        error: 'Nao foi possivel conectar ao n8n',
        details: errorMessage,
      });
    }
  });

  // Quando o cliente solicita historico de mensagens
  socket.on('get_history', (data: { phone: string }) => {
    const normalizedPhone = (data.phone || '').replace(/\D/g, '');
    const messages = messageStore.get(normalizedPhone) || [];
    socket.emit('message_history', { phone: normalizedPhone, messages });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Cliente desconectado: ${socket.id}`);
  });
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Chat Simulator (WAHA) rodando na porta ${PORT}`);
    console.log(`  UI:      http://localhost:${PORT}`);
    console.log(`  Health:  http://localhost:${PORT}/health`);
    console.log(`  Webhook: ${N8N_WEBHOOK_URL}`);
    console.log('═══════════════════════════════════════════════════════════');
  });
}

export { app, server, io, messageStore };
