# Tutorial de Uso - Amaral Support ChatBot

Este tutorial mostra como usar e testar o sistema de chatbot. Siga os passos em ordem para explorar todas as funcionalidades.

**Prerequisito:** O sistema precisa estar rodando. Se ainda nao subiu, execute:
```bash
./START.sh
```

---

## Indice

1. [Fluxo principal do sistema](#1-fluxo-principal-do-sistema)
2. [Enviando uma mensagem de teste](#2-enviando-uma-mensagem-de-teste)
3. [Observando o workflow no n8n](#3-observando-o-workflow-no-n8n)
4. [Visualizando o ticket no dashboard](#4-visualizando-o-ticket-no-dashboard)
5. [Respondendo como atendente](#5-respondendo-como-atendente)
6. [Testando o bypass phrase](#6-testando-o-bypass-phrase)
7. [Testando diferentes prioridades](#7-testando-diferentes-prioridades)
8. [Lendo logs de cada servico](#8-lendo-logs-de-cada-servico)
9. [Executando os testes automatizados](#9-executando-os-testes-automatizados)

---

## 1. Fluxo Principal do Sistema

Antes de comecar, entenda o caminho que uma mensagem percorre:

```
[Cliente digita no Chat Simulator]
          |
          | Socket.IO (evento "message")
          v
[Chat Simulator - porta 3001]
          |
          | POST /webhook/waha (formato WAHA)
          v
[n8n - porta 5678]
          |
          |---> POST /classify
          v
[Business Engine - porta 3002]
          |
          |-- Tem atendente ativo? --> SIM --> IA silenciada, apenas salva mensagem
          |
          |-- NÃO --> Classifica com Gemini AI
          |
          |-- Deve escalar?
          |     |
          |     |-- NÃO --> POST /respond --> Bot responde ao cliente
          |     |
          |     \-- SIM --> POST /escalate --> Cria ticket no banco
          |                      |
          |                      v
          |               [Dashboard API - porta 3003]
          |                      |
          |                      | WebSocket broadcast
          |                      v
          |               [Agent Dashboard - porta 3004]
          |                      |
          |                 Atendente ve o ticket em tempo real
          v
[Resposta chega de volta ao Chat Simulator]
```

**Categorias de classificacao:**

| Categoria | Palavras-chave tipicas | Prioridade padrao |
|---|---|---|
| hardware | computador, impressora, mouse, cabo, ligar | medium |
| software | aplicativo, programa, trava, erro, atualizar | medium |
| rede | internet, wifi, conexao, lento, sem acesso | medium |
| conta | senha, acesso, login, bloqueado, permissao | high |
| faturamento | cobranca, fatura, pagamento, boleto | high |

---

## 2. Enviando uma Mensagem de Teste

### 2.1 Acessar o Chat Simulator

Abra o navegador e acesse:

```
http://localhost:3001
```

A interface se parece com:

```
+----------------------------------------------------------+
|  Amaral Support - Chat Simulator                       |
+----------------------------------------------------------+
|  Numero do cliente: [5511999999999        ]              |
|                                                          |
|  +----------------------------------------------------+  |
|  |                                                    |  |
|  |  (area de mensagens)                               |  |
|  |                                                    |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Mensagem: [___________________________________] [Enviar] |
+----------------------------------------------------------+
```

### 2.2 Enviar primeira mensagem (resolucao pelo bot)

No campo "Mensagem", digite:

```
Minha impressora nao imprime
```

Clique em **Enviar**. Em alguns segundos, o bot responde automaticamente. Exemplo:

```
+----------------------------------------------------------+
|  [5511999999999] Minha impressora nao imprime            |
|                                          [12:34]         |
|                                                          |
|  [Bot] Ola! Identifiquei que voce esta com problema      |
|  de hardware. Aqui vao algumas dicas:                    |
|  1. Verifique se a impressora esta ligada                 |
|  2. Confira o cabo USB ou conexao wireless               |
|  3. Reinstale o driver em support.amaral.com/drivers     |
|  Se o problema persistir, posso escalar para um          |
|  tecnico. Isso resolveu?              [12:34]            |
+----------------------------------------------------------+
```

### 2.3 Como o bot decide responder ou escalar

O Business Engine usa dois criterios:

1. **Confianca da IA (confidence):** Se o Gemini retorna confianca abaixo de `CONFIDENCE_THRESHOLD` (padrao: 0.4), o sistema escala.
2. **Regras fixas:** Palavras como "urgente", "critico", "travou tudo", "dados perdidos" forcam escalacao independente da confianca.

Voce pode inspecionar a decisao via API:

```bash
curl -s -X POST http://localhost:3002/classify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Minha impressora nao imprime",
    "phone": "5511999999999"
  }' | python3 -m json.tool
```

Resposta tipica:
```json
{
  "category": "hardware",
  "confidence": 0.82,
  "shouldEscalate": false,
  "agentHandling": false,
  "reasoning": "Problema de hardware com impressora, confianca alta",
  "escalationReason": null
}
```

---

## 3. Observando o Workflow no n8n

### 3.1 Acessar o n8n

```
http://localhost:5678
```

Login: usuario `admin`, senha conforme `N8N_BASIC_AUTH_PASSWORD` do arquivo `.env` (padrao: `admin123`).

### 3.2 Ver o workflow principal em execucao

```
+----------------------------------------------------------+
|  n8n                                    [admin]          |
+----------------------------------------------------------+
|  [Workflows]  [Credentials]  [Settings]                  |
|                                                          |
|  Meus Workflows:                                         |
|  +--------------------------------------+                 |
|  |  Main Chatbot          [Ativo]       |                 |
|  +--------------------------------------+                 |
|  |  Agent Response        [Ativo]       |                 |
|  +--------------------------------------+                 |
+----------------------------------------------------------+
```

Clique em **Main Chatbot** para abrir o editor visual.

### 3.3 Ver execucoes passadas

No editor do workflow, clique na aba **Executions** (canto superior direito). Voce vera cada mensagem que passou pelo sistema:

```
+----------------------------------------------------------+
|  Execucoes - Main Chatbot                                |
+----------------------------------------------------------+
|  Status    Data/Hora           Duracao                   |
|  [OK]      2026-02-18 12:34   0.8s                       |
|  [OK]      2026-02-18 12:33   1.2s                       |
|  [ERRO]    2026-02-18 12:30   0.1s                       |
+----------------------------------------------------------+
```

Clique em uma execucao para ver os dados que passaram por cada node (util para debug).

---

## 4. Visualizando o Ticket no Dashboard

### 4.1 Provocar uma escalacao

Para criar um ticket, envie uma mensagem que force escalacao. Use o Chat Simulator com:

```
Todos os nossos computadores pararam de funcionar urgente preciso de ajuda
```

O sistema identifica palavras de urgencia ("urgente", "todos", "pararam") e escala para um atendente.

### 4.2 Acessar o Agent Dashboard

```
http://localhost:3004
```

A interface mostra a lista de tickets:

```
+----------------------------------------------------------+
|  Amaral Support - Dashboard                            |
+----------------------------------------------------------+
|  Tickets Abertos (1)                                     |
+----------------------------------------------------------+
|  CRITICO  | hardware  | 5511999999999                    |
|  SLA: 1h  | Aberto    | Ha 2 minutos                     |
|  "Todos os computadores pararam..."                      |
|  [Ver Detalhes]                                          |
+----------------------------------------------------------+
|                                                          |
|  Tickets Resolvidos (0)                                  |
+----------------------------------------------------------+
```

### 4.3 Ver detalhes do ticket

Clique em **Ver Detalhes**. Voce vera:

```
+----------------------------------------------------------+
|  Ticket #abc-123                         [CRITICO]       |
+----------------------------------------------------------+
|  Cliente: 5511999999999                                  |
|  Categoria: hardware                                     |
|  Prioridade: critical                                    |
|  SLA: 2026-02-18 13:34 (vence em 58 min)                 |
|  Status: open                                            |
|                                                          |
|  Resumo (gerado pela IA):                                |
|  "Cliente relata que todos os computadores da empresa    |
|   pararam de funcionar simultaneamente. Situacao         |
|   critica que pode indicar falha de rede, servidor ou    |
|   ataque. Necessita atencao imediata."                   |
|                                                          |
|  Historico de Mensagens:                                 |
|  [Cliente] Todos os nossos computadores pararam...       |
|  [Bot]     Entendi a urgencia. Escalando para            |
|            um tecnico especializado...                   |
|                                                          |
|  [Assumir Ticket]  [Marcar em Andamento]  [Fechar]       |
+----------------------------------------------------------+
```

Voce tambem pode verificar via API:

```bash
# Listar todos os tickets
curl -s http://localhost:3003/tickets | python3 -m json.tool

# Ver ticket especifico (substitua ID pelo uuid real)
curl -s http://localhost:3003/tickets/SEU-TICKET-ID | python3 -m json.tool
```

---

## 5. Respondendo como Atendente

### 5.1 Assumir o ticket

No dashboard, clique em **Assumir Ticket**. O status muda para `assigned` e o campo `assigned_to` recebe o identificador do atendente.

Ou via API:
```bash
curl -s -X PATCH http://localhost:3003/tickets/SEU-TICKET-ID \
  -H "Content-Type: application/json" \
  -d '{"assignedTo": "joao-silva", "status": "in_progress"}'
```

### 5.2 Enviar resposta ao cliente

No campo de mensagem do dashboard:

```
+----------------------------------------------------------+
|  Responder ao cliente:                                   |
|  +------------------------------------------------------+|
|  |  Ola! Estou verificando o problema agora.           ||
|  |  Pode confirmar se ha algum erro na tela?           ||
|  +------------------------------------------------------+|
|  [Enviar Mensagem]                                       |
+----------------------------------------------------------+
```

Clique em **Enviar Mensagem**. O fluxo que acontece:

```
[Dashboard - POST /tickets/:id/messages]
          |
          | Salva mensagem no banco (sender: "agent")
          |
          | POST /webhook/agent-response (n8n)
          |
          v
[n8n - Agent Response Workflow]
          |
          | POST /api/sendText (Chat Simulator)
          |
          v
[Chat Simulator envia via Socket.IO]
          |
          v
[Cliente ve a mensagem no simulador]
```

### 5.3 IA silenciada enquanto atendente ativo

Enquanto o ticket estiver com `assigned_to` preenchido e status diferente de `closed`/`resolved`, qualquer mensagem nova do cliente nao aciona a IA. O Business Engine retorna:

```json
{
  "agentHandling": true,
  "message": "Conversa sob responsabilidade do atendente"
}
```

### 5.4 Fechar o ticket (IA retoma)

Quando o problema for resolvido, feche o ticket no dashboard ou via API:

```bash
curl -s -X PATCH http://localhost:3003/tickets/SEU-TICKET-ID \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

Apos fechar, o campo `assigned_to` e automaticamente limpo. A proxima mensagem do cliente sera processada pela IA normalmente.

---

## 6. Testando o Bypass Phrase

O sistema possui uma frase especial que escala imediatamente qualquer conversa para atendimento humano, ignorando a classificacao da IA.

### 6.1 Frase de bypass

```
atendente sender
```

### 6.2 Como testar

No Chat Simulator, envie exatamente:

```
atendente sender
```

O sistema deve:
1. Detectar a frase especial (sem chamar o Gemini)
2. Escalar imediatamente com prioridade `high`
3. Criar ticket com categoria `general` e razao "Cliente solicitou atendente"
4. Enviar mensagem ao cliente: "Entendido! Um atendente ira te atender em breve."

### 6.3 Verificar via API

```bash
curl -s -X POST http://localhost:3002/classify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "atendente sender",
    "phone": "5511888888888"
  }' | python3 -m json.tool
```

Resultado esperado:
```json
{
  "shouldEscalate": true,
  "escalationReason": "Cliente solicitou atendente humano",
  "bypassPhrase": true,
  "agentHandling": false
}
```

---

## 7. Testando Diferentes Prioridades

Cada prioridade tem um SLA (tempo maximo de atendimento) diferente:

| Prioridade | SLA | Como acionar |
|---|---|---|
| critical | 1 hora | Palavras: "urgente", "critico", "parou tudo", "todos" + escala |
| high | 4 horas | Categoria: conta, faturamento; ou confianca baixa em problema grave |
| medium | 8 horas | Maioria dos problemas de hardware/software/rede |
| low | 24 horas | Duvidas gerais, solicitacoes nao urgentes |

### 7.1 Testar escalacao critica (1 hora de SLA)

Mensagem no Chat Simulator:
```
Nosso servidor principal caiu e todos os funcionarios estao sem acesso urgente
```

Verifique no dashboard que o ticket criado tem prioridade `critical` e SLA de 1 hora.

### 7.2 Testar resolucao pelo bot (low priority)

Mensagem no Chat Simulator:
```
Como posso atualizar meu perfil no sistema?
```

O bot classifica como duvida de baixa urgencia e responde diretamente sem criar ticket.

Verifica via API:
```bash
curl -s -X POST http://localhost:3002/classify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Como posso atualizar meu perfil no sistema?",
    "phone": "5511777777777"
  }' | python3 -m json.tool
```

Resultado esperado: `"shouldEscalate": false`, `"confidence": > 0.4`.

### 7.3 Testar duvida tecnica (medium priority)

Mensagem no Chat Simulator:
```
Meu computador esta muito lento, demora para abrir os programas
```

O bot classifica como `software` ou `hardware`, tenta responder. Se nao conseguir resolver em ate 3 tentativas (`MAX_RETRIES_BEFORE_ESCALATION=3`), escala com prioridade `medium`.

### 7.4 Testar escalacao via API diretamente

```bash
# Forcar escalacao com prioridade especifica
curl -s -X POST http://localhost:3002/escalate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511666666666",
    "category": "hardware",
    "messages": ["Servidor caiu", "Todos sem acesso"],
    "reason": "Problema critico reportado",
    "priority": "critical"
  }' | python3 -m json.tool
```

Verifique o ticket criado:
```bash
curl -s http://localhost:3003/tickets | python3 -m json.tool
```

---

## 8. Lendo Logs de Cada Servico

### 8.1 Todos os servicos simultaneamente

```bash
docker compose logs -f
```

Use `Ctrl+C` para parar (os containers continuam rodando).

### 8.2 Servico especifico

```bash
# Business Engine (IA e classificacao)
docker compose logs -f business-engine

# Dashboard API (tickets e webhook)
docker compose logs -f dashboard-api

# Chat Simulator (mensagens e Socket.IO)
docker compose logs -f chat-simulator

# n8n (workflows e execucoes)
docker compose logs -f n8n

# PostgreSQL (queries e erros de banco)
docker compose logs -f postgres

# WAHA (integracao WhatsApp)
docker compose logs -f waha
```

### 8.3 Ultimas N linhas (sem seguir)

```bash
# Ultimas 50 linhas do business-engine
docker compose logs --tail=50 business-engine
```

### 8.4 Filtrar por nivel de log

```bash
# Ver apenas erros
docker compose logs | grep -i "error\|erro\|ERRO"

# Ver apenas warnings
docker compose logs | grep -i "warn\|aviso"

# Ver classificacoes da IA (business-engine)
docker compose logs business-engine | grep -i "classif\|gemini\|category"

# Ver criacao de tickets
docker compose logs business-engine | grep -i "ticket\|escalat"

# Ver conexoes WebSocket
docker compose logs dashboard-api | grep -i "websocket\|connect\|disconnect"
```

### 8.5 Verificar saude de todos os servicos

```bash
./scripts/health-check.sh
```

Ou via make:
```bash
make health
```

### 8.6 Entrar no container para debug

```bash
# Shell no business-engine
docker compose exec business-engine sh

# Verificar variaveis de ambiente
docker compose exec business-engine env | grep -E "GEMINI|DATABASE|PORT"

# Ver o banco de dados diretamente
docker compose exec postgres psql -U amaral -d amaral_support

# Queries SQL uteis dentro do psql:
# \dt                          -- listar tabelas
# SELECT * FROM tickets;       -- ver tickets
# SELECT * FROM conversations; -- ver conversas
# SELECT * FROM customers;     -- ver clientes
# \q                           -- sair
```

---

## 9. Executando os Testes Automatizados

### 9.1 Testes unitarios (sem dependencias externas)

Os testes unitarios nao precisam do Docker rodando. Usam mocks para banco de dados e Gemini.

```bash
# Todos os servicos de uma vez (npm workspaces)
make test-unit

# Ou individualmente por servico:
cd services/business-engine && npm run test:unit
cd services/dashboard-api  && npm run test:unit
cd services/chat-simulator && npm run test:unit
```

Saida esperada:
```
PASS  __tests__/unit/classify.test.ts
PASS  __tests__/unit/escalation.test.ts
PASS  __tests__/unit/categories.test.ts

Test Suites: 3 passed, 3 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        2.345 s
```

### 9.2 Testes de integracao (requer banco de dados)

```bash
# Sobe apenas o PostgreSQL
docker compose up -d postgres

# Aguarda ficar saudavel
docker compose ps postgres

# Executa testes de integracao
make test-integration
```

### 9.3 Teste E2E manual completo via curl

Execute a sequencia completa de um atendimento:

```bash
PHONE="5511987654321"

# Passo 1: Classificar mensagem
echo "=== Passo 1: Classificar mensagem ==="
CLASSIFY=$(curl -s -X POST http://localhost:3002/classify \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Meu computador nao liga\",\"phone\":\"$PHONE\"}")
echo "$CLASSIFY" | python3 -m json.tool

CATEGORY=$(echo "$CLASSIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('category','hardware'))")

# Passo 2: Escalar para atendente
echo ""
echo "=== Passo 2: Escalar para atendente ==="
ESCALATE=$(curl -s -X POST http://localhost:3002/escalate \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"category\":\"$CATEGORY\",\"messages\":[\"Meu computador nao liga\"],\"reason\":\"Teste manual E2E\",\"priority\":\"high\"}")
echo "$ESCALATE" | python3 -m json.tool

TICKET_ID=$(echo "$ESCALATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ticket',{}).get('id',''))")
echo "Ticket criado: $TICKET_ID"

# Passo 3: Atendente assume o ticket
echo ""
echo "=== Passo 3: Assumir ticket ==="
curl -s -X PATCH "http://localhost:3003/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"assignedTo":"tecnico-joao","status":"in_progress"}' | python3 -m json.tool

# Passo 4: Verificar que IA foi silenciada
echo ""
echo "=== Passo 4: Verificar agentHandling ==="
curl -s -X POST http://localhost:3002/classify \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Ainda nao funciona\",\"phone\":\"$PHONE\"}" | python3 -m json.tool
# Esperado: "agentHandling": true

# Passo 5: Fechar ticket
echo ""
echo "=== Passo 5: Fechar ticket ==="
curl -s -X PATCH "http://localhost:3003/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"closed"}' | python3 -m json.tool

# Passo 6: Confirmar que IA retomou
echo ""
echo "=== Passo 6: IA retomou o atendimento? ==="
curl -s -X POST http://localhost:3002/classify \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Obrigado!\",\"phone\":\"$PHONE\"}" | python3 -m json.tool
# Esperado: "agentHandling": false
```

### 9.4 Verificar cobertura de TypeScript (sem erros de tipo)

```bash
# Verificar cada servico sem compilar
cd services/business-engine && npx tsc --noEmit
cd services/dashboard-api   && npx tsc --noEmit
cd services/chat-simulator  && npx tsc --noEmit
```

Sem saida = sem erros de tipo.

---

## Referencia Rapida de Endpoints

### Business Engine (porta 3002)

```bash
# Classificar mensagem
POST http://localhost:3002/classify
{
  "message": "texto da mensagem",
  "phone": "5511999999999",
  "conversationHistory": []  // opcional
}

# Gerar resposta da IA
POST http://localhost:3002/respond
{
  "message": "texto",
  "phone": "5511999999999",
  "category": "hardware",
  "conversationHistory": []
}

# Escalar para atendente
POST http://localhost:3002/escalate
{
  "phone": "5511999999999",
  "category": "hardware",
  "messages": ["mensagem 1", "mensagem 2"],
  "reason": "motivo da escalacao",
  "priority": "high"  // critical, high, medium, low
}
```

### Dashboard API (porta 3003)

```bash
# Listar tickets
GET  http://localhost:3003/tickets

# Ver ticket especifico
GET  http://localhost:3003/tickets/:id

# Atualizar ticket (assumir, fechar, etc.)
PATCH http://localhost:3003/tickets/:id
{
  "status": "in_progress",   // open, assigned, in_progress, resolved, closed
  "assignedTo": "nome-tecnico",
  "priority": "high"
}

# Listar mensagens de um ticket
GET  http://localhost:3003/tickets/:id/messages

# Atendente envia mensagem
POST http://localhost:3003/tickets/:id/messages
{
  "sender": "agent",
  "content": "texto da resposta"
}
```
