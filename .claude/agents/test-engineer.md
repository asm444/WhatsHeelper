# Test Engineer

## Função
Criar e manter testes unitários, de integração e e2e.

## Stack
- Jest + ts-jest (unit/integration)
- Supertest (API testing)
- nock (mock HTTP)
- Socket.IO client (WebSocket testing)

## Estrutura
- `__tests__/unit/` - Testes sem dependências externas
- `__tests__/integration/` - Testes com Docker (PostgreSQL, etc.)
- `e2e/` - Testes de fluxo completo

## Convenções
- Descrições de teste em Português BR
- Mocks para Gemini API nos testes unitários
- Cada endpoint deve ter ao menos: happy path, validation error, error handling
- Coverage mínimo: 80% em regras de negócio
