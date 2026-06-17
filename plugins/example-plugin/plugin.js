// Example Plugin — developer reference: sidebar widget, command palette, home-section demo.
// Pre-compiled ESM bundle. Uses window.__HW_React.

const React = window.__HW_React;
if (!React) throw new Error('[ExamplePlugin] window.__HW_React is not set');
const { useState, useEffect, createElement: h } = React;

let _store = null;

// ---------------------------------------------------------------------------
// Home section component
// ---------------------------------------------------------------------------

function ExampleHomeSection() {
  const [runCount, setRunCount] = useState(null);

  useEffect(() => {
    if (!_store) return;
    _store.get('runCount').then(v => setRunCount(v != null ? Number(v) : 0)).catch(() => setRunCount(0));
  }, []);

  const card = h('div', { key: 'example-card', className: 'poster-card-wrap' },
    h('div', { className: 'poster-card' },
      h('div', { className: 'poster-card__placeholder' },
        h('span', null, '🧩')
      )
    ),
    h('div', { className: 'poster-card__info' },
      h('span', { className: 'poster-card__title' }, 'Example Plugin'),
      h('div', { className: 'poster-card__sub' },
        h('span', { className: 'poster-card__year' },
          runCount != null ? `Activated ${runCount}×` : '…'
        )
      )
    )
  );

  return h('section', { className: 'catalog-row' },
    h('h2', { className: 'catalog-row__title' }, '🧩 Example Plugin'),
    h('div', { className: 'catalog-row__scroller' }, card)
  );
}

// ---------------------------------------------------------------------------
// Sidebar widget
// ---------------------------------------------------------------------------

function ExampleSidebarWidget() {
  return h('div', { style: { padding: '0.75rem 1rem', color: 'var(--text-dim)', fontSize: '0.82rem' } },
    '🧩 Example Plugin is active.'
  );
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export async function init(ctx) {
  _store = ctx.store;

  const prev = await ctx.store.get('runCount').catch(() => null);
  const next = prev != null ? Number(prev) + 1 : 1;
  await ctx.store.set('runCount', String(next)).catch(() => {});

  ctx.commands.register({
    id: 'example-plugin:hello',
    label: 'Example Plugin: Say Hello',
    handler: () => alert(`Hello from Example Plugin! (run #${next})`),
  });

  ctx.ui.register('sidebar', ExampleSidebarWidget);
  ctx.ui.register('home-section', ExampleHomeSection, { defaultGridSize: { cols: 2, rows: 2 }, gearPosition: 'top-left' });
}

export function teardown() {}
