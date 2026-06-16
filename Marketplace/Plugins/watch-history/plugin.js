// Watch History Plugin — toolbar button + overlay panel.
// Pre-compiled ESM bundle. Uses window.__HW_React and window.__HW_library.

const React = window.__HW_React;
if (!React) throw new Error('[WatchHistory] window.__HW_React is not set');
const { useState, useEffect, useMemo, createElement: h, Fragment } = React;

const lib = window.__HW_library;
if (!lib) throw new Error('[WatchHistory] window.__HW_library is not set');

// ---------------------------------------------------------------------------
// Shared CSS — injected once (shared with watchlist plugin via same style id)
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
.lib-card__badge--date{background:var(--bg-raised);color:var(--text-muted)}
.lib-card__actions{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.1rem}
.lib-btn{padding:.25rem .7rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:.75rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
.lib-btn:hover{border-color:var(--accent-border);color:var(--accent);background:var(--accent-dim)}
.lib-btn--primary{background:var(--success-bg);border-color:var(--success-border);color:var(--success)}
.lib-btn--ghost{border-color:var(--border);color:var(--text-muted)}
.lib-btn--ghost:hover{border-color:var(--error-border);color:var(--error)}
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
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Overlay component
// ---------------------------------------------------------------------------

function WatchHistoryOverlay({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [watchlistStatus, setWatchlistStatus] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  function load() {
    lib.getWatched?.().then(async items => {
      setEntries(items ?? []);
      const status = {};
      await Promise.all((items ?? []).map(async item => {
        status[item.id] = await lib.isInWatchlist?.(item.id) ?? false;
      }));
      setWatchlistStatus(status);
    }).catch(() => {});
  }

  useEffect(() => {
    load();
    const unsub = lib.subscribeToLibrary?.(load);
    return () => unsub?.();
  }, []);

  const visible = useMemo(() => {
    return entries.filter(e => {
      if (filter !== 'all' && e.contentType !== filter) return false;
      if (search.trim() && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, filter, search]);

  function handleRemove(id) {
    lib.removeFromWatched?.(id).catch(() => {});
  }

  function handleAddToWatchlist(e) {
    if (watchlistStatus[e.id]) return;
    lib.addToWatchlist?.({ id: e.id, type: e.contentType, name: e.title, poster: e.poster, year: e.year }).catch(() => {});
  }

  const FILTERS = ['all', 'movie', 'series'];
  const FILTER_LABELS = { all: 'All', movie: 'Movies', series: 'Series' };

  return h('div', { className: 'lib-overlay', onClick: onClose },
    h('div', { className: 'lib-panel', onClick: e => e.stopPropagation() },

      h('div', { className: 'lib-panel__header' },
        h('h2', { className: 'lib-panel__title' }, '✓ Watch History'),
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
            ? 'Nothing watched yet. Finish a movie or episode, or click "Mark as watched?" in the detail view.'
            : 'No results for your search.'
        ),
        h('div', { className: 'lib-grid' },
          visible.map(e => {
            const epLabel = e.lastSeason != null && e.lastEpisode != null
              ? `S${String(e.lastSeason).padStart(2, '0')}E${String(e.lastEpisode).padStart(2, '0')}`
              : e.lastSeason != null
                ? `up to S${String(e.lastSeason).padStart(2, '0')}`
                : undefined;
            const inWatchlist = watchlistStatus[e.id];

            return h('div', { key: e.id, className: 'lib-card' },
              h('div', { className: 'lib-card__poster' },
                e.poster
                  ? h('img', { src: e.poster, alt: e.title, loading: 'lazy' })
                  : h('div', { className: 'lib-card__no-poster' }, e.title[0])
              ),
              h('div', { className: 'lib-card__body' },
                h('span', { className: 'lib-card__title' }, e.title),
                h('div', { className: 'lib-card__meta' },
                  e.year && h('span', { className: 'lib-card__year' }, e.year),
                  h('span', { className: `lib-card__type${e.contentType === 'series' ? ' lib-card__type--series' : ''}` },
                    e.contentType === 'series' ? 'Series' : 'Movie'
                  ),
                  epLabel && h('span', { className: 'lib-card__badge lib-card__badge--info' }, epLabel),
                  h('span', { className: 'lib-card__badge lib-card__badge--date' }, formatDate(e.markedAt))
                ),
                h('div', { className: 'lib-card__actions' },
                  !inWatchlist && e.contentType === 'series' && h('button', {
                    className: 'lib-btn lib-btn--primary',
                    onClick: () => handleAddToWatchlist(e),
                    title: 'Add to watchlist (new season?)',
                  }, '+ Watchlist'),
                  h('button', {
                    className: 'lib-btn lib-btn--ghost',
                    onClick: () => handleRemove(e.id),
                    title: 'Remove from history',
                  }, '✕ Remove')
                )
              )
            );
          })
        )
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function WatchHistoryButton() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  function loadCount() {
    lib.getWatched?.().then(l => setCount((l ?? []).length)).catch(() => {});
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
      title: 'Open watch history',
    },
      '✓ Watched',
      count > 0 && h('span', { className: 'lib-toolbar-btn__count' }, count)
    ),
    open && h(WatchHistoryOverlay, { onClose: () => setOpen(false) })
  );
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export function init(ctx) {
  injectSharedCSS();
  ctx.ui.register('toolbar', WatchHistoryButton);
}

export function teardown() {}
