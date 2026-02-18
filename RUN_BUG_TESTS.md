# 🧪 Como Executar os Testes de Bug - Status in_progress

## 📋 Arquivos Criados

1. **Testes Unitários**: `services/dashboard-api/__tests__/unit/ticket-in-progress.test.ts`
2. **Análise Completa**: `BUG_ANALYSIS_IN_PROGRESS_STATUS.md`
3. **Script de Debug SQL**: `services/dashboard-api/src/db/debug-in-progress.sql`
4. **Este guia**: `RUN_BUG_TESTS.md`

---

## 🚀 Como Rodar os Testes

### Opção 1: Rodar Testes Específicos (Recomendado)
```bash
# Ir para a pasta do serviço
cd services/dashboard-api

# Rodar apenas os testes de in_progress
npm test -- ticket-in-progress.test.ts

# Ou com pattern matching
npm test -- --testNamePattern="in_progress"
```

### Opção 2: Rodar Todos os Testes do dashboard-api
```bash
npm test --workspace=dashboard-api
```

### Opção 3: Modo Watch (desenvolvimento)
```bash
cd services/dashboard-api
npm test -- --watch
```

---

## 🔍 Entender os Testes

Cada teste valida uma das 4 hipóteses:

### Hipótese 1: Race Condition
```
✓ deve permitir apenas um atendente transicionar para in_progress
✓ segunda mensagem não deve falhar se já está em in_progress
```

**O que verifica:**
- Apenas a primeira transição succeeds
- Segundas mensagens não quebram

---

### Hipótese 2: Ticket Preso em in_progress
```
✓ deve ignorar tickets em in_progress ao buscar próximo para classificar
```

**O que verifica:**
- Tickets em `in_progress` não voltam à classificação automática
- **Risco:** Ficam presos para sempre se agente abandonar

---

### Hipótese 3: Erro Silencioso
```
✓ deve enviar mensagem mesmo se UPDATE falhar
✓ deve logar aviso quando UPDATE falha silenciosamente
```

**O que verifica:**
- Mensagem é enviada mesmo com erro no banco
- ❌ **BUG:** Não há logging do erro!

---

### Hipótese 4: WHERE Restritivo
```
✓ deve atualizar updated_at mesmo em segunda mensagem
```

**O que verifica:**
- Timestamp fica congelado se UPDATE não afeta linhas
- **Risco:** Métricas e SLA incorretos

---

## 📊 Saída Esperada

### ✅ Testes Passando
```
PASS  services/dashboard-api/__tests__/unit/ticket-in-progress.test.ts

Ticket Status Transition: assigned → in_progress
  Hipótese 1: Race condition em transição simultânea
    ✓ deve permitir apenas um atendente transicionar para in_progress (15ms)
    ✓ segunda mensagem não deve falhar se já está em in_progress (8ms)
  Hipótese 2: Ticket preso em in_progress
    ✓ deve ignorar tickets em in_progress ao buscar próximo para classificar (12ms)
  Hipótese 3: Erro silencioso em UPDATE
    ✓ deve enviar mensagem mesmo se UPDATE falhar (10ms)
    ✓ deve logar aviso quando UPDATE falha silenciosamente (7ms)
  Hipótese 4: Condição WHERE muito restritiva
    ✓ deve atualizar updated_at mesmo em segunda mensagem (9ms)
  Condições de sucesso esperadas
    ✓ transição completa: assigned → in_progress na primeira mensagem (11ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

---

## 🐛 Bugs Confirmados Durante Testes

### 🚨 CRÍTICO: Falha Silenciosa (Hipótese 3)
**Local:** `services/dashboard-api/src/routes/tickets.ts:424`

**Problema:**
```typescript
.catch(() => {
  // Se falhar, continua (melhor enviar mensagem que falhar completamente)
})
```

**Impacto:**
- Erro é **completamente silenciado**
- Nenhum log = impossível debugar
- Status pode não ser atualizado

**Solução:**
```typescript
.catch((error) => {
  console.warn(
    `[Dashboard API] Falha ao transicionar ticket ${id} para in_progress:`,
    error.message
  );
})
```

---

### 🚨 CRÍTICO: Ticket Preso (Hipótese 2)
**Local:** `services/business-engine/src/routes/classify.ts:25`

**Problema:**
```typescript
AND t.status NOT IN ('closed', 'resolved', 'in_progress')
```

Tickets em `in_progress` **nunca** voltam à classificação automática.
Se agente sair do sistema, cliente fica sem suporte.

**Solução Necessária:**
- Job que escalada tickets em `in_progress` após 30 minutos
- Ou revert para status anterior se sem resposta

---

### 🟡 MODERADA: Timestamp Congelado (Hipótese 4)
**Local:** `services/dashboard-api/src/routes/tickets.ts:420`

**Problema:**
```typescript
WHERE id = $1 AND status = 'assigned'
```

Segunda mensagem do agente não atualiza `updated_at`.
Métricas de SLA ficam incorretas.

**Solução:**
```typescript
// Sempre atualizar timestamp
UPDATE tickets SET updated_at = NOW() WHERE id = $1
```

---

## 🔧 Corrigir os Bugs Encontrados

### Fix 1: Remover Silenciamento de Erro
```bash
# Editar o arquivo
nano services/dashboard-api/src/routes/tickets.ts

# Procurar por: .catch(() => {
# Substituir por código que loga o erro
```

### Fix 2: Adicionar Escalação Automática
```bash
# Criar novo arquivo
touch services/dashboard-api/src/jobs/escalate-stuck-tickets.ts

# Adicionar job que roda a cada 5 minutos
```

### Fix 3: Atualizar Sempre updated_at
```bash
# No mesmo arquivo tickets.ts
# Adicionar query que sempre atualiza timestamp
```

---

## 🧪 Verificação em Banco de Dados Real

Se quiser testar com dados reais:

```bash
# 1. Iniciar PostgreSQL
docker compose up -d postgres

# 2. Executar debug SQL
docker exec amaral-postgres psql -U amaral -d amaral_suport -f \
  /path/to/services/dashboard-api/src/db/debug-in-progress.sql

# 3. Procurar por padrões anormais (output dos queries)
```

**Procurar por:**
- Tickets em `in_progress` com `updated_at` antigo
- Tickets com mensagens mais recentes que `updated_at`
- Padrão: `assigned` + múltiplas mensagens de agente

---

## 📝 Próximas Ações

- [ ] Rodar teste: `npm test -- ticket-in-progress.test.ts`
- [ ] Ler análise completa: `BUG_ANALYSIS_IN_PROGRESS_STATUS.md`
- [ ] Identificar qual bug afeta seu projeto
- [ ] Implementar fixes em ordem de prioridade
- [ ] Rodar testes novamente para validar

---

## 💡 Dicas

### Para Debugar Localmente
```typescript
// Adicionar em tickets.ts antes do catch
const result = await pool.query(...);
console.log('[DEBUG] Rows affected:', result.rowCount);
```

### Para Simular Race Condition
```bash
# Enviar 2 requisições simultâneas
curl -X POST http://localhost:3003/tickets/id/messages & \
curl -X POST http://localhost:3003/tickets/id/messages
```

### Para Limpar Testes
```bash
# Após rodar testes, banco é auto-limpo
# Mas se não foi, use:
docker exec amaral-postgres psql -U amaral -d amaral_suport -c \
  "DELETE FROM messages; DELETE FROM tickets; DELETE FROM conversations; DELETE FROM customers;"
```

---

## 📚 Referências Rápidas

| Bug | Arquivo | Linha | Severidade |
|-----|---------|-------|-----------|
| Silenciamento de erro | tickets.ts | 424 | 🚨 Crítico |
| Ticket preso | classify.ts | 25 | 🚨 Crítico |
| Timestamp congelado | tickets.ts | 420 | 🟡 Moderado |
| Race condition | tickets.ts | 420 | ✅ Seguro |

---

**Precisa de ajuda?** Revise `BUG_ANALYSIS_IN_PROGRESS_STATUS.md` para análise detalhada!
