import WebSocket from 'ws';

/**
 * Formato padrão de mensagem enviada via WebSocket.
 */
export interface WsMessage {
  event: string;
  data: any;
  timestamp: string;
}

/**
 * Envia uma mensagem JSON para todos os clientes WebSocket conectados.
 * Clientes com conexão fechada ou em estado de erro são ignorados.
 */
export function broadcastToClients(
  wss: WebSocket.Server,
  event: string,
  data: any,
): void {
  const message: WsMessage = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  const payload = JSON.stringify(message);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

/**
 * Trata uma nova conexao WebSocket.
 * Envia uma mensagem de boas-vindas e registra handlers basicos.
 */
export function handleConnection(ws: WebSocket): void {
  const welcome: WsMessage = {
    event: 'connection.established',
    data: { message: 'Conectado ao Dashboard API - Amaral Support' },
    timestamp: new Date().toISOString(),
  };

  ws.send(JSON.stringify(welcome));

  ws.on('message', (raw: WebSocket.RawData) => {
    try {
      const parsed = JSON.parse(raw.toString());
      console.log('[WebSocket] Mensagem recebida do cliente:', parsed);
    } catch {
      console.warn('[WebSocket] Mensagem invalida recebida (nao e JSON)');
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Cliente desconectado');
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Erro na conexao:', err.message);
  });
}
