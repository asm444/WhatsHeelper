# API Reference - Amaral Support

## Business Engine (porta 3002)

### GET /health
Verifica saúde do serviço.

**Resposta:**
```json
{"status": "ok", "service": "business-engine", "timestamp": "...", "geminiConfigured": true}
```

### POST /classify
Classifica mensagem do cliente.

**Body:**
```json
{"message": "Meu computador não liga", "phone": "5511999999999", "conversationHistory": [], "retryCount": 0}
```

**Resposta:**
```json
{
  "category": "hardware",
  "confidence": 0.85,
  "reasoning": "Problema com computador identificado",
  "escalation": {"shouldEscalate": false, "reason": "", "priority": "low"},
  "keywordMatch": {"category": "hardware", "score": 0.12}
}
```

### POST /respond
Gera resposta para o cliente.

**Body:**
```json
{"message": "Meu computador não liga", "category": "hardware", "conversationHistory": []}
```

**Resposta:**
```json
{
  "response": "Vamos verificar: 1) O cabo de energia está conectado? ...",
  "confidence": 0.8,
  "category": "hardware",
  "source": "rules|gemini|fallback",
  "suggestEscalation": false
}
```

### POST /escalate
Escala conversa para atendente humano.

**Body:**
```json
{
  "phone": "5511999999999",
  "category": "hardware",
  "messages": ["Cliente: Meu computador não liga", "Bot: Já tentou reiniciar?"],
  "reason": "Confiança baixa",
  "priority": "high"
}
```

**Resposta:**
```json
{
  "ticket": {
    "id": "uuid",
    "phone": "5511999999999",
    "category": "hardware",
    "summary": "...",
    "keyPoints": ["..."],
    "priority": "high",
    "status": "open",
    "slaDeadline": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Dashboard API (porta 3003)

### GET /health
### GET /tickets?status=open&priority=high&category=hardware
### GET /tickets/:id
### POST /tickets
### PATCH /tickets/:id
### POST /tickets/:id/messages
### GET /tickets/:id/messages
### POST /webhook

---

## Chat Simulator (porta 3001)

### GET /health
### POST /api/sendText
```json
{"chatId": "5511999999999@c.us", "text": "Resposta do bot", "session": "default"}
```
### GET /api/sessions
### GET /api/sessions/:session/me

### WebSocket (Socket.IO)
- Evento `user_message`: `{phone, text, name}`
- Evento `bot_message`: `{text, phone, timestamp}`
- Evento `typing`: `{phone, isTyping}`
