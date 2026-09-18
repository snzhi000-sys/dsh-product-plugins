# Harness product plugins

Authoritative source for the DeepSeek Harness product plugins we maintain. The app engineering tree consumes this repository; it does not own the plugin sources.

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
```

`client/dist/client.js` is **tracked** on purpose: the app packaging chain archives the plugin with `npm pack`, whose `files` field ships `host`, `client/dist` and `README.md`, and `package.json` has no `prepare` script. Keeping the built bundle here makes the sync and the package reproducible without a network install. Rebuild it before committing whenever `client/src/` changes — the sync refuses a bundle older than the newest client source.

## How the app consumes this repository

```bash
cd <app-tree>/desktop
npm run sync:plugins        # copy every mapped plugin into the app tree
npm run sync:plugins -- --check   # verify instead of writing; non-zero exit on drift
```

- The app packaging chain runs `sync:plugins` before `prepare:profile`, so `npm run dist:dev` / `dist:stable` always package the sources in this repository.
- The app-tree copy (`<app-tree>/plugins/<plugin>`) is **generated and git-ignored**. Never edit it: change this repository, then sync.
- `DSH_PLUGIN_HOME` overrides where the sync reads from; it defaults to the `plugins` directory beside the app tree.

## Iteration runbook

Every change to a plugin follows this order. The plugin repository is the source of truth; the app-tree copy is materialized from it.

1. **Change the source here**, never in the app tree: `npm run check:plugins` fails on drift and `dist:dev` / `dist:stable` overwrite that copy.
2. **Build and test** in the plugin directory: `npm run build:client && npm test`. Bump `version` in `package.json` whenever a change ships, and mention it in the commit message.
3. **Materialize into the app tree**: `cd "<app-tree>/desktop" && npm run sync:plugins`. Packaging runs this automatically before `prepare:profile`, so this step is only needed when you want the copy present without packaging. `npm run check:plugins` proves byte equality.
4. **Build the Dev package**: `cd "<app-tree>/desktop" && npm run dist:dev`. The channel gate runs desktop tests, `verify:source-privacy`, the profile privacy verification, product identity and an isolated empty-userData launch.
5. **Verify the behavior on the real app**: launch `<app-tree>/desktop/dist/dev/mac-arm64/DeepSeek Harness Dev.app` and exercise the feature in a test workspace. For behavior that must be proven rather than looked at, drive a packaged probe with isolated user data (for example `<app-tree>/desktop/scripts/probe-edit-open-service.mjs`).
6. **Stable only after Dev is accepted**, and only with explicit approval to touch `/Applications`: `npm run dist:stable`, then the user replaces the installed app manually.
7. **Record the change**: commit in this repository with a scoped message. App-side changes (a new mapping in `distribution/profile-manifest.json`, `desktop/**`, `packages/client/ui-explorer/**`) are committed in the app tree instead — those files are not part of this repository, and the app tree does not track plugin sources.
8. **Once a GitHub remote exists**: push this repository for plugin changes and push the app tree separately through its own isolated-candidate flow. This repository stays the working source of truth; the remote mirrors it.

A feature that spans both sides (for example a plugin plus an Explorer change) is two commits in two repositories, each message naming the other side. Neither repository can reproduce such a feature alone.

### What lives where

| Content | Repository |
| --- | --- |
| Plugin `host/`, `client/`, `tests/`, plugin READMEs, built client bundle | this repository |
| `distribution/profile-manifest.json`, `distribution/cordis.patch.yml` | app tree |
| `desktop/**` (product shell, packaging and verification scripts) | app tree |
| `packages/client/ui-explorer/**` (our Explorer, not a plugin) | app tree |
| `plugins/edit-migration-probes/**` (migration probe, not a product plugin) | app tree |

## Adding a plugin

1. Create `<plugin>/` here with `package.json` named `dsh-<plugin>`, `"type": "module"`, and a `files` list that covers what must ship.
2. Add the mapping `"dsh-<plugin>": "plugins/<plugin>"` to the app tree's `distribution/profile-manifest.json`.
3. Build the client bundle, commit, run `npm run sync:plugins` in the app tree, then package.

## Naming and identity

The package is `dsh-file-edit` and stays that way. Three strings beside it are **persisted contracts** and must not be renamed with it:

- `dsh-file-edit-ref` — the reference source name; it is stored in sent messages and reference snapshots, so renaming it stops existing sessions from recognizing their own references.
- `application/x-dsh-file-edit-references+json` — the clipboard MIME for pasting references back.
- `dsh-file-edit` as the sidebar **tab kind** — it is also the `sidebarRightTabs` type id, and the official sidebar stores each session's tab layout in the browser; a rename costs a reopened tab, nothing more.

The package name, the `productPlugins` key in the app tree's `distribution/profile-manifest.json`, and the `id`/`name` in `distribution/cordis.patch.yml` form one group: change them together, and `desktop/scripts/sync-product-plugins.mjs` (which requires the package name to equal the manifest key) will refuse a half-rename. The cross-package service `dshFileEditOpen`, which the runtime Explorer reads, is independent of the package name.

## Rules

- Binary assets cannot be `require`d: inside the plugin factory `require` resolves through the shell's static module table at runtime. Import them at module scope so the bundler inlines them (the tab glyph ships as a generated data-URL module, see `scripts/embed-tab-icon.mjs`).
- Shipped files must not contain absolute paths, personal paths, credentials or session data: the app's profile privacy gate rejects them.
- Every registration goes through `ctx.effect()` / `ctx.on()`; optional Cordis services are read with `ctx.get(name)`.
- Client bundles may `require()` only platform modules the app exposes, such as `@deepseek-ai/dsh-client-ui-primitives`.
- Keep the plugin's `README.md` / `README.zh.md` pair in step with its behavior.

## License

Released under the **MIT License** — see [LICENSE](LICENSE). You may use, modify and redistribute these plugins, including inside another product, as long as the copyright notice and the permission notice stay with the code.

The provenance review that gated this grant is closed: `file-edit`'s lineage is our own local fork (`dsh-file-edit-fork` 1.13.32-local), and every third-party component the client bundle embeds is MIT-licensed. Embedded components, versions and copyright lines: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
