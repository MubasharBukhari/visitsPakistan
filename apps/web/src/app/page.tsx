import GlobalSearch from '../components/global-search';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { brandTokens } from '@visitspakistan/domain';
export default async function Home() {
  let tokens = brandTokens;
  let logo: string | null = null;
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/presentation`,
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    if (response.ok) {
      const data = await response.json();
      tokens = data.settings?.theme.tokens ?? tokens;
      logo = data.settings?.theme.logoMediaId ?? null;
    }
  } catch {
    /* the baseline remains usable during API outages */
  }
  const style = {
    '--brand-primary': tokens.primary,
    '--brand-secondary': tokens.secondary,
    '--brand-heading': tokens.headingFont,
    '--brand-radius': `${tokens.radius}px`,
  } as CSSProperties;
  return (
    <div className="brand-home" style={style}>
      <header>
        <Image
          src={logo ? `/editorial-media/${logo}/` : '/brand/logo.svg'}
          width={260}
          height={64}
          alt="VisitsPakistan"
          unoptimized={!!logo}
        />
        <span>Discover · Experience</span>
      </header>
      <main>
        <span className="home-kicker">A NEW PERSPECTIVE ON PAKISTAN</span>
        <h1>
          Every place has a story.
          <br />
          Find your next chapter.
        </h1>
        <p>
          Thoughtful travel stories, connected to trusted knowledge.
          <br />
          Our editorial collection is taking shape.
        </p>
        <a href="/destinations/" className="home-button">
          Explore destinations ↗
        </a>
        <GlobalSearch />
      </main>
      <footer>VisitsPakistan · Discover. Experience.</footer>
    </div>
  );
}
