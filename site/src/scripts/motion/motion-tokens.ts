/**
 * Tokens de motion da landing (SYN-106) — usados pelas timelines anime.js.
 */
export const LANDING_MOTION = {
  durationInstant: 120,
  durationFast: 180,
  durationEnter: 280,
  durationLayout: 360,
  durationHero: 420,
  /** ≈ --motion-ease-out */
  easeOut: 'outQuart',
  /** ≈ --motion-ease-out-soft */
  easeOutSoft: 'outQuint',
  yEnter: 12,
  yMock: 8,
  yCard: 16,
  staggerTight: 40,
  staggerBase: 60,
  staggerCards: 80,
  revealThreshold: 0.22,
  sumiuPulseMs: 900,
  sumiuPulseScale: 1.04,
  /** Exit = 75% da duração de enter correspondente. */
  exitFactor: 0.75,
} as const;

/** Tipo readonly dos tokens de motion da landing. */
export type LandingMotionTokens = typeof LANDING_MOTION;
