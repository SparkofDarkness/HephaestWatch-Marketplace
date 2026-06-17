// Test Addon — exercises every feature of the AddonContext API.
//
// Tested features:
//   ctx.config                             — read variables (apiKey, maxResults, showDebug)
//   ctx.store.set / get / delete / clear   — namespaced SQLite persistence
//   ctx.getAddonConfig('tmdb-source')      — read another addon's config
//   ctx.getAddonStore('tmdb-source')       — read another addon's SQLite store
//   ctx.content.registerCatalog()          — movie catalog + series catalog, both searchable
//   ctx.content.registerResolver()         — streams for movies + series episodes
//   ctx.content.registerMetadataProvider() — seasons, episodes, prefetchDetails
//   teardown()                             — cleanup on disable
//
// This file is a pre-compiled ESM bundle (no external imports).
// Drop it next to manifest.json and the app loads it via blob: URL.

// ---------------------------------------------------------------------------
// Fake data — replaces a real API call in a production addon
// ---------------------------------------------------------------------------

const MOVIES = [
  {
    id: 'test:movie:1', type: 'movie', name: 'Test Movie Alpha',
    year: 2024, rating: 8.2, description: 'Catalog registration test — movie 1.',
    poster: 'https://picsum.photos/seed/alpha/300/450',
    genres: ['Action', 'Sci-Fi'],
  },
  {
    id: 'test:movie:2', type: 'movie', name: 'Test Movie Beta',
    year: 2023, rating: 7.5, description: 'Catalog registration test — movie 2.',
    poster: 'https://picsum.photos/seed/beta/300/450',
    genres: ['Drama'],
  },
  {
    id: 'test:movie:3', type: 'movie', name: 'Test Movie Gamma',
    year: 2025, rating: 9.1, description: 'Catalog registration test — movie 3.',
    poster: 'https://picsum.photos/seed/gamma/300/450',
    genres: ['Comedy', 'Action'],
  },
];

const SERIES = [
  {
    id: 'test:series:1', type: 'series', name: 'Test Series One',
    year: 2022, rating: 8.8, description: 'Metadata provider test — 2 seasons, 5 episodes.',
    poster: 'https://picsum.photos/seed/series1/300/450',
    genres: ['Drama', 'Thriller'],
  },
];

const SEASONS = {
  'test:series:1': [
    { number: 1, name: 'Season 1', episodeCount: 3, episodes: [] },
    { number: 2, name: 'Season 2', episodeCount: 2, episodes: [] },
  ],
};

const EPISODES = {
  'test:series:1:1': [
    { number: 1, name: 'Pilot',              description: 'The very first episode.', airDate: '2022-01-10' },
    { number: 2, name: 'The Second Chapter', description: 'Things heat up.',         airDate: '2022-01-17' },
    { number: 3, name: 'Season Finale',      description: 'Season 1 ends here.',     airDate: '2022-01-24' },
  ],
  'test:series:1:2': [
    { number: 1, name: 'New Beginnings', description: 'Season 2 opener.',  airDate: '2023-03-05' },
    { number: 2, name: 'The End',        description: 'Series finale.',    airDate: '2023-03-12' },
  ],
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function init(ctx) {
  const debug = ctx.config.showDebug;
  const log = debug ? (...a) => console.log('[TestAddon]', ...a) : () => {};

  log('init() called');
  log('config:', ctx.config);

  // ── 1. Store — test all four operations ──────────────────────────────────
  const prevBoots = (await ctx.store.get('boot-count')) ?? 0;
  await ctx.store.set('boot-count', prevBoots + 1);
  log(`store: boot-count = ${prevBoots + 1} ✓`);

  await ctx.store.set('last-init', new Date().toISOString());
  log('store: last-init written ✓');

  await ctx.store.set('will-be-deleted', 'temporary value');
  await ctx.store.delete('will-be-deleted');
  const gone = await ctx.store.get('will-be-deleted');
  log('store: delete worked:', gone === null, '✓');

  // ── 2. Cross-addon config ─────────────────────────────────────────────────
  const tmdbConfig = ctx.getAddonConfig('tmdb-source');
  log('cross-addon config (tmdb-source):', tmdbConfig);
  log('tmdb apiKey present:', !!tmdbConfig.apiKey, '✓');

  // ── 3. Cross-addon store (read-only) ─────────────────────────────────────
  const tmdbStore = ctx.getAddonStore('tmdb-source');
  const cachedImdb = await tmdbStore.get('imdb:movie:550'); // Fight Club — cached by TMDB addon
  log('cross-addon store (tmdb-source) imdb:movie:550 =', cachedImdb, '(null if not cached yet)');

  // ── 4. Catalog: movies ────────────────────────────────────────────────────
  ctx.content.registerCatalog({
    id: 'test-addon:movies',
    name: 'Test Movies',
    type: 'movie',
    searchable: true,
    defaultGridSize: { cols: 3, rows: 1 },
    supportedFilters: ['genre', 'year_from', 'year_to', 'rating_min'],
    async fetch(opts) {
      log('catalog:movies fetch — opts:', opts);
      let items = MOVIES;
      if (opts?.search) {
        const q = opts.search.toLowerCase();
        items = items.filter(m => m.name.toLowerCase().includes(q));
      }
      const max = typeof ctx.config.maxResults === 'number' ? ctx.config.maxResults : 10;
      return items.slice(0, max);
    },
    async fetchWithFilters(filters, opts) {
      log('catalog:movies fetchWithFilters — filters:', filters, 'opts:', opts);
      let items = MOVIES;
      if (filters.genre) {
        items = items.filter(m => m.genres?.includes(filters.genre));
      }
      if (filters.year_from) {
        items = items.filter(m => m.year >= Number(filters.year_from));
      }
      if (filters.year_to) {
        items = items.filter(m => m.year <= Number(filters.year_to));
      }
      if (filters.rating_min) {
        items = items.filter(m => (m.rating ?? 0) >= Number(filters.rating_min));
      }
      const max = typeof ctx.config.maxResults === 'number' ? ctx.config.maxResults : 10;
      return items.slice(0, max);
    },
  });

  // ── 5. Catalog: series ────────────────────────────────────────────────────
  ctx.content.registerCatalog({
    id: 'test-addon:series',
    name: 'Test Series',
    type: 'series',
    searchable: true,
    defaultGridSize: { cols: 3, rows: 1 },
    supportedFilters: ['genre', 'year_from', 'year_to', 'rating_min'],
    async fetch(opts) {
      log('catalog:series fetch — opts:', opts);
      if (opts?.search) {
        const q = opts.search.toLowerCase();
        return SERIES.filter(s => s.name.toLowerCase().includes(q));
      }
      return SERIES;
    },
    async fetchWithFilters(filters, opts) {
      log('catalog:series fetchWithFilters — filters:', filters, 'opts:', opts);
      let items = SERIES;
      if (filters.genre) {
        items = items.filter(s => s.genres?.includes(filters.genre));
      }
      if (filters.year_from) {
        items = items.filter(s => s.year >= Number(filters.year_from));
      }
      if (filters.year_to) {
        items = items.filter(s => s.year <= Number(filters.year_to));
      }
      if (filters.rating_min) {
        items = items.filter(s => (s.rating ?? 0) >= Number(filters.rating_min));
      }
      return items;
    },
  });

  // ── 6. Stream resolver ────────────────────────────────────────────────────
  ctx.content.registerResolver({
    id: 'test-addon:resolver',
    async resolve(contentId, type, item, episode) {
      log('resolver called:', contentId, type, episode ?? '(no episode)');

      if (type === 'movie') {
        return [
          {
            title: '1080p HTTP — Big Buck Bunny (test)',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            type: 'http',
            quality: '1080p',
            size: '158 MB',
          },
          {
            title: '720p HTTP — Elephants Dream (test)',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            type: 'http',
            quality: '720p',
            size: '84 MB',
          },
        ];
      }

      if (type === 'series' && episode) {
        return [
          {
            title: `S${String(episode.season).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')} — Test HLS Stream`,
            url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
            type: 'hls',
            quality: '1080p',
          },
        ];
      }

      return [];
    },
  });

  // ── 7. Metadata provider ──────────────────────────────────────────────────
  ctx.content.registerMetadataProvider({
    id: 'test-addon:metadata',

    async fetchSeasons(contentId, type) {
      log('fetchSeasons:', contentId, type);
      if (type !== 'series') return [];
      return SEASONS[contentId] ?? [];
    },

    async fetchEpisodes(contentId, seasonNumber) {
      log('fetchEpisodes:', contentId, 'season', seasonNumber);
      const key = `${contentId}:${seasonNumber}`;
      return EPISODES[key] ?? [];
    },

    async prefetchDetails(contentId, type) {
      log('prefetchDetails (fire-and-forget):', contentId, type);
      // Cache a fake IMDb ID so stream resolvers could find it via ctx.getAddonStore
      await ctx.store.set(`imdb-cache:${type}:${contentId}`, 'tt9999999');
      log('prefetchDetails: wrote imdb-cache entry ✓');
    },
  });

  log('init complete ✓ — 2 catalogs, 1 resolver, 1 metadata provider registered');
}

export async function teardown() {
  console.log('[TestAddon] teardown() called — writing final store entry');
  // ctx is not available in teardown — store is already cleaned up by the manager.
  // Use this for cancelling timers, closing connections, etc.
}
