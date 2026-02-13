export interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  commonProblems: string[];
  autoResponses: Map<string, string>;
}

export const CATEGORIES: Category[] = [
  {
    id: 'hardware',
    name: 'Hardware',
    description: 'Problemas com equipamentos físicos (computador, impressora, monitor, periféricos)',
    keywords: [
      'computador', 'pc', 'notebook', 'impressora', 'monitor', 'teclado', 'mouse',
      'tela', 'cabo', 'carregador', 'bateria', 'hd', 'ssd', 'memória', 'ram',
      'placa', 'fonte', 'ventilador', 'cooler', 'superaquecimento', 'esquentando',
      'desligando', 'não liga', 'travando', 'lento', 'barulho', 'quebrou',
    ],
    commonProblems: [
      'Computador não liga',
      'Computador travando/lento',
      'Impressora não imprime',
      'Monitor sem imagem',
      'Notebook superaquecendo',
    ],
    autoResponses: new Map([
      ['nao_liga', 'Vamos verificar: 1) O cabo de energia está conectado? 2) A tomada está funcionando? 3) Tente segurar o botão de ligar por 10 segundos e soltar. Se ainda não ligar, pode ser a fonte de alimentação.'],
      ['lento', 'Algumas dicas para melhorar o desempenho: 1) Reinicie o computador 2) Feche programas que não está usando 3) Verifique se o disco está cheio (mínimo 10% livre) 4) Execute uma verificação de vírus.'],
      ['impressora', 'Verifique: 1) A impressora está ligada e conectada? 2) Há papel e tinta/toner? 3) Tente remover e reinstalar a impressora em Configurações > Dispositivos. 4) Reinicie o serviço de impressão.'],
    ]),
  },
  {
    id: 'software',
    name: 'Software',
    description: 'Problemas com programas, aplicativos, sistema operacional',
    keywords: [
      'programa', 'aplicativo', 'app', 'software', 'windows', 'linux', 'mac',
      'atualização', 'instalar', 'desinstalar', 'erro', 'bug', 'crash', 'fechando',
      'não abre', 'tela azul', 'vírus', 'antivírus', 'office', 'word', 'excel',
      'email', 'outlook', 'navegador', 'chrome', 'driver', 'licença', 'ativação',
    ],
    commonProblems: [
      'Programa não abre/fecha sozinho',
      'Erro de atualização do sistema',
      'Problema com licença/ativação',
      'Vírus/malware detectado',
      'Tela azul (BSOD)',
    ],
    autoResponses: new Map([
      ['nao_abre', 'Tente: 1) Reiniciar o computador 2) Executar o programa como administrador (clique direito > Executar como administrador) 3) Reinstalar o programa. Se persistir, pode haver um conflito com outro software.'],
      ['atualizacao', 'Para problemas de atualização: 1) Verifique sua conexão com a internet 2) Reinicie o computador e tente novamente 3) Execute o Solucionador de Problemas do Windows Update em Configurações > Atualização e Segurança.'],
      ['virus', 'Recomendações de segurança: 1) Execute uma verificação completa com seu antivírus 2) Não clique em links suspeitos 3) Atualize seu antivírus 4) Se necessário, faremos uma varredura remota.'],
    ]),
  },
  {
    id: 'rede',
    name: 'Rede',
    description: 'Problemas de conexão, internet, Wi-Fi, VPN',
    keywords: [
      'internet', 'wifi', 'wi-fi', 'rede', 'conexão', 'desconectando', 'sem internet',
      'lento', 'velocidade', 'ping', 'vpn', 'firewall', 'dns', 'ip', 'roteador',
      'modem', 'cabo de rede', 'ethernet', 'compartilhamento', 'pasta compartilhada',
      'servidor', 'acesso remoto', 'caiu', 'instável', 'oscilando',
    ],
    commonProblems: [
      'Sem conexão com a internet',
      'Internet lenta/instável',
      'Wi-Fi desconectando',
      'VPN não conecta',
      'Não acessa pasta compartilhada',
    ],
    autoResponses: new Map([
      ['sem_internet', 'Vamos resolver: 1) Reinicie o roteador/modem (desligue, espere 30s, ligue) 2) Verifique se o Wi-Fi está ativado 3) Tente conectar com cabo de rede 4) Teste em outro dispositivo para isolar o problema.'],
      ['lenta', 'Para melhorar a velocidade: 1) Aproxime-se do roteador 2) Desconecte dispositivos que não está usando 3) Reinicie o roteador 4) Verifique se não há downloads em segundo plano. Se persistir, pode ser um problema com seu provedor.'],
      ['vpn', 'Para problemas de VPN: 1) Verifique sua conexão com a internet 2) Tente desconectar e reconectar a VPN 3) Reinicie o cliente VPN 4) Verifique se suas credenciais estão corretas.'],
    ]),
  },
  {
    id: 'conta',
    name: 'Conta',
    description: 'Problemas de acesso, senha, permissões, cadastro',
    keywords: [
      'senha', 'login', 'acesso', 'conta', 'usuário', 'bloqueado', 'bloqueada',
      'esqueci', 'redefinir', 'resetar', 'permissão', 'autorização', 'cadastro',
      'registro', 'perfil', 'email', 'verificação', 'token', 'autenticação',
      'dois fatores', '2fa', 'não consigo entrar', 'expirou',
    ],
    commonProblems: [
      'Esqueci minha senha',
      'Conta bloqueada',
      'Sem permissão de acesso',
      'Problema no cadastro',
      'Autenticação de dois fatores',
    ],
    autoResponses: new Map([
      ['senha', 'Para redefinir sua senha: 1) Acesse a página de login 2) Clique em "Esqueci minha senha" 3) Digite seu email cadastrado 4) Siga as instruções enviadas por email. O link expira em 24h.'],
      ['bloqueado', 'Sua conta pode ter sido bloqueada por segurança após tentativas incorretas. Aguarde 30 minutos e tente novamente, ou solicite o desbloqueio informando seu email cadastrado.'],
      ['permissao', 'Para solicitar acesso/permissão: 1) Informe qual sistema ou recurso precisa acessar 2) Seu gestor precisa aprovar o acesso 3) Após aprovação, o acesso será liberado em até 4 horas úteis.'],
    ]),
  },
  {
    id: 'faturamento',
    name: 'Faturamento',
    description: 'Questões sobre cobranças, pagamentos, notas fiscais, planos',
    keywords: [
      'fatura', 'cobrança', 'pagamento', 'boleto', 'nota fiscal', 'nf', 'plano',
      'assinatura', 'cancelar', 'cancelamento', 'reembolso', 'estorno', 'desconto',
      'promoção', 'preço', 'valor', 'mensalidade', 'vencimento', 'atraso',
      'segunda via', 'recibo', 'contrato', 'upgrade', 'downgrade',
    ],
    commonProblems: [
      'Segunda via de boleto',
      'Cobrança indevida',
      'Solicitar nota fiscal',
      'Cancelar/alterar plano',
      'Solicitar reembolso',
    ],
    autoResponses: new Map([
      ['boleto', 'Para segunda via do boleto: 1) Acesse o portal do cliente em nosso site 2) Vá em "Financeiro" > "Faturas" 3) Clique em "Gerar 2ª via". Se preferir, posso enviar por email.'],
      ['nota_fiscal', 'Suas notas fiscais ficam disponíveis no portal do cliente em "Financeiro" > "Notas Fiscais". Se precisar de uma NF específica, informe o mês/ano de referência.'],
      ['cancelamento', 'Entendo que deseja cancelar. Para que eu possa ajudar melhor: 1) Qual o motivo do cancelamento? 2) Posso verificar se há alguma oferta especial para você. Vou transferir para um atendente especializado.'],
    ]),
  },
];

export function findCategoryByKeywords(text: string): { category: Category; matchScore: number } | null {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let bestMatch: { category: Category; matchScore: number } | null = null;

  for (const category of CATEGORIES) {
    let matchCount = 0;
    for (const keyword of category.keywords) {
      const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalized.includes(normalizedKeyword)) {
        matchCount++;
      }
    }
    const matchScore = matchCount / category.keywords.length;
    if (matchCount > 0 && (!bestMatch || matchScore > bestMatch.matchScore)) {
      bestMatch = { category, matchScore };
    }
  }

  return bestMatch;
}
