import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="destination-main" className="destination-empty">
      <span aria-hidden="true">◇</span>
      <h1>This destination isn’t available.</h1>
      <p>It may not be published yet, or the address may have changed.</p>
      <Link href="/destinations/">Find your next destination →</Link>
    </main>
  );
}
