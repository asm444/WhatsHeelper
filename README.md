# Amaral Support

Sistema de atendimento ao cliente via WhatsApp com IA generativa, escalamento inteligente para atendentes humanos e dashboard em tempo real.

## Arquitetura

```
Cliente WhatsApp ──► WAHA Bridge ──► n8n (orquestrador)
                                         │
                                    ┌────┴────┐
                                    ▼         ▼
                              Business    Dashboard
                               Engine       API
                            (Gemini IA)  (tickets)
                                    │         │
                                    └────┬────┘
                                         ▼
                                    PostgreSQL
```

**Fluxo**: mensagem do cliente → classificação por IA (Gemini) com fallback para keywords → resposta automática ou escalamento → ticket com SLA para atendente humano via dashboard.

## Stack

| Componente | Tecnologia | Porta |
|---|---|---|
| Orquestrador | n8n | 5678 |
| WhatsApp Bridge | WAHA Core | 3000 |
| Chat Simulator | Express + Socket.IO | 3001 |
| Business Engine | Express + Gemini API | 3002 |
| Dashboard API | Express + WebSocket | 3003 |
| Agent Dashboard | Vite + Vanilla TS | 3004 |
| Banco de Dados | PostgreSQL 16 | 5432 |

## Quick Start

```bash
# 1. Clone e configure
git clone <repo-url> && cd WhatsHeelper
cp .env.example .env
# Edite .env e configure GEMINI_API_KEY (https://aistudio.google.com/apikey)

# 2. Suba tudo
./START.sh

# 3. Ou manualmente
make up        # docker compose up -d
make health    # verifica saude dos servicos
make logs      # acompanha logs
```

## Funcionalidades

- **Classificacao por IA**: Gemini classifica mensagens em 5 categorias com nivel de confianca
- **Fallback inteligente**: se Gemini falha, classificacao por keywords assume transparente
- **Escalamento automatico**: confianca baixa, topicos sensiveis ou pedido de humano → ticket
- **Prioridade por IA**: Gemini sugere critical/high/medium/low com justificativa
- **SLA calculado**: critical=1h, high=4h, medium=8h, low=24h
- **Dashboard em tempo real**: WebSocket para atendentes com filtros, SLA countdown e historico
- **Bypass de teste**: frase-chave para forcar escalamento (dev/QA)
- **Silenciamento de IA**: quando atendente assume, bot para de responder automaticamente

## Comandos

```bash
make up                 # inicia todos os servicos
make down               # para tudo
make build              # rebuild das imagens Docker
make test-unit          # testes unitarios
make test-integration   # testes de integracao (requer PostgreSQL)
make test-e2e           # testes end-to-end
make health             # health check de todos os servicos
make logs               # logs em tempo real
make clean              # limpeza completa (volumes + node_modules)
```

## Estrutura

```
services/
  business-engine/    # Classificacao IA + regras de escalamento
  chat-simulator/     # Simula WAHA para testes (UI WhatsApp)
  dashboard-api/      # CRUD tickets + WebSocket
  agent-dashboard/    # Frontend do atendente (Vite)
n8n/
  workflows/          # Fluxos de orquestracao
scripts/              # Setup e health checks
docs/                 # Documentacao detalhada
```

## Documentacao

- [Setup e Instalacao](docs/SETUP.md)
- [Tutorial de Uso](docs/USAGE.md)
- [API Reference](docs/API.md)
- [Arquitetura](docs/ARCHITECTURE.md)

## Licenca

[MIT](LICENSE)
