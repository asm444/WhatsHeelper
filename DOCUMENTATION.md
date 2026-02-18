# Documentação Completa: WhatsApp ChatBot - Amaral Support

## Contexto

Este documento fornece uma visão completa da arquitetura, tecnologias, configurações e fluxos de dados do sistema de chatbot de suporte ao cliente via WhatsApp para a empresa fictícia "Amaral Support". O sistema resolve problemas comuns automaticamente usando IA (Google Gemini) e escala para atendentes humanos quando necessário.

---

## 1. VISÃO GERAL DA ARQUITETURA

### 1.1 Stack Tecnológica

| Componente | Tecnologia | Porta | Justificativa |
|---|---|---|---|
| **Orquestrador** | n8n (Docker) | 5678 | Workflow automation, webhooks nativos, visual programming |
| **WhatsApp Bridge** | WAHA Core (Docker) | 3000 | Gratuito, Apache 2.0, API REST compatível com WhatsApp Web, integração nativa com n8n |
| **LLM** | Google Gemini Pro (API) | - | Free tier: 15 req/min, 1M tokens/dia, qualidade superior, sem infra local |
| **Banco de Dados** | PostgreSQL 16 (Docker) | 5432 | ACID compliance, JSON support (JSONB), necessário pelo n8n, compartilhado entre serviços |
| **Linguagem** | TypeScript (Node.js 20) | - | Type safety, mesma linguagem front/back, ecossistema maduro |
| **Simulador de Chat** | Express + Socket.IO | 3001 | Testes sem WhatsApp real, replica formato WAHA, UI web interativa |
| **Motor de Regras (IA)** | Express.js | 3002 | Classificação de mensagens, geração de respostas, escalação inteligente |
| **API do Dashboard** | Express.js + WebSocket | 3003 | CRUD de tickets, comunicação real-time com dashboard |
| **Frontend Atendente** | HTML/CSS/JS (Vite + Nginx) | 3004 | Leve, sem overhead de framework pesado, deploy simples |

### 1.2 Por Que Cada Tecnologia?

#### **n8n (Orquestrador)**
- ✅ **Visual workflow**: Lógica de negócio visível e auditável
- ✅ **Webhooks nativos**: Integração fácil entre serviços
- ✅ **PostgreSQL integrado**: Persistência de workflows e execuções
- ✅ **Extensível**: Suporta custom nodes e JavaScript
- ✅ **Self-hosted**: Controle total, gratuito, sem vendor lock-in

#### **Google Gemini Pro (vs Ollama/ChatGPT)**
- ✅ **Gratuito**: 15 requests/min, 1M tokens/dia sem custo
- ✅ **Leve**: Sem container Docker extra (economiza ~6GB RAM)
- ✅ **Rápido**: `gemini-2.0-flash` com latência baixa
- ✅ **Qualidade**: Superior em português comparado a modelos locais
- ✅ **Sem setup**: Apenas API key, sem download de modelos

#### **WAHA Core (vs Baileys/Venom)**
- ✅ **Gratuito**: Versão Core open-source (Apache 2.0)
- ✅ **Integração n8n**: Nó nativo `@devlikeapro/n8n-nodes-waha`
- ✅ **API REST**: Fácil de testar e integrar
- ✅ **Estável**: Baseado no WhatsApp Web JS

#### **PostgreSQL (vs MySQL/MongoDB)**
- ✅ **JSONB**: Suporte nativo a JSON com índices e queries
- ✅ **ACID**: Transações confiáveis para tickets críticos
- ✅ **Extensível**: Suporte a full-text search, triggers, functions
- ✅ **n8n requirement**: n8n já usa PostgreSQL, compartilhamos o mesmo banco

#### **TypeScript (vs JavaScript puro)**
- ✅ **Type safety**: Detecta erros em tempo de compilação
- ✅ **IntelliSense**: Autocomplete e documentação inline
- ✅ **Refactoring**: Mudanças seguras com suporte de IDE
- ✅ **Ecossistema**: Mesmo em front (Vite) e back (Express)

---

## 2. ARQUITETURA DO SISTEMA

### 2.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          AMARAL ALLSUPORT CHATBOT                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  Cliente        │
│  (WhatsApp)     │
└────────┬────────┘
         │
         │ Mensagem
         │
         ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  WAHA / Chat Simulator (Port 3001)                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Recebe mensagens via Socket.IO (simulador web)                       │
│  • Envia mensagens para cliente (bot/agent)                             │
│  • API compatível com WAHA (/api/sendText, /api/sessions)               │
└─────────────────┬───────────────────────────────────────────────────────┘
                  │
                  │ POST /webhook/waha
                  │ (formato WAHA JSON)
                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  n8n Workflow Orchestrator (Port 5678)                                  │
│  ─────────────────────────────────────────────────────────────────────  │
│  Workflow 1: Main Chatbot                                               │
│    1. Recebe webhook WAHA                                               │
│    2. Filtra eventos (apenas "message")                                 │
│    3. POST /classify → Business Engine                                  │
│    4. Decisão: Atendente ativo?                                         │
│       └─ SIM: Retorna 200 (IA silenciada)                               │
│       └─ NÃO: Continua                                                  │
│    5. Decisão: Precisa escalar?                                         │
│       └─ NÃO: POST /respond → Envia resposta IA                         │
│       └─ SIM: POST /escalate → Cria ticket                              │
│                                                                          │
│  Workflow 2: Agent Response                                             │
│    1. Recebe webhook de mensagem do atendente                           │
│    2. POST /api/sendText → Envia ao cliente                             │
└─────────────────┬───────────────────────┬───────────────────────────────┘
                  │                           │
      ┌───────────┘                           └───────────┐
      │                                                   │
      │ POST /classify                                    │ POST /escalate
      │ POST /respond                                     │
      ↓                                                   ↓
┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
│  Business Engine (Port 3002)         │  │  Dashboard API (Port 3003)       │
│  ──────────────────────────────────  │  │  ──────────────────────────────  │
│  • AI Classification (Gemini)        │  │  • CRUD de tickets               │
│  • Response Generation (Gemini)      │  │  • Gerenciamento de conversas    │
│  • Ticket Escalation                 │  │  • WebSocket real-time           │
│  • Keyword matching (fallback)       │  │  • Agente envia mensagens        │
│  • Escalation rules                  │  │                                  │
│                                      │  │                                  │
│  Endpoints:                          │  │  Endpoints:                      │
│    POST /classify                    │  │    GET    /tickets               │
│    POST /respond                     │  │    GET    /tickets/:id           │
│    POST /escalate                    │  │    POST   /tickets               │
│    GET  /health                      │  │    PATCH  /tickets/:id           │
│                                      │  │    POST   /tickets/:id/messages  │
│  Integrações:                        │  │    GET    /tickets/:id/messages  │
│    → Google Gemini API               │  │    POST   /webhook               │
│    → PostgreSQL                      │  │    GET    /health                │
│    → Dashboard API (webhook)         │  │    WS     / (WebSocket)          │
└──────────────────┬───────────────────┘  └────────────┬─────────────────────┘
                   │                                   │
                   │                                   │ WebSocket
                   │                                   │ events
                   ↓                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL Database (Port 5432)                                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  Tabelas:                                                               │
│    • customers      (id, phone, name)                                   │
│    • conversations  (id, customer_id, status, category)                 │
│    • messages       (id, conversation_id, sender, content)              │
│    • tickets        (id, conversation_id, category, summary,            │
│                      priority, status, assigned_to, sla_deadline)       │
│    • n8n_*          (workflows, executions, credentials)                │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↑
                                   │ WebSocket updates
                                   │
┌─────────────────────────────────────────────────────────────────────────┐
│  Agent Dashboard (Port 3004)                                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Frontend (HTML/CSS/JS via Vite + Nginx)                              │
│  • Lista de tickets (status, prioridade, categoria)                     │
│  • Detalhes do ticket (histórico de mensagens)                          │
│  • Interface para enviar respostas                                      │
│  • Atualizações em tempo real via WebSocket                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. FLUXOGRAMAS DETALHADOS

### 3.1 Fluxo Principal: Mensagem do Cliente

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO: NOVA MENSAGEM DO CLIENTE                      │
└─────────────────────────────────────────────────────────────────────────┘

   [INÍCIO]
      │
      │ Cliente digita mensagem
      │ no WhatsApp
      ↓
┌─────────────────────┐
│ Chat Simulator      │
│ Recebe via Socket.IO│
└──────────┬──────────┘
           │
           │ Formata payload WAHA:
           │ {
           │   event: "message",
           │   payload: {
           │     from: "5511999999999@c.us",
           │     body: "Meu computador não liga",
           │     timestamp: 1708000000
           │   }
           │ }
           ↓
┌─────────────────────┐
│ POST                │
│ /webhook/waha       │
│ (n8n)               │
└──────────┬──────────┘
           │
           ↓
      ┌────────────┐
      │ n8n Node 1 │
      │ WAHA Webhook│
      └─────┬──────┘
            │
            ↓
      ┌────────────┐
      │ n8n Node 2 │
      │ Filtrar    │
      │ Mensagens  │
      └─────┬──────┘
            │
            │ event == "message"?
            ↓
        <Decisão>
      ┌─────┴─────┐
      │           │
     NÃO         SIM
      │           │
      ↓           ↓
   [FIM]    ┌────────────┐
            │ n8n Node 3 │
            │ Classificar│
            │ Mensagem   │
            └─────┬──────┘
                  │
                  │ POST /classify
                  │ {
                  │   message: "Meu computador não liga",
                  │   phone: "5511999999999",
                  │   conversationHistory: []
                  │ }
                  ↓
            ┌──────────────────┐
            │ Business Engine  │
            │ /classify        │
            └─────┬────────────┘
                  │
                  │ 1. Verifica se atendente está ativo
                  │    Query: SELECT tickets WHERE phone = X
                  │            AND assigned_to IS NOT NULL
                  │            AND status NOT IN ('closed', 'resolved')
                  │
                  ↓
              <Decisão>
            ┌─────┴─────┐
            │           │
      ATENDENTE      NENHUM
       ATIVO        ATENDENTE
            │           │
            ↓           ↓
    ┌───────────┐  ┌──────────────┐
    │ Salva msg │  │ 2. Classifica│
    │ na        │  │    com IA    │
    │ conversa  │  │    (Gemini)  │
    └─────┬─────┘  └──────┬───────┘
          │                │
          │                │ Retorna:
          │                │ {
          │                │   category: "hardware",
          │                │   confidence: 0.7,
          │                │   escalation: {
          │                │     shouldEscalate: false
          │                │   }
          │                │ }
          │                ↓
          │          ┌────────────┐
          │          │ n8n Node 4 │
          │          │ Atendente  │
          │          │ Ativo?     │
          │          └─────┬──────┘
          │                │
          │                │ agentHandling == true?
          │                ↓
          │            <Decisão>
          │          ┌─────┴─────┐
          │          │           │
          │         SIM         NÃO
          │          │           │
          └──────────┤           ↓
                     │     ┌────────────┐
                     │     │ n8n Node 5 │
                     │     │ Precisa    │
                     │     │ Escalar?   │
                     │     └─────┬──────┘
                     │           │
                     │           │ shouldEscalate?
                     │           ↓
                     │       <Decisão>
                     │     ┌─────┴─────┐
                     │     │           │
                     │    NÃO         SIM
                     │     │           │
                     │     ↓           ↓
                     │ ┌────────┐  ┌────────┐
                     │ │ POST   │  │ POST   │
                     │ │/respond│  │/escalate│
                     │ └────┬───┘  └────┬───┘
                     │      │           │
                     │      │ Gemini    │ Gemini
                     │      │ gera      │ cria
                     │      │ resposta  │ resumo
                     │      ↓           ↓
                     │ ┌──────────┐ ┌──────────┐
                     │ │ Envia    │ │ Cria     │
                     │ │ resposta │ │ ticket   │
                     │ │ IA ao    │ │ no BD    │
                     │ │ cliente  │ │          │
                     │ └────┬─────┘ └────┬─────┘
                     │      │            │
                     │      │            │ Webhook
                     │      │            │ Dashboard
                     │      │            ↓
                     │      │      ┌──────────┐
                     │      │      │ Dashboard│
                     │      │      │ API      │
                     │      │      │ notifica │
                     │      │      │ via WS   │
                     │      │      └────┬─────┘
                     │      │           │
                     │      │           ↓
                     │      │      ┌──────────┐
                     │      │      │ Envia    │
                     │      │      │ msg de   │
                     │      │      │ escalação│
                     │      │      └────┬─────┘
                     │      │           │
                     ↓      ↓           ↓
               ┌────────────────────────┐
               │ n8n Node 9             │
               │ Responder 200          │
               └────────────┬───────────┘
                            │
                            ↓
                         [FIM]
```

### 3.2 Fluxo: Atendente Responde Cliente

```
┌─────────────────────────────────────────────────────────────────────────┐
│                FLUXO: ATENDENTE ENVIA RESPOSTA AO CLIENTE               │
└─────────────────────────────────────────────────────────────────────────┘

   [INÍCIO]
      │
      │ Atendente digita resposta
      │ no Dashboard
      ↓
┌─────────────────────┐
│ Agent Dashboard     │
│ (Frontend)          │
└──────────┬──────────┘
           │
           │ POST /tickets/:id/messages
           │ {
           │   sender: "agent",
           │   content: "Olá! Verifique se o cabo está conectado."
           │ }
           ↓
┌─────────────────────┐
│ Dashboard API       │
│ /tickets/:id/messages│
└──────────┬──────────┘
           │
           │ 1. Verifica se ticket existe
           │    SELECT conversation_id
           │    FROM tickets WHERE id = X
           ↓
┌─────────────────────┐
│ PostgreSQL          │
│ INSERT INTO messages│
│ (conversation_id,   │
│  sender='agent',    │
│  content)           │
└──────────┬──────────┘
           │
           │ 2. Busca phone do cliente
           │    SELECT c.phone FROM tickets t
           │    JOIN customers c ON t.customer_id = c.id
           ↓
┌─────────────────────┐
│ POST                │
│ /webhook/           │
│ agent-response      │
│ (n8n)               │
└──────────┬──────────┘
           │
           │ {
           │   chatId: "5511999999999@c.us",
           │   text: "Olá! Verifique se o cabo..."
           │ }
           ↓
┌─────────────────────┐
│ n8n Workflow 2      │
│ Agent Response      │
└──────────┬──────────┘
           │
           │ Node 1: Recebe webhook
           ↓
┌─────────────────────┐
│ Node 2: POST        │
│ /api/sendText       │
│ (Chat Simulator)    │
└──────────┬──────────┘
           │
           │ {
           │   chatId: "5511999999999@c.us",
           │   text: "[Atendente] Olá! Verifique...",
           │   session: "default"
           │ }
           ↓
┌─────────────────────┐
│ Chat Simulator      │
│ Envia via Socket.IO │
└──────────┬──────────┘
           │
           │ Socket event: bot_message
           ↓
┌─────────────────────┐
│ Cliente             │
│ (WhatsApp)          │
│ Recebe mensagem     │
└─────────────────────┘
           │
           ↓
        [FIM]
```

### 3.3 Fluxo: Escalação para Atendente

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO: ESCALAÇÃO PARA ATENDENTE                      │
└─────────────────────────────────────────────────────────────────────────┘

   [INÍCIO]
      │
      │ IA detecta necessidade de escalação
      │ (baixa confiança, pedido explícito, etc.)
      ↓
┌─────────────────────┐
│ n8n                 │
│ POST /escalate      │
└──────────┬──────────┘
           │
           │ {
           │   phone: "5511999999999",
           │   category: "hardware",
           │   messages: ["Cliente: Meu PC não liga"],
           │   reason: "Confiança baixa (0.35)",
           │   priority: "medium"
           │ }
           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Business Engine /escalate                                               │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           │ 1. Gera resumo com IA
           │    POST Gemini API
           ↓
┌─────────────────────┐
│ Gemini API          │
│ Retorna summary:    │
│ "Cliente relata..." │
│ keyPoints: [...]    │
│ priority: "high"    │
└──────────┬──────────┘
           │
           │ 2. Calcula SLA deadline
           │    high = 4 horas
           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL - Sequência de INSERTs                                       │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           │ a. UPSERT customer
           │    INSERT INTO customers (phone)
           │    ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
           │    RETURNING id
           ↓
┌─────────────────────┐
│ customer_id =       │
│ "uuid-123"          │
└──────────┬──────────┘
           │
           │ b. SELECT existing conversation
           │    SELECT id FROM conversations
           │    WHERE customer_id = X AND status != 'closed'
           ↓
        <Existe?>
      ┌─────┴─────┐
      │           │
     SIM         NÃO
      │           │
      ↓           ↓
┌──────────┐ ┌──────────┐
│ Reutiliza│ │ INSERT   │
│ conversa │ │ INTO     │
│          │ │ conversa │
└────┬─────┘ └────┬─────┘
     │            │
     └─────┬──────┘
           │ conversation_id = "uuid-456"
           │
           │ c. INSERT messages
           │    FOR EACH message IN messages[]:
           │      INSERT INTO messages (conversation_id, sender, content)
           ↓
┌─────────────────────┐
│ Mensagens salvas    │
└──────────┬──────────┘
           │
           │ d. SELECT existing ticket
           │    SELECT id FROM tickets
           │    WHERE conversation_id = X
           │    AND status NOT IN ('closed', 'resolved')
           ↓
        <Existe?>
      ┌─────┴─────┐
      │           │
     SIM         NÃO
      │           │
      ↓           ↓
┌──────────┐ ┌──────────┐
│ UPDATE   │ │ INSERT   │
│ ticket   │ │ INTO     │
│ summary  │ │ tickets  │
└────┬─────┘ └────┬─────┘
     │            │
     └─────┬──────┘
           │ ticket_id = "uuid-789"
           │
           │ e. Notify Dashboard API
           │    POST /webhook
           │    event: "ticket.created" ou "ticket.updated"
           ↓
┌─────────────────────┐
│ Dashboard API       │
│ /webhook            │
└──────────┬──────────┘
           │
           │ 1. Armazena em memória
           │ 2. Broadcast via WebSocket
           ↓
┌─────────────────────┐
│ Agent Dashboard     │
│ (Frontend)          │
│ Recebe notificação  │
│ em tempo real       │
└──────────┬──────────┘
           │
           │ Atendente vê novo ticket:
           │ - Cliente: 5511999999999
           │ - Categoria: hardware
           │ - Prioridade: high
           │ - SLA: 4h
           │ - Resumo: "Cliente relata..."
           ↓
        [FIM]
```

### 3.4 Fluxo: Atendente Fecha Ticket

```
┌─────────────────────────────────────────────────────────────────────────┐
│                FLUXO: ATENDENTE FECHA TICKET (IA RETOMA)                │
└─────────────────────────────────────────────────────────────────────────┘

   [INÍCIO]
      │
      │ Atendente clica em "Fechar Ticket"
      │ no Dashboard
      ↓
┌─────────────────────┐
│ Agent Dashboard     │
│ (Frontend)          │
└──────────┬──────────┘
           │
           │ PATCH /tickets/:id
           │ {
           │   status: "closed"
           │ }
           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Dashboard API /tickets/:id (PATCH)                                      │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           │ 1. Valida campos permitidos
           │    status, assignedTo, priority, etc.
           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ LÓGICA ESPECIAL:                                                        │
│                                                                          │
│ IF status IN ('closed', 'resolved')                                     │
│    AND assignedTo is undefined:                                         │
│      SET assigned_to = NULL                                             │
│                                                                          │
│ Motivo: Libera a conversa de volta para a IA                            │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           │ UPDATE tickets
           │ SET status = 'closed',
           │     assigned_to = NULL,
           │     updated_at = NOW()
           │ WHERE id = X
           ↓
┌─────────────────────┐
│ PostgreSQL          │
│ Ticket atualizado   │
└──────────┬──────────┘
           │
           │ Retorna ticket atualizado
           ↓
┌─────────────────────┐
│ Agent Dashboard     │
│ Mostra confirmação  │
└─────────────────────┘
           │
           ↓
   ┌────────────────────────────────────────────────┐
   │ PRÓXIMA MENSAGEM DO CLIENTE:                   │
   │                                                │
   │ Cliente envia: "Obrigado!"                     │
   │          ↓                                     │
   │ POST /classify                                 │
   │          ↓                                     │
   │ Query: SELECT tickets                          │
   │        WHERE phone = X                         │
   │        AND assigned_to IS NOT NULL             │
   │        AND status NOT IN ('closed', 'resolved')│
   │          ↓                                     │
   │ RESULTADO: Nenhum ticket encontrado            │
   │            (assigned_to = NULL agora!)         │
   │          ↓                                     │
   │ IA CLASSIFICA E RESPONDE NORMALMENTE ✓         │
   └────────────────────────────────────────────────┘
           │
           ↓
        [FIM]
```

---

## 4. CONFIGURAÇÃO E DEPLOYMENT

### 4.1 Estrutura de Diretórios

```
WhatsAppChatBot/
├── docker-compose.yml          # Orquestração de todos os containers
├── .env                        # Variáveis de ambiente (NÃO commitado)
├── .env.example                # Template de configuração
├── services/
│   ├── chat-simulator/         # Simulador de WhatsApp
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts       # Express + Socket.IO
│   │       ├── routes/         # /api/sendText, /api/sessions
│   │       ├── simulator/      # Lógica de simulação WAHA
│   │       └── public/         # UI do simulador
│   ├── business-engine/        # Motor de IA e regras
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/         # /classify, /respond, /escalate
│   │       ├── ai/             # gemini-client.ts
│   │       ├── rules/          # categories.ts, escalation.ts
│   │       └── db/             # pool.ts, init.sql
│   ├── dashboard-api/          # API para atendentes
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/         # tickets.ts, webhook.ts
│   │       └── websocket/      # WebSocket server
│   ├── agent-dashboard/        # Frontend do atendente
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── src/
│   │       ├── index.html
│   │       ├── components/     # UI components
│   │       ├── services/       # API client, WebSocket
│   │       └── styles/         # CSS
│   └── n8n/                    # Custom n8n com patch
│       └── Dockerfile          # Aplica fix de webhook
├── n8n/workflows/              # JSONs dos workflows
│   ├── main-chatbot.json       # Workflow principal
│   └── agent-response.json     # Workflow de resposta
└── scripts/                    # Scripts de utilidade
    ├── health-check.sh
    └── import-workflows.sh
```

### 4.2 Variáveis de Ambiente (.env)

```bash
# PostgreSQL
POSTGRES_USER=amaral
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=amaral_suport
POSTGRES_PORT=5432
DATABASE_URL=postgresql://amaral:your_secure_password_here@postgres:5432/amaral_suport

# n8n
N8N_PORT=5678
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_secure_password_here
N8N_ENCRYPTION_KEY=change-me-to-random-string-min-32-chars

# WAHA
WAHA_PORT=3000

# Business Engine
BUSINESS_ENGINE_PORT=3002
GEMINI_API_KEY=your-gemini-api-key-from-aistudio
GEMINI_MODEL=gemini-2.0-flash
CONFIDENCE_THRESHOLD=0.4
MAX_RETRIES_BEFORE_ESCALATION=3

# Dashboard API
DASHBOARD_API_PORT=3003

# Chat Simulator
CHAT_SIMULATOR_PORT=3001

# Agent Dashboard
DASHBOARD_FRONTEND_PORT=3004
```

### 4.3 Como Iniciar o Sistema

```bash
# 1. Clone o repositório
git clone <repo-url>
cd WhatsAppChatBot

# 2. Copie .env.example para .env e configure
cp .env.example .env
# Edite .env e adicione sua GEMINI_API_KEY

# 3. Inicie todos os containers
docker compose up -d

# 4. Aguarde healthcheck do PostgreSQL (~10s)
docker compose ps

# 5. Importe workflows do n8n (via script ou UI)
# Via script:
./scripts/import-workflows.sh

# Via UI (alternativa):
# - Acesse http://localhost:5678
# - Login: admin / [sua_senha_do_.env]
# - Import workflows de n8n/workflows/*.json
# - Ative ambos workflows

# 6. Verifique serviços
curl http://localhost:3001/health  # Chat Simulator
curl http://localhost:3002/health  # Business Engine
curl http://localhost:3003/health  # Dashboard API
curl http://localhost:5678         # n8n

# 7. Acesse interfaces
# - Chat Simulator: http://localhost:3001
# - n8n: http://localhost:5678
# - Agent Dashboard: http://localhost:3004
```

### 4.4 Portas e URLs

| Serviço | Porta Externa | URL | Descrição |
|---------|---------------|-----|-----------|
| **PostgreSQL** | 5432 | `postgresql://amaral:YOUR_PASSWORD@localhost:5432/amaral_suport` | Banco de dados |
| **n8n** | 5678 | http://localhost:5678 | Interface do n8n |
| **WAHA** | 3000 | http://localhost:3000 | WhatsApp API (produção) |
| **Chat Simulator** | 3001 | http://localhost:3001 | Simulador de testes |
| **Business Engine** | 3002 | http://localhost:3002 | API de IA |
| **Dashboard API** | 3003 | http://localhost:3003 | API backend |
| **Agent Dashboard** | 3004 | http://localhost:3004 | UI do atendente |

### 4.5 Configuração do n8n

#### Credenciais Necessárias

Nenhuma credencial explícita é necessária nos workflows (todos os serviços são internos). Em produção, adicione:

1. **WAHA Credentials** (quando usar WAHA real)
   - Type: Header Auth
   - Header: `X-API-KEY`
   - Value: `<sua-api-key-waha>`

2. **Gemini API** (já configurado via env var no Business Engine)
   - Não requer configuração no n8n
   - API key está em `GEMINI_API_KEY` no container business-engine

#### Patch Crítico Aplicado

O Dockerfile de n8n aplica um patch para corrigir bug de registro de webhooks:

```dockerfile
# services/n8n/Dockerfile
FROM n8nio/n8n:latest

# Fix n8n v2.7.4 webhook registration bug
RUN sed -i "s/\['init', 'leadershipChange'\]\.includes/['init', 'leadershipChange', 'activate'].includes/g" /usr/local/lib/node_modules/n8n/dist/active-workflow-manager.js

RUN echo "✓ N8N webhook registration patch applied"
```

**Problema**: n8n v2.7.4 só registra webhooks em eventos `init` ou `leadershipChange`, ignorando ativações via API.

**Solução**: Adiciona `'activate'` à lista, permitindo registro de webhooks ao ativar workflows via API REST.

---

## 5. ESQUEMA DO BANCO DE DADOS

### 5.1 Diagrama ER

```
┌─────────────────────┐
│     CUSTOMERS       │
│─────────────────────│
│ • id (PK, UUID)     │
│ • phone (UNIQUE)    │
│ • name              │
│ • created_at        │
│ • updated_at        │
└──────────┬──────────┘
           │ 1
           │
           │ N
           │
┌──────────▼──────────┐
│   CONVERSATIONS     │
│─────────────────────│
│ • id (PK, UUID)     │
│ • customer_id (FK)  │◄─────────┐
│ • status            │          │
│ • category          │          │
│ • retry_count       │          │
│ • created_at        │          │
│ • updated_at        │          │
└──────────┬──────────┘          │
           │ 1                   │
           │                     │
           │ N                   │ 1
           │                     │
┌──────────▼──────────┐          │
│     MESSAGES        │          │
│─────────────────────│          │
│ • id (PK, UUID)     │          │
│ • conversation_id   │          │
│   (FK)              │          │
│ • sender            │          │
│ • content           │          │
│ • metadata (JSONB)  │          │
│ • created_at        │          │
└─────────────────────┘          │
                                 │
┌─────────────────────┐          │
│      TICKETS        │          │
│─────────────────────│          │
│ • id (PK, UUID)     │          │
│ • conversation_id   │──────────┘
│   (FK)              │
│ • customer_id (FK)  │──────┐
│ • status            │      │
│ • priority          │      │
│ • category          │      │
│ • summary           │      │
│ • escalation_reason │      │
│ • assigned_to       │      │
│ • sla_deadline      │      │
│ • created_at        │      │
│ • updated_at        │      │
└─────────────────────┘      │
                             │ N
                             │
                             │ 1
                ┌────────────▼──────────┐
                │     CUSTOMERS         │
                └───────────────────────┘
```

### 5.2 Definições SQL

```sql
-- Tabela: customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'escalated', 'closed')),
    category VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_status ON conversations(status);

-- Tabela: messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender VARCHAR(10) NOT NULL
        CHECK (sender IN ('customer', 'bot', 'agent')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- Tabela: tickets
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'open'
        CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(10) DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    category VARCHAR(50) NOT NULL,
    summary TEXT NOT NULL,
    escalation_reason TEXT,
    assigned_to VARCHAR(255),
    sla_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
```

### 5.3 Relacionamentos

| Relação | Tipo | Descrição |
|---------|------|-----------|
| customers → conversations | 1:N | Um cliente pode ter várias conversas |
| conversations → messages | 1:N | Uma conversa contém várias mensagens |
| customers → tickets | 1:N | Um cliente pode ter vários tickets |
| conversations → tickets | 1:N | Uma conversa pode gerar múltiplos tickets (tipicamente 1:1) |

### 5.4 Regras de Negócio no Banco

1. **Status de Conversa**:
   - `active`: Conversa em andamento com IA
   - `escalated`: Escalada para atendente humano
   - `closed`: Finalizada

2. **Prioridade de Ticket (SLA)**:
   - `critical`: 1 hora
   - `high`: 4 horas
   - `medium`: 8 horas
   - `low`: 24 horas

3. **Status de Ticket**:
   - `open`: Criado, aguardando atendente
   - `assigned`: Atribuído a um atendente
   - `in_progress`: Atendente trabalhando
   - `resolved`: Resolvido pelo atendente
   - `closed`: Finalizado (libera conversa para IA)

4. **Sender em Messages**:
   - `customer`: Mensagem do cliente
   - `bot`: Resposta da IA
   - `agent`: Mensagem do atendente humano

---

## 6. INTEGRAÇÃO COM GOOGLE GEMINI

### 6.1 Por Que Gemini?

| Critério | Google Gemini Pro | Alternativas (Ollama, GPT-3.5) |
|----------|-------------------|--------------------------------|
| **Custo** | ✅ Gratuito (15 req/min, 1M tokens/dia) | ❌ Ollama gratuito mas usa recursos locais; GPT-3.5 pago |
| **Infra** | ✅ API externa, sem container | ❌ Ollama requer ~6GB RAM + container Docker |
| **Latência** | ✅ ~500ms (gemini-2.0-flash) | ⚠️ Ollama ~2-5s; GPT-3.5 ~1s |
| **Qualidade PT-BR** | ✅ Excelente | ⚠️ Ollama limitado; GPT-3.5 bom |
| **Setup** | ✅ Apenas API key | ❌ Ollama requer download de modelos |

### 6.2 Configuração da API

**Obtenção da API Key:**
1. Acesse https://aistudio.google.com/apikey
2. Faça login com conta Google
3. Clique em "Create API Key"
4. Copie a chave gerada
5. Adicione em `.env`:
   ```bash
   GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

**SDK Utilizado:**
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0"
  }
}
```

**Exemplo de Uso (services/business-engine/src/ai/gemini-client.ts):**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
});

export async function classifyMessage(
  message: string,
  conversationHistory: string[]
): Promise<ClassificationResult> {
  const prompt = `
Você é um assistente de suporte técnico da empresa Amaral Support.

Categorias disponíveis:
- hardware: Problemas com equipamentos físicos (computador, impressora, periféricos)
- software: Problemas com aplicativos, sistemas operacionais
- rede: Problemas de conexão, internet, Wi-Fi
- conta: Acesso, senha, permissões
- faturamento: Cobranças, pagamentos, faturas

Mensagem do cliente: "${message}"

Analise e retorne em JSON:
{
  "category": "categoria detectada",
  "confidence": número entre 0 e 1,
  "reasoning": "explicação breve"
}
`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  const parsed = JSON.parse(response);

  return {
    category: parsed.category,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning
  };
}
```

### 6.3 Limites e Fallbacks

**Free Tier Limits:**
- 15 requests/minuto
- 1.500 requests/dia
- 1.000.000 tokens/dia

**Estratégia de Fallback:**

```typescript
try {
  // Tenta Gemini API
  aiResult = await classifyMessage(message, conversationHistory);
} catch (err) {
  // Fallback 1: Keyword matching (rápido, sem API)
  const keywordResult = findCategoryByKeywords(message);

  if (keywordResult) {
    aiResult = {
      category: keywordResult.category.id,
      confidence: keywordResult.matchScore,
      reasoning: 'Classificação por keywords (Gemini indisponível)'
    };
  } else {
    // Fallback 2: Categoria padrão
    aiResult = {
      category: 'software',
      confidence: 0.2,
      reasoning: 'Classificação padrão (Gemini indisponível)'
    };
  }
}
```

---

## 7. TESTES

### 7.1 Estratégia de Testes

| Tipo | Ferramenta | Escopo | Quando Rodar |
|------|------------|--------|--------------|
| **Unitários** | Jest | Funções puras (rules, utils) | A cada commit |
| **Integração** | Jest + Supertest | APIs + PostgreSQL | Pre-deploy |
| **E2E** | Scripts bash + curl | Fluxo completo via n8n | Pre-release |
| **Manual** | Chat Simulator UI | Testes exploratórios | Desenvolvimento |

### 7.2 Como Rodar Testes

```bash
# Testes unitários (sem dependências externas)
cd services/business-engine
npm test

# Testes de integração (requer PostgreSQL)
docker compose up -d postgres
npm run test:integration

# Teste E2E completo
docker compose up -d
./scripts/e2e-test.sh

# Teste manual via Chat Simulator
open http://localhost:3001
# Digite mensagens na UI e observe o fluxo
```

### 7.3 Exemplo de Teste E2E

```bash
#!/bin/bash
# scripts/e2e-test.sh

echo "=== TESTE E2E: Fluxo Completo ==="

# 1. Cliente envia mensagem
PHONE="5511987654321"
MSG="Meu computador não liga"

CLASSIFY=$(curl -s -X POST "http://localhost:3002/classify" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$MSG\",\"phone\":\"$PHONE\"}")

CATEGORY=$(echo $CLASSIFY | jq -r '.category')
echo "✓ Categoria detectada: $CATEGORY"

# 2. Escalar conversa
ESCALATE=$(curl -s -X POST "http://localhost:3002/escalate" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"category\":\"$CATEGORY\",\"messages\":[\"$MSG\"],\"reason\":\"Teste E2E\",\"priority\":\"high\"}")

TICKET_ID=$(echo $ESCALATE | jq -r '.ticket.id')
echo "✓ Ticket criado: $TICKET_ID"

# 3. Atendente assume
curl -s -X PATCH "http://localhost:3003/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"assignedTo":"joao-silva"}' > /dev/null

echo "✓ Ticket atribuído a joao-silva"

# 4. Cliente manda nova mensagem (atendente ativo)
CLASSIFY2=$(curl -s -X POST "http://localhost:3002/classify" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Ainda não funciona\",\"phone\":\"$PHONE\"}")

AGENT_HANDLING=$(echo $CLASSIFY2 | jq -r '.agentHandling')

if [ "$AGENT_HANDLING" = "true" ]; then
  echo "✓ IA silenciada corretamente (agentHandling=true)"
else
  echo "✗ ERRO: IA não foi silenciada!"
  exit 1
fi

# 5. Atendente fecha ticket
curl -s -X PATCH "http://localhost:3003/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"closed"}' > /dev/null

echo "✓ Ticket fechado"

# 6. Cliente manda mensagem após fechamento
CLASSIFY3=$(curl -s -X POST "http://localhost:3002/classify" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Obrigado!\",\"phone\":\"$PHONE\"}")

AGENT_HANDLING3=$(echo $CLASSIFY3 | jq -r '.agentHandling')

if [ "$AGENT_HANDLING3" != "true" ]; then
  echo "✓ IA retomou atendimento após fechamento"
else
  echo "✗ ERRO: IA ainda está silenciada!"
  exit 1
fi

echo ""
echo "=== TESTE E2E PASSOU ✓ ==="
```

---

## 8. TROUBLESHOOTING

### 8.1 Problemas Comuns

#### Problema: Webhooks do n8n retornam 404

**Causa:** n8n v2.7.4 tem bug onde ativar workflows via API não registra webhooks.

**Solução:**
1. Certifique-se que o Dockerfile do n8n tem o patch aplicado
2. Rebuild: `docker compose build n8n`
3. Reimporte workflows: `./scripts/import-workflows.sh`
4. Verifique: `curl http://localhost:5678/webhook/waha`

#### Problema: Business Engine não consegue chamar Gemini API

**Causa:** API key inválida ou limite de rate excedido.

**Diagnóstico:**
```bash
# Verifique env var
docker compose exec business-engine env | grep GEMINI

# Teste API key manualmente
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_KEY"
```

**Solução:**
- Verifique quota em https://aistudio.google.com/apikey
- Aguarde 1 minuto se excedeu rate limit
- Gere nova API key se necessário

#### Problema: Dashboard não recebe atualizações em tempo real

**Causa:** WebSocket não conectado.

**Diagnóstico:**
```bash
# Verifique logs do dashboard-api
docker compose logs dashboard-api

# Teste WebSocket manualmente
npm install -g wscat
wscat -c ws://localhost:3003
# Deve exibir: {"event":"connection.established",...}
```

**Solução:**
- Certifique-se que `VITE_WS_URL=ws://localhost:3003` no .env
- Rebuild agent-dashboard: `docker compose build agent-dashboard`

#### Problema: PostgreSQL não inicia

**Causa:** Porta 5432 já em uso ou volume corrompido.

**Diagnóstico:**
```bash
# Verifique porta
sudo lsof -i :5432

# Verifique logs
docker compose logs postgres
```

**Solução:**
```bash
# Pare serviço local PostgreSQL
sudo systemctl stop postgresql

# Ou use porta diferente
# Edite .env: POSTGRES_PORT=5433

# Ou remova volume e recrie
docker compose down -v
docker compose up -d postgres
```

### 8.2 Logs Úteis

```bash
# Ver logs de todos os serviços
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f business-engine

# Ver últimas 100 linhas
docker compose logs --tail=100 n8n

# Filtrar por erro
docker compose logs | grep -i error
```

---

## 9. PRÓXIMOS PASSOS / ROADMAP

### 9.1 Melhorias Planejadas

**Prioridade Alta:**
- [ ] Adicionar autenticação JWT no dashboard
- [ ] Implementar rate limiting nas APIs
- [ ] Adicionar métricas com Prometheus
- [ ] Configurar backup automático do PostgreSQL
- [ ] Deploy em produção com WAHA real

**Prioridade Média:**
- [ ] Multi-tenancy (suporte a múltiplas empresas)
- [ ] Relatórios de atendimento (tempo médio, satisfação)
- [ ] Integração com Slack para notificações de ticket
- [ ] Upload de arquivos (imagens, documentos)
- [ ] Histórico de conversas com busca full-text

**Prioridade Baixa:**
- [ ] Chatbot voice (áudio do WhatsApp)
- [ ] Integração com CRM (Salesforce, HubSpot)
- [ ] Análise de sentimento nas mensagens
- [ ] Chatbot em outros idiomas (EN, ES)

---

## 10. REFERÊNCIAS

### 10.1 Documentação Oficial

- **n8n**: https://docs.n8n.io
- **WAHA**: https://waha.devlike.pro/docs/overview/introduction
- **Google Gemini**: https://ai.google.dev/docs
- **PostgreSQL**: https://www.postgresql.org/docs/16/
- **Socket.IO**: https://socket.io/docs/v4/
- **Express**: https://expressjs.com/

### 10.2 Arquivos Críticos do Projeto

| Arquivo | Descrição | Responsabilidade |
|---------|-----------|------------------|
| `docker-compose.yml` | Definição de todos os containers | Infraestrutura |
| `services/business-engine/src/routes/classify.ts` | Classificação de mensagens | IA + Regras |
| `services/business-engine/src/ai/gemini-client.ts` | Cliente Gemini API | Integração IA |
| `services/business-engine/src/rules/categories.ts` | Categorias e keywords | Regras de negócio |
| `services/business-engine/src/db/init.sql` | Schema do banco | Persistência |
| `services/dashboard-api/src/routes/tickets.ts` | CRUD de tickets | Backend atendente |
| `n8n/workflows/main-chatbot.json` | Orquestração principal | Fluxo de negócio |
| `n8n/workflows/agent-response.json` | Resposta do atendente | Comunicação bidirecional |

---

## CONCLUSÃO

Este sistema demonstra uma arquitetura moderna de chatbot com:

✅ **Separação de responsabilidades**: Cada serviço tem uma função clara
✅ **Escalabilidade**: Microserviços podem escalar independentemente
✅ **Observabilidade**: Logs, health checks e WebSocket para monitoramento
✅ **Testabilidade**: Simulador permite testes sem WhatsApp real
✅ **Manutenibilidade**: TypeScript + Docker + documentação completa
✅ **Custo zero**: Gemini gratuito + WAHA open-source + PostgreSQL
✅ **Inteligência**: IA Gemini para classificação e respostas contextuais
✅ **Híbrido IA/Humano**: Escalação inteligente quando IA não consegue resolver

**Próximo passo recomendado:** Deploy em produção com WAHA real conectado ao WhatsApp Business API.
