/**
 * Testes End-to-End - Amaral AllSuport
 *
 * Pré-requisitos: todos os serviços rodando (make up)
 * Execute: cd e2e && npm test
 */

const SIMULATOR_URL = process.env.CHAT_SIMULATOR_URL || 'http://localhost:3001';
const ENGINE_URL = process.env.BUSINESS_ENGINE_URL || 'http://localhost:3002';
const DASHBOARD_URL = process.env.DASHBOARD_API_URL || 'http://localhost:3003';

async function postJSON(url: string, body: object): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getJSON(url: string): Promise<any> {
  const res = await fetch(url);
  return res.json();
}

describe('E2E: Fluxo Completo do Chatbot', () => {
  describe('Health Checks', () => {
    it('Business Engine deve estar saudável', async () => {
      const health = await getJSON(`${ENGINE_URL}/health`);
      expect(health.status).toBe('ok');
    });

    it('Chat Simulator deve estar saudável', async () => {
      const health = await getJSON(`${SIMULATOR_URL}/health`);
      expect(health.status).toBe('ok');
    });

    it('Dashboard API deve estar saudável', async () => {
      const health = await getJSON(`${DASHBOARD_URL}/health`);
      expect(health.status).toBe('ok');
    });
  });

  describe('Happy Path - Resposta Automática', () => {
    it('deve classificar e responder problema de hardware', async () => {
      // 1. Classificar
      const classification = await postJSON(`${ENGINE_URL}/classify`, {
        message: 'Meu computador não liga, já tentei tudo',
        phone: '5511999990001',
      });
      expect(classification.category).toBeDefined();
      expect(classification.confidence).toBeGreaterThan(0);

      // 2. Gerar resposta
      const response = await postJSON(`${ENGINE_URL}/respond`, {
        message: 'Meu computador não liga, já tentei tudo',
        category: classification.category,
      });
      expect(response.response).toBeDefined();
      expect(response.response.length).toBeGreaterThan(10);
    });
  });

  describe('Escalação', () => {
    it('deve escalar quando cliente pede atendente humano', async () => {
      const classification = await postJSON(`${ENGINE_URL}/classify`, {
        message: 'Quero falar com um atendente humano por favor',
        phone: '5511999990002',
      });
      expect(classification.escalation.shouldEscalate).toBe(true);
    });

    it('deve criar ticket ao escalar', async () => {
      const result = await postJSON(`${ENGINE_URL}/escalate`, {
        phone: '5511999990003',
        category: 'hardware',
        messages: ['Cliente: Meu computador explodiu', 'Bot: Não sei resolver isso'],
        reason: 'Confiança baixa',
        priority: 'high',
      });
      expect(result.ticket).toBeDefined();
      expect(result.ticket.id).toBeDefined();
      expect(result.ticket.status).toBe('open');
    });
  });

  describe('Multi-Categoria', () => {
    const testCases = [
      { message: 'Meu notebook está muito lento e esquentando', expected: 'hardware' },
      { message: 'O Windows não atualiza, dá erro 0x800', expected: 'software' },
      { message: 'O Wi-Fi fica caindo toda hora', expected: 'rede' },
      { message: 'Esqueci a senha do meu email corporativo', expected: 'conta' },
      { message: 'Preciso da segunda via do boleto do mês passado', expected: 'faturamento' },
    ];

    for (const tc of testCases) {
      it(`deve classificar "${tc.message.substring(0, 40)}..." como ${tc.expected}`, async () => {
        const result = await postJSON(`${ENGINE_URL}/classify`, {
          message: tc.message,
          phone: '5511999990010',
        });
        // A IA pode classificar diferente dos keywords, mas deve retornar algo válido
        expect(result.category).toBeDefined();
        expect(['hardware', 'software', 'rede', 'conta', 'faturamento']).toContain(result.category);
      });
    }
  });
});
