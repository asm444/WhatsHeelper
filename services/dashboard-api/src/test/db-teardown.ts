/**
 * Utilitário para limpeza automática do banco de dados após testes
 * Garante que nenhuma poluição de dados persista entre testes
 */

import pool from '../db/pool';

export async function cleanupDatabase(): Promise<void> {
  try {
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM tickets');
    await pool.query('DELETE FROM conversations');
    await pool.query('DELETE FROM customers');
  } catch (error) {
    // Se o pool não estiver disponível (DB mockado), ignora
    if (error instanceof Error && error.message.includes('DB not available')) {
      return;
    }
    console.warn('[Test Teardown] Aviso ao limpar BD:', error);
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
  } catch (error) {
    console.warn('[Test Teardown] Aviso ao fechar BD:', error);
  }
}
