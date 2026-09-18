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

## Adding a plugin

1. Create `<plugin>/` here with `package.json` named `dsh-<plugin>`, `"type": "module"`, and a `files` list that covers what must ship.
2. Add the mapping `"dsh-<plugin>": "plugins/<plugin>"` to the app tree's `distribution/profile-manifest.json`.
3. Build the client bundle, commit, run `npm run sync:plugins` in the app tree, then package.

## Rules

- Shipped files must not contain absolute paths, personal paths, credentials or session data: the app's profile privacy gate rejects them.
- Every registration goes through `ctx.effect()` / `ctx.on()`; optional Cordis services are read with `ctx.get(name)`.
- Client bundles may `require()` only platform modules the app exposes, such as `@deepseek-ai/dsh-client-ui-primitives`.
- Keep the plugin's `README.md` / `README.zh.md` pair in step with its behavior.

## Licensing status

The plugins' third-party provenance and license clearance is **not closed** yet, so no license file is granted here and nothing may be published until that review is recorded. Until then this repository is local-only.
