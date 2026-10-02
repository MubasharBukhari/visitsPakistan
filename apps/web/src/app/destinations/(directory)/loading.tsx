export default function Loading() {
  return (
    <main
      id="destination-main"
      className="destination-loading"
      aria-busy="true"
    >
      <p role="status">Discovering destinations…</p>
      <div className="destination-skeleton-title" />
      <div className="destination-grid">
        {[1, 2, 3].map((n) => (
          <div key={n} className="destination-skeleton-card" />
        ))}
      </div>
    </main>
  );
}
