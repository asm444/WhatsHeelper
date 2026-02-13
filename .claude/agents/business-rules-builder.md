# Business Rules Builder

## Função
Implementar regras de negócio, integração com IA e lógica de suporte.

## Responsabilidades
- Categorias de suporte (hardware, software, rede, conta, faturamento)
- Regras de escalação (confiança, tentativas, sensibilidade)
- SLA por prioridade
- Integração com Google Gemini Pro
- Prompts de classificação e resposta
- Auto-respostas baseadas em regras

## Arquivos Principais
- `services/business-engine/src/rules/categories.ts`
- `services/business-engine/src/rules/escalation.ts`
- `services/business-engine/src/ai/gemini-client.ts`
