// URL Player Addon — dev/testing only.
// Pre-compiled ESM bundle (no external imports). Load via blob: URL.

const SLOTS = [
  { url: 'url1', title: 'title1', type: 'type1' },
  { url: 'url2', title: 'title2', type: 'type2' },
  { url: 'url3', title: 'title3', type: 'type3' },
];

export function init(ctx) {
  function getConfiguredItems() {
    const items = [];
    SLOTS.forEach(({ url, title }, i) => {
      const u = String(ctx.config[url] ?? '').trim();
      if (!u) return;
      items.push({
        id: `url-player:${i + 1}`,
        type: 'movie',
        name: String(ctx.config[title] ?? `Test Video ${i + 1}`),
        description: `Direct URL stream (${ctx.config[`type${i + 1}`] ?? 'http'}):\n${u}`,
      });
    });
    return items;
  }

  ctx.content.registerCatalog({
    id: 'url-player:videos',
    name: 'Direct URL Videos',
    type: 'movie',
    defaultGridSize: { cols: 2, rows: 1 },
    fetch() {
      return Promise.resolve(getConfiguredItems());
    },
  });

  ctx.content.registerResolver({
    id: 'url-player:resolver',
    resolve(contentId) {
      const slotIndex = SLOTS.findIndex((_, i) => `url-player:${i + 1}` === contentId);
      if (slotIndex === -1) return Promise.resolve([]);

      const slot = SLOTS[slotIndex];
      const url  = String(ctx.config[slot.url] ?? '').trim();
      if (!url) return Promise.resolve([]);

      const rawType = String(ctx.config[slot.type] ?? 'http').trim().toLowerCase();
      const type = rawType === 'hls' ? 'hls' : 'http';
      const title = String(ctx.config[slot.title] ?? `Test ${slotIndex + 1}`);

      return Promise.resolve([{
        title: `${title} (${type.toUpperCase()})`,
        url,
        type,
      }]);
    },
  });
}

export function teardown() {}
