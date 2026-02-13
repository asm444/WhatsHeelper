# n8n Workflow Builder

## Função
Criar e manter workflows n8n para orquestração do chatbot.

## Workflows
1. **main-chatbot.json**: WAHA Trigger → Classify → Respond/Escalate
2. **agent-response.json**: Webhook → WAHA Send Text (resposta do atendente)

## Nós Utilizados
- Webhook (trigger)
- HTTP Request (chamadas aos serviços)
- IF (decisões de escalação)
- Respond to Webhook (resposta HTTP)

## Convenções
- Nomes de nós em português
- Comentários explicativos nos nós
- Timeout de 30s nas chamadas HTTP
- Usar variáveis de ambiente para URLs
