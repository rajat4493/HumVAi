import { store } from '../save/instance';
import { AudioEngine } from './engine';
import type { CtxLike } from './engine';

declare global {
  interface Window {
    __HVA_AUDIO__?: { played: () => string[]; state: () => string; unlocked: () => boolean };
    webkitAudioContext?: typeof AudioContext;
  }
}

const makeCtx = (): CtxLike | null => {
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  return Ctor ? (new Ctor({ latencyHint: 'interactive' }) as unknown as CtxLike) : null;
};

export const audio = new AudioEngine(makeCtx);

const sync = () => audio.setSettings(store.get().settings);
sync();
store.subscribe(sync);

/** First user gesture unlocks audio (browser autoplay policy). Nothing plays before it. */
const unlock = () => audio.unlock();
for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, unlock, { once: false, passive: true });
document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));

window.__HVA_AUDIO__ = { played: () => [...audio.played], state: () => audio.state, unlocked: () => audio.isUnlocked };

// Soft tick on menu/UI buttons (the game pad and board controls have their own action sounds).
document.addEventListener('click', (e) => {
  const b = (e.target as Element | null)?.closest('button');
  if (b && !b.closest('.pad') && !b.classList.contains('switch')) audio.play('ui_click');
});
