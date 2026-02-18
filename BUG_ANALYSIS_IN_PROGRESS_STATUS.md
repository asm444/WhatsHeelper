# 🐛 Análise de Bug: Status Transition assigned → in_progress

## 📍 Localização do Código

### Arquivo 1: `services/dashboard-api/src/routes/tickets.ts` (linha ~418-427)
```typescript
if (sender === 'agent') {
  // Atualiza status para in_progress quando atendente responde pela primeira vez
  await pool.query(
    `UPDATE tickets
     SET status = 'in_progress', updated_at = NOW()
     WHERE id = $1 AND status = 'assigned'`,
    [id],
  ).catch(() => {
    // Se falhar, continua (melhor enviar mensagem que falhar completamente)
  });

  void forwardAgentMessageToClient(id, content);
}
```

### Arquivo 2: `services/business-engine/src/routes/classify.ts` (linha ~25)
```typescript
AND t.status NOT IN ('closed', 'resolved', 'in_progress')
AND t.assigned_to IS NOT NULL
```

---

## 🔍 Hipóteses de Bug Identificadas

### ❓ Hipótese 1: Race Condition na Transição Simultânea
**Cenário:**
- Dois agentes respondem ao mesmo ticket **simultaneamente**
- Ambos executam: `UPDATE tickets SET status = 'in_progress' WHERE status = 'assigned'`

**Comportamento esperado:**
- Apenas UMA requisição deve suceder (rowCount = 1)
- A segunda deve falhar (rowCount = 0) pois status já mudou

**Risco:**
- ⚠️ Se ambas forem bem-sucedidas, há violação de integridade
- ✅ A condição `WHERE status = 'assigned'` protege contra isto

**Status:** ✅ Provavelmente SEGURO (graças à cláusula WHERE)

---

### ❓ Hipótese 2: Ticket Preso em `in_progress` Indefinidamente
**Cenário:**
- Atendente transiciona ticket: `assigned` → `in_progress`
- Atendente abandona o ticket sem fechar
- Ticket fica em `in_progress` para sempre

**Impacto:**
- IA não reclassifica (query ignora `in_progress`)
- Ticket não aparece em nenhuma fila
- Cliente fica sem suporte

**Código problemático:**
```typescript
// Em classify.ts - NÃO PEGA tickets em in_progress
AND t.status NOT IN ('closed', 'resolved', 'in_progress')
```

**Status:** 🚨 **POSSÍVEL BUG** - Precisa de política de timeout/escalação

**Solução Sugerida:**
```sql
-- Opção 1: Auto-timeout se > 30 min em in_progress sem resposta
UPDATE tickets
SET status = 'escalated'
WHERE status = 'in_progress'
  AND updated_at < NOW() - INTERVAL '30 minutes'

-- Opção 2: Reabrir para IA se sem mensagens há 5 min
UPDATE tickets
SET status = 'open'
WHERE status = 'in_progress'
  AND (
    SELECT COUNT(*) FROM messages
    WHERE ticket_id = tickets.id
      AND created_at > NOW() - INTERVAL '5 minutes'
  ) = 0
```

---

### ❓ Hipótese 3: UPDATE Falha Silenciosamente
**Cenário:**
```typescript
.catch(() => {
  // Se falhar, continua (melhor enviar mensagem que falhar completamente)
})
```

**Problema:**
- Erro é **silenciado completamente**
- Nenhum log, nenhum aviso
- Mensagem é enviada mas status **não** é atualizado

**Resultado:**
- Status fica `assigned` em vez de `in_progress`
- Segunda mensagem do agente tenta UPDATE novamente
- Comportamento **inconsistente** e difícil de debugar

**Status:** 🚨 **CRÍTICO** - Falha silenciosa é perigosa

**Solução Sugerida:**
```typescript
.catch((error) => {
  console.warn(
    `[Warning] Falha ao transicionar ticket ${id} para in_progress:`,
    error.message
  );
  // Ainda continua, mas com log
})
```

---

### ❓ Hipótese 4: Condição WHERE Muito Restritiva
**Cenário:**
```sql
WHERE id = $1 AND status = 'assigned'
```

**Problema:**
- Segunda mensagem do agente NÃO atualiza `updated_at`
- rowCount = 0 (nenhuma linha afetada)
- Timestamp fica congelado

**Impacto:**
- Métricas de SLA incorretas
- Ordenação por `updated_at` falha
- Relatórios enviesados

**Status:** 🟡 **MODERADO** - Funciona mas deixa rastro sujo

**Solução Sugerida:**
```sql
-- Atualizar sempre updated_at quando mensagem de agente chega
UPDATE tickets
SET updated_at = NOW()
WHERE id = $1 AND status = 'in_progress'
```

---

## 🧪 Testes Criados

Arquivo: `services/dashboard-api/__tests__/unit/ticket-in-progress.test.ts`

Cobre:
- ✅ Race condition (primeira transição vence)
- ✅ Segunda mensagem funciona mesmo com UPDATE anterior falhando
- ✅ Erro silencioso (falha no UPDATE mas mensagem é enviada)
- ✅ Ticket preso (ignora `in_progress` na classificação)
- ✅ Transição completa esperada

---

## 🔧 Recomendações de Correção

### 1. **URGENT - Remover Silenciamento de Erro**
```typescript
.catch((error) => {
  console.warn(
    `[Dashboard API] Status transition failed for ticket ${id}: ${error.message}`
  );
})
```

### 2. **IMPORTANTE - Adicionar Timeout em in_progress**
Criar job que escala tickets presos:
```typescript
// services/dashboard-api/src/jobs/escalate-stuck-tickets.ts
export async function escalateStuckTickets() {
  await pool.query(`
    UPDATE tickets
    SET status = 'escalated', escalation_reason = 'Agent inactive for 30 minutes'
    WHERE status = 'in_progress'
      AND updated_at < NOW() - INTERVAL '30 minutes'
  `);
}
```

Rodar a cada 5 minutos via:
```typescript
setInterval(escalateStuckTickets, 5 * 60 * 1000);
```

### 3. **RECOMENDADO - Atualizar updated_at em Todas as Mensagens**
```typescript
// Sempre atualizar, mesmo se status não muda
await pool.query(
  `UPDATE tickets SET updated_at = NOW() WHERE id = $1`,
  [id]
);
```

### 4. **MELHOR PRÁTICA - Usar Transações**
```typescript
await pool.query('BEGIN');
try {
  // INSERT message
  const msg = await pool.query('INSERT INTO messages ...');

  // UPDATE status
  await pool.query('UPDATE tickets SET status = ... WHERE ...');

  await pool.query('COMMIT');
} catch (error) {
  await pool.query('ROLLBACK');
  console.error('Transação falhou:', error);
}
```

---

## ✅ Checklist de Verificação

- [ ] Rodar testes: `npm test --workspace=dashboard-api`
- [ ] Verificar logs para `.catch()` erros silenciados
- [ ] Teste manual: agente responde → status muda para `in_progress`
- [ ] Teste manual: segunda mensagem não quebra o fluxo
- [ ] Teste manual: ticket em `in_progress` > 30min é escalado
- [ ] Verificar métrica SLA: `updated_at` deve estar correto

---

## 📊 Prioridade das Correções

| Hipótese | Severidade | Impacto | Esforço | Prioridade |
|----------|-----------|--------|--------|-----------|
| Falha silenciosa | 🚨 Crítica | Cliente sem suporte | Baixo | 1️⃣ |
| Ticket preso | 🚨 Crítica | Cliente sem suporte | Médio | 2️⃣ |
| WHERE restritivo | 🟡 Moderada | Métricas erradas | Baixo | 3️⃣ |
| Race condition | ✅ Seguro | Nenhum | - | - |

---

## 📚 Referências

- Arquivo modificado: `git diff services/dashboard-api/src/routes/tickets.ts`
- Arquivo relacionado: `services/business-engine/src/routes/classify.ts`
- Teste criado: `services/dashboard-api/__tests__/unit/ticket-in-progress.test.ts`
