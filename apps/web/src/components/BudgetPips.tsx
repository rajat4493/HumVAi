interface Props {
  phase: 'explore' | 'execute';
  budget: number;
  used: number;
}

/** Dots for small budgets (countable at a glance), a bar for large ones. */
export function BudgetPips({ phase, budget, used }: Props) {
  const left = budget - used;
  const label = `${left} of ${budget} ${phase === 'explore' ? 'scouting' : 'run'} actions remaining`;
  if (budget > 14) {
    return (
      <div className={`bar ${phase}`} role="img" aria-label={label}>
        <span style={{ width: `${(left / budget) * 100}%` }} />
        <em>
          {left}/{budget}
        </em>
      </div>
    );
  }
  return (
    <div className={`pips ${phase}`} role="img" aria-label={label}>
      {Array.from({ length: budget }, (_, i) => (
        <span key={i} className={`pip${i < used ? ' spent' : phase === 'execute' && left <= 3 ? ' low' : ''}`} />
      ))}
    </div>
  );
}
