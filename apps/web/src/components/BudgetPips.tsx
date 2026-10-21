export function BudgetPips({ budget, used }: { budget: number; used: number }) {
  const left = budget - used;
  return (
    <div className="pips" role="img" aria-label={`${left} of ${budget} actions remaining`}>
      {Array.from({ length: budget }, (_, i) => (
        <span key={i} className={`pip${i < used ? ' spent' : left <= 3 ? ' low' : ''}`} />
      ))}
    </div>
  );
}
