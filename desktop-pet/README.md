# Desktop companion

English | [中文](README.zh.md)

A companion plugin that lives in a transparent desktop window: a built-in character library and selector, characters that follow the pointer, open their mouth while they speak and read text aloud, with their own conversation and emotions.

## Revision history

| Date | Change | Author | Note |
| --- | --- | --- | --- |
| 2026-10-26 | Changed: the page is regrouped into usage, read-out, conversation, voice and mouth, assets, drivers and verification, with each section broken into paragraphs | snzhi000-sys | Version `0.1.4` |

---

## Summary

**One plugin, three jobs**: the character library and portrait rendering, pointer following and mouth shapes, and read-out plus voice conversation. All three share one character configuration and one audio queue.

**Core capabilities**:

- **Character library**: 19 companions and 23 outfits built in, covering 22 Live2D model versions and the DragonBones-driven Mengmei, each character driving its own animations;
- **Following and interaction**: the gaze and the body follow the pointer together, with head pats, dragging and action previews;
- **Read-out**: every reply can be read, a selection can be read, and the main conversation can be broadcast, with the mouth following the audio;
- **Its own conversation**: the pet keeps its own model configuration, emotion and intimacy, apart from the Harness main conversation.

**Asset source**: the flagship character Mengmei is built on material provided by **苍月动漫**; we built the Live2D / DragonBones drive, pointer following, mouth and speech chain on top of it, and the character and its models remain entirely their owner's. The other Live2D models come from a third-party collection, recorded in `assets/NOTICE.txt`; **the model files ship with this plugin and this repository**, outside this repository's MIT license.

---

## Usage

### Opening and switching characters

Open the **桌宠** panel in the left sidebar, browse the scrollable character list or search by name, and click a row to switch and save immediately. Mengmei is listed first and selected by default.

Different outfits of the same character collapse into one entry, such as Mori's four and Toyama Kasumi's two, and switch inside the character's detail; a saved character that was removed falls back to Mengmei.

### Display settings

**Every change saves immediately, so there is no save button**:

- **Character size**: while dragging the slider, saves are coalesced;
- **Enable animation**: turning it off resets the character and holds still;
- **Always on top**;
- **Show companion**: turning it on restores the pet window, turning it off releases the native render window.

The panel entry sits beside 插件 and replaces the conversation area while open, so no dialog has to be closed; switching the sidebar back to the workspace or to 插件 releases the preview.

### Interaction

**Left click interacts, right click opens the menu**: pat the head, click the body or drag the character, and the motion, expression, gaze and physics depend on the model itself.

With 动作调试 expanded in the settings, holding an action or expression button previews it on both the portrait and the visible pet; releasing, cancelling, losing focus, switching tabs or closing the settings restores normal animation. A visible pet with animation enabled performs a random available body action after 60 seconds idle, avoiding immediate repeats; clicking, the menu, dragging, pausing or hiding interrupts it. The portrait never performs automatic actions.

---

## Reading text aloud

### The read-out button under every reply

**It sits in the official assistant action strip, beside copy and share**. At rest it is a speaker icon, and pressing it reads that reply in the pet's voice.

While reading, the button turns into a moving waveform, and pressing it again **stops all reading** — this reply, other replies, the selection being read and the main conversation broadcast together. The button describes the pet's voice rather than its own request, so it stays pressable whenever a voice is playing, and stop always outranks start.

It can read replies from before this run; **reading does not require the pet to be on screen**: the visible pet plays and drives its mouth, the Harness window plays while it is hidden, and hiding never interrupts a clip.

### Reading a selection aloud

**Select text in the conversation panel** and a 朗读 pill floats above the selection; clicking it speaks the passage with the pet's voice and queue.

- **Only words a person would say**: code blocks, tables and Markdown decorations are left out, and an unclosed code block is never read;
- **Never written anywhere else**: the passage does not enter the pet bubble, the session log or a model request;
- **Too long is not offered**: a selection above 5000 characters is not offered at all;
- **Beside the reference action**: in the file browser, the read-out action is delivered into the @引用 bubble, so the two buttons sit side by side;
- **Missing pieces are named**: without a TTS key or a window that can play, the pill states the reason.

### Broadcasting the main conversation

**Off by default, the switch sits in the conversation header's right side**: the speaker icon tells 声音开启 from 声音关闭, and the companion page does not repeat it.

- **Only the prose addressed to you**: the main conversation's assistant text is read, while reasoning, tool calls, compaction and title generation are excluded; code blocks, tables, Markdown decorations and links are left out;
- **Never written into the pet bubble**: the bubble belongs to the pet's own conversation, and sharing it would bring back captions you turned off;
- **The switch is also the stop switch**: turning it off ends the sentence being read, and while the pet window is hidden this switch is the only control on screen;
- **Subagents are silent**: their text is not broadcast, so the main thread stays audible;
- **It needs TTS**: it uses the pet's own voice and key, independent of the private chat's automatic read-out.

---

## Conversation

### Private chat and recording

Open 聊天 from the pet menu and a text input appears below the character; 关闭聊天 only hides the input and keeps the record. It shares the latest conversation and a bounded context with settings → 聊天记录.

- **Sending**: Enter sends, Shift+Enter breaks the line, and IME composition never sends;
- **Every press gets an answer**: the button is never disabled; it shows 发送中… immediately, checks with the host when it believes the pet is busy and writes the reason into the bubble, and a send has a 30-second cap;
- **Recording**: a recording can be edited before sending, and starting capture stops any read-out; only the embedded chat page may request the microphone;
- **One configuration per reply**: a reply keeps the configuration it started with, and changes apply to the next one.

### Emotion

**Emotion is five ordered plain-text fields written in the first person**: current mood, attitude direction, inner stirring, tone colour and emotional baseline.

- **Prompt discipline**: topic steering, conditional reply instructions and invented persona facts are ruled out;
- **Shares the pet model**: the first round analyses the user's message before replying, and afterwards each completed reply analyses the last eight messages of both sides, with `emotionHistoryMessages` configurable from 1 to 100;
- **Failures keep the previous emotion**: a missing, duplicated, out-of-order or non-first-person field fails the update instead of overwriting;
- **Injections**: `{{情绪模拟}}`, `{{聊天记录}}` and `{{亲密情况}}` expand where they appear in the prompt.

### Prompt management

Conversation and emotion prompts are edited separately. A custom prompt without variables stays as written, and a prompt identical to the old default upgrades automatically. Emotion text and its request stay independent of chat messages and TTS; a new conversation clears the emotion, and reopening restores it.

### Intimacy

`intimacyLevels` edits any number of levels with a name, start score, end score and description, arranged continuously from 0 with no overlap or gap.

Each completed non-empty user/AI round adds one point, counted once; interruptions, failures, connection tests and emotion requests do not count. Reopening keeps the score, and a new conversation resets it while keeping the level settings.

---

## Voice and mouth

### Voice configuration

The 对话 and 声音 pages configure the pet's own Ark endpoint, model and separate model / TTS / ASR keys, **without inheriting Harness model settings**.

- **Voice**: read-out needs a TTS key and a voice ID, and existing cloned speaker IDs are supported, with no voice training;
- **Save and preview**: the form is saved before synthesis starts;
- **Key semantics**: an empty field keeps the current value, clearing it and saving deletes it, and GET only reports whether one is configured;
- **Streaming synthesis**: only the next two or three sentences are synthesised as the player consumes, so a long reply never overruns the buffer.

### Mouth drivers

**Live2D and DragonBones each have their own driver**:

- **Live2D**: the timeline drives `ParamMouthOpenY` / `PARAM_MOUTH_OPEN_Y` with the mouth-recipe weights from the settings;
- **DragonBones**: four hand-made a/o/i/m shapes matched by pinyin, with Mengmei's `i` narrowed into the `a` shape so it stays visible;
- **Silence closes**: the mouth closes on silence and releases when a clip ends;
- **Approximate shapes**: neither driver claims phoneme-level alignment.

### Only words a person would say

**The text is turned into its reading first, then the vowels decide the shape**: Arabic digits read as Chinese numerals, Latin letters by letter name and common symbols by their reading, while quotation marks, brackets, commas and full stops are only pauses. Digits read one by one, and separators inside them follow the reading.

**Untrustworthy subtitle timings are reflowed**: the speech service returns a flat 30 ms span for any segment containing digits or symbols, and trusting it squeezes a whole reading into 30 ms and leaves long closed-mouth stretches. The plugin reflows the timeline against the audio's own voiced segments, so the mouth closes only where the audio really pauses, while a segment whose audio and payload agree keeps the provider's original timing.

---

## Data and privacy

- **Location**: appearance settings, conversation, credential index and recording records live under `DSH_HOME/state/dsh-desktop-pet`;
- **Keys**: stored as a private file with 0600 permissions, not encrypted;
- **Not shipped**: these files and the request records stay out of the release package;
- **Local access**: host routes are limited to same-origin local requests and refuse path escapes and symlink escapes.

---

## Assets and the character library

`assets/catalog.json` manages the stable identifiers, names, relative entries and preset interaction configuration, and the host reads models and the Core straight from the plugin package; users never import directories, pick a driver, bind actions or fill in paths.

**Adding a character happens at development time**: `scripts/prepare-builtin-assets.mjs` copies model dependencies and approved animation profiles and leaves user settings, credentials, library indexes and absolute-path provenance files out; extra resources are pinned by `scripts/additional-models.json` with dependency hashes, and `scripts/verify-additional-models.mjs` plays every declared action through the real driver before they land.

---

## Drivers and builds

### DragonBones

Mengmei is prepared by `node scripts/prepare-dragonbones.mjs <source-export-dir>` from three source files: physics constraints gain a name prefix, bone and IK timeline names are kept, the exported mouth-open start action is cleared, and the official driver is downloaded at a pinned version with its provenance hash recorded.

**Pinned renderer**: the DragonBonesJS 6.0.2 branch at commit `7b2d9f700d1719db2c5d89a6fa36c85d7f092501` with PixiJS 8.9.2; the runtime's master branch refuses this 6.0 asset.

**Following and recentring**: the body follows the pointer through an additive offset on the `zhuan` bone, keeping the `zhuanshen` body and head constraint chain; movement stays inside an ellipse of radius 350 horizontally and 300 vertically in skeleton units, with sensitivity 2, eye offset 18 and 0.18 s smoothing; dragging, previewing an action, speaking or focusing the compact input recentres it.

### Live2D

Cubism 3/4 enables `setOpacityFromMotion` and orders motion curves as Model → Parameter → PartOpacity. Switching motions or returning to idle clears the old queue and restores parameters and part opacity, so spare arm parts never linger.

### Spine

The sources include an independent official Spine WebGL 4.2 driver and descriptor dispatch, and `node scripts/prepare-spine-runtime.mjs [official-package.tgz]` prepares a runtime with pinned checksums. The vendor-provided Spine Mengmei still has texture-assembly problems and is not part of the built-in list.

---

## Verification

From the plugin directory:

```bash
npm run build
npm test
npm run test:browser     # real host, built client, empty data directory
npm run test:electron    # transparent hit-testing, dragging, restart restore, hide/show, unload
```

The packaging chain builds with `npm run dist:dev` / `npm run dist:stable` from the unified project root, and `scripts/product-v2-smoke.mjs` checks the final package with empty user data: executable hash, built-in assets, character switching, real animation and cleanup.

---

## Known limitations

- Mouth shapes are approximate and claim no phoneme-level alignment; the emotion validator checks format, not semantic quality;
- Voices are limited to existing cloned speaker IDs, with no voice training;
- The vendor-provided Spine Mengmei asset is still being reworked and is not in the built-in library;
- Action and expression previews require animation to be enabled and saved; the portrait never performs automatic actions;
- The microphone permission is granted only to the embedded chat page, and physical-microphone capture and voice quality still need human acceptance.
