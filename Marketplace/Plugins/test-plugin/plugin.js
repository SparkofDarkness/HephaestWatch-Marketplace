// Test Plugin — exercises every feature of the PluginContext API.
//
// Tested features:
//   ctx.config                             — read variables (badgeColor, logHooks)
//   ctx.store.set / get / delete / clear   — namespaced SQLite persistence
//   ctx.commands.register()                — three commands in the Command Palette
//   ctx.ui.register('toolbar', ...)        — toolbar button that opens a modal panel
//   ctx.ui.register('statusbar', ...)      — live hook-fire counter badge
//   ctx.hooks.on('stream:beforeConnect')   — observe + optionally transform streams
//   ctx.hooks.on('stream:afterConnect')    — observe resolved connections
//   ctx.hooks.on('player:progressSaved')   — track watch progress in store
//   ctx.hooks.on('player:markedWatched')   — increment per-item watched counter
//   teardown()                             — unsubscribe all hooks
//
// React UI components use window.__HW_React (exposed by the host app in main.tsx).
// This means no React copy needs to be bundled into this file.

// ---------------------------------------------------------------------------
// React access — host app exposes it via window.__HW_React
// ---------------------------------------------------------------------------

const React = window.__HW_React;
if (!React) throw new Error('[TestPlugin] window.__HW_React is not set — update the host app');
const { useState, useEffect, createElement: h } = React;

// ---------------------------------------------------------------------------
// Toolbar panel content
// ---------------------------------------------------------------------------

function StoreViewer({ sessions, lastProgress, watchedMap }) {
  return h('div', { style: { marginTop: '1rem' } },
    h('h3', { style: { color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.75rem' } }, 'Live Store Snapshot'),
    h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#ccc' } },
      h('tbody', null,
        h('tr', null,
          h('td', { style: styles.td }, 'sessions'),
          h('td', { style: { ...styles.td, color: '#60a5fa', fontWeight: 'bold' } }, String(sessions ?? '—')),
        ),
        h('tr', null,
          h('td', { style: styles.td }, 'last-progress'),
          h('td', { style: { ...styles.td, color: '#34d399', wordBreak: 'break-all' } },
            lastProgress ? `${lastProgress.itemId} @ ${Math.round(lastProgress.seconds)}s` : '—'
          ),
        ),
        ...Object.entries(watchedMap ?? {}).map(([id, count]) =>
          h('tr', { key: id }, null,
            h('td', { style: styles.td }, `watched:${id.substring(0, 20)}…`),
            h('td', { style: { ...styles.td, color: '#f59e0b' } }, `${count}×`)
          )
        ),
      )
    )
  );
}

function TestPanel({ onClose, storeRef }) {
  const [clickCount, setClickCount] = useState(0);
  const [sessions, setSessions] = useState(null);
  const [lastProgress, setLastProgress] = useState(null);
  const [watchedMap, setWatchedMap] = useState({});

  useEffect(() => {
    // Re-read store snapshot when panel opens
    async function load() {
      if (!storeRef.current) return;
      const store = storeRef.current;
      setSessions(await store.get('sessions'));
      setLastProgress(await store.get('last-progress'));
      // Watched counters have keys like "watched:test:movie:1" — we read a few known ones
      const ids = ['test:movie:1', 'test:movie:2', 'test:series:1'];
      const map = {};
      for (const id of ids) {
        const v = await store.get(`watched:${id}`);
        if (v !== null) map[id] = v;
      }
      setWatchedMap(map);
    }
    load();
  }, [storeRef]);

  return h('div', { style: styles.overlay },
    h('div', { style: styles.panel },

      // Header
      h('div', { style: styles.header },
        h('span', { style: { fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' } }, '🧪 Test Plugin'),
        h('button', { onClick: onClose, style: styles.closeBtn }, '✕')
      ),

      h('p', { style: { color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.5rem' } },
        'This panel is registered via ',
        h('code', { style: { color: '#60a5fa', background: '#0f172a', padding: '0.1em 0.4em', borderRadius: '4px' } },
          "ctx.ui.register('toolbar', ...)"
        )
      ),

      // useState demo
      h('div', { style: { marginBottom: '1.5rem' } },
        h('p', { style: { color: '#94a3b8', fontSize: '0.75rem', margin: '0 0 0.5rem' } }, 'useState / event handler test:'),
        h('button', {
          onClick: () => setClickCount(c => c + 1),
          style: styles.btn,
        }, `Clicked ${clickCount}×  ✓`)
      ),

      // Store snapshot
      h(StoreViewer, { sessions, lastProgress, watchedMap }),

      // Hints
      h('p', { style: { color: '#475569', fontSize: '0.75rem', marginTop: '1.5rem' } },
        'Play something to fire hooks and watch the statusbar counter increase. Re-open this panel to see updated store values.'
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Toolbar button component
// ---------------------------------------------------------------------------

function TestToolbarButton({ storeRef }) {
  const [open, setOpen] = useState(false);
  return h(React.Fragment, null,
    h('button', {
      onClick: () => setOpen(v => !v),
      style: {
        background: open ? '#1d4ed8' : 'transparent',
        border: `1px solid ${open ? '#2563eb' : '#374151'}`,
        color: open ? '#fff' : '#9ca3af',
        borderRadius: '6px',
        padding: '0.3rem 0.65rem',
        cursor: 'pointer',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        transition: 'all 0.15s',
      },
      title: 'Test Plugin — open panel',
    },
      '🧪',
      h('span', null, 'Test')
    ),
    open && h(TestPanel, { onClose: () => setOpen(false), storeRef })
  );
}

// ---------------------------------------------------------------------------
// Statusbar badge — shows live hook-fire count
// ---------------------------------------------------------------------------

function TestStatusbar({ color }) {
  const [fires, setFires] = useState(0);

  useEffect(() => {
    const handler = () => setFires(n => n + 1);
    window.addEventListener('test-plugin:hook-fired', handler);
    return () => window.removeEventListener('test-plugin:hook-fired', handler);
  }, []);

  return h('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0 0.75rem',
      fontSize: '0.72rem',
      color,
      borderRight: '1px solid #1e293b',
      height: '100%',
      cursor: 'default',
    },
    title: 'Test Plugin — hook fires since page load',
  },
    '🧪',
    h('span', null, `hooks: ${fires}`)
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 600,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '12px',
    padding: '1.5rem',
    minWidth: '420px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
    color: '#f1f5f9',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#64748b',
    cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1,
    padding: '0.25rem',
  },
  btn: {
    background: '#1e3a5f', border: '1px solid #2563eb',
    color: '#93c5fd', borderRadius: '6px',
    padding: '0.45rem 1rem', cursor: 'pointer',
    fontSize: '0.85rem',
  },
  td: {
    padding: '0.3rem 0.5rem',
    borderBottom: '1px solid #1e293b',
    color: '#64748b',
    width: '40%',
  },
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

// Shared mutable ref so UI components can access the store after init
const storeRef = { current: null };
let hookUnsubs = [];

export async function init(ctx) {
  const log = ctx.config.logHooks
    ? (...a) => console.log('[TestPlugin]', ...a)
    : () => {};

  log('init() called');
  log('config:', ctx.config);

  // Store the store reference so UI components can call it
  storeRef.current = ctx.store;

  // ── 1. Store — test all operations ───────────────────────────────────────
  const prevSessions = (await ctx.store.get('sessions')) ?? 0;
  await ctx.store.set('sessions', prevSessions + 1);
  log(`store: sessions = ${prevSessions + 1} ✓`);

  await ctx.store.set('scratch', { written: new Date().toISOString() });
  const scratch = await ctx.store.get('scratch');
  log('store: scratch written and read back:', scratch, '✓');

  await ctx.store.delete('scratch');
  const afterDelete = await ctx.store.get('scratch');
  log('store: delete worked:', afterDelete === null, '✓');

  // ── 2. Commands ───────────────────────────────────────────────────────────
  ctx.commands.register('test-plugin:hello', 'Test Plugin: Say Hello', () => {
    console.log('[TestPlugin] Hello from command palette! ✓');
    // Use alert only to make the test visible — remove in production plugins
    // alert('Hello from Test Plugin ✓');
  });

  ctx.commands.register('test-plugin:log-config', 'Test Plugin: Log Config', () => {
    console.log('[TestPlugin] current config:', ctx.config);
  });

  ctx.commands.register('test-plugin:reset-store', 'Test Plugin: Reset Store', async () => {
    await ctx.store.clear();
    console.log('[TestPlugin] store.clear() called ✓');
  });

  log('commands registered ✓');

  // ── 3. UI Slots ───────────────────────────────────────────────────────────
  const color = String(ctx.config.badgeColor || '#60a5fa');

  // Toolbar button — opens the modal panel
  ctx.ui.register('toolbar', () => h(TestToolbarButton, { storeRef }));

  // Statusbar badge — shows live hook counter
  ctx.ui.register('statusbar', () => h(TestStatusbar, { color }));

  log('ui slots registered: toolbar + statusbar ✓');

  // ── 4. Hooks ──────────────────────────────────────────────────────────────

  // 4a. stream:beforeConnect — observe and optionally transform the stream descriptor
  const unsubBefore = ctx.hooks.on('stream:beforeConnect', (stream) => {
    log('hook stream:beforeConnect — type:', stream.type, '| url:', stream.url.substring(0, 60) + '…');
    window.dispatchEvent(new Event('test-plugin:hook-fired'));
    // Return stream unchanged — to modify, return { ...stream, url: newUrl }
    return stream;
  });
  hookUnsubs.push(unsubBefore);

  // 4b. stream:afterConnect — observe the resolved ActiveConnection
  const unsubAfter = ctx.hooks.on('stream:afterConnect', (conn) => {
    log('hook stream:afterConnect — final url:', conn.url.substring(0, 60) + '…');
    window.dispatchEvent(new Event('test-plugin:hook-fired'));
    return conn;
  });
  hookUnsubs.push(unsubAfter);

  // 4c. player:progressSaved — store last progress for the panel display
  const unsubProgress = ctx.hooks.on('player:progressSaved', async (ev) => {
    log(`hook player:progressSaved — ${ev.itemId} @ ${Math.round(ev.seconds)}s / ${Math.round(ev.duration)}s`);
    await ctx.store.set('last-progress', ev);
    window.dispatchEvent(new Event('test-plugin:hook-fired'));
    return ev;
  });
  hookUnsubs.push(unsubProgress);

  // 4d. player:markedWatched — increment per-item watch counter
  const unsubWatched = ctx.hooks.on('player:markedWatched', async (ev) => {
    const label = ev.season ? `S${ev.season}E${ev.episode}` : 'movie';
    log(`hook player:markedWatched — ${ev.itemId} (${label})`);
    const key = `watched:${ev.itemId}`;
    const prev = (await ctx.store.get(key)) ?? 0;
    await ctx.store.set(key, prev + 1);
    log(`  → times watched: ${prev + 1} ✓`);
    window.dispatchEvent(new Event('test-plugin:hook-fired'));
    return ev;
  });
  hookUnsubs.push(unsubWatched);

  log('hooks registered: stream:beforeConnect, stream:afterConnect, player:progressSaved, player:markedWatched ✓');
  log('init complete ✓');
}

export function teardown() {
  hookUnsubs.forEach(fn => fn());
  hookUnsubs = [];
  storeRef.current = null;
  console.log('[TestPlugin] teardown() — all 4 hook subscriptions removed ✓');
}
