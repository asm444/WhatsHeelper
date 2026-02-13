import { findCategoryByKeywords, CATEGORIES } from '../../src/rules/categories';

describe('Categories', () => {
  describe('CATEGORIES', () => {
    it('deve ter 5 categorias definidas', () => {
      expect(CATEGORIES).toHaveLength(5);
    });

    it('deve ter IDs únicos', () => {
      const ids = CATEGORIES.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('deve incluir as categorias esperadas', () => {
      const ids = CATEGORIES.map(c => c.id);
      expect(ids).toContain('hardware');
      expect(ids).toContain('software');
      expect(ids).toContain('rede');
      expect(ids).toContain('conta');
      expect(ids).toContain('faturamento');
    });

    it('cada categoria deve ter keywords e auto-respostas', () => {
      for (const cat of CATEGORIES) {
        expect(cat.keywords.length).toBeGreaterThan(0);
        expect(cat.autoResponses.size).toBeGreaterThan(0);
        expect(cat.commonProblems.length).toBeGreaterThan(0);
      }
    });
  });

  describe('findCategoryByKeywords', () => {
    it('deve classificar "meu computador não liga" como hardware', () => {
      const result = findCategoryByKeywords('Meu computador não liga');
      expect(result).not.toBeNull();
      expect(result!.category.id).toBe('hardware');
    });

    it('deve classificar "não consigo instalar o programa" como software', () => {
      const result = findCategoryByKeywords('Não consigo instalar o programa, dá erro');
      expect(result).not.toBeNull();
      expect(result!.category.id).toBe('software');
    });

    it('deve classificar "internet caiu" como rede', () => {
      const result = findCategoryByKeywords('A internet caiu e não volta');
      expect(result).not.toBeNull();
      expect(result!.category.id).toBe('rede');
    });

    it('deve classificar "esqueci minha senha" como conta', () => {
      const result = findCategoryByKeywords('Esqueci minha senha do sistema');
      expect(result).not.toBeNull();
      expect(result!.category.id).toBe('conta');
    });

    it('deve classificar "segunda via do boleto" como faturamento', () => {
      const result = findCategoryByKeywords('Preciso da segunda via do boleto');
      expect(result).not.toBeNull();
      expect(result!.category.id).toBe('faturamento');
    });

    it('deve retornar null para mensagem sem keywords', () => {
      const result = findCategoryByKeywords('Olá, bom dia');
      expect(result).toBeNull();
    });

    it('deve lidar com acentos corretamente', () => {
      const result = findCategoryByKeywords('Problemas com conexão de rede');
      expect(result).not.toBeNull();
      expect(result!.category.id).toBe('rede');
    });

    it('deve ter score maior para mais keywords encontradas', () => {
      const singleKeyword = findCategoryByKeywords('computador');
      const multipleKeywords = findCategoryByKeywords('computador notebook teclado mouse monitor');
      expect(multipleKeywords!.matchScore).toBeGreaterThan(singleKeyword!.matchScore);
    });
  });
});
