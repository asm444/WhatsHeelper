export interface EscalationResult {
  shouldEscalate: boolean;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const BYPASS_PHRASE = (process.env.BYPASS_PHRASE || 'atendente sender').toLowerCase();

export function isBypassPhrase(message: string): boolean {
  return message.trim().toLowerCase() === BYPASS_PHRASE;
}

const HUMAN_REQUEST_PATTERNS = [
  'atendente', 'humano', 'pessoa', 'falar com alguém', 'falar com alguem',
  'pessoa real', 'agente', 'supervisor', 'gerente', 'reclamação', 'reclamacao',
  'ouvidoria', 'procon',
];

const SENSITIVE_PATTERNS = [
  'processo', 'judicial', 'advogado', 'jurídico', 'juridico', 'lei',
  'segurança', 'seguranca', 'vazamento', 'dados pessoais', 'lgpd',
  'fraude', 'golpe', 'roubo', 'invasão', 'hackeado', 'hacker',
];

export function checkEscalation(
  message: string,
  confidence: number,
  retryCount: number,
  confidenceThreshold: number = 0.4,
  maxRetries: number = 3,
): EscalationResult {
  const normalized = message.toLowerCase();

  // Pedido explícito de humano
  for (const pattern of HUMAN_REQUEST_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        shouldEscalate: true,
        reason: 'Cliente solicitou atendimento humano',
        priority: 'high',
      };
    }
  }

  // Tópicos sensíveis
  for (const pattern of SENSITIVE_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        shouldEscalate: true,
        reason: `Tópico sensível detectado: ${pattern}`,
        priority: 'critical',
      };
    }
  }

  // Confiança abaixo do limiar
  if (confidence < confidenceThreshold) {
    return {
      shouldEscalate: true,
      reason: `Confiança baixa na resposta: ${(confidence * 100).toFixed(0)}%`,
      priority: 'medium',
    };
  }

  // Muitas tentativas sem sucesso
  if (retryCount >= maxRetries) {
    return {
      shouldEscalate: true,
      reason: `${retryCount} tentativas sem resolver o problema`,
      priority: 'high',
    };
  }

  return {
    shouldEscalate: false,
    reason: '',
    priority: 'low',
  };
}

export function calculateSLADeadline(priority: string): Date {
  const now = new Date();
  const slaHours: Record<string, number> = {
    critical: 1,
    high: 4,
    medium: 8,
    low: 24,
  };
  const hours = slaHours[priority] || 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}
