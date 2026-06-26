# HephaestWatch Marketplace

Extension registry and developer documentation for [HephaestWatch](https://github.com/SparkofDarkness/HephaestWatch) — a local-first media player built on Tauri 2 + React 18.

This repository serves two purposes:

1. **Registry** — `index.json` is fetched by the app at startup (via jsDelivr CDN) and populates the Marketplace panel. First-party extensions live in `addons/` and `plugins/`. Community extensions are linked from `community.json`.
2. **Documentation** — everything below is the authoritative spec for building and distributing extensions.

---

## Extension types

| Type | Does what |
|---|---|
| **Addon** | Provides content: catalog rows (movie/series lists), stream resolvers, metadata (seasons, episodes) |
| **Plugin** | Extends the app: toolbar buttons, sidebar widgets, home-screen rows, player overlays, command-palette entries |

Both types can persist data (namespaced SQLite), read config variables, and export a `teardown()` for cleanup.

---

## Tiers

| Tier | Script | When to use |
|---|---|---|
| **1 — Declarative** | No | Static stream URL with variable substitution (`{{key}}`) |
| **2 — Scripted** | Yes (`index.js` / `plugin.js`) | Any dynamic logic: API calls, catalogs, React components |
| **3 — Built-in** | No (app source) | Core extensions hardcoded in the app; not distributable |

Most extensions are Tier 2.

---

## Addon development

### Minimal working example

`manifest.json`:
```json
{
  "type": "addon",
  "id": "my-addon",
  "name": "My Addon",
  "version": "1.0.0",
  "description": "Fetches movies from my API.",
  "provides": ["catalog"],
  "variables": [
    { "key": "apiKey", "label": "API Key", "type": "string", "default": "", "secret": true }
  ],
  "scripts": { "addon": "index.js" }
}
```

`index.js`:
```js
export async function init(ctx) {
  ctx.content.registerCatalog({
    id: 'my-addon:movies',
    name: 'My Movies',
    type: 'movie',
    async fetch(opts) {
      const res = await fetch(`https://api.example.com/movies?key=${ctx.config.apiKey}&q=${opts.search ?? ''}`);
      const data = await res.json();
      return data.results.map(item => ({
        id: `my:movie:${item.id}`,
        type: 'movie',
        name: item.title,
        year: item.year,
        poster: item.poster,
        rating: item.score,
      }));
    },
  });
}

export function teardown() {}
```

---

### Tier 1 — Declarative addon

No bundle required. Declare static streams directly in `manifest.json` using `{{key}}` templates:

```json
{
  "type": "addon",
  "id": "my-stream",
  "name": "My Stream",
  "version": "1.0.0",
  "description": "Direct stream URL configured by the user.",
  "provides": ["streams"],
  "variables": [
    { "key": "url", "label": "Stream URL", "type": "string", "default": "" },
    { "key": "token", "label": "Auth Token", "type": "string", "default": "", "secret": true }
  ],
  "streams": [
    { "type": "hls", "url": "{{url}}?token={{token}}", "title": "My Stream" }
  ]
}
```

Omit `scripts` and `bundleUrl` — the app renders a config form and substitutes variables at playback time.

---

### Tier 2 — Scripted addon

`index.js` must be a **single self-contained ES module** — all dependencies bundled in, no external `import` statements at runtime. Export `init(ctx)` and optionally `teardown()`.

#### Catalog with filters

```js
export async function init(ctx) {
  ctx.content.registerCatalog({
    id: 'my-addon:movies',
    name: 'My Movies',
    type: 'movie',
    searchable: true,
    defaultGridSize: { cols: 4, rows: 2 },
    supportedFilters: ['genre', 'year_from', 'year_to', 'rating_min'],

    async fetch(opts) {
      // Called for browse + search
      // opts: { search?: string, page?: number }
      const url = new URL('https://api.example.com/movies');
      if (opts.search) url.searchParams.set('q', opts.search);
      url.searchParams.set('page', String(opts.page ?? 1));
      const res = await fetch(url, { headers: { 'X-Key': ctx.config.apiKey } });
      return (await res.json()).results.map(mapItem);
    },

    async fetchWithFilters(filters, opts) {
      // Called when the user applies filters in the UI
      // filters: { genre?, sort_by?, year_from?, year_to?, rating_min? }
      const url = new URL('https://api.example.com/discover');
      if (filters.genre)      url.searchParams.set('genre', filters.genre);
      if (filters.year_from)  url.searchParams.set('from', filters.year_from);
      if (filters.year_to)    url.searchParams.set('to', filters.year_to);
      if (filters.rating_min) url.searchParams.set('min_rating', filters.rating_min);
      url.searchParams.set('page', String(opts?.page ?? 1));
      const res = await fetch(url, { headers: { 'X-Key': ctx.config.apiKey } });
      return (await res.json()).results.map(mapItem);
    },
  });
}

function mapItem(raw) {
  return {
    id: `my:movie:${raw.id}`,
    type: 'movie',
    name: raw.title,
    poster: raw.poster_url,
    year: raw.release_year,
    rating: raw.score,
    description: raw.overview,
    genres: raw.genre_names,
  };
}
```

#### Stream resolver

```js
ctx.content.registerResolver({
  id: 'my-addon:resolver',
  async resolve(contentId, type, item, episode) {
    // episode is only set for series: { season: number, episode: number }
    const endpoint = type === 'series'
      ? `https://api.example.com/streams/${contentId}?s=${episode.season}&e=${episode.episode}`
      : `https://api.example.com/streams/${contentId}`;
    const res = await fetch(endpoint, { headers: { 'X-Key': ctx.config.apiKey } });
    return (await res.json()).links.map(link => ({
      title: link.label,       // shown in the stream picker
      url: link.url,
      type: link.kind,         // 'http' | 'hls' | 'torrent' | 'magnet'
      quality: link.quality,   // e.g. '1080p'
      size: link.size,         // e.g. '2.1 GB' (optional)
      headers: link.headers,   // optional request headers for the player
    }));
  },
});
```

#### Metadata provider (series seasons + episodes)

```js
ctx.content.registerMetadataProvider({
  id: 'my-addon:metadata',

  async fetchSeasons(contentId, type) {
    if (type !== 'series') return [];
    const data = await apiGet(`/series/${contentId}`);
    return data.seasons.map(s => ({
      number: s.season_number,
      name: s.title,
      episodeCount: s.episodes.length,
      poster: s.poster_url,   // optional
      episodes: [],           // leave empty; fetchEpisodes is called on demand
    }));
  },

  async fetchEpisodes(contentId, seasonNumber) {
    const data = await apiGet(`/series/${contentId}/seasons/${seasonNumber}`);
    return data.episodes.map(ep => ({
      number: ep.episode_number,
      name: ep.title,
      description: ep.overview,
      stillImage: ep.thumbnail_url,
      airDate: ep.aired_on,
    }));
  },

  async prefetchDetails(contentId, type) {
    // Fire-and-forget: called when the detail modal opens.
    // Use it to warm caches. ctx.store is available here.
    const ids = await apiGet(`/external-ids/${contentId}`);
    if (ids.imdb) await ctx.store.set(`imdb:${contentId}`, ids.imdb);
  },
});
```

---

### AddonContext API reference

```ts
ctx.config                     // Record<string, string | number | boolean>
                               // Values from manifest.json variables, as entered by the user

ctx.store.get(key)             // → Promise<string | null>
ctx.store.set(key, value)      // → Promise<void>  (value must be string)
ctx.store.delete(key)          // → Promise<void>
ctx.store.clear()              // → Promise<void>  — clears only this addon's namespace

ctx.getAddonConfig(addonId)    // → Record<string, string>  (read another addon's variables)
ctx.getAddonStore(addonId)     // → { get(key): Promise<string | null> }  (read-only cross-addon store)

ctx.content.registerCatalog(descriptor)
ctx.content.registerResolver(descriptor)
ctx.content.registerMetadataProvider(descriptor)
```

`registerCatalog` descriptor:
```ts
{
  id: string
  name: string
  type: 'movie' | 'series'
  searchable?: boolean
  defaultGridSize?: { cols: number; rows: number }
  supportedFilters?: string[]     // informs the filter UI which controls to show
  fetch(opts: { search?: string; page?: number }): Promise<CatalogItem[]>
  fetchWithFilters?(filters: FilterMap, opts: { page?: number }): Promise<CatalogItem[]>
}
```

`registerResolver` descriptor:
```ts
{
  id: string
  resolve(
    contentId: string,
    type: 'movie' | 'series',
    item: CatalogItem,
    episode?: { season: number; episode: number }
  ): Promise<Stream[]>
}
```

`registerMetadataProvider` descriptor:
```ts
{
  id: string
  fetchSeasons?(contentId: string, type: string): Promise<Season[]>
  fetchEpisodes?(contentId: string, seasonNumber: number): Promise<Episode[]>
  prefetchDetails?(contentId: string, type: string): Promise<void>
}
```

---

### Data shapes

**CatalogItem**
```ts
{
  id: string          // globally unique, e.g. 'tmdb:movie:550'
  type: 'movie' | 'series'
  name: string
  poster?: string     // image URL
  backdrop?: string   // wide image URL
  year?: number
  rating?: number     // 0–10
  description?: string
  genres?: string[]
}
```

**Stream**
```ts
{
  title: string
  url: string
  type: 'http' | 'hls' | 'torrent' | 'magnet'
  quality?: string        // '4K', '1080p', '720p', etc.
  size?: string           // human-readable, e.g. '2.1 GB'
  headers?: Record<string, string>
}
```

**Season**
```ts
{
  number: number
  name: string
  episodeCount: number
  episodes: []            // always pass empty array; use fetchEpisodes
  poster?: string
}
```

**Episode**
```ts
{
  number: number
  name: string
  description?: string
  stillImage?: string
  airDate?: string        // 'YYYY-MM-DD'
}
```

**FilterMap** (keys supported by the app's filter UI)
```ts
{
  genre?: string          // genre name as string, e.g. 'Action'
  sort_by?: string        // e.g. 'popularity.desc'
  year_from?: string | number
  year_to?: string | number
  rating_min?: string | number
}
```

---

### manifest.json — addon reference

```json
{
  "type": "addon",
  "id": "my-addon",           // must match folder name in this repo
  "name": "Human-readable name",
  "version": "1.0.0",
  "description": "One or two sentences.",
  "author": "your-name",
  "logo": "./icon.png",       // or https:// URL
  "provides": ["catalog", "streams"],
  "catalogs": [
    {
      "id": "my-addon:movies",
      "name": "My Movies",
      "type": "movie",        // 'movie' | 'series'
      "searchable": true
    }
  ],
  "variables": [
    {
      "key": "apiKey",
      "label": "API Key",
      "type": "string",       // 'string' | 'number' | 'boolean'
      "default": "",
      "description": "From mysource.com/settings",
      "secret": true          // renders as password input, masked in UI
    },
    {
      "key": "maxResults",
      "label": "Max Results",
      "type": "number",
      "default": 20
    },
    {
      "key": "showNSFW",
      "label": "Include adult content",
      "type": "boolean",
      "default": false
    }
  ],
  "scripts": {
    "addon": "index.js"       // omit entirely for Tier-1 declarative addons
  },
  "streams": []               // Tier-1 only: static stream definitions with {{key}} templates
}
```

`provides` values: `"catalog"` — registers catalog rows; `"streams"` — resolves playback URLs.

---

## Plugin development

### Minimal working example

`manifest.json`:
```json
{
  "type": "plugin",
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Adds a command and a sidebar label.",
  "permissions": ["ui", "commands"],
  "scripts": { "plugin": "plugin.js" }
}
```

`plugin.js`:
```js
const { createElement: h } = window.__HW_React;

function SidebarWidget() {
  return h('div', { style: { padding: '0.75rem 1rem', color: 'var(--text-dim)', fontSize: '0.82rem' } },
    'My Plugin is active.'
  );
}

export async function init(ctx) {
  ctx.commands.register({
    id: 'my-plugin:hello',
    label: 'My Plugin: Say Hello',
    handler: () => alert('Hello!'),
  });

  ctx.ui.register('sidebar', SidebarWidget);
}

export function teardown() {}
```

---

### UI slots

| Slot | Where it renders | Typical use |
|---|---|---|
| `'toolbar'` | Top navigation bar, right side | Icon button that opens an overlay |
| `'sidebar'` | Left sidebar panel | Informational widget, quick actions |
| `'home-section'` | Full-width row on the home screen | Custom content row (same style as catalog rows) |
| `'player-overlay'` | Overlaid on video during playback | Skip-intro button, subtitle picker |
| `'statusbar'` | Bottom status bar | Status indicators |

Registration:
```js
// Basic
ctx.ui.register('sidebar', MyComponent);

// With options (home-section only)
ctx.ui.register('home-section', MySection, {
  defaultGridSize: { cols: 4, rows: 2 },  // how many cards to show per row
  gearPosition: 'top-left',               // where the settings gear appears
});
```

---

### Toolbar button pattern

The standard pattern: a stateful button that mounts/unmounts an overlay. React is accessed via `window.__HW_React`.

```js
const React = window.__HW_React;
const { useState, useEffect, createElement: h, Fragment } = React;

function MyOverlay({ onClose }) {
  return h('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 400 },
    onClick: onClose },
    h('div', { style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 400,
      background: 'var(--bg-surface)', padding: '1.5rem' },
      onClick: e => e.stopPropagation() },
      h('h2', null, 'My Panel'),
      h('button', { onClick: onClose }, 'Close')
    )
  );
}

function MyToolbarButton() {
  const [open, setOpen] = useState(false);
  return h(Fragment, null,
    h('button', { onClick: () => setOpen(v => !v), title: 'Open My Panel' }, '🔧'),
    open && h(MyOverlay, { onClose: () => setOpen(false) })
  );
}
```

Inject custom CSS once:
```js
function injectCSS() {
  if (document.getElementById('my-plugin-styles')) return;
  const el = document.createElement('style');
  el.id = 'my-plugin-styles';
  el.textContent = `.my-button { ... }`;
  document.head.appendChild(el);
}

export async function init(ctx) {
  injectCSS();
  ctx.ui.register('toolbar', MyToolbarButton);
}
```

---

### Home-section row

Renders exactly like a catalog row. Use the same CSS class names:

```js
const lib = window.__HW_library;
const nav = window.__HW_navigation;
const { useState, useEffect, createElement: h } = window.__HW_React;

function MyHomeSection() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    lib.getWatchlist().then(setItems).catch(() => {});
    const unsub = lib.subscribeToLibrary(() =>
      lib.getWatchlist().then(setItems).catch(() => {})
    );
    return () => unsub?.();
  }, []);

  if (items.length === 0) return null;  // hide if empty

  return h('section', { className: 'catalog-row' },
    h('h2', { className: 'catalog-row__title' }, 'My Section'),
    h('div', { className: 'catalog-row__scroller' },
      items.map(item =>
        h('div', { key: item.id, className: 'poster-card-wrap',
          onClick: () => nav.openDetail?.({ id: item.id, type: item.contentType,
            name: item.title, poster: item.poster, year: item.year }),
          style: { cursor: 'pointer' } },
          h('div', { className: 'poster-card' },
            item.poster
              ? h('img', { className: 'poster-card__img', src: item.poster, loading: 'lazy' })
              : h('div', { className: 'poster-card__placeholder' }, h('span', null, item.title[0]))
          ),
          h('div', { className: 'poster-card__info' },
            h('span', { className: 'poster-card__title' }, item.title)
          )
        )
      )
    )
  );
}

export function init(ctx) {
  ctx.ui.register('home-section', MyHomeSection, { defaultGridSize: { cols: 4, rows: 2 } });
}
```

---

### PluginContext API reference

```ts
ctx.config                     // Record<string, string | number | boolean>

ctx.store.get(key)             // → Promise<string | null>
ctx.store.set(key, value)      // → Promise<void>  (value must be string)
ctx.store.delete(key)          // → Promise<void>
ctx.store.clear()              // → Promise<void>

ctx.ui.register(slot, Component, options?)
// slot: 'toolbar' | 'sidebar' | 'home-section' | 'player-overlay' | 'statusbar'
// options: { defaultGridSize?: { cols, rows }, gearPosition?: 'top-left' | 'top-right' }

ctx.commands.register({ id, label, handler })
// Adds an entry to the Command Palette (Ctrl+K)
```

`ctx.store` values are always strings. Cast on the way in and out:
```js
await ctx.store.set('count', String(42));
const count = Number(await ctx.store.get('count') ?? '0');
```

---

### Window globals

Plugins run in the same WebView as the app. These globals are set before any plugin `init()` runs:

```ts
window.__HW_React       // the React 18 instance
                        // { useState, useEffect, useRef, useMemo, useCallback,
                        //   createElement, Fragment, ... }

window.__HW_library     // user library (SQLite-backed)
  .getWatchlist()                          // → Promise<WatchlistEntry[]>
  .getWatched()                            // → Promise<WatchedEntry[]>
  .addToWatchlist(item)                    // → Promise<void>
  .removeFromWatchlist(id)                 // → Promise<void>
  .addToWatched(item)                      // → Promise<void>
  .removeFromWatched(id)                   // → Promise<void>
  .subscribeToLibrary(callback)            // → unsubscribe: () => void

window.__HW_navigation
  .openDetail(item: CatalogItem)           // opens the detail modal (same as clicking a catalog card)

window.__HW_playerBus   // event bus for player events (for player-overlay plugins)
```

**WatchlistEntry / WatchedEntry shape** (as returned by `__HW_library`):
```ts
{
  id: string
  title: string
  contentType: 'movie' | 'series'
  poster?: string
  year?: number | string
  markedAt?: string          // ISO timestamp
  lastSeason?: number        // WatchedEntry only
}
```

To open the detail modal from a `home-section` component, map to CatalogItem:
```js
nav.openDetail({
  id: entry.id,
  type: entry.contentType,   // not contentType — must be 'type'
  name: entry.title,         // not title — must be 'name'
  poster: entry.poster,
  year: entry.year,
});
```

---

### manifest.json — plugin reference

```json
{
  "type": "plugin",
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "One or two sentences.",
  "author": "your-name",
  "permissions": ["ui", "storage", "commands"],
  "variables": [
    { "key": "accentColor", "label": "Accent colour", "type": "string", "default": "#60a5fa" }
  ],
  "scripts": {
    "plugin": "plugin.js"
  }
}
```

`permissions`: declare only what you use — `"ui"`, `"storage"`, `"commands"`.

CSS-only theme (no script):
```json
{
  "type": "plugin",
  "id": "my-theme",
  "name": "My Theme",
  "version": "1.0.0",
  "description": "Custom colour theme.",
  "theme": "theme.css"
}
```

---

## Bundling

Both addon and plugin scripts must be **single self-contained files** — all dependencies inlined.

### With esbuild

```bash
npm install --save-dev esbuild
```

`package.json`:
```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --format=esm --outfile=index.js --platform=browser --target=es2020"
  }
}
```

```bash
npm run build
```

### Without a build step

If your extension has no external npm dependencies and no TypeScript, write plain JavaScript in `index.js` directly — no bundler needed.

### Important constraints

- Do **not** use `import` at the module level — bundled scripts are loaded as blob URLs, and ESM imports from remote URLs are blocked by CSP.
- Do **not** bundle React or ReactDOM. Access React via `window.__HW_React`.
- `fetch()`, `setTimeout`, `localStorage`, Web Crypto, and all standard browser APIs are available.
- `node:*` APIs are not available.

---

## Publishing

### Option A — First-party (this repository)

Extensions maintained by the same author as HephaestWatch can live directly in this repo. The build script reads `addons/` and `plugins/`, computes SHA256 checksums, maintains version history, and generates `index.json` automatically.

**Structure:**
```
addons/
  my-addon/
    manifest.json   ← required
    meta.json       ← required
    index.js        ← required for Tier-2

plugins/
  my-plugin/
    manifest.json
    meta.json
    plugin.js
```

**`meta.json`** (not part of the manifest, registry-only metadata):
```json
{
  "tags": ["catalog", "movies"],
  "author": "your-github-username",
  "authorUrl": "https://github.com/your-github-username",
  "icon": "https://...",
  "minAppVersion": "1.0.0",
  "testedOnVersion": "1.2.0",
  "requires": ["tmdb-source"],
  "recommends": ["watchlist", "watch-history"],
  "experimental": false,
  "deprecated": false,
  "replacedBy": ""
}
```

All `meta.json` fields except `tags` are optional.

After merging, the GitHub Actions workflow runs `node scripts/build-index.mjs` and commits the updated `index.json`.

---

### Option B — Community extension (external repository)

Host your extension in your own GitHub repository. Publish a release and submit a PR that adds one entry to `community.json`.

**Your repository must contain:**
```
your-repo/
  manifest.json
  index.js        (or plugin.js for plugins)
  icon.png        (optional but recommended)
```

**Create a GitHub Release** tagged `v1.0.0`. Attach your bundle as a release asset, or rely on the tag-pinned jsDelivr URL.

**Add an entry to `community.json`:**
```json
{
  "id": "my-community-addon",
  "type": "addon",
  "name": "My Addon",
  "description": "Fetches movies from My Source.",
  "author": "your-github-username",
  "authorUrl": "https://github.com/your-github-username",
  "repo": "your-github-username/hw-my-addon",
  "tags": ["catalog", "movies"],
  "latestVersion": "1.0.0",
  "manifestUrl": "https://cdn.jsdelivr.net/gh/your-github-username/hw-my-addon@1.0.0/manifest.json",
  "bundleUrl":   "https://cdn.jsdelivr.net/gh/your-github-username/hw-my-addon@1.0.0/index.js",
  "sha256": "optional-sha256-hex-of-index.js"
}
```

Open a PR titled **"Add: My Addon Name"**.

**URL rules — strictly enforced by the build script:**

| Pattern | Allowed |
|---|---|
| `cdn.jsdelivr.net/gh/USER/REPO@1.0.0/file` | ✅ pinned version tag |
| `github.com/USER/REPO/releases/download/v1.0.0/file` | ✅ GitHub release asset |
| `raw.githubusercontent.com/USER/REPO/main/file` | ❌ mutable branch |
| `cdn.jsdelivr.net/gh/USER/REPO@latest/file` | ❌ not pinned |

PRs with unpinned URLs are rejected by CI. The build script automatically adds the `release-pinned` tag to entries with pinned URLs.

#### jsDelivr CDN

jsDelivr serves GitHub tag-pinned files with permanent caching and full CORS support.

```
https://cdn.jsdelivr.net/gh/USERNAME/REPO@VERSION/FILENAME
```

Example:
```
https://cdn.jsdelivr.net/gh/acme/hw-movies@2.1.0/manifest.json
https://cdn.jsdelivr.net/gh/acme/hw-movies@2.1.0/index.js
```

---

### Option C — Standalone distribution (no marketplace)

The app can load any addon or plugin directly from a URL without going through the Marketplace index. Useful for private or work-in-progress extensions.

In the app: **Settings → Load Extension from URL** — paste the URL of a `manifest.json`.

The manifest URL can be:
- A jsDelivr CDN URL (recommended for sharing)
- A local development server (`http://localhost:3000/manifest.json`)
- Any publicly accessible HTTPS URL

The app fetches the manifest, reads `scripts.addon` or `scripts.plugin` relative to the manifest URL, and loads the bundle. No PR or registry entry needed.

---

## Publishing updates

### First-party extension

1. Edit the extension code.
2. Bump `"version"` in `manifest.json` (minor bump for features, major for breaking changes).
3. Commit. The GitHub Actions workflow rebuilds `index.json` and appends a new entry to the `versions` array automatically.

### Community extension

1. Edit your extension in your own repository.
2. Bump `"version"` in your `manifest.json`.
3. Rebuild: `npm run build`.
4. Create a new GitHub Release tagged with the new version (e.g. `v1.1.0`).
5. Submit a PR to this repository updating `"latestVersion"` and the CDN URLs in `community.json` to the new tag.

Users with the extension installed see an update badge in the Marketplace. The old version entry is preserved in `versions` — rollback is possible once the app implements version-history UI.

---

## Version history

Every time `index.json` is rebuilt, the build script checks whether the current `manifest.json` version is already in the `versions` array. If not, it prepends a new entry. History accumulates and is never overwritten.

```json
{
  "latestVersion": "1.2.0",
  "sha256": "abc123...",
  "versions": [
    {
      "version": "1.2.0",
      "manifestUrl": "https://raw.githubusercontent.com/.../manifest.json",
      "bundleUrl":   "https://raw.githubusercontent.com/.../index.js",
      "sha256": "abc123...",
      "date": "2026-06-26"
    },
    {
      "version": "1.1.0",
      "manifestUrl": "...",
      "bundleUrl": "...",
      "sha256": "def456...",
      "date": "2026-05-10"
    }
  ]
}
```

---

## Verification

| Status | Meaning |
|---|---|
| **Verified** ✓ | Maintainer has reviewed the source code |
| **Community** (no badge) | Submitted by a third party, not reviewed |

Community extensions start unverified. To request a code review and the verified badge, open an issue referencing your PR after it is merged.

For community extensions, `"verified": false` is set by the build script and cannot be overridden in a PR. A maintainer adds the ID to `verified.json` after manual review.

---

## meta.json reference

`meta.json` sits next to `manifest.json` for first-party extensions. It is not loaded by the app — it provides registry-only metadata consumed by the build script.

| Field | Type | Default | Description |
|---|---|---|---|
| `tags` | `string[]` | — | **Required.** One or more from the list below |
| `author` | `string` | — | GitHub username |
| `authorUrl` | `string` | — | Profile URL |
| `icon` | `string` | — | Square icon URL (min 64×64 px) |
| `minAppVersion` | `string` | — | Minimum HephaestWatch version required |
| `testedOnVersion` | `string` | — | App version this was last tested against (informational only) |
| `requires` | `string[]` | — | IDs of extensions that **must** be installed first |
| `recommends` | `string[]` | — | IDs of extensions that work well alongside this one |
| `experimental` | `boolean` | `false` | App shows a warning before installation |
| `deprecated` | `boolean` | `false` | App shows a deprecation banner |
| `replacedBy` | `string` | — | ID of the successor extension (requires `deprecated: true`) |

### Available tags

`catalog` `streams` `metadata` `theme` `ui` `player` `tools` `movies` `series` `anime` `sports` `live` `adult` `open-source` `requires-account` `release-pinned` `pack` `experimental`

`release-pinned` is set automatically by the build script for community entries with pinned URLs. Do not set it manually.

---

## Dependency declarations

`requires` and `recommends` in `meta.json` / `community.json` take extension IDs:

```json
{
  "requires": ["tmdb-source"],
  "recommends": ["watchlist", "watch-history"]
}
```

The build script validates that all listed IDs exist in the registry. Circular dependencies produce a warning but do not fail the build — cycle resolution is handled by the app at install time.

`requires` — the app will prompt the user to install missing dependencies before installing this extension.
`recommends` — shown as "you might also want" suggestions, never auto-installed.

---

## Repository layout

```
addons/                      ← first-party addons
  tmdb-source/
    manifest.json
    meta.json
    index.js
  ...

plugins/                     ← first-party plugins
  watchlist/
    manifest.json
    meta.json
    plugin.js
  ...

community.json               ← external extension links (pinned URLs only)
index.json                   ← generated; do not edit by hand
tags.json                    ← allowed tag values
verified.json                ← IDs of verified extensions
featured.json                ← IDs of featured extensions
scripts/
  build-index.mjs            ← generates index.json from addons/, plugins/, community.json
FEATURES.md                  ← roadmap: what's implemented vs. what belongs in the main app
```

`index.json` is generated by `node scripts/build-index.mjs`. Never edit it by hand — changes are overwritten on the next build.
