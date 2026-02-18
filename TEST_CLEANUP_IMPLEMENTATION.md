# Implementação de Limpeza Automática de Testes

## O que foi feito

### 1. ✅ Banco de dados foi limpo
```sql
DELETE FROM messages;        -- 10 registros removidos
DELETE FROM tickets;         -- 11 registros removidos
DELETE FROM conversations;   -- 10 registros removidos
DELETE FROM customers;       -- 34 registros removidos
```

**Resultado:** BD vazio e sem poluição de testes.

---

## 2. 🔄 Limpeza Automática Implementada

Criados arquivos de setup para cada serviço:

### Serviços com BD (dashboard-api e business-engine)
- **`jest.setup.js`** → Hook `afterEach()` que limpa a BD após cada teste
  - Deleta em cascata: messages → tickets → conversations → customers
  - Ignora erros se BD estiver mockada (testes com mocks)
  - Hook `afterAll()` para encerrar conexões ao final de todos os testes

### Serviço sem BD (chat-simulator)
- **`jest.setup.js`** → Setup básico com timeout elevado

### Arquivos de Configuração Atualizados
- `services/dashboard-api/jest.config.js` → Adicionado `setupFilesAfterEnv`
- `services/business-engine/jest.config.js` → Adicionado `setupFilesAfterEnv`
- `services/chat-simulator/jest.config.js` → Adicionado `setupFilesAfterEnv`

### Utilitário de Suporte
- **`services/dashboard-api/src/test/db-teardown.ts`** → Funções exportáveis para uso manual em testes de integração

---

## Como Funciona

### Fluxo Automático (Recomendado)

```
[Teste 1 executa] → Cria dados no BD → [Teste finaliza]
                    ↓
              afterEach() limpa BD
                    ↓
[Teste 2 executa] → BD vazio → [Teste finaliza]
                    ↓
              afterEach() limpa BD
                    ↓
[Teste 3 executa] → BD vazio → [Teste finaliza]
                    ↓
             afterAll() fecha conexões
```

### Uso Manual (em testes de integração)

```typescript
import { cleanupDatabase, closeDatabase } from '../src/test/db-teardown';

describe('Integração BD', () => {
  afterEach(async () => {
    await cleanupDatabase();  // Cleanup manual se necessário
  });

  afterAll(async () => {
    await closeDatabase();    // Fechar conexões
  });
});
```

---

## Segurança & Robustez

✅ **Tratamento de Erros:**
- Ignora erros de BD mockada (testes unitários)
- Não quebra testes se pool.end() falhar
- Warnings são logados, não erros

✅ **Ordem de Deleção (Integridade Referencial):**
```
messages (sem FK com customers) → tickets (FK customers)
  ↓
conversations (FK customers) → customers
```

✅ **Timeout Aumentado:**
- Setado para 10s (padrão Jest é 5s)
- Evita timeout em operações de BD

✅ **Compatibilidade:**
- Funciona com BD real ou mockada
- Não quebra testes existentes

---

## Próximos Passos (Opcional)

Se quiser adicionar mais robustez, considere:

1. **Transações em testes** - Usar `BEGIN` / `ROLLBACK` em cada teste
2. **Fixtures** - Criar dados pré-definidos para cada teste
3. **Seed BD** - Script para popular dados iniciais antes dos testes
4. **Integração CI/CD** - Adicionar verificação em pipeline (não deixar poluição no histórico)

---

## Verificação

Para testar se está funcionando:

```bash
# Rodar testes de um serviço
npm test --workspace=dashboard-api

# Verificar se BD está vazia após testes
docker exec amaral-postgres psql -U amaral -d amaral_suport -c "
  SELECT COUNT(*) as total FROM (
    SELECT COUNT(*) FROM customers
    UNION ALL SELECT COUNT(*) FROM conversations
    UNION ALL SELECT COUNT(*) FROM messages
    UNION ALL SELECT COUNT(*) FROM tickets
  ) x"
```

Esperado: **0 registros** = ✅ Limpeza funcionando!
