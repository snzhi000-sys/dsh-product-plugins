/**
 * The one stylesheet every pet settings page shares. The partner picker, the conversation pages, the action
 * cards, and the voice form all render into the same shadow root, so the controls are defined once here and
 * the pages only carry class names. Every class is namespaced `pet-` for a recorded reason: the voice page's
 * row used a bare `switch` class, which the visibility control's official `.switch` track (36x20) also
 * matched, so the row label collapsed into a one-character column and overlapped its neighbours
 * (2026-09-19).
 *
 * Geometry and state come from the official primitives rather than from copies of their appearance:
 * Button.module.css (capsule, ghost/primary/outline), Input.module.css plus fields.module.css (32px,
 * 0.5px border-l4, radius 8), Switch.module.css (state keyed off `aria-checked`), Checkbox.module.css
 * (native input with `accent-color`), and PluginManagerPage/Tag/`ui-settings-plugin-inventory` for the page
 * frame, the tab strip, and the two-column card grid. The `--dsw-*` aliases inherit through the shadow
 * boundary, so both themes apply without a copy.
 */
export const PANEL_STYLE = `
:host{display:flex;flex-direction:column;flex:1;min-height:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--dsw-alias-label-primary)}
*{box-sizing:border-box}

/* Page frame: the official plugin manager column, so the shell's floating Explorer toggle never lands on
   the title and every page shares one rhythm. */
.pet-shell{display:flex;flex-direction:column;flex:1;min-height:0}
.pet-page{display:flex;flex-direction:column;align-items:center;gap:24px;flex:1;min-height:0;overflow:auto;padding:28px clamp(24px,4vw,48px) 40px;color:var(--dsw-alias-label-primary)}
.pet-page>*{width:100%;max-width:960px}
.pet-pageHead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.pet-title{margin:0;font-size:20px;font-weight:500;line-height:28px}
.pet-intro{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.pet-pageActions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:14px;padding-top:4px;font-size:13px;color:var(--dsw-alias-label-secondary)}
.pet-status{font-size:12px;line-height:18px;min-height:18px;color:var(--dsw-alias-label-tertiary)}
.pet-visibility{display:flex;align-items:center;gap:10px;white-space:nowrap}

/* Tab strip: the conversation header's underline tabs. */
.pet-tabs{position:relative;z-index:1;display:flex;gap:36px;flex:none;overflow-x:auto;white-space:nowrap;padding:0 0 2px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.pet-tab{position:relative;padding:0 0 9px;border:0;border-radius:0;background:transparent;font:inherit;font-size:13px;line-height:16px;font-weight:500;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.pet-tab:hover{color:var(--dsw-alias-label-secondary)}
.pet-tab::after{content:"";position:absolute;right:0;bottom:-1px;left:0;height:2px;border-radius:2px;background:transparent}
.pet-tab[aria-selected="true"]{color:var(--dsw-alias-state-business-primary)}
.pet-tab[aria-selected="true"]::after{background:var(--dsw-alias-state-business-primary)}
.pet-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}

/* Buttons: the official capsule in its ghost, primary, outline, and compact sizes. */
.pet-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:36px;padding:0 14px;border:0;border-radius:18px;background:transparent;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);cursor:pointer}
.pet-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.pet-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.pet-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pet-btn:disabled{cursor:not-allowed;opacity:.4}
.pet-btnSm{height:28px;padding:0 10px;border-radius:14px;font-size:12px;line-height:18px}
.pet-btnPrimary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.pet-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.pet-btnOutline{border:.5px solid var(--dsw-alias-border-l3)}
.pet-btnOutline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.pet-btnDanger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent);--dsw-alias-interactive-bg-hover:var(--dsw-alias-interactive-bg-hover-danger)}
.pet-btn[aria-pressed="true"]{background:var(--dsw-alias-button-ghost-active-fill);border-color:var(--dsw-alias-button-ghost-active-border)}
.pet-btn[aria-pressed="true"]:hover:not(:disabled){background:var(--dsw-alias-button-ghost-active-hover)}

/* Fields: label above its control, with the form's explanation under it. */
.pet-section{display:flex;flex-direction:column;gap:10px;min-width:0}
.pet-sectionTitle{margin:0;font-size:14px;line-height:22px;font-weight:500}
.pet-field{display:flex;flex-direction:column;gap:6px;padding:12px 0;min-width:0}
.pet-fieldWide{grid-column:1/-1}
.pet-label{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
.pet-hint{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}
.pet-hint+.pet-hint{margin-top:6px}
.pet-hintBlock{display:flex;flex-direction:column;gap:4px;padding:4px 0}
/* Two per row where the official settings do it: the compact settings no longer each claim a full line. */
.pet-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;align-items:start}
.pet-grid>.pet-field{padding:10px 0}

/* Controls: the official input geometry, shared by inputs, textareas, and native selects. */
.pet-input,.pet-textarea,.pet-select{width:100%;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.5}
.pet-input,.pet-select{height:32px;padding:0 10px}
.pet-textarea{padding:8px 10px;min-height:120px;resize:vertical}
/* The two prompt fields are the only long-form settings; the grid keeps everything else compact. */
.pet-textareaPrompt{min-height:150px}
.pet-textareaEmotion{min-height:190px}
.pet-select{cursor:pointer}
.pet-input:focus-visible,.pet-textarea:focus-visible,.pet-select:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.pet-input::placeholder,.pet-textarea::placeholder{color:var(--dsw-alias-label-dimmed)}
.pet-input:disabled,.pet-textarea:disabled,.pet-select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default;opacity:.6}
.pet-input[type="number"]{font-variant-numeric:tabular-nums}
.pet-keyrow{display:flex;align-items:center;gap:8px;min-width:0}
.pet-keyrow .pet-input{flex:1;min-width:0}
.pet-keyrow .pet-btn{flex:none}
.pet-range{width:100%;margin:0;accent-color:var(--dsw-alias-brand-primary)}

/* Switch: the official track, its state read from aria-checked so the picture cannot disagree with the
   state assistive technology sees. */
.pet-switch{position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:10px;background:var(--dsw-alias-border-l3);cursor:pointer}
.pet-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.pet-switch:disabled{cursor:default;opacity:.5}
.pet-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pet-thumb{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);transition:transform 120ms ease}
.pet-switch[aria-checked="true"] .pet-thumb{transform:translateX(16px)}
@media (prefers-reduced-motion:reduce){.pet-thumb{transition:none}}
/* One switch row: the label keeps the free space and the track stays at its own size. */
.pet-switchRow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;min-width:0}
.pet-switchRow>.pet-label{flex:1;min-width:0}

/* Cards: two per row where a page holds many small settings, one per row when a card carries long text. */
.pet-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:12px;align-items:start;margin:0;padding:0}
.pet-card{min-width:0;padding:4px 14px 14px;border-radius:14px;background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-elevation-stroke)}
.pet-cardHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0 2px}
.pet-cardTitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary)}
.pet-cardActions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-top:6px}
.pet-card .pet-field{padding:8px 0}
.pet-card .pet-grid{gap:0 16px}
.pet-card .pet-textarea{min-height:72px}
.pet-conflict{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary)}
.pet-conflict:empty{display:none}

/* Partner picker: character list beside the selected character's settings. */
.pet-body{flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;overflow:hidden}
.pet-library{min-height:0;display:flex;flex-direction:column;padding:16px 12px 0;background:var(--dsw-alias-bg-module-platform);border-right:1px solid var(--dsw-alias-border-l1)}
.pet-libraryLabel{margin:0 6px 10px;font-size:13px;line-height:20px;font-weight:600}
.pet-libraryCount{margin:10px 6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.pet-models{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding:0 2px 16px}
.pet-character{display:flex;align-items:center;gap:12px;width:100%;min-height:76px;margin-bottom:6px;padding:8px;border:.5px solid transparent;border-radius:12px;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer}
.pet-character:hover{background:var(--dsw-alias-interactive-bg-hover)}
.pet-character:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pet-character:disabled{cursor:default;opacity:.6}
.pet-character[aria-pressed="true"]{border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent)}
.pet-character>img{flex:none;width:48px;height:64px;object-fit:contain;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.pet-characterText{flex:1;min-width:0}
.pet-characterName{display:block;font-size:14px;line-height:20px;overflow-wrap:anywhere}
.pet-characterMeta{display:block;margin-top:4px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.pet-selectionMark{flex:none;color:var(--dsw-alias-state-business-primary);font-weight:700}
.pet-empty{display:block;padding:16px 8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}

.pet-detail{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:auto;padding:16px 22px 24px}
.pet-portrait{position:relative;flex:1;min-height:150px;border-radius:16px;overflow:hidden;background:radial-gradient(ellipse at 50% 80%,color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent) 0,transparent 65%),var(--dsw-alias-bg-layer-2)}
.pet-portrait::after{content:"";position:absolute;bottom:12px;left:35%;right:35%;height:7px;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);filter:blur(5px);pointer-events:none}
.pet-preview{position:absolute;inset:0;display:block;width:100%;height:100%;border:0}
.pet-characterTitle{margin:14px 0 2px;font-size:18px;line-height:26px;font-weight:500}
.pet-characterSubtitle{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.pet-outfit{display:flex;align-items:center;gap:8px;padding:8px 0 0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.pet-outfit .pet-select{flex:1;min-width:0}
.pet-sizeValue{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.pet-sizeLabel{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}
.pet-detailGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}
.pet-detailGrid .pet-field{padding:10px 0}
.pet-hintLine{margin:10px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}

/* Action debug: a disclosure under the character's controls. */
.pet-debug{margin-top:12px;border-top:.5px solid var(--dsw-alias-border-l2)}
.pet-debug>summary{padding:10px 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.pet-debug>summary:hover{color:var(--dsw-alias-label-primary)}
.pet-debugGroup{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 10px}
.pet-debugGroup>strong{width:100%;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-tertiary)}

/* Action presets: the character's portrait stays in view while the cards scroll beside it. */
.pet-actions{display:flex;flex-direction:column;gap:12px;min-width:0}
.pet-actionsHelp{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}
.pet-actionsToolbar{display:flex;align-items:flex-end;gap:12px}
.pet-actionsToolbar .pet-field{flex:1;padding:0}
.pet-actionsPane{display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px;align-items:start;min-height:0}
.pet-actionsPortrait{position:sticky;top:0;width:230px;height:390px;border:0;border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
.pet-actionsHeading{position:sticky;top:0;z-index:1;margin:8px 0 0;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);font-size:14px;line-height:20px;font-weight:500}
.pet-weight{display:flex;align-items:center;gap:10px;min-width:0}
.pet-weight .pet-range{flex:1;min-width:0}
.pet-weight .pet-input{flex:none;width:84px;text-align:right}
.pet-weight .pet-btn{flex:none}

/* Voice and conversation pages scroll on their own once the body grid is hidden. */
.pet-voice{display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto}
.pet-emotionText{min-height:52px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-elevation-stroke);font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.pet-pageBody{display:flex;flex-direction:column;flex:1;min-height:0}
/* The panel swaps its body between the picker, the settings pages, and the chat frame. Every one of them
   carries a display rule, which would otherwise beat the user agent's own [hidden] rule. */
.pet-pageBody [hidden]{display:none}
.pet-history{display:block;flex:1;min-height:0;width:100%;border:0}

@media (max-width:900px){
.pet-grid,.pet-detailGrid,.pet-cards{grid-template-columns:minmax(0,1fr)}
.pet-body{grid-template-columns:42% minmax(0,1fr)}
.pet-actionsPane{grid-template-columns:minmax(0,1fr)}
.pet-actionsPortrait{display:none}
.pet-library{padding:12px 6px 0}
.pet-detail{padding:12px}
.pet-character{gap:8px;padding:6px}
.pet-character>img{width:34px;height:50px}
.pet-selectionMark{display:none}
}
`
