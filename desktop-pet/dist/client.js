globalThis.__ModuleLoader__.load({id:"dsh-desktop-pet",factory:function(require){var module={exports:{}};var exports=module.exports;
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
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);

// src/model-manager.mjs
function mountModelManager(container, { wardrobe, api: api2, selected, select, status }) {
  container.innerHTML = '<p class="pet-libraryLabel">\u9009\u62E9\u4F19\u4F34</p><input id="model-search" class="pet-input" type="search" aria-label="\u641C\u7D22\u89D2\u8272" placeholder="\u641C\u7D22\u89D2\u8272\u540D\u79F0"><p id="library-count" class="pet-libraryCount"></p><div id="models" class="pet-models" role="group" aria-label="\u5185\u7F6E\u89D2\u8272\u5217\u8868"></div>';
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
      button.type = "button";
      button.className = "pet-character";
      button.dataset.modelId = model.id;
      button.setAttribute("aria-pressed", String(selected() === model.id));
      button.disabled = switching;
      const image = document.createElement("img");
      image.src = model.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      const text = document.createElement("span");
      text.className = "pet-characterText";
      const name2 = document.createElement("strong");
      name2.className = "pet-characterName";
      const detail = document.createElement("small");
      detail.className = "pet-characterMeta";
      name2.textContent = model.characterName;
      detail.textContent = model.subtitle + (variants2.length > 1 ? ` \xB7 ${variants2.length} \u5957\u670D\u88C5` : "");
      text.append(name2, detail);
      const marker = document.createElement("span");
      marker.className = "pet-selectionMark";
      marker.textContent = selected() === model.id ? "\u2713" : "";
      button.append(image, text, marker);
      button.onclick = () => choose(model);
      find("models").append(button);
    }
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "pet-empty";
      empty.textContent = "\u6CA1\u6709\u627E\u5230\u8FD9\u4E2A\u89D2\u8272\uFF0C\u8BD5\u8BD5\u5176\u4ED6\u540D\u5B57\u3002";
      find("models").append(empty);
    }
    find("models").scrollTop = scrollTop;
    wardrobe.replaceChildren();
    const current = models.find((model) => model.id === selected()), variants = groups.get(current?.characterId) ?? [];
    if (variants.length > 1) {
      const label = document.createElement("span");
      label.className = "pet-label";
      label.textContent = "\u670D\u88C5";
      const picker = document.createElement("select");
      picker.id = "pet-outfit";
      picker.className = "pet-select";
      picker.setAttribute("aria-label", "\u670D\u88C5");
      picker.disabled = switching;
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
      const value = await api2("models");
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
function field(text, control2, wide = false) {
  const wrapper = document.createElement("label");
  wrapper.className = wide ? "pet-field pet-fieldWide" : "pet-field";
  const label = document.createElement("span");
  label.className = "pet-label";
  label.textContent = text;
  wrapper.append(label, control2);
  return wrapper;
}
function switchRow(text, checked) {
  const row = document.createElement("div");
  row.className = "pet-switchRow";
  const label = document.createElement("span");
  label.className = "pet-label";
  label.textContent = text;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pet-switch";
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", String(checked));
  const thumb = document.createElement("span");
  thumb.className = "pet-thumb";
  button.append(thumb);
  row.append(label, button);
  return { row, button };
}
function mountActionPresetSettings(root, status) {
  root.innerHTML = `<div class="pet-actions">
    <p class="pet-actionsHelp">\u540C\u4E00\u52A8\u4F5C\u53EF\u4FDD\u5B58\u591A\u4E2A\u6743\u91CD\u9884\u8BBE\u3002\u5173\u952E\u8BCD\u53EA\u5339\u914D\u62EC\u53F7\u5185\u6587\u5B57\uFF0C\u6700\u957F\u4F18\u5148\uFF0C\u7B49\u957F\u6309\u5217\u8868\u987A\u5E8F\u3002\u62D6\u52A8\u6ED1\u5757\u5B9E\u65F6\u9884\u89C8\uFF0C\u677E\u5F00\u6062\u590D\uFF1B\u6539\u52A8\u968F\u8BBE\u7F6E\u9875\u81EA\u52A8\u4FDD\u5B58\u3002</p>
    <div class="pet-actionsToolbar"><label class="pet-field"><span class="pet-label">\u89D2\u8272\u4E0E\u670D\u88C5</span><select class="pet-select" data-action-character></select></label><button class="pet-btn pet-btnOutline" type="button" data-new-preset>\u65B0\u5EFA\u52A8\u4F5C\u9884\u8BBE</button></div>
    <p class="pet-conflict" data-keyword-conflict></p>
    <div class="pet-actionsPane"><iframe class="pet-actionsPortrait" title="\u52A8\u4F5C\u7ACB\u7ED8\u9884\u89C8" src="about:blank"></iframe><div class="pet-cards" data-action-keywords></div></div></div>`;
  const select = root.querySelector("select"), list = root.querySelector("[data-action-keywords]"), newPreset = root.querySelector("[data-new-preset]"), conflict = root.querySelector("[data-keyword-conflict]"), portrait = root.querySelector("iframe"), channel = new BroadcastChannel("dsh-pet-action-debug");
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
  const card = () => {
    const element = document.createElement("div");
    element.className = "pet-card";
    return element;
  };
  const button = (text, fn, variant = "pet-btnSm pet-btnOutline") => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `pet-btn ${variant}`;
    element.textContent = text;
    element.onclick = fn;
    return element;
  };
  const input = (value, change) => {
    const element = document.createElement("input");
    element.className = "pet-input";
    element.value = value;
    element.oninput = () => {
      change(element.value);
    };
    return element;
  };
  const options = (items, value, change) => {
    const element = document.createElement("select");
    element.className = "pet-select";
    for (const [id, text] of items) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = text;
      element.append(option);
    }
    element.value = value;
    element.onchange = () => {
      stop();
      change(element.value);
    };
    return element;
  };
  const header = (title, trailing) => {
    const element = document.createElement("div");
    element.className = "pet-cardHead";
    const name2 = document.createElement("span");
    name2.className = "pet-cardTitle";
    name2.textContent = title;
    if (trailing) element.append(name2, trailing);
    else element.append(name2);
    return element;
  };
  const previewControls = (target, model, selection, weight, update) => {
    const slider = document.createElement("input"), number = document.createElement("input");
    slider.type = "range";
    number.type = "number";
    for (const element of [slider, number]) {
      element.min = "0";
      element.max = "100";
      element.step = "1";
      element.value = String(Math.round(weight * 100));
      element.disabled = model.kind !== "dragonbones";
      element.onblur = stop;
    }
    slider.className = "pet-range";
    number.className = "pet-input";
    slider.dataset.weight = "";
    number.dataset.weightNumber = "";
    slider.setAttribute("aria-label", "\u52A8\u4F5C\u6743\u91CD");
    number.setAttribute("aria-label", "\u6743\u91CD\u767E\u5206\u6BD4");
    const value = () => Number(slider.value) / 100;
    const change = (source, other) => {
      const next = Number(source.value);
      if (!Number.isFinite(next) || next < 0 || next > 100) {
        status("\u6743\u91CD\u987B\u4E3A 0\u2013100%\u3002");
        return;
      }
      other.value = source.value;
      update(next / 100);
      if (!held) begin({ ...selection(), weight: next / 100 });
      else {
        held.selection.weight = next / 100;
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
    const row = document.createElement("div");
    row.className = "pet-weight";
    row.append(slider, number, preview);
    const wrapper = document.createElement("div");
    wrapper.className = "pet-field pet-fieldWide";
    const label = document.createElement("span");
    label.className = "pet-label";
    label.textContent = model.kind === "dragonbones" ? "\u52A8\u4F5C\u6743\u91CD %" : "\u5F53\u524D\u5F15\u64CE\u4FDD\u7559\u5B8C\u6574\u52A8\u4F5C\uFF08100%\uFF09";
    wrapper.append(label, row);
    target.append(wrapper);
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
      const entries = draft[id];
      const check = () => {
        const seen = /* @__PURE__ */ new Set(), duplicates = /* @__PURE__ */ new Set();
        for (const preset of entries.filter((p2) => p2.enabled)) for (const tag of p.keywords) {
          const key = tag.toLocaleLowerCase();
          if (seen.has(key)) duplicates.add(tag);
          seen.add(key);
        }
        conflict.textContent = duplicates.size ? "\u91CD\u590D\u5173\u952E\u8BCD\u6309\u5217\u8868\u987A\u5E8F\u5339\u914D\uFF1A" + [...duplicates].join("\u3001") : "";
      };
      newPreset.disabled = !modules.length;
      newPreset.onclick = () => {
        if (modules.length) {
          entries.push({ id: crypto.randomUUID(), name: "\u65B0\u52A8\u4F5C\u9884\u8BBE", actionId: modules[0].id, weight: 1, enabled: true, keywords: [] });
          void render();
        }
      };
      for (const [index, preset] of entries.entries()) {
        const element = card();
        element.dataset.presetId = preset.id;
        const fold = button("\u6536\u8D77\u8BBE\u7F6E", () => {
          const collapsed = fold.dataset.collapsed === "1";
          for (const child of [...element.children].slice(1)) child.hidden = !collapsed;
          fold.dataset.collapsed = collapsed ? "0" : "1";
          fold.textContent = collapsed ? "\u6536\u8D77\u8BBE\u7F6E" : "\u5C55\u5F00\u8BBE\u7F6E";
        });
        element.append(header(preset.name, fold));
        const name2 = input(preset.name, (value) => {
          preset.name = value;
          element.querySelector(".pet-cardTitle").textContent = value;
        });
        name2.dataset.presetName = "";
        const choices = modules.map((a) => [a.id, a.label]);
        if (!modules.some((a) => a.id === preset.actionId)) choices.push([preset.actionId, "\u52A8\u4F5C\u5DF2\u4E0D\u53EF\u7528\uFF1A" + preset.actionId]);
        const source = options(choices, preset.actionId, (value) => {
          preset.actionId = value;
          void render();
        });
        source.dataset.presetSource = "";
        const enabled = switchRow("\u542F\u7528\u5173\u952E\u8BCD\u89E6\u53D1", preset.enabled);
        enabled.button.dataset.presetEnabled = "";
        enabled.button.onclick = () => {
          preset.enabled = enabled.button.getAttribute("aria-checked") !== "true";
          enabled.button.setAttribute("aria-checked", String(preset.enabled));
          check();
        };
        const grid = document.createElement("div");
        grid.className = "pet-grid";
        grid.append(field("\u9884\u8BBE\u540D\u79F0", name2), field("\u539F\u59CB\u52A8\u4F5C", source), enabled.row);
        element.append(grid);
        previewControls(element, model, () => modules.find((a) => a.id === preset.actionId) ?? {}, preset.weight, (value) => {
          preset.weight = value;
        });
        const tags = document.createElement("textarea");
        tags.className = "pet-textarea";
        tags.dataset.actionId = preset.actionId;
        tags.value = preset.keywords.join("\n");
        tags.placeholder = "\u6BCF\u884C\u4E00\u4E2A\u5173\u952E\u8BCD";
        tags.oninput = () => {
          preset.keywords = [...new Set(tags.value.split("\n").map((t) => t.trim()).filter(Boolean))];
          check();
        };
        element.append(field("\u5173\u952E\u8BCD", tags, true));
        const actions = document.createElement("div");
        actions.className = "pet-cardActions";
        actions.append(
          button("\u590D\u5236\u9884\u8BBE", () => {
            entries.splice(index + 1, 0, { ...structuredClone(preset), id: crypto.randomUUID(), name: preset.name + " \u526F\u672C" });
            void render();
          }),
          button("\u4E0A\u79FB", () => {
            if (index) {
              [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]];
              void render();
            }
          }),
          button("\u5220\u9664\u9884\u8BBE", () => {
            entries.splice(index, 1);
            void render();
          }, "pet-btnSm pet-btnOutline pet-btnDanger")
        );
        element.append(actions);
        list.append(element);
      }
      check();
      if (model.kind === "dragonbones" && recipes[id]) {
        const heading = document.createElement("h3");
        heading.className = "pet-actionsHeading pet-fieldWide";
        heading.textContent = "\u53D1\u97F3\u5634\u578B\u914D\u65B9";
        list.append(heading);
        const help = document.createElement("p");
        help.className = "pet-actionsHelp pet-fieldWide";
        help.textContent = "e/w/y \u7B49\u53D1\u97F3\u6807\u7B7E\u53EF\u590D\u7528 a/o/i/m \u7684\u4E0D\u540C\u6743\u91CD\uFF0C\u81EA\u52A8\u8BF4\u8BDD\u6309\u62FC\u97F3\u5B57\u7B26\u5339\u914D\u3002\u672A\u914D\u7F6E\u5B57\u7B26\u6CBF\u7528\u57FA\u7840\u5634\u578B\u3002\u6269\u5C55\u9ED8\u8BA4\u503C\u662F\u53EF\u8C03\u6574\u7684\u8FD1\u4F3C\u6548\u679C\uFF0C\u4E0D\u662F\u65B0\u5236\u4F5C\u7684\u7D20\u6750\u3002";
        list.append(help);
        const add = document.createElement("div");
        add.className = "pet-cardActions pet-fieldWide";
        add.append(button("\u65B0\u589E\u53D1\u97F3\u914D\u65B9", () => {
          const unused = mouthPhonemes.find((c) => !recipes[id].some((r) => r.phoneme === c));
          if (unused) {
            recipes[id].push({ phoneme: unused, base: "i", weight: 0.5 });
            void render();
          } else status("\u5F53\u524D\u652F\u6301\u7684\u53D1\u97F3\u5339\u914D\u9879\u5747\u5DF2\u914D\u7F6E\u3002");
        }));
        list.append(add);
        for (const [index, recipe] of recipes[id].entries()) {
          const element = card();
          element.dataset.phoneme = recipe.phoneme;
          const grid = document.createElement("div");
          grid.className = "pet-grid";
          const phoneme = options(mouthPhonemes.filter((p2) => p2 === recipe.phoneme || !recipes[id].some((r) => r.phoneme === p2)).map((p2) => [p2, p2]), recipe.phoneme, (value) => {
            recipe.phoneme = value;
            void render();
          });
          phoneme.disabled = ["a", "o", "i", "m"].includes(recipe.phoneme);
          const base = options(["a", "o", "i", "m"].map((s) => [s, s]), recipe.base, (value) => {
            recipe.base = value;
          });
          grid.append(field("\u53D1\u97F3\u5339\u914D\u7B26\u53F7", phoneme), field("\u57FA\u7840\u5634\u578B", base));
          element.append(header("\u53D1\u97F3\u914D\u65B9 \xB7 " + recipe.phoneme), grid);
          previewControls(element, model, () => ({ animation: "__speech_" + recipe.base }), recipe.weight, (value) => {
            recipe.weight = value;
          });
          if (!["a", "o", "i", "m"].includes(recipe.phoneme)) {
            const actions = document.createElement("div");
            actions.className = "pet-cardActions";
            actions.append(button("\u5220\u9664\u914D\u65B9", () => {
              recipes[id].splice(index, 1);
              void render();
            }, "pet-btnSm pet-btnOutline pet-btnDanger"));
            element.append(actions);
          }
          list.append(element);
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
function field2(text, input, wide = false) {
  const wrapper = document.createElement("label");
  wrapper.className = wide ? "pet-field pet-fieldWide" : "pet-field";
  const label = document.createElement("span");
  label.className = "pet-label";
  label.textContent = text;
  wrapper.append(label, input);
  return wrapper;
}
function mountIntimacySettings(root) {
  root.innerHTML = `<div class="pet-section">
    <div class="pet-hintBlock"><p class="pet-hint" data-intimacy-status role="status">\u6B63\u5728\u8BFB\u53D6\u2026</p><p class="pet-hint">\u6BCF\u5B8C\u6210\u4E00\u8F6E\u7528\u6237\u6D88\u606F\u4E0E AI \u56DE\u590D\u52A0 1 \u5206\uFF1B\u5931\u8D25\u3001\u4E2D\u65AD\u548C\u6D4B\u8BD5\u8FDE\u63A5\u4E0D\u8BA1\u5206\u3002\u65B0\u5EFA\u5BF9\u8BDD\u4ECE 0 \u5F00\u59CB\uFF0C\u5DF2\u6709\u5386\u53F2\u4E0D\u8865\u7B97\u3002</p><p class="pet-hint">\u81EA\u7531\u586B\u5199\u6BCF\u7EA7\u7684\u8D77\u59CB\u5206\u6570\u3001\u7ED3\u675F\u5206\u6570\u4E0E\u7B49\u7EA7\u540D\u79F0\uFF0C\u4E24\u7AEF\u5206\u6570\u90FD\u5305\u542B\u5728\u5185\u3002\u533A\u95F4\u4ECE 0 \u5F00\u59CB\u8FDE\u7EED\u6392\u5217\uFF0C\u4E0D\u53EF\u91CD\u53E0\uFF1B\u6700\u540E\u4E00\u7EA7\u7ED3\u675F\u5206\u6570\u7559\u7A7A\u8868\u793A\u65E0\u4E0A\u9650\u3002\u5728\u60C5\u7EEA\u6A21\u62DF Prompt \u4E2D\u63D2\u5165 {{\u4EB2\u5BC6\u60C5\u51B5}} \u540E\u751F\u6548\u3002</p></div>
    <div class="pet-cards" data-intimacy-levels></div>
    <div class="pet-cardActions"><button class="pet-btn pet-btnOutline" type="button" data-add-level>\u6DFB\u52A0\u7B49\u7EA7</button></div></div>`;
  const list = root.querySelector("[data-intimacy-levels]");
  const rows = () => [...list.children];
  const add = (level) => {
    const card = document.createElement("div");
    card.className = "pet-card";
    const title = document.createElement("div");
    title.className = "pet-cardHead";
    const name2 = document.createElement("span");
    name2.className = "pet-cardTitle";
    name2.textContent = level.name;
    title.append(name2);
    const nameInput = document.createElement("input");
    nameInput.className = "pet-input";
    nameInput.dataset.levelName = "";
    const min = document.createElement("input");
    min.className = "pet-input";
    min.dataset.min = "";
    min.type = "number";
    min.min = "0";
    min.step = "1";
    const max = document.createElement("input");
    max.className = "pet-input";
    max.dataset.max = "";
    max.type = "number";
    max.min = "0";
    max.step = "1";
    max.placeholder = "\u7559\u7A7A\u5373\u65E0\u4E0A\u9650";
    const description = document.createElement("textarea");
    description.className = "pet-textarea";
    description.dataset.levelDescription = "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "pet-btn pet-btnSm pet-btnOutline pet-btnDanger";
    remove.dataset.removeLevel = "";
    remove.textContent = "\u5220\u9664\u7B49\u7EA7";
    nameInput.value = level.name;
    min.value = level.min;
    description.value = level.description;
    max.value = level.max ?? "";
    nameInput.oninput = () => {
      name2.textContent = nameInput.value;
    };
    remove.onclick = (e) => {
      e.preventDefault();
      card.remove();
    };
    const grid = document.createElement("div");
    grid.className = "pet-grid";
    grid.append(field2("\u7B49\u7EA7\u540D\u79F0", nameInput, true), field2("\u8D77\u59CB\u5206\u6570", min), field2("\u7ED3\u675F\u5206\u6570", max), field2("\u4EB2\u5BC6\u60C5\u51B5\u63CF\u8FF0", description, true));
    const actions = document.createElement("div");
    actions.className = "pet-cardActions";
    actions.append(remove);
    card.append(title, grid, actions);
    list.append(card);
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
      return validateIntimacyLevels(rows().map((card) => ({ min: card.querySelector("[data-min]").value === "" ? NaN : Number(card.querySelector("[data-min]").value), max: card.querySelector("[data-max]").value === "" ? null : Number(card.querySelector("[data-max]").value), name: card.querySelector("[data-level-name]").value, description: card.querySelector("[data-level-description]").value })));
    }
  };
}

// src/conversation-settings.mjs
function field3(text, control2, options = {}) {
  const wrapper = document.createElement(options.plain ? "div" : "label");
  wrapper.className = options.wide ? "pet-field pet-fieldWide" : "pet-field";
  const label = document.createElement("span");
  label.className = "pet-label";
  label.textContent = text;
  wrapper.append(label, control2);
  if (options.hint) {
    const hint = document.createElement("span");
    hint.className = "pet-hint";
    hint.textContent = options.hint;
    wrapper.append(hint);
  }
  return wrapper;
}
function control(tag, { class: extra, ...attributes } = {}) {
  const element = document.createElement(tag);
  for (const [name2, value] of Object.entries(attributes)) {
    if (value === true) element.setAttribute(name2, "");
    else element.setAttribute(name2, value);
  }
  const base = tag === "textarea" ? "pet-textarea" : tag === "select" ? "pet-select" : "pet-input";
  element.className = extra ? `${base} ${extra}` : base;
  return element;
}
function textElement(text, className = "pet-hint") {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}
function switchRow2(text, key) {
  const row = document.createElement("div");
  row.className = "pet-switchRow";
  const label = document.createElement("span");
  label.className = "pet-label";
  label.textContent = text;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pet-switch";
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", "false");
  button.dataset.switch = key;
  const thumb = document.createElement("span");
  thumb.className = "pet-thumb";
  button.append(thumb);
  row.append(label, button);
  return row;
}
function keyRow(key) {
  const input = control("input", { type: "password", autocomplete: "off" });
  input.dataset.key = key;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "pet-btn pet-btnSm pet-btnOutline";
  clear.dataset.clear = key;
  clear.textContent = "\u6E05\u9664";
  const row = document.createElement("span");
  row.className = "pet-keyrow";
  row.append(input, clear);
  return row;
}
function mountConversationSettings(root, status, showPet) {
  root.innerHTML = `<div class="pet-section" data-page="conversation"><p class="pet-hint">\u684C\u5BA0\u5BF9\u8BDD\u548C\u60C5\u7EEA\u6A21\u62DF\u5171\u7528\u8FD9\u91CC\u7684\u72EC\u7ACB\u6A21\u578B\u914D\u7F6E\uFF0C\u4E0D\u5F71\u54CD Harness \u4E3B\u5BF9\u8BDD\u3002</p><div class="pet-grid" data-conversation-fields></div></div>
    <div class="pet-section" data-page="prompts" hidden><div class="pet-grid" data-prompt-fields></div></div>
    <div class="pet-section" data-page="actions" hidden></div>
    <div class="pet-section" data-page="voice" hidden><div class="pet-grid" data-voice-fields></div></div>`;
  const conversation = root.querySelector("[data-conversation-fields]");
  const baseUrl = control("input");
  baseUrl.dataset.field = "baseUrl";
  const endpoint = control("input", { placeholder: "ep-\u2026" });
  endpoint.dataset.field = "model";
  const testButton = document.createElement("button");
  testButton.type = "button";
  testButton.className = "pet-btn pet-btnOutline";
  testButton.dataset.test = "";
  testButton.textContent = "\u6D4B\u8BD5\u5BF9\u8BDD\u8FDE\u63A5";
  conversation.append(field3("\u65B9\u821F API Key", keyRow("llm"), { hint: "\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8\uFF1B\u70B9\u6E05\u9664\u540E\u4FDD\u5B58\u5373\u5220\u9664\u3002" }), field3("Base URL", baseUrl), field3("\u6A21\u578B\u63A5\u5165\u70B9", endpoint), field3("\u8FDE\u63A5\u6D4B\u8BD5", testButton, { plain: true }));
  const prompts = root.querySelector("[data-prompt-fields]");
  const prompt = control("textarea", { "data-field": "prompt", class: "pet-textareaPrompt" });
  const emotionPrompt = control("textarea", { "data-field": "emotionPrompt", class: "pet-textareaEmotion" });
  const insertEmotion = document.createElement("button");
  insertEmotion.type = "button";
  insertEmotion.className = "pet-btn pet-btnSm pet-btnOutline";
  insertEmotion.dataset.insertEmotion = "";
  insertEmotion.textContent = "\u63D2\u5165 {{\u60C5\u7EEA\u6A21\u62DF}}";
  const promptActions = document.createElement("div");
  promptActions.className = "pet-cardActions";
  promptActions.append(insertEmotion);
  const promptField = field3("\u5BF9\u8BDD Prompt", prompt, { wide: true });
  promptField.append(promptActions, textElement("\u5728\u9700\u8981\u7684\u4F4D\u7F6E\u5199\u5165 {{\u60C5\u7EEA\u6A21\u62DF}}\uFF0C\u56DE\u590D\u65F6\u66FF\u6362\u4E3A\u6700\u65B0\u5DF2\u5B8C\u6210\u7684\u60C5\u7EEA\u6587\u672C\u3002\u65E7 Prompt \u539F\u6837\u4FDD\u7559\uFF1B\u672A\u586B\u5199\u53D8\u91CF\u65F6\u4E0D\u4F1A\u81EA\u52A8\u6CE8\u5165\u3002"));
  const insertHistory = document.createElement("button");
  insertHistory.type = "button";
  insertHistory.className = "pet-btn pet-btnSm pet-btnOutline";
  insertHistory.dataset.insertHistory = "";
  insertHistory.textContent = "\u63D2\u5165 {{\u804A\u5929\u8BB0\u5F55}}";
  const emotionActions = document.createElement("div");
  emotionActions.className = "pet-cardActions";
  emotionActions.dataset.promptActions = "";
  emotionActions.append(insertHistory);
  const emotionField = field3("\u60C5\u7EEA\u6A21\u62DF Prompt", emotionPrompt, { wide: true });
  emotionField.append(emotionActions, textElement("{{\u804A\u5929\u8BB0\u5F55}} \u6309\u65F6\u95F4\u987A\u5E8F\u5305\u542B\u53CC\u65B9\u6D88\u606F\uFF0C8 \u6761\u5C31\u662F\u53CC\u65B9\u6D88\u606F\u5408\u8BA1 8 \u6761\u3002\u672A\u586B\u5199\u53D8\u91CF\u65F6\u4E0D\u4F1A\u6CE8\u5165\u804A\u5929\u8BB0\u5F55\u3002"));
  const characterName = control("input");
  characterName.dataset.field = "emotionCharacterName";
  const historyMessages = control("input", { type: "number", min: "1", max: "100" });
  historyMessages.dataset.field = "emotionHistoryMessages";
  const emotionHeading = document.createElement("h3");
  emotionHeading.className = "pet-sectionTitle pet-fieldWide";
  emotionHeading.textContent = "\u5F53\u524D\u60C5\u7EEA";
  const emotionStatus = document.createElement("p");
  emotionStatus.className = "pet-hint pet-fieldWide";
  emotionStatus.dataset.emotionStatus = "";
  emotionStatus.setAttribute("role", "status");
  const emotionText = document.createElement("div");
  emotionText.className = "pet-emotionText pet-fieldWide";
  emotionText.dataset.emotionText = "";
  prompts.append(
    promptField,
    emotionField,
    field3("\u804A\u5929\u8BB0\u5F55\u4E2D\u7684\u89D2\u8272\u79F0\u547C", characterName),
    field3("\u60C5\u7EEA\u53C2\u8003\u6700\u8FD1\u51E0\u6761\u6D88\u606F", historyMessages),
    textElement("\u9996\u6B21\u65E0\u8BB0\u5F55\u65F6\u5148\u6839\u636E\u7528\u6237\u6D88\u606F\u751F\u6210\u60C5\u7EEA\uFF1B\u4E4B\u540E\u6BCF\u6B21\u56DE\u590D\u5B8C\u6210\u5728\u540E\u53F0\u66F4\u65B0\uFF0C\u4F9B\u4E0B\u4E00\u8F6E\u4F7F\u7528\u3002\u60C5\u7EEA\u6587\u672C\u4E0D\u8FDB\u5165\u804A\u5929\u8BB0\u5F55\uFF0C\u4E5F\u4E0D\u6717\u8BFB\u3002"),
    emotionHeading,
    emotionStatus,
    emotionText
  );
  const voice = root.querySelector("[data-voice-fields]");
  const voiceKind = control("select", { "data-field": "voiceKind" });
  for (const [value, text] of [["default", "\u9ED8\u8BA4\u97F3\u8272"], ["clone", "\u514B\u9686\u97F3\u8272"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    voiceKind.append(option);
  }
  const defaultVoice = control("select");
  defaultVoice.dataset.defaultVoice = "";
  for (const [value, text] of [["zh_female_gaolengyujie_uranus_bigtts", "\u9AD8\u51B7\u5FA1\u59D0"], ["custom", "\u5176\u4ED6\u5B98\u65B9\u97F3\u8272"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    defaultVoice.append(option);
  }
  const speaker = control("input", { placeholder: "\u5B98\u65B9 speaker \u6216 S_\u2026" });
  speaker.dataset.field = "speaker";
  const voiceName = control("input");
  voiceName.dataset.field = "voiceName";
  const speechRate = control("input", { type: "number", min: "-50", max: "100" });
  speechRate.dataset.field = "speechRate";
  const asrResource = control("select", { "data-field": "asrResource" });
  for (const [value, text] of [["volc.seedasr.sauc.duration", "\u8C46\u5305 2.0 \xB7 \u5C0F\u65F6\u7248"], ["volc.seedasr.sauc.concurrent", "\u8C46\u5305 2.0 \xB7 \u5E76\u53D1\u7248"], ["volc.bigasr.sauc.duration", "\u8C46\u5305 1.0 \xB7 \u5C0F\u65F6\u7248"], ["volc.bigasr.sauc.concurrent", "\u8C46\u5305 1.0 \xB7 \u5E76\u53D1\u7248"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    asrResource.append(option);
  }
  const sampleButton = document.createElement("button");
  sampleButton.type = "button";
  sampleButton.className = "pet-btn pet-btnPrimary";
  sampleButton.dataset.sample = "";
  sampleButton.textContent = "\u4FDD\u5B58\u5E76\u8BD5\u542C\u97F3\u8272";
  voice.append(
    field3("TTS API Key", keyRow("tts"), { hint: "\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8\uFF1B\u70B9\u6E05\u9664\u540E\u4FDD\u5B58\u5373\u5220\u9664\u3002" }),
    field3("ASR API Key", keyRow("asr")),
    field3("\u97F3\u8272\u7C7B\u578B", voiceKind),
    field3("\u9ED8\u8BA4\u97F3\u8272", defaultVoice),
    field3("\u97F3\u8272 ID", speaker),
    field3("\u97F3\u8272\u540D\u79F0", voiceName),
    field3("\u8BED\u901F", speechRate),
    field3("ASR \u8D44\u6E90", asrResource),
    field3("\u8BD5\u542C", sampleButton, { plain: true })
  );
  const voicePage = root.querySelector('[data-page="voice"]');
  const voiceStatus = document.createElement("p");
  voiceStatus.className = "pet-hint";
  voiceStatus.setAttribute("role", "status");
  const ttsControl = switchRow2("\u81EA\u52A8\u6717\u8BFB\u56DE\u590D", "ttsEnabled");
  voicePage.append(textElement("\u8BC6\u522B\u6D4B\u8BD5\uFF1A\u6253\u5F00\u804A\u5929\uFF0C\u70B9\u51FB\u5F55\u97F3\uFF0C\u7ED3\u675F\u540E\u68C0\u67E5\u8F6C\u5199\u6587\u5B57\u3002"));
  voicePage.prepend(voiceStatus, ttsControl, textElement("\u5173\u95ED\u540E\u7ACB\u5373\u505C\u6B62\u6717\u8BFB\uFF1B\u5F00\u542F\u540E\u4ECE\u4E0B\u4E00\u6B21\u56DE\u590D\u81EA\u52A8\u53D1\u58F0\u3002"));
  let stored, disposed = false, generation = 0, events;
  const cleared = /* @__PURE__ */ new Set();
  const intimacyRoot = document.createElement("div");
  intimacyRoot.dataset.page = "intimacy";
  intimacyRoot.hidden = true;
  root.append(intimacyRoot);
  const intimacy = mountIntimacySettings(intimacyRoot);
  const insertIntimacy = document.createElement("button");
  insertIntimacy.type = "button";
  insertIntimacy.className = "pet-btn pet-btnSm pet-btnOutline";
  insertIntimacy.textContent = "\u63D2\u5165 {{\u4EB2\u5BC6\u60C5\u51B5}}";
  insertIntimacy.dataset.insertIntimacy = "";
  root.querySelector("[data-prompt-actions]").prepend(insertIntimacy);
  const insertInto = (input, text) => {
    input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
    input.focus();
  };
  insertIntimacy.onclick = (e) => {
    e.preventDefault();
    insertInto(fieldOf("emotionPrompt"), "{{\u4EB2\u5BC6\u60C5\u51B5}}");
  };
  const keywords = mountActionPresetSettings(root.querySelector('[data-page="actions"]'), status);
  const showEmotion = (value) => {
    root.querySelector("[data-emotion-text]").textContent = value?.text || "\u5C1A\u672A\u751F\u6210\u60C5\u7EEA\u3002";
    root.querySelector("[data-emotion-status]").textContent = value?.generating ? "\u6B63\u5728\u751F\u6210\u4E0B\u4E00\u8F6E\u7684\u60C5\u7EEA\uFF0C\u671F\u95F4\u6CBF\u7528\u4E0A\u4E00\u4EFD\u3002" : value?.error || (value?.updatedAt ? "\u66F4\u65B0\u4E8E " + new Date(value.updatedAt).toLocaleString() : "");
  };
  const renderVoiceStatus = (enabled) => {
    voiceStatus.textContent = enabled ? "\u81EA\u52A8\u6717\u8BFB\u5DF2\u5F00\u542F\uFF1A\u4FDD\u5B58\u7684\u65B0\u97F3\u8272\u7528\u4E8E\u4E0B\u4E00\u8F6E\u56DE\u590D\u3002" : "\u81EA\u52A8\u6717\u8BFB\u5DF2\u5173\u95ED\uFF1A\u804A\u5929\u53EA\u663E\u793A\u6587\u5B57\uFF1B\u5982\u9700\u53D1\u58F0\uFF0C\u8BF7\u5F00\u542F\u81EA\u52A8\u6717\u8BFB\u5F00\u5173\u3002";
  };
  const fieldOf = (key) => root.querySelector(`[data-field="${key}"]`);
  const ttsSwitch = root.querySelector('[data-switch="ttsEnabled"]');
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
    for (const control2 of root.querySelectorAll("input,textarea,select,button")) control2.disabled = true;
    let result;
    try {
      result = await conversationApi("/config");
      if (!disposed && token === generation) await keywords.load(result.config);
    } finally {
      if (!disposed && token === generation) {
        for (const control2 of root.querySelectorAll("input,textarea,select,button")) if (!control2.closest('[data-page="actions"]')) control2.disabled = false;
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
    ttsSwitch.setAttribute("aria-checked", String(stored.ttsEnabled === true));
    for (const control2 of root.querySelectorAll("[data-field]")) {
      const value = stored[control2.dataset.field];
      if (control2.type === "checkbox") control2.checked = value;
      else control2.value = value;
    }
    defaultVoice.parentElement.hidden = stored.voiceKind === "clone";
    for (const control2 of root.querySelectorAll("[data-key]")) {
      control2.value = "";
      control2.placeholder = result.configured[control2.dataset.key] ? "\u5DF2\u4FDD\u5B58\uFF0C\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8" : "\u5C1A\u672A\u914D\u7F6E";
    }
  };
  root.querySelector("[data-insert-emotion]").onclick = (e) => {
    e.preventDefault();
    insertInto(fieldOf("prompt"), "{{\u60C5\u7EEA\u6A21\u62DF}}");
  };
  root.querySelector("[data-insert-history]").onclick = (e) => {
    e.preventDefault();
    insertInto(fieldOf("emotionPrompt"), "{{\u804A\u5929\u8BB0\u5F55}}");
  };
  for (const button of root.querySelectorAll("[data-clear]")) button.onclick = (e) => {
    e.preventDefault();
    cleared.add(button.dataset.clear);
    const input = root.querySelector(`[data-key="${button.dataset.clear}"]`);
    input.value = "";
    input.placeholder = "\u4FDD\u5B58\u540E\u6E05\u9664";
  };
  defaultVoice.onchange = (e) => {
    if (e.target.value !== "custom") {
      fieldOf("speaker").value = e.target.value;
      fieldOf("voiceName").value = "\u9AD8\u51B7\u5FA1\u59D0";
    }
  };
  voiceKind.onchange = () => {
    defaultVoice.parentElement.hidden = voiceKind.value === "clone";
    if (voiceKind.value === "default") {
      fieldOf("speaker").value = "zh_female_gaolengyujie_uranus_bigtts";
      fieldOf("voiceName").value = "\u9AD8\u51B7\u5FA1\u59D0";
    } else {
      fieldOf("speaker").value = stored.voiceKind === "clone" ? stored.speaker : "";
      fieldOf("voiceName").value = stored.voiceKind === "clone" ? stored.voiceName : "\u6211\u7684\u514B\u9686\u97F3\u8272";
    }
  };
  speaker.oninput = () => {
    const id = speaker.value.trim();
    if (!id) return;
    voiceKind.value = id.startsWith("S_") ? "clone" : "default";
    defaultVoice.parentElement.hidden = voiceKind.value === "clone";
    defaultVoice.value = id === "zh_female_gaolengyujie_uranus_bigtts" ? id : "custom";
    status("\u97F3\u8272\u7C7B\u578B\u5DF2\u6309 ID \u5339\u914D\uFF0C\u8BF7\u4FDD\u5B58\uFF1B\u65B0\u97F3\u8272\u4ECE\u4E0B\u4E00\u8F6E\u56DE\u590D\u751F\u6548\u3002");
  };
  ttsSwitch.onclick = guarded(async () => {
    const enabled = ttsSwitch.getAttribute("aria-checked") !== "true";
    ttsSwitch.setAttribute("aria-checked", String(enabled));
    const current = await conversationApi("/config");
    await conversationApi("/config", { config: { ...current.config, ttsEnabled: enabled } });
    stored.ttsEnabled = enabled;
    renderVoiceStatus(enabled);
    status(enabled ? "\u5DF2\u5F00\u542F\u81EA\u52A8\u6717\u8BFB\uFF0C\u4ECE\u4E0B\u4E00\u6B21\u56DE\u590D\u751F\u6548\u3002" : "\u5DF2\u5173\u95ED\u81EA\u52A8\u6717\u8BFB\u3002");
  });
  testButton.onclick = guarded(async () => {
    status("\u6B63\u5728\u6D4B\u8BD5\u5DF2\u4FDD\u5B58\u914D\u7F6E\u2026");
    const result = await conversationApi("/test", {});
    if (!disposed) status(`\u8FDE\u63A5\u6B63\u5E38\uFF1A${result.text}`);
  });
  const save = async () => {
    if (!stored) throw new Error("\u8BBE\u7F6E\u5C1A\u672A\u52A0\u8F7D");
    const config = { ...stored, ...keywords.value(), intimacyLevels: intimacy.value() }, keys = {};
    for (const control2 of root.querySelectorAll("[data-field]")) config[control2.dataset.field] = control2.type === "checkbox" ? control2.checked : control2.type === "number" ? Number(control2.value) : control2.value;
    for (const control2 of root.querySelectorAll("[data-switch]")) config[control2.dataset.switch] = control2.getAttribute("aria-checked") === "true";
    for (const control2 of root.querySelectorAll("[data-key]")) {
      if (control2.value.trim()) keys[control2.dataset.key] = control2.value.trim();
      else if (cleared.has(control2.dataset.key)) keys[control2.dataset.key] = null;
    }
    await conversationApi("/config", { config, keys });
    await load(true);
    status("\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002");
  };
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
      for (const control2 of root.querySelectorAll("[data-key]")) control2.value = "";
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
function mountActionDebug(container, { api: api2, status, animated }) {
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
        const info = await api2(`model?id=${encodeURIComponent(modelId)}`);
        if (token !== revision) return;
        const title = document.createElement("summary");
        title.textContent = "\u52A8\u4F5C\u8C03\u8BD5 \xB7 \u6309\u4F4F\u9884\u89C8\uFF0C\u677E\u5F00\u6062\u590D";
        const details = document.createElement("details");
        details.className = "pet-debug";
        details.append(title);
        container.append(details);
        const items = info.actionModules;
        const buttons = document.createElement("div");
        buttons.className = "pet-debugGroup";
        details.append(buttons);
        details.addEventListener("toggle", () => {
          if (!details.open) stop();
        });
        for (const category of ["body", "mouth"]) {
          const group = items.filter((item) => item.category === category);
          if (!group.length) continue;
          const label = document.createElement("strong");
          label.textContent = category === "mouth" ? "\u5634\u578B\u52A8\u4F5C" : "\u80A2\u4F53\u52A8\u4F5C";
          buttons.append(label);
          for (const item of group) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "pet-btn pet-btnSm pet-btnOutline";
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
        if (!items.length) {
          buttons.className = "pet-empty";
          buttons.textContent = "\u6B64\u89D2\u8272\u6CA1\u6709\u5185\u7F6E\u52A8\u4F5C\u3002";
        }
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

// src/panel-style.mjs
var PANEL_STYLE = `
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
`;

// src/selection-speak.mjs
var SELECTION_OWNER = "selection";
var CONVERSATION_SLOTS = ["conversation.view", "conversation.session", "conversation.content"];
var COMPOSER_SLOTS = ["conversation.composer", "conversation.input"];
var MAX_SELECTION = 5e3;
var ERROR_MS = 4e3;
var SELECTION_SPEAK_STYLE = `
.dsh-pet-speakpill{display:inline-flex;align-items:center;height:30px;padding:0 12px;border:0;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1;white-space:nowrap;cursor:pointer;box-shadow:var(--dsw-elevation-soft)}
/* The pill sets its own display, which would otherwise beat the hidden attribute's display:none. */
.dsh-pet-speakpill[hidden]{display:none}
.dsh-pet-speakpill:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
.dsh-pet-speakpill:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-label-primary) 45%,transparent);outline-offset:2px}
.dsh-pet-speakpill[data-playing="true"]{color:var(--dsw-alias-state-business-primary)}
.dsh-pet-speakpill[data-error="true"]{color:var(--dsw-alias-state-error-primary)}
.dsh-pet-speakpill-float{position:fixed;z-index:81}
`;
var ERROR_CHARS = 28;
var shorten = (message) => message.length > ERROR_CHARS ? `${message.slice(0, ERROR_CHARS)}\u2026` : message;
function insideComposer(node) {
  let element = node?.nodeType === 1 ? node : node?.parentElement;
  while (element) {
    if (element.hasAttribute?.("data-composer-input")) return true;
    const slot = element.getAttribute?.("data-slot");
    if (slot && COMPOSER_SLOTS.some((prefix) => slot === prefix || slot.startsWith(`${prefix}.`))) return true;
    element = element.parentElement;
  }
  return false;
}
function insideConversation(node) {
  let element = node?.nodeType === 1 ? node : node?.parentElement;
  while (element) {
    const slot = element.getAttribute?.("data-slot");
    if (slot && CONVERSATION_SLOTS.includes(slot)) return true;
    element = element.parentElement;
  }
  return false;
}
function conversationSelection() {
  const selection = typeof window === "undefined" ? null : window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (insideComposer(range.startContainer) || insideComposer(range.endContainer)) return null;
  if (!insideConversation(range.startContainer) || !insideConversation(range.endContainer)) return null;
  const text = selection.toString().replace(/\s+/gu, " ").trim();
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return null;
  if (text.length > MAX_SELECTION) return null;
  return { text, rect: range.getBoundingClientRect() };
}
function createSelectionSpeak({ api: api2, readout, React }) {
  const start = (text) => api2("selection/speak", { text });
  const stop = () => api2("conversation/stop", { speechOnly: true });
  const speaking = () => readout.has(SELECTION_OWNER);
  const label = () => speaking() ? "\u505C\u6B62" : "\u6717\u8BFB";
  const hint = () => speaking() ? "\u505C\u6B62\u6717\u8BFB" : "\u7528\u684C\u5BA0\u7684\u58F0\u97F3\u6717\u8BFB\u9009\u4E2D\u7684\u5185\u5BB9";
  const press = async (text, report) => {
    try {
      if (speaking()) await stop();
      else await start(text);
      report("");
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  const ContributedPill = (props) => {
    const [, force] = React.useReducer((value) => value + 1, 0);
    const [message, setMessage] = React.useState("");
    React.useEffect(() => readout.subscribe(force), []);
    const playing = speaking();
    return React.createElement("button", {
      type: "button",
      className: "dsh-pet-speakpill",
      "data-playing": String(playing),
      "data-error": String(Boolean(message)),
      title: message || hint(),
      "aria-label": message || hint(),
      "aria-pressed": String(playing),
      // Pointer down must not collapse the selection the bubble was raised for.
      onPointerDown: (event) => {
        event.preventDefault();
      },
      onClick: () => {
        void press(props.text, setMessage);
      }
    }, message ? shorten(message) : label());
  };
  const mountConversation = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dsh-pet-speakpill dsh-pet-speakpill-float";
    button.hidden = true;
    document.body.append(button);
    let current = null, message = "", timer;
    const render = () => {
      const playing = speaking();
      button.dataset.playing = String(playing);
      button.dataset.error = String(Boolean(message));
      button.textContent = message ? shorten(message) : label();
      button.title = message || hint();
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", String(playing));
    };
    const hide = () => {
      current = null;
      button.hidden = true;
    };
    const place = () => {
      const rect = current?.rect;
      if (!rect) return;
      const height = 30, gap = 8, width = button.offsetWidth || 96;
      const above = rect.top - gap - height;
      const top = above >= 8 ? above : Math.min(window.innerHeight - height - 8, rect.bottom + gap);
      button.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
      button.style.top = `${Math.max(8, top)}px`;
    };
    const sync = () => {
      const found = conversationSelection();
      if (!found) return hide();
      current = found;
      button.hidden = false;
      place();
      render();
    };
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      void press(current?.text ?? "", (value) => {
        message = value;
        render();
        clearTimeout(timer);
        if (value) timer = setTimeout(() => {
          message = "";
          render();
        }, ERROR_MS);
      });
    });
    const unsubscribe = readout.subscribe(render);
    document.addEventListener("selectionchange", sync);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    render();
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("selectionchange", sync);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
      button.remove();
    };
  };
  return { style: SELECTION_SPEAK_STYLE, pill: ContributedPill, mountConversation };
}

// src/client.mjs
var name = "desktop-pet-client";
var inject = ["slots", "layout", "sessions"];
var PANEL_ID = "desktop-pet";
function PetPanelIcon({ size }) {
  const React = require("react");
  const ellipse = (cx, cy, rx, ry) => React.createElement("ellipse", { key: `${cx}-${cy}`, cx, cy, rx, ry });
  return React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.2,
      "aria-hidden": true
    },
    ellipse(4.4, 5.5, 1.55, 1.95),
    ellipse(8, 3.9, 1.55, 1.95),
    ellipse(11.6, 5.5, 1.55, 1.95),
    ellipse(8, 11.2, 3.15, 2.5)
  );
}
async function api(path, body) {
  const response = await fetch(`/desktop-pet/api/${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : void 0 });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  return value;
}
var READOUT_SPEAKER_VIEWBOX = "0 0 31 25";
var READOUT_SPEAKER = [
  "M13.83812,0.65637046C14.825261,-0.071926124,16.127447,-0.20439202,17.239569,0.31035504C18.35169,0.82510209,19.098766,1.9060704,19.191008,3.133961C19.660484,9.3690577,19.660484,15.63094,19.191008,21.866039C19.098766,23.093927,18.35169,24.174896,17.239569,24.689644C16.127447,25.204391,14.82526,25.071928,13.838119,24.343628L6.9722991,19.278631L3.6600192,19.278631C2.0771675,19.27865,0.70767713,18.170486,0.36863032,16.615307L0.33897814,16.464144C0.11395912,15.154883,0.00055402151,13.828682,0,12.499999C0,11.178165,0.11321729,9.8563318,0.33897802,8.5358543C0.6172173,6.909575,2.0194516,5.7212214,3.6600192,5.721365L6.9716253,5.721365L13.83812,0.65637046ZM16.320139,2.9231455C16.086529,2.6754725,15.706256,2.641201,15.432595,2.8431578L8.2102747,8.1704865C7.9790344,8.3409986,7.6997595,8.4328947,7.4130378,8.4328184L3.6593454,8.4328184C3.3314703,8.4329653,3.0512793,8.6704483,2.9955413,8.9954453C2.7965083,10.152903,2.6961792,11.325353,2.6956499,12.499999C2.6956499,13.66728,2.7953889,14.835238,2.9955409,16.004553C3.0513222,16.329803,3.3318892,16.567362,3.6600187,16.567181L7.4130378,16.567181C7.6997595,16.567102,7.9790354,16.658998,8.2102757,16.829512L15.432596,22.157516C15.630114,22.303001,15.890533,22.3293,16.11286,22.226217C16.33519,22.123131,16.484457,21.906878,16.502771,21.661322C16.961998,15.562505,16.961998,9.4374886,16.502771,3.3386734C16.493422,3.2123365,16.449064,3.0911627,16.374727,2.9888961L16.320139,2.9231455ZM29.210737,4.7323632C30.392134,7.1490598,31.004368,9.8069515,30.999977,12.499999C31.003069,15.192898,30.390903,17.850496,29.210739,20.267635C28.881979,20.939079,28.074509,21.21557,27.406752,20.885347C26.738995,20.55512,26.463558,19.743109,26.791393,19.071207C27.790915,17.02681,28.30862,14.778229,28.304325,12.499999C28.307316,10.221917,27.789679,7.973629,26.791393,5.9287915C26.462492,5.256722,26.73773,4.443717,27.406046,4.1132183C28.07436,3.7827194,28.882492,4.059968,29.210737,4.7323632ZM24.687437,7.8288426C25.297382,9.3096657,25.610456,10.897113,25.608677,12.499999C25.608677,14.122805,25.293285,15.702903,24.687439,17.171154C24.392143,17.846121,23.614649,18.159891,22.937447,17.877392C22.260241,17.594891,21.931719,16.819738,22.198006,16.132668C22.672022,14.981009,22.915018,13.746453,22.913027,12.499999C22.913027,11.235784,22.667723,10.008173,22.198008,8.8673296C21.931721,8.1802616,22.260242,7.4051089,22.93745,7.1226068C23.614653,6.8401055,24.392147,7.1538754,24.687437,7.8288426Z"
];
var READOUT_BARS = [1.6, 5.2, 8.8, 12.4];
var READOUT_BAR_DELAYS = [0, 0.14, 0.28, 0.42];
function ReadoutIcon({ playing }) {
  const React = require("react");
  if (playing) return React.createElement(
    "svg",
    { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": true },
    READOUT_BARS.map((x, index) => React.createElement("rect", {
      key: x,
      className: "dsh-pet-readout-bar",
      x,
      y: 3,
      width: 2,
      height: 10,
      rx: 1,
      fill: "currentColor",
      style: { animationDelay: `${String(READOUT_BAR_DELAYS[index])}s` }
    }))
  );
  return React.createElement("svg", {
    width: 16,
    height: 16,
    viewBox: READOUT_SPEAKER_VIEWBOX,
    fill: "currentColor",
    "aria-hidden": true
  }, READOUT_SPEAKER.map((d, index) => React.createElement("path", { key: d, d })));
}
var READOUT_STYLE = `
.dsh-pet-readout{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:28px;height:28px;padding:6px;border:0;border-radius:28px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsh-pet-readout svg{width:15px;height:15px}
.dsh-pet-readout:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dsh-pet-readout:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-pet-readout:disabled{cursor:default;opacity:.4}
.dsh-pet-readout[data-playing="true"],.dsh-pet-readout[data-playing="true"]:hover:not(:disabled){color:var(--dsw-alias-state-business-primary)}
.dsh-pet-readout-bar{transform-box:fill-box;transform-origin:center;animation:dsh-pet-readout-bar .9s ease-in-out infinite alternate both}
@keyframes dsh-pet-readout-bar{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.dsh-pet-readout-bar{animation:none;transform:scaleY(.7)}}
`;
function readoutStore() {
  const playing = /* @__PURE__ */ new Set(), listeners = /* @__PURE__ */ new Set(), pending = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  let stream;
  const ensureStream = () => {
    if (stream) return;
    stream = new EventSource("/desktop-pet/api/conversation/events?role=chat");
    stream.addEventListener("readout", (event) => {
      const value = JSON.parse(event.data);
      if (value.messageId) {
        playing.add(value.messageId);
        pending.delete(value.messageId);
      } else {
        playing.clear();
      }
      if (value.state === "idle" && value.messageId) playing.delete(value.messageId);
      notify();
    });
  };
  return {
    has: (messageId) => playing.has(messageId),
    anyPlaying: () => playing.size > 0,
    isPending: (messageId) => pending.has(messageId),
    subscribe(listener) {
      ensureStream();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stream?.close();
          stream = void 0;
        }
      };
    },
    toggle(messageId) {
      pending.add(messageId);
      notify();
    },
    settle(messageId) {
      pending.delete(messageId);
      notify();
    },
    // Cancelling belongs to whoever holds the voice, not to one control: the strip's stop clears every owner at
    // once, so a selection still playing cannot leave the button lit. The host confirms with an idle event.
    stop() {
      if (!playing.size) return;
      playing.clear();
      notify();
    }
  };
}
function mountPicker(container, session) {
  const { pet, command, setVisible } = session;
  const host = document.createElement("div");
  host.dataset.plugin = "desktop-pet";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${PANEL_STYLE}</style>
      <div class="pet-shell"><div class="pet-page"><header class="pet-pageHead"><div><h2 id="pet-title" class="pet-title">\u684C\u9762\u4F19\u4F34</h2><p class="pet-intro">\u6311\u4E00\u4F4D\u559C\u6B22\u7684\u4F19\u4F34\uFF0C\u966A\u4F60\u4E00\u8D77\u5DE5\u4F5C\u3002</p></div>
      <div class="pet-pageActions"><span id="status" class="pet-status" role="status"></span><span class="pet-visibility"><span id="visibility-label" class="pet-label">\u663E\u793A\u4F19\u4F34</span><button id="visibility" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="visibility-label" title="\u663E\u793A\u6216\u9690\u85CF\u684C\u9762\u4F19\u4F34"><span class="pet-thumb"></span></button></span></div></header><nav></nav>
      <div class="pet-pageBody"><div class="pet-body"><aside id="library" class="pet-library"></aside><section class="pet-detail" aria-label="\u5F53\u524D\u89D2\u8272\u4E0E\u8BBE\u7F6E"><div class="pet-portrait"><iframe id="model-preview" class="pet-preview" title="\u89D2\u8272\u7ACB\u7ED8" src="about:blank"></iframe></div><h3 id="character-name" class="pet-characterTitle">\u6B63\u5728\u52A0\u8F7D\u4F19\u4F34\u2026</h3><p id="character-subtitle" class="pet-characterSubtitle"></p>
      <div class="pet-field"><label class="pet-sizeLabel" for="height"><span class="pet-label">\u89D2\u8272\u663E\u793A\u5927\u5C0F</span><output id="height-value" class="pet-sizeValue"></output></label><input id="height" class="pet-range" type="range" min="180" max="1000" step="10"></div>
      <div class="pet-detailGrid"><div class="pet-switchRow"><span id="animated-label" class="pet-label">\u5F00\u542F\u52A8\u753B</span><button id="animated" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="animated-label"><span class="pet-thumb"></span></button></div><div class="pet-switchRow"><span id="alwaysOnTop-label" class="pet-label">\u4FDD\u6301\u5728\u7A97\u53E3\u4E0A\u65B9</span><button id="alwaysOnTop" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="alwaysOnTop-label"><span class="pet-thumb"></span></button></div>
      <div class="pet-switchRow"><span id="broadcastEnabled-label" class="pet-label">\u64AD\u62A5\u4E3B\u5BF9\u8BDD</span><button id="broadcastEnabled" class="pet-switch" type="button" role="switch" aria-checked="false" aria-labelledby="broadcastEnabled-label"><span class="pet-thumb"></span></button></div></div>
      <p class="pet-hintLine">\u64AD\u62A5\u4E3B\u5BF9\u8BDD\u65F6\uFF0C\u684C\u5BA0\u5FF5\u51FA Harness \u91CC\u5927\u6A21\u578B\u8BF4\u7ED9\u4F60\u542C\u7684\u90A3\u90E8\u5206\u6587\u5B57\uFF08\u601D\u8003\u4E0E\u5DE5\u5177\u8C03\u7528\u4E0D\u5FF5\uFF09\uFF0C\u6C14\u6CE1\u53EA\u4FDD\u7559\u6700\u8FD1\u51E0\u53E5\u3002</p>
      <p class="pet-hintLine">\u8F7B\u8F7B\u6478\u5934\u3001\u70B9\u51FB\u4E92\u52A8\uFF0C\u6309\u4F4F\u89D2\u8272\u5373\u53EF\u62D6\u52A8\u3002</p></section></div></div>
      </div></div>`;
  container.append(host);
  const find = (id) => shadow.getElementById(id);
  const tabs = shadow.querySelector("nav");
  tabs.className = "pet-tabs";
  const TAB_LABELS = [["partner", "\u4F19\u4F34"], ["conversation", "\u5BF9\u8BDD"], ["prompts", "Prompt \u7BA1\u7406"], ["intimacy", "\u4EB2\u5BC6\u5EA6"], ["actions", "\u52A8\u4F5C\u4E0E\u5173\u952E\u8BCD"], ["voice", "\u58F0\u97F3"], ["history", "\u804A\u5929\u8BB0\u5F55"]];
  tabs.setAttribute("role", "tablist");
  for (const [id, label] of TAB_LABELS) {
    const button = document.createElement("button");
    button.className = "pet-tab";
    button.type = "button";
    button.setAttribute("role", "tab");
    button.dataset.tab = id;
    button.textContent = label;
    tabs.append(button);
  }
  tabs.setAttribute("aria-label", "\u684C\u5BA0\u8BBE\u7F6E\u5206\u7C7B");
  const selectTab = (tab) => {
    for (const button of tabs.querySelectorAll("button")) button.setAttribute("aria-selected", String(button.dataset.tab === tab));
  };
  selectTab("partner");
  const voiceRoot = document.createElement("section");
  voiceRoot.className = "pet-voice";
  voiceRoot.hidden = true;
  shadow.querySelector(".pet-pageBody").append(voiceRoot);
  const history = document.createElement("iframe");
  history.className = "pet-history";
  history.title = "\u804A\u5929\u8BB0\u5F55\u4E0E\u9AD8\u7EA7\u5BF9\u8BDD";
  history.allow = "microphone";
  history.src = "about:blank";
  history.hidden = true;
  shadow.querySelector(".pet-pageBody").append(history);
  let selectedTab = "partner";
  let disposed = false, settings, saveTimer, statusTimer;
  const status = (text) => {
    if (!disposed) find("status").textContent = text;
  };
  const isOn = (id) => find(id).getAttribute("aria-checked") === "true";
  const setOn = (id, value) => find(id).setAttribute("aria-checked", String(value === true));
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
      shadow.querySelector(".pet-body").hidden = tab !== "partner";
      voiceRoot.hidden = ["partner", "history"].includes(tab);
      history.hidden = tab !== "history";
      history.src = tab === "history" ? "/desktop-pet/chat" : "about:blank";
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
  const debugRoot = document.createElement("div");
  shadow.querySelector(".pet-detail").append(debugRoot);
  const actionDebug = mountActionDebug(debugRoot, { api, status, animated: () => settings?.animated });
  const applyVisibility = (visible) => {
    const control2 = find("visibility");
    control2.setAttribute("aria-checked", String(visible));
    control2.title = visible ? "\u9690\u85CF\u684C\u9762\u4F19\u4F34" : "\u663E\u793A\u684C\u9762\u4F19\u4F34";
  };
  applyVisibility(pet.visible);
  pet.listeners.add(applyVisibility);
  const preview = (model) => {
    if (disposed || !model || selectedTab !== "partner") return;
    find("character-name").textContent = model.name;
    find("character-subtitle").textContent = model.subtitle;
    find("model-preview").src = `/desktop-pet/view?preview=1&model=${encodeURIComponent(model.id)}`;
    void actionDebug.load(model.id);
  };
  let updates = Promise.resolve();
  const updateSettings = (patch) => {
    const result = updates.then(async () => {
      settings = await api("settings", { ...settings, ...patch });
      pet.settings = settings;
    });
    updates = result.catch(() => {
    });
    return result;
  };
  const configure = async () => {
    if (pet.attached) await command({ action: "configure", height: settings.height, alwaysOnTop: settings.alwaysOnTop });
  };
  const wardrobe = document.createElement("div");
  wardrobe.className = "pet-outfit";
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
    pet.settings = settings;
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
  const partnerControls = ["height", "animated", "alwaysOnTop", "broadcastEnabled"].map(find);
  const partnerEnabled = (enabled) => {
    for (const control2 of partnerControls) control2.disabled = !enabled;
  };
  partnerEnabled(false);
  const enter = run(async () => {
    library.resume();
    status("");
    if (selectedTab === "history") history.src = "/desktop-pet/chat";
    else if (selectedTab !== "partner") {
      voiceSettings.show(selectedTab);
      await voiceSettings.load();
    }
    settings = await api("settings");
    if (disposed) return;
    find("height").value = settings.height;
    find("height-value").value = `${settings.height} px`;
    for (const key of ["animated", "alwaysOnTop", "broadcastEnabled"]) setOn(key, settings[key]);
    partnerEnabled(true);
    preview(await library.refresh());
  });
  const flashSaved = () => {
    status("\u5DF2\u4FDD\u5B58\u3002");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (!disposed) status("");
    }, 1500);
  };
  const saveSelected = async () => {
    if (selectedTab === "history") return;
    if (selectedTab !== "partner") {
      await voiceSettings.save();
      flashSaved();
      return;
    }
    await updateSettings({
      height: Number(find("height").value),
      animated: isOn("animated"),
      alwaysOnTop: isOn("alwaysOnTop"),
      broadcastEnabled: isOn("broadcastEnabled")
      // The host refuses a sentence count outside its own range, so a half-typed number never leaves the panel.
    });
    if (disposed) return;
    await configure();
    flashSaved();
  };
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void run(saveSelected)();
    }, 300);
  };
  find("height").oninput = () => {
    find("height-value").value = `${find("height").value} px`;
    saveSoon();
  };
  find("height").onchange = () => {
    void run(saveSelected)();
  };
  for (const key of ["animated", "alwaysOnTop", "broadcastEnabled"]) find(key).onclick = () => {
    setOn(key, !isOn(key));
    void run(saveSelected)();
  };
  voiceRoot.addEventListener("change", saveSoon);
  find("visibility").onclick = run(async () => {
    const next = pet.visible !== true;
    const result = await command({ action: next ? "show" : "hide" });
    setVisible(result?.visible ?? next);
    status(next ? "\u4F19\u4F34\u5DF2\u663E\u793A\u3002" : "\u4F19\u4F34\u5DF2\u9690\u85CF\u3002");
  });
  void enter();
  return () => {
    disposed = true;
    clearTimeout(saveTimer);
    clearTimeout(statusTimer);
    actionDebug.suspend();
    history.src = "about:blank";
    library.suspend();
    voiceSettings.suspend();
    find("model-preview").src = "about:blank";
    actionDebug.dispose();
    library.dispose();
    voiceSettings.dispose();
    pet.listeners.delete(applyVisibility);
    host.remove();
  };
}
function apply(ctx) {
  const lease = crypto.randomUUID();
  const desktop = window.harnessDesktop;
  const command = (value) => desktop?.petCommand({ ...value, lease }) ?? Promise.reject(new Error("\u8BF7\u5728 Harness \u684C\u9762 App \u4E2D\u4F7F\u7528\u684C\u5BA0\u7A97\u53E3"));
  const pet = { settings: void 0, attached: false, visible: false, listeners: /* @__PURE__ */ new Set() };
  const setVisible = (visible) => {
    if (pet.visible === visible) return;
    pet.visible = visible;
    for (const listener of pet.listeners) listener(visible);
  };
  ctx.effect(() => {
    if (!desktop?.petCommand) return () => {
    };
    let cancelled = false;
    const attach = async () => {
      try {
        const settings = pet.settings ?? await api("settings");
        pet.settings = settings;
        const result = await command({ action: "attach", height: settings.height, alwaysOnTop: settings.alwaysOnTop });
        if (cancelled) {
          void command({ action: "detach" }).catch(() => {
          });
          return;
        }
        pet.attached = true;
        setVisible(result?.visible === true);
      } catch (error) {
        console.warn("[desktop-pet] \u9644\u7740\u539F\u751F\u7A97\u53E3\u5931\u8D25:", error);
      }
    };
    void attach();
    const react = (event) => {
      if (["touch", "click"].includes(event.detail?.action)) void command({ action: "react", reaction: event.detail.action }).catch(() => {
      });
    };
    const unload = () => {
      if (!pet.attached) return;
      pet.attached = false;
      void command({ action: "detach" }).catch(() => {
      });
    };
    window.addEventListener("dsh-desktop-pet:react", react);
    window.addEventListener("pagehide", unload);
    return () => {
      cancelled = true;
      window.removeEventListener("dsh-desktop-pet:react", react);
      window.removeEventListener("pagehide", unload);
      unload();
    };
  }, "desktop-pet: native window lease");
  ctx.effect(() => {
    let reported;
    const report = () => {
      const list = ctx.sessions.list.getSnapshot();
      const active = Object.entries(list?.byId ?? {}).find(([, row]) => (row?.retainedBy?.mainView ?? 0) > 0)?.[0];
      if (active === reported) return;
      reported = active;
      void fetch("/desktop-pet/api/broadcast/focus", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: active ?? null }) }).catch(() => {
      });
    };
    report();
    return ctx.sessions.list.subscribe(report);
  }, "desktop-pet: broadcast focus");
  const disposeEntry = ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 1,
    label: () => "\u684C\u5BA0"
  }, PetPanelIcon));
  const PetPanel = () => {
    const React = require("react");
    const host = React.useRef(null);
    React.useEffect(() => mountPicker(host.current, { pet, command, setVisible }), []);
    return React.createElement("div", { ref: host, className: "dsh-pet-panel-host", style: { display: "flex", width: "100%", height: "100%", minHeight: 0 } });
  };
  const disposePanel = ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID
  }, PetPanel));
  const readout = readoutStore();
  ctx.effect(() => {
    if (document.getElementById("dsh-pet-readout-style")) return () => {
    };
    const style = document.createElement("style");
    style.id = "dsh-pet-readout-style";
    style.textContent = READOUT_STYLE;
    document.head.append(style);
    return () => {
      style.remove();
    };
  }, "desktop-pet: read-out styles");
  const ReadoutAction = ({ messageId, sessionId }) => {
    const React = require("react");
    const [, force] = React.useReducer((value) => value + 1, 0);
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => readout.subscribe(force), []);
    const speaking = readout.anyPlaying(), waiting = readout.isPending(messageId);
    const post = (url, body) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((response) => {
      if (!response.ok) return response.json().then((value) => {
        throw new Error(value.error ?? "\u64AD\u62A5\u5931\u8D25");
      });
    }).catch(() => setFailed(true));
    const toggle = () => {
      setFailed(false);
      if (speaking) {
        readout.stop();
        void post("/desktop-pet/api/conversation/stop", { speechOnly: true });
        return;
      }
      readout.toggle(messageId);
      void post("/desktop-pet/api/broadcast/message", { sessionId, messageId }).finally(() => readout.settle(messageId));
    };
    return React.createElement("button", {
      type: "button",
      className: "dsh-pet-readout",
      "data-playing": String(speaking),
      title: speaking ? "\u505C\u6B62\u6717\u8BFB" : "\u7528\u684C\u5BA0\u7684\u58F0\u97F3\u64AD\u62A5\u8FD9\u6761\u56DE\u590D",
      "aria-label": speaking ? "\u505C\u6B62\u6717\u8BFB" : "\u64AD\u62A5\u8FD9\u6761\u56DE\u590D",
      "aria-pressed": String(speaking),
      disabled: waiting,
      onClick: toggle
    }, React.createElement(ReadoutIcon, { playing: speaking }), failed ? React.createElement("span", { className: "dsh-pet-readout-error", hidden: true }, "\u64AD\u62A5\u5931\u8D25") : null);
  };
  const disposeReadout = ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
    name: "conversation.chat.assistant-actions",
    id: "desktop-pet-readout",
    order: 20,
    inject: (sessionId) => ({ sessionId })
  }, ReadoutAction));
  const selectionSpeak = createSelectionSpeak({ api, readout, React: require("react") });
  ctx.effect(() => {
    if (document.getElementById("dsh-pet-speak-style")) return () => {
    };
    const style = document.createElement("style");
    style.id = "dsh-pet-speak-style";
    style.textContent = selectionSpeak.style;
    document.head.append(style);
    return () => {
      style.remove();
    };
  }, "desktop-pet: selection read-aloud styles");
  ctx.effect(() => selectionSpeak.mountConversation(), "desktop-pet: selection read-aloud pill");
  ctx.inject(["dshFileEditSelectionActions"], (scope) => {
    scope.effect(() => scope.dshFileEditSelectionActions.register({
      id: "desktop-pet-speak",
      order: 20,
      pill: selectionSpeak.pill
    }), "desktop-pet: file browser selection action");
  });
  const unsubscribe = window.harnessDesktop?.onPetSettings?.(() => {
    ctx.layout.selectPanel(PANEL_ID);
  });
  ctx.effect(() => () => {
    unsubscribe?.();
    disposeReadout();
    disposePanel();
    disposeEntry();
  }, "desktop-pet: sidebar entry and panel");
}

return module.exports;}});
