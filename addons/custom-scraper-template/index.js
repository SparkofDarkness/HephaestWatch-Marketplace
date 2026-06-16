// Custom Scraper Addon Template
//
// Starting point for building your own stream source addon.
// Copy this folder, rename it, update manifest.json, and implement the logic below.
//
// CORS NOTE: Browser security blocks most direct scraping.
// Solutions:
//   a) Use a CORS proxy (e.g. allorigins.win for testing, your own for production)
//   b) Move the scraping logic to Tauri's Rust backend (recommended for production)
//   c) Use sites/APIs that have open CORS headers

async function searchMySource(title, year, type, apiKey) {
  // Replace this with your actual endpoint
  const query = encodeURIComponent(`${title} ${year ?? ''}`);
  const res = await fetch(`https://your-api.example.com/search?q=${query}&type=${type}&key=${apiKey}`);

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();

  return (data.results ?? []).map(item => ({
    title: `${item.quality} — ${item.source}`,
    url: item.magnetLink ?? item.downloadUrl,
    type: item.magnetLink ? 'torrent' : 'http',
    quality: item.quality,
    size: item.fileSize,
    seeders: item.seedCount,
  }));
}

export function init(ctx) {
  ctx.content.registerResolver({
    id: 'custom-scraper:resolver',

    async resolve(contentId, type, item) {
      const apiKey = ctx.config['apiKey'];
      const title  = item?.name ?? contentId;
      const year   = item?.year;

      const cacheKey = `streams:${contentId}`;
      const cached   = await ctx.store.get(cacheKey);
      if (cached) return cached;

      try {
        const streams = await searchMySource(title, year, type, apiKey);
        await ctx.store.set(cacheKey, streams);
        return streams;
      } catch (err) {
        console.error('[CustomScraper] Failed to fetch streams:', err);
        return [];
      }
    },
  });
}

export function teardown() {}
