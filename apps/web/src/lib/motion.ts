import type { Settings } from '../save/types';

/** Applies the player's motion preference to the document (read by CSS and by the Phaser scene). */
export function applyMotion(motion: Settings['motion']): void {
  document.documentElement.dataset.motion = motion === 'system' ? '' : motion;
}

export function reducedMotion(): boolean {
  const d = document.documentElement.dataset.motion;
  if (d === 'reduced') return true;
  if (d === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
