globalThis.__ModuleLoader__.load({id:"dsh-desktop-pet",factory:function(require){var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.mjs
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  name: () => name
});
module.exports = __toCommonJS(client_exports);

// src/model-manager.mjs
function mountModelManager(container, { wardrobe, api, selected, select, status }) {
  container.innerHTML = '<label class="search-label" for="model-search">\u9009\u62E9\u4F19\u4F34</label><input id="model-search" type="search" aria-label="\u641C\u7D22\u89D2\u8272" placeholder="\u641C\u7D22\u89D2\u8272\u540D\u79F0"><p id="library-count"></p><div id="models" role="group" aria-label="\u5185\u7F6E\u89D2\u8272\u5217\u8868"></div>';
  const find = (id) => container.querySelector(`#${id}`);
  let models = [], active = false, disposed = false, switching = false, revision = 0;
  const remembered = /* @__PURE__ */ new Map();
  const choose = async (model) => {
    if (!active || disposed || switching || selected() === model.id) return;
    switching = true;
    render();
    try {
      await select(model);
      remembered.set(model.characterId, model.id);
      if (!disposed && active) status(`\u5DF2\u5207\u6362\u4E3A ${model.name}`);
    } catch (error) {
      if (!disposed) status(error.message);
    } finally {
      switching = false;
      if (!disposed) render();
    }
  };
  const render = () => {
    const scrollTop = find("models").scrollTop;
    const query = find("model-search").value.trim().toLowerCase();
    const groups = /* @__PURE__ */ new Map();
    for (const model of models) {
      if (!groups.has(model.characterId)) groups.set(model.characterId, []);
      groups.get(model.characterId).push(model);
    }
    const filtered = [...groups.values()].filter((variants2) => variants2.some((model) => `${model.name} ${model.subtitle} ${model.characterName} ${model.outfitName}`.toLowerCase().includes(query)));
    find("library-count").textContent = query ? `\u627E\u5230 ${filtered.length} / ${groups.size} \u4F4D\u4F19\u4F34` : `${groups.size} \u4F4D\u4F19\u4F34 \xB7 ${models.length} \u5957\u9020\u578B`;
    find("models").replaceChildren();
    for (const variants2 of filtered) {
      const model = variants2.find((m) => m.id === selected()) ?? variants2.find((m) => m.id === remembered.get(m.characterId)) ?? variants2[0];
      const button = document.createElement("button");
      button.className = "character-row";
      button.dataset.modelId = model.id;
      button.setAttribute("aria-pressed", String(selected() === model.id));
      button.disabled = switching;
      const image = document.createElement("img");
      image.src = model.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      const text = document.createElement("span"), name2 = document.createElement("strong"), detail = document.createElement("small");
      name2.textContent = model.characterName;
      detail.textContent = model.subtitle + (variants2.length > 1 ? ` \xB7 ${variants2.length} \u5957\u670D\u88C5` : "");
      text.append(name2, detail);
      const marker = document.createElement("span");
      marker.className = "selection-mark";
      marker.textContent = selected() === model.id ? "\u2713" : "";
      button.append(image, text, marker);
      button.onclick = () => choose(model);
      find("models").append(button);
    }
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "\u6CA1\u6709\u627E\u5230\u8FD9\u4E2A\u89D2\u8272\uFF0C\u8BD5\u8BD5\u5176\u4ED6\u540D\u5B57\u3002";
      find("models").append(empty);
    }
    find("models").scrollTop = scrollTop;
    wardrobe.replaceChildren();
    const current = models.find((model) => model.id === selected()), variants = groups.get(current?.characterId) ?? [];
    if (variants.length > 1) {
      const label = document.createElement("label");
      label.textContent = "\u670D\u88C5 ";
      label.htmlFor = "pet-outfit";
      const picker = document.createElement("select");
      picker.id = "pet-outfit";
      picker.disabled = switching;
      picker.style.cssText = "font:inherit;padding:6px;margin:0 0 12px;border:1px solid #e0e4ec;border-radius:8px;max-width:100%";
      for (const model of variants) {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = model.outfitName;
        picker.append(option);
      }
      picker.value = current.id;
      picker.onchange = () => choose(variants.find((model) => model.id === picker.value));
      wardrobe.append(label, picker);
    }
  };
  find("model-search").oninput = render;
  return {
    async refresh() {
      const token = ++revision;
      const value = await api("models");
      if (disposed || !active || token !== revision) return;
      models = value;
      render();
      return models.find((model) => model.id === selected());
    },
    resume() {
      active = true;
      find("model-search").value = "";
    },
    suspend() {
      active = false;
      ++revision;
    },
    dispose() {
      disposed = true;
      active = false;
      ++revision;
      container.replaceChildren();
      wardrobe.replaceChildren();
    }
  };
}

// src/conversation-api.mjs
async function conversationApi(path = "", body, options = {}) {
  const response = await fetch(`/desktop-pet/api/conversation${path}`, { ...options, method: body === void 0 ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === void 0 ? void 0 : JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "\u684C\u5BA0\u8BF7\u6C42\u5931\u8D25");
  return value;
}

// src/action-presets.mjs
var defaultMouthRecipes = Object.freeze([
  { phoneme: "a", base: "a", weight: 1 },
  { phoneme: "o", base: "o", weight: 1 },
  { phoneme: "i", base: "i", weight: 1 },
  { phoneme: "m", base: "m", weight: 1 },
  { phoneme: "e", base: "i", weight: 0.55 },
  { phoneme: "w", base: "o", weight: 0.45 },
  { phoneme: "y", base: "i", weight: 0.7 }
]);
var mouthPhonemes = ["a", "o", "i", "m", "e", "w", "y", "u", "\xFC", "v"];

// src/action-preset-settings.mjs
function mountActionPresetSettings(root, status) {
  root.innerHTML = '<style>.pet-actions{height:100%;min-height:0;display:flex;flex-direction:column;gap:10px}.pet-actions-help{margin:0;color:#6f7888;font-size:12px;line-height:1.55}.pet-actions-toolbar{display:flex;align-items:center;gap:10px;flex:none}.pet-actions-toolbar label{display:flex;align-items:center;gap:8px;margin:0;flex:1}.pet-actions-toolbar select{min-width:220px}.pet-actions-list{min-height:0;overflow:auto;padding-right:8px;scrollbar-gutter:stable}.pet-actions-list fieldset{background:#fbfcfe;box-shadow:0 1px 3px #1720330d}.pet-actions-list fieldset:hover{border-color:#b9c8e5!important}.pet-actions-list textarea{width:100%;resize:vertical}.pet-actions-list h3{position:sticky;top:0;background:#fff;z-index:1;padding:8px 0;margin:16px 0 4px;border-bottom:1px solid #edf0f4}</style><div class="pet-actions"><p class="pet-actions-help">\u540C\u4E00\u52A8\u4F5C\u53EF\u4FDD\u5B58\u591A\u4E2A\u6743\u91CD\u9884\u8BBE\u3002\u5173\u952E\u8BCD\u53EA\u5339\u914D\u62EC\u53F7\u5185\u6587\u5B57\uFF0C\u6700\u957F\u4F18\u5148\uFF0C\u7B49\u957F\u6309\u5217\u8868\u987A\u5E8F\u3002\u62D6\u52A8\u6ED1\u5757\u5B9E\u65F6\u9884\u89C8\uFF0C\u677E\u5F00\u6062\u590D\uFF1B\u4FEE\u6539\u4F1A\u4FDD\u7559\u5230\u8BBE\u7F6E\u9875\u5E95\u90E8\u4FDD\u5B58\u3002</p><div class="pet-actions-toolbar"><label>\u89D2\u8272\u4E0E\u670D\u88C5<select data-action-character></select></label></div><div class="pet-actions-list" data-action-keywords></div></div>';
  const select = root.querySelector("select"), list = root.querySelector("[data-action-keywords]"), channel = new BroadcastChannel("dsh-pet-action-debug");
  const layout = document.createElement("div");
  layout.style.cssText = "display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px;align-items:stretch;min-height:0;flex:1";
  const portrait = document.createElement("iframe");
  portrait.title = "\u52A8\u4F5C\u7ACB\u7ED8\u9884\u89C8";
  portrait.src = "about:blank";
  portrait.style.cssText = "width:230px;height:390px;border:0;position:sticky;top:0;background:#faf8f3;border-radius:12px;box-shadow:0 2px 10px #17203312";
  list.before(layout);
  layout.append(portrait, list);
  let draft = {}, recipes = {}, revision = 0, disposed = false, held, timer, animated = false, visible = false;
  const json = async (path) => {
    const r = await fetch("/desktop-pet/api/" + path), value = await r.json();
    if (!r.ok) throw Error(value.error);
    return value;
  };
  const stop = () => {
    clearInterval(timer);
    if (held) channel.postMessage({ ...held, kind: "release" });
    held = null;
  };
  const send = () => {
    if (held) channel.postMessage({ ...held, kind: "hold" });
  };
  const begin = (selection) => {
    stop();
    if (!animated) {
      status("\u8BF7\u5148\u5F00\u542F\u5E76\u4FDD\u5B58\u52A8\u753B\u8BBE\u7F6E\uFF0C\u518D\u9884\u89C8\u3002");
      return;
    }
    held = { modelId: select.value, token: crypto.randomUUID(), selection };
    send();
    timer = setInterval(send, 250);
  };
  const visibility = () => {
    if (document.hidden) stop();
  };
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", visibility);
  const button = (text, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.onclick = fn;
    return b;
  };
  const label = (text, input2) => {
    const el = document.createElement("label");
    el.append(document.createTextNode(text), input2);
    return el;
  };
  const fieldset = () => {
    const row = document.createElement("fieldset");
    row.style.cssText = "margin:12px 0;padding:14px;border:1px solid #dfe3ea;border-radius:10px";
    return row;
  };
  const input = (value, change) => {
    const el = document.createElement("input");
    el.value = value;
    el.oninput = () => change(el.value);
    return el;
  };
  const options = (items, value, change) => {
    const el = document.createElement("select");
    for (const [id, text] of items) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = text;
      el.append(o);
    }
    el.value = value;
    el.onchange = () => {
      stop();
      change(el.value);
    };
    return el;
  };
  const previewControls = (row, model, selection, weight, update) => {
    const slider = document.createElement("input"), number = document.createElement("input");
    slider.type = "range";
    number.type = "number";
    for (const el of [slider, number]) {
      el.min = "0";
      el.max = "100";
      el.step = "1";
      el.value = String(Math.round(weight * 100));
      el.disabled = model.kind !== "dragonbones";
      el.onblur = stop;
    }
    slider.dataset.weight = "";
    number.dataset.weightNumber = "";
    slider.setAttribute("aria-label", "\u52A8\u4F5C\u6743\u91CD");
    number.setAttribute("aria-label", "\u6743\u91CD\u767E\u5206\u6BD4");
    const value = () => Number(slider.value) / 100;
    const change = (source, target) => {
      const n = Number(source.value);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        status("\u6743\u91CD\u987B\u4E3A 0\u2013100%\u3002");
        return;
      }
      target.value = source.value;
      update(n / 100);
      if (!held) begin({ ...selection(), weight: n / 100 });
      else {
        held.selection.weight = n / 100;
        send();
      }
    };
    slider.oninput = () => change(slider, number);
    number.oninput = () => change(number, slider);
    slider.onpointerdown = (e) => {
      if (e.button === 0) {
        slider.setPointerCapture(e.pointerId);
        begin({ ...selection(), weight: value() });
      }
    };
    slider.onpointerup = slider.onpointercancel = slider.onlostpointercapture = slider.onkeyup = stop;
    const preview = button("\u6309\u4F4F\u9884\u89C8", null);
    preview.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      preview.setPointerCapture(e.pointerId);
      begin({ ...selection(), weight: value() });
    };
    preview.onpointerup = preview.onpointercancel = preview.onlostpointercapture = preview.onblur = preview.onkeyup = stop;
    preview.onkeydown = (e) => {
      if ([" ", "Enter"].includes(e.key)) {
        e.preventDefault();
        if (!e.repeat) begin({ ...selection(), weight: value() });
      }
    };
    row.append(label(model.kind === "dragonbones" ? "\u52A8\u4F5C\u6743\u91CD %" : "\u5F53\u524D\u5F15\u64CE\u4FDD\u7559\u5B8C\u6574\u52A8\u4F5C\uFF08100%\uFF09", slider), number, preview);
  };
  const render = async () => {
    stop();
    const token = ++revision, id = select.value;
    list.replaceChildren();
    try {
      const model = await json("model?id=" + encodeURIComponent(id));
      if (disposed || token !== revision) return;
      const src = "/desktop-pet/view?preview=1&model=" + encodeURIComponent(id);
      if (visible && portrait.getAttribute("src") !== src) portrait.src = src;
      const modules = model.actionModules.filter((a) => a.category === "body" && a.automaticEligible);
      draft[id] ??= modules.map((a) => ({ id: "default:" + a.id, actionId: a.id, name: a.label, weight: 1, enabled: true, keywords: [] }));
      const entries = draft[id], conflict = document.createElement("p");
      conflict.dataset.keywordConflict = "";
      list.append(conflict);
      const check = () => {
        const seen = /* @__PURE__ */ new Set(), duplicates = /* @__PURE__ */ new Set();
        for (const p of entries.filter((p2) => p2.enabled)) for (const tag of p.keywords) {
          const key = tag.toLocaleLowerCase();
          if (seen.has(key)) duplicates.add(tag);
          seen.add(key);
        }
        conflict.textContent = duplicates.size ? "\u91CD\u590D\u5173\u952E\u8BCD\u6309\u5217\u8868\u987A\u5E8F\u5339\u914D\uFF1A" + [...duplicates].join("\u3001") : "";
      };
      list.append(button("\u65B0\u5EFA\u52A8\u4F5C\u9884\u8BBE", () => {
        if (modules.length) {
          entries.push({ id: crypto.randomUUID(), name: "\u65B0\u52A8\u4F5C\u9884\u8BBE", actionId: modules[0].id, weight: 1, enabled: true, keywords: [] });
          void render();
        }
      }));
      for (const [index, p] of entries.entries()) {
        const row = fieldset();
        row.dataset.presetId = p.id;
        const fold = button("\u6536\u8D77\u8BBE\u7F6E", () => {
          const collapsed = fold.dataset.collapsed === "1";
          for (const child of [...row.children].slice(1)) child.hidden = !collapsed;
          fold.dataset.collapsed = collapsed ? "0" : "1";
          fold.textContent = collapsed ? "\u6536\u8D77\u8BBE\u7F6E" : "\u5C55\u5F00\u8BBE\u7F6E";
        });
        fold.style.cssText = "float:right;margin:-4px 0 6px 8px;padding:4px 8px;font-size:11px";
        row.append(fold);
        const name2 = input(p.name, (v) => {
          p.name = v;
        });
        name2.dataset.presetName = "";
        const choices = modules.map((a) => [a.id, a.label]);
        if (!modules.some((a) => a.id === p.actionId)) choices.push([p.actionId, "\u52A8\u4F5C\u5DF2\u4E0D\u53EF\u7528\uFF1A" + p.actionId]);
        const source = options(choices, p.actionId, (v) => {
          p.actionId = v;
          void render();
        });
        source.dataset.presetSource = "";
        const enabled = document.createElement("input");
        enabled.type = "checkbox";
        enabled.checked = p.enabled;
        enabled.onchange = () => {
          p.enabled = enabled.checked;
          check();
        };
        row.append(label("\u9884\u8BBE\u540D\u79F0", name2), label("\u539F\u59CB\u52A8\u4F5C", source), label("\u542F\u7528\u5173\u952E\u8BCD\u89E6\u53D1", enabled));
        previewControls(row, model, () => modules.find((a) => a.id === p.actionId) ?? {}, p.weight, (v) => {
          p.weight = v;
        });
        const tags = document.createElement("textarea");
        tags.dataset.actionId = p.actionId;
        tags.value = p.keywords.join("\n");
        tags.placeholder = "\u6BCF\u884C\u4E00\u4E2A\u5173\u952E\u8BCD";
        tags.style.minHeight = "75px";
        tags.oninput = () => {
          p.keywords = [...new Set(tags.value.split("\n").map((t) => t.trim()).filter(Boolean))];
          check();
        };
        row.append(label("\u5173\u952E\u8BCD", tags), button("\u590D\u5236\u9884\u8BBE", () => {
          entries.splice(index + 1, 0, { ...structuredClone(p), id: crypto.randomUUID(), name: p.name + " \u526F\u672C" });
          void render();
        }), button("\u4E0A\u79FB", () => {
          if (index) {
            [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]];
            void render();
          }
        }), button("\u5220\u9664\u9884\u8BBE", () => {
          entries.splice(index, 1);
          void render();
        }));
        list.append(row);
      }
      check();
      if (model.kind === "dragonbones" && recipes[id]) {
        const title = document.createElement("h3");
        title.textContent = "\u53D1\u97F3\u5634\u578B\u914D\u65B9";
        list.append(title);
        const help = document.createElement("p");
        help.textContent = "e/w/y \u7B49\u53D1\u97F3\u6807\u7B7E\u53EF\u590D\u7528 a/o/i/m \u7684\u4E0D\u540C\u6743\u91CD\uFF0C\u81EA\u52A8\u8BF4\u8BDD\u6309\u62FC\u97F3\u5B57\u7B26\u5339\u914D\u3002\u672A\u914D\u7F6E\u5B57\u7B26\u6CBF\u7528\u57FA\u7840\u5634\u578B\u3002\u6269\u5C55\u9ED8\u8BA4\u503C\u662F\u53EF\u8C03\u6574\u7684\u8FD1\u4F3C\u6548\u679C\uFF0C\u4E0D\u662F\u65B0\u5236\u4F5C\u7684\u7D20\u6750\u3002";
        list.append(help);
        list.append(button("\u65B0\u589E\u53D1\u97F3\u914D\u65B9", () => {
          const unused = mouthPhonemes.find((c) => !recipes[id].some((r) => r.phoneme === c));
          if (unused) {
            recipes[id].push({ phoneme: unused, base: "i", weight: 0.5 });
            void render();
          } else status("\u5F53\u524D\u652F\u6301\u7684\u53D1\u97F3\u5339\u914D\u9879\u5747\u5DF2\u914D\u7F6E\u3002");
        }));
        for (const [i, r] of recipes[id].entries()) {
          const row = fieldset();
          row.dataset.phoneme = r.phoneme;
          const phoneme = options(mouthPhonemes.filter((p) => p === r.phoneme || !recipes[id].some((r2) => r2.phoneme === p)).map((p) => [p, p]), r.phoneme, (v) => {
            r.phoneme = v;
            void render();
          });
          phoneme.disabled = ["a", "o", "i", "m"].includes(r.phoneme);
          const base = options(["a", "o", "i", "m"].map((s) => [s, s]), r.base, (v) => {
            r.base = v;
          });
          row.append(label("\u53D1\u97F3\u5339\u914D\u7B26\u53F7", phoneme), label("\u57FA\u7840\u5634\u578B", base));
          previewControls(row, model, () => ({ animation: "__speech_" + r.base }), r.weight, (v) => {
            r.weight = v;
          });
          if (!["a", "o", "i", "m"].includes(r.phoneme)) row.append(button("\u5220\u9664\u914D\u65B9", () => {
            recipes[id].splice(i, 1);
            void render();
          }));
          list.append(row);
        }
      }
    } catch (error) {
      if (!disposed && token === revision) status(error.message);
    }
  };
  select.onchange = render;
  return {
    async load(config) {
      stop();
      draft = structuredClone(config.actionPresets);
      recipes = structuredClone(config.mouthRecipes);
      const token = ++revision;
      const [models, settings] = await Promise.all([json("models"), json("settings")]);
      if (disposed || token !== revision) return;
      animated = settings.animated;
      const previous = select.value;
      select.replaceChildren();
      for (const model of models) {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = model.name + (model.outfitName ? " \xB7 " + model.outfitName : "");
        select.append(option);
      }
      select.value = models.some((m) => m.id === previous) ? previous : settings.modelId;
      await render();
      select.disabled = false;
    },
    value() {
      return { actionPresets: draft, mouthRecipes: recipes };
    },
    stop,
    show(value) {
      visible = value;
      stop();
      portrait.src = value && select.value ? "/desktop-pet/view?preview=1&model=" + encodeURIComponent(select.value) : "about:blank";
    },
    suspend() {
      ++revision;
      stop();
      portrait.src = "about:blank";
    },
    dispose() {
      disposed = true;
      ++revision;
      stop();
      channel.close();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", visibility);
      root.replaceChildren();
    }
  };
}

// src/intimacy.mjs
var defaultIntimacyLevels = [
  { min: 0, name: "1\u7EA7 \xB7 \u521D\u8BC6", description: "\u4F60\u4EEC\u5F53\u524D\u8FD8\u662F\u6BD4\u8F83\u964C\u751F\u7684\u9636\u6BB5\uFF0C\u4F60\u6BD4\u8F83\u4E0D\u4FE1\u4EFB\u5BF9\u65B9\u3002" },
  { min: 11, name: "2\u7EA7 \xB7 \u719F\u6089", description: "\u4F60\u4EEC\u5F00\u59CB\u9010\u6E10\u719F\u6089\uFF0C\u5FC3\u91CC\u591A\u4E86\u4E00\u4E9B\u597D\u5947\u548C\u653E\u677E\uFF0C\u4F46\u4ECD\u4FDD\u7559\u4E00\u70B9\u8DDD\u79BB\u3002" },
  { min: 21, name: "3\u7EA7 \xB7 \u9ED8\u5951", description: "\u4F60\u4EEC\u5DF2\u7ECF\u6709\u4E86\u4E00\u4E9B\u9ED8\u5951\uFF0C\u4F60\u611F\u5230\u88AB\u7406\u89E3\uFF0C\u4E5F\u5F00\u59CB\u81EA\u7136\u5730\u5728\u610F\u5BF9\u65B9\u3002" },
  { min: 41, name: "4\u7EA7 \xB7 \u4EB2\u8FD1", description: "\u4F60\u4EEC\u5DF2\u7ECF\u5F88\u4EB2\u8FD1\uFF0C\u4F60\u611F\u5230\u5B89\u5FC3\u548C\u4FE1\u4EFB\uFF0C\u5185\u5FC3\u613F\u610F\u663E\u9732\u66F4\u591A\u504F\u5FC3\u548C\u6E29\u67D4\u3002" },
  { min: 66, name: "5\u7EA7 \xB7 \u4EB2\u5BC6", description: "\u4F60\u4EEC\u73B0\u5728\u5DF2\u7ECF\u53EF\u4EE5\u65E0\u8BDD\u4E0D\u8BF4\uFF0C\u518D\u4EB2\u5BC6\u7684\u8BDD\u90FD\u6562\u76F4\u63A5\u8BF4\u3002\u9762\u5BF9\u8868\u767D\u4F60\u5185\u5FC3\u6B23\u7136\u63A5\u53D7\uFF0C\u9762\u5BF9\u5BF9\u65B9\u7684\u8C03\u620F\u4F60\u4E5F\u6709\u4EB2\u6635\u3001\u4FCF\u76AE\u5730\u56DE\u5E94\u7684\u5FC3\u60C5\u3002" }
].map((level, i, levels) => ({ ...level, max: levels[i + 1] ? levels[i + 1].min - 1 : null }));
function validateIntimacyLevels(levels) {
  if (!Array.isArray(levels) || !levels.length) throw new Error("\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u4EB2\u5BC6\u5EA6\u7B49\u7EA7");
  let previous = -1;
  for (const [index, level] of levels.entries()) {
    if (!level || Object.keys(level).some((k) => !["min", "max", "name", "description"].includes(k)) || !Number.isSafeInteger(level.min) || level.min < 0) throw new Error("\u4EB2\u5BC6\u5EA6\u8D77\u59CB\u5206\u6570\u5FC5\u987B\u662F\u975E\u8D1F\u6574\u6570");
    if (level.min !== previous + 1) throw new Error(`\u7B2C ${index + 1} \u7EA7\u5E94\u4ECE ${previous + 1} \u5206\u5F00\u59CB\uFF0C\u5206\u6570\u533A\u95F4\u4E0D\u80FD\u91CD\u53E0\u6216\u9057\u6F0F`);
    if (index === levels.length - 1 ? level.max !== null : !Number.isSafeInteger(level.max) || level.max < level.min || level.max >= Number.MAX_SAFE_INTEGER) throw new Error("\u7ED3\u675F\u5206\u6570\u4E0D\u80FD\u5C0F\u4E8E\u8D77\u59CB\u5206\u6570\uFF0C\u53EA\u6709\u6700\u540E\u4E00\u7EA7\u7684\u7ED3\u675F\u5206\u6570\u5E94\u7559\u7A7A\u8868\u793A\u65E0\u4E0A\u9650");
    if (typeof level.name !== "string" || !level.name.trim() || typeof level.description !== "string" || !level.description.trim()) throw new Error("\u6BCF\u7EA7\u90FD\u9700\u8981\u540D\u79F0\u548C\u4EB2\u5BC6\u60C5\u51B5\u63CF\u8FF0");
    previous = level.max;
  }
  if (levels[0].min !== 0) throw new Error("\u7B2C\u4E00\u4E2A\u4EB2\u5BC6\u5EA6\u7B49\u7EA7\u987B\u4ECE 0 \u5F00\u59CB");
  return levels;
}

// src/intimacy-settings.mjs
function mountIntimacySettings(root) {
  root.innerHTML = `<h3>\u4EB2\u5BC6\u5EA6</h3><p data-intimacy-status role="status">\u6B63\u5728\u8BFB\u53D6\u2026</p><p>\u6BCF\u5B8C\u6210\u4E00\u8F6E\u7528\u6237\u6D88\u606F\u4E0E AI \u56DE\u590D\u52A0 1 \u5206\uFF1B\u5931\u8D25\u3001\u4E2D\u65AD\u548C\u6D4B\u8BD5\u8FDE\u63A5\u4E0D\u8BA1\u5206\u3002\u65B0\u5EFA\u5BF9\u8BDD\u4ECE 0 \u5F00\u59CB\uFF0C\u5DF2\u6709\u5386\u53F2\u4E0D\u8865\u7B97\u3002</p><p>\u81EA\u7531\u586B\u5199\u6BCF\u7EA7\u7684\u8D77\u59CB\u5206\u6570\u3001\u7ED3\u675F\u5206\u6570\u4E0E\u7B49\u7EA7\u540D\u79F0\uFF0C\u4E24\u7AEF\u5206\u6570\u90FD\u5305\u542B\u5728\u5185\u3002\u533A\u95F4\u4ECE 0 \u5F00\u59CB\u8FDE\u7EED\u6392\u5217\uFF0C\u4E0D\u53EF\u91CD\u53E0\uFF1B\u6700\u540E\u4E00\u7EA7\u7ED3\u675F\u5206\u6570\u7559\u7A7A\u8868\u793A\u65E0\u4E0A\u9650\u3002\u5728\u60C5\u7EEA\u6A21\u62DF Prompt \u4E2D\u63D2\u5165 {{\u4EB2\u5BC6\u60C5\u51B5}} \u540E\u751F\u6548\u3002</p><div data-intimacy-levels></div><button data-add-level>\u6DFB\u52A0\u7B49\u7EA7</button>`;
  const list = root.querySelector("[data-intimacy-levels]");
  const rows = () => [...list.children];
  const add = (level) => {
    const row = document.createElement("fieldset");
    row.style.cssText = "border:1px solid #dfe3ea;border-radius:12px;padding:16px;margin:12px 0";
    row.innerHTML = `<label>\u7B49\u7EA7\u540D\u79F0<input data-level-name></label><div style="display:flex;gap:12px"><label style="flex:1">\u8D77\u59CB\u5206\u6570<input data-min type="number" min="0" step="1"></label><label style="flex:1">\u7ED3\u675F\u5206\u6570<input data-max type="number" min="0" step="1" placeholder="\u6700\u540E\u4E00\u7EA7\u7559\u7A7A\uFF0C\u4E0D\u9650\u4E0A\u9650"></label></div><label>\u4EB2\u5BC6\u60C5\u51B5\u63CF\u8FF0<textarea data-level-description></textarea></label><button data-remove-level>\u5220\u9664\u7B49\u7EA7</button>`;
    row.querySelector("[data-level-name]").value = level.name;
    row.querySelector("[data-min]").value = level.min;
    row.querySelector("[data-level-description]").value = level.description;
    row.querySelector("[data-max]").value = level.max ?? "";
    row.querySelector("[data-remove-level]").onclick = (e) => {
      e.preventDefault();
      row.remove();
    };
    list.append(row);
  };
  root.querySelector("[data-add-level]").onclick = (e) => {
    e.preventDefault();
    const last = rows().at(-1);
    if (last && last.querySelector("[data-max]").value === "") last.querySelector("[data-max]").value = Number(last.querySelector("[data-min]").value) + 9;
    add({ min: last ? Number(last.querySelector("[data-max]").value) + 1 : 0, max: null, name: `${rows().length + 1}\u7EA7`, description: "" });
  };
  return {
    load(levels) {
      list.replaceChildren();
      levels.forEach(add);
    },
    state(value) {
      root.querySelector("[data-intimacy-status]").textContent = value ? `\u5F53\u524D\u5BF9\u8BDD\uFF1A${value.score} \u5206 \xB7 ${value.name}` : "\u5F53\u524D\u5BF9\u8BDD\uFF1A0 \u5206";
    },
    value() {
      return validateIntimacyLevels(rows().map((row) => ({ min: row.querySelector("[data-min]").value === "" ? NaN : Number(row.querySelector("[data-min]").value), max: row.querySelector("[data-max]").value === "" ? null : Number(row.querySelector("[data-max]").value), name: row.querySelector("[data-level-name]").value, description: row.querySelector("[data-level-description]").value })));
    }
  };
}

// src/conversation-settings.mjs
function mountConversationSettings(root, status, showPet) {
  root.innerHTML = `<style>.voice-form{padding:22px 28px;overflow:auto;flex:1;min-height:0}.voice-form label{display:flex;flex-direction:column;gap:7px;margin-bottom:16px;font-size:13px}.voice-form input,.voice-form textarea,.voice-form select{font:inherit;width:100%;padding:10px;border:1px solid #dfe3ea;border-radius:9px;background:white}.voice-form textarea{min-height:150px;resize:vertical}.voice-form p{color:#788393;font-size:12px;line-height:1.6}.voice-form .keyrow{display:flex;gap:8px}.voice-form .keyrow button{white-space:nowrap}.voice-form .switch{flex-direction:row;align-items:center;justify-content:space-between}.voice-form .switch input{width:18px;height:18px}</style>
  <div data-page="conversation"><p>\u684C\u5BA0\u5BF9\u8BDD\u548C\u60C5\u7EEA\u6A21\u62DF\u5171\u7528\u8FD9\u91CC\u7684\u72EC\u7ACB\u6A21\u578B\u914D\u7F6E\uFF0C\u4E0D\u5F71\u54CD Harness \u4E3B\u5BF9\u8BDD\u3002</p><label>\u65B9\u821F API Key<span class="keyrow"><input data-key="llm" type="password" autocomplete="off" placeholder="\u586B\u5199\u540E\u4FDD\u5B58"><button data-clear="llm">\u6E05\u9664</button></span></label><label>Base URL<input data-field="baseUrl"></label><label>\u6A21\u578B\u63A5\u5165\u70B9<input data-field="model" placeholder="ep-\u2026"></label><button data-test>\u6D4B\u8BD5\u5BF9\u8BDD\u8FDE\u63A5</button></div>
  <div data-page="prompts" hidden><label>\u5BF9\u8BDD Prompt<textarea data-field="prompt"></textarea></label><p>\u5728\u9700\u8981\u7684\u4F4D\u7F6E\u5199\u5165 {{\u60C5\u7EEA\u6A21\u62DF}}\uFF0C\u56DE\u590D\u65F6\u66FF\u6362\u4E3A\u6700\u65B0\u5DF2\u5B8C\u6210\u7684\u60C5\u7EEA\u6587\u672C\u3002\u65E7 Prompt \u539F\u6837\u4FDD\u7559\uFF1B\u672A\u586B\u5199\u53D8\u91CF\u65F6\u4E0D\u4F1A\u81EA\u52A8\u6CE8\u5165\u3002</p><button data-insert-emotion>\u63D2\u5165 {{\u60C5\u7EEA\u6A21\u62DF}}</button><label>\u60C5\u7EEA\u6A21\u62DF Prompt<textarea data-field="emotionPrompt"></textarea></label><button data-insert-history>\u63D2\u5165 {{\u804A\u5929\u8BB0\u5F55}}</button><p>{{\u804A\u5929\u8BB0\u5F55}} \u6309\u65F6\u95F4\u987A\u5E8F\u5305\u542B\u53CC\u65B9\u6D88\u606F\uFF0C8 \u6761\u5C31\u662F\u53CC\u65B9\u6D88\u606F\u5408\u8BA1 8 \u6761\u3002\u672A\u586B\u5199\u53D8\u91CF\u65F6\u4E0D\u4F1A\u6CE8\u5165\u804A\u5929\u8BB0\u5F55\u3002</p><label>\u804A\u5929\u8BB0\u5F55\u4E2D\u7684\u89D2\u8272\u79F0\u547C<input data-field="emotionCharacterName"></label><label>\u60C5\u7EEA\u53C2\u8003\u6700\u8FD1\u51E0\u6761\u6D88\u606F<input data-field="emotionHistoryMessages" type="number" min="1" max="100"></label><p>\u9996\u6B21\u65E0\u8BB0\u5F55\u65F6\u5148\u6839\u636E\u7528\u6237\u6D88\u606F\u751F\u6210\u60C5\u7EEA\uFF1B\u4E4B\u540E\u6BCF\u6B21\u56DE\u590D\u5B8C\u6210\u5728\u540E\u53F0\u66F4\u65B0\uFF0C\u4F9B\u4E0B\u4E00\u8F6E\u4F7F\u7528\u3002\u60C5\u7EEA\u6587\u672C\u4E0D\u8FDB\u5165\u804A\u5929\u8BB0\u5F55\uFF0C\u4E5F\u4E0D\u6717\u8BFB\u3002</p><h3>\u5F53\u524D\u60C5\u7EEA</h3><p data-emotion-status role="status"></p><div data-emotion-text style="white-space:pre-wrap;overflow-wrap:anywhere"></div></div>
  <div data-page="actions" hidden></div>
  <div data-page="voice" hidden><label class="switch">\u81EA\u52A8\u6717\u8BFB\u56DE\u590D<input data-field="ttsEnabled" type="checkbox"></label><p>\u5173\u95ED\u540E\u7ACB\u5373\u505C\u6B62\u6717\u8BFB\uFF1B\u5F00\u542F\u540E\u4ECE\u4E0B\u4E00\u6B21\u56DE\u590D\u81EA\u52A8\u53D1\u58F0\u3002</p><label>TTS API Key<span class="keyrow"><input data-key="tts" type="password" autocomplete="off"><button data-clear="tts">\u6E05\u9664</button></span></label><label>ASR API Key<span class="keyrow"><input data-key="asr" type="password" autocomplete="off"><button data-clear="asr">\u6E05\u9664</button></span></label><p>\u8BED\u97F3 Key \u53EF\u5171\u7528\uFF0C\u4E5F\u53EF\u5206\u522B\u586B\u5199\uFF1B\u65B0\u7248\u63A5\u53E3\u65E0\u9700 App ID\u3002</p><label>\u97F3\u8272\u7C7B\u578B<select data-field="voiceKind"><option value="default">\u9ED8\u8BA4\u97F3\u8272</option><option value="clone">\u514B\u9686\u97F3\u8272</option></select></label><label>\u9ED8\u8BA4\u97F3\u8272<select data-default-voice><option value="zh_female_gaolengyujie_uranus_bigtts">\u9AD8\u51B7\u5FA1\u59D0</option><option value="custom">\u5176\u4ED6\u5B98\u65B9\u97F3\u8272</option></select></label><label>\u97F3\u8272 ID<input data-field="speaker" placeholder="\u5B98\u65B9 speaker \u6216 S_\u2026"></label><label>\u97F3\u8272\u540D\u79F0<input data-field="voiceName"></label><label>\u8BED\u901F<input data-field="speechRate" type="number" min="-50" max="100"></label><label>ASR \u8D44\u6E90<select data-field="asrResource"><option value="volc.seedasr.sauc.duration">\u8C46\u5305 2.0 \xB7 \u5C0F\u65F6\u7248</option><option value="volc.seedasr.sauc.concurrent">\u8C46\u5305 2.0 \xB7 \u5E76\u53D1\u7248</option><option value="volc.bigasr.sauc.duration">\u8C46\u5305 1.0 \xB7 \u5C0F\u65F6\u7248</option><option value="volc.bigasr.sauc.concurrent">\u8C46\u5305 1.0 \xB7 \u5E76\u53D1\u7248</option></select></label><button data-sample>\u8BD5\u542C\u5DF2\u4FDD\u5B58\u97F3\u8272</button><p>\u8BC6\u522B\u6D4B\u8BD5\uFF1A\u6253\u5F00\u804A\u5929\uFF0C\u70B9\u51FB\u5F55\u97F3\uFF0C\u7ED3\u675F\u540E\u68C0\u67E5\u8F6C\u5199\u6587\u5B57\u3002</p></div>`;
  let stored, disposed = false, generation = 0, events;
  const cleared = /* @__PURE__ */ new Set();
  const intimacyRoot = document.createElement("div");
  intimacyRoot.dataset.page = "intimacy";
  intimacyRoot.hidden = true;
  root.append(intimacyRoot);
  const intimacy = mountIntimacySettings(intimacyRoot);
  const insertIntimacy = document.createElement("button");
  insertIntimacy.textContent = "\u63D2\u5165 {{\u4EB2\u5BC6\u60C5\u51B5}}";
  insertIntimacy.dataset.insertIntimacy = "";
  root.querySelector('[data-field="emotionPrompt"]').parentElement.after(insertIntimacy);
  insertIntimacy.onclick = (e) => {
    e.preventDefault();
    const input = field("emotionPrompt");
    input.setRangeText("{{\u4EB2\u5BC6\u60C5\u51B5}}", input.selectionStart, input.selectionEnd, "end");
    input.focus();
  };
  const keywords = mountActionPresetSettings(root.querySelector('[data-page="actions"]'), status);
  const showEmotion = (value) => {
    root.querySelector("[data-emotion-text]").textContent = value?.text || "\u5C1A\u672A\u751F\u6210\u60C5\u7EEA\u3002";
    root.querySelector("[data-emotion-status]").textContent = value?.generating ? "\u6B63\u5728\u751F\u6210\u4E0B\u4E00\u8F6E\u7684\u60C5\u7EEA\uFF0C\u671F\u95F4\u6CBF\u7528\u4E0A\u4E00\u4EFD\u3002" : value?.error || (value?.updatedAt ? "\u66F4\u65B0\u4E8E " + new Date(value.updatedAt).toLocaleString() : "");
  };
  const voiceStatus = document.createElement("p");
  voiceStatus.setAttribute("role", "status");
  root.querySelector('[data-page="voice"]').prepend(voiceStatus);
  const renderVoiceStatus = (enabled) => {
    voiceStatus.textContent = enabled ? "\u81EA\u52A8\u6717\u8BFB\u5DF2\u5F00\u542F\uFF1A\u4FDD\u5B58\u7684\u65B0\u97F3\u8272\u7528\u4E8E\u4E0B\u4E00\u8F6E\u56DE\u590D\u3002" : "\u81EA\u52A8\u6717\u8BFB\u5DF2\u5173\u95ED\uFF1A\u804A\u5929\u53EA\u663E\u793A\u6587\u5B57\uFF1B\u5982\u9700\u53D1\u58F0\uFF0C\u8BF7\u5F00\u542F\u81EA\u52A8\u6717\u8BFB\u5F00\u5173\u3002";
  };
  const field = (key) => root.querySelector(`[data-field="${key}"]`);
  const guarded = (fn) => async (e) => {
    e.preventDefault();
    try {
      await fn();
    } catch (error) {
      if (!disposed) status(error.message);
    }
  };
  const load = async (force = false) => {
    if (stored && !force) return;
    const token = ++generation;
    stored = void 0;
    for (const input of root.querySelectorAll("input,textarea,select,button")) input.disabled = true;
    let result;
    try {
      result = await conversationApi("/config");
      if (!disposed && token === generation) await keywords.load(result.config);
    } finally {
      if (!disposed && token === generation) {
        for (const input of root.querySelectorAll("input,textarea,select,button")) if (!input.closest('[data-page="actions"]')) input.disabled = false;
      }
    }
    if (disposed || token !== generation) return;
    stored = result.config;
    cleared.clear();
    intimacy.load(stored.intimacyLevels);
    events?.close();
    events = new EventSource("/desktop-pet/api/conversation/events");
    events.addEventListener("state", (e) => {
      const value = JSON.parse(e.data);
      showEmotion(value.emotion);
      intimacy.state(value.intimacy);
    });
    events.addEventListener("emotion", (e) => showEmotion(JSON.parse(e.data)));
    renderVoiceStatus(stored.ttsEnabled);
    for (const input of root.querySelectorAll("[data-field]")) {
      const value = stored[input.dataset.field];
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
    root.querySelector("[data-default-voice]").value = stored.speaker === "zh_female_gaolengyujie_uranus_bigtts" ? stored.speaker : "custom";
    root.querySelector("[data-default-voice]").parentElement.hidden = stored.voiceKind === "clone";
    for (const input of root.querySelectorAll("[data-key]")) {
      input.value = "";
      input.placeholder = result.configured[input.dataset.key] ? "\u5DF2\u4FDD\u5B58\uFF0C\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8" : "\u5C1A\u672A\u914D\u7F6E";
    }
  };
  root.querySelector("[data-insert-emotion]").onclick = (e) => {
    e.preventDefault();
    const input = field("prompt");
    input.setRangeText("{{\u60C5\u7EEA\u6A21\u62DF}}", input.selectionStart, input.selectionEnd, "end");
    input.focus();
  };
  root.querySelector("[data-insert-history]").onclick = (e) => {
    e.preventDefault();
    const input = field("emotionPrompt");
    input.setRangeText("{{\u804A\u5929\u8BB0\u5F55}}", input.selectionStart, input.selectionEnd, "end");
    input.focus();
  };
  for (const button of root.querySelectorAll("[data-clear]")) button.onclick = (e) => {
    e.preventDefault();
    cleared.add(button.dataset.clear);
    const input = root.querySelector(`[data-key="${button.dataset.clear}"]`);
    input.value = "";
    input.placeholder = "\u4FDD\u5B58\u540E\u6E05\u9664";
  };
  root.querySelector("[data-default-voice]").onchange = (e) => {
    if (e.target.value !== "custom") {
      field("speaker").value = e.target.value;
      field("voiceName").value = "\u9AD8\u51B7\u5FA1\u59D0";
    }
  };
  field("voiceKind").onchange = () => {
    root.querySelector("[data-default-voice]").parentElement.hidden = field("voiceKind").value === "clone";
    if (field("voiceKind").value === "default") {
      field("speaker").value = "zh_female_gaolengyujie_uranus_bigtts";
      field("voiceName").value = "\u9AD8\u51B7\u5FA1\u59D0";
    } else {
      field("speaker").value = stored.voiceKind === "clone" ? stored.speaker : "";
      field("voiceName").value = stored.voiceKind === "clone" ? stored.voiceName : "\u6211\u7684\u514B\u9686\u97F3\u8272";
    }
  };
  field("speaker").oninput = () => {
    const speaker = field("speaker").value.trim();
    if (!speaker) return;
    field("voiceKind").value = speaker.startsWith("S_") ? "clone" : "default";
    root.querySelector("[data-default-voice]").parentElement.hidden = field("voiceKind").value === "clone";
    root.querySelector("[data-default-voice]").value = speaker === "zh_female_gaolengyujie_uranus_bigtts" ? speaker : "custom";
    status("\u97F3\u8272\u7C7B\u578B\u5DF2\u6309 ID \u5339\u914D\uFF0C\u8BF7\u4FDD\u5B58\uFF1B\u65B0\u97F3\u8272\u4ECE\u4E0B\u4E00\u8F6E\u56DE\u590D\u751F\u6548\u3002");
  };
  field("ttsEnabled").onchange = guarded(async () => {
    const enabled = field("ttsEnabled").checked, current = await conversationApi("/config");
    await conversationApi("/config", { config: { ...current.config, ttsEnabled: enabled } });
    stored.ttsEnabled = enabled;
    renderVoiceStatus(enabled);
    status(enabled ? "\u5DF2\u5F00\u542F\u81EA\u52A8\u6717\u8BFB\uFF0C\u4ECE\u4E0B\u4E00\u6B21\u56DE\u590D\u751F\u6548\u3002" : "\u5DF2\u5173\u95ED\u81EA\u52A8\u6717\u8BFB\u3002");
  });
  root.querySelector("[data-test]").onclick = guarded(async () => {
    status("\u6B63\u5728\u6D4B\u8BD5\u5DF2\u4FDD\u5B58\u914D\u7F6E\u2026");
    const result = await conversationApi("/test", {});
    if (!disposed) status(`\u8FDE\u63A5\u6B63\u5E38\uFF1A${result.text}`);
  });
  const save = async () => {
    if (!stored) throw new Error("\u8BBE\u7F6E\u5C1A\u672A\u52A0\u8F7D");
    const config = { ...stored, ...keywords.value(), intimacyLevels: intimacy.value() }, keys = {};
    for (const input of root.querySelectorAll("[data-field]")) config[input.dataset.field] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    for (const input of root.querySelectorAll("[data-key]")) {
      if (input.value.trim()) keys[input.dataset.key] = input.value.trim();
      else if (cleared.has(input.dataset.key)) keys[input.dataset.key] = null;
    }
    await conversationApi("/config", { config, keys });
    await load(true);
    status("\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002");
  };
  root.querySelector("[data-sample]").textContent = "\u4FDD\u5B58\u5E76\u8BD5\u542C\u97F3\u8272";
  root.querySelector("[data-sample]").onclick = guarded(async () => {
    await save();
    await showPet();
    status("\u6B63\u5728\u5408\u6210\u8BD5\u542C\u2026");
    await conversationApi("/sample", {});
    if (!disposed) status("\u97F3\u8272\u5DF2\u9001\u81F3\u684C\u5BA0\u64AD\u653E\u3002");
  });
  return {
    load,
    show(page) {
      keywords.show(page === "actions");
      for (const div of root.querySelectorAll("[data-page]")) div.hidden = div.dataset.page !== page;
      root.scrollTop = 0;
    },
    save,
    suspend() {
      generation++;
      stored = void 0;
      events?.close();
      keywords.suspend();
      for (const input of root.querySelectorAll("[data-key]")) input.value = "";
    },
    dispose() {
      disposed = true;
      this.suspend();
      keywords.dispose();
      root.replaceChildren();
    }
  };
}

// src/action-debug.mjs
function mountActionDebug(container, { api, status, animated }) {
  const channel = new BroadcastChannel("dsh-pet-action-debug");
  let revision = 0, held, timer;
  const send = () => channel.postMessage({ ...held, kind: "hold" });
  const stop = () => {
    clearInterval(timer);
    if (held) channel.postMessage({ kind: "release", token: held.token, modelId: held.modelId });
    held = null;
    for (const button of container.querySelectorAll("button")) button.setAttribute("aria-pressed", "false");
  };
  const suspend = () => {
    ++revision;
    stop();
    container.replaceChildren();
  };
  window.addEventListener("blur", stop);
  const visibility = () => {
    if (document.hidden) stop();
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    stop,
    suspend,
    async load(modelId) {
      suspend();
      const token = revision;
      try {
        const info = await api(`model?id=${encodeURIComponent(modelId)}`);
        if (token !== revision) return;
        const title = document.createElement("summary");
        title.textContent = "\u52A8\u4F5C\u8C03\u8BD5 \xB7 \u6309\u4F4F\u9884\u89C8\uFF0C\u677E\u5F00\u6062\u590D";
        const details = document.createElement("details");
        details.append(title);
        container.append(details);
        const items = info.actionModules;
        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;padding:10px 0";
        details.append(buttons);
        details.addEventListener("toggle", () => {
          if (!details.open) stop();
        });
        for (const category of ["body", "mouth"]) {
          const group = items.filter((item) => item.category === category);
          if (!group.length) continue;
          const label = document.createElement("strong");
          label.textContent = category === "mouth" ? "\u5634\u578B\u52A8\u4F5C" : "\u80A2\u4F53\u52A8\u4F5C";
          label.style.width = "100%";
          buttons.append(label);
          for (const item of group) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = item.label;
            button.setAttribute("aria-pressed", "false");
            const start = () => {
              stop();
              if (!animated()) {
                status("\u8BF7\u5148\u5F00\u542F\u5E76\u4FDD\u5B58\u52A8\u753B\u8BBE\u7F6E\uFF0C\u518D\u9884\u89C8\u52A8\u4F5C\u3002");
                return;
              }
              held = { modelId, token: crypto.randomUUID(), selection: item };
              button.setAttribute("aria-pressed", "true");
              send();
              timer = setInterval(send, 250);
            };
            button.onpointerdown = (event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              button.setPointerCapture(event.pointerId);
              start();
            };
            button.onpointerup = stop;
            button.onpointercancel = stop;
            button.onlostpointercapture = stop;
            button.onkeydown = (event) => {
              if ([" ", "Enter"].includes(event.key)) {
                event.preventDefault();
                if (!event.repeat) start();
              }
            };
            button.onkeyup = (event) => {
              if ([" ", "Enter"].includes(event.key)) {
                event.preventDefault();
                stop();
              }
            };
            button.onblur = stop;
            buttons.append(button);
          }
        }
        if (!items.length) buttons.textContent = "\u6B64\u89D2\u8272\u6CA1\u6709\u5185\u7F6E\u52A8\u4F5C\u3002";
      } catch (error) {
        if (token === revision) status(error.message);
      }
    },
    dispose() {
      suspend();
      channel.close();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", visibility);
    }
  };
}

// src/client.mjs
var name = "desktop-pet-client";
function apply(ctx) {
  ctx.effect(() => {
    const lease = crypto.randomUUID(), desktop = window.harnessDesktop;
    const command = (value) => desktop?.petCommand({ ...value, lease }) ?? Promise.reject(new Error("\u8BF7\u5728 Harness \u684C\u9762 App \u4E2D\u4F7F\u7528\u684C\u5BA0\u7A97\u53E3"));
    const host = document.createElement("div");
    host.dataset.plugin = "desktop-pet";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host{font:14px -apple-system,BlinkMacSystemFont,sans-serif;color:#2e3440}*{box-sizing:border-box}button,input{font:inherit;color:inherit}button{cursor:pointer;border:1px solid #e0e3e9;border-radius:10px;background:#fff;padding:9px 16px}button:hover{background:#f1f4fa}button:focus-visible,input:focus-visible{outline:3px solid #9db4e8;outline-offset:2px}button:disabled{opacity:.5;cursor:wait}
      #entry{position:fixed;bottom:16px;right:18px;z-index:900;box-shadow:0 3px 18px #17203320}
      dialog{padding:0;border:1px solid #e3e6ec;border-radius:22px;width:min(1180px,96vw);height:min(860px,94vh);max-height:94vh;color:inherit;box-shadow:0 24px 100px #0003;overflow:hidden}dialog::backdrop{background:#16233b50}
      .shell{height:100%;display:flex;flex-direction:column}.heading{display:flex;align-items:center;justify-content:space-between;padding:22px 26px;border-bottom:1px solid #edf0f4}h2{font-size:22px;margin:0 0 5px}.heading p{margin:0;color:#7a8290;font-size:13px}#close{border:0;font-size:25px;line-height:1;width:36px;height:36px;padding:0;background:transparent}
      .body{flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr)}#library{min-height:0;display:flex;flex-direction:column;background:#f7f8fb;padding:20px 14px 0;border-right:1px solid #edf0f4}.search-label{font-weight:600;margin:0 8px 12px}#model-search{width:100%;border:1px solid #e0e4ec;border-radius:10px;background:#fff;padding:10px 12px}#library-count{font-size:12px;color:#7a8290;margin:12px 6px}#models{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding:0 3px 16px}
      .character-row{display:flex;align-items:center;gap:12px;width:100%;padding:8px;margin-bottom:7px;text-align:left;border-color:transparent;background:transparent;min-height:80px}.character-row:hover{background:#eceff6}.character-row[aria-pressed=true]{border-color:#98afe0;background:#eaf0fc}.character-row img{width:48px;height:64px;object-fit:contain;border-radius:8px;background:#eee9e2;flex:none}.character-row>span:nth-child(2){min-width:0;flex:1}.character-row strong{display:block;font-size:14px;overflow-wrap:anywhere}.character-row small{display:block;color:#7a8290;font-size:11px;margin-top:5px}.selection-mark{color:#4b6faf;font-weight:700}.empty{padding:20px 8px;color:#7a8290;line-height:1.6}
      .detail{min-width:0;min-height:0;overflow:auto;padding:18px 28px;display:flex;flex-direction:column}.portrait{position:relative;min-height:150px;flex:1;background:radial-gradient(ellipse at 50% 80%,#e4dfd4 0,transparent 65%),#f6f3ed;border-radius:16px;overflow:hidden}.portrait:after{content:"";position:absolute;bottom:12px;left:35%;right:35%;height:7px;background:#776b5820;filter:blur(5px);border-radius:50%;pointer-events:none}#model-preview{display:block;width:100%;height:100%;border:0;position:absolute;inset:0}#character-name{font-size:18px;margin:14px 0 4px}#character-subtitle{font-size:12px;color:#7a8290;margin:0 0 13px}.size-label{display:flex;justify-content:space-between;align-items:center;font-size:13px}.size-label output{color:#7a8290;font-variant-numeric:tabular-nums}#height{width:100%;accent-color:#6281bd;margin:12px 0 14px}.toggle{display:flex;align-items:center;justify-content:space-between;padding:9px 0;font-size:13px}.toggle input{width:18px;height:18px;accent-color:#6281bd}.hint{font-size:12px;color:#7a8290;line-height:1.5;margin:12px 0 0}
      footer{flex:none;border-top:1px solid #edf0f4;padding:12px 24px 16px;background:white}#status{font-size:12px;min-height:18px;margin:0 0 8px;color:#68758a}.actions{display:flex;gap:10px;align-items:center}.actions .primary{margin-left:auto;background:#526fa5;color:#fff;border-color:#526fa5}.actions .primary:hover{background:#435f92}
      @media(max-width:650px){.body{grid-template-columns:42% minmax(0,1fr)}#library{padding:12px 6px 0}.detail{padding:12px}.character-row{gap:6px;padding:5px}.character-row img{width:34px;height:50px}.character-row strong{font-size:12px}.character-row small{font-size:10px}.heading{padding:16px}.heading p{max-width:240px;font-size:12px}.selection-mark{display:none}footer{padding:10px 14px}.hint{display:none}}
      </style><button id="entry" title="\u684C\u5BA0\u8BBE\u7F6E">\u{1F43E} \u684C\u5BA0</button><dialog aria-labelledby="pet-title">
      <div class="shell"><header class="heading"><div><h2 id="pet-title">\u684C\u9762\u4F19\u4F34</h2><p>\u6311\u4E00\u4F4D\u559C\u6B22\u7684\u4F19\u4F34\uFF0C\u966A\u4F60\u4E00\u8D77\u5DE5\u4F5C\u3002</p></div><button id="close" aria-label="\u5173\u95ED" title="\u5173\u95ED">\xD7</button></header>
      <div class="body"><aside id="library"></aside><section class="detail" aria-label="\u5F53\u524D\u89D2\u8272\u4E0E\u8BBE\u7F6E"><div class="portrait"><iframe id="model-preview" title="\u89D2\u8272\u7ACB\u7ED8" src="about:blank"></iframe></div><h3 id="character-name">\u6B63\u5728\u52A0\u8F7D\u4F19\u4F34\u2026</h3><p id="character-subtitle"></p>
      <label class="size-label" for="height"><span>\u89D2\u8272\u663E\u793A\u5927\u5C0F</span><output id="height-value"></output></label><input id="height" type="range" min="180" max="1000" step="10">
      <label class="toggle" for="animated">\u5F00\u542F\u52A8\u753B<input id="animated" type="checkbox"></label><label class="toggle" for="alwaysOnTop">\u4FDD\u6301\u5728\u7A97\u53E3\u4E0A\u65B9<input id="alwaysOnTop" type="checkbox"></label><p class="hint">\u8F7B\u8F7B\u6478\u5934\u3001\u70B9\u51FB\u4E92\u52A8\uFF0C\u6309\u4F4F\u89D2\u8272\u5373\u53EF\u62D6\u52A8\u3002</p></section></div>
      <footer><p id="status" role="status"></p><div class="actions"><button id="show">\u663E\u793A</button><button id="hide">\u9690\u85CF</button><button id="save" class="primary">\u4FDD\u5B58</button></div></footer></div></dialog>`;
    const layoutStyle = document.createElement("style");
    layoutStyle.textContent = "dialog{width:min(1180px,96vw)!important;height:min(860px,94vh)!important;max-height:94vh!important}.body{grid-template-columns:320px minmax(0,1fr)!important}.detail{padding:22px 32px!important}";
    shadow.append(layoutStyle);
    document.body.append(host);
    const find = (id) => shadow.getElementById(id), dialog = shadow.querySelector("dialog");
    const tabs = document.createElement("nav");
    tabs.style.cssText = "display:flex;gap:8px;padding:10px 24px;border-bottom:1px solid #edf0f4;overflow-x:auto;flex-shrink:0;white-space:nowrap";
    tabs.innerHTML = '<button data-tab="partner">\u4F19\u4F34</button><button data-tab="conversation">\u5BF9\u8BDD</button><button data-tab="prompts">Prompt \u7BA1\u7406</button><button data-tab="intimacy">\u4EB2\u5BC6\u5EA6</button><button data-tab="actions">\u52A8\u4F5C\u4E0E\u5173\u952E\u8BCD</button><button data-tab="voice">\u58F0\u97F3</button><button data-tab="history">\u804A\u5929\u8BB0\u5F55</button>';
    tabs.setAttribute("aria-label", "\u684C\u5BA0\u8BBE\u7F6E\u5206\u7C7B");
    const selectTab = (tab) => {
      for (const button of tabs.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.tab === tab));
        button.style.background = button.dataset.tab === tab ? "#eaf0fc" : "";
      }
    };
    selectTab("partner");
    shadow.querySelector(".heading").after(tabs);
    const voiceRoot = document.createElement("section");
    voiceRoot.className = "voice-form";
    voiceRoot.style.display = "none";
    shadow.querySelector(".body").after(voiceRoot);
    const history = document.createElement("iframe");
    history.title = "\u804A\u5929\u8BB0\u5F55\u4E0E\u9AD8\u7EA7\u5BF9\u8BDD";
    history.allow = "microphone";
    history.src = "about:blank";
    history.style.cssText = "display:none;flex:1;min-height:0;width:100%;border:0";
    voiceRoot.after(history);
    let selectedTab = "partner";
    let disposed = false, attached = false, settings, opening = 0, saving = false;
    const status = (text) => {
      if (!disposed) find("status").textContent = text;
    };
    const voiceSettings = mountConversationSettings(voiceRoot, status, async () => {
      await command({ action: "show" });
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    tabs.onclick = async (event) => {
      try {
        const tab = event.target.closest("[data-tab]")?.dataset.tab;
        if (!tab) return;
        selectTab(tab);
        actionDebug.suspend();
        selectedTab = tab;
        shadow.querySelector(".body").style.display = tab === "partner" ? "" : "none";
        voiceRoot.style.display = ["partner", "history"].includes(tab) ? "none" : "block";
        history.style.display = tab === "history" ? "block" : "none";
        history.src = tab === "history" ? "/desktop-pet/chat" : "about:blank";
        find("save").hidden = tab === "history";
        voiceSettings.show(tab);
        if (tab !== "partner") {
          find("model-preview").src = "about:blank";
          if (tab !== "history") {
            await voiceSettings.load();
          }
        } else preview(await library.refresh());
      } catch (error) {
        status(error.message);
      }
    };
    const api = async (path, body) => {
      const response = await fetch(`/desktop-pet/api/${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : void 0 });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      return value;
    };
    const debugRoot = document.createElement("section");
    shadow.querySelector(".detail").append(debugRoot);
    const actionDebug = mountActionDebug(debugRoot, { api, status, animated: () => settings?.animated });
    const preview = (model) => {
      if (disposed || !dialog.open || !model || selectedTab !== "partner") return;
      find("character-name").textContent = model.name;
      find("character-subtitle").textContent = model.subtitle;
      find("model-preview").src = `/desktop-pet/view?preview=1&model=${encodeURIComponent(model.id)}`;
      void actionDebug.load(model.id);
    };
    let updates = Promise.resolve();
    const updateSettings = (patch) => {
      const result = updates.then(async () => {
        settings = await api("settings", { ...settings, ...patch });
      });
      updates = result.catch(() => {
      });
      return result;
    };
    const configure = async () => {
      if (attached) await command({ action: "configure", height: settings.height, alwaysOnTop: settings.alwaysOnTop });
    };
    const wardrobe = document.createElement("div");
    find("character-subtitle").after(wardrobe);
    const library = mountModelManager(find("library"), { wardrobe, api, selected: () => settings?.modelId, status, select: async (model) => {
      actionDebug.suspend();
      await updateSettings({ modelId: model.id });
      if (disposed) return;
      preview(model);
      await configure();
      if (attached) await command({ action: "show" });
    } });
    const ready = (async () => {
      settings = await api("settings");
      if (disposed) return;
      if (desktop?.petCommand) {
        await command({ action: "attach", height: settings.height, alwaysOnTop: settings.alwaysOnTop });
        attached = true;
        if (disposed) {
          await command({ action: "detach" });
          attached = false;
        }
      }
    })();
    ready.catch((error) => status(error.message));
    const run = (action) => async () => {
      try {
        await ready;
        if (!disposed) await action();
      } catch (error) {
        status(error.message);
      }
    };
    find("entry").onclick = run(async () => {
      if (dialog.open) return;
      const token = ++opening;
      dialog.showModal();
      library.resume();
      status("");
      if (selectedTab === "history") history.src = "/desktop-pet/chat";
      else if (selectedTab !== "partner") {
        voiceSettings.show(selectedTab);
        await voiceSettings.load();
      }
      settings = await api("settings");
      if (disposed || !dialog.open || token !== opening) return;
      find("height").value = settings.height;
      find("height-value").value = `${settings.height} px`;
      for (const key of ["animated", "alwaysOnTop"]) find(key).checked = settings[key];
      preview(await library.refresh());
    });
    find("height").oninput = () => {
      find("height-value").value = `${find("height").value} px`;
    };
    const releasePreview = () => {
      actionDebug.suspend();
      history.src = "about:blank";
      ++opening;
      library.suspend();
      voiceSettings.suspend();
      find("model-preview").src = "about:blank";
    };
    find("close").onclick = () => {
      releasePreview();
      dialog.close();
    };
    dialog.addEventListener("cancel", releasePreview);
    dialog.addEventListener("close", releasePreview);
    find("save").onclick = run(async () => {
      if (saving) return;
      saving = true;
      find("save").disabled = true;
      try {
        if (selectedTab === "history") return;
        if (selectedTab !== "partner") {
          await voiceSettings.save();
          return;
        }
        await updateSettings({ height: Number(find("height").value), animated: find("animated").checked, alwaysOnTop: find("alwaysOnTop").checked });
        if (disposed) return;
        await configure();
        const current = await library.refresh();
        preview(current);
        status("\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002");
      } finally {
        saving = false;
        if (!disposed) find("save").disabled = false;
      }
    });
    find("show").onclick = run(async () => {
      await command({ action: "show" });
      status("\u4F19\u4F34\u5DF2\u663E\u793A\u3002");
    });
    find("hide").onclick = run(async () => {
      await command({ action: "hide" });
      status("\u4F19\u4F34\u5DF2\u9690\u85CF\uFF0C\u70B9\u51FB\u300C\u663E\u793A\u300D\u5373\u53EF\u56DE\u6765\u3002");
    });
    const unsubscribeSettings = desktop?.onPetSettings?.(() => {
      if (!disposed) find("entry").click();
    });
    const unload = () => {
      actionDebug.dispose();
      if (attached) {
        attached = false;
        void command({ action: "detach" }).catch(() => {
        });
      }
    };
    const react = (event) => {
      if (["touch", "click"].includes(event.detail?.action)) void ready.then(() => {
        if (!disposed && attached) return command({ action: "react", reaction: event.detail.action });
      }).catch((error) => status(error.message));
    };
    window.addEventListener("dsh-desktop-pet:react", react);
    window.addEventListener("pagehide", unload);
    return () => {
      disposed = true;
      ++opening;
      unload();
      unsubscribeSettings?.();
      library.dispose();
      voiceSettings.dispose();
      find("model-preview").src = "about:blank";
      window.removeEventListener("pagehide", unload);
      window.removeEventListener("dsh-desktop-pet:react", react);
      history.src = "about:blank";
      host.remove();
    };
  }, "desktop-pet: picker and desktop lifetime");
}

return module.exports;}});
