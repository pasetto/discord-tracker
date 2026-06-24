/**
 * Case study público para páginas de marketing.
 */
export interface CaseStudy {
  slug: string;
  title: string;
  subtitle: string;
  industry: string;
  teamSize: string;
  challenge: string;
  solution: string;
  results: string[];
  quote?: string;
  quoteAuthor?: string;
}

/**
 * Catálogo estático de cases Discord-first (MVP marketing).
 */
export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'dev-shop-remota',
    title: 'Dev shop remota detecta sumiço antes do sprint quebrar',
    subtitle: '15 desenvolvedores, Discord como escritório virtual',
    industry: 'Software house',
    teamSize: '15 pessoas',
    challenge:
      'Gestores só percebiam ausência prolongada em dailies ou quando entregas atrasavam. Não havia visibilidade passiva de colaboração no Discord.',
    solution:
      'Configuraram calendário BR, canais de voz colaborativos e alertas de inatividade. Gestores recebem resumo semanal por e-mail e push intraday quando alguém não aparece na jornada.',
    results: [
      'Redução de conversas reativas do tipo "cadê você?"',
      '1:1s mais objetivos com dados de colaboração, não feeling',
      'Time reportou transparência — sem leitura de mensagens',
    ],
    quote: 'Finalmente sabemos quem sumiu na terça, não na sexta.',
    quoteAuthor: 'Tech Lead',
  },
  {
    slug: 'comunidade-b2b-suporte',
    title: 'Comunidade B2B mantém plantão visível no Discord',
    subtitle: 'Suporte ao cliente em turnos sobrepostos',
    industry: 'Comunidade B2B / Suporte',
    teamSize: '30 pessoas',
    challenge:
      'Cobertura de plantão informal em canais de voz; difícil saber quem estava colaborando em horário de pico.',
    solution:
      'Syntra passou a sinalizar presença e voz colaborativa com metadados. Ausências planejadas (PTO) evitam falsos alertas em feriados e férias.',
    results: [
      'Gestão de plantão com menos escalonamento manual',
      'Alertas intraday quando ninguém entra no canal de plantão',
      'Colaboradores solicitam PTO pelo portal /me',
    ],
    quote: 'O alerta do dia mudou como escalamos o plantão.',
    quoteAuthor: 'Coordenador de operações',
  },
  {
    slug: 'agencia-dev-discord',
    title: 'Agência dev abandonou planilha de "quem está online"',
    subtitle: 'Squads por cliente, um servidor Discord',
    industry: 'Agência de desenvolvimento',
    teamSize: '45 pessoas',
    challenge:
      'Planilha manual de presença não escalava. Toggl era esquecido e gerava atrito — queriam visibilidade, não timesheet por projeto.',
    solution:
      'Metas individuais de colaboração por dev, ranking opcional e relatório "quem sumiu" por categoria (squad). Integração webhook para canal Slack interno de leads.',
    results: [
      'Menos cobrança subjetiva de horário',
      'Webhooks alimentam canal #lideranca com alertas semanais',
      'Upgrade para plano Business por API + webhooks',
    ],
    quote: 'Medimos colaboração no Discord, não entregas no Jira — e está ótimo assim.',
    quoteAuthor: 'Head de operações',
  },
];

/**
 * Busca case study pelo slug da URL.
 * @param slug Identificador amigável do case
 * @returns Case encontrado ou undefined
 */
export function findCaseStudyBySlug(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((item) => item.slug === slug);
}
