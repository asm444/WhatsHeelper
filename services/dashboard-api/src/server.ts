import http from 'http';
import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';
import ticketsRouter from './routes/tickets';
import webhookRouter, { setWebSocketServer } from './routes/webhook';
import { handleConnection } from './websocket/handler';

const app = express();
const PORT = parseInt(process.env.PORT || '3003', 10);

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'dashboard-api',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
app.use('/tickets', ticketsRouter);
app.use('/webhook', webhookRouter);

// ---------------------------------------------------------------------------
// Servidor HTTP + WebSocket
// ---------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Injeta a referencia do WSS no router de webhook
setWebSocketServer(wss);

// Trata novas conexoes WebSocket
wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Novo cliente conectado');
  handleConnection(ws);
});

// ---------------------------------------------------------------------------
// Inicia o servidor somente fora do ambiente de teste
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Dashboard API] Rodando na porta ${PORT}`);
    console.log(`[Dashboard API] WebSocket disponivel em ws://localhost:${PORT}`);
  });
}

export { app, wss, server };
