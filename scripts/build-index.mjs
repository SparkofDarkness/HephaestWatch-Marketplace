import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const RAW_BASE = 'https://raw.githubusercontent.com/SparkofDarkness/HephaestWatch-Marketplace/main';

const VALID_TAGS = JSON.parse(readFileSync('tags.json', 'utf8'));

// ── Validation ────────────────────────────────────────────────────────────────

function validate(type) {
  const dir = type === 'addon' ? 'addons' : 'plugins';
  const errors = [];

  const folders = readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const name of folders) {
    const base = join(dir, name);
    const label = `[${type}/${name}]`;

    // manifest.json
    const mPath = join(base, 'manifest.json');
    if (!existsSync(mPath)) {
      errors.push(`${label} manifest.json fehlt`);
      continue;
    }

    let manifest;
    try { manifest = JSON.parse(readFileSync(mPath, 'utf8')); }
    catch { errors.push(`${label} manifest.json ist kein gültiges JSON`); continue; }

    if (!manifest.id)          errors.push(`${label} manifest.json: "id" fehlt`);
    if (!manifest.name)        errors.push(`${label} manifest.json: "name" fehlt`);
    if (!manifest.description) errors.push(`${label} manifest.json: "description" fehlt`);
    if (!manifest.version)     errors.push(`${label} manifest.json: "version" fehlt`);

    if (manifest.id && manifest.id !== name)
      errors.push(`${label} manifest.json: "id" (${manifest.id}) muss gleich dem Ordnernamen (${name}) sein`);

    // meta.json
    const metaPath = join(base, 'meta.json');
    if (!existsSync(metaPath)) {
      errors.push(`${label} meta.json fehlt`);
      continue;
    }

    let meta;
    try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); }
    catch { errors.push(`${label} meta.json ist kein gültiges JSON`); continue; }

    if (!Array.isArray(meta.tags) || meta.tags.length === 0)
      errors.push(`${label} meta.json: "tags" fehlt oder leer`);
    else {
      const invalid = meta.tags.filter(t => !VALID_TAGS.includes(t));
      if (invalid.length)
        errors.push(`${label} meta.json: ungültige tags: ${invalid.join(', ')} (erlaubt: ${VALID_TAGS.join(', ')})`);
    }
  }

  return errors;
}

// ── Build ─────────────────────────────────────────────────────────────────────

const allErrors = [
  ...validate('addon'),
  ...validate('plugin'),
];

if (allErrors.length) {
  console.error('\n❌ Build fehlgeschlagen — Validierungsfehler:\n');
  allErrors.forEach(e => console.error('  ' + e));
  console.error('');
  process.exit(1);
}

const verified = new Set(JSON.parse(readFileSync('verified.json', 'utf8')));
const featured  = new Set(JSON.parse(readFileSync('featured.json', 'utf8')));

function buildEntries(type) {
  const dir = type === 'addon' ? 'addons' : 'plugins';
  const bundleKey = type === 'addon' ? 'addon' : 'plugin';

  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const base = join(dir, d.name);
      const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
      const meta     = JSON.parse(readFileSync(join(base, 'meta.json'), 'utf8'));
      const bundleFile = manifest.scripts?.[bundleKey];

      return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        author: meta.author ?? 'SparkofDarkness',
        ...(meta.authorUrl && { authorUrl: meta.authorUrl }),
        repo: 'https://github.com/SparkofDarkness/HephaestWatch-Marketplace',
        tags: meta.tags,
        verified: verified.has(manifest.id),
        featured:  featured.has(manifest.id),
        latestVersion: manifest.version,
        manifestUrl: `${RAW_BASE}/${dir}/${d.name}/manifest.json`,
        ...(bundleFile && { bundleUrl: `${RAW_BASE}/${dir}/${d.name}/${bundleFile}` }),
        ...(meta.icon         && { icon: meta.icon }),
        ...(meta.minAppVersion && { minAppVersion: meta.minAppVersion }),
      };
    });
}

const index = {
  schemaVersion: '1',
  updatedAt: new Date().toISOString(),
  addons:  buildEntries('addon'),
  plugins: buildEntries('plugin'),
};

writeFileSync('index.json', JSON.stringify(index, null, 2));
console.log(`✅ index.json gebaut: ${index.addons.length} addons, ${index.plugins.length} plugins`);