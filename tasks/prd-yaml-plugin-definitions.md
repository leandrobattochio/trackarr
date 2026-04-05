# PRD: YAML-Defined Plugin System

## Introduction

Replace the hardcoded C# plugin classes with a fully declarative YAML-based plugin definition system. Each plugin (BJ-Share, Fearnopeer, Seedpool) will be defined entirely in a YAML file that describes its metadata, user-facing fields, HTTP requests, response parsing, and stat mapping. A generic backend engine interprets these YAML definitions at runtime, eliminating the need for per-plugin C# code. Users can create, edit, and delete plugins (including the 3 defaults) via a raw YAML editor in the frontend. Plugin definitions are stored as JSON in the database (parsed from YAML on save). The 3 existing plugins ship as `.yaml` files on disk and are read at startup; they are **not** duplicated into the database unless the user modifies them.

## Goals

- Define all current plugin behavior in YAML without changing functionality
- Build a generic YAML plugin engine that can execute any conforming YAML definition
- Provide a full YAML code editor in the frontend for plugin CRUD
- Store user-created/edited plugin definitions as JSON in the database
- Ship the 3 default plugins as YAML files on disk, read at startup
- Completely remove the hardcoded C# plugin classes (BjShare, Unit3D base, Fearnopeer, Seedpool)
- Keep the existing frontend card components as-is (they map by `pluginGroup`)

## User Stories

### US-001: Design the YAML plugin schema
**Description:** As a developer, I need a well-defined YAML schema that can express all current plugin behaviors (metadata, fields, HTTP configuration, request steps, response parsing, and stat mapping) so that the 3 existing plugins can be fully represented.

**Acceptance Criteria:**
- [ ] YAML schema supports metadata: `pluginId`, `pluginGroup`, `displayName`
- [ ] YAML schema supports field definitions with: `name`, `label`, `type` (cron, number, text, password), `required`, `sensitive`
- [ ] YAML schema supports HTTP client configuration: `baseUrl` (from fields), default headers, cookies (from fields)
- [ ] YAML schema supports ordered request steps, each with: HTTP method, URL template (with field/variable interpolation), response type (html or json)
- [ ] YAML schema supports auth detection: patterns to detect authentication failures (HTTP status codes, HTML content patterns)
- [ ] YAML schema supports HTML parsing via regex with named capture groups
- [ ] YAML schema supports JSON parsing via dot-notation paths (e.g., `response.username`)
- [ ] YAML schema supports value transformations: `byteSize` ("1.25 TiB" to bytes), `decimal`, `integer`, `toString`
- [ ] YAML schema supports stat mapping: maps parsed values to the fixed `TrackerStats` fields (ratio, uploadedBytes, downloadedBytes, seedBonus, buffer, hitAndRuns, requiredRatio, seedingTorrents, leechingTorrents, activeTorrents)
- [ ] YAML schema supports computed fields (e.g., `activeTorrents = seedingTorrents + leechingTorrents`)
- [ ] YAML schema supports referencing field values in URL templates and headers using a `{{fieldName}}` syntax
- [ ] YAML schema supports later steps referencing results from earlier steps
- [ ] Typecheck passes

### US-002: Translate BJ-Share plugin to YAML
**Description:** As a developer, I need to translate the existing BJ-Share C# plugin into a YAML file that produces identical behavior.

**Acceptance Criteria:**
- [ ] YAML file saved at `plugins/bj-share.yaml`
- [ ] Defines fields: `cron`, `required_ratio`, `baseUrl`, `cookie` (sensitive), `username`
- [ ] Configures HTTP client with: baseUrl from field, `Accept: application/json` header, Chrome User-Agent header, `Cookie` header from field
- [ ] Step 1: POST to `user.php?username={{username}}` — parses HTML for uploaded bytes (regex: `<li\s+class="tooltip"\s+title="(?<value>[^"]+)">\s*Enviado:`), downloaded bytes, ratio, BJ-Pontos
- [ ] Step 2: GET to `torrents.php?type=seeding&username={{username}}` — parses HTML torrent count (count `<tr>` rows with class `torrent torrent_row` inside `torrent_table cats` table)
- [ ] Step 3: GET to `torrents.php?type=leeching&username={{username}}` — parses HTML torrent count (same pattern as step 2)
- [ ] Auth failure detection: HTTP 401/403 status codes OR HTML containing "Login", "login.php", `name="password"`, or `type="password"`
- [ ] Value transformations: byte size parsing (handles comma-as-decimal, e.g., "1.234,56 GiB"), decimal parsing (comma normalization), integer parsing (strip dots/commas)
- [ ] Stat mapping: ratio, uploadedBytes, downloadedBytes, seedBonus (BJ-Pontos as string), buffer=null, hitAndRuns=null, requiredRatio (from field), seedingTorrents, leechingTorrents, activeTorrents (seeding + leeching)
- [ ] Produces identical `TrackerStats` output as the current C# implementation for the same input data

### US-003: Translate Fearnopeer plugin to YAML
**Description:** As a developer, I need to translate the existing Fearnopeer C# plugin into a YAML file.

**Acceptance Criteria:**
- [ ] YAML file saved at `plugins/fearnopeer.yaml`
- [ ] Metadata: pluginId=`fearnopeer`, pluginGroup=`unit3d`, displayName=`Fearnopeer`
- [ ] Defines fields: `cron`, `required_ratio`, `baseUrl`, `apiKey` (sensitive, type=password)
- [ ] Configures HTTP client with: baseUrl from field, `Accept: application/json` header, Chrome User-Agent header
- [ ] Single step: GET to `api/user?api_token={{apiKey}}` — response type JSON
- [ ] Auth failure detection: HTTP 401/403 status codes
- [ ] JSON extraction: `username`, `uploaded`, `downloaded`, `ratio`, `buffer`, `seeding`, `leeching`, `seedbonus`, `hit_and_runs`
- [ ] Null/empty username check → treat as unknown error
- [ ] Value transformations: `uploaded`/`downloaded` via byteSize, `ratio` via decimal
- [ ] Stat mapping: ratio, uploadedBytes, downloadedBytes, seedBonus, buffer, hitAndRuns, requiredRatio (from field), seedingTorrents, leechingTorrents, activeTorrents (seeding + leeching)
- [ ] Produces identical `TrackerStats` output as the current C# implementation

### US-004: Translate Seedpool plugin to YAML
**Description:** As a developer, I need to translate the existing Seedpool C# plugin into a YAML file.

**Acceptance Criteria:**
- [ ] YAML file saved at `plugins/seedpool.yaml`
- [ ] Identical structure to `fearnopeer.yaml` except: pluginId=`seedpool`, displayName=`Seedpool`
- [ ] Produces identical `TrackerStats` output as the current C# implementation

### US-005: Build the YAML plugin engine (backend)
**Description:** As a developer, I need a generic backend engine that can load a YAML plugin definition and execute it — performing HTTP requests, parsing responses, transforming values, and returning `TrackerStats` — so that no per-plugin C# code is needed.

**Acceptance Criteria:**
- [ ] Engine loads a YAML string (or deserialized JSON object), validates it against the expected schema
- [ ] Engine configures `HttpClient` based on the YAML definition (baseUrl, headers, cookies — all supporting `{{fieldName}}` interpolation from user-provided configuration)
- [ ] Engine executes ordered request steps sequentially; each step produces named variables accessible by later steps
- [ ] Engine detects auth failures based on YAML-defined rules (HTTP status codes, HTML content patterns)
- [ ] Engine parses HTML responses using regex patterns with named capture groups
- [ ] Engine parses JSON responses using dot-notation paths
- [ ] Engine applies value transformations: `byteSize` (handles "X.XX TIB" format, comma-as-decimal separator), `decimal` (comma normalization), `integer` (strip separators), `toString`
- [ ] Engine maps parsed values to the fixed `TrackerStats` record fields
- [ ] Engine evaluates computed fields (e.g., `activeTorrents = seedingTorrents + leechingTorrents`)
- [ ] Engine returns `TrackerFetchResult` with appropriate `PluginProcessResult` (Success, AuthFailed, UnknownError)
- [ ] Engine implements `ITrackerPlugin` interface so it integrates seamlessly with existing `IntegrationSyncService`, `TrackerPluginRegistry`, and `TrackerPluginHttpClientFactory`
- [ ] All 3 YAML plugins produce identical results to the current C# implementations
- [ ] Typecheck passes

### US-006: Plugin loader — disk files and database
**Description:** As a developer, I need a plugin loader that reads YAML files from disk at startup and also loads plugin definitions from the database, merging both sources without duplication.

**Acceptance Criteria:**
- [ ] At startup, reads all `.yaml` files from a configurable `plugins/` directory
- [ ] Parses each YAML file and registers it as an available plugin
- [ ] Also loads any plugin definitions stored in the database (as JSON)
- [ ] If a plugin exists in both disk and database (same `pluginId`), the database version takes precedence (user has edited it)
- [ ] Exposes all loaded plugins through `ITrackerPluginRegistry` so existing code (API controllers, sync service) works unchanged
- [ ] The `/api/plugins` endpoint returns all available plugins (disk + DB) with their fields
- [ ] Typecheck passes

### US-007: Database storage for plugin definitions
**Description:** As a developer, I need a database table to store user-created and user-edited plugin definitions as JSON.

**Acceptance Criteria:**
- [ ] New `PluginDefinitions` table with columns: `Id` (GUID PK), `PluginId` (string, unique), `DefinitionJson` (text — the YAML parsed to JSON), `CreatedAt` (DateTime UTC), `UpdatedAt` (DateTime UTC)
- [ ] EF Core entity and migration created
- [ ] Repository interface and implementation for CRUD operations
- [ ] Typecheck passes

### US-008: Plugin CRUD API endpoints
**Description:** As a developer, I need API endpoints to create, read, update, and delete plugin definitions so the frontend can manage them.

**Acceptance Criteria:**
- [ ] `GET /api/plugins` — returns all plugins (disk + DB) with metadata and fields (existing endpoint, updated to use new loader)
- [ ] `GET /api/plugins/{pluginId}` — returns a single plugin definition as YAML text (for the editor)
- [ ] `POST /api/plugins` — creates a new plugin definition; accepts YAML text in request body; validates YAML syntax; parses to JSON and stores in DB; returns the created plugin
- [ ] `PUT /api/plugins/{pluginId}` — updates an existing plugin definition; if it's a disk-based default being edited for the first time, creates a DB entry (overrides disk); validates YAML syntax
- [ ] `DELETE /api/plugins/{pluginId}` — deletes a plugin definition; if it's a DB override of a disk default, removes the DB entry (disk version becomes active again); if it's a user-created plugin, deletes entirely
- [ ] Validation: reject YAML with duplicate `pluginId`, missing required schema fields
- [ ] Typecheck passes

### US-009: Frontend YAML editor for plugin management
**Description:** As a user, I want a YAML code editor in the frontend where I can create, view, edit, and delete plugin definitions.

**Acceptance Criteria:**
- [ ] New page/dialog accessible from the UI (e.g., "Manage Plugins" in navigation or settings)
- [ ] Lists all available plugins with their displayName, pluginId, and source (disk/database)
- [ ] Clicking a plugin opens a code editor (Monaco or CodeMirror) pre-populated with the plugin's YAML
- [ ] "New Plugin" button opens an empty editor (optionally with a YAML template/skeleton)
- [ ] Save button validates YAML syntax and sends to backend API
- [ ] Delete button with confirmation dialog
- [ ] Syntax highlighting for YAML in the editor
- [ ] Displays validation errors from the backend (if YAML schema is invalid)
- [ ] Typecheck passes

### US-010: Remove hardcoded C# plugin classes
**Description:** As a developer, I need to remove all hardcoded C# plugin code now that the YAML engine handles everything.

**Acceptance Criteria:**
- [ ] Delete `TrackerStats.Plugin.BjShare` project and all its files
- [ ] Delete `TrackerStats.Plugin.Core.Unit3D` project and all its files
- [ ] Delete `TrackerStats.Plugin.Fearnopeer` project and all its files
- [ ] Delete `TrackerStats.Plugin.Seedpool` project and all its files
- [ ] Remove plugin project references from the solution file and `TrackerStats.Api.csproj`
- [ ] Remove hardcoded DI registrations from `Program.cs` (`AddTransient<ITrackerPlugin, ...>`)
- [ ] Update `TrackerPluginRegistry` to work with the new YAML-based plugin loader instead of DI-resolved `ITrackerPlugin` instances
- [ ] All existing functionality works through YAML definitions
- [ ] Solution builds and typecheck passes

## Functional Requirements

- FR-1: The system must load plugin definitions from YAML files on disk at startup
- FR-2: The system must load plugin definitions from the database (stored as JSON, originally submitted as YAML)
- FR-3: When a pluginId exists in both disk and database, the database version takes precedence
- FR-4: The YAML plugin engine must configure HTTP clients with baseUrl, headers, and cookies using `{{fieldName}}` interpolation
- FR-5: The YAML plugin engine must execute ordered HTTP request steps sequentially, with later steps able to reference results from earlier steps
- FR-6: The YAML plugin engine must detect authentication failures via HTTP status codes (401, 403) and configurable HTML content patterns
- FR-7: The YAML plugin engine must parse HTML responses using regex patterns with named capture groups
- FR-8: The YAML plugin engine must parse JSON responses using dot-notation property paths
- FR-9: The YAML plugin engine must apply value transformations: `byteSize` (e.g., "1.25 TiB" → 1374389534720), `decimal` (with comma normalization), `integer` (strip separators), `toString`
- FR-10: The YAML plugin engine must map extracted and transformed values to the fixed `TrackerStats` record
- FR-11: The YAML plugin engine must support computed fields using simple expressions (addition)
- FR-12: The API must expose CRUD endpoints for plugin definitions (`GET/POST/PUT/DELETE /api/plugins`)
- FR-13: The `GET /api/plugins/{pluginId}` endpoint must return the plugin definition as YAML text
- FR-14: The frontend must provide a full YAML code editor (Monaco/CodeMirror) for plugin creation and editing
- FR-15: The frontend must list all available plugins and allow deletion with confirmation
- FR-16: The 3 default plugins must ship as `.yaml` files in a `plugins/` directory
- FR-17: Deleting a DB override of a disk-based plugin must restore the disk version (not delete the plugin entirely)
- FR-18: The `AuthMode` enum, `ITrackerPlugin` interface, and `TrackerStats` record remain unchanged — the YAML engine adapts to them
- FR-19: Existing frontend card components (`BjShareTrackerCard`, `Unit3DTrackerCard`, `DefaultTrackerCard`) remain unchanged — they route by `pluginGroup`
- FR-20: Existing integration CRUD, sync flow, and snapshot recording remain unchanged

## Non-Goals

- No changes to the `TrackerStats` record schema — stats remain a fixed set of fields
- No changes to the frontend card components or how they render stats
- No YAML template/inheritance/extends mechanism — each YAML file is self-contained
- No schema validation beyond YAML syntax in the frontend (backend validates structure)
- No changes to the integration CRUD flow, Hangfire scheduling, or snapshot system
- No migration of existing integration data (clean database assumed)

## Design Considerations

- Use Monaco Editor (already common in React ecosystems) for the YAML editor — it provides syntax highlighting, error markers, and a familiar editing experience
- The "Manage Plugins" UI could be a new page accessible from the main navigation, or a settings section
- Consider providing a YAML skeleton/template when creating a new plugin to guide users

## Technical Considerations

- **YAML parsing:** Use a .NET YAML library (e.g., `YamlDotNet`) to parse YAML to an object model, then serialize to JSON for database storage
- **Regex engine:** .NET's `System.Text.RegularExpressions` is already used by BjShare — the YAML engine reuses the same approach
- **Byte size parsing:** The current logic in both `BjSharePageParser` and `Unit3DTrackerPluginBase` must be replicated exactly in the engine's `byteSize` transformer, including comma-as-decimal handling
- **Decimal parsing:** BJ-Share uses a locale-aware parser (commas as decimal separators); the engine must handle this via the same normalization logic
- **Variable interpolation:** A simple `{{fieldName}}` replacement in URL templates and headers, using values from the plugin configuration (user credentials) and step results
- **Step result references:** Later steps can reference earlier step outputs using a naming convention (e.g., `{{steps.profile.uploadedBytes}}`)
- **Plugin directory:** Configurable via `appsettings.json` (e.g., `"Plugins": { "Directory": "plugins/" }`)
- **Existing infrastructure:** The YAML engine must implement `ITrackerPlugin` so it plugs into the existing `IntegrationSyncService`, `TrackerPluginHttpClientFactory`, and `TrackerPluginRegistry` without changes to those classes

## Example YAML Plugin Definition

Below is an approximate example of what the Fearnopeer (UNIT3D) YAML would look like. The exact schema will be finalized in US-001.

```yaml
pluginId: fearnopeer
pluginGroup: unit3d
displayName: Fearnopeer

fields:
  - name: cron
    label: Cron Expression
    type: cron
    required: true
  - name: required_ratio
    label: Required Ratio
    type: number
    required: true
  - name: baseUrl
    label: Base URL
    type: text
    required: true
  - name: apiKey
    label: API Key
    type: password
    required: true
    sensitive: true

http:
  baseUrl: "{{baseUrl}}"
  headers:
    Accept: application/json
    User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"

authFailure:
  httpStatusCodes: [401, 403]

steps:
  - name: user
    method: GET
    url: "api/user?api_token={{apiKey}}"
    responseType: json
    extract:
      username: { path: "username" }
      uploaded: { path: "uploaded", transform: byteSize }
      downloaded: { path: "downloaded", transform: byteSize }
      ratio: { path: "ratio", transform: decimal }
      seedbonus: { path: "seedbonus" }
      buffer: { path: "buffer" }
      seeding: { path: "seeding" }
      leeching: { path: "leeching" }
      hitAndRuns: { path: "hit_and_runs" }
    validate:
      - field: username
        notEmpty: true
        onFail: unknownError

mapping:
  ratio: "{{user.ratio}}"
  uploadedBytes: "{{user.uploaded}}"
  downloadedBytes: "{{user.downloaded}}"
  seedBonus: "{{user.seedbonus}}"
  buffer: "{{user.buffer}}"
  hitAndRuns: "{{user.hitAndRuns}}"
  requiredRatio: "{{required_ratio}}"
  seedingTorrents: "{{user.seeding}}"
  leechingTorrents: "{{user.leeching}}"
  activeTorrents: "{{user.seeding}} + {{user.leeching}}"
```

## Success Metrics

- All 3 existing plugins produce identical `TrackerStats` output when defined in YAML vs the current C# implementation
- Users can create a new plugin definition via the YAML editor and use it to add an integration
- Users can edit and delete any plugin, including the 3 defaults
- All hardcoded C# plugin classes are removed from the codebase
- The existing dashboard, cards, sync flow, and snapshot recording continue to work without changes

## Open Questions

- What is the exact YAML schema syntax for BJ-Share's torrent count parsing (counting table rows via regex)? The schema needs to support "count matches" as a parsing mode, not just "extract named group."
- Should the YAML editor include auto-complete or schema-aware suggestions, or is plain syntax highlighting sufficient for v1?
- Should there be a way to "reset" an edited default plugin back to its on-disk version (beyond deleting the DB override)?
