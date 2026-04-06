# TrackArr

[![Frontend coverage](https://codecov.io/github/leandrobattochio/trackarr/graph/badge.svg?flag=frontend)](https://app.codecov.io/github/leandrobattochio/trackarr)
[![Backend coverage](https://codecov.io/github/leandrobattochio/trackarr/graph/badge.svg?flag=backend)](https://app.codecov.io/github/leandrobattochio/trackarr)

TrackArr is a self-hosted dashboard for private tracker monitoring. It lets you register tracker integrations, sync stats manually or on a schedule, keep historical snapshots, and define new tracker connectors through YAML instead of hard-coded backend logic.

## What it does

- Monitors tracker ratio and transfer stats from a single dashboard
- Stores historical snapshots for time-based charts
- Runs recurring sync jobs per integration using cron expressions
- Supports built-in and custom tracker plugins
- Lets you inspect, create, and edit disk-backed plugin definitions from the UI
- Ships as a single production container with the React frontend served by ASP.NET Core

## Core features

- Dashboard with per-tracker cards for ratio, uploaded, downloaded, seed bonus, buffer, hit and runs, and torrent counts
- Manual sync for any configured integration
- Automatic recurring sync with Hangfire-backed scheduling
- Snapshot charts for uploaded/downloaded bytes and torrent activity
- In-app YAML editor for plugin authoring with schema-aware validation, completions, snippets, and hover docs
- Built-in plugin catalog seeded to disk on first run

## Screenshots

### Dashboard

The dashboard is the main operational view. It combines portfolio-level totals across all configured trackers with per-integration cards that surface ratio status, key metrics, last sync state, next automatic run, and quick actions for syncing, editing, opening snapshots, or deleting an integration.

The screenshot below also shows the ratio-warning treatment in context: integrations that fall below the configured minimum ratio are visually highlighted so risky trackers stand out immediately.

![TrackArr dashboard showing overview tiles and tracker cards with ratio status](screenshots/dashboard.png)

### Manage Plugins

The plugin-management screen is where disk-backed plugin definitions are inspected, created, and edited. The catalog on the left shows the YAML files currently loaded from disk, while the editor on the right exposes the full definition that drives integration forms, HTTP steps, mappings, and dashboard metrics.

This is also where the newer editor capabilities matter: YAML saves are blocked when the document is malformed or semantically invalid, and the editor provides TrackArr-specific validation and authoring help while you work.

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
- Entity Framework Core with SQLite or PostgreSQL
- Hangfire + `Hangfire.Storage.SQLite`
- Scalar/OpenAPI in development
- YAML plugin engine powered by `YamlDotNet`

The production container serves the API and the built frontend together on port `3000`.

## Project structure

```text
.
|-- backend/
|   |-- TrackerStats.sln
|   |-- plugins/                    # Built-in YAML tracker definitions
|   `-- src/
|       |-- TrackerStats.Api/       # API, DI, startup, controllers
|       |-- TrackerStats.Application/
|       |-- TrackerStats.Domain/    # Entities, repository interfaces, plugin contracts
|       `-- TrackerStats.Infrastructure/
|           |-- Data/               # EF Core DbContext and migrations
|           |-- Plugins/            # Plugin registry, YAML engine, loaders
|           `-- Services/           # Sync jobs and scheduling
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

## How plugins work

TrackArr uses YAML plugin definitions to describe how to connect to a tracker:

- `fields`: form inputs required to configure an integration
- `customFields`: optional tracker-specific inputs beyond the shared integration fields
- `http`: shared base URL and headers
- `steps`: HTTP requests and extraction rules
- `mapping`: how extracted values map into TrackArr stats
- `dashboard`: which stats should be shown on the UI card, including optional `byteUnitSystem` for binary vs decimal byte formatting

The frontend plugin editor validates more than generic YAML syntax. It understands the TrackArr plugin structure, shows completions for supported fields and enums, offers snippets for common blocks, and blocks saves when the document is malformed or semantically invalid.

Built-in plugins currently included:

- `asc`
- `bj-share`
- `fearnopeer`
- `seedpool`

Plugin loading:

1. Plugin definitions are loaded from YAML files on disk
2. The Manage Plugins UI creates new files and edits existing files in place

There is no database fallback or override layer for plugin templates.

## Local development

### Requirements

- Node.js 22+
- Yarn
- .NET SDK 10

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

- applies EF Core migrations automatically when using SQLite
- creates the PostgreSQL schema automatically when `ConnectionStrings__PostgresConnection` is provided
- seeds built-in plugin YAML files into the active plugins directory if missing
- schedules recurring jobs for saved integrations

### 2. Run the frontend

```powershell
cd frontend
yarn install
yarn dev
```

Frontend dev server:

- App: `http://localhost:8080`
- API proxy: `/api` -> `http://localhost:5000`

## Docker deployment

The Docker setup builds the frontend, publishes the backend, and serves everything from one container.

```powershell
cd docker
docker compose up --build
```

To run with the bundled PostgreSQL sidecar instead of SQLite for the main application database:

```powershell
cd docker
docker compose --profile postgres up --build
```

Default runtime values:

- App URL: `http://localhost:3000`
- Persistent data volume: `trackarr_data`
- Internal data directory: `/data`
- Default timezone: `America/Sao_Paulo`

Relevant environment variables from `docker/docker-compose.yml`:

- `ConnectionStrings__PostgresConnection`
- `APP_TIMEZONE`
- `Database__Directory`
- `Hangfire__Directory`
- `Plugins__Directory`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`

Database precedence:

- If `ConnectionStrings__PostgresConnection` is set to a non-empty PostgreSQL connection string, TrackArr uses PostgreSQL for the EF Core application database
- Otherwise TrackArr falls back to the existing SQLite database in `/data`
- Hangfire storage remains SQLite and continues to use `Hangfire__Directory`

## Data storage

By default TrackArr stores:

- application data in SQLite
- Hangfire job state in a separate SQLite database
- plugin YAML files on disk

If PostgreSQL is configured, only the application data moves to PostgreSQL. Hangfire job state and plugin YAML files remain on disk.

In production, the container redirects the SQLite-backed files into `/data` and `/data/plugins` so they survive container restarts when the volume is mounted.

## API overview

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
- `PUT /api/plugins/{pluginId}`

Plugin create/update requests use raw YAML in the request body.

## UI pages

- `/` dashboard for integrations and sync status
- `/snapshots` chart view for historical metrics
- `/plugins` YAML plugin management with schema-backed IntelliSense and save-blocking validation
- `/help` usage guidance

## Notes and constraints

- Each integration payload must include a `cron` field because recurring scheduling is derived from the saved payload
- `required_ratio` is required by the current integration flow and is parsed from the payload JSON
- Sensitive plugin fields are masked in the UI and preserved on update if the user leaves them blank
- Plugin templates are always loaded from disk, and the Manage Plugins UI currently supports create/edit but not delete
- Help, snapshots, and plugin-management routes are lazy-loaded in the frontend, and the Monaco/YAML editor stack is split into dedicated chunks
