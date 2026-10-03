import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { brandTokens } from '@visitspakistan/domain';
import '../app/destinations/destinations.css';
export default async function PublicDiscoveryLayout({
  children,
  active = 'destinations',
}: {
  children: ReactNode;
  active?: 'destinations' | 'discovery';
}) {
  let tokens = brandTokens;
  let logo: string | null = null;
  try {
    const r = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/presentation`,
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    if (r.ok) {
      const p = await r.json();
      tokens = p.settings?.theme.tokens ?? tokens;
      logo = p.settings?.theme.logoMediaId ?? null;
    }
  } catch {
    /* Baseline presentation supports API outages. */
  }
  const style = {
    '--destination-primary': tokens.primary,
    '--destination-heading': tokens.headingFont,
    '--destination-body': tokens.bodyFont,
    '--destination-radius': `${tokens.radius}px`,
  } as CSSProperties;
  return (
    <div className="destination-shell" style={style}>
      <a className="destination-skip" href="#destination-main">
        Skip to content
      </a>
      <header className="destination-header">
        <Link href="/" aria-label="VisitsPakistan home">
          <Image
            src={logo ? `/editorial-media/${logo}/` : '/brand/logo.svg'}
            width={230}
            height={54}
            alt="VisitsPakistan"
            unoptimized={!!logo}
            priority
          />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/">Discover Pakistan</Link>
          <Link
            href="/destinations/"
            aria-current={active === 'destinations' ? 'location' : undefined}
          >
            Destinations
          </Link>
          <Link
            href="/things-to-do/"
            aria-current={active === 'discovery' ? 'location' : undefined}
          >
            Things to do
          </Link>
        </nav>
      </header>
      {children}
      <footer className="destination-footer">
        <strong>VisitsPakistan</strong>
        <span>Discover places. Follow your curiosity.</span>
        <Link href="/destinations/">Explore destinations →</Link>
      </footer>
    </div>
  );
}
