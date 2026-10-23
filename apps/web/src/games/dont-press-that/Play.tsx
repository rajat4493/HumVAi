import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, BulbIcon, GearIcon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { reducedMotion } from '../../lib/motion';
import { store } from '../../save/instance';
import { sfx } from './audio';
import type { SfxId } from './audio';
import { Controller } from './controller';
import type { TickInfo } from './controller';
import { emitDpt } from './events';
import { hintFor } from './host';
import { TONES, TONE_LABEL, TONE_NOTE } from './lines';
import type { Mood } from './lines';
import { levelByN } from './levels';
import { LOGICAL_ASPECT, burst, drawHost, drawScene, stepParticles } from './render';
import type { Particle, RenderView } from './render';
import { run } from './runState';
import { KEY, TICK } from './sim';
import { addFeedback, addPredictions, loadDpt, markFinished, recordAttempt, recordClear, recordHint, recordSkip, setSettings } from './storage';
import type { DptSave } from './storage';

const STEP_MS = 1000 * TICK;
const HINT_AFTER = 6;
const SKIP_AFTER = 14;

interface Props {
  n: number;
  onMenu: () => void;
  onNext: () => void;
  onDone: () => void;
}

export interface DptDebug {
  state(): Record<string, unknown>;
  /** Replaces live input with this list, one entry per tick, then hands control back. For the browser tests only. */
  feed(inputs: number[], opts?: { fast?: boolean }): void;
  sfx(): string[];
}

const cueFor: Partial<Record<string, SfxId>> = {
  takeoff: 'jump',
  land: 'land',
  star: 'star',
  button: 'button',
  drop_trigger: 'rumble',
  drop_land: 'thud',
  zone_trigger: 'vent',
  beam_track: 'track',
  beam_lock: 'lock',
  beam_start: 'beam',
};

export function Play({ n, onMenu, onNext, onDone }: Props) {
  const level = levelByN(n)!;
  const [save, setSave] = useState<DptSave>(() => loadDpt());
  const saveRef = useRef(save);
  saveRef.current = save;
  const [caption, setCaption] = useState<{ text: string; mood: Mood; hint: boolean } | null>(null);
  const [deaths, setDeaths] = useState(() => (run.histories.get(level.id) ?? []).filter((a) => a.outcome === 'death').length);
  const [counts, setCounts] = useState(() => run.ledger.counts());
  const [cleared, setCleared] = useState<{ ticks: number; deaths: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hintTier, setHintTier] = useState(0);
  const [feedback, setFeedback] = useState<{ fair: 'fair' | 'unfair' | 'skip'; fun: 'fun' | 'meh' | 'skip' }>({ fair: 'skip', fun: 'skip' });

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const avatar = useRef<HTMLCanvasElement>(null);
  const keys = useRef(0);
  const touch = useRef(0);
  /** Presses shorter than one tick (a quick tap) still count for one tick. */
  const latch = useRef(0);
  const restartPulse = useRef(false);
  const queue = useRef<number[]>([]);
  /** Test affordance: while a fed list is running, play it as fast as frames allow instead of in real time. Never on in normal play. */
  const fast = useRef(false);
  const paused = useRef(false);
  const clearedRef = useRef(false);
  const ctrl = useRef<Controller | null>(null);
  const lastRespawnMs = useRef<number | null>(null);
  paused.current = settingsOpen;

  const reduced = useMemo(() => reducedMotion(), []);

  // ---- one controller per level visit ----
  useEffect(() => {
    const s = saveRef.current;
    const c = new Controller({
      level,
      tone: s.settings.tone,
      muted: s.settings.muted,
      ledger: run.ledger,
      prior: run.histories.get(level.id) ?? [],
      emit: (type, payload) => emitDpt(level, type, payload),
    });
    ctrl.current = c;
    run.histories.set(level.id, c.session.history);
    clearedRef.current = false;
    setCleared(null);
    setHintTier(0);
    setCaption(c.line ? { text: c.line.line.text, mood: c.line.line.mood, hint: false } : null);

    const cv = canvas.current!;
    const cx = cv.getContext('2d')!;
    const av = avatar.current!;
    const ax = av.getContext('2d')!;
    let cssW = 0;
    const resize = (): void => {
      const w = stage.current?.clientWidth ?? 640;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cssW = w;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round((w / LOGICAL_ASPECT) * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const a = Math.round(72 * dpr);
      av.width = a;
      av.height = a;
      ax.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (stage.current) ro.observe(stage.current);

    let particles: Particle[] = [];
    let shakeUntil = 0;
    let squash = 0;
    let hostX = 17.5;
    let finaleAt: number | null = null;
    let lastLine: unknown = c.line?.line ?? null;
    let acc = 0;
    let last = performance.now();
    let deathAt = 0;
    let raf = 0;
    const ventsDeaths = (): boolean => c.session.history.some((a) => a.cause === 'zone');

    const play = (id: SfxId): void => sfx.play(id);

    const handle = (info: TickInfo, now: number): void => {
      for (const e of info.events) {
        const cue = cueFor[e.type];
        if (cue) play(cue);
        if (e.type === 'land') squash = 1;
        if (e.type === 'star') particles = particles.concat(burst(e.x, c.session.sim.p.y, 14, ['#b78cff', '#ffffff'], c.session.sim.tick));
        if (e.type === 'beam_start' && e.broke > 0) {
          play('crumble');
          if (!reduced) particles = particles.concat(burst(e.aim, 6, 22, ['#3b2f66', '#b78cff', '#ffffff'], 7));
          shakeUntil = now + 250;
        }
      }
      if (info.verdicts.length > 0) {
        const real = info.verdicts.filter((v) => v.verdict !== 'void');
        if (real.length > 0) {
          setCounts(run.ledger.counts());
          setSave(addPredictions(real.filter((v) => v.verdict === 'correct').length, real.filter((v) => v.verdict === 'wrong').length));
          if (!info.verdicts.some((v) => v.id.startsWith('beam-'))) play(real[0]!.verdict === 'correct' ? 'right' : 'wrong');
        }
      }
      const ended = info.ended;
      if (ended?.outcome === 'death') {
        play('death');
        deathAt = now;
        if (!reduced) particles = particles.concat(burst(ended.deathX ?? 0, ended.deathY ?? 0, 18, ['#ffb347', '#ffd08a', '#ffffff'], ended.ticks));
        if (!reduced && saveRef.current.settings.shake) shakeUntil = now + 160;
        setDeaths(c.deathsHere);
        setSave(recordAttempt(level.id, { died: true }));
      } else if (ended?.outcome === 'win') {
        play(n === 5 ? 'finale' : 'win');
        clearedRef.current = true;
        const d = c.deathsHere;
        run.clears.set(level.id, { ticks: ended.ticks, deaths: d, skipped: false });
        setSave(recordAttempt(level.id, { died: false }));
        setSave(recordClear(level.id, ended.ticks, d));
        setCleared({ ticks: ended.ticks, deaths: d });
        if (n === 5) {
          finaleAt = now;
          setSave(markFinished());
        } else if (!reduced) particles = particles.concat(burst(c.session.sim.parsed.exit?.x ?? 10, 6, 26, ['#5be38a', '#ffb347', '#b78cff', '#ffffff'], 9));
        if (n === 5 && !reduced) particles = particles.concat(burst(10, 3, 40, ['#5be38a', '#ffb347', '#b78cff', '#ffffff', '#6f8cff'], 11));
      }
      if (info.respawned && deathAt) {
        lastRespawnMs.current = Math.round(now - deathAt);
        play('respawn');
        deathAt = 0;
      }
      if (info.newLine && !c.host.muted) play('blip');
    };

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - last);
      last = now;
      if (!paused.current && !clearedRef.current) {
        acc += dt;
        let guard = 0;
        const fastNow = fast.current && queue.current.length > 0;
        while ((acc >= STEP_MS || fastNow) && guard++ < (fastNow ? 40 : 6)) {
          if (fastNow && queue.current.length === 0) break;
          acc = Math.max(0, acc - STEP_MS);
          const queued = queue.current.length > 0 ? queue.current.shift()! : null;
          let input = queued ?? (keys.current | touch.current | latch.current);
          if (queued === null) latch.current = 0;
          if (queued === null && restartPulse.current) {
            input |= KEY.RESTART;
            restartPulse.current = false;
          }
          handle(c.tick(input), now);
        }
      } else acc = 0;
      // animation state
      const sim = c.session.sim;
      const target = sim.beam.phase !== 'idle' && sim.level.beams !== 'off' ? sim.beam.aim : 17.5;
      hostX = reduced ? target : hostX + (target - hostX) * 0.18;
      squash = Math.max(0, squash - dt / 160);
      particles = stepParticles(particles, dt / 1000);
      const t = now;
      const view: RenderView = {
        sim,
        time: t,
        mood: finaleAt !== null ? 'defeated' : c.mood,
        composure: c.host.composure,
        hostX,
        correct: run.ledger.counts().correct,
        wrong: run.ledger.counts().wrong,
        reduced,
        shakePx: now < shakeUntil && saveRef.current.settings.shake ? 3 : 0,
        particles,
        ventsLearned: ventsDeaths(),
        finaleMs: finaleAt === null ? null : now - finaleAt,
        squash,
      };
      drawScene(cx, cssW, view);
      ax.clearRect(0, 0, 72, 72);
      drawHost(ax, 36, 34, 22, view.mood, t, view.composure, { reduced, off: finaleAt !== null, lookX: (sim.p.x - 10) / 10 });
      // caption follows the host's current line
      const lineNow = c.line?.line ?? null;
      if (lineNow !== lastLine) {
        lastLine = lineNow;
        setCaption(lineNow ? { text: lineNow.text, mood: lineNow.mood, hint: false } : null);
      }
    };
    raf = requestAnimationFrame(frame);

    (window as unknown as { __DPT__: DptDebug }).__DPT__ = {
      state: () => {
        const sim = c.session.sim;
        return {
          level: n,
          tick: sim.tick,
          attempt: c.session.attempt,
          x: sim.p.x,
          y: sim.p.y,
          gs: sim.p.gs,
          grounded: sim.p.grounded,
          dead: sim.dead?.cause ?? null,
          won: sim.won,
          deaths: c.deathsHere,
          mode: c.session.mode,
          beam: sim.beam.phase,
          line: c.line?.line.text ?? null,
          composure: c.host.composure,
          predictions: run.ledger.counts(),
          verdicts: run.ledger.entries.map((e) => `${e.id}:${e.verdict}`),
          respawnMs: lastRespawnMs.current,
          queued: queue.current.length,
          history: c.session.history.map((a) => ({ n: a.n, outcome: a.outcome, ticks: a.ticks, cause: a.cause, respawnTicks: a.respawnTicks, retryTicks: a.retryTicks })),
        };
      },
      feed: (inputs, opts) => {
        queue.current = inputs.slice();
        fast.current = opts?.fast === true;
      },
      sfx: () => sfx.played.slice(),
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      delete (window as unknown as { __DPT__?: DptDebug }).__DPT__;
    };
    // The controller is rebuilt only when the level changes; settings reach it through setHost below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    ctrl.current?.setHost(save.settings.tone, save.settings.muted);
  }, [save.settings.tone, save.settings.muted]);

  // ---- keyboard ----
  useEffect(() => {
    const bit = (k: string): number => {
      switch (k) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          return KEY.L;
        case 'ArrowRight':
        case 'd':
        case 'D':
          return KEY.R;
        case ' ':
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'z':
        case 'Z':
          return KEY.J;
        default:
          return 0;
      }
    };
    const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
    const down = (e: KeyboardEvent): void => {
      sfx.unlock();
      if (settingsOpen || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const b = bit(e.key);
      if (b) {
        e.preventDefault();
        keys.current |= b;
        latch.current |= b;
      } else if ((e.key === 'r' || e.key === 'R') && !e.repeat) {
        e.preventDefault();
        restartPulse.current = true;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (e.key === 'Enter' && clearedRef.current && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-testid="dpt-next"]')?.click();
      }
    };
    const up = (e: KeyboardEvent): void => {
      const b = bit(e.key);
      if (b) {
        keys.current &= ~b;
        if (!settingsOpen && !typing(e.target)) e.preventDefault(); // Space on a focused button would otherwise "click" it on release
      }
    };
    const blur = (): void => {
      keys.current = 0;
      touch.current = 0;
      latch.current = 0;
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', blur);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', blur);
      keys.current = 0;
      touch.current = 0;
    };
  }, [settingsOpen]);

  const press = (bit: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      sfx.unlock();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      touch.current |= bit;
      latch.current |= bit;
    },
    onPointerUp: () => void (touch.current &= ~bit),
    onPointerCancel: () => void (touch.current &= ~bit),
    onLostPointerCapture: () => void (touch.current &= ~bit),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const settings = save.settings;
  const patch = (p: Partial<typeof settings>): void => setSave(setSettings(p));
  const showHint = (): void => {
    const tier = Math.min(1, hintTier) as 0 | 1;
    setCaption({ text: hintFor(n, tier), mood: 'thinking', hint: true });
    setHintTier((t) => t + 1);
    setSave(recordHint(level.id));
    emitDpt(level, 'hint', { tier });
    sfx.play('ui');
  };
  const skip = (): void => {
    setSave(recordSkip(level.id));
    run.clears.set(level.id, { ticks: 0, deaths: ctrl.current?.deathsHere ?? 0, skipped: true });
    emitDpt(level, 'skip', { level: n });
    onNext();
  };
  const leave = useCallback(
    (then: () => void) => {
      if (feedback.fair !== 'skip' || feedback.fun !== 'skip') {
        setSave(addFeedback({ level: n, ...feedback }));
        emitDpt(level, 'feedback', { level: n, ...feedback });
      }
      then();
    },
    [feedback, level, n],
  );

  const next = (): void => leave(n === 5 ? onDone : onNext);
  const secs = cleared ? (cleared.ticks / 60).toFixed(1) : '';
  const total = counts.correct + counts.wrong;

  return (
    <main className="dpt" aria-label={`Level ${n}: ${level.name}`} data-testid="dpt-play">
      <header className="dpt-top">
        <button className="icon-btn" aria-label="Back to the level list" onClick={onMenu} data-testid="dpt-back">
          <BackIcon />
        </button>
        <div className="dpt-title">
          <span className="dpt-lvl">Level {n} of 5</span>
          <strong data-testid="dpt-name">{level.name}</strong>
        </div>
        <div className="dpt-stat" data-testid="dpt-deaths" aria-live="off">
          Deaths <b>{deaths}</b>
        </div>
        <button className="icon-btn" aria-label="Game settings" onClick={() => setSettingsOpen(true)} data-testid="dpt-settings">
          <GearIcon />
        </button>
      </header>

      <div className="dpt-stage" ref={stage}>
        <canvas ref={canvas} className="dpt-canvas" data-testid="dpt-canvas" role="img" aria-label={`The level: ${level.name}. Move with the arrow keys or A and D, jump with Space, restart with R.`} />
      </div>

      <section className="dpt-host" aria-label="Professor Probably">
        <canvas ref={avatar} className="dpt-avatar" width={72} height={72} aria-hidden="true" />
        <div className="dpt-say">
          {cleared ? (
            <div className="dpt-cleared" data-testid="dpt-cleared">
              <strong>{n === 5 ? 'He is switched off.' : 'Cleared!'}</strong>
              <span>
                {secs}s · {cleared.deaths} death{cleared.deaths === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}
          <p className="dpt-line" aria-live="polite" data-testid="dpt-line" data-hint={caption?.hint ? '1' : '0'}>
            {settings.muted && !caption?.hint ? <em className="dpt-muted">Host muted. He is still watching.</em> : (caption?.text ?? '')}
          </p>
          <p className="dpt-score" data-testid="dpt-score">
            His predictions: <b>{counts.correct}</b> came true, <b>{counts.wrong}</b> did not{total > 0 ? ` (${Math.round((counts.correct / total) * 100)}% right)` : ''}
            {counts.beams > 0 ? `, counting ${counts.beams} beam${counts.beams === 1 ? '' : 's'}` : ''}.
          </p>
        </div>
        <div className="dpt-tools">
          {deaths >= HINT_AFTER && !cleared ? (
            <button className="chip" onClick={showHint} data-testid="dpt-hint">
              <BulbIcon /> Hint
            </button>
          ) : null}
          {deaths >= SKIP_AFTER && n < 5 && !cleared ? (
            <button className="chip" onClick={skip} data-testid="dpt-skip">
              Skip level
            </button>
          ) : null}
        </div>
      </section>

      {cleared ? (
        <section className="dpt-card" aria-label="Level finished" data-testid="dpt-done-card">
          <div className="dpt-fb" role="group" aria-label="Optional: how was that level?">
            <span>Quick, optional:</span>
            {(['fair', 'unfair'] as const).map((v) => (
              <button key={v} className={`chip${feedback.fair === v ? ' on' : ''}`} aria-pressed={feedback.fair === v} onClick={() => setFeedback((f) => ({ ...f, fair: f.fair === v ? 'skip' : v }))} data-testid={`dpt-fb-${v}`}>
                {v === 'fair' ? 'Felt fair' : 'Felt unfair'}
              </button>
            ))}
            {(['fun', 'meh'] as const).map((v) => (
              <button key={v} className={`chip${feedback.fun === v ? ' on' : ''}`} aria-pressed={feedback.fun === v} onClick={() => setFeedback((f) => ({ ...f, fun: f.fun === v ? 'skip' : v }))} data-testid={`dpt-fb-${v}`}>
                {v === 'fun' ? 'Fun' : 'Meh'}
              </button>
            ))}
          </div>
          <div className="dpt-actions">
            <button className="btn" onClick={next} data-testid="dpt-next" data-autofocus>
              {n === 5 ? 'See what happened' : 'Next level'}
            </button>
            <button className="btn ghost" onClick={() => leave(() => window.location.reload())} data-testid="dpt-replay">
              Play it again
            </button>
          </div>
        </section>
      ) : (
        <p className="dpt-keys" aria-hidden="true">
          ← → move · Space jump · R restart · Esc menu
        </p>
      )}

      <div className="dpt-pad" aria-label="Touch controls" data-testid="dpt-pad">
        <div className="dpt-pad-move">
          <button className="dpt-btn" aria-label="Move left" data-testid="dpt-left" {...press(KEY.L)}>
            ◀
          </button>
          <button className="dpt-btn" aria-label="Move right" data-testid="dpt-right" {...press(KEY.R)}>
            ▶
          </button>
        </div>
        <button
          className="dpt-btn small"
          aria-label="Restart the level"
          data-testid="dpt-restart"
          onPointerDown={(e) => {
            e.preventDefault();
            sfx.unlock();
            restartPulse.current = true;
          }}
        >
          ↺
        </button>
        <button className="dpt-btn jump" aria-label="Jump" data-testid="dpt-jump" {...press(KEY.J)}>
          JUMP
        </button>
      </div>

      {settingsOpen ? (
        <Modal label="Game settings" onClose={() => setSettingsOpen(false)}>
          <div className="dpt-modal">
            <h2>Host settings</h2>
            <p className="note">These change how much he talks and how he sounds. They never change how anything in the level works.</p>
            <div role="radiogroup" aria-label="Host personality" className="radio-row">
              {TONES.map((t) => (
                <button key={t} role="radio" aria-checked={settings.tone === t} className={`chip${settings.tone === t ? ' on' : ''}`} data-testid={`dpt-tone-${t}`} onClick={() => patch({ tone: t })}>
                  {TONE_LABEL[t]}
                </button>
              ))}
            </div>
            <p className="note">{TONE_NOTE[settings.tone]}</p>
            <div className="setting-row">
              <span id="dpt-mute-l">Mute the host</span>
              <button role="switch" aria-checked={settings.muted} aria-labelledby="dpt-mute-l" className={`switch${settings.muted ? ' on' : ''}`} data-testid="dpt-mute" onClick={() => patch({ muted: !settings.muted })}>
                <span className="knob" />
              </button>
            </div>
            <div className="setting-row">
              <span id="dpt-shake-l">Small screen shake on a death</span>
              <button role="switch" aria-checked={settings.shake} aria-labelledby="dpt-shake-l" className={`switch${settings.shake ? ' on' : ''}`} data-testid="dpt-shake" onClick={() => patch({ shake: !settings.shake })}>
                <span className="knob" />
              </button>
            </div>
            <div className="setting-row">
              <span id="dpt-sound-l">Sound effects</span>
              <button
                role="switch"
                aria-checked={store.get().settings.sound}
                aria-labelledby="dpt-sound-l"
                className={`switch${store.get().settings.sound ? ' on' : ''}`}
                data-testid="dpt-sound"
                onClick={() => {
                  store.set({ ...store.get(), settings: { ...store.get().settings, sound: !store.get().settings.sound } });
                  setSave({ ...save });
                }}
              >
                <span className="knob" />
              </button>
            </div>
            <p className="note">Reduced motion, volume and data choices are in the arcade's Settings.</p>
            <div className="dpt-actions">
              <button className="btn" data-autofocus onClick={() => setSettingsOpen(false)} data-testid="dpt-resume">
                Back to the game
              </button>
              <button className="btn ghost" onClick={onMenu} data-testid="dpt-to-menu">
                Level list
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
