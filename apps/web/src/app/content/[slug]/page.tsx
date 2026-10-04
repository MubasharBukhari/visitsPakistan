import { notFound } from 'next/navigation';
import GlobalSearch from '../../../components/global-search';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { brandTokens, type ContentBlock } from '@visitspakistan/domain';
import './story.css';
type Asset = {
  id: string;
  alt: string;
  credit: string;
  width: number;
  height: number;
};
type Story = {
  id: string;
  type: string;
  title: string;
  slug: string;
  summary: string;
  seoTitle: string;
  metaDescription: string;
  blocks: ContentBlock[];
  author: { displayName: string };
  reviewer: { displayName: string };
  firstPublished: string;
  lastUpdated: string;
  lastVerified: string;
  heroMedia: Asset;
  media: Asset[];
  canonicalEntities: Array<{
    id: string;
    name: string;
    kind: string;
    slug: string;
  }>;
  sources: Array<{
    id: string;
    title: string;
    publisher: string;
    url: string | null;
  }>;
};
async function getStory(slug: string): Promise<Story | null> {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/content/${encodeURIComponent(slug)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Editorial content unavailable');
    return response.json();
  } catch (e) {
    if (e instanceof Error && e.message === 'Editorial content unavailable')
      throw e;
    throw new Error('Editorial content unavailable', { cause: e });
  }
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story)
    return {
      title: 'Content not found',
      robots: { index: false, follow: false },
    };
  const origin = process.env.SITE_URL ?? 'http://localhost:3000';
  const canonical = new URL(`/content/${story.slug}/`, origin).href;
  return {
    title: story.seoTitle,
    description: story.metaDescription,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: story.seoTitle,
      description: story.metaDescription,
      type: 'article',
      url: canonical,
      images: [
        {
          url: new URL(`/editorial-media/${story.heroMedia.id}/`, origin).href,
          alt: story.heroMedia.alt,
        },
      ],
    },
  };
}
export default async function EditorialPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();
  let tokens = brandTokens;
  let layout = 'EDITORIAL';
  let logo: string | null = null;
  try {
    const res = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/presentation`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const presentation = await res.json();
      tokens = presentation.settings?.theme.tokens ?? tokens;
      logo = presentation.settings?.theme.logoMediaId;
      layout =
        presentation.assignments.find(
          (a: { type: string }) => a.type === story.type,
        )?.template.layout ?? layout;
    }
  } catch {
    /* baseline presentation remains safe */
  }
  const styles = {
    '--story-primary': tokens.primary,
    '--story-secondary': tokens.secondary,
    '--story-tertiary': tokens.tertiary,
    '--story-neutral': tokens.neutral,
    '--story-heading': tokens.headingFont,
    '--story-body': tokens.bodyFont,
    '--story-radius': `${tokens.radius}px`,
    '--story-width': `${tokens.contentWidth}px`,
  } as CSSProperties;
  const mediaUrl = (id: string) => `/editorial-media/${id}/`;
  return (
    <div
      className={`public-story layout-${layout.toLowerCase()}`}
      style={styles}
    >
      <header className="story-header">
        <a href="/">
          {logo ? (
            <Image
              src={mediaUrl(logo)}
              width={260}
              height={64}
              alt="VisitsPakistan"
              unoptimized
            />
          ) : (
            <Image
              src="/brand/logo.svg"
              width={260}
              height={64}
              alt="VisitsPakistan"
            />
          )}
        </a>
        <span>Discover · Experience</span>
      </header>
      <div className="story-shell">
        <GlobalSearch />
      </div>
      <main className="story-shell">
        <nav aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span>/</span>
          <span>{story.title}</span>
        </nav>
        <section className="story-title">
          <span className="story-eyebrow">
            {story.type.replaceAll('_', ' ')}
          </span>
          <h1>{story.title}</h1>
          <p>{story.summary}</p>
          <div>
            By {story.author.displayName} · Verified{' '}
            {new Date(story.lastVerified).toLocaleDateString('en', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </section>
        <figure className="story-hero">
          <Image
            src={mediaUrl(story.heroMedia.id)}
            alt={story.heroMedia.alt}
            width={story.heroMedia.width}
            height={story.heroMedia.height}
            priority
            unoptimized
          />
          <figcaption>{story.heroMedia.credit}</figcaption>
        </figure>
        <article className="story-body">
          {story.blocks.map((block, i) => (
            <StoryBlock
              key={i}
              block={block}
              assets={story.media}
              entities={story.canonicalEntities}
            />
          ))}
        </article>
        <aside className="story-sources">
          <h2>Sources & editorial review</h2>
          <p>
            Reviewed by {story.reviewer.displayName}. First published{' '}
            {new Date(story.firstPublished).toLocaleDateString('en')}; updated{' '}
            {new Date(story.lastUpdated).toLocaleDateString('en')}.
          </p>
          <ul>
            {story.sources.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}{' '}
                · {s.publisher}
              </li>
            ))}
          </ul>
        </aside>
      </main>
      <footer className="story-footer">
        VisitsPakistan · Stories connected to trusted knowledge.
      </footer>
    </div>
  );
}
function StoryBlock({
  block: b,
  assets,
  entities,
}: {
  block: ContentBlock;
  assets: Asset[];
  entities: Story['canonicalEntities'];
}) {
  if (b.type === 'heading')
    return b.level === 2 ? <h2>{b.text}</h2> : <h3>{b.text}</h3>;
  if (b.type === 'paragraph') return <p>{b.text}</p>;
  if (b.type === 'list')
    return (
      <ul>
        {b.items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    );
  if (b.type === 'callout')
    return <aside className="story-note">{b.text}</aside>;
  if (b.type === 'quote')
    return (
      <blockquote>
        {b.text}
        <cite>{b.attribution}</cite>
      </blockquote>
    );
  if (b.type === 'entity_reference') {
    const e = entities.find((e) => e.id === b.entityId);
    return (
      <aside className="story-reference">
        <strong>{b.label}</strong>
        {e && (
          <span>
            {e.name} · {e.kind.replaceAll('_', ' ')}
          </span>
        )}
      </aside>
    );
  }
  const asset = assets.find((a) => a.id === b.mediaId);
  return asset ? (
    <figure>
      <Image
        src={`/editorial-media/${asset.id}/`}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        unoptimized
      />
      <figcaption>
        {b.caption} · {asset.credit}
      </figcaption>
    </figure>
  ) : null;
}
