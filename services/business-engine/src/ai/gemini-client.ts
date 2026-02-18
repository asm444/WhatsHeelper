import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIES } from '../rules/categories';

const SYSTEM_PROMPT = `Você é o assistente virtual da Amaral Support, uma empresa de suporte técnico.
Seu nome é Amaral Bot. Você atende em Português do Brasil.

Suas responsabilidades:
1. Classificar o problema do cliente em uma das categorias: hardware, software, rede, conta, faturamento
2. Avaliar sua confiança (0.0 a 1.0) de que consegue resolver o problema
3. Fornecer respostas claras, empáticas e objetivas
4. Quando não souber resolver, admitir e sugerir escalação para um atendente humano

Regras:
- Seja sempre educado e profissional
- Use linguagem simples e acessível
- Forneça passos numerados quando possível
- Nunca invente informações técnicas
- Se o problema parece urgente ou sensível, recomende atendimento humano
- Respostas devem ter no máximo 500 caracteres
- Nunca use emojis nas respostas

Categorias disponíveis:
${CATEGORIES.map(c => `- ${c.id}: ${c.description}`).join('\n')}`;

export interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
  severityReason: string;
}

export interface ResponseResult {
  response: string;
  confidence: number;
  category: string;
  suggestEscalation: boolean;
}

export interface SummaryResult {
  summary: string;
  category: string;
  priority: string;
  keyPoints: string[];
  severityReason: string;
  riskFactors: string[];
  escalationContext: string;
}

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('GEMINI_API_KEY não configurada. Obtenha em https://aistudio.google.com/apikey');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getModel() {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  return getClient().getGenerativeModel({ model: modelName });
}

export async function classifyMessage(message: string, conversationHistory: string[] = []): Promise<ClassificationResult> {
  const model = getModel();

  const prompt = `${SYSTEM_PROMPT}

Analise a mensagem do cliente e classifique em uma das categorias.
Alem da classificacao, avalie a severidade tecnica do problema.

Criterios de prioridade:
- critical: sistema totalmente parado, perda financeira ativa, exposicao de dados, acesso nao autorizado
- high: impacto em producao, multiplos usuarios afetados, prazo critico em risco, degradacao grave
- medium: funcionalidade comprometida mas ha alternativa, problema recorrente
- low: duvida, curiosidade, solicitacao de informacao, problema estetico

Responda APENAS em JSON no formato:
{"category": "id_da_categoria", "confidence": 0.0-1.0, "reasoning": "motivo da classificacao", "suggestedPriority": "low|medium|high|critical", "severityReason": "frase curta justificando a prioridade"}

Historico da conversa:
${conversationHistory.length > 0 ? conversationHistory.join('\n') : '(primeira mensagem)'}

Mensagem do cliente: "${message}"`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta');
    const parsed = JSON.parse(jsonMatch[0]) as ClassificationResult;

    // Sanitiza priority contra valores inválidos
    const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
    const raw = parsed.suggestedPriority?.toLowerCase();
    parsed.suggestedPriority = VALID_PRIORITIES.includes(raw as any) ? (raw as typeof VALID_PRIORITIES[number]) : 'medium';

    return parsed;
  } catch {
    return {
      category: 'software',
      confidence: 0.3,
      reasoning: 'Não foi possível classificar com precisão',
      suggestedPriority: 'medium',
      severityReason: 'Não foi possível avaliar a severidade',
    };
  }
}

export async function generateResponse(
  message: string,
  category: string,
  conversationHistory: string[] = [],
): Promise<ResponseResult> {
  const model = getModel();

  const prompt = `${SYSTEM_PROMPT}

Categoria identificada: ${category}

Gere uma resposta útil para o cliente.
Responda APENAS em JSON no formato:
{"response": "sua resposta ao cliente", "confidence": 0.0-1.0, "category": "${category}", "suggestEscalation": false}

Se não conseguir ajudar, defina suggestEscalation como true.

Histórico da conversa:
${conversationHistory.length > 0 ? conversationHistory.join('\n') : '(primeira mensagem)'}

Mensagem do cliente: "${message}"`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta');
    return JSON.parse(jsonMatch[0]) as ResponseResult;
  } catch {
    return {
      response: 'Desculpe, tive um problema ao processar sua solicitação. Vou transferir você para um atendente humano.',
      confidence: 0.1,
      category,
      suggestEscalation: true,
    };
  }
}

export async function generateSummary(
  messages: string[],
  category: string,
  escalationReason?: string,
  severityReason?: string,
): Promise<SummaryResult> {
  const model = getModel();

  const prompt = `${SYSTEM_PROMPT}

Gere um resumo da conversa para o atendente humano.
O atendente precisa entender o nivel de urgencia e os riscos envolvidos.

${escalationReason ? `Motivo da escalacao: ${escalationReason}` : ''}
${severityReason ? `Severidade identificada na classificacao: ${severityReason}` : ''}

Responda APENAS em JSON no formato:
{
  "summary": "resumo em 2-3 frases",
  "category": "${category}",
  "priority": "low|medium|high|critical",
  "keyPoints": ["ponto 1", "ponto 2"],
  "severityReason": "justificativa da prioridade",
  "riskFactors": ["fator de risco 1", "fator de risco 2"],
  "escalationContext": "frase curta explicando por que o bot escalou"
}

Notas:
- riskFactors: lista vazia se nao ha fatores de risco relevantes
- escalationContext: ex. "Sistema parado impede operacao do cliente. Bot nao conseguiu resolver apos 3 tentativas."

Mensagens da conversa:
${messages.join('\n')}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta');
    return JSON.parse(jsonMatch[0]) as SummaryResult;
  } catch {
    return {
      summary: 'Cliente precisa de assistência. Não foi possível gerar resumo automático.',
      category,
      priority: 'medium',
      keyPoints: ['Resumo automático falhou', 'Verificar histórico manualmente'],
      severityReason: 'Não foi possível avaliar a severidade',
      riskFactors: [],
      escalationContext: 'Escalação automática. Resumo indisponível.',
    };
  }
}

export function resetClient(): void {
  genAI = null;
}
