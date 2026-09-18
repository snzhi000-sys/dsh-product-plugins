# Maintaining and iterating

English | [中文](MAINTAINING.zh.md)

This repository is the **authoritative source** for the DeepSeek Harness product plugins we maintain. The app engineering tree only consumes them; the product introduction is in [README.md](README.md).

## Layout and naming

```
<plugin>/            one directory per plugin, named after the package without its `dsh-` prefix
  package.json       package name must be `dsh-<plugin>`
  host/              Cordis host entry (`main`)
  client/src/        client sources
  client/dist/       built client bundle (tracked, see below)
  tests/             `node --test` suites
  README.md / README.zh.md
```

The app tree maps this directory through `distribution/profile-manifest.json`:

```json
{ "productPlugins": { "dsh-file-edit": "plugins/file-edit" } }
```

The mapping is positional: app-tree `plugins/<plugin>` corresponds to this repository's `<plugin>`. `desktop/scripts/prepare-profile.mjs` rejects absolute paths and any `..` segment, so the app tree cannot reference this repository directly — the sync step copies it in.

## Build and test

```bash
cd file-edit
npm install                # once, for esbuild and CodeMirror dev dependencies
npm run build:icon         # regenerate client/src/tab-icon.js from the webp asset
npm run build:client       # esbuild → client/dist/client.js
npm test                   # node --test tests/*.test.mjs
node scripts/collect-third-party-notices.mjs --check   # notices must be current
node scripts/check-doc-links.mjs                       # every relative README reference resolves
```

`client/dist/client.js` is **tracked on purpose**: the app packaging chain archives the plugin with `npm pack`, whose `files` field ships `host`, `client/dist` and `README.md`, and `package.json` has no `prepare` script. Keeping the built bundle here makes the sync and the package reproducible without a network install. Rebuild it before committing whenever `client/src/` changes — the sync refuses a bundle older than the newest client source.

## The two layouts

`file-edit/` uses the repository layout below. `desktop-pet/` keeps the pipeline it was migrated with — `src/`, `dist/`, `assets/` and its own `cordis.patch.yml` — because its client bundle is built by its own scripts (`npm run build`) and its 95 MB of Live2D models are third-party assets curated from `Eikanya/Live2d-model` (see `desktop-pet/assets/NOTICE.txt`). `desktop/scripts/sync-product-plugins.mjs` copies either layout: it checks that every path in the package's `files` list exists and that a package declaring `dsh.client` ships a bundle in either place, and it only refuses a stale bundle for its own `client/src` + `client/dist/` layout.

## How the app consumes this repository

```bash
cd <app-tree>/desktop
npm run sync:plugins              # copy every mapped plugin into the app tree
npm run sync:plugins -- --check   # verify instead of writing; non-zero exit on drift
```

- The app packaging chain runs `sync:plugins` before `prepare:profile`, so `npm run dist:dev` / `dist:stable` always package the sources in this repository.
- The app-tree copy (`<app-tree>/plugins/<plugin>`) is **generated and git-ignored**. Never edit it: change this repository, then sync.
- `DSH_PLUGIN_HOME` overrides where the sync reads from; it defaults to the `plugins` directory beside the app tree.

## Iteration flow

Every plugin change follows this order. This repository is the single source of truth; the app-tree copy is generated from it.

1. **Change the sources here**, never the app-tree copy: `npm run check:plugins` reports drift, and `dist:dev` / `dist:stable` overwrite that copy anyway.
2. **Build and test in the plugin directory**: `npm run build:icon && npm run build:client && npm test`. Bump `version` in `package.json` for anything you ship, and say so in the commit message.
3. **Land it in the app tree**: `cd "<app-tree>/desktop" && npm run sync:plugins`. The packaging chain syncs automatically before `prepare:profile`, so the manual step is only needed when you want the copy without packaging; `npm run check:plugins` proves byte equality.
4. **Build the Dev package**: `cd "<app-tree>/desktop" && npm run dist:dev`. The channel gate runs desktop tests, `verify:source-privacy`, profile privacy verification, product identity verification and an isolated launch with empty userData.
5. **Verify behaviour on the real app**: launch `<app-tree>/desktop/dist/dev/mac-arm64/DeepSeek Harness Dev.app` and walk the feature in a test workspace. Where you need proof instead of eyeballing, drive a packaged probe with isolated userData, such as `<app-tree>/desktop/scripts/probe-edit-open-service.mjs`.
6. **Only after Dev acceptance** build Stable, and only with explicit approval to touch `/Applications`: `npm run dist:stable`, then the user replaces the installed app by hand.
7. **Record the change**: commit here with the scope in the message. App-side changes (`distribution/profile-manifest.json` mappings, `desktop/**`, `packages/client/ui-explorer/**`) are committed in the app tree — those files do not belong here, and the app tree does not track plugin sources.
8. **Push**: plugin changes go to this repository's `main`; app changes follow their own flow. This repository stays the working authoritative source; the remote is only a mirror.

A feature that spans both sides is **one commit in each repository**, naming each other; neither side alone reproduces it.

## What lives where

| Content | Repository |
| --- | --- |
| Plugin `host/`, `client/`, `tests/`, plugin READMEs, built client bundle | this repository |
| `docs/` (cover source and feature screenshots) | this repository |
| `distribution/profile-manifest.json`, `distribution/cordis.patch.yml` | app tree |
| `desktop/**` (product desktop shell, packaging and verification scripts) | app tree |
| `packages/client/ui-explorer/**` (our Explorer, not a plugin) | app tree |
| `plugins/edit-migration-probes/**` (migration probe, not a product plugin) | app tree |
| `desktop-pet/**` — sources, built `dist/`, third-party `assets/`, its bundle patch | this repository |

## Adding a plugin

1. Create `<plugin>/` here with `package.json` named `dsh-<plugin>`, `"type": "module"`, and a `files` list covering what must ship.
2. Add the mapping `"dsh-<plugin>": "plugins/<plugin>"` to the app tree's `distribution/profile-manifest.json`.
3. Build the client bundle, commit, run `npm run sync:plugins` in the app tree, then package.

## Naming and identity

The package name is `dsh-file-edit` and stays that way. Three strings next to it are **persisted contracts** that must never be renamed with it:

- `dsh-file-edit-ref` — the reference source name; it lives in already-sent messages and reference snapshots, so renaming it makes historical sessions stop recognising their own references.
- `application/x-dsh-file-edit-references+json` — the clipboard MIME that pastes references back.
- `dsh-file-edit` as the sidebar **tab kind** — it doubles as the `sidebarRightTabs` type id, and the official sidebar stores each session's tab layout in the browser; renaming only reopens tabs once.

The package name, the `productPlugins` key in the app tree's `distribution/profile-manifest.json` and the `id`/`name` in `distribution/cordis.patch.yml` form one set: change them together, and `desktop/scripts/sync-product-plugins.mjs`, which requires the package name to equal the mapping key, refuses a half change. The cross-package service the runtime Explorer reads, `dshFileEditOpen`, is independent of the package name.

## Rules

- Binary assets **cannot** be `require`d: a `require` inside the factory hits the shell's static module table at runtime, so import at module top level and let the bundler inline it. The sidebar tab glyph ships as a generated data-URL module, see `file-edit/scripts/embed-tab-icon.mjs`.
- Shipped files must not contain absolute paths, personal paths, credentials or session data: the app's profile privacy gate rejects them.
- Every registration goes through `ctx.effect()` / `ctx.on()`; optional Cordis services are read with `ctx.get(name)`.
- Client bundles may `require()` only platform modules the app exposes, such as `@deepseek-ai/dsh-client-ui-primitives`.
- Keep each plugin's `README.md` / `README.zh.md` pair in step with its behaviour, and regenerate the third-party notices with `scripts/collect-third-party-notices.mjs`; `--check` verifies them.

## Third-party assets

`desktop-pet/assets/` carries Live2D models curated from a third-party collection and ships its own `assets/NOTICE.txt`. They are covered by that notice, not by this repository's MIT license, so **the model files are not committed here** (`.gitignore` keeps `desktop-pet/assets/*` out and tracks `NOTICE.txt` alone).

A fresh clone therefore has the pet's code but no models. Restore them from the legacy project the plugin was migrated from:

```bash
LEGACY=/Users/edy/Downloads/azg_ai/harness-macos-desktop-plugin-suite/plugins/desktop-pet
cp -R "$LEGACY/assets/." desktop-pet/assets/
test "$(find desktop-pet/assets -type f | wc -l | tr -d ' ')" = 781   # 781 files, 23 model directories
```

Republishing the models anywhere requires reviewing the collection's terms first.

## License

Released under the **MIT License** — see [LICENSE](LICENSE). You may use, modify and redistribute these plugins, including inside another product, as long as the copyright notice and the permission notice stay with the code.

`file-edit` is a **derivative** of the public original plugin [justarook1e/dsh-file-edit](https://github.com/justarook1e/dsh-file-edit), released under MIT with copyright held by `justarook1e`; as MIT requires, that copyright notice is retained in [LICENSE](LICENSE). Embedded third-party components, versions and copyright lines are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
