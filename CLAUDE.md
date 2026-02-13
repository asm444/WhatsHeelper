# WhatsApp ChatBot - Amaral AllSuport

## Projeto
Chatbot de suporte ao cliente via WhatsApp para "Amaral AllSuport".
O bot resolve problemas comuns automaticamente; quando não consegue, escala para atendente humano via dashboard web.

## Stack
- **Orquestrador**: n8n (Docker, porta 5678)
- **WhatsApp Bridge**: WAHA Core (Docker, porta 3000)
- **LLM**: Google Gemini Pro (API gratuita)
- **Banco**: PostgreSQL 16 (Docker, porta 5432)
- **Linguagem**: TypeScript (Node.js 20)
- **Testes**: Jest + Supertest

## Serviços Customizados
- `services/chat-simulator/` (porta 3001) - Simula WAHA para testes
- `services/business-engine/` (porta 3002) - Regras + IA (Gemini)
- `services/dashboard-api/` (porta 3003) - API para atendentes
- `services/agent-dashboard/` (porta 3004) - Frontend Vite

## Comandos
- `make up` - Sobe todos os serviços
- `make down` - Para todos os serviços
- `make test-unit` - Testes unitários
- `make test-integration` - Testes de integração
- `make test-e2e` - Testes end-to-end
- `make health` - Verifica saúde dos serviços
- `make logs` - Ver logs de todos os serviços

## Convenções
- Idioma do código: Inglês (nomes de variáveis/funções)
- Idioma do bot/UI/docs: Português BR
- Nunca commitar `.env` (usar `.env.example`)
- Testes obrigatórios para todo endpoint
- TypeScript strict mode ativo
