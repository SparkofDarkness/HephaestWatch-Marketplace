// TMDB Addon — provides movie and series catalogs from The Movie Database API.
// Pre-compiled ESM bundle (no external imports). Load via blob: URL.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE  = 'https://image.tmdb.org/t/p/w500';

// Genre name → TMDB ID mappings (movie and TV have different IDs for some genres)
const MOVIE_GENRE_IDS = {
  'Action': 28, 'Adventure': 12, 'Animation': 16, 'Comedy': 35,
  'Crime': 80, 'Documentary': 99, 'Drama': 18, 'Family': 10751,
  'Fantasy': 14, 'History': 36, 'Horror': 27, 'Music': 10402,
  'Mystery': 9648, 'Romance': 10749, 'Science Fiction': 878, 'Sci-Fi': 878,
  'Thriller': 53, 'War': 10752, 'Western': 37,
};

const TV_GENRE_IDS = {
  'Action': 10759, 'Adventure': 10759, 'Animation': 16, 'Comedy': 35,
  'Crime': 80, 'Documentary': 99, 'Drama': 18, 'Family': 10751,
  'Kids': 10762, 'Mystery': 9648, 'Reality': 10764, 'Sci-Fi': 10765,
  'Science Fiction': 10765, 'Thriller': 53, 'War': 10768, 'Western': 37,
};

const SUPPORTED_FILTERS = ['genre', 'sort_by', 'year_from', 'year_to', 'rating_min'];

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

function buildDiscoverMovieParams(filters, lang, page) {
  const params = { language: lang, page: String(page ?? 1) };
  if (filters.genre) {
    const id = MOVIE_GENRE_IDS[filters.genre];
    if (id) params['with_genres'] = String(id);
  }
  if (filters.sort_by)    params['sort_by']                    = filters.sort_by;
  if (filters.year_from)  params['primary_release_date.gte']   = `${filters.year_from}-01-01`;
  if (filters.year_to)    params['primary_release_date.lte']   = `${filters.year_to}-12-31`;
  if (filters.rating_min) params['vote_average.gte']           = String(filters.rating_min);
  return params;
}

function buildDiscoverTvParams(filters, lang, page) {
  const params = { language: lang, page: String(page ?? 1) };
  if (filters.genre) {
    const id = TV_GENRE_IDS[filters.genre];
    if (id) params['with_genres'] = String(id);
  }
  if (filters.sort_by)    params['sort_by']                  = filters.sort_by;
  if (filters.year_from)  params['first_air_date.gte']       = `${filters.year_from}-01-01`;
  if (filters.year_to)    params['first_air_date.lte']       = `${filters.year_to}-12-31`;
  if (filters.rating_min) params['vote_average.gte']         = String(filters.rating_min);
  return params;
}

export function init(ctx) {
  const key  = () => ctx.config['apiKey'];
  const lang = () => ctx.config['language'] || 'en-US';

  ctx.content.registerCatalog({
    id: 'tmdb:popular-movies',
    name: 'Popular Movies',
    type: 'movie',
    defaultGridSize: { cols: 4, rows: 2 },
    supportedFilters: SUPPORTED_FILTERS,
    async fetch(opts = {}) {
      if (opts.search) {
        const d = await tmdbFetch(key(), '/search/movie', { language: lang(), query: opts.search });
        return d?.results?.map(mapMovie) ?? [];
      }
      const d = await tmdbFetch(key(), '/movie/popular', { language: lang(), page: String(opts.page ?? 1) });
      return d?.results?.map(mapMovie) ?? [];
    },
    async fetchWithFilters(filters, opts = {}) {
      const params = buildDiscoverMovieParams(filters, lang(), opts.page);
      const d = await tmdbFetch(key(), '/discover/movie', params);
      return d?.results?.map(mapMovie) ?? [];
    },
  });

  ctx.content.registerCatalog({
    id: 'tmdb:top-rated-movies',
    name: 'Top Rated Movies',
    type: 'movie',
    defaultGridSize: { cols: 4, rows: 2 },
    supportedFilters: SUPPORTED_FILTERS,
    async fetch(opts = {}) {
      const d = await tmdbFetch(key(), '/movie/top_rated', { language: lang(), page: String(opts.page ?? 1) });
      return d?.results?.map(mapMovie) ?? [];
    },
    async fetchWithFilters(filters, opts = {}) {
      const params = buildDiscoverMovieParams(filters, lang(), opts.page);
      const d = await tmdbFetch(key(), '/discover/movie', params);
      return d?.results?.map(mapMovie) ?? [];
    },
  });

  ctx.content.registerCatalog({
    id: 'tmdb:popular-series',
    name: 'Popular Series',
    type: 'series',
    defaultGridSize: { cols: 4, rows: 2 },
    supportedFilters: SUPPORTED_FILTERS,
    async fetch(opts = {}) {
      if (opts.search) {
        const d = await tmdbFetch(key(), '/search/tv', { language: lang(), query: opts.search });
        return d?.results?.map(mapSeries) ?? [];
      }
      const d = await tmdbFetch(key(), '/tv/popular', { language: lang(), page: String(opts.page ?? 1) });
      return d?.results?.map(mapSeries) ?? [];
    },
    async fetchWithFilters(filters, opts = {}) {
      const params = buildDiscoverTvParams(filters, lang(), opts.page);
      const d = await tmdbFetch(key(), '/discover/tv', params);
      return d?.results?.map(mapSeries) ?? [];
    },
  });

  ctx.content.registerCatalog({
    id: 'tmdb:trending-movies',
    name: 'Trending This Week',
    type: 'movie',
    defaultGridSize: { cols: 4, rows: 2 },
    supportedFilters: SUPPORTED_FILTERS,
    async fetch() {
      const d = await tmdbFetch(key(), '/trending/movie/week', { language: lang() });
      return d?.results?.map(mapMovie) ?? [];
    },
    async fetchWithFilters(filters, opts = {}) {
      const params = buildDiscoverMovieParams(filters, lang(), opts.page);
      const d = await tmdbFetch(key(), '/discover/movie', params);
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
