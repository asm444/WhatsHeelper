import request from 'supertest';
import app from '../../src/server';

// Mock do Gemini client
jest.mock('../../src/ai/gemini-client', () => ({
  classifyMessage: jest.fn().mockResolvedValue({
    category: 'hardware',
    confidence: 0.85,
    reasoning: 'Problema com computador identificado',
    suggestedPriority: 'medium',
    severityReason: 'Problema isolado sem impacto em múltiplos usuários',
  }),
  generateResponse: jest.fn().mockResolvedValue({
    response: 'Tente reiniciar o computador',
    confidence: 0.8,
    category: 'hardware',
    suggestEscalation: false,
  }),
  generateSummary: jest.fn().mockResolvedValue({
    summary: 'Cliente com problema de hardware',
    category: 'hardware',
    priority: 'medium',
    keyPoints: ['Computador não liga'],
    severityReason: 'Funcionalidade comprometida mas há alternativa',
    riskFactors: [],
    escalationContext: 'Cliente tentou reiniciar sem sucesso',
  }),
}));

// Mock do pool do banco
jest.mock('../../src/db/pool', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockRejectedValue(new Error('DB not available in test')),
  },
}));

describe('Business Engine API', () => {
  describe('GET /health', () => {
    it('deve retornar status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('business-engine');
    });
  });

  describe('POST /classify', () => {
    it('deve classificar uma mensagem', async () => {
      const res = await request(app)
        .post('/classify')
        .send({ message: 'Meu computador não liga', phone: '5511999999999' });

      expect(res.status).toBe(200);
      expect(res.body.category).toBe('hardware');
      expect(res.body.confidence).toBeGreaterThan(0);
      expect(res.body.escalation).toBeDefined();
    });

    it('deve retornar 400 sem mensagem', async () => {
      const res = await request(app)
        .post('/classify')
        .send({ phone: '5511999999999' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('obrigatório');
    });

    it('deve incluir resultado de keywords', async () => {
      const res = await request(app)
        .post('/classify')
        .send({ message: 'Meu computador está travando', phone: '5511999999999' });

      expect(res.status).toBe(200);
      expect(res.body.keywordMatch).toBeDefined();
    });

    it('deve ativar bypass com frase-chave', async () => {
      const res = await request(app)
        .post('/classify')
        .send({ message: 'atendente sender', phone: '5511999999999' });

      expect(res.status).toBe(200);
      expect(res.body.bypassActivated).toBe(true);
      expect(res.body.escalation.shouldEscalate).toBe(true);
      expect(res.body.escalation.priority).toBe('low');
      expect(res.body.confidence).toBe(1.0);
    });

    it('frase-chave deve ser case-insensitive', async () => {
      const res = await request(app)
        .post('/classify')
        .send({ message: 'ATENDENTE SENDER', phone: '5511999999999' });

      expect(res.status).toBe(200);
      expect(res.body.bypassActivated).toBe(true);
    });

    it('frase-chave deve ignorar espaços', async () => {
      const res = await request(app)
        .post('/classify')
        .send({ message: '  atendente sender  ', phone: '5511999999999' });

      expect(res.status).toBe(200);
      expect(res.body.bypassActivated).toBe(true);
    });

    it('não deve ativar bypass com frase parcial', async () => {
      const res = await request(app)
        .post('/classify')
        .send({ message: 'atendente sender extra', phone: '5511999999999' });

      expect(res.status).toBe(200);
      expect(res.body.bypassActivated).toBeUndefined();
    });
  });

  describe('POST /respond', () => {
    it('deve gerar uma resposta', async () => {
      const res = await request(app)
        .post('/respond')
        .send({ message: 'Meu computador não liga', category: 'hardware' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
      expect(res.body.category).toBe('hardware');
    });

    it('deve retornar auto-resposta baseada em regras quando possível', async () => {
      const res = await request(app)
        .post('/respond')
        .send({ message: 'computador não liga', category: 'hardware' });

      expect(res.status).toBe(200);
      // Pode ser rules ou gemini, ambos são válidos
      expect(res.body.response).toBeDefined();
    });

    it('deve retornar 400 sem campos obrigatórios', async () => {
      const res = await request(app)
        .post('/respond')
        .send({ message: 'teste' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /escalate', () => {
    it('deve criar um ticket de escalação', async () => {
      const res = await request(app)
        .post('/escalate')
        .send({
          phone: '5511999999999',
          category: 'hardware',
          messages: ['Cliente: Meu computador não liga', 'Bot: Já tentou reiniciar?'],
          reason: 'Confiança baixa',
          priority: 'high',
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket).toBeDefined();
      expect(res.body.ticket.phone).toBe('5511999999999');
      expect(res.body.ticket.category).toBe('hardware');
      expect(res.body.ticket.status).toBe('open');
    });

    it('deve retornar 400 sem campos obrigatórios', async () => {
      const res = await request(app)
        .post('/escalate')
        .send({ category: 'hardware' });

      expect(res.status).toBe(400);
    });
  });
});
