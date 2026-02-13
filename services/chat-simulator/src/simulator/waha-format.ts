import { v4 as uuidv4 } from 'uuid';

/**
 * Formato de mensagem WAHA (WhatsApp HTTP API)
 * Simula o payload que o WAHA envia via webhook quando recebe uma mensagem.
 */

export interface WahaIncomingMessage {
  id: string;
  event: string;
  session: string;
  engine: string;
  payload: {
    id: string;
    timestamp: number;
    from: string;
    to: string;
    body: string;
    fromMe: boolean;
    hasMedia: boolean;
    source: string;
    type: string;
    notifyName: string;
    participant: string;
    _data: {
      id: { id: string; remote: string; fromMe: boolean; _serialized: string };
    };
  };
}

export interface WahaSendTextRequest {
  chatId: string;
  text: string;
  session?: string;
}

export interface ParsedOutgoingMessage {
  chatId: string;
  phone: string;
  text: string;
  session: string;
}

/**
 * Formata uma mensagem do usuario no padrao WAHA incoming webhook.
 *
 * @param phone - Numero do telefone do remetente (ex: "5511999998888")
 * @param text  - Texto da mensagem
 * @param name  - Nome de exibicao do contato (opcional)
 * @returns Objeto no formato WAHA webhook
 */
export function formatIncomingMessage(
  phone: string,
  text: string,
  name?: string,
): WahaIncomingMessage {
  const messageId = uuidv4();
  const normalizedPhone = phone.replace(/\D/g, '');
  const chatId = `${normalizedPhone}@c.us`;
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    id: messageId,
    event: 'message',
    session: 'default',
    engine: 'WEBJS',
    payload: {
      id: `true_${chatId}_${messageId}`,
      timestamp,
      from: chatId,
      to: 'server@c.us',
      body: text,
      fromMe: false,
      hasMedia: false,
      source: 'chat-simulator',
      type: 'chat',
      notifyName: name || `Simulador (${normalizedPhone})`,
      participant: chatId,
      _data: {
        id: {
          id: messageId,
          remote: chatId,
          fromMe: false,
          _serialized: `false_${chatId}_${messageId}`,
        },
      },
    },
  };
}

/**
 * Faz parse do body de uma requisicao WAHA sendText.
 *
 * @param body - Body da requisicao HTTP (formato {chatId, text, session?})
 * @returns Mensagem parseada com campos normalizados
 */
export function parseOutgoingMessage(body: WahaSendTextRequest): ParsedOutgoingMessage {
  const { chatId, text, session } = body;

  // Extrai o numero de telefone do chatId (remove @c.us, @s.whatsapp.net, etc.)
  const phone = (chatId || '').replace(/@.*$/, '').replace(/\D/g, '');

  return {
    chatId: chatId || '',
    phone,
    text: text || '',
    session: session || 'default',
  };
}
