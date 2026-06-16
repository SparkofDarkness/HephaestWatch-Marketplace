// Torrentio Addon — stream resolver.
// Pre-compiled ESM bundle (no external imports). Load via blob: URL.

const TORRENTIO_BASE = 'https://torrentio.strem.fun';
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function resolveImdbId(contentId, type, item, ctx) {
  if (item?.imdbId) return item.imdbId;
  if (contentId.startsWith('tt')) return contentId;

  const tmdbMatch = contentId.match(/^tmdb:(movie|series):(\d+)$/);
  if (!tmdbMatch) return null;

  const tmdbId = tmdbMatch[2];
  const cacheKey = `imdb-cache:${type}:${tmdbId}`;

  const cached = await ctx.store.get(cacheKey);
  if (cached) return cached;

  const tmdbAddonStoreKey = `imdb:${type === 'series' ? 'series' : 'movie'}:${tmdbId}`;
  const fromTmdbStore = await ctx.getAddonStore('tmdb-source').get(tmdbAddonStoreKey);
  if (fromTmdbStore) {
    console.log('[Torrentio] imdbId from tmdb-source store: %s → %s', tmdbAddonStoreKey, fromTmdbStore);
    await ctx.store.set(cacheKey, fromTmdbStore);
    return fromTmdbStore;
  }

  const apiKey = ((ctx.getAddonConfig('tmdb-source')['apiKey']) || '').trim()
    || ((ctx.config['tmdbApiKey']) || '').trim();
  if (!apiKey) {
    console.warn('[Torrentio] No TMDB API key — enter your key in the TMDB addon settings.');
    return null;
  }

  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const isV4Bearer = apiKey.startsWith('eyJ');
  const url = isV4Bearer
    ? `${TMDB_BASE}/${endpoint}/${tmdbId}/external_ids`
    : `${TMDB_BASE}/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`;
  const headers = { 'Accept': 'application/json' };
  if (isV4Bearer) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn('[Torrentio] TMDB external_ids HTTP %d for tmdbId=%s — %s',
      res.status, tmdbId, body.slice(0, 120));
    return null;
  }

  const data = await res.json();
  const imdbId = data.imdb_id ?? null;
  console.log('[Torrentio] tmdbId=%s → imdbId=%s', tmdbId, imdbId ?? '(null)');

  if (imdbId) {
    await ctx.store.set(cacheKey, imdbId);
  }
  return imdbId;
}

function buildTorrentioUrl(providers, qualityFilter) {
  const parts = [];
  if (providers) parts.push(`providers=${providers}`);
  if (qualityFilter) parts.push(`qualityfilter=${qualityFilter}`);
  const config = parts.join('|');
  return config ? `${TORRENTIO_BASE}/${config}` : TORRENTIO_BASE;
}

function parseTorrentioStreams(raw) {
  return raw
    .filter(s => s.infoHash || s.url)
    .map(s => {
      const url = s.url ?? `magnet:?xt=urn:btih:${s.infoHash}&dn=${encodeURIComponent(s.title ?? '')}`;
      const nameParts = (s.name ?? '').split('\n');
      const qualityLine = nameParts[1] ?? '';
      const quality = ['4K', '1080p', '720p', '480p', 'SD'].find(q => qualityLine.includes(q));
      const seederMatch = (s.title ?? '').match(/👤\s*(\d+)/);
      const seeders = seederMatch ? Number(seederMatch[1]) : undefined;
      const sizeMatch = (s.title ?? '').match(/💾\s*([\d.]+ [KMGT]B)/);
      const size = sizeMatch ? sizeMatch[1] : undefined;
      return { title: s.name ?? 'Unknown', url, type: 'torrent', quality, size, seeders };
    })
    .sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0));
}

export function init(ctx) {
  ctx.content.registerResolver({
    id: 'torrentio:resolver',

    async resolve(contentId, type, item, episode) {
      console.log('[Torrentio] resolve contentId=%s type=%s episode=%o', contentId, type, episode ?? null);

      const imdbId = await resolveImdbId(contentId, type, item, ctx);
      if (!imdbId) {
        const apiKey = ((ctx.getAddonConfig('tmdb-source')['apiKey']) || '').trim()
          || ((ctx.config['tmdbApiKey']) || '').trim();
        if (!apiKey) {
          throw new Error('No TMDB API key — enter your key in the TMDB addon settings.');
        }
        throw new Error(
          `IMDb ID lookup failed for "${contentId}". ` +
          `Check the browser console for the TMDB HTTP status, ` +
          `or open an episode detail first so the TMDB addon can pre-cache the ID.`
        );
      }

      const providers  = ctx.config['providers']     || '';
      const qualFilter = ctx.config['qualityFilter'] || '';
      const baseUrl    = buildTorrentioUrl(providers, qualFilter);

      const stremioId = type === 'series'
        ? `${imdbId}:${episode?.season ?? 1}:${episode?.episode ?? 1}`
        : imdbId;
      const stremioType = type === 'series' ? 'series' : 'movie';

      const fetchUrl = `${baseUrl}/stream/${stremioType}/${stremioId}.json`;
      console.log('[Torrentio] fetching %s', fetchUrl);

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Torrentio API error: HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      const streams = parseTorrentioStreams(data.streams ?? []);
      console.log('[Torrentio] got %d streams for %s', streams.length, stremioId);
      return streams;
    },
  });
}

export function teardown() {}
