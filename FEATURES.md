# HephaestWatch Marketplace — Feature-Roadmap

## Legende
- ✅ Umgesetzt (Marketplace-Repo)
- 🔲 Ausstehend
- 🏠 Haupt-App (HephaestWatch) zuständig

---

## Marketplace-Repo

### ✅ Basis-System
- Erster-Party-Extensions in `addons/` und `plugins/` — kein extra Repo nötig
- Build-Script validiert `manifest.json` + `meta.json` pro Extension
- `verified.json` + `featured.json` steuern Badges
- GitHub Actions baut `index.json` automatisch bei Push auf `main`

### ✅ Versionshistorie
- `versions`-Array pro Index-Eintrag — wächst automatisch bei jedem Build
- Jeder Eintrag: `{ version, manifestUrl, bundleUrl?, sha256?, date }`
- Build-Script liest altes `index.json` und ergänzt neue Versionen, ohne alte zu löschen
- Ermöglicht der App Rollback auf alte Versionen

### ✅ SHA256-Checksums
- Build-Script berechnet automatisch SHA256 aller First-Party-Bundles
- Checksum landet in `index.json` (top-level + im `versions`-Eintrag)
- Community-Extensions können optional ihre eigene Checksum in `community.json` angeben
- 🏠 App muss nach Download den Hash verifizieren (noch nicht umgesetzt)

### ✅ `community.json` — Externe Extensions
- Externe Extensions werden nur verlinkt, kein Code in diesem Repo
- Datei: `community.json` (Array von Einträgen)
- Build-Script merged sie in `index.json`
- **Pflichtfeld:** Alle URLs müssen auf gepinnte Releases zeigen (nicht `main`/`master`)
  - ✅ Erlaubt: `cdn.jsdelivr.net/gh/USER/REPO@1.0.0/file.js`
  - ✅ Erlaubt: `github.com/USER/REPO/releases/download/v1.0.0/file.js`
  - ❌ Blockiert: `raw.githubusercontent.com/USER/REPO/main/file.js`
- Build-Script setzt `release-pinned`-Tag automatisch für gepinnte Einträge
- `verified: false` per Default — Maintainer kann ID in `verified.json` eintragen

### ✅ Neue `meta.json`-Felder (alle optional)

| Feld | Typ | Beschreibung |
|---|---|---|
| `requires` | `string[]` | IDs von Extensions die installiert sein MÜSSEN |
| `recommends` | `string[]` | IDs von Extensions die empfohlen werden |
| `experimental` | `boolean` | Zeigt Warnung vor Installation |
| `deprecated` | `boolean` | Markiert Extension als veraltet |
| `replacedBy` | `string` | ID der Nachfolger-Extension (nur mit `deprecated: true`) |
| `testedOnVersion` | `string` | App-Version auf der getestet wurde (z.B. `"1.2.0"`) |

### ✅ Dependencies-Validierung im Build-Script
- `requires`/`recommends` müssen auf existierende IDs zeigen
- Zirkuläre Abhängigkeiten werden erkannt und als **Warnung** ausgegeben (kein Build-Fehler)
- Die App übernimmt die eigentliche Auflösung zur Laufzeit

### ✅ Neue Tags

| Tag | Bedeutung | Gesetzt von |
|---|---|---|
| `release-pinned` | Bundle-URL zeigt auf immutable Release | Build-Script (automatisch) |
| `open-source` | Code öffentlich auditierbar | Entwickler |
| `requires-account` | Braucht externen Account/Login | Entwickler |
| `live` | Live-Streams / IPTV | Entwickler |
| `adult` | Für Erwachseneninhalte | Entwickler |
| `pack` | Installiert mehrere Extensions auf einmal | Entwickler |
| `experimental` | Unfertig / ungetestet | Entwickler |

---

## Haupt-App (HephaestWatch)

### ✅ SHA256-Verifikation
- `_downloadAndRegister()` in `marketplace.ts` prüft Hash nach Download
- Bei Mismatch: Installation abgebrochen + Fehlermeldung

### ✅ Versionshistorie-UI
- `ConfigDrawer` zeigt alle `versions[]`-Einträge mit Datum
- "Install"-Button pro Version für Rollback
- Aktuell installierte Version hervorgehoben

### ✅ Dependency-Resolver
- `getMissingDependencies()` prüft `requires` vor der Installation
- `DependencyModal` bei fehlenden Dependencies
- `recommends` als optionale Auswahl im `InstallConfirmModal`

### ✅ `experimental`-Warnung
- `ExperimentalWarningModal` erscheint vor der Installation
- "BETA"-Badge auf den Browse-Karten

### ✅ `deprecated`-Banner
- Deprecation-Banner auf Browse-Karten und im Install-Modal
- Link zur `replacedBy`-Extension wenn gesetzt

### ✅ `testedOnVersion`-Hinweis
- Versionskompatibilitäts-Hinweis auf Browse-Karten und im Install-Modal
- Kein Block — nur Info

### ✅ Custom Registry URL
- `appSettings.get('customRegistryUrls')` in `fetchIndex()`
- Mehrere Registries werden gemergt und zusammen angezeigt

---

## Schema-Referenz

### `meta.json` — vollständiges Schema
```json
{
  "tags": ["catalog", "movies"],
  "author": "SparkofDarkness",
  "authorUrl": "https://github.com/SparkofDarkness",
  "icon": "https://...",
  "minAppVersion": "1.0.0",
  "testedOnVersion": "1.2.0",
  "requires": ["tmdb-source"],
  "recommends": ["watchlist", "watch-history"],
  "releaseStage": "beta",
  "deprecated": false,
  "replacedBy": "better-addon-id"
}
```

### `community.json` — Eintrag-Schema
```json
{
  "id": "my-community-addon",
  "type": "addon",
  "name": "My Addon",
  "description": "Short description.",
  "author": "someuser",
  "authorUrl": "https://github.com/someuser",
  "repo": "someuser/hw-my-addon",
  "tags": ["catalog", "movies"],
  "latestVersion": "1.0.0",
  "manifestUrl": "https://cdn.jsdelivr.net/gh/someuser/hw-my-addon@1.0.0/manifest.json",
  "bundleUrl":   "https://cdn.jsdelivr.net/gh/someuser/hw-my-addon@1.0.0/index.js",
  "sha256": "optional — SHA256 des Bundles",
  "testedOnVersion": "1.0.0",
  "releaseStage": "beta",
  "requires": [],
  "recommends": []
}
```
