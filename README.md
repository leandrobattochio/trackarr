# TrackArr

| Status | Badge |
| --- | --- |
| CI pipeline | [![CI](https://github.com/leandrobattochio/trackarr/actions/workflows/ci.yml/badge.svg)](https://github.com/leandrobattochio/trackarr/actions/workflows/ci.yml) |
| Cypress E2E | [![Full Stack E2E](https://github.com/leandrobattochio/trackarr/actions/workflows/full-stack-e2e.yml/badge.svg)](https://github.com/leandrobattochio/trackarr/actions/workflows/full-stack-e2e.yml) |
| Frontend coverage (`frontend/`) | [![Frontend coverage](https://codecov.io/github/leandrobattochio/trackarr/graph/badge.svg?flag=frontend)](https://app.codecov.io/github/leandrobattochio/trackarr?flags%5B0%5D=frontend) |
| Backend coverage (`backend/`) | [![Backend coverage](https://codecov.io/github/leandrobattochio/trackarr/graph/badge.svg?flag=backend)](https://app.codecov.io/github/leandrobattochio/trackarr?flags%5B0%5D=backend) |

TrackArr is a self-hosted dashboard for private tracker monitoring. It lets you register tracker integrations, sync stats manually or on a schedule, keep historical snapshots, and define new tracker connectors through YAML instead of hard-coded backend logic.

## Docker Compose example

For self-hosting on your own server, the stack needs the TrackArr container plus a PostgreSQL database. A minimal `docker-compose.yml` can look like this:

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: trackarr-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: trackarr
      POSTGRES_USER: arr
      POSTGRES_PASSWORD: arr123
    volumes:
      - /mnt/user/appdata/trackarr/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U arr -d trackarr"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - arr

  trackarr:
    image: ghcr.io/leandrobattochio/trackarr:v0.4.0
    container_name: trackarr
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    ports:
      - "3012:3000"
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__PostgresConnection: Host=db;Port=5432;Database=trackarr;Username=arr;Password=arr123
      Hangfire__Directory: /data
      Data__Directory: /data
      APP_TIMEZONE: America/Sao_Paulo
      TZ: America/Sao_Paulo
    volumes:
      - /mnt/user/media/backup_configuracoes/trackarr:/data
    networks:
      - arr

networks:
  arr:
    driver: bridge
```

Adjust the host volume paths, published port, timezone, and image tag to fit your environment. Every setting is listed under [Configuration](#configuration). Upgrading from v0.3? Read the [v0.4 upgrade guide](docs/upgrade-0.4.md) first: it deletes every v0.3 plugin file.

> [!WARNING]
> The trackarr API and UI have **no authentication**. Anyone who can reach the port can read and change your integrations and plugins, and a changed plugin can send your stored tracker cookies and API keys to any host. Keep trackarr on a trusted network (LAN or VPN) and never publish it to the internet. If you need remote access, put it behind a reverse proxy or VPN that authenticates users.

## What it does

- Monitors tracker ratio and transfer stats from a single dashboard
- Stores historical snapshots for time-based charts
- Runs recurring sync jobs per integration using cron expressions
- Downloads the official tracker plugins from [`trackarr-plugins`](https://github.com/leandrobattochio/trackarr-plugins) on every start, so tracker fixes arrive without a new image
- Lets you edit official plugins (your copy is kept as an override) and create custom plugins from the UI
- Includes a settings area for HTTP defaults and runtime information
- Ships as a single production container with the React frontend served by ASP.NET Core

## Core features

- Dashboard with per-tracker cards for ratio, uploaded, downloaded, seed bonus, buffer, hit and runs, and torrent counts
- Manual sync for any configured integration
- Automatic recurring sync with Hangfire-backed scheduling
- Snapshot charts for uploaded/downloaded bytes and torrent activity
- In-app YAML editor for plugin authoring with schema-aware validation, completions, snippets, and hover docs
- **Test** button that dry-runs a plugin with an existing integration's settings, without saving anything
- Outdated-override warning with side-by-side diffs, and a What's New screen with the trackarr and plugin changelogs
- Settings page for the shared `User-Agent` header and system information

## Screenshots

### Dashboard

The dashboard is the main operational view. It combines portfolio-level totals across all configured trackers with per-integration cards that surface ratio status, key metrics, last sync state, next automatic run, and quick actions for syncing, editing, opening snapshots, or deleting an integration.

The screenshot below also shows the ratio-warning treatment in context: integrations that fall below the configured minimum ratio are visually highlighted so risky trackers stand out immediately.

![TrackArr dashboard showing overview tiles and tracker cards with ratio status](screenshots/dashboard.png)

### Manage Plugins

The plugin-management screen is where plugin definitions are inspected, created, edited, and tested. The catalog on the left lists every plugin with its status badge (see [Plugins](#plugins)), while the editor on the right exposes the definition that drives integration forms, HTTP steps, mappings, and dashboard metrics.

Saves are blocked when the document is malformed or semantically invalid, and the editor includes TrackArr-specific validation and authoring help while you work.

![TrackArr manage plugins page showing the plugin catalog and YAML editor](screenshots/manage_plugins.png)

## Architecture

### Frontend

- React 19
- Vite 7
- TypeScript
- TanStack Query
- Tailwind CSS + Radix UI + Monaco editor + Monaco YAML services

The frontend runs on `http://localhost:8080` in development and proxies `/api` requests to the backend on `http://localhost:5000`.

### Backend

- ASP.NET Core Web API on `.NET 10`
- Entity Framework Core with PostgreSQL
- Hangfire + `Hangfire.Storage.SQLite`
- Scalar/OpenAPI in development
- YAML plugin engine powered by `YamlDotNet`

The production container serves the API and the built frontend together on port `3000`.

## Project structure

```text
.
|-- backend/
|   |-- TrackerStats.sln
|   |-- src/
|   |   |-- TrackerStats.Api/       # API, DI, startup, controllers
|   |   |-- TrackerStats.Application/
|   |   |-- TrackerStats.Domain/    # Entities, repository interfaces, plugin contracts
|   |   `-- TrackerStats.Infrastructure/
|   |       |-- Data/               # EF Core DbContext and migrations
|   |       |-- Plugins/            # Plugin registry, YAML engine, loaders
|   |       `-- Services/           # Sync jobs and scheduling
|   `-- tools/
|       `-- TrackerStats.PluginValidator/  # CLI that validates plugin YAML files
|-- frontend/
|   |-- src/
|   |   |-- app/                    # App bootstrap and routing
|   |   |-- features/               # Integrations, plugins, help, snapshots
|   |   |-- layouts/
|   |   `-- shared/
|   `-- package.json
`-- docker/
    |-- Dockerfile
    `-- docker-compose.yml
```

## Plugins

A plugin is a YAML file that tells the engine how to log into a tracker, which requests to make, how to read the stats from the responses, and what to show on the tracker card. Every integration uses exactly one plugin, by its `pluginId`.

### Official, override and custom plugins

| Kind | Badge | Where it comes from | Stored in | Changed by |
| --- | --- | --- | --- | --- |
| **Official** | `Official v1.2.0` | The [`trackarr-plugins`](https://github.com/leandrobattochio/trackarr-plugins) repository (`asc`, `bj-share`, `fearnopeer` and `seedpool` today) | `<Data__Directory>/plugins/official/` | Only the startup download |
| **Override** | `Edited (base v1.1.0)` | Created when you save changes to an official plugin; it records the official version it was based on | `<Data__Directory>/plugins/overrides/` | Only you, from the UI. The download never touches it |
| **Custom** | `Custom v1.0.0` | Created with **New Plugin**, with an id that is not an official id | `<Data__Directory>/plugins/custom/` | Only you, from the UI. The download never touches it |

When an id has more than one file, the override wins over the custom plugin, which wins over the official one. A `state.json` file next to the three folders records the installed official versions, each override's base, and the last download result. The app reads the plugins from disk on every use, so a saved plugin takes effect immediately.

Other badges:

- **Outdated**: your override is based on an older official version than the one installed. A banner on every page links to the review screen, and it cannot be dismissed.
- **Orphan**: your override's official plugin was removed from `trackarr-plugins`. The override keeps working.
- **Deprecated**: an official plugin was removed from `trackarr-plugins`, but an integration still uses it, so the cached copy keeps working.
- **Incompatible**: a newer official version needs a newer trackarr. The app keeps the last compatible version and tells you which trackarr version to update to.
- A custom plugin whose id was later published as an official plugin keeps working and hides the official one; a notice explains it.

### Changing a plugin

Plugins are changed **only in the UI**, on the **Manage Plugins** page (`/plugins`). Editing the files on disk is not supported. As a safety net only, an official file edited on disk is detected by its sha256 and turned into an override at the next start.

- **Edit an official plugin:** select it, change the YAML, optionally click **Test**, then **Save**. Saving creates an override with the current official version as its base; the official file is never changed. Saving with no change creates nothing.
- **Go back to the official version:** edit your override until it matches the official version again and save; it is discarded automatically. When the override is outdated, the review screen also offers **Use official**, which deletes the override **with no backup**.
- **Update an outdated override:** open the review screen from the banner or the **Review update** link. It shows **What you changed** (base against yours) and **What changed upstream** (base against the new official version), the changelog, and the actions **Use official** and **Keep mine**. **Keep mine** changes nothing and the warning stays. To carry your change onto the new version, copy it from the first diff, click **Use official**, then edit the plugin again. When the last sync of an integration using your override failed, the warning is highlighted and **Test official** dry-runs the official version with that integration's settings.
- **Create a custom plugin:** click **New Plugin**, replace the `<your-plugin-id>` placeholder with an id made of lowercase letters and digits separated by single hyphens (for example `my-tracker`) that is not an official id, keep `schemaVersion: 1`, and click **Create Plugin**.
- **Delete a custom plugin:** select it and click **Delete**. It is blocked while an integration uses it; the dialog lists those integrations.
- **Test a plugin:** **Test** runs the YAML in the editor, saved or not, with the settings of an integration you pick. It saves no snapshot and does not change the integration, and shows the outcome, each step's HTTP status, the extracted stats and the first failing field.

To share a fix or publish a custom plugin as an official one, open a pull request to `trackarr-plugins` as its [`CONTRIBUTING.md`](https://github.com/leandrobattochio/trackarr-plugins/blob/main/CONTRIBUTING.md) explains.

### Startup download

On every start the app downloads the official plugins from the plugin source (`PluginSource__Url`, by default the `main` branch of `trackarr-plugins` on GitHub). It does not wait for the download: integrations sync right away with the plugins already on disk. The result (time, source, index hash, per-plugin outcome and errors) is shown in **Settings > About**, and updated plugins appear in **What's New**.

```mermaid
sequenceDiagram
    autonumber
    participant App as trackarr
    participant Disk as Data__Directory/plugins
    participant Source as Plugin source
    App->>Disk: official/ empty? Seed it from the snapshot in the image
    App->>Disk: Official file edited on disk? Move it to overrides/
    Note over App: Start serving requests and syncs with the plugins on disk
    App->>Source: GET index.json
    alt Source unreachable or index malformed
        App->>Disk: Keep every file, record the error for About
    else Index OK
        loop Every plugin in the index
            alt Needs a newer schema than this trackarr supports
                App->>App: Keep the installed version, mark it Incompatible
            else sha256 equals the installed file
                App->>App: Nothing to download
            else New or changed
                App->>Source: GET plugins/{id}.yaml
                App->>App: Check sha256 against the index and validate
                App->>Disk: Write official/{id}.yaml, or keep the old file on failure
            end
        end
        App->>Disk: Plugins gone from the index: delete, or keep as Orphan or Deprecated
        App->>Disk: Record the result in state.json for About and What's New
    end
```

Every file is checked against the sha256 in `index.json`. Overrides and custom plugins are never written. The Docker image embeds a snapshot of `trackarr-plugins` taken at build time, so a first start without internet still has the official plugins.

### Override lifecycle

```mermaid
stateDiagram-v2
    [*] --> Official
    Official --> Official: Save with no change
    Official --> Override: Save a change
    Override --> Override: Save another change
    Override --> Official: Save a version equal to the base
    Override --> Outdated: Download installs a newer official version
    Outdated --> Outdated: Keep mine
    Outdated --> Official: Use official, override deleted with no backup
    Override --> Orphan: Official plugin removed upstream
    Outdated --> Orphan: Official plugin removed upstream
    Orphan --> Orphan: Keeps working
```

An override is a full copy of the YAML, shared by every integration of that plugin. If it becomes invalid, its integrations show an "invalid override" error and stop syncing; they do not fall back to the official version.

### Plugin YAML

TrackArr uses YAML plugin definitions to describe how to connect to a tracker:

- `pluginId`, `displayName`: the id integrations use (it must equal the file name) and the label shown in the UI
- `version`, `schemaVersion`, `changelog`: the plugin's semver version, the YAML format it uses (`1` today, required in custom plugins) and its release notes
- `fields`: form inputs required to configure an integration
- `customFields`: optional tracker-specific inputs beyond the shared integration fields
- `http`: shared base URL and headers
- `steps`: HTTP requests and extraction rules
- `mapping`: how extracted values map into TrackArr stats
- `dashboard`: which stats should be shown on the UI card, including optional `byteUnitSystem` for binary vs decimal byte formatting

The frontend plugin editor validates more than generic YAML syntax. It understands the TrackArr plugin structure, shows completions for supported fields and enums, offers snippets for common blocks, and blocks saves when the document is malformed or semantically invalid. The full schema is documented in the `trackarr-plugins` [`CONTRIBUTING.md`](https://github.com/leandrobattochio/trackarr-plugins/blob/main/CONTRIBUTING.md).

To validate plugin files outside the app, with the same rules the API applies on save (schema, `pluginId` format, engine-owned fields, `version` and `schemaVersion`), run from the repository root:

```bash
dotnet run --project backend/tools/TrackerStats.PluginValidator -- path/to/*.yaml
```

It prints one line per file and exits non-zero when any file is invalid. Each file name must equal its `pluginId`.

## Local development

### Requirements

- Node.js 22+
- pnpm
- .NET SDK 10

### Local development config

`appsettings.Development.json` is intentionally untracked. If you want local development defaults, create `backend/src/TrackerStats.Api/appsettings.Development.json` on your machine.

Example:

```json
{
  "Data": {
    "Directory": "../../.data"
  },
  "ConnectionStrings": {
    "PostgresConnection": "Host=127.0.0.1;Port=5432;Database=trackarr;Username=trackarr;Password=trackarr"
  }
}
```

Notes:

- Keep this file local only. Do not commit machine-specific or secret values.
- Use environment variables instead when you want settings that also work in CI or Docker.
- Set `Data:Directory` to a writable local folder; `../../.data` resolves to `backend/.data`. Plugins are read from `<Data:Directory>/plugins/official`, `overrides` and `custom`; on start, the app downloads the official plugins from `trackarr-plugins`. To work offline, set `PluginSource:Url` to the test fixture, `file:///<repo>/backend/tests/fixtures/plugin-source/`. On start, the app also reads the trackarr releases from the GitHub Releases API once, unauthenticated; `AppReleases:Url` replaces that URL.
- `ConnectionStrings:PostgresConnection` is required for the main application database.

### 1. Run the backend

```powershell
cd backend
dotnet restore TrackerStats.sln
dotnet run --project src\TrackerStats.Api\TrackerStats.Api.csproj
```

Development defaults:

- API: `http://localhost:5000`
- OpenAPI + Scalar UI: `http://localhost:5000/scalar/v1`
- Hangfire dashboard: `http://localhost:5000/hangfire`

On startup the backend:

- applies EF Core migrations automatically to the configured PostgreSQL database
- creates the default application settings row if it does not exist
- schedules recurring jobs for saved integrations

### 2. Run the frontend

```powershell
cd frontend
pnpm install
pnpm dev
```

Frontend dev server:

- App: `http://localhost:8080`
- API proxy: `/api` -> `http://localhost:5000`

## Docker deployment

The Docker setup builds the frontend, publishes the backend, starts the API container, and runs PostgreSQL alongside it.

```powershell
cd docker
docker compose up --build
```

The build downloads the latest `trackarr-plugins` `main` into the image and checks every file against its `index.json`, so it needs access to GitHub. The `PLUGIN_SOURCE_URL` build argument (ending with `/`) points it at a fork or mirror.

Default runtime values:

- App URL: `http://localhost:3000`
- Persistent data volume: `trackarr_data`
- Internal data directory: `/data`
- Default timezone: `America/Sao_Paulo`

The environment variables are listed under [Configuration](#configuration).

Storage layout:

- PostgreSQL stores the main application data
- Hangfire stores job data in a SQLite file under `Hangfire__Directory`
- Plugin definitions are read from `Data__Directory/plugins` (`official/`, `overrides/`, `custom/` and `state.json`)

## Configuration

Settings come from `appsettings.json` and can be overridden with environment variables, where `__` separates the sections (`Data__Directory` sets `Data:Directory`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `ConnectionStrings__PostgresConnection` | none, required | PostgreSQL connection string for the application data. |
| `ConnectionStrings__HangfireConnection` | `Data Source=hangfire.db` | SQLite connection string of the Hangfire job store. |
| `Hangfire__Directory` | not set | In `Production`, the folder that holds the Hangfire SQLite file. The compose files set it to `/data`. |
| `Data__Directory` | `/data` | Data folder. Plugins live in `<Data__Directory>/plugins`, in `official/`, `overrides/` and `custom/` plus `state.json`. A relative path is resolved against the app's content root. |
| `PluginSource__Url` | `https://raw.githubusercontent.com/leandrobattochio/trackarr-plugins/main/` | Where the startup download reads `index.json` and the plugin files. Use an `https://` URL for a fork or mirror, or a local folder laid out like `trackarr-plugins` as `file:///path/to/trackarr-plugins/` to work offline or try plugin changes. The trailing slash is optional; `http://` is rejected. |
| `PluginSource__SnapshotDirectory` | `plugin-snapshot` next to the app | Plugin snapshot that seeds an empty `official/` folder. The Docker image fills it at build time; there is normally no reason to change it. |
| `AppReleases__Url` | `https://api.github.com/repos/leandrobattochio/trackarr/releases?per_page=100` | Where What's New reads the trackarr release notes, once per start and unauthenticated. |
| `APP_TIMEZONE`, `TZ` | `America/Sao_Paulo` | Timezone of the container. `APP_TIMEZONE` is also a Docker build argument that sets the UI's timezone. |
| `ASPNETCORE_ENVIRONMENT` | `Production` in the compose files | ASP.NET Core environment. |

The compose file in `docker/` also reads `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` and `POSTGRES_CONNECTION_STRING` to configure its PostgreSQL container.

## Data storage

By default TrackArr stores:

- application data in PostgreSQL
- Hangfire job state in a separate SQLite database
- plugin YAML files on disk

In Docker, Hangfire files live under `/data` and plugin definitions under `/data/plugins`, so both persist with the mounted volume.

### Upgrading from v0.3

v0.4 is a breaking release. Read the [v0.4 upgrade guide](docs/upgrade-0.4.md) before upgrading. In short:

- Every v0.3 plugin file is deleted on the first v0.4 start, custom plugins included, with no backup. Copy any custom plugin you want to keep before upgrading, and recreate it with **New Plugin** afterwards.
- The old plugin folder setting was removed; plugins now live under `Data__Directory/plugins`.
- Integrations and their snapshot history are kept. An integration whose plugin no longer exists shows **Plugin not found** until a plugin with that id exists again.
- An integration whose `baseUrl` is no longer listed by its plugin shows an error explaining how to fix it.
- Downgrading from v0.4 to v0.3 is not supported.

```mermaid
flowchart TD
    A["Copy your v0.3 custom plugin YAML files somewhere safe"] --> B["Update the image tag and remove the old plugin folder variable"]
    B --> C["First v0.4 start"]
    C --> D["Every *.yaml in Data__Directory and Data__Directory/templates is deleted, once"]
    D --> E["official/ is seeded from the image snapshot, then the startup download runs"]
    E --> F{"For each integration: does its plugin exist?"}
    F -- "Yes" --> G{"Is its baseUrl still listed by the plugin?"}
    G -- "Yes" --> H["Syncs as before, with its snapshot history"]
    G -- "No" --> I["Shows an invalid integration error: edit it and pick a listed base URL"]
    I --> H
    F -- "No" --> J["Shows Plugin not found and keeps its history"]
    J --> K["Recreate the plugin with New Plugin, using the same id"]
    K --> G
```

## API overview

The API has **no authentication** (see the warning at the top): keep it on a trusted network.

Main endpoints:

- `GET /api/integrations`
- `POST /api/integrations`
- `PUT /api/integrations/{id}`
- `DELETE /api/integrations/{id}`
- `POST /api/integrations/{id}/sync`
- `GET /api/integrations/{id}/snapshots`
- `GET /api/snapshots?integrationId=...`
- `GET /api/plugins`
- `GET /api/plugins/{pluginId}`
- `POST /api/plugins`
- `PUT /api/plugins/{pluginId}` (saving an official plugin writes an override)
- `DELETE /api/plugins/{pluginId}` (custom plugins only; `409` with the integrations that use it)
- `DELETE /api/plugins/{pluginId}/override` (Use official)
- `GET /api/plugins/{pluginId}/diff` (base, your override, the latest official version and the changelog since the base)
- `POST /api/plugins/test` (dry run: `{ integrationId, yaml }` or `{ integrationId, useOfficial: true }`)
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/about`
- `GET /api/about/plugin-download` (result of the last startup download)
- `GET /api/app-releases?since=<last-read version>` (installed version, latest GitHub release, `updateAvailable`, release notes after `since` up to the installed version; `status: unavailable` when GitHub cannot be reached)
- `GET /api/whats-new` (unread app releases since v0.4.0, unread plugin updates and `shouldAutoOpen`; the read state is stored in Postgres, so every browser shares it)
- `POST /api/whats-new/read` (marks everything up to now as read)

Plugin create/update requests use raw YAML in the request body. A dry run uses the integration's settings but saves no snapshot and does not change the integration; it returns the outcome, each step's HTTP status and path (no query string, secrets masked), the extracted stats and the first failing field.

## UI pages

- `/` dashboard for integrations and sync status
- `/snapshots` chart view for historical metrics
- `/plugins` plugin management: status badges, YAML editor with schema-backed IntelliSense and save-blocking validation, Test, New Plugin
- `/plugins/:pluginId/update` review screen of an outdated override
- `/settings` shared HTTP settings, system information and the last plugin download
- `/help` how plugins work, how to change them, and the plugin YAML structure
