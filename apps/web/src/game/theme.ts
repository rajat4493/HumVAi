/** Hex ints mirrored from styles/tokens.css (Phaser needs numbers, not CSS vars). */
export const C = {
  midnight: 0x0b1026,
  canvas: 0x1b2552,
  canvas2: 0x222d62,
  floorA: 0x1f2957,
  floorB: 0x232e5f,
  wallTop: 0x6a74cc,
  wallSide: 0x38429a,
  human: 0xffb347,
  humanDeep: 0xe07b1a,
  ai: 0x6f8cff,
  discovery: 0xb78cff,
  discoveryDeep: 0x7a50d6,
  exit: 0x5be38a,
  warn: 0xff6b6b,
  ink: 0xf4f1ff,
  dim: 0x6b74a8,
} as const;

export type Shape = 'circle' | 'square' | 'triangle' | 'diamond';

/** Switch identity is colour AND shape so it never depends on colour alone. */
export const SWITCH_LOOK: Record<string, { shape: Shape; color: number }> = {
  'switch-orange': { shape: 'circle', color: 0xff7a45 },
  'switch-teal': { shape: 'triangle', color: 0x2dd4bf },
  'switch-circle': { shape: 'circle', color: 0xff7a45 },
  'switch-square': { shape: 'square', color: 0xf5d547 },
  'switch-triangle': { shape: 'triangle', color: 0x2dd4bf },
  'switch-one': { shape: 'circle', color: 0xff7a45 },
  'switch-two': { shape: 'diamond', color: 0x5fd0ff },
};

export const TILE = 96;
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
