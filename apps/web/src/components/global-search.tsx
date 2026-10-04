'use client';
import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchResponse, SearchResult } from '@visitspakistan/domain';
import './search.css';
export default function GlobalSearch() {
  const id = useId(),
    router = useRouter();
  const [q, setQ] = useState(''),
    [items, setItems] = useState<SearchResult[]>([]),
    [active, setActive] = useState(-1),
    [open, setOpen] = useState(false),
    [status, setStatus] = useState('');
  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      setStatus('');
      return;
    }
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      setStatus('Searching…');
      try {
        const r = await fetch(
          `/api/search/?${new URLSearchParams({ q: q.trim(), autocomplete: 'true' })}`,
          { signal: controller.signal },
        );
        if (!r.ok) throw new Error('unavailable');
        const data = (await r.json()) as SearchResponse;
        if (current) {
          const results = data.groups.flatMap((g) => g.results).slice(0, 9);
          setItems(results);
          setActive(-1);
          setStatus(
            results.length
              ? `${results.length} suggestions available`
              : 'No suggestions. Press Enter to search.',
          );
        }
      } catch {
        if (current) {
          setItems([]);
          setStatus('Suggestions unavailable. Press Enter to try full search.');
        }
      }
    }, 250);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [q]);
  return (
    <form
      action="/search/"
      method="get"
      className="global-search"
      role="search"
      aria-label="Search VisitsPakistan"
      onSubmit={(e) => {
        if (open && active >= 0 && items[active]) {
          e.preventDefault();
          router.push(items[active]!.url);
          setOpen(false);
        }
      }}
    >
      <label htmlFor={id}>Find your next discovery</label>
      <div className="global-search-row">
        <input
          id={id}
          name="q"
          value={q}
          maxLength={120}
          placeholder="Destinations, attractions, experiences…"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && items.length > 0}
          aria-controls={`${id}-results`}
          aria-activedescendant={
            open && active >= 0 ? `${id}-option-${active}` : undefined
          }
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
            setItems([]);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && open && active >= 0 && items[active]) {
              e.preventDefault();
              router.push(items[active]!.url);
              setOpen(false);
            }
            if (e.key === 'Escape') {
              setOpen(false);
              setActive(-1);
            }
            if (
              (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
              items.length
            ) {
              e.preventDefault();
              setOpen(true);
              setActive((i) =>
                e.key === 'ArrowDown'
                  ? (i + 1) % items.length
                  : i <= 0
                    ? items.length - 1
                    : i - 1,
              );
            }
          }}
        />
        <button type="submit">Search →</button>
      </div>
      <span className="search-status" role="status" aria-live="polite">
        {status}
      </span>
      {open && items.length > 0 && (
        <ul
          id={`${id}-results`}
          role="listbox"
          className="search-suggestions"
          aria-label="Search suggestions"
        >
          {items.map((d, i) => (
            <li
              role="option"
              id={`${id}-option-${i}`}
              aria-selected={i === active}
              key={d.id}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  router.push(d.url);
                  setOpen(false);
                  setQ('');
                }}
              >
                <strong>{d.name}</strong>
                <span>
                  {d.type === 'PLACE' ? 'Attraction' : d.type.toLowerCase()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
