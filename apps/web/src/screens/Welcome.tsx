import { GearIcon, TrophyIcon } from '../components/icons';

interface Props {
  hasProgress: boolean;
  persistent: boolean;
  onPlay: () => void;
  onSettings: () => void;
  onHall: () => void;
}

export function Welcome({ hasProgress, persistent, onPlay, onSettings, onHall }: Props) {
  return (
    <main className="welcome">
      <div>
        <h1 className="logo display">
          <span className="human-t">HUMANS</span>
          <span className="vs">vs</span>
          <span className="ai-t">AI</span>
        </h1>
        <p>Strange little worlds. Hidden rules. Who figures them out first?</p>
        <button className="btn" onClick={onPlay} data-autofocus autoFocus data-testid="play">
          {hasProgress ? 'Continue' : 'Play'}
        </button>
        <div className="welcome-links">
          <button className="link-btn" data-testid="welcome-settings" onClick={onSettings}>
            <GearIcon /> Settings
          </button>
          <button className="link-btn" data-testid="welcome-hall" onClick={onHall}>
            <TrophyIcon /> Hall of Humanity
          </button>
        </div>
        <p className="sub">{persistent ? 'No account needed. Progress is saved on this device.' : 'No account needed. This browser mode cannot save progress.'}</p>
      </div>
    </main>
  );
}
