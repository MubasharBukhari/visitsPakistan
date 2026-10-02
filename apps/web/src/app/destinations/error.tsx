'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="destination-main" className="destination-empty">
      <h1>A short pause in the journey.</h1>
      <p>
        Destination information is temporarily unavailable. Please try again
        shortly.
      </p>
      <button onClick={reset}>Try again</button>
      <Link href="/destinations/">Return to destinations</Link>
    </main>
  );
}
