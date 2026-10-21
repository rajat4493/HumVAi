interface Props {
  side: 'human' | 'ai';
  name: string;
  role: string;
  stat: string;
}

export function ActorCard({ side, name, role, stat }: Props) {
  return (
    <aside className={`actor ${side}`} aria-label={name}>
      <div className="badge" aria-hidden="true" />
      <h3>{name}</h3>
      <p className="role">{role}</p>
      <div className="stat">{stat}</div>
    </aside>
  );
}
