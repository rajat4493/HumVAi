import type { Direction } from '@hva/game-core';

interface Props {
  onMove: (d: Direction) => void;
  onAct: () => void;
  onReset: () => void;
  onCommit: (() => void) | null;
}

export function Dpad({ onMove, onAct, onReset, onCommit }: Props) {
  return (
    <div className="pad" aria-label="On-screen controls">
      <button className="up" aria-label="Move up" onClick={() => onMove('UP')}>▲</button>
      <button className="left" aria-label="Move left" onClick={() => onMove('LEFT')}>◀</button>
      <button className="act" aria-label="Interact: toggle a switch or drag a block" onClick={onAct}>●</button>
      <button className="right" aria-label="Move right" onClick={() => onMove('RIGHT')}>▶</button>
      <button className="down" aria-label="Move down" onClick={() => onMove('DOWN')}>▼</button>
      <button className="reset" aria-label="Reset the world" onClick={onReset}>RESET</button>
      {onCommit && (
        <button className="go" aria-label="Start the run" onClick={onCommit}>RUN ▶</button>
      )}
    </div>
  );
}
