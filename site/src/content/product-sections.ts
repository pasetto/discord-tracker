/**
 * Conteúdo das seções one-job de produto (brief SYN-118).
 * Copy alinhada ao pack SYN-64 — colaboração, sem “produtividade”.
 */

export interface ProductSection {
  id: string;
  title: string;
  lead: string;
  bullets: string[];
  visual: 'missing-strip' | 'goal-bar' | 'pto-chip' | 'metadata' | 'team-plus';
}

/** Cinco ofertas distintas sob `#produto`. */
export const PRODUCT_SECTIONS: readonly ProductSection[] = [
  {
    id: 'inatividade',
    title: 'Saiba quem sumiu — hoje',
    lead: 'Relatório e alertas de inatividade com contexto de jornada, não só “online”.',
    bullets: [
      'Quem sumiu da colaboração no período',
      'Contexto de jornada e canais no radar',
      'Push quando o sumiço importa',
    ],
    visual: 'missing-strip',
  },
  {
    id: 'metas',
    title: 'Metas por pessoa, não por feeling',
    lead: 'Acompanhe metas individuais de colaboração no escopo do time.',
    bullets: [
      'Meta por colaborador',
      'Leitura clara do realizado vs combinado',
      'Sem meta agregada de “equipe média”',
    ],
    visual: 'goal-bar',
  },
  {
    id: 'calendario',
    title: 'PTO e calendário no radar',
    lead: 'Ausência planejada reduz falso “sumiu”.',
    bullets: [
      'PTO e feriados no contexto',
      'Calendário de trabalho por organização',
      'Menos alerta falso por ausência esperada',
    ],
    visual: 'pto-chip',
  },
  {
    id: 'sinais',
    title: 'Sinais de texto sem ler o texto',
    lead: 'Atividade em canal como metadado — conteúdo fora.',
    bullets: [
      'Metadado de atividade, não corpo da mensagem',
      'Áudio e DMs fora do escopo',
      'Canais no radar escolhidos por você',
    ],
    visual: 'metadata',
  },
  {
    id: 'gamificacao',
    title: 'Ranking e conquistas no plano certo',
    lead:
      'Gamificação e ranking quando o plano e as settings permitem — colaboração visível, sem ranking tóxico no marketing.',
    bullets: [
      'Disponível no plano Team+',
      'Toggles e visibilidade nas settings',
      'Foco em colaboração, não em humilhar',
    ],
    visual: 'team-plus',
  },
] as const;

/**
 * Ordem de seções no DOM (brief SYN-118 §2).
 * Usada para regressão estrutural; o markup em `index.astro` deve seguir.
 */
export const LANDING_SECTION_ORDER = [
  'nav',
  'hero',
  'problem',
  'product',
  'anti',
  'how',
  'privacy',
  'pricing',
  'faq',
  'cta',
  'legal',
  'footer',
] as const;
