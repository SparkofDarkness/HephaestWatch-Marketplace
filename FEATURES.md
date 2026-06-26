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

## Haupt-App (HephaestWatch) — noch nicht umgesetzt 🏠

### 🔲 SHA256-Verifikation
- Nach Download eines Bundles: berechneten Hash gegen `index.json`-Eintrag prüfen
- Bei Mismatch: Installation abbrechen + Fehlermeldung

### 🔲 Versionshistorie-UI
- Im Marketplace-Detail einer Extension: Dropdown mit allen verfügbaren Versionen
- "Rollback auf Version X" — lädt Bundle-URL aus `versions[x].bundleUrl`
- Aktuell installierte Version hervorheben

### 🔲 Dependency-Resolver
- Vor Installation prüfen: sind alle `requires`-Extensions installiert?
- Falls nicht: automatisch mitinstallieren (mit Bestätigung)
- `recommends` als "Vielleicht auch interessant?"-Hinweis anzeigen

### 🔲 `experimental`-Warnung
- Vor Installation einer Extension mit `experimental: true`: Modal mit Warnung
- "Diese Extension ist experimentell — auf eigene Gefahr installieren"

### 🔲 `deprecated`-Banner
- Im Marketplace und in der installierten Extension-Liste: gelbes Banner
- Text: "Diese Extension ist veraltet" + optional "Wechsle zu [replacedBy]"

### 🔲 `testedOnVersion`-Hinweis
- Extension wurde auf Version X getestet, User läuft Version Y
- Y > X: ⚠️ "Getestet auf X — sollte funktionieren, aber ungeprüft"
- Y < X: ⚠️ "Für eine neuere App-Version entwickelt — eventuell inkompatibel"
- Kein Block — nur Info

### 🔲 Custom Registry URL
- In App-Einstellungen: User kann eigene Registry-URL eintragen
- App fetched alle Registry-Quellen und zeigt Extensions zusammen an
- Anwendungsfälle: private Firmen-Extensions, Community-Kollektionen, lokales Testing

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
  "experimental": false,
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
  "experimental": false,
  "requires": [],
  "recommends": []
}
```
