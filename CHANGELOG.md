# Changelog

All notable changes to trackarr are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-07

**This release has breaking changes.** Read the
[upgrade guide](https://github.com/leandrobattochio/trackarr/blob/main/docs/upgrade-0.4.md) before
upgrading from v0.3.

### Breaking changes

- Every v0.3 plugin file is deleted on the first v0.4 boot, custom plugins included. There is no
  migration and no backup: recreate your custom plugins after upgrading.
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

### Fixed

- A plugin id could be used to write files outside the plugins folder.
- When two files declared the same plugin id, the editor and the runtime used different files.
- Saving a plugin in the editor rewrote the YAML and dropped its comments.

[0.4.0]: https://github.com/leandrobattochio/trackarr/compare/v0.3.2...v0.4.0
