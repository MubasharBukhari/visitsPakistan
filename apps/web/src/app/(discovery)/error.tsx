'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="destination-main" className="destination-empty">
      <h1>A short pause in the journey.</h1>
      <p>
        Discovery information is temporarily unavailable. Please try again
        shortly.
      </p>
      <button onClick={reset}>Try again</button>
      <Link href="/things-to-do/">Return to things to do</Link>
    </main>
  );
}
