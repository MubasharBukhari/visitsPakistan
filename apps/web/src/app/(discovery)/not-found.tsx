import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="destination-main" className="destination-empty">
      <h1>This place or experience isn’t available.</h1>
      <p>It may not be published yet, or the address may have changed.</p>
      <Link href="/things-to-do/">Explore things to do →</Link>
    </main>
  );
}
