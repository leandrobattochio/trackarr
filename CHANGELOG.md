# Changelog

All notable changes to trackarr are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Plugin bases. A plugin can say `extends: <baseId>` and leave out every key the base defines
  (`fields`, `customFields`, `http`, `authFailure`, `steps`, `mapping`, `dashboard`); a key the
  plugin sets replaces the base's key whole. A tracker that runs a known engine, such as UNIT3D,
  then needs only its name and address. Bases come from `trackarr-plugins` with the official
  plugins, are checked against `index.json` the same way, are stored in
  `<Data__Directory>/plugins/bases/` and ship in the image snapshot. A base update reaches every
  plugin that extends it, overrides and custom plugins included, and shows in What's New and in
  **Settings > About**. Custom plugins can extend the official bases too.
- `TrackerStats.PluginValidator` takes `--bases <folder>`, validates every base in it and resolves
  `extends` with them.

### Changed

- Plugin schema version 2, needed by `extends` and by plugin bases. Plugins on schema version 1 keep
  working unchanged. trackarr 0.5 and earlier keep the last schema 1 version of an official plugin
  that moves to schema 2, and ignore the bases.
- The Help page no longer explains how to edit plugins or the YAML format, and the new plugin
  template has no comments: both link to the [wiki](https://github.com/leandrobattochio/trackarr/wiki)
  instead.

## [0.5.2] - 2026-11-08

### Added

- Proxies for trackers that must be reached through one
  ([#9](https://github.com/leandrobattochio/trackarr/issues/9)). **Settings > Proxies** keeps HTTP,
  SOCKS4 and SOCKS5 proxies, with an optional username and password, and a **Test** button. Each
  integration can pick one in its settings; its syncs and plugin tests then go through it. Other
  requests, such as the plugin download, never use a proxy. A proxy that an integration uses cannot
  be deleted. Like Sonarr, SOCKS4 resolves the tracker's host name locally, while SOCKS5 lets the
  proxy resolve it.

### Fixed

- A tracker that reports an infinite ratio (`∞`, `inf` or `infinity`), as MyAnonamouse does before
  an account's first download, no longer fails the sync. The `decimal` transform keeps the value,
  and the dashboard, the list and the plugin Test show the ratio as ∞.

## [0.5.1] - 2026-11-08

### Added

- The dashboard can show the trackers as a compact list. The toggle next to **Add Tracker** switches
  between cards and list, and the browser remembers the choice. Drag and the up/down buttons
  reorder the trackers in both views.

### Fixed

- On phones, the dashboard no longer grows wider than the screen: tracker names truncate, cards and
  list rows fit the screen, and the overview tiles keep their values on one line.
- On wide screens with three cards per row, the stats on each tracker card were cut off.

### Changed

- The documentation moved from the README to the
  [wiki](https://github.com/leandrobattochio/trackarr/wiki). The README shows the app in GIFs, on a
  desktop and on an iPhone.
- The Docker image build no longer downloads the Cypress binary, which it never used.

## [0.5.0] - 2026-11-08

trackarr now runs as a single container: SQLite is the default database, and PostgreSQL is
optional. This is not a breaking change for existing installs: if you set
`ConnectionStrings__PostgresConnection` today, keep it, and trackarr keeps using your PostgreSQL
database and its data with no change.

If you ran the repository's `docker/docker-compose.yml`, which included PostgreSQL until v0.4,
start that stack with `docker/docker-compose.postgres.yml` from now on: it uses the same names
and finds your data.

### Added

- SQLite support. Without `ConnectionStrings__PostgresConnection`, the application data lives in
  `<Data__Directory>/trackarr.db`, created and migrated on the first start.
- A "Using PostgreSQL" section in the README and `docker/docker-compose.postgres.yml`, an example
  with a PostgreSQL container.
- The startup log names the database engine and its version, plus the file path for SQLite. The
  connection string and its password are never logged.
- **Settings > About** shows `SQLite` with the database file path, or `PostgreSQL`.

### Changed

- `ConnectionStrings__PostgresConnection` is optional. Setting it means "use PostgreSQL".
- `docker/docker-compose.yml` and the README compose example run trackarr alone, with no
  PostgreSQL service.
- trackarr no longer creates a missing PostgreSQL database. Startup stops with a message telling
  you to create it, or to remove the setting to use SQLite. Tables inside an existing database are
  still created.
- When PostgreSQL cannot be reached, startup retries 3 times, 5 seconds apart, then stops with a
  clear message; during those retries any PostgreSQL error is retried, since a server that is
  still starting refuses connections for a moment. Other PostgreSQL errors stop startup at once.
- A corrupt `trackarr.db` stops startup with a message saying to restore it from a backup or
  delete it.

trackarr never copies data between SQLite and PostgreSQL. Migrating an existing SQLite database to
PostgreSQL is not supported, and removing the PostgreSQL setting opens the SQLite file that is on
disk, or an empty one: it does not bring the PostgreSQL data back.

## [0.4.0] - 2026-11-08

**This release has breaking changes.** Read the
[upgrade guide](https://github.com/leandrobattochio/trackarr/blob/main/docs/upgrade-0.4.md) before
upgrading from v0.3.

### Breaking changes

- Every v0.3 plugin file (a YAML file with a top-level `pluginId` in the data folder or in
  `templates/`) is deleted on the first v0.4 boot, custom plugins included. There is no migration
  and no backup: recreate your custom plugins after upgrading.
- `Plugins__Directory` is removed. Plugins now live under `<Data__Directory>/plugins`, in the
  `official/`, `overrides/` and `custom/` folders plus a `state.json` file.
- An integration whose plugin no longer exists shows **Plugin not found**. Creating a custom plugin
  with that id reactivates it.
- An integration whose `baseUrl` is no longer listed by its plugin shows an error saying what changed
  and how to fix it. It is not corrected automatically.
- Downgrading from v0.4 to v0.3 is not supported.

Integrations, their settings and their snapshot history are kept.

### Added

- Official plugins come from the
  [trackarr-plugins](https://github.com/leandrobattochio/trackarr-plugins) repository and are
  downloaded on every startup, so a tracker fix no longer needs a new app image. Every file is
  checked against the sha256 in the index. The image embeds a snapshot for the first boot.
- `PluginSource__Url` changes the plugin source, for forks, mirrors and local folders (`file://`).
- `Data__Directory` sets the data directory (default `/data`).
- Plugins carry a semver `version`, an integer `schemaVersion` and a `changelog`. A plugin that
  needs a newer schema is skipped with an "update trackarr" message.
- Editing an official plugin creates an override. When a newer official version exists, the app
  shows a warning on every page, the two diffs, and **Use official** / **Keep mine**.
- Custom plugins, created with **New plugin**, are never touched by the download and cannot be
  deleted while an integration uses them.
- Plugin status badges: Official, Edited, Custom, Orphan, Deprecated and Incompatible.
- The plugin editor has a **Test** button that dry-runs the YAML with an existing integration's
  settings, and outdated overrides offer **Test official**.
- What's New shows the trackarr and plugin changelogs since you last opened it, and the app tells
  you when a newer trackarr release is available.
- The About tab shows the result of the last plugin download.
- The engine logs the HTTP status of every non-2xx step response. Secrets are never logged.

### Changed

- The frontend is built with pnpm instead of yarn, and its dependencies are updated to clear the
  audit warnings.
- `Microsoft.AspNetCore.OpenApi` is updated to 10.0.14, which pulls a `Microsoft.OpenApi` without
  the circular-reference parsing vulnerability (GHSA-v5pm-xwqc-g5wc).

### Fixed

- The Amigos Share Club plugin reads the stats from the rebuilt site. Its base URL is now
  `https://amigos-share.club/`: edit an existing ASC integration to pick it.
- A plugin id could be used to write files outside the plugins folder.
- When two files declared the same plugin id, the editor and the runtime used different files.
- Saving a plugin in the editor rewrote the YAML and dropped its comments.

[0.5.2]: https://github.com/leandrobattochio/trackarr/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/leandrobattochio/trackarr/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/leandrobattochio/trackarr/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/leandrobattochio/trackarr/compare/v0.3.2...v0.4.0
