/**
 * Hidrata a grade de pricing a partir da API pública (fallback já no HTML).
 */
import {
  fetchPricingCards,
  type PricingPlanCardView,
} from './public-pricing';

/**
 * Renderiza cards de plano no contêiner.
 * @param grid - Elemento da grade
 * @param plans - Cards
 * @param signupUrl - URL absoluta de signup
 */
function renderPricingCards(
  grid: HTMLElement,
  plans: PricingPlanCardView[],
  signupUrl: string,
): void {
  grid.innerHTML = plans
    .map((plan) => {
      const featuredClass = plan.featured ? ' pricing__card--featured' : '';
      const badge = plan.featured ? `<p class="pricing__badge">Mais popular</p>` : '';
      const highlights = plan.highlights.map((h) => `<li>${h}</li>`).join('');
      return `
      <article
        class="pricing__card${featuredClass}"
        data-motion="reveal-child"
        data-hover="card"
        data-plan-slug="${plan.slug}"
      >
        ${badge}
        <p class="pricing__name">${plan.name}</p>
        <p class="pricing__price">${plan.priceBrlMonthly}</p>
        <p class="pricing__interval">por mês</p>
        <p class="pricing__desc">${plan.description}</p>
        <p class="pricing__limit">Até ${plan.maxTrackedMembers} membros rastreados.</p>
        <ul class="pricing__highlights">${highlights}</ul>
        <a class="btn btn--primary pricing__cta" href="${signupUrl}" data-cta="pricing">Criar conta</a>
      </article>`;
    })
    .join('');
}

/**
 * Boot do pricing público na landing Astro.
 */
export async function bootPublicPricing(): Promise<void> {
  const grid = document.querySelector<HTMLElement>('[data-pricing-grid]');
  if (!grid) return;

  const appUrl = (
    document.body.getAttribute('data-app-url') || 'http://localhost:4200'
  ).replace(/\/$/, '');
  const signupUrl = `${appUrl}/signup`;
  const errorEl = document.querySelector<HTMLElement>('[data-pricing-error]');

  const { plans, loadFailed } = await fetchPricingCards(appUrl);
  if (errorEl) {
    errorEl.hidden = !loadFailed;
  }
  renderPricingCards(grid, plans, signupUrl);
}

void bootPublicPricing();
