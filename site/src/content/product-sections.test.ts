/**
 * Specs das seções one-job de produto (SYN-118 / SYN-119).
 */
import { describe, expect, it } from 'vitest';
import { PRODUCT_SECTIONS, LANDING_SECTION_ORDER } from './product-sections';

describe('product sections (SYN-119 B2B)', () => {
  it('expõe exatamente 5 one-jobs na ordem do brief', () => {
    expect(PRODUCT_SECTIONS.map((s) => s.id)).toEqual([
      'inatividade',
      'metas',
      'calendario',
      'sinais',
      'gamificacao',
    ]);
  });

  it('copy de produto não usa produtividade/produtivo', () => {
    const blob = PRODUCT_SECTIONS.map((s) => `${s.title} ${s.lead} ${s.bullets.join(' ')}`).join(
      ' ',
    );
    expect(blob.toLowerCase()).not.toMatch(/produtivid|produtivo/);
  });

  it('ordem estrutural inclui produto entre problema e anti', () => {
    expect(LANDING_SECTION_ORDER).toEqual([
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
    ]);
  });
});
