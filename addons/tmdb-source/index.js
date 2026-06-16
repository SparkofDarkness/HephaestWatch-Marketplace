// TMDB Addon — provides movie and series catalogs from The Movie Database API.
// Pre-compiled ESM bundle (no external imports). Load via blob: URL.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE  = 'https://image.tmdb.org/t/p/w500';

async function tmdbFetch(apiKey, path, params = {}) {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error('No TMDB API key set — open Addons → ⚙ Configure and enter your key from themoviedb.org/settings/api');
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const isV4Bearer = key.startsWith('eyJ');
  const headers = { 'Accept': 'application/json' };
  if (isV4Bearer) {
    headers['Authorization'] = `Bearer ${key}`;
  } else {
    url.searchParams.set('api_key', key);
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text().then(t => t.slice(0, 120))}`);
  return res.json();
}

function mapMovie(item) {
  return {
    id: `tmdb:movie:${item.id}`,
    type: 'movie',
    name: item.title ?? item.original_title,
    poster:   item.poster_path   ? `${IMG_BASE}${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
    year:     item.release_date  ? Number(item.release_date.slice(0, 4)) : undefined,
    rating:   item.vote_average  ? Math.round(item.vote_average * 10) / 10 : undefined,
    description: item.overview,
  };
}

function mapSeries(item) {
  return {
    id: `tmdb:series:${item.id}`,
    type: 'series',
    name: item.name ?? item.original_name,
    poster:   item.poster_path   ? `${IMG_BASE}${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
    year:     item.first_air_date ? Number(item.first_air_date.slice(0, 4)) : undefined,
    rating:   item.vote_average   ? Math.round(item.vote_average * 10) / 10 : undefined,
    description: item.overview,
  };
}

export function init(ctx) {
  const key  = () => ctx.config['apiKey'];
  const lang = () => ctx.config['language'] || 'en-US';

  ctx.content.registerCatalog({
    id: 'tmdb:popular-movies',
    name: 'Popular Movies',
    type: 'movie',
    async fetch(opts = {}) {
      if (opts.search) {
        const d = await tmdbFetch(key(), '/search/movie', { language: lang(), query: opts.search });
        return d?.results?.map(mapMovie) ?? [];
      }
      const d = await tmdbFetch(key(), '/movie/popular', { language: lang(), page: String(opts.page ?? 1) });
      return d?.results?.map(mapMovie) ?? [];
    },
  });

  ctx.content.registerCatalog({
    id: 'tmdb:top-rated-movies',
    name: 'Top Rated Movies',
    type: 'movie',
    async fetch(opts = {}) {
      const d = await tmdbFetch(key(), '/movie/top_rated', { language: lang(), page: String(opts.page ?? 1) });
      return d?.results?.map(mapMovie) ?? [];
    },
  });

  ctx.content.registerCatalog({
    id: 'tmdb:popular-series',
    name: 'Popular Series',
    type: 'series',
    async fetch(opts = {}) {
      if (opts.search) {
        const d = await tmdbFetch(key(), '/search/tv', { language: lang(), query: opts.search });
        return d?.results?.map(mapSeries) ?? [];
      }
      const d = await tmdbFetch(key(), '/tv/popular', { language: lang(), page: String(opts.page ?? 1) });
      return d?.results?.map(mapSeries) ?? [];
    },
  });

  ctx.content.registerCatalog({
    id: 'tmdb:trending-movies',
    name: 'Trending This Week',
    type: 'movie',
    async fetch() {
      const d = await tmdbFetch(key(), '/trending/movie/week', { language: lang() });
      return d?.results?.map(mapMovie) ?? [];
    },
  });

  ctx.content.registerMetadataProvider({
    id: 'tmdb:metadata',

    async prefetchDetails(contentId, type) {
      if (type !== 'movie') return;
      const tmdbMatch = contentId.match(/^tmdb:movie:(\d+)$/);
      if (!tmdbMatch) return;
      const tmdbId = tmdbMatch[1];

      const existing = await ctx.store.get(`imdb:movie:${tmdbId}`);
      if (existing) return;

      try {
        const data = await tmdbFetch(key(), `/movie/${tmdbId}`, {
          append_to_response: 'external_ids',
        });
        const imdbId = data?.external_ids?.imdb_id ?? null;
        if (imdbId) {
          await ctx.store.set(`imdb:movie:${tmdbId}`, imdbId);
          console.log('[TMDB] prefetched imdb_id=%s for tmdb:movie:%s', imdbId, tmdbId);
        }
      } catch (err) {
        console.warn('[TMDB] prefetchDetails failed for tmdb:movie:%s', tmdbId, err);
      }
    },

    async fetchSeasons(contentId, type) {
      if (type !== 'series') return [];
      const tmdbMatch = contentId.match(/^tmdb:series:(\d+)$/);
      if (!tmdbMatch) return [];
      const tmdbId = tmdbMatch[1];

      const data = await tmdbFetch(key(), `/tv/${tmdbId}`, {
        language: lang(),
        append_to_response: 'external_ids',
      });
      if (!data?.seasons) return [];

      const imdbId = data.external_ids?.imdb_id ?? null;
      if (imdbId) {
        ctx.store.set(`imdb:series:${tmdbId}`, imdbId).catch(() => {});
        console.log('[TMDB] cached imdb_id=%s for tmdb:series:%s', imdbId, tmdbId);
      }

      return data.seasons
        .filter(s => s.season_number > 0)
        .map(s => ({
          number: s.season_number,
          name: s.name || `Season ${s.season_number}`,
          episodeCount: s.episode_count,
          episodes: [],
          poster: s.poster_path ? `${IMG_BASE}${s.poster_path}` : undefined,
        }));
    },

    async fetchEpisodes(contentId, seasonNumber) {
      const tmdbMatch = contentId.match(/^tmdb:series:(\d+)$/);
      if (!tmdbMatch) return [];
      const tmdbId = tmdbMatch[1];
      const data = await tmdbFetch(key(), `/tv/${tmdbId}/season/${seasonNumber}`, { language: lang() });
      if (!data?.episodes) return [];
      return data.episodes.map(ep => ({
        number: ep.episode_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        description: ep.overview || undefined,
        stillImage: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : undefined,
        airDate: ep.air_date || undefined,
      }));
    },
  });
}

export function teardown() {}
