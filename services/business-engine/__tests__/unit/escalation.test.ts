import { checkEscalation, calculateSLADeadline } from '../../src/rules/escalation';

describe('Escalation Rules', () => {
  describe('checkEscalation', () => {
    it('deve escalar quando cliente pede atendente humano', () => {
      const result = checkEscalation('Quero falar com um atendente', 0.8, 0);
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toContain('humano');
      expect(result.priority).toBe('high');
    });

    it('deve escalar para tópicos sensíveis (jurídico)', () => {
      const result = checkEscalation('Vou chamar meu advogado', 0.8, 0);
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toContain('sensível');
      expect(result.priority).toBe('critical');
    });

    it('deve escalar para tópicos sensíveis (segurança)', () => {
      const result = checkEscalation('Minha conta foi hackeado', 0.8, 0);
      expect(result.shouldEscalate).toBe(true);
      expect(result.priority).toBe('critical');
    });

    it('deve escalar quando confiança é baixa', () => {
      const result = checkEscalation('Problema genérico', 0.2, 0);
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toContain('Confiança baixa');
      expect(result.priority).toBe('medium');
    });

    it('deve escalar após muitas tentativas', () => {
      const result = checkEscalation('Ainda não resolveu', 0.5, 3);
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toContain('tentativas');
      expect(result.priority).toBe('high');
    });

    it('NÃO deve escalar quando tudo está ok', () => {
      const result = checkEscalation('Meu computador está lento', 0.7, 0);
      expect(result.shouldEscalate).toBe(false);
    });

    it('deve respeitar threshold customizado', () => {
      const result = checkEscalation('Problema qualquer', 0.5, 0, 0.6);
      expect(result.shouldEscalate).toBe(true);
    });

    it('deve respeitar max retries customizado', () => {
      const result = checkEscalation('Problema qualquer', 0.7, 2, 0.4, 2);
      expect(result.shouldEscalate).toBe(true);
    });
  });

  describe('calculateSLADeadline', () => {
    it('deve calcular 1h para prioridade crítica', () => {
      const before = Date.now();
      const deadline = calculateSLADeadline('critical');
      const expected = before + 1 * 60 * 60 * 1000;
      expect(deadline.getTime()).toBeGreaterThanOrEqual(expected - 1000);
      expect(deadline.getTime()).toBeLessThanOrEqual(expected + 1000);
    });

    it('deve calcular 4h para prioridade alta', () => {
      const before = Date.now();
      const deadline = calculateSLADeadline('high');
      const expected = before + 4 * 60 * 60 * 1000;
      expect(deadline.getTime()).toBeGreaterThanOrEqual(expected - 1000);
      expect(deadline.getTime()).toBeLessThanOrEqual(expected + 1000);
    });

    it('deve calcular 8h para prioridade média', () => {
      const before = Date.now();
      const deadline = calculateSLADeadline('medium');
      const expected = before + 8 * 60 * 60 * 1000;
      expect(deadline.getTime()).toBeGreaterThanOrEqual(expected - 1000);
      expect(deadline.getTime()).toBeLessThanOrEqual(expected + 1000);
    });

    it('deve calcular 24h para prioridade baixa', () => {
      const before = Date.now();
      const deadline = calculateSLADeadline('low');
      const expected = before + 24 * 60 * 60 * 1000;
      expect(deadline.getTime()).toBeGreaterThanOrEqual(expected - 1000);
      expect(deadline.getTime()).toBeLessThanOrEqual(expected + 1000);
    });

    it('deve usar 24h como fallback para prioridade desconhecida', () => {
      const before = Date.now();
      const deadline = calculateSLADeadline('unknown');
      const expected = before + 24 * 60 * 60 * 1000;
      expect(deadline.getTime()).toBeGreaterThanOrEqual(expected - 1000);
      expect(deadline.getTime()).toBeLessThanOrEqual(expected + 1000);
    });
  });
});
