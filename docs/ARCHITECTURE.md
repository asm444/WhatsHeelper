# Arquitetura - Amaral Support

## Visão Geral

```
[Usuário WhatsApp] ou [Simulador Web :3001]
        |
        | webhook (formato WAHA idêntico)
        v
[n8n :5678] ── workflow principal
        |
        ├─ POST /classify → [Business Engine :3002] → [Gemini Pro API]
        |
        ├─ SE confiança >= 0.4:
        |   ├─ POST /respond → resposta gerada
        |   └─ WAHA/Simulador: envia resposta ao usuário
        |
        └─ SE confiança < 0.4 ou escalação:
            ├─ POST /escalate → cria ticket + resumo
            ├─ POST /webhook → [Dashboard API :3003] → WebSocket → [Dashboard :3004]
            └─ WAHA/Simulador: "transferindo para atendente"
```

## Serviços

| Serviço | Porta | Tecnologia | Função |
|---------|-------|------------|--------|
| n8n | 5678 | Docker | Orquestrador de workflows |
| WAHA | 3000 | Docker | Bridge WhatsApp |
| Chat Simulator | 3001 | Express + Socket.IO | Testes sem WhatsApp real |
| Business Engine | 3002 | Express + Gemini | Regras + IA |
| Dashboard API | 3003 | Express + WebSocket | CRUD tickets |
| Agent Dashboard | 3004 | Vite (HTML/CSS/JS) | Frontend atendente |
| PostgreSQL | 5432 | Docker | Banco de dados |

## Fluxo de Mensagem

1. Usuário envia mensagem via WhatsApp (ou Simulador)
2. WAHA (ou Simulador) envia webhook para n8n
3. n8n chama `/classify` no Business Engine
4. Business Engine classifica com keywords + Gemini Pro
5. Se confiança >= 40%: n8n chama `/respond` e envia resposta
6. Se confiança < 40% ou escalação: n8n chama `/escalate`, cria ticket, notifica Dashboard

## Regras de Negócio

- **Categorias**: hardware, software, rede, conta, faturamento
- **Escalação automática**: confiança < 40%, 3+ tentativas, pedido de humano, tópicos sensíveis
- **SLA**: Crítico 1h, Alto 4h, Médio 8h, Baixo 24h
