export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`cc-skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <article className="sc-card">
      <Skeleton style={{ height: 20, width: "60%", marginBottom: 12 }} />
      <Skeleton style={{ height: 16, width: "90%", marginBottom: 8 }} />
      <Skeleton style={{ height: 16, width: "75%" }} />
    </article>
  );
}

export function SkeletonEventDetail() {
  return (
    <article className="sc-card">
      <Skeleton style={{ height: 28, width: "70%", marginBottom: 16 }} />
      <div className="sc-row" style={{ gap: 8, marginBottom: 20 }}>
        <Skeleton style={{ height: 24, width: 80 }} />
        <Skeleton style={{ height: 24, width: 60 }} />
      </div>
      <Skeleton style={{ height: 16, width: "100%", marginBottom: 8 }} />
      <Skeleton style={{ height: 16, width: "85%", marginBottom: 8 }} />
      <Skeleton style={{ height: 16, width: "65%" }} />
    </article>
  );
}
