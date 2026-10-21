export function Welcome({ onPlay }: { onPlay: () => void }) {
  return (
    <main className="welcome">
      <div>
        <h1 className="logo display">
          <span className="human-t">HUMANS</span>
          <span className="vs">vs</span>
          <span className="ai-t">AI</span>
        </h1>
        <p>Strange little worlds. Hidden rules. Who figures them out first?</p>
        <button className="btn" onClick={onPlay} autoFocus>
          Play
        </button>
        <p className="sub">No account needed.</p>
      </div>
    </main>
  );
}
