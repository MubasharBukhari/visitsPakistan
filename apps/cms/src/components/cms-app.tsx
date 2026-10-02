'use client';
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconLayoutDashboard,
  IconFileText,
  IconCheckbox,
  IconPhoto,
  IconPalette,
  IconLayout,
  IconMap2,
  IconBook2,
  IconMenu2,
  IconX,
  IconSearch,
  IconPlus,
  IconArrowUpRight,
  IconArrowLeft,
  IconArrowUp,
  IconArrowDown,
  IconTrash,
  IconDeviceFloppy,
  IconSend,
  IconCheck,
  IconWorld,
  IconLogout,
  IconChevronRight,
  IconClock,
  IconExternalLink,
} from '@tabler/icons-react';
import {
  brandTokens,
  editorialTypes,
  typeLabels,
  blockTypes,
  type CmsActor,
  type ContentBlock,
  type EditorialBody,
  type EditorialType,
  type EditorialStatus,
  type ThemeTokens,
} from '@visitspakistan/domain';
type Media = {
  id: string;
  alt: string;
  credit: string;
  width: number;
  height: number;
};
type Source = {
  id: string;
  title: string;
  url: string | null;
  sourceType: string;
};
type Canonical = {
  id: string;
  kind: string;
  name: string;
  slug: string;
  status: string;
  geoEntity?: { type: string } | null;
};
type Revision = {
  id: string;
  number: number;
  status: EditorialStatus;
  title: string;
  summary: string;
  seoTitle: string;
  metaDescription: string;
  blocks: ContentBlock[];
  lastVerified: string | null;
  updatedAt: string;
  heroMediaId: string | null;
  authorId: string;
  author: { displayName: string };
  reviewer: { displayName: string } | null;
  sources: Array<{ sourceId: string; source: Source }>;
  references: Array<{ entityId: string; entity: Canonical }>;
};
type Doc = {
  id: string;
  version: number;
  firstPublishedAt: string | null;
  currentRevision: Revision;
  publishedRevision: Revision | null;
  contentItem: {
    type: EditorialType;
    primaryEntityId: string | null;
    entity: { slug: string; locale: string };
  };
};
type Theme = {
  id: string;
  name: string;
  slug: string;
  tokens: ThemeTokens;
  version: number;
  logoMediaId: string | null;
};
type Template = {
  id: string;
  name: string;
  slug: string;
  layout: 'EDITORIAL' | 'MAGAZINE' | 'COMPACT';
  allowedBlocks: string[];
  version: number;
};
type Presentation = {
  settings: { version: number; themeId: string; theme: Theme } | null;
  assignments: Array<{ type: EditorialType; templateId: string }>;
};
async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const res = await fetch(`/cms-api/${path}/`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers:
      body instanceof FormData
        ? {}
        : body
          ? { 'Content-Type': 'application/json' }
          : {},
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401) {
    window.location.assign('/login/');
    throw new Error('Session expired');
  }
  if (!res.ok)
    throw new Error(
      data.message + (data.fields?.length ? `: ${data.fields.join(', ')}` : ''),
    );
  return data;
}
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(value))
    : 'Not verified';
function Status({ value }: { value: string }) {
  return (
    <span className={`status-pill status-${value.toLowerCase()}`}>
      <i />
      {value === 'REVIEW'
        ? 'In review'
        : value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}
const navigation = [
  { key: '', label: 'Overview', icon: IconLayoutDashboard },
  { key: 'content', label: 'Content library', icon: IconFileText },
  { key: 'review', label: 'Review queue', icon: IconCheckbox },
  { key: 'media', label: 'Media library', icon: IconPhoto },
  { key: 'sources', label: 'Sources & references', icon: IconBook2 },
  { key: 'canonical', label: 'Canonical entities', icon: IconMap2 },
  { key: 'themes', label: 'Brand & themes', icon: IconPalette },
  { key: 'templates', label: 'Website templates', icon: IconLayout },
];
export function CmsApp({
  actor,
  section,
}: {
  actor: CmsActor;
  section: string[];
}) {
  const router = useRouter();
  const active = section[0] ?? '';
  const editId = section[1];
  const [mobile, setMobile] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [entities, setEntities] = useState<Canonical[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presentation, setPresentation] = useState<Presentation>({
    settings: null,
    assignments: [],
  });
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  async function load() {
    try {
      const [d, r, m, t, layouts, p] = await Promise.all([
        api<Doc[]>('content'),
        api<{ entities: Canonical[]; sources: Source[] }>('references'),
        api<Media[]>('media'),
        api<Theme[]>('themes'),
        api<Template[]>('templates'),
        api<Presentation>('presentation'),
      ]);
      setDocs(d);
      setEntities(r.entities);
      setSources(r.sources);
      setMedia(m);
      setThemes(t);
      setTemplates(layouts);
      setPresentation(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load studio');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const first = document.querySelector<HTMLElement>('.studio-sidebar a');
    first?.focus();
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobile(false);
        document.querySelector<HTMLElement>('.mobile-menu')?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [mobile]);
  async function changed(note: string) {
    setError('');
    setMessage(note);
    await load();
  }
  async function perform(work: () => Promise<unknown>, note: string) {
    try {
      await work();
      await changed(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }
  const current = docs.find((d) => d.id === editId);
  const review = docs.filter((d) =>
    ['REVIEW', 'APPROVED'].includes(d.currentRevision.status),
  );
  const filtered = docs.filter(
    (d) =>
      (active !== 'review' ||
        ['REVIEW', 'APPROVED'].includes(d.currentRevision.status)) &&
      (type === 'all' || d.contentItem.type === type) &&
      `${d.currentRevision.title} ${d.contentItem.entity.slug}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const nav = (key: string) => {
    setMobile(false);
    router.push(key ? `/${key}/` : '/');
  };
  return (
    <div className="studio">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`studio-sidebar ${mobile ? 'is-open' : ''}`}
        inert={creating}
      >
        <div className="sidebar-brand">
          <Image
            src="/brand/logo.svg"
            alt="VisitsPakistan"
            width={240}
            height={52}
            priority
          />
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <IconX />
          </button>
        </div>
        <span className="studio-label">
          EDITORIAL STUDIO <span>CMS</span>
        </span>
        <nav aria-label="Studio navigation">
          {navigation.map((n, i) => (
            <div key={n.key}>
              {i === 3 && <span className="nav-group">RESOURCES</span>}
              {i === 6 && <span className="nav-group">PRESENTATION</span>}
              <Link
                href={n.key ? `/${n.key}/` : '/'}
                aria-current={active === n.key ? 'page' : undefined}
                className={`studio-nav-item ${active === n.key ? 'active' : ''}`}
                onClick={() => setMobile(false)}
              >
                <n.icon size={20} stroke={1.6} />
                <span>{n.label}</span>
                {n.key === 'review' && review.length > 0 && (
                  <b>{review.length}</b>
                )}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="knowledge-note">
            <IconMap2 size={22} />
            <div>
              <strong>Connected by knowledge</strong>
              <small>Canonical data stays authoritative.</small>
            </div>
          </div>
          <button
            onClick={() =>
              perform(async () => {
                await api('auth/logout', {});
                window.location.assign('/login/');
              }, 'Signed out')
            }
            className="profile-button"
          >
            <span className="avatar">
              {actor.displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </span>
            <span>
              <strong>{actor.displayName}</strong>
              <small>
                {actor.roles
                  .map((r) => r.charAt(0) + r.slice(1).toLowerCase())
                  .join(' · ')}
              </small>
            </span>
            <IconLogout size={18} />
          </button>
        </div>
      </aside>
      <div className="studio-workspace" inert={mobile || creating}>
        <header className="studio-topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <IconMenu2 />
          </button>
          <div className="breadcrumbs">
            Editorial studio <IconChevronRight size={15} />{' '}
            <strong>
              {navigation.find((n) => n.key === active)?.label ??
                'Content library'}
            </strong>
          </div>
          <span className="topbar-status">
            <i /> Local workspace
          </span>
          <a
            href="http://localhost:3000/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-ghost-secondary"
          >
            View website <IconArrowUpRight size={16} />
          </a>
        </header>
        <main id="main-content" className="studio-main">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError('')}
              >
                <IconX size={16} />
              </button>
            </div>
          )}
          {message && (
            <div className="alert alert-success" role="status">
              {message}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setMessage('')}
              >
                <IconX size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">Loading the editorial studio…</div>
          ) : (
            <>
              {!active && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="kicker">YOUR EDITORIAL WORKSPACE</span>
                      <h1>A new chapter starts here.</h1>
                      <p>
                        Thoughtful stories. Trusted references. One place to
                        bring them together.
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => setCreating(true)}
                    >
                      <IconPlus size={18} /> Create content
                    </button>
                  </div>
                  <section className="welcome-banner">
                    <div>
                      <span className="banner-tag">MAJESTIC INDUS</span>
                      <h2>
                        Give Pakistan’s stories
                        <br />a place to shine.
                      </h2>
                      <p>
                        Write with care. Review with confidence.
                        <br />
                        Publish a story worth discovering.
                      </p>
                      <button
                        className="btn btn-light"
                        onClick={() => nav('content')}
                      >
                        Explore content library <IconArrowUpRight size={18} />
                      </button>
                    </div>
                    <Image
                      src="/hunza-illustration.svg"
                      width={1400}
                      height={760}
                      alt="Illustrated mountains and a lake"
                      priority
                    />
                  </section>
                  <section
                    className="metric-grid"
                    aria-label="Content overview"
                  >
                    {[
                      [
                        'Total content',
                        docs.length,
                        'Across your editorial library',
                      ],
                      [
                        'Drafts',
                        docs.filter((d) => d.currentRevision.status === 'DRAFT')
                          .length,
                        'Ideas taking shape',
                      ],
                      [
                        'Awaiting review',
                        review.length,
                        'Ready for a second perspective',
                      ],
                      [
                        'Live stories',
                        docs.filter((d) => d.publishedRevision).length,
                        'Published website snapshots',
                      ],
                    ].map(([label, value, note], i) => (
                      <div className="metric-card" key={label}>
                        <span className={`metric-symbol metric-${i}`}>
                          <IconFileText size={20} />
                        </span>
                        <span>{label}</span>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </div>
                    ))}
                  </section>
                  <div className="overview-grid">
                    <section className="studio-card">
                      <div className="card-heading">
                        <div>
                          <h3>Recently updated</h3>
                          <p>The latest work from your editorial desk.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => nav('content')}
                        >
                          View all <IconArrowUpRight size={16} />
                        </button>
                      </div>
                      <ContentTable docs={docs.slice(0, 5)} />
                    </section>
                    <section className="studio-card brand-card">
                      <span className="kicker">
                        THE VISITSPAKISTAN STANDARD
                      </span>
                      <h3>
                        A beautiful story begins
                        <br />
                        with a trusted source.
                      </h3>
                      <p>
                        Reference the canonical entity. Credit your media. Keep
                        verification dates current.
                      </p>
                      <div className="brand-colors">
                        {[
                          brandTokens.primary,
                          brandTokens.secondary,
                          brandTokens.tertiary,
                          brandTokens.neutral,
                        ].map((c) => (
                          <span key={c} style={{ background: c }} />
                        ))}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => nav('themes')}
                      >
                        Explore your brand system <IconArrowUpRight size={17} />
                      </button>
                    </section>
                  </div>
                </>
              )}
              {(active === 'content' || active === 'review') && !editId && (
                <>
                  <Heading
                    kicker={
                      active === 'review'
                        ? 'QUALITY & PUBLISHING'
                        : 'EDITORIAL CONTENT'
                    }
                    title={
                      active === 'review'
                        ? 'A fresh pair of eyes.'
                        : 'Your content, beautifully connected.'
                    }
                    description={
                      active === 'review'
                        ? 'Review submissions, verify sources and prepare approved stories for publication.'
                        : 'Manage every editorial family without duplicating canonical travel facts.'
                    }
                    action={
                      <button
                        className="btn btn-primary"
                        onClick={() => setCreating(true)}
                      >
                        <IconPlus size={18} /> Create content
                      </button>
                    }
                  />
                  <div className="filter-bar">
                    <label className="search-field">
                      <IconSearch size={18} />
                      <input
                        aria-label="Search content"
                        placeholder="Search titles or slugs…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <select
                      className="form-select"
                      aria-label="Filter editorial type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="all">All content types</option>
                      {editorialTypes.map((t) => (
                        <option key={t} value={t}>
                          {typeLabels[t]}
                        </option>
                      ))}
                    </select>
                    <span>{filtered.length} items</span>
                  </div>
                  <section className="studio-card">
                    <ContentTable docs={filtered} />
                  </section>
                  <div className="family-grid">
                    {editorialTypes.map((t) => (
                      <button
                        key={t}
                        className="family-card"
                        onClick={() => setType(t)}
                      >
                        <IconFileText size={21} />
                        <strong>{typeLabels[t]}</strong>
                        <span>
                          {docs.filter((d) => d.contentItem.type === t).length}{' '}
                          content items <IconArrowUpRight size={16} />
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {active === 'content' &&
                editId &&
                (current ? (
                  <Editor
                    key={`${current.id}-${current.version}`}
                    doc={current}
                    sources={sources}
                    entities={entities}
                    media={media}
                    actor={actor}
                    onChanged={changed}
                    onError={setError}
                  />
                ) : (
                  <section className="studio-card empty-state">
                    <h2>Content unavailable</h2>
                    <Link href="/content/">Back to library</Link>
                  </section>
                ))}
              {active === 'canonical' && (
                <>
                  <Heading
                    kicker="CANONICAL KNOWLEDGE GRAPH"
                    title="The facts behind every story."
                    description="These entities are read-only references. Geography and structured facts remain owned by their domain modules."
                  />
                  <section className="studio-card table-wrap">
                    <table className="studio-table">
                      <thead>
                        <tr>
                          <th>Entity</th>
                          <th>Type</th>
                          <th>Publication</th>
                          <th>Canonical UUID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entities.map((e) => (
                          <tr key={e.id}>
                            <td>
                              <strong>{e.name}</strong>
                              <small>/{e.slug}/</small>
                            </td>
                            <td>{e.geoEntity?.type ?? e.kind}</td>
                            <td>
                              <Status value={e.status} />
                            </td>
                            <td>
                              <code>{e.id}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
              {active === 'sources' && (
                <>
                  <Heading
                    kicker="PROVENANCE"
                    title="Every story has a source."
                    description="Keep evidence explicit. A source record is a reference, not automatic verification of a fact."
                  />
                  <div className="resource-grid">
                    <section className="studio-card">
                      <div className="card-heading">
                        <h3>Source records</h3>
                        <span>{sources.length} references</span>
                      </div>
                      {sources.map((s) => (
                        <div className="source-row" key={s.id}>
                          <IconBook2 size={22} />
                          <div>
                            <strong>{s.title}</strong>
                            <small>{s.sourceType.replaceAll('_', ' ')}</small>
                            {s.url && (
                              <a href={s.url} target="_blank" rel="noreferrer">
                                View source <IconExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </section>
                    {actor.roles.includes('EDITOR') && (
                      <SourceForm
                        onSave={(body) =>
                          perform(() => api('sources', body), 'Source added')
                        }
                      />
                    )}
                  </div>
                </>
              )}
              {active === 'media' && (
                <>
                  <Heading
                    kicker="MEDIA & ATTRIBUTION"
                    title="Make room for the visual story."
                    description="Rights-cleared images, descriptive alt text and clear credits. Static JPEG, PNG and WebP; up to 8 MB."
                  />
                  <MediaUpload
                    onUpload={(body) =>
                      perform(
                        () => api('media', body),
                        'Image uploaded and optimized',
                      )
                    }
                  />
                  <div className="media-grid">
                    {media.map((m) => (
                      <article className="studio-card media-card" key={m.id}>
                        <Image
                          src={`/cms-api/media/${m.id}/content/`}
                          alt={m.alt}
                          width={m.width}
                          height={m.height}
                          unoptimized
                        />
                        <div>
                          <strong>{m.alt}</strong>
                          <small>
                            {m.width} × {m.height} · WebP
                          </small>
                          <p>{m.credit}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {active === 'themes' && (
                <>
                  <Heading
                    kicker="BRAND SYSTEM"
                    title="A signature that feels like Pakistan."
                    description="Manage accessible brand tokens and logo media. Activate your theme through website presentation settings."
                  />
                  <ThemeManager
                    themes={themes}
                    media={media}
                    activeId={presentation.settings?.themeId}
                    onSave={(body) =>
                      perform(() => api('themes', body), 'Theme saved')
                    }
                    onActivate={(id) =>
                      perform(
                        () =>
                          api('presentation', {
                            themeId: id,
                            expectedVersion: presentation.settings?.version,
                            assignments: presentation.assignments.map((a) => ({
                              type: a.type,
                              templateId: a.templateId,
                            })),
                          }),
                        'Website theme activated',
                      )
                    }
                    canManage={actor.roles.includes('ADMINISTRATOR')}
                  />
                </>
              )}
              {active === 'templates' && (
                <>
                  <Heading
                    kicker="WEBSITE PRESENTATION"
                    title="The right frame for every story."
                    description="Choose a layout and the story elements each content family can use."
                  />
                  <TemplateManager
                    templates={templates}
                    presentation={presentation}
                    onSave={(body) =>
                      perform(() => api('templates', body), 'Template saved')
                    }
                    onApply={(assignments) =>
                      perform(
                        () =>
                          api('presentation', {
                            themeId: presentation.settings?.themeId,
                            expectedVersion: presentation.settings?.version,
                            assignments,
                          }),
                        'Website templates activated',
                      )
                    }
                    canManage={actor.roles.includes('ADMINISTRATOR')}
                  />
                </>
              )}
            </>
          )}
        </main>
        <footer className="studio-footer">
          <span>VisitsPakistan Editorial Studio</span>
          <span>Powered by open-source Tabler · Majestic Indus</span>
        </footer>
      </div>
      {creating && (
        <CreateDialog
          entities={entities}
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            try {
              const doc = await api<Doc>('content', input);
              setCreating(false);
              await load();
              router.push(`/content/${doc.id}/`);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Unable to create content',
              );
            }
          }}
        />
      )}
    </div>
  );
}
function Heading({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function ContentTable({ docs }: { docs: Doc[] }) {
  return docs.length ? (
    <div className="table-wrap">
      <table className="studio-table">
        <thead>
          <tr>
            <th>Content</th>
            <th>Status</th>
            <th>Author</th>
            <th>Updated</th>
            <th>
              <span className="visually-hidden">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td>
                <Link className="title-button" href={`/content/${d.id}/`}>
                  {d.currentRevision.title}
                </Link>
                <small>
                  {typeLabels[d.contentItem.type] ?? d.contentItem.type} ·
                  Revision {d.currentRevision.number}
                </small>
              </td>
              <td>
                <Status value={d.currentRevision.status} />
              </td>
              <td>{d.currentRevision.author.displayName}</td>
              <td>{date(d.currentRevision.updatedAt)}</td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`Open ${d.currentRevision.title}`}
                  href={`/content/${d.id}/`}
                >
                  <IconArrowUpRight size={19} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty-state">
      <IconFileText size={36} />
      <h3>A blank page, full of possibility.</h3>
      <p>Create your first draft or adjust the filters.</p>
    </div>
  );
}
function CreateDialog({
  entities,
  onClose,
  onCreate,
}: {
  entities: Canonical[];
  onClose: () => void;
  onCreate: (body: unknown) => Promise<void>;
}) {
  const [type, setType] = useState<EditorialType>('DESTINATION_EDITORIAL');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const title = String(form.get('title'));
    const primary = String(form.get('primary')) || null;
    await onCreate({
      type,
      slug: form.get('slug'),
      locale: 'en',
      primaryEntityId: primary,
      body: {
        title,
        summary: '',
        seoTitle: title.slice(0, 70),
        metaDescription: '',
        blocks: [],
        sourceIds: [],
        canonicalIds: primary ? [primary] : [],
        heroMediaId: null,
        lastVerified: null,
      },
    });
    setBusy(false);
  }
  return (
    <div className="dialog-backdrop">
      <section
        className="studio-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (event.key === 'Escape') {
            onClose();
            return;
          }
          if (event.key === 'Tab') {
            const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]',
            );
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <button
          className="dialog-close icon-button"
          aria-label="Close create dialog"
          onClick={onClose}
        >
          <IconX />
        </button>
        <span className="kicker">A NEW CHAPTER</span>
        <h2 id="create-title">Create editorial content</h2>
        <form onSubmit={submit}>
          <label className="form-label">
            Content family
            <select
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as EditorialType)}
            >
              {editorialTypes.map((t) => (
                <option key={t} value={t}>
                  {typeLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Working title
            <input
              autoFocus
              className="form-control"
              name="title"
              minLength={3}
              maxLength={180}
              required
            />
          </label>
          <label className="form-label">
            Canonical URL slug
            <input
              className="form-control"
              name="slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              placeholder="hunza-travel-story"
            />
          </label>
          <label className="form-label">
            Primary canonical entity
            <select
              className="form-select"
              name="primary"
              required={
                type === 'DESTINATION_EDITORIAL' ||
                type === 'ATTRACTION_EDITORIAL'
              }
            >
              <option value="">No primary entity</option>
              {entities
                .filter((e) =>
                  type === 'DESTINATION_EDITORIAL'
                    ? e.geoEntity?.type === 'DESTINATION'
                    : type === 'ATTRACTION_EDITORIAL'
                      ? e.kind === 'PLACE'
                      : true,
                )
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="muted-note">
            Canonical names and structured facts remain in the knowledge graph.
          </p>
          <button className="btn btn-primary w-100" disabled={busy}>
            {busy ? 'Creating…' : 'Create draft'}
            <IconPlus size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
function revisionBody(r: Revision): EditorialBody {
  return {
    title: r.title,
    summary: r.summary,
    seoTitle: r.seoTitle,
    metaDescription: r.metaDescription,
    blocks: r.blocks,
    sourceIds: r.sources.map((s) => s.sourceId),
    canonicalIds: r.references.map((x) => x.entityId),
    heroMediaId: r.heroMediaId,
    lastVerified: r.lastVerified,
  };
}
function Editor({
  doc,
  sources,
  entities,
  media,
  actor,
  onChanged,
  onError,
}: {
  doc: Doc;
  sources: Source[];
  entities: Canonical[];
  media: Media[];
  actor: CmsActor;
  onChanged: (note: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const r = doc.currentRevision;
  const [body, setBody] = useState<EditorialBody>(revisionBody(r));
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const editable =
    r.status === 'DRAFT' &&
    (actor.roles.includes('EDITOR') ||
      (actor.id === r.authorId && actor.roles.includes('CONTRIBUTOR')));
  const update = <K extends keyof EditorialBody>(
    key: K,
    value: EditorialBody[K],
  ) => setBody({ ...body, [key]: value });
  async function execute(action?: string) {
    setBusy(true);
    try {
      let version = doc.version;
      if (editable && (action === 'submit' || !action)) {
        const saved = await api<Doc>(
          `content/${doc.id}`,
          { expectedVersion: version, body },
          'PUT',
        );
        version = saved.version;
      }
      if (action)
        await api(`content/${doc.id}/actions`, {
          expectedVersion: version,
          action,
        });
      await onChanged(
        action ? `Editorial action completed: ${action}` : 'Draft saved',
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/content/" className="back-link">
        <IconArrowLeft size={17} /> Content library
      </Link>
      <div className="editor-heading">
        <div>
          <span className="kicker">
            {typeLabels[doc.contentItem.type]} · REVISION {r.number}
          </span>
          <h1>{r.title}</h1>
          <div className="editor-meta">
            <Status value={r.status} />
            <span>By {r.author.displayName}</span>
            <span>
              <IconClock size={14} /> {date(r.updatedAt)}
            </span>
          </div>
        </div>
        <div className="editor-actions">
          {editable && (
            <>
              <button
                className="btn btn-outline-secondary"
                onClick={() => execute()}
                disabled={busy}
              >
                <IconDeviceFloppy size={17} /> Save draft
              </button>
              <button
                className="btn btn-primary"
                onClick={() => execute('submit')}
                disabled={busy}
              >
                <IconSend size={17} /> Submit for review
              </button>
            </>
          )}
          {r.status === 'REVIEW' && actor.roles.includes('EDITOR') && (
            <>
              <button
                className="btn btn-outline-secondary"
                disabled={busy}
                onClick={() => execute('return')}
              >
                Return to draft
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || actor.id === r.authorId}
                onClick={() => execute('approve')}
              >
                <IconCheck size={18} /> Approve revision
              </button>
            </>
          )}
          {r.status === 'APPROVED' && actor.roles.includes('EDITOR') && (
            <>
              <button
                className="btn btn-outline-secondary"
                disabled={busy}
                onClick={() => execute('return')}
              >
                Return to draft
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => execute('publish')}
              >
                <IconWorld size={18} /> Publish
              </button>
            </>
          )}
          {r.status === 'PUBLISHED' && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => execute('new-draft')}
            >
              <IconPlus size={18} /> New draft
            </button>
          )}
          {doc.publishedRevision && actor.roles.includes('EDITOR') && (
            <button
              className="btn btn-outline-danger"
              disabled={busy}
              onClick={() => execute('withdraw')}
            >
              Withdraw
            </button>
          )}
        </div>
      </div>
      {doc.publishedRevision && r.status !== 'PUBLISHED' && (
        <p className="alert alert-info">
          Revision {doc.publishedRevision.number} remains live while this draft
          is prepared.
        </p>
      )}
      <div className="editor-grid">
        <section className="studio-card editor-canvas">
          <div className="canvas-tabs">
            <button
              className={!preview ? 'active' : ''}
              onClick={() => setPreview(false)}
            >
              Write
            </button>
            <button
              className={preview ? 'active' : ''}
              onClick={() => setPreview(true)}
            >
              Preview
            </button>
            <span>/{doc.contentItem.entity.slug}/</span>
          </div>
          {preview ? (
            <article className="editor-preview">
              <span className="kicker">{typeLabels[doc.contentItem.type]}</span>
              <h2>{body.title}</h2>
              <p className="lead">{body.summary}</p>
              {body.heroMediaId &&
                media.find((m) => m.id === body.heroMediaId) && (
                  <Image
                    src={`/cms-api/media/${body.heroMediaId}/content/`}
                    alt={media.find((m) => m.id === body.heroMediaId)!.alt}
                    width={1400}
                    height={760}
                    unoptimized
                  />
                )}
              <PreviewBlocks blocks={body.blocks} media={media} />
            </article>
          ) : (
            <div className="canvas-fields">
              <label className="form-label">
                Editorial title
                <input
                  className="form-control title-input"
                  value={body.title}
                  disabled={!editable}
                  onChange={(e) => update('title', e.target.value)}
                  maxLength={180}
                />
              </label>
              <label className="form-label">
                Introduction
                <textarea
                  className="form-control"
                  rows={3}
                  value={body.summary}
                  disabled={!editable}
                  onChange={(e) => update('summary', e.target.value)}
                  maxLength={400}
                />
              </label>
              <div className="block-heading">
                <h3>Story blocks</h3>
                <span>{body.blocks.length} blocks</span>
              </div>
              {body.blocks.map((b, i) => (
                <div className="content-block" key={i}>
                  <div className="block-toolbar">
                    <span>
                      {i + 1} · {b.type.replaceAll('_', ' ')}
                    </span>
                    {editable && (
                      <div>
                        <button
                          className="icon-button"
                          aria-label={`Move block ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() => {
                            const next = [...body.blocks];
                            [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                            update('blocks', next);
                          }}
                        >
                          <IconArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Move block ${i + 1} down`}
                          disabled={i === body.blocks.length - 1}
                          onClick={() => {
                            const next = [...body.blocks];
                            [next[i + 1], next[i]] = [next[i]!, next[i + 1]!];
                            update('blocks', next);
                          }}
                        >
                          <IconArrowDown size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Remove block ${i + 1}`}
                          onClick={() =>
                            update(
                              'blocks',
                              body.blocks.filter((_, n) => n !== i),
                            )
                          }
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <BlockField
                    block={b}
                    disabled={!editable}
                    media={media}
                    entities={entities}
                    onChange={(value) =>
                      update(
                        'blocks',
                        body.blocks.map((old, n) => (n === i ? value : old)),
                      )
                    }
                  />
                </div>
              ))}
              {editable && (
                <div className="block-adder">
                  <label className="form-label">
                    Add a structured block
                    <select
                      className="form-select"
                      value=""
                      onChange={(e) => {
                        const t = e.target.value;
                        const b: ContentBlock =
                          t === 'heading'
                            ? { type: 'heading', text: 'New section', level: 2 }
                            : t === 'list'
                              ? { type: 'list', items: ['New list item'] }
                              : t === 'callout'
                                ? {
                                    type: 'callout',
                                    text: 'Editor note',
                                    tone: 'note',
                                  }
                                : t === 'quote'
                                  ? {
                                      type: 'quote',
                                      text: 'Add a sourced quotation',
                                      attribution: 'Source attribution',
                                    }
                                  : t === 'image'
                                    ? {
                                        type: 'image',
                                        mediaId: media[0]?.id ?? '',
                                        caption: '',
                                      }
                                    : t === 'entity_reference'
                                      ? {
                                          type: 'entity_reference',
                                          entityId: entities[0]?.id ?? '',
                                          label: 'Canonical reference',
                                        }
                                      : {
                                          type: 'paragraph',
                                          text: 'Write your story here.',
                                        };
                        update('blocks', [...body.blocks, b]);
                      }}
                    >
                      <option value="" disabled>
                        Choose block type…
                      </option>
                      {blockTypes.map((t) => (
                        <option key={t} value={t}>
                          {t.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="muted-note">
                    Build your story with text, images and trusted references.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
        <aside className="editor-inspector">
          <Inspector title="Publication details">
            <dl>
              <dt>Author</dt>
              <dd>{r.author.displayName}</dd>
              <dt>Reviewer</dt>
              <dd>
                {r.reviewer?.displayName ?? 'Awaiting independent review'}
              </dd>
              <dt>First published</dt>
              <dd>
                {doc.firstPublishedAt
                  ? date(doc.firstPublishedAt)
                  : 'Not published'}
              </dd>
              <dt>Last updated</dt>
              <dd>{date(r.updatedAt)}</dd>
            </dl>
            <label className="form-label">
              Last verified
              <input
                className="form-control"
                type="date"
                disabled={!editable}
                value={body.lastVerified?.slice(0, 10) ?? ''}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) =>
                  update(
                    'lastVerified',
                    e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
                  )
                }
              />
            </label>
          </Inspector>
          <Inspector title="Hero media">
            <select
              className="form-select"
              aria-label="Hero media"
              disabled={!editable}
              value={body.heroMediaId ?? ''}
              onChange={(e) => update('heroMediaId', e.target.value || null)}
            >
              <option value="">Choose hero image…</option>
              {media.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.alt}
                </option>
              ))}
            </select>
            {body.heroMediaId && (
              <Image
                className="inspector-image"
                src={`/cms-api/media/${body.heroMediaId}/content/`}
                width={400}
                height={240}
                alt="Selected hero preview"
                unoptimized
              />
            )}
            <Link href="/media/" className="text-button">
              Manage media <IconArrowUpRight size={15} />
            </Link>
          </Inspector>
          <Inspector title="SEO & discovery">
            <label className="form-label">
              SEO title
              <input
                className="form-control"
                disabled={!editable}
                value={body.seoTitle}
                maxLength={70}
                onChange={(e) => update('seoTitle', e.target.value)}
              />
              <small>{body.seoTitle.length}/70 characters</small>
            </label>
            <label className="form-label">
              Meta description
              <textarea
                className="form-control"
                disabled={!editable}
                value={body.metaDescription}
                maxLength={180}
                rows={3}
                onChange={(e) => update('metaDescription', e.target.value)}
              />
              <small>{body.metaDescription.length}/180 characters</small>
            </label>
            <div className="search-preview">
              <small>
                visitspakistan.com › content › {doc.contentItem.entity.slug}
              </small>
              <strong>{body.seoTitle || body.title}</strong>
              <p>
                {body.metaDescription ||
                  'Add a useful summary for search discovery.'}
              </p>
            </div>
          </Inspector>
          <Inspector title="Source records">
            {sources.map((s) => (
              <label key={s.id} className="check-row">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={body.sourceIds.includes(s.id)}
                  onChange={(e) =>
                    update(
                      'sourceIds',
                      e.target.checked
                        ? [...body.sourceIds, s.id]
                        : body.sourceIds.filter((id) => id !== s.id),
                    )
                  }
                />
                <span>
                  {s.title}
                  <small>{s.sourceType.replaceAll('_', ' ')}</small>
                </span>
              </label>
            ))}
          </Inspector>
          <Inspector title="Canonical references">
            {entities.map((e) => (
              <label key={e.id} className="check-row">
                <input
                  type="checkbox"
                  disabled={
                    !editable || e.id === doc.contentItem.primaryEntityId
                  }
                  checked={
                    body.canonicalIds.includes(e.id) ||
                    e.id === doc.contentItem.primaryEntityId
                  }
                  onChange={(ev) =>
                    update(
                      'canonicalIds',
                      ev.target.checked
                        ? [...body.canonicalIds, e.id]
                        : body.canonicalIds.filter((id) => id !== e.id),
                    )
                  }
                />
                <span>
                  {e.name}
                  <small>
                    {e.kind} · {e.status.toLowerCase()}
                  </small>
                </span>
              </label>
            ))}
            <p className="muted-note">
              Published editorial references only independently published
              canonical entities.
            </p>
          </Inspector>
        </aside>
      </div>
    </>
  );
}
function Inspector({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="studio-card inspector-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function BlockField({
  block: b,
  disabled,
  media,
  entities,
  onChange,
}: {
  block: ContentBlock;
  disabled: boolean;
  media: Media[];
  entities: Canonical[];
  onChange: (b: ContentBlock) => void;
}) {
  if (b.type === 'list')
    return (
      <textarea
        aria-label="List items, one per line"
        className="form-control"
        disabled={disabled}
        value={b.items.join('\n')}
        rows={4}
        onChange={(e) => onChange({ ...b, items: e.target.value.split('\n') })}
      />
    );
  if (b.type === 'image')
    return (
      <>
        <select
          aria-label="Block image"
          className="form-select"
          disabled={disabled}
          value={b.mediaId}
          onChange={(e) => onChange({ ...b, mediaId: e.target.value })}
        >
          <option value="">Choose image</option>
          {media.map((m) => (
            <option key={m.id} value={m.id}>
              {m.alt}
            </option>
          ))}
        </select>
        <input
          aria-label="Image caption"
          placeholder="Caption"
          className="form-control mt-2"
          disabled={disabled}
          value={b.caption}
          onChange={(e) => onChange({ ...b, caption: e.target.value })}
        />
      </>
    );
  if (b.type === 'entity_reference')
    return (
      <>
        <select
          aria-label="Canonical block entity"
          className="form-select"
          disabled={disabled}
          value={b.entityId}
          onChange={(e) => onChange({ ...b, entityId: e.target.value })}
        >
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Reference label"
          className="form-control mt-2"
          disabled={disabled}
          value={b.label}
          onChange={(e) => onChange({ ...b, label: e.target.value })}
        />
      </>
    );
  return (
    <>
      <textarea
        aria-label={`${b.type} text`}
        className="form-control"
        rows={b.type === 'heading' ? 1 : 4}
        disabled={disabled}
        value={b.text}
        onChange={(e) => onChange({ ...b, text: e.target.value })}
      />
      {b.type === 'quote' && (
        <input
          aria-label="Quotation attribution"
          className="form-control mt-2"
          disabled={disabled}
          value={b.attribution}
          onChange={(e) => onChange({ ...b, attribution: e.target.value })}
        />
      )}
    </>
  );
}
export function PreviewBlocks({
  blocks,
  media,
}: {
  blocks: ContentBlock[];
  media: Media[];
}) {
  return blocks.map((b, i) =>
    b.type === 'heading' ? (
      b.level === 2 ? (
        <h2 key={i}>{b.text}</h2>
      ) : (
        <h3 key={i}>{b.text}</h3>
      )
    ) : b.type === 'paragraph' ? (
      <p key={i}>{b.text}</p>
    ) : b.type === 'list' ? (
      <ul key={i}>
        {b.items.map((item, n) => (
          <li key={n}>{item}</li>
        ))}
      </ul>
    ) : b.type === 'callout' ? (
      <aside key={i} className="story-callout">
        {b.text}
      </aside>
    ) : b.type === 'quote' ? (
      <blockquote key={i}>
        {b.text}
        <cite>{b.attribution}</cite>
      </blockquote>
    ) : b.type === 'entity_reference' ? (
      <div key={i} className="entity-link">
        <IconMap2 size={20} />
        {b.label}
        <small>Canonical UUID: {b.entityId}</small>
      </div>
    ) : (
      <figure key={i}>
        {media.find((m) => m.id === b.mediaId) && (
          <Image
            src={`/cms-api/media/${b.mediaId}/content/`}
            width={1400}
            height={760}
            alt={media.find((m) => m.id === b.mediaId)!.alt}
            unoptimized
          />
        )}
        <figcaption>{b.caption}</figcaption>
      </figure>
    ),
  );
}
function SourceForm({ onSave }: { onSave: (body: unknown) => Promise<void> }) {
  return (
    <section className="studio-card form-card">
      <h3>Add a source record</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          await onSave({
            ...values,
            accessedAt: new Date(String(values.accessedAt)).toISOString(),
          });
        }}
      >
        <label className="form-label">
          Title
          <input className="form-control" name="title" required minLength={3} />
        </label>
        <label className="form-label">
          Source URL
          <input className="form-control" type="url" name="url" required />
        </label>
        <label className="form-label">
          Publisher
          <input
            className="form-control"
            name="publisher"
            required
            minLength={2}
          />
        </label>
        <label className="form-label">
          Accessed on
          <input
            className="form-control"
            type="date"
            name="accessedAt"
            required
          />
        </label>
        <label className="form-label">
          Source category
          <select className="form-select" name="sourceType">
            {['OFFICIAL', 'EDITORIAL', 'FIELD_OBSERVATION', 'DATASET'].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </label>
        <button className="btn btn-primary">
          Add source <IconPlus size={17} />
        </button>
      </form>
    </section>
  );
}
function MediaUpload({
  onUpload,
}: {
  onUpload: (body: FormData) => Promise<void>;
}) {
  return (
    <section className="studio-card form-card media-upload">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onUpload(new FormData(e.currentTarget));
        }}
      >
        <div>
          <label className="form-label">
            Image
            <input
              className="form-control"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <label className="form-label">
            Descriptive alt text
            <input
              className="form-control"
              name="alt"
              required
              maxLength={300}
            />
          </label>
          <label className="form-label">
            Credit / licence attribution
            <input
              className="form-control"
              name="credit"
              required
              maxLength={300}
            />
          </label>
        </div>
        <label className="check-row">
          <input type="checkbox" name="rightsConfirmed" value="true" required />
          I confirm VisitsPakistan has permission to use this image.
        </label>
        <button className="btn btn-primary">
          <IconPhoto size={18} /> Upload image
        </button>
      </form>
    </section>
  );
}
function ThemeManager({
  themes,
  media,
  activeId,
  onSave,
  onActivate,
  canManage,
}: {
  themes: Theme[];
  media: Media[];
  activeId?: string;
  onSave: (body: unknown) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  canManage: boolean;
}) {
  const [selected, setSelected] = useState(themes[0]?.id ?? 'new');
  const current = themes.find((t) => t.id === selected);
  return (
    <>
      <div className="theme-gallery">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`studio-card theme-preview ${selected === t.id ? 'selected' : ''}`}
          >
            <div
              className="theme-mini"
              style={{ background: t.tokens.primary }}
            >
              <span>VisitsPakistan</span>
              <h3>A place to discover.</h3>
              <i style={{ background: t.tokens.secondary }} />
            </div>
            <div className="theme-card-label">
              <strong>{t.name}</strong>
              <span>
                {t.id === activeId ? 'Active theme' : `Version ${t.version}`}
              </span>
            </div>
          </button>
        ))}
        {canManage && (
          <button
            className="studio-card new-theme"
            onClick={() => setSelected('new')}
          >
            <IconPlus size={28} />
            <strong>Create a theme</strong>
            <small>Start from Majestic Indus</small>
          </button>
        )}
      </div>
      <ThemeForm
        key={selected + String(current?.version)}
        current={current}
        media={media}
        onSave={onSave}
        canManage={canManage}
      />
      {current && canManage && (
        <button
          className="btn btn-primary mt-3"
          disabled={current.id === activeId}
          onClick={() => onActivate(current.id)}
        >
          <IconWorld size={18} /> Apply to website
        </button>
      )}
    </>
  );
}
function ThemeForm({
  current,
  media,
  onSave,
  canManage,
}: {
  current?: Theme;
  media: Media[];
  onSave: (body: unknown) => Promise<void>;
  canManage: boolean;
}) {
  const [tokens, setTokens] = useState(current?.tokens ?? brandTokens);
  return (
    <section className="studio-card form-card">
      <h3>{current ? 'Theme settings' : 'New theme'}</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await onSave({
            ...(current
              ? { id: current.id, expectedVersion: current.version }
              : {}),
            name: f.get('name'),
            slug: f.get('slug'),
            tokens,
            logoMediaId: f.get('logoMediaId') || null,
          });
        }}
      >
        <div className="two-columns">
          <label className="form-label">
            Theme name
            <input
              className="form-control"
              name="name"
              defaultValue={current?.name ?? 'My Majestic Indus'}
              disabled={!canManage}
              required
              minLength={3}
            />
          </label>
          <label className="form-label">
            Slug
            <input
              className="form-control"
              name="slug"
              defaultValue={current?.slug ?? 'my-majestic-indus'}
              disabled={!canManage}
              required
              pattern="[a-z0-9-]+"
            />
          </label>
        </div>
        <div className="color-fields">
          {(['primary', 'secondary', 'tertiary', 'neutral'] as const).map(
            (k) => (
              <label className="form-label" key={k}>
                {k}
                <span>
                  <input
                    type="color"
                    aria-label={`${k} brand colour`}
                    disabled={!canManage}
                    value={tokens[k]}
                    onChange={(e) =>
                      setTokens({ ...tokens, [k]: e.target.value })
                    }
                  />
                  <code>{tokens[k]}</code>
                </span>
              </label>
            ),
          )}
        </div>
        <div className="two-columns">
          <label className="form-label">
            Heading typeface
            <select
              className="form-select"
              disabled={!canManage}
              value={tokens.headingFont}
              onChange={(e) =>
                setTokens({
                  ...tokens,
                  headingFont: e.target.value as ThemeTokens['headingFont'],
                })
              }
            >
              <option>Playfair Display</option>
              <option>Plus Jakarta Sans</option>
            </select>
          </label>
          <label className="form-label">
            Body typeface
            <input
              className="form-control"
              value="Plus Jakarta Sans"
              disabled
            />
          </label>
          <label className="form-label">
            Corner radius
            <input
              className="form-control"
              type="number"
              min={0}
              max={24}
              value={tokens.radius}
              disabled={!canManage}
              onChange={(e) =>
                setTokens({ ...tokens, radius: Number(e.target.value) })
              }
            />
          </label>
          <label className="form-label">
            Content width
            <input
              className="form-control"
              type="number"
              min={960}
              max={1440}
              value={tokens.contentWidth}
              disabled={!canManage}
              onChange={(e) =>
                setTokens({ ...tokens, contentWidth: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label className="form-label">
          Logo image
          <select
            className="form-select"
            name="logoMediaId"
            defaultValue={current?.logoMediaId ?? ''}
            disabled={!canManage}
          >
            <option value="">Baseline VisitsPakistan vector mark</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.alt}
              </option>
            ))}
          </select>
        </label>
        <p className="muted-note">
          Primary buttons and neutral text require 4.5:1 contrast. Tokens are
          applied by the public website renderer.
        </p>
        {canManage && (
          <button className="btn btn-primary">
            <IconDeviceFloppy size={17} /> Save theme
          </button>
        )}
      </form>
    </section>
  );
}
function TemplateManager({
  templates,
  presentation,
  onSave,
  onApply,
  canManage,
}: {
  templates: Template[];
  presentation: Presentation;
  onSave: (body: unknown) => Promise<void>;
  onApply: (a: Presentation['assignments']) => Promise<void>;
  canManage: boolean;
}) {
  const [selected, setSelected] = useState(templates[0]?.id ?? 'new');
  const [assignments, setAssignments] = useState(
    presentation.assignments.map((a) => ({
      type: a.type,
      templateId: a.templateId,
    })),
  );
  const current = templates.find((t) => t.id === selected);
  return (
    <>
      <div className="template-gallery">
        {templates.map((t) => (
          <button
            key={t.id}
            className={`studio-card template-preview ${selected === t.id ? 'selected' : ''}`}
            onClick={() => setSelected(t.id)}
          >
            <div className={`template-wireframe ${t.layout.toLowerCase()}`}>
              <i />
              <span />
              <b />
              <b />
              <b />
            </div>
            <strong>{t.name}</strong>
            <small>
              {t.layout.toLowerCase()} · {t.allowedBlocks.length} block types
            </small>
          </button>
        ))}
        {canManage && (
          <button
            className="studio-card new-theme"
            onClick={() => setSelected('new')}
          >
            <IconPlus size={28} />
            <strong>Create template</strong>
          </button>
        )}
      </div>
      <div className="resource-grid">
        <TemplateForm
          key={selected + String(current?.version)}
          current={current}
          onSave={onSave}
          canManage={canManage}
        />
        <section className="studio-card form-card">
          <h3>Content family assignments</h3>
          <p className="muted-note">
            A template change cannot remove blocks used by already published
            stories.
          </p>
          {editorialTypes.map((type) => (
            <label className="form-label" key={type}>
              {typeLabels[type]}
              <select
                className="form-select"
                disabled={!canManage}
                value={
                  assignments.find((a) => a.type === type)?.templateId ?? ''
                }
                onChange={(e) =>
                  setAssignments([
                    ...assignments.filter((a) => a.type !== type),
                    { type, templateId: e.target.value },
                  ])
                }
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {canManage && (
            <button
              className="btn btn-primary"
              onClick={() => onApply(assignments)}
            >
              <IconWorld size={18} /> Apply website templates
            </button>
          )}
        </section>
      </div>
    </>
  );
}
function TemplateForm({
  current,
  onSave,
  canManage,
}: {
  current?: Template;
  onSave: (body: unknown) => Promise<void>;
  canManage: boolean;
}) {
  const [allowed, setAllowed] = useState(
    current?.allowedBlocks ?? [...blockTypes],
  );
  return (
    <section className="studio-card form-card">
      <h3>{current ? 'Template settings' : 'New template'}</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await onSave({
            ...(current
              ? { id: current.id, expectedVersion: current.version }
              : {}),
            name: f.get('name'),
            slug: f.get('slug'),
            layout: f.get('layout'),
            allowedBlocks: allowed,
          });
        }}
      >
        <label className="form-label">
          Name
          <input
            className="form-control"
            name="name"
            defaultValue={current?.name ?? 'New editorial layout'}
            disabled={!canManage}
            required
          />
        </label>
        <label className="form-label">
          Slug
          <input
            className="form-control"
            name="slug"
            defaultValue={current?.slug ?? 'new-editorial-layout'}
            disabled={!canManage}
            required
            pattern="[a-z0-9-]+"
          />
        </label>
        <label className="form-label">
          Renderer layout
          <select
            className="form-select"
            name="layout"
            defaultValue={current?.layout ?? 'EDITORIAL'}
            disabled={!canManage}
          >
            <option value="EDITORIAL">Editorial journal</option>
            <option value="MAGAZINE">Discovery magazine</option>
            <option value="COMPACT">Field guide</option>
          </select>
        </label>
        <span className="form-label">Supported blocks</span>
        {blockTypes.map((t) => (
          <label className="check-row" key={t}>
            <input
              type="checkbox"
              disabled={!canManage}
              checked={allowed.includes(t)}
              onChange={(e) =>
                setAllowed(
                  e.target.checked
                    ? [...allowed, t]
                    : allowed.filter((b) => b !== t),
                )
              }
            />
            {t.replaceAll('_', ' ')}
          </label>
        ))}
        {canManage && (
          <button className="btn btn-primary mt-3">
            <IconDeviceFloppy size={17} /> Save template
          </button>
        )}
      </form>
    </section>
  );
}
