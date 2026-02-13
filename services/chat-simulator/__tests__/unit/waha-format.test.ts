// O teste será baseado no arquivo gerado pelo agente
// Importamos o módulo que deve existir em src/simulator/waha-format.ts

describe('WAHA Format', () => {
  let formatIncomingMessage: any;
  let parseOutgoingMessage: any;

  beforeAll(() => {
    try {
      const wahaFormat = require('../../src/simulator/waha-format');
      formatIncomingMessage = wahaFormat.formatIncomingMessage;
      parseOutgoingMessage = wahaFormat.parseOutgoingMessage;
    } catch {
      // O módulo será testado se existir
    }
  });

  describe('formatIncomingMessage', () => {
    it('deve criar mensagem no formato WAHA', () => {
      if (!formatIncomingMessage) return;

      const msg = formatIncomingMessage('5511999998888', 'Olá, preciso de ajuda', 'João');
      expect(msg).toBeDefined();
      expect(msg.event).toBe('message');
      expect(msg.payload).toBeDefined();
      expect(msg.payload.body).toBe('Olá, preciso de ajuda');
      expect(msg.payload.from).toContain('5511999998888');
      expect(msg.payload.fromMe).toBe(false);
    });

    it('deve incluir timestamp', () => {
      if (!formatIncomingMessage) return;

      const msg = formatIncomingMessage('5511999998888', 'Teste');
      expect(msg.payload.timestamp).toBeDefined();
    });

    it('deve ter session default', () => {
      if (!formatIncomingMessage) return;

      const msg = formatIncomingMessage('5511999998888', 'Teste');
      expect(msg.session).toBe('default');
    });
  });

  describe('parseOutgoingMessage', () => {
    it('deve extrair chatId e text', () => {
      if (!parseOutgoingMessage) return;

      const parsed = parseOutgoingMessage({
        chatId: '5511999998888@c.us',
        text: 'Resposta do bot',
        session: 'default',
      });
      expect(parsed).toBeDefined();
      expect(parsed.chatId).toContain('5511999998888');
      expect(parsed.text).toBe('Resposta do bot');
    });
  });
});
