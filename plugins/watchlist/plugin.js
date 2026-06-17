// Watchlist Plugin — toolbar button + overlay panel.
// Pre-compiled ESM bundle. Uses window.__HW_React and window.__HW_library.

const React = window.__HW_React;
if (!React) throw new Error('[Watchlist] window.__HW_React is not set');
const { useState, useEffect, useMemo, createElement: h, Fragment } = React;

const lib = window.__HW_library;
if (!lib) throw new Error('[Watchlist] window.__HW_library is not set');

// ---------------------------------------------------------------------------
// Shared CSS — injected once (shared with watch-history plugin via same style id)
// ---------------------------------------------------------------------------

const SHARED_CSS = `
.lib-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:400;display:flex;align-items:stretch;justify-content:flex-end}
.lib-panel{width:min(640px,100vw);background:var(--bg-surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-overlay)}
.lib-panel__header{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem 1rem;border-bottom:1px solid var(--border-subtle);flex-shrink:0}
.lib-panel__title{font-size:1.1rem;font-weight:700;margin:0;color:var(--text)}
.lib-panel__close{width:30px;height:30px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--text-dim);cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:color .15s,background .15s,border-color .15s}
.lib-panel__close:hover{color:var(--text);background:var(--bg-raised);border-color:var(--accent-border)}
.lib-panel__controls{padding:.75rem 1.5rem;display:flex;flex-direction:column;gap:.6rem;flex-shrink:0;border-bottom:1px solid var(--border-subtle)}
.lib-search{width:100%;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-full);color:var(--text);font-size:.88rem;padding:.5rem .9rem;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box}
.lib-search:focus{border-color:var(--accent-border);box-shadow:0 0 0 3px var(--accent-dim)}
.lib-filter-tabs{display:flex;gap:.35rem}
.lib-filter-tab{padding:.25rem .9rem;border-radius:var(--radius-full);border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.78rem;font-weight:500;cursor:pointer;transition:all .15s}
.lib-filter-tab:hover{border-color:var(--accent-border);color:var(--text)}
.lib-filter-tab--active{background:var(--accent-dim);border-color:var(--accent-border);color:var(--accent)}
.lib-panel__body{flex:1;overflow-y:auto;padding:1rem 1.5rem 2rem;scrollbar-width:thin;scrollbar-color:var(--border) transparent;display:flex;flex-direction:column;gap:0}
.lib-empty{color:var(--text-muted);font-size:.88rem;line-height:1.7;margin:2rem 0}
.lib-grid{display:flex;flex-direction:column;gap:.45rem;margin-bottom:1.5rem}
.lib-card{display:flex;align-items:center;gap:.9rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:.6rem .9rem;transition:border-color .15s,background .15s}
.lib-card:hover{border-color:var(--accent-border);background:var(--accent-dim)}
.lib-card__poster{width:46px;height:68px;flex-shrink:0;border-radius:6px;overflow:hidden;background:var(--bg-surface)}
.lib-card__poster img{width:100%;height:100%;object-fit:cover;display:block}
.lib-card__no-poster{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--text-muted);font-weight:700}
.lib-card__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:.3rem}
.lib-card__title{font-size:.88rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lib-card__meta{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.lib-card__year{font-size:.7rem;color:var(--text-muted)}
.lib-card__type{font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;background:var(--bg-surface);color:var(--text-muted);border:1px solid var(--border);text-transform:uppercase;letter-spacing:.04em}
.lib-card__type--series{background:var(--success-bg);color:var(--success);border-color:var(--success-border)}
.lib-card__badge{font-size:.65rem;padding:.1rem .45rem;border-radius:4px;background:var(--bg-surface);color:var(--text-muted);border:1px solid var(--border)}
.lib-card__badge--info{background:var(--accent-dim);color:var(--accent);border-color:var(--accent-border)}
.lib-card__actions{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.1rem}
.lib-btn{padding:.25rem .7rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:.75rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
.lib-btn:hover{border-color:var(--accent-border);color:var(--accent);background:var(--accent-dim)}
.lib-btn--primary{background:var(--success-bg);border-color:var(--success-border);color:var(--success)}
.lib-btn--ghost{border-color:var(--border);color:var(--text-muted)}
.lib-btn--ghost:hover{border-color:var(--error-border);color:var(--error)}
.lib-section{margin-top:.5rem;padding-top:1.25rem;border-top:1px solid var(--border-subtle)}
.lib-section__title{font-size:.88rem;font-weight:700;color:var(--text);margin:0 0 .3rem}
.lib-section__hint{font-size:.78rem;color:var(--text-muted);margin:0 0 .85rem;line-height:1.5}
.lib-toolbar-btn{display:flex;align-items:center;gap:.3rem;padding:.35rem .7rem;border-radius:var(--radius-full);border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:.82rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
.lib-toolbar-btn:hover{background:var(--accent-dim);border-color:var(--accent-border);color:var(--accent)}
.lib-toolbar-btn__count{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:var(--radius-full);background:var(--accent);color:#fff;font-size:.65rem;font-weight:700}
`;

function injectSharedCSS() {
  if (document.getElementById('hw-lib-shared-styles')) return;
  const el = document.createElement('style');
  el.id = 'hw-lib-shared-styles';
  el.textContent = SHARED_CSS;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

function LibCard({ poster, title, year, contentType, badge, badgeClass, primaryAction, secondaryAction }) {
  return h('div', { className: 'lib-card' },
    h('div', { className: 'lib-card__poster' },
      poster
        ? h('img', { src: poster, alt: title, loading: 'lazy' })
        : h('div', { className: 'lib-card__no-poster' }, title[0])
    ),
    h('div', { className: 'lib-card__body' },
      h('span', { className: 'lib-card__title' }, title),
      h('div', { className: 'lib-card__meta' },
        year && h('span', { className: 'lib-card__year' }, year),
        h('span', { className: `lib-card__type${contentType === 'series' ? ' lib-card__type--series' : ''}` },
          contentType === 'series' ? 'Series' : 'Movie'
        ),
        badge && h('span', { className: `lib-card__badge ${badgeClass ?? ''}` }, badge)
      ),
      (primaryAction || secondaryAction) && h('div', { className: 'lib-card__actions' },
        primaryAction && h('button', {
          className: `lib-btn ${primaryAction.className ?? ''}`,
          onClick: primaryAction.onClick,
        }, primaryAction.label),
        secondaryAction && h('button', {
          className: `lib-btn lib-btn--ghost ${secondaryAction.className ?? ''}`,
          onClick: secondaryAction.onClick,
        }, secondaryAction.label)
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Overlay component
// ---------------------------------------------------------------------------

function WatchlistOverlay({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [watched, setWatched] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  function load() {
    lib.getWatchlist?.().then(setEntries).catch(() => {});
    lib.getWatched?.().then(setWatched).catch(() => {});
  }

  useEffect(() => {
    load();
    const unsub = lib.subscribeToLibrary?.(load);
    return () => unsub?.();
  }, []);

  const visible = useMemo(() => {
    return (entries ?? []).filter(e => {
      if (filter !== 'all' && e.contentType !== filter) return false;
      if (search.trim() && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, filter, search]);

  const watchlistIds = useMemo(() => new Set((entries ?? []).map(e => e.id)), [entries]);
  const newSeasonCandidates = useMemo(
    () => (watched ?? []).filter(w => w.contentType === 'series' && !watchlistIds.has(w.id)),
    [watched, watchlistIds],
  );

  function handleRemove(id) {
    lib.removeFromWatchlist?.(id).catch(() => {});
  }

  function handleAddToWatchlist(w) {
    lib.addToWatchlist?.({ id: w.id, type: w.contentType, name: w.title, poster: w.poster, year: w.year }).catch(() => {});
  }

  const FILTERS = ['all', 'movie', 'series'];
  const FILTER_LABELS = { all: 'All', movie: 'Movies', series: 'Series' };

  return h('div', { className: 'lib-overlay', onClick: onClose },
    h('div', { className: 'lib-panel', onClick: e => e.stopPropagation() },

      h('div', { className: 'lib-panel__header' },
        h('h2', { className: 'lib-panel__title' }, '📋 My Watchlist'),
        h('button', { className: 'lib-panel__close', onClick: onClose }, '✕')
      ),

      h('div', { className: 'lib-panel__controls' },
        h('input', {
          className: 'lib-search',
          type: 'search',
          placeholder: 'Search…',
          value: search,
          onChange: e => setSearch(e.target.value),
          autoFocus: true,
        }),
        h('div', { className: 'lib-filter-tabs' },
          FILTERS.map(f => h('button', {
            key: f,
            className: `lib-filter-tab${filter === f ? ' lib-filter-tab--active' : ''}`,
            onClick: () => setFilter(f),
          }, FILTER_LABELS[f]))
        )
      ),

      h('div', { className: 'lib-panel__body' },
        visible.length === 0 && h('p', { className: 'lib-empty' },
          entries.length === 0
            ? 'Your watchlist is empty. Open a movie or series detail and click "Save".'
            : 'No results for your search.'
        ),
        h('div', { className: 'lib-grid' },
          visible.map(e => h(LibCard, {
            key: e.id,
            poster: e.poster,
            title: e.title,
            year: e.year,
            contentType: e.contentType,
            secondaryAction: { label: '✕ Remove', onClick: () => handleRemove(e.id) },
          }))
        ),
        newSeasonCandidates.length > 0 && h('div', { className: 'lib-section' },
          h('h3', { className: 'lib-section__title' }, '🆕 New season available?'),
          h('p', { className: 'lib-section__hint' },
            "You've already watched these series — there might be a new season!"
          ),
          h('div', { className: 'lib-grid' },
            newSeasonCandidates.map(w => h(LibCard, {
              key: w.id,
              poster: w.poster,
              title: w.title,
              year: w.year,
              contentType: w.contentType,
              badge: w.lastSeason != null ? `Last S${String(w.lastSeason).padStart(2, '0')}` : undefined,
              badgeClass: 'lib-card__badge--info',
              primaryAction: {
                label: '+ Add to watchlist',
                onClick: () => handleAddToWatchlist(w),
                className: 'lib-btn--primary',
              },
            }))
          )
        )
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function WatchlistButton() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  function loadCount() {
    lib.getWatchlist?.().then(l => setCount((l ?? []).length)).catch(() => {});
  }

  useEffect(() => {
    loadCount();
    const unsub = lib.subscribeToLibrary?.(loadCount);
    return () => unsub?.();
  }, []);

  return h(Fragment, null,
    h('button', {
      className: 'lib-toolbar-btn',
      onClick: () => setOpen(v => !v),
      title: 'Open watchlist',
    },
      '📋',
      count > 0 && h('span', { className: 'lib-toolbar-btn__count' }, count)
    ),
    open && h(WatchlistOverlay, { onClose: () => setOpen(false) })
  );
}

// ---------------------------------------------------------------------------
// Home section component
// ---------------------------------------------------------------------------

function WatchlistSection() {
  const [entries, setEntries] = useState([]);

  function load() {
    lib.getWatchlist?.().then(l => setEntries(l ?? [])).catch(() => {});
  }

  useEffect(() => {
    load();
    const unsub = lib.subscribeToLibrary?.(load);
    return () => unsub?.();
  }, []);

  if (entries.length === 0) return null;

  function openDetail(entry) {
    const nav = window.__HW_navigation;
    if (!nav?.openDetail) return;
    nav.openDetail({ id: entry.id, type: entry.contentType, name: entry.title, poster: entry.poster, year: entry.year });
  }

  return h('section', { className: 'catalog-row' },
    h('h2', { className: 'catalog-row__title' }, '📋 My Watchlist'),
    h('div', { className: 'catalog-row__scroller' },
      entries.map(item =>
        h('div', {
          key: item.id,
          className: 'poster-card-wrap',
          onClick: () => openDetail(item),
          style: { cursor: 'pointer' },
        },
          h('div', { className: 'poster-card' },
            item.poster
              ? h('img', { className: 'poster-card__img', src: item.poster, loading: 'lazy', alt: item.title })
              : h('div', { className: 'poster-card__placeholder' }, h('span', null, item.title))
          ),
          h('div', { className: 'poster-card__info' },
            h('span', { className: 'poster-card__title' }, item.title),
            item.year && h('div', { className: 'poster-card__sub' },
              h('span', { className: 'poster-card__year' }, item.year)
            )
          )
        )
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export function init(ctx) {
  injectSharedCSS();
  ctx.ui.register('toolbar', WatchlistButton);
  ctx.ui.register('home-section', WatchlistSection, { defaultGridSize: { cols: 4, rows: 2 } });
}

export function teardown() {}
