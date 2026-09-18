# Harness product plugins

English | [中文](README.zh.md)

![dsh-file-edit cover](docs/images/cover.png)

Product plugins for DeepSeek Harness. The repository currently ships one plugin, **dsh-file-edit**: it combines the workspace Explorer, the file browser and agent-change review, so every file change inside Harness is visible and can be settled where it happened.

## Revision history

| Date | Change | Author | Note | Link |
| --- | --- | --- | --- | --- |
| 2026-09-18 | First release of this page as a product introduction: feature demos, origin and credits, cover; maintenance rules moved to Maintaining and iterating | snzhi000-sys | Version `1.13.44-local` | — |

---

## Summary

To make file changes inside a Harness session **visible, editable and referenceable**, the plugin builds one file workspace per session.

**Core capabilities**:

- **Changes stay visible**: every file change in a session enters the review list, grouped by session and workspace, and can be accepted or rejected one by one;
- **Editing stays in place**: files open, edit and save back without leaving Harness, and Markdown renders in place;
- **References stay exact**: files and selections can be referenced into the conversation, so the model always knows what it is answering about;
- **Surfaces stay quiet**: rarely used files hide on demand, and important ones can be marked and located quickly.

---

## Features

### 1. Agent-change review

**Every file change in the session lands in one actionable list**: writes, edits, deletions and moves from the agent all appear under "modified files".

![Modified files list](docs/images/review-list.webp)

- **Per-row decisions**: accept or reject each change, or settle the whole batch, with one level of undo after a rejection;
- **Line-level comparison**: each row reports added and removed line counts and expands to a line-level diff without leaving the session;
- **Deletion is quarantined**: a deletion moves the content into a persistent quarantine first, and a failed verification refuses the deletion; a rejection restores from quarantine, large files included;
- **Deletion leaves a tombstone**: a file created and then deleted in the same session shows as "created then deleted", instead of vanishing as a net-zero change;
- **Directories aggregate**: a full directory deletion becomes one row that expands to its files and can be accepted or restored as a batch;
- **Ownership is explicit**: subagent changes are attributed along the parent session, while ordinary child sessions keep their own ledger;
- **Uncaptured work is named**: changes the plugin cannot observe, such as writes from a background Shell or an unmanaged compatible shell, are listed by name on an "uncaptured" row that persists with the session;
- **Snapshot-first restore**: after a restart the persisted ledger appears first and the disk is reconciled afterwards.

### 2. Explorer

**A workspace file tree takes over the file entry point**: directories expand per workspace and open for reading or editing in place of the native sidebar.

![Explorer and on-demand hiding](docs/images/explorer-hide.webp)

- **Hide on demand**: files and directories you do not care about hide with one click, leaving the working set in view;
- **Preferences persist**: hiding, expansion and ordering are stored per workspace, so reopening Harness does not mean reorganising;
- **Official visuals**: file and folder glyphs come from the official Harness icon components, matching the kernel's own interface;
- **Labelled tabs**: sidebar tabs carry their own glyph and name, so parallel workspaces never blur together;
- **Boundaries**: dependency and cache directories such as `.git` and `node_modules` are skipped, and the tree stops at 8000 entries or 16 levels.

### 3. File browser

**Reading and editing happen inside the sidebar**: files open in multiple tabs with syntax highlighting and whole-document editing, and saving writes back to the workspace.

- **Multiple tabs**: files open side by side, switch, close and reorder by drag, and tab state survives restarts;
- **Batch closing**: the more menu closes all files or only the settled ones, and a failed review refresh closes nothing;
- **Syntax highlighting** for 24 languages plus Markdown;
- **Whole-document editing**: edits made by the user fold into the baseline instead of disturbing the agent's pending changes;
- **Size boundaries**: files above 512 KB or 8000 lines become read-only large files, and binaries above 4 MB keep only reject and restore;
- **Change targeting**: opening a file from the review list jumps to its first change and highlights it.

### 4. File references

**Files and selections travel into the conversation**: reference a file with `@` in the composer, or select text in a document and reference it directly.

![Reference chip](docs/images/reference-chip.webp)

![Selection reference bubble](docs/images/reference-bubble.webp)

- **References carry a location**: the chip shows the path and the line range, so the model's target is exact;
- **Selection references**: selecting text in a file or review view floats a bubble above the selection, and one click inserts the reference;
- **Two paths, one vocabulary**: the diff view and code browsing use the official `@path` reference with the line range only in the chip label, while the rendered view writes the range into the text and never sends the selected text itself;
- **Consistent with the official behaviour**: both paths declare the official appearance and behave like every other reference in the composer.

### 5. The whole surface

![Overall interface](docs/images/app-overview.webp)

- **Three surfaces, one plugin**: the Explorer, the file browser and change review share the session state, so switching never loses context;
- **The existing layout survives**: with no browsable document the browser tab closes itself, leaving conversation, transcript and the rest of the session untouched.

### 6. Behaviour and boundaries

- **Review baselines**: accepting a whole file makes the current content the new baseline; accepting a hunk settles only that hunk; rejecting a hunk restores it to the baseline, and the remaining diff is recomputed after every partial action;
- **Permission ownership**: sandboxing, approval and permissions belong to the kernel; the plugin only records changes and never vetoes a tool at its entry point;
- **Shell recording**: foreground Shell commands in a writable workspace are captured by a pre-execution snapshot plus recursive watching, and a failed snapshot never blocks the command while the session keeps an explicit partial-coverage conclusion;
- **Unknown pre-modification content**: when `write` overwrites a file and the tool returns no prior content, the row says so and offers accept or manual handling only.

---

## Origin and credits

**This plugin is a derivative of the original `dsh-file-edit` plugin**, reworked with extensive optimisation and many added features. Thanks to the original author for the foundation.

- Original project: [justarook1e/dsh-file-edit](https://github.com/justarook1e/dsh-file-edit), released under MIT with copyright held by `justarook1e`; that repository is no longer maintained and has moved to [justarook1e/dsh-ide-lite](https://github.com/justarook1e/dsh-ide-lite).
- **Inherited**: workspace file browsing and editing, accept/reject of agent changes, rejection undo, deletion quarantine, and the runtime state-directory and route conventions.
- **Added or reworked here**: review listing attributed by session and workspace, subagent change attribution, directory deletion batches, named disclosure of uncaptured changes, deletion tombstones, official glyphs and labelled tabs, on-demand hiding with persisted preferences, line-level references from the rendered view, change targeting with line-accurate highlight, and the review bar's width and ink aligned with the official composer card.
- **License obligation**: as MIT requires, [LICENSE](LICENSE) keeps the original author's copyright notice; embedded third-party components are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

---

## Install and enable

The plugin is assembled by the Harness product profile and ships with the runtime; it needs no separate install script.

- **Product manifest**: the app tree's `distribution/profile-manifest.json` points `dsh-file-edit` at `plugins/file-edit`;
- **Session assembly**: the app tree's `distribution/cordis.patch.yml` inserts the `dsh-file-edit` entry;
- **Sync**: the app tree takes the plugin sources from this repository with `npm run sync:plugins`, which the packaging chain runs automatically.

## Repository layout

```
file-edit/              plugin sources and its own README pair
docs/                   cover source and feature screenshots
scripts/                generator and verifier for the third-party notices
MAINTAINING.md / .zh.md maintenance rules: layout, build, sync, release flow, naming contracts
LICENSE                 license
THIRD-PARTY-NOTICES.md  embedded third-party components and the derivative-work note
```

## Maintaining and iterating

Plugin sources are maintained only in this repository; the app-tree copy is generated by the sync. Directory conventions, build and test commands, the sync and packaging flow, the persisted naming contracts and the steps for adding a plugin live in **[MAINTAINING.md](MAINTAINING.md)**.

## License

Released under the **MIT License** — see [LICENSE](LICENSE). You may use, modify and redistribute these plugins, including inside another product, as long as the copyright notice and the permission notice stay with the code. Embedded third-party components: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
