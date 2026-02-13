import request from 'supertest';

// Mock do pool antes de importar o app
jest.mock('../../src/db/pool', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockRejectedValue(new Error('DB not available in test')),
  },
}));

import { app } from '../../src/server';

describe('Dashboard API', () => {
  describe('GET /health', () => {
    it('deve retornar status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('dashboard-api');
    });
  });

  describe('POST /tickets', () => {
    it('deve criar um ticket', async () => {
      const res = await request(app)
        .post('/tickets')
        .send({
          phone: '5511999999999',
          category: 'hardware',
          summary: 'Computador não liga',
          priority: 'high',
        });

      expect(res.status).toBe(201);
      expect(res.body.ticket).toBeDefined();
      expect(res.body.ticket.phone).toBe('5511999999999');
      expect(res.body.ticket.category).toBe('hardware');
    });

    it('deve retornar 400 sem campos obrigatórios', async () => {
      const res = await request(app)
        .post('/tickets')
        .send({ summary: 'teste' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /tickets', () => {
    it('deve listar tickets', async () => {
      // Primeiro cria um ticket
      await request(app)
        .post('/tickets')
        .send({
          phone: '5511999999998',
          category: 'software',
          summary: 'Programa não abre',
        });

      const res = await request(app).get('/tickets');
      expect(res.status).toBe(200);
      expect(res.body.tickets).toBeDefined();
      expect(Array.isArray(res.body.tickets)).toBe(true);
    });

    it('deve filtrar por status', async () => {
      const res = await request(app).get('/tickets?status=open');
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /tickets/:id', () => {
    it('deve atualizar status do ticket', async () => {
      // Cria ticket primeiro
      const createRes = await request(app)
        .post('/tickets')
        .send({
          phone: '5511999999997',
          category: 'rede',
          summary: 'Internet caiu',
        });

      const ticketId = createRes.body.ticket.id;

      const res = await request(app)
        .patch(`/tickets/${ticketId}`)
        .send({ status: 'assigned', assignedTo: 'agente1' });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe('assigned');
    });

    it('deve retornar 404 para ticket inexistente', async () => {
      const res = await request(app)
        .patch('/tickets/00000000-0000-0000-0000-000000000000')
        .send({ status: 'closed' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /webhook', () => {
    it('deve receber evento de ticket criado', async () => {
      const res = await request(app)
        .post('/webhook')
        .send({
          event: 'ticket.created',
          ticket: {
            id: 'test-ticket-1',
            phone: '5511999999996',
            category: 'conta',
            summary: 'Conta bloqueada',
            status: 'open',
            priority: 'high',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it('deve retornar 400 sem campo event', async () => {
      const res = await request(app)
        .post('/webhook')
        .send({ ticket: {} });

      expect(res.status).toBe(400);
    });
  });
});
