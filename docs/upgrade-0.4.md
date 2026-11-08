# Upgrading to trackarr v0.4

v0.4 moves the official tracker plugins to their own repository,
[`trackarr-plugins`](https://github.com/leandrobattochio/trackarr-plugins), and downloads them on every start. It
is a **breaking release**: read this guide before you change the image tag.

## Summary

| Change | What you need to do |
| --- | --- |
| Every v0.3 plugin file is deleted on the first v0.4 start, custom plugins included, with no backup. | Copy your custom plugins before upgrading, and recreate them with **New Plugin**. |
| `Plugins__Directory` is removed. | Remove it from your compose file. Plugins live under `<Data__Directory>/plugins`. |
| Integrations and their snapshot history are kept. | Nothing. An integration whose plugin is gone shows **Plugin not found** until you recreate it. |
| An integration may show a `baseUrl` error. | Edit the integration and pick one of the listed base URLs. |
| Downgrading to v0.3 is not supported. | Back up before upgrading. |

## Before you upgrade

1. **Back up** the PostgreSQL database and the data volume (`/data` in the example compose file). They are the only
   way back to v0.3.
2. **Copy your custom plugins.** In v0.3 they are the `*.yaml` files in the data folder (`/data`) and in
   `/data/templates`, or in the folder `Plugins__Directory` pointed to. Copy them anywhere outside the data folder.
3. **Note your edits to official plugins** (`asc`, `bj-share`, `fearnopeer`, `seedpool`). They are deleted too, and
   v0.4 already ships the current official versions, so you may not need them.
4. **Update your compose file:** set the new image tag, remove `Plugins__Directory`, and keep the data volume
   mounted. `Data__Directory` defaults to `/data`, so most setups do not need to set it:

   ```diff
    services:
      trackarr:
   -    image: ghcr.io/leandrobattochio/trackarr:v0.3.2
   +    image: ghcr.io/leandrobattochio/trackarr:v0.4.0
        environment:
          ConnectionStrings__PostgresConnection: Host=db;Port=5432;Database=trackarr;Username=arr;Password=arr123
          Hangfire__Directory: /data
   -      Plugins__Directory: /data
   +      Data__Directory: /data
        volumes:
          - /mnt/user/appdata/trackarr:/data
   ```

## What happens on the first start

1. Database migrations run. Integrations, their settings and their snapshots are not changed.
2. **The v0.3 plugin files are deleted:** every `*.yaml` file with a top-level `pluginId` key directly in
   `<Data__Directory>` and in `<Data__Directory>/templates`. Other files and subfolders are kept. Each deleted path is logged, and
   `<Data__Directory>/plugins/state.json` records the cleanup, so it runs only once: a YAML file you put there later
   is left alone. If a file cannot be deleted, a warning is logged and the cleanup runs again on the next start.
3. The official plugins are copied from the snapshot embedded in the image into
   `<Data__Directory>/plugins/official/`, so they work even without internet access.
4. The app starts serving requests. In the background it downloads the latest official plugins from
   `trackarr-plugins`; the result is shown in **Settings > About**.
5. **What's New** opens once with the v0.4 release notes.

trackarr never reads `Plugins__Directory` again. If it pointed to a folder outside `<Data__Directory>`, the files in
that folder are neither read nor deleted.

## Breaking changes

### Plugins and custom plugins are deleted

There is no plugin migration and no backup. To get a custom plugin back:

1. Open **Manage Plugins** and click **New Plugin**.
2. Paste your v0.3 YAML. Then:
   - add `schemaVersion: 1`, which is now required, and a `version` such as `1.0.0`;
   - make sure `pluginId` uses only lowercase letters and digits separated by single hyphens (for example
     `my-tracker`). To bring back the integrations that used the plugin, keep the same id;
   - an id that belongs to an official plugin is rejected; use another id, or edit the official plugin instead.
3. Click **Test** to dry-run it with one of its integrations, then **Create Plugin**.

To bring back an edit you made to an official plugin, open the official plugin, apply the change and **Save**: trackarr
keeps it as an override and warns you when a newer official version is released. See
[Plugins](../README.md#plugins) in the README.

Plugins are now changed only in the UI. Editing the files under `<Data__Directory>/plugins` by hand is not supported.

### `Plugins__Directory` is removed

Plugins now live in `<Data__Directory>/plugins`:

| Path | Content |
| --- | --- |
| `official/` | Official plugins, written only by the startup download |
| `overrides/` | Your edited copies of official plugins, plus a `<id>.base.yaml` copy of the version each one was based on |
| `custom/` | Your custom plugins |
| `state.json` | Installed official versions, override bases, and the last download result |

`Data__Directory` defaults to `/data`. `Hangfire__Directory` is unchanged.

### Integrations are kept

Integrations keep all their settings and their snapshot history. An integration whose plugin no longer exists shows
**Plugin not found** and does not sync, but its history stays. Creating a custom plugin with the same id reactivates
it, with its history.

### `baseUrl` errors may appear

An integration stores the tracker base URL it was created with. If its plugin no longer lists that URL (an official
plugin may have moved to a new domain), the integration shows an error like:

> Invalid integration: base URL 'https://old.example' is no longer listed by plugin 'example'. It now accepts:
> https://new.example. To fix it, edit the integration and pick the new base URL.

It is not corrected automatically: edit the integration on the dashboard and pick one of the listed URLs.

### New outgoing requests

On every start trackarr now contacts GitHub:

- `raw.githubusercontent.com`, to download the official plugins. `PluginSource__Url` changes the source to a fork,
  a mirror or a local `file://` folder.
- `api.github.com`, once, unauthenticated, to read the trackarr release notes for What's New. `AppReleases__Url`
  changes it.

Without internet access trackarr keeps using the plugins on disk and shows the error in **Settings > About**.

### The API is still unauthenticated

trackarr has no authentication. Keep it on a trusted network and never expose it to the internet.

## Downgrading is not supported

Going back from v0.4 to v0.3 is not supported: v0.4 adds a database migration, deletes the v0.3 plugin files and
stores plugins in a layout v0.3 does not read. To return to v0.3, restore the database and data volume backups you
took before upgrading.
