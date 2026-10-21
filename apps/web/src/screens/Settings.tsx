import { useState } from 'react';
import { MANUAL } from '@hva/ai-adapters';
import { BackIcon } from '../components/icons';
import { Modal } from '../components/Modal';
import { applyMotion } from '../lib/motion';
import { withSettings } from '../save/save';
import type { SaveStore } from '../save/store';
import type { SaveData, Settings as SettingsData } from '../save/types';

interface Props {
  save: SaveData;
  store: SaveStore;
  onBack: () => void;
}

type Block = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

/** The manual is hard-wrapped plain text; rejoin wrapped lines and turn '- ' lines into a list. */
export function manualBlocks(manual: string): Block[] {
  const out: Block[] = [];
  for (const para of manual.split('\n\n')) {
    const items: string[] = [];
    const text: string[] = [];
    for (const line of para.split('\n')) {
      if (line.startsWith('- ')) items.push(line.slice(2));
      else if (/^\s+/.test(line) && items.length > 0) items[items.length - 1] += ` ${line.trim()}`;
      else text.push(line.trim());
    }
    if (text.length) out.push({ kind: 'p', text: text.join(' ') });
    if (items.length) out.push({ kind: 'list', items });
  }
  return out;
}

function Switch({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <div className="setting-row">
      <span id={`${testId}-l`}>{label}</span>
      <button role="switch" aria-checked={checked} aria-labelledby={`${testId}-l`} className={`switch${checked ? ' on' : ''}`} data-testid={testId} onClick={() => onChange(!checked)}>
        <span className="knob" />
      </button>
    </div>
  );
}

export function Settings({ save, store, onBack }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const s = save.settings;
  const patch = (p: Partial<SettingsData>) => {
    store.set(withSettings(store.get(), p));
    if (p.motion) applyMotion(p.motion);
  };
  const blocks = manualBlocks(MANUAL);
  return (
    <main className="panel-screen" aria-label="Settings">
      <header className="map-head">
        <button className="icon-btn" aria-label="Back" onClick={onBack} data-testid="settings-back">
          <BackIcon />
        </button>
        <h1 className="display">Settings</h1>
        <span />
      </header>

      <section className="panel" aria-labelledby="audio-h">
        <h2 id="audio-h">Sound</h2>
        <Switch label="Sound effects" checked={s.sound} onChange={(v) => patch({ sound: v })} testId="sound-toggle" />
        <Switch label="Music" checked={s.music} onChange={(v) => patch({ music: v })} testId="music-toggle" />
        <div className="setting-row">
          <label htmlFor="volume">Volume</label>
          <input id="volume" data-testid="volume" type="range" min={0} max={100} value={Math.round(s.volume * 100)} onChange={(e) => patch({ volume: Number(e.target.value) / 100 })} />
        </div>
        <p className="note">Sound is always optional. Nothing in the game depends on hearing it.</p>
      </section>

      <section className="panel" aria-labelledby="motion-h">
        <h2 id="motion-h">Motion</h2>
        <div role="radiogroup" aria-labelledby="motion-h" className="radio-row">
          {(
            [
              ['system', 'Follow my device'],
              ['reduced', 'Reduce motion'],
              ['full', 'Full motion'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} role="radio" aria-checked={s.motion === value} className={`chip${s.motion === value ? ' on' : ''}`} data-testid={`motion-${value}`} onClick={() => patch({ motion: value })}>
              {label}
            </button>
          ))}
        </div>
        <p className="note">Reduced motion removes particles, flashes, shakes and sliding. The game stays fully playable.</p>
      </section>

      <section className="panel" aria-labelledby="how-h">
        <h2 id="how-h">How to play</h2>
        <p className="note">These are the same rules the AI is given.</p>
        {blocks.map((b, i) =>
          b.kind === 'list' ? (
            <ul key={i} className="manual-list">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          ) : (
            <p key={i} className="manual">
              {b.text}
            </p>
          ),
        )}
        <h3>Controls</h3>
        <ul className="controls">
          <li>
            <b>Keyboard:</b> arrows or WASD to move, Space to interact, R to reset, C to start the run.
          </li>
          <li>
            <b>Touch:</b> the on-screen pad, or swipe on the board.
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="data-h">
        <h2 id="data-h">Your data</h2>
        <p className="note">
          {store.persistent ? 'Progress is saved on this device only. There are no accounts and nothing is sent anywhere.' : "This browser mode does not allow saving, so progress lasts only until you close the tab."}
        </p>
        <button className="btn ghost" data-testid="reset-progress" onClick={() => setConfirmReset(true)}>
          Reset all progress
        </button>
      </section>

      {confirmReset && (
        <Modal label="Reset all progress?" onClose={() => setConfirmReset(false)}>
          <h2>Reset all progress?</h2>
          <p>This erases your finished worlds, personal bests, achievements and any run in progress on this device. It cannot be undone.</p>
          <div className="row">
            <button className="btn ghost" data-autofocus onClick={() => setConfirmReset(false)}>
              Keep my progress
            </button>
            <button
              className="btn"
              data-testid="confirm-reset"
              onClick={() => {
                const keep = store.get().settings;
                store.reset();
                store.set(withSettings(store.get(), keep));
                setConfirmReset(false);
              }}
            >
              Erase everything
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
