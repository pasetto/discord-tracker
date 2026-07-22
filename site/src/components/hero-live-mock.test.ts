/**
 * Specs do hero live mock (toggle Sem/Com Syntra) — SYN-111.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindHeroLiveMock } from './hero-live-mock';

function mountMock(): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-testid', 'landing-hero-mock');
  root.innerHTML = `
    <div data-motion="mock-chrome">
      <button type="button" data-testid="landing-hero-toggle-without" role="radio" aria-checked="false">Sem</button>
      <button type="button" data-testid="landing-hero-toggle-with" role="radio" aria-checked="true">Com</button>
    </div>
    <p data-testid="landing-hero-mock-headline"></p>
    <p data-testid="landing-hero-mock-support" hidden></p>
    <ul data-testid="landing-hero-mock-members"></ul>
  `;
  document.body.appendChild(root);
  return root;
}

describe('bindHeroLiveMock', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renderiza modo Com Syntra com chips Sumiu', () => {
    const root = mountMock();
    bindHeroLiveMock(root);
    expect(root.querySelectorAll('[data-status="missing"]').length).toBe(3);
    expect(root.querySelector('[data-testid="landing-hero-mock-headline"]')?.textContent).toMatch(
      /sumiram/i,
    );
  });

  it('sob reduced-motion troca para Sem Syntra sem anime', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const root = mountMock();
    bindHeroLiveMock(root);
    root.querySelector<HTMLButtonElement>('[data-testid="landing-hero-toggle-without"]')?.click();
    expect(root.getAttribute('data-mode')).toBe('without');
    expect(root.querySelectorAll('[data-status="online"]').length).toBe(5);
    const support = root.querySelector('[data-testid="landing-hero-mock-support"]');
    expect(support instanceof HTMLElement && support.hidden).toBe(false);
  });
});
