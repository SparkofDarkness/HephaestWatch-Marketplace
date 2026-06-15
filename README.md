# HephaestWatch Marketplace

The official extension registry for [HephaestWatch](https://github.com/SparkofDarkness/HephaestWatch) — a local-first media player built on Tauri + React.

Extensions are fetched directly in the app via **Marketplace → Browse**.

---

## Extension Types

| Type | What it does |
|---|---|
| **Addon** | Provides content — catalogs (movie/series lists) and stream resolvers |
| **Plugin** | Modifies the UI — themes, sidebar widgets, player overlays, commands |

---

## Verified vs. Community

| | Verified ✓ | Community |
|---|---|---|
| Badge | ✓ green badge | none |
| Code reviewed | Yes, by maintainers | No |
| Safe to install | High confidence | Use at your own risk |
| How | Maintainer sets `"verified": true` after review | Anyone can submit |

You can filter by verified status in the app's Marketplace panel.

---

## Allowed Tags

Use only these tags in your `index.json` entry. Multiple tags are allowed.

`catalog` `streams` `metadata` `theme` `ui` `player` `tools` `movies` `series` `anime` `sports`

---

## How to Submit Your Extension

### Step 1 — Publish your extension on GitHub

Create a **public GitHub repository** with your extension files (see the publishing guide below).  
Create a **GitHub Release** tagged `v1.0.0` and attach your bundled `index.js` as a release asset.

Your bundle URL will be:
```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@1.0.0/index.js
```

### Step 2 — Add an entry to `index.json`

Fork this repository and add your extension to the correct array in `index.json`:

```json
{
  "id": "my-addon",
  "name": "My Addon",
  "description": "Short description of what it does (1–2 sentences).",
  "author": "your-github-username",
  "authorUrl": "https://github.com/your-github-username",
  "repo": "your-github-username/your-repo",
  "tags": ["catalog", "movies"],
  "verified": false,
  "featured": false,
  "latestVersion": "1.0.0",
  "manifestUrl": "https://cdn.jsdelivr.net/gh/your-github-username/your-repo@1.0.0/manifest.json",
  "bundleUrl": "https://cdn.jsdelivr.net/gh/your-github-username/your-repo@1.0.0/index.js",
  "icon": "https://cdn.jsdelivr.net/gh/your-github-username/your-repo@1.0.0/icon.png",
  "screenshots": [],
  "minAppVersion": "0.1.0"
}
```

**Rules:**
- `"verified"` must be `false` — maintainers set this after reviewing your code.
- `"id"` must be globally unique. Use a descriptive name like `tmdb-extras` not `addon1`.
- `"description"` must be in English.
- `"bundleUrl"` can be omitted for Tier-1 declarative addons (no script needed).

### Step 3 — Open a Pull Request

Submit a PR to this repository. The title should be: `Add: My Addon Name`.

A maintainer will review your submission and either:
- Merge it as `"verified": false` (community listing)
- Request changes
- Set `"verified": true` after a thorough code review

---

## Publishing Guide for Developers

### Repository Structure

Your GitHub repo must contain at minimum:

```
your-repo/
├── manifest.json       ← required
├── index.js            ← required for Tier-2 (scripted) extensions
├── icon.png            ← recommended (square, min 64×64px)
└── README.md           ← recommended
```

---

### manifest.json — Addon

```json
{
  "type": "addon",
  "id": "my-addon",
  "name": "My Addon",
  "version": "1.0.0",
  "description": "Provides a catalog of movies from My Source.",
  "author": "your-github-username",
  "logo": "./icon.png",
  "provides": ["catalog", "streams"],
  "catalogs": [
    {
      "id": "my-catalog",
      "name": "My Movies",
      "type": "movie",
      "searchable": true
    }
  ],
  "variables": [
    {
      "key": "apiKey",
      "label": "API Key",
      "type": "string",
      "default": "",
      "description": "Your API key from mysource.com",
      "secret": true
    }
  ],
  "scripts": {
    "addon": "./index.js"
  }
}
```

**`provides`** — declare what your addon provides:
- `"catalog"` — registers catalog rows in the home/browse view
- `"streams"` — resolves stream URLs for content items

**`variables`** — user-configurable settings. Rendered as a form in the app. Set `"secret": true` for API keys (renders as password input).

**`scripts.addon`** — path to your compiled ES module. Omit entirely for Tier-1 declarative addons.

---

### manifest.json — Plugin

```json
{
  "type": "plugin",
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Adds a sidebar widget.",
  "author": "your-github-username",
  "permissions": ["ui", "storage", "commands"],
  "variables": [
    {
      "key": "showBadge",
      "label": "Show badge",
      "type": "boolean",
      "default": true
    }
  ],
  "scripts": {
    "plugin": "./index.js"
  }
}
```

**`permissions`** — declare what APIs your plugin uses:
- `"ui"` — register React components in UI slots (`sidebar`, `toolbar`, `main`, `statusbar`, `player-overlay`)
- `"storage"` — read/write to the per-plugin SQLite store
- `"commands"` — register entries in the Command Palette (Ctrl+K)

For a **CSS-only theme plugin**, omit `scripts` and use `"theme"` instead:

```json
{
  "type": "plugin",
  "id": "my-theme",
  "name": "My Dark Theme",
  "version": "1.0.0",
  "theme": "./theme.css"
}
```

---

### Tier-1 vs. Tier-2

| | Tier 1 — Declarative | Tier 2 — Scripted |
|---|---|---|
| Script needed | No | Yes |
| Use when | Static stream URL with variables | Dynamic API calls, catalogs, complex logic |
| Bundle | Not needed | Required |
| Example | Direct stream URL with auth token | Fetches from an API, parses results |

**Tier-1 addon** (no script, just a URL template):

```json
{
  "type": "addon",
  "id": "my-stream",
  "name": "My Stream",
  "version": "1.0.0",
  "provides": ["streams"],
  "variables": [
    { "key": "streamUrl", "label": "Stream URL", "type": "string", "default": "" }
  ],
  "streams": [
    { "type": "hls", "url": "{{streamUrl}}", "title": "My Stream" }
  ]
}
```

No `bundleUrl` needed in your marketplace entry for Tier-1 addons.

---

### Writing a Tier-2 Script

Your `index.js` must be a **single bundled ES module** that exports `init()`.

#### Addon example

```javascript
// index.js (source — bundle this with esbuild)
export async function init(ctx) {
  const { apiKey } = ctx.config;

  ctx.content.registerCatalog({
    id: 'my-catalog',
    name: 'My Movies',
    type: 'movie',
    async fetch({ genre, search } = {}) {
      const url = `https://api.example.com/movies?key=${apiKey}&q=${search ?? ''}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.results.map(item => ({
        id: `tt${item.imdbId}`,
        title: item.title,
        type: 'movie',
        year: item.year,
        poster: item.poster,
        imdbId: item.imdbId,
      }));
    },
  });

  ctx.content.registerResolver({
    id: 'my-resolver',
    async resolve(contentId, type, item) {
      const res = await fetch(`https://api.example.com/streams/${item?.imdbId}?key=${apiKey}`);
      const data = await res.json();
      return data.streams.map(s => ({
        title: s.label,
        url: s.url,
        type: 'http',
        quality: s.quality,
      }));
    },
  });
}

export async function teardown() {
  // Optional cleanup when user disables the addon
}
```

#### Plugin example

```javascript
// index.js (source — bundle this with esbuild)
export async function init(ctx) {
  // Register a command in the Command Palette
  ctx.commands.register({
    id: 'my-plugin:hello',
    label: 'Say Hello',
    handler: () => alert('Hello from My Plugin!'),
  });

  // Register a React component in the sidebar
  ctx.ui.register({
    slot: 'sidebar',
    component: () => {
      // Minimal React — createElement since JSX needs a build step
      const { createElement: h, useState } = window.React ?? {};
      if (!h) return null;
      return h('div', { style: { padding: '0.5rem', color: 'var(--text-dim)' } }, 'My Plugin');
    },
  });

  // Persist data
  await ctx.store.set('lastRun', Date.now());
}
```

> **Note:** The script runs inside Tauri's WebView sandbox. You can use `fetch()`, Web APIs, and ES modules. You cannot `import` from external URLs — all dependencies must be bundled into the single `index.js` file.

---

### Bundling with esbuild

Install esbuild in your project:

```bash
npm install --save-dev esbuild
```

Add a build script to your `package.json`:

```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --format=esm --outfile=index.js --platform=browser --target=es2020"
  }
}
```

Build before every GitHub release:

```bash
npm run build
```

Then create a GitHub Release tagged `v1.0.0` and upload the built `index.js`.

#### Alternative: no build step

If your addon has no external dependencies and no TypeScript, you can write plain JavaScript directly in `index.js` and skip the bundling step entirely.

---

### Updating Your Extension

1. Bump the `"version"` field in `manifest.json`
2. Rebuild your bundle: `npm run build`
3. Create a new GitHub Release tagged `v1.1.0`
4. Submit a PR to this repo updating `"latestVersion"` and the CDN URLs to the new tag

Users with the extension installed will see an update badge in the Marketplace.

---

### CDN URLs

HephaestWatch uses **jsDelivr** to serve extension files. jsDelivr serves GitHub releases with no rate limits and full CORS support.

URL pattern:
```
https://cdn.jsdelivr.net/gh/USERNAME/REPO@VERSION/FILENAME
```

Example:
```
https://cdn.jsdelivr.net/gh/acme/hw-addon-tmdb@2.1.0/manifest.json
https://cdn.jsdelivr.net/gh/acme/hw-addon-tmdb@2.1.0/index.js
```

> ⚠️ Always pin to an exact version tag (e.g. `@2.1.0`), not `@latest` or a branch name. Pinned URLs are cached permanently by jsDelivr; unpinned URLs may serve stale content.

---

## Questions?

Open an issue in this repository or in the main [HephaestWatch](https://github.com/SparkofDarkness/HephaestWatch) repo.
