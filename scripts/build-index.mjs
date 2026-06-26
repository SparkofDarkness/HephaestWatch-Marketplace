import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const RAW_BASE  = 'https://raw.githubusercontent.com/SparkofDarkness/HephaestWatch-Marketplace/main';
const TODAY     = new Date().toISOString().slice(0, 10);
const VALID_TAGS = JSON.parse(readFileSync('tags.json', 'utf8'));

// Read previous index.json to preserve version history across builds
let previousIndex = { addons: [], plugins: [] };
if (existsSync('index.json')) {
  try { previousIndex = JSON.parse(readFileSync('index.json', 'utf8')); }
  catch { /* fresh start — no history */ }
}

function getPreviousVersions(id) {
  const all = [...(previousIndex.addons ?? []), ...(previousIndex.plugins ?? [])];
  return all.find(e => e.id === id)?.versions ?? [];
}

function sha256ofFile(filePath) {
  if (!existsSync(filePath)) return undefined;
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function isPinnedUrl(url) {
  if (!url) return false;
  // jsDelivr with exact version tag: @1.0.0
  if (/cdn\.jsdelivr\.net\/gh\/[^/]+\/[^@/]+@[\d][^/]*\//.test(url)) return true;
  // GitHub release asset download
  if (/github\.com\/[^/]+\/[^/]+\/releases\/download\//.test(url)) return true;
  return false;
}

// ── Validation: first-party (addons/ and plugins/) ────────────────────────────

function validateFirstParty(type) {
  const dir    = type === 'addon' ? 'addons' : 'plugins';
  const errors = [];

  const folders = readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const name of folders) {
    const base  = join(dir, name);
    const label = `[${type}/${name}]`;

    // manifest.json
    const mPath = join(base, 'manifest.json');
    if (!existsSync(mPath)) { errors.push(`${label} manifest.json fehlt`); continue; }

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
    if (!existsSync(metaPath)) { errors.push(`${label} meta.json fehlt`); continue; }

    let meta;
    try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); }
    catch { errors.push(`${label} meta.json ist kein gültiges JSON`); continue; }

    // tags
    if (!Array.isArray(meta.tags) || meta.tags.length === 0)
      errors.push(`${label} meta.json: "tags" fehlt oder leer`);
    else {
      const invalid = meta.tags.filter(t => !VALID_TAGS.includes(t));
      if (invalid.length)
        errors.push(`${label} meta.json: ungültige tags: ${invalid.join(', ')} (erlaubt: ${VALID_TAGS.join(', ')})`);
    }

    // releaseStage
    if (meta.releaseStage !== undefined && !['alpha', 'beta'].includes(meta.releaseStage))
      errors.push(`${label} meta.json: "releaseStage" muss "alpha" oder "beta" sein (erhalten: ${meta.releaseStage})`);

    // replacedBy only valid together with deprecated
    if (meta.replacedBy && !meta.deprecated)
      errors.push(`${label} meta.json: "replacedBy" gesetzt, aber "deprecated: true" fehlt`);

    // requires / recommends must be string arrays
    for (const field of ['requires', 'recommends']) {
      if (meta[field] !== undefined) {
        if (!Array.isArray(meta[field]))
          errors.push(`${label} meta.json: "${field}" muss ein Array von IDs sein`);
        else if (meta[field].some(v => typeof v !== 'string'))
          errors.push(`${label} meta.json: "${field}" darf nur Strings (Extension-IDs) enthalten`);
      }
    }
  }

  return errors;
}

// ── Validation: community.json entries ───────────────────────────────────────

function validateCommunity(entries) {
  const errors  = [];
  const seenIds = new Set();

  for (const entry of entries) {
    const label = `[community/${entry.id ?? '?'}]`;

    if (!entry.id)            { errors.push(`${label} "id" fehlt`); continue; }
    if (!entry.type)          errors.push(`${label} "type" fehlt — erlaubt: addon, plugin, pack`);
    if (!entry.name)          errors.push(`${label} "name" fehlt`);
    if (!entry.description)   errors.push(`${label} "description" fehlt`);
    if (!entry.author)        errors.push(`${label} "author" fehlt`);
    if (!entry.latestVersion) errors.push(`${label} "latestVersion" fehlt`);
    if (!entry.manifestUrl)   errors.push(`${label} "manifestUrl" fehlt`);

    // Community URLs must be pinned — immutable releases only
    if (entry.manifestUrl && !isPinnedUrl(entry.manifestUrl))
      errors.push(`${label} manifestUrl muss auf gepinnte Release-URL zeigen (nicht main/master)\n    Erhalten: ${entry.manifestUrl}\n    Erlaubt:  cdn.jsdelivr.net/gh/USER/REPO@VERSION/... oder github.com/.../releases/download/...`);
    if (entry.bundleUrl && !isPinnedUrl(entry.bundleUrl))
      errors.push(`${label} bundleUrl muss auf gepinnte Release-URL zeigen (nicht main/master)\n    Erhalten: ${entry.bundleUrl}`);

    // tags
    if (!Array.isArray(entry.tags) || entry.tags.length === 0)
      errors.push(`${label} "tags" fehlt oder leer`);
    else {
      const invalid = entry.tags.filter(t => !VALID_TAGS.includes(t));
      if (invalid.length)
        errors.push(`${label} ungültige tags: ${invalid.join(', ')}`);
    }

    // replacedBy
    if (entry.replacedBy && !entry.deprecated)
      errors.push(`${label} "replacedBy" gesetzt, aber "deprecated: true" fehlt`);

    // duplicate IDs
    if (seenIds.has(entry.id)) errors.push(`${label} doppelte id "${entry.id}"`);
    seenIds.add(entry.id);
  }

  return errors;
}

// ── Duplicate ID check across first-party + community ─────────────────────────

function checkDuplicateIds(firstPartyEntries, communityEntries) {
  const errors = [];
  const fpIds  = new Set(firstPartyEntries.map(e => e.id));
  for (const e of communityEntries) {
    if (e.id && fpIds.has(e.id))
      errors.push(`[community/${e.id}] ID "${e.id}" kollidiert mit einer First-Party-Extension`);
  }
  return errors;
}

// ── Dependency cross-reference check ─────────────────────────────────────────

function checkDependencies(allEntries) {
  const errors   = [];
  const warnings = [];
  const allIds   = new Set(allEntries.map(e => e.id));

  for (const entry of allEntries) {
    for (const field of ['requires', 'recommends']) {
      const deps = entry[field] ?? [];
      for (const depId of deps) {
        if (!allIds.has(depId))
          errors.push(`[${entry.id}] meta.json "${field}" verweist auf unbekannte ID: "${depId}"`);
      }
    }
  }

  // Cycle detection — warn only, app handles resolution
  const depMap = {};
  for (const e of allEntries) depMap[e.id] = e.requires ?? [];

  const visited = new Set();
  function detectCycle(id, path) {
    if (path.includes(id)) {
      warnings.push(`Zirkuläre Abhängigkeit: ${[...path, id].join(' → ')}`);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    for (const dep of (depMap[id] ?? [])) detectCycle(dep, [...path, id]);
  }
  for (const id of Object.keys(depMap)) detectCycle(id, []);

  return { errors, warnings };
}

// ── Build: first-party entry ──────────────────────────────────────────────────

function buildFirstPartyEntries(type, verified, featured) {
  const dir       = type === 'addon' ? 'addons' : 'plugins';
  const bundleKey = type === 'addon' ? 'addon'  : 'plugin';

  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const base     = join(dir, d.name);
      const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
      const meta     = JSON.parse(readFileSync(join(base, 'meta.json'),     'utf8'));
      const bundleFile = manifest.scripts?.[bundleKey];

      const manifestUrl = `${RAW_BASE}/${dir}/${d.name}/manifest.json`;
      const bundleUrl   = bundleFile ? `${RAW_BASE}/${dir}/${d.name}/${bundleFile}` : undefined;
      const sha256      = bundleFile ? sha256ofFile(join(base, bundleFile)) : undefined;

      // Version history — prepend if this version isn't recorded yet
      const prevVersions = getPreviousVersions(manifest.id);
      const versionEntry = {
        version: manifest.version,
        manifestUrl,
        ...(bundleUrl && { bundleUrl }),
        ...(sha256    && { sha256 }),
        date: TODAY,
      };
      const alreadyTracked = prevVersions.some(v => v.version === manifest.version);
      const versions = alreadyTracked ? prevVersions : [versionEntry, ...prevVersions];

      // Auto-derive release stage tags so developers don't set them manually
      const tags = [...meta.tags];
      if (meta.releaseStage === 'alpha' && !tags.includes('alpha')) tags.push('alpha');
      else if (meta.releaseStage === 'beta' && !tags.includes('beta')) tags.push('beta');

      return {
        id:           manifest.id,
        name:         manifest.name,
        description:  manifest.description,
        author:       meta.author ?? 'SparkofDarkness',
        ...(meta.authorUrl       && { authorUrl:       meta.authorUrl }),
        repo:         'https://github.com/SparkofDarkness/HephaestWatch-Marketplace',
        tags,
        verified:     verified.has(manifest.id),
        featured:     featured.has(manifest.id),
        latestVersion: manifest.version,
        manifestUrl,
        ...(bundleUrl            && { bundleUrl }),
        ...(sha256               && { sha256 }),
        versions,
        // Optional meta fields
        ...(meta.requires        && { requires:        meta.requires }),
        ...(meta.recommends      && { recommends:      meta.recommends }),
        ...(meta.releaseStage    && { releaseStage:    meta.releaseStage }),
        ...(meta.deprecated      && { deprecated:      meta.deprecated }),
        ...(meta.replacedBy      && { replacedBy:      meta.replacedBy }),
        ...(meta.testedOnVersion && { testedOnVersion: meta.testedOnVersion }),
        ...(meta.icon            && { icon:            meta.icon }),
        ...(meta.minAppVersion   && { minAppVersion:   meta.minAppVersion }),
      };
    });
}

// ── Build: community entry ────────────────────────────────────────────────────

function buildCommunityEntries(entries, verified, featured) {
  return entries.map(entry => {
    const prevVersions = getPreviousVersions(entry.id);
    const versionEntry = {
      version:     entry.latestVersion,
      manifestUrl: entry.manifestUrl,
      ...(entry.bundleUrl && { bundleUrl: entry.bundleUrl }),
      ...(entry.sha256    && { sha256:    entry.sha256 }),
      date: TODAY,
    };
    const alreadyTracked = prevVersions.some(v => v.version === entry.latestVersion);
    const versions = alreadyTracked ? prevVersions : [versionEntry, ...prevVersions];

    // Auto-derive tags from release stage and URL type
    const tags = [...entry.tags];
    if (isPinnedUrl(entry.manifestUrl) && !tags.includes('release-pinned')) tags.push('release-pinned');
    if (entry.releaseStage === 'alpha' && !tags.includes('alpha')) tags.push('alpha');
    else if (entry.releaseStage === 'beta' && !tags.includes('beta')) tags.push('beta');

    return {
      id:           entry.id,
      name:         entry.name,
      description:  entry.description,
      author:       entry.author,
      ...(entry.authorUrl       && { authorUrl: entry.authorUrl }),
      ...(entry.repo            && { repo: `https://github.com/${entry.repo}` }),
      tags,
      verified:     verified.has(entry.id),
      featured:     featured.has(entry.id),
      latestVersion: entry.latestVersion,
      manifestUrl:   entry.manifestUrl,
      ...(entry.bundleUrl       && { bundleUrl:       entry.bundleUrl }),
      ...(entry.sha256          && { sha256:          entry.sha256 }),
      versions,
      ...(entry.requires        && { requires:        entry.requires }),
      ...(entry.recommends      && { recommends:      entry.recommends }),
      ...(entry.releaseStage    && { releaseStage:    entry.releaseStage }),
      ...(entry.deprecated      && { deprecated:      entry.deprecated }),
      ...(entry.replacedBy      && { replacedBy:      entry.replacedBy }),
      ...(entry.testedOnVersion && { testedOnVersion: entry.testedOnVersion }),
    };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

const communityRaw = existsSync('community.json')
  ? JSON.parse(readFileSync('community.json', 'utf8'))
  : [];

// Collect raw meta for dependency cross-check (before full build)
function getRawMeta(type) {
  const dir = type === 'addon' ? 'addons' : 'plugins';
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const base = join(dir, d.name);
      try {
        const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
        const meta     = JSON.parse(readFileSync(join(base, 'meta.json'), 'utf8'));
        return { id: manifest.id, requires: meta.requires, recommends: meta.recommends };
      } catch { return null; }
    })
    .filter(Boolean);
}

const allRawEntries = [
  ...getRawMeta('addon'),
  ...getRawMeta('plugin'),
  ...communityRaw.map(e => ({ id: e.id, requires: e.requires, recommends: e.recommends })),
];

// Validation
const fpAddonNames  = readdirSync('addons',  { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const fpPluginNames = readdirSync('plugins', { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);

const validationErrors = [
  ...validateFirstParty('addon'),
  ...validateFirstParty('plugin'),
  ...validateCommunity(communityRaw),
  ...checkDuplicateIds(
    [...fpAddonNames, ...fpPluginNames].map(n => ({ id: n })),
    communityRaw
  ),
];

const { errors: depErrors, warnings: depWarnings } = checkDependencies(allRawEntries);
validationErrors.push(...depErrors);

if (validationErrors.length) {
  console.error('\n❌ Build fehlgeschlagen — Validierungsfehler:\n');
  validationErrors.forEach(e => console.error('  ' + e));
  console.error('');
  process.exit(1);
}

if (depWarnings.length) {
  console.warn('\n⚠️  Dependency-Warnungen (kein Fehler, App löst zur Laufzeit auf):\n');
  depWarnings.forEach(w => console.warn('  ' + w));
  console.warn('');
}

// Build
const verified = new Set(JSON.parse(readFileSync('verified.json', 'utf8')));
const featured  = new Set(JSON.parse(readFileSync('featured.json',  'utf8')));

const fpAddons  = buildFirstPartyEntries('addon',  verified, featured);
const fpPlugins = buildFirstPartyEntries('plugin', verified, featured);

const communityAddons  = buildCommunityEntries(communityRaw.filter(e => e.type === 'addon'),  verified, featured);
const communityPlugins = buildCommunityEntries(communityRaw.filter(e => e.type === 'plugin'), verified, featured);

const index = {
  schemaVersion: '1',
  updatedAt: new Date().toISOString(),
  addons:  [...fpAddons,  ...communityAddons],
  plugins: [...fpPlugins, ...communityPlugins],
};

writeFileSync('index.json', JSON.stringify(index, null, 2));

const totalAddons  = index.addons.length;
const totalPlugins = index.plugins.length;
const community    = communityRaw.length;
console.log(`✅ index.json gebaut: ${totalAddons} addons, ${totalPlugins} plugins (davon ${community} community)`);
