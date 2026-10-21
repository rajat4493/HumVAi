import type { Direction } from '@hva/game-core';

interface Props {
  onMove: (d: Direction) => void;
  onAct: () => void;
  onReset: () => void;
}

export function Dpad({ onMove, onAct, onReset }: Props) {
  return (
    <div className="pad" aria-label="On-screen controls">
      <button className="up" aria-label="Move up" onClick={() => onMove('UP')}>▲</button>
      <button className="left" aria-label="Move left" onClick={() => onMove('LEFT')}>◀</button>
      <button className="act" aria-label="Interact" onClick={onAct}>●</button>
      <button className="right" aria-label="Move right" onClick={() => onMove('RIGHT')}>▶</button>
      <button className="down" aria-label="Move down" onClick={() => onMove('DOWN')}>▼</button>
      <button className="reset" aria-label="Reset level (costs one action)" onClick={onReset}>RESET</button>
    </div>
  );
}
