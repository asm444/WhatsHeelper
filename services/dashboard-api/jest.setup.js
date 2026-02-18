/**
 * Setup global para testes Jest
 * Configura hooks de limpeza automática do banco de dados
 */

// Timeout global aumentado para operações de BD
jest.setTimeout(10000);

// Cleanup automático após cada teste
afterEach(async () => {
  // Limpar dados de teste do banco de dados
  try {
    const pool = require('./src/db/pool').default;
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM tickets');
    await pool.query('DELETE FROM conversations');
    await pool.query('DELETE FROM customers');
  } catch (error) {
    // Ignora erros se BD estiver mockado
    if (error?.message?.includes('DB not available') || error?.message?.includes('mocked')) {
      return;
    }
  }
});

// Cleanup final ao terminar todos os testes
afterAll(async () => {
  try {
    const pool = require('./src/db/pool').default;
    if (pool.end) {
      await pool.end();
    }
  } catch (error) {
    // Ignora erros ao fechar
  }
});
