export function FoundationPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="panel">
      <span className="eyebrow">VisitsPakistan · Sprint 0</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
