// src/mouth-cues.mjs
var MouthCues = class {
  constructor(apply, shapes, neutral) {
    this.apply = apply;
    this.shapes = shapes;
    this.neutral = neutral;
    this.active = false;
    this.current = null;
  }
  start({ cues, duration }, clock) {
    if (!Array.isArray(cues) || cues.length > 1e4 || !Number.isFinite(duration) || duration <= 0 || typeof clock !== "function") throw new Error("\u53E3\u578B\u65F6\u95F4\u8F74\u65E0\u6548");
    let previous = -1;
    for (const cue of cues) {
      if (!Number.isFinite(cue.time) || cue.time < 0 || cue.time < previous || cue.time >= duration || !this.shapes.includes(cue.shape) || cue.weight !== void 0 && (!Number.isFinite(cue.weight) || cue.weight < 0 || cue.weight > 1)) throw new Error("\u53E3\u578B\u65F6\u95F4\u6216\u59FF\u6001\u65E0\u6548");
      previous = cue.time;
    }
    this.cancel();
    this.cues = cues.map((cue) => ({ ...cue }));
    this.duration = duration;
    this.clock = clock;
    this.active = true;
    this.update();
  }
  set(shape, weight = 1) {
    if (this.current !== shape || this.weight !== weight) {
      this.apply(shape);
      this.current = shape;
      this.weight = weight;
    }
  }
  update() {
    if (!this.active) return;
    const time = this.clock();
    if (!Number.isFinite(time) || time < 0 || time >= this.duration) {
      this.cancel();
      return;
    }
    let low = 0, high = this.cues.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (this.cues[mid].time <= time) low = mid + 1;
      else high = mid;
    }
    const cue = low ? this.cues[low - 1] : { shape: this.neutral, weight: 1 };
    this.remaining = (this.cues.slice(low).find((c) => c.shape !== cue.shape || (c.weight ?? 1) !== (cue.weight ?? 1))?.time ?? this.duration) - time;
    this.set(this.silent ? this.neutral : cue.shape, this.silent ? 1 : cue.weight ?? 1);
  }
  cancel() {
    this.active = false;
    this.silent = false;
    this.clock = null;
    this.cues = [];
    this.set(this.neutral);
  }
  dispose() {
    this.active = false;
    this.clock = null;
    this.cues = [];
    this.apply = () => {
    };
  }
};

// src/dragonbones-compat.mjs
var installed = /* @__PURE__ */ new WeakSet();
function installDragonBonesCompatibility(db) {
  if (installed.has(db)) return;
  if (db.DragonBones.VERSION !== "6.0.001") throw new Error("\u9F99\u9AA8\u9A71\u52A8\u7248\u672C\u53D8\u5316\uFF0C\u9700\u8981\u590D\u6838\u7EA6\u675F\u9002\u914D");
  const prototype = db.TransformConstraint.prototype, compute = prototype._compute, init = prototype.init;
  const helpers = /* @__PURE__ */ new WeakMap();
  prototype._compute = function() {
    const data = this._constraintData, offset = data.offsetRotation;
    if (!data.local && this._rotateWeight !== 0) {
      let helper = helpers.get(this);
      if (!helper) {
        helper = { root: new db.Transform(), target: new db.Transform() };
        helpers.set(this, helper);
      }
      const current = helper.root.fromMatrix(this._root.globalTransformMatrix).rotation;
      const target = helper.target.fromMatrix(this._target.globalTransformMatrix).rotation;
      data.offsetRotation = current + db.Transform.normalizeRadian(target + offset - current) - target;
    }
    try {
      return compute.call(this);
    } finally {
      data.offsetRotation = offset;
    }
  };
  prototype.init = function(data, armature) {
    const bone = armature.getBone(data.bones[this.index]?.name);
    const previous = bone?._transformConstraint;
    init.call(this, data, armature);
    if (!previous || previous === this || bone?._transformConstraint !== this) return;
    const constraints = previous.constraints ?? [previous];
    if (!constraints.includes(this)) constraints.push(this);
    bone._transformConstraint = {
      constraints,
      get _dirty() {
        return constraints.some((constraint) => constraint._dirty);
      },
      set _dirty(value) {
        for (const constraint of constraints) constraint._dirty = value;
      },
      update() {
        for (const constraint of constraints) constraint.update();
      },
      returnToPool() {
        for (const constraint of constraints) constraint.returnToPool();
      }
    };
  };
  const deform = db.DeformTimelineState.prototype, updateDeform = deform.update;
  deform.update = function(time) {
    updateDeform.call(this, time);
    if (this.playState > 0) this.playState = 0;
  };
  installed.add(db);
}

// src/dragonbones.mjs
async function createDragonBonesRenderer(stage, settings, onError, info) {
  const PIXI = globalThis.PIXI, db = globalThis.dragonBones, profile = info.profile;
  installDragonBonesCompatibility(db);
  const app = new PIXI.Application();
  await app.init({ width: stage.clientWidth, height: stage.clientHeight, backgroundAlpha: 0, preference: "webgl", autoStart: false, antialias: true, resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true, preserveDrawingBuffer: true });
  let factory, model, texture, disposed = false, previous = performance.now(), active = "idle", elapsed = 0, reactionEnd = 0, expressionState;
  let mouthStates = [], mouthTarget, mouthStrength = 0, mouthFrom = [], mouthProgress = 1, mouthViaNeutral = false, gazeX = 0, gazeY = 0;
  let bounds, mouth, gazeBone, eyeBone, gazeOrigin, wasAnimated = settings.animated;
  let debugState, debugRestore;
  let speaking = false, inputFocused = false;
  let mouthBlendSeconds = profile.mouthBlendSeconds;
  const url = (child) => `/desktop-pet/models/${encodeURIComponent(info.id)}/${child}`;
  const json = async (child) => {
    const r = await fetch(url(child));
    if (!r.ok) throw new Error("\u89D2\u8272\u8D44\u6E90\u52A0\u8F7D\u5931\u8D25");
    return r.json();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    mouth?.dispose();
    if (model) {
      app.stage.removeChild(model);
      model.armature.dispose();
    }
    if (factory) {
      factory.clear(true);
      factory.dragonBones.advanceTime(0);
    }
    texture?.destroy(true);
    app.destroy(true, { children: true });
  };
  const pose = (name, layer, group, fade = 0.12, loop = 1, fadeOutMode = 2) => {
    const config = model.animation.animationConfig;
    config.animation = name;
    config.layer = layer;
    config.group = group;
    config.resetToPose = false;
    config.fadeInTime = fade;
    config.fadeOutMode = fadeOutMode;
    config.playTimes = loop;
    return model.animation.playConfig(config);
  };
  const neutral = () => {
    if (gazeBone) {
      gazeBone.offset.x = 0;
      gazeBone.offset.y = 0;
      gazeBone.invalidUpdate();
    }
    if (eyeBone) {
      eyeBone.offset.x = 0;
      eyeBone.offset.y = 0;
      eyeBone.invalidUpdate();
    }
    model.animation.reset();
    pose(profile.idle, 0, "body", 0, 0);
    mouthTarget = null;
    mouthProgress = 1;
    mouthStates = profile.mouths.map((name) => {
      const state = pose("__speech_" + name, 3, "mouth", 0, 1, 0);
      state.timeScale = 0;
      state.weight = 0;
      return state;
    });
    pose("__mouth_rest", -1, "bind-mouth", 0, 0);
    gazeX = gazeY = 0;
    factory.dragonBones.advanceTime(1 / 30);
    active = "idle";
    expressionState = null;
  };
  const fit = () => {
    const scale = Math.min(app.screen.width * 0.84 / bounds.width, (app.screen.height - 70) / bounds.height);
    model.scale.set(scale);
    model.position.set(app.screen.width / 2 - (bounds.x + bounds.width / 2) * scale, (app.screen.height + 32) / 2 - (bounds.y + bounds.height / 2) * scale);
  };
  try {
    const [skeleton, atlas] = await Promise.all([json(info.skeleton), json(info.atlas)]);
    const image = new Image();
    image.src = url(info.texture);
    await image.decode();
    texture = PIXI.Texture.from(image);
    factory = new db.PixiFactory();
    factory.pixiApp = app;
    PIXI.Ticker.shared.remove(db.PixiFactory._clockHandler, db.PixiFactory);
    PIXI.Ticker.shared.remove(db.PixiFactory._clockFixedHandler, db.PixiFactory);
    PIXI.Ticker.shared.stop();
    for (const name of profile.mouths) {
      const source = skeleton.armature[0].animation.find((a) => a.name === name);
      const speech = structuredClone(source);
      speech.name = "__speech_" + name;
      delete speech.timeline;
      skeleton.armature[0].animation.push(speech);
    }
    const idleSlots = new Set(skeleton.armature[0].animation.find((a) => a.name === profile.idle).ffd?.map((f) => f.slot));
    const rest = structuredClone(skeleton.armature[0].animation.find((a) => a.name === profile.neutralMouth));
    rest.name = "__mouth_rest";
    delete rest.timeline;
    rest.ffd = rest.ffd.filter((f) => !idleSlots.has(f.slot));
    for (const ffd of rest.ffd) for (const frame of ffd.frame) frame.vertices = (frame.vertices ?? []).map(() => 0);
    skeleton.armature[0].animation.push(rest);
    factory.parseDragonBonesData(skeleton);
    factory.parseTextureAtlasData(atlas, texture.source);
    model = factory.buildArmatureDisplay(info.armature);
    if (!model) throw new Error("\u89D2\u8272\u9AA8\u67B6\u521B\u5EFA\u5931\u8D25");
    app.stage.addChild(model);
    neutral();
    if (profile.gaze) {
      gazeBone = model.armature.getBone(profile.gaze.bone);
      eyeBone = model.armature.getBone(profile.gaze.anchor);
      const eye = eyeBone.global;
      gazeOrigin = { x: eye.x, y: eye.y };
    }
    const b = model.getLocalBounds();
    bounds = { x: b.x - b.width * 0.06, y: b.y - b.height * 0.05, width: b.width * 1.12, height: b.height * 1.1 };
    if (!(bounds.width > 0 && bounds.height > 0)) throw new Error("\u89D2\u8272\u53EF\u89C1\u8303\u56F4\u65E0\u6548");
    fit();
    stage.append(app.canvas);
    app.render();
    mouth = new MouthCues(() => {
    }, profile.mouths, profile.neutralMouth);
    mouth.current = profile.neutralMouth;
  } catch (error) {
    dispose();
    throw error;
  }
  const play = (name, layer, group) => {
    if (!info.animations.some((a) => a.name === name)) throw new Error("\u89D2\u8272\u52A8\u4F5C\u4E0D\u5B58\u5728");
    return pose(name, layer, group);
  };
  const react = (name) => {
    if (disposed || !settings.animated) return false;
    const action = profile.actions[name];
    if (!action) return false;
    active = name;
    if (action.motion) play(action.motion, 1, "reaction");
    if (action.expression) expressionState = play(action.expression, 2, "expression");
    else {
      expressionState?.fadeOut(0.15);
      expressionState = null;
    }
    reactionEnd = name === "drag" ? Infinity : elapsed + Math.max(1.2, (info.animations.find((a) => a.name === action.motion)?.durationMs ?? 1400) / 1e3);
    return true;
  };
  const pixel = new Uint8Array(4);
  const hit = (x, y) => {
    if (disposed || x < 0 || y < 0 || x >= app.screen.width || y >= app.screen.height) return false;
    const gl = app.renderer.gl, resolution = app.renderer.resolution;
    gl.readPixels(Math.floor(x * resolution), app.canvas.height - 1 - Math.floor(y * resolution), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel[3] > 24;
  };
  return {
    profile,
    info,
    setSpeaking(value) {
      speaking = value;
    },
    setInputFocused(value) {
      inputFocused = value;
    },
    playSpeaking(selection) {
      if (disposed || !settings.animated) return;
      play(selection.animation, 1, "reaction").weight = selection.weight ?? 1;
      active = "speaking";
      reactionEnd = Infinity;
    },
    cancelSpeaking() {
      const previewing = active === "debug" && debugRestore?.active === "speaking";
      if (active !== "speaking" && !previewing) return;
      for (const state of model.animation.getStates()) if (state.group === "reaction") state.fadeOut(0.2);
      if (previewing) debugRestore = { active: "idle", reactionEnd: 0 };
      else {
        active = "idle";
        reactionEnd = 0;
      }
    },
    playAutomatic(selection) {
      if (disposed || !settings.animated || active !== "idle") return;
      play(selection.animation, 1, "reaction").weight = selection.weight ?? 1;
      active = "automatic";
      reactionEnd = elapsed + Math.max(1.2, selection.durationMs / 1e3);
    },
    cancelAutomatic() {
      if (active !== "automatic") return;
      for (const state of model.animation.getStates()) if (state.group === "reaction") state.fadeOut(0.15);
      active = "idle";
      reactionEnd = 0;
    },
    startDebug(selection) {
      if (disposed || !settings.animated) return;
      debugRestore ??= { active, reactionEnd };
      debugState?.fadeOut(0);
      const animation = profile.mouths.includes(selection.animation) ? "__speech_" + selection.animation : selection.animation;
      debugState = pose(animation, 6, "debug", 0, 1);
      debugState.weight = selection.weight ?? 1;
      active = "debug";
      reactionEnd = Infinity;
    },
    updateDebugWeight(value) {
      if (debugState) debugState.weight = value;
    },
    stopDebug() {
      if (!debugRestore || disposed) return;
      debugState?.fadeOut(0.2);
      debugState = null;
      active = debugRestore.active;
      reactionEnd = debugRestore.reactionEnd;
      debugRestore = null;
    },
    get contentBottom() {
      return model.y + (bounds.y + bounds.height * 1.05 / 1.1) * model.scale.y;
    },
    speech: {
      silence(value) {
        mouth.silent = value;
      },
      start(timeline, clock) {
        if (disposed || !settings.animated) return false;
        mouth.start(timeline, clock);
        return true;
      },
      cancel() {
        if (!disposed) mouth.cancel();
      }
    },
    react,
    hit,
    get state() {
      return active;
    },
    region(x, y) {
      if (!hit(x, y)) return null;
      const b = model.getBounds(), h = profile.headRegion, nx = (x - b.x) / b.width, ny = (y - b.y) / b.height;
      return nx >= h.x && nx <= h.x + h.width && ny >= h.y && ny <= h.y + h.height ? "head" : "body";
    },
    preview(animation, expression = null) {
      if (!settings.animated || disposed) return;
      if (animation) play(typeof animation === "string" ? animation : animation.name, 1, "reaction");
      if (expression) expressionState = play(expression, 2, "expression");
      active = "preview";
      reactionEnd = elapsed + 6;
    },
    update(now, pointer) {
      if (disposed) return;
      if (app.screen.width !== stage.clientWidth || app.screen.height !== stage.clientHeight) {
        app.renderer.resize(stage.clientWidth, stage.clientHeight);
        fit();
      }
      if (wasAnimated && !settings.animated) {
        mouth.cancel();
        neutral();
      }
      wasAnimated = settings.animated;
      if (settings.animated) {
        const delta = Math.max(0, Math.min((now - previous) / 1e3, 0.05));
        elapsed += delta;
        mouth.update();
        const requestedMouth = mouth.active && !debugState?.name.startsWith("__speech_") ? mouth.current : null;
        if (requestedMouth !== mouthTarget || (requestedMouth !== null ? mouth.weight : 0) !== mouthStrength) {
          mouthViaNeutral = requestedMouth !== null && requestedMouth !== profile.neutralMouth && mouthStates.some((state, i) => profile.mouths[i] !== requestedMouth && profile.mouths[i] !== profile.neutralMouth && state.weight > 0.01);
          mouthTarget = requestedMouth;
          mouthStrength = requestedMouth !== null ? mouth.weight : 0;
          mouthFrom = mouthStates.map((state) => state.weight);
          mouthProgress = 0;
          mouthBlendSeconds = requestedMouth === null ? profile.mouthBlendSeconds : Math.min(profile.mouthBlendSeconds, Math.max(0.04, mouth.remaining * 0.5));
        }
        if (mouthProgress < 1) {
          mouthProgress = Math.min(1, mouthProgress + delta / mouthBlendSeconds);
          const secondHalf = mouthViaNeutral && mouthProgress >= 0.5;
          const progress = mouthViaNeutral ? secondHalf ? (mouthProgress - 0.5) * 2 : mouthProgress * 2 : mouthProgress;
          const blend = progress * progress * (3 - 2 * progress);
          mouthStates.forEach((state, index) => {
            const neutralWeight = profile.mouths[index] === profile.neutralMouth ? 1 : 0;
            const from = secondHalf ? neutralWeight : mouthFrom[index];
            const target = mouthViaNeutral && !secondHalf ? neutralWeight : profile.mouths[index] === mouthTarget ? mouthStrength : 0;
            state.weight = from + (target - from) * blend;
          });
        }
        if (gazeBone) {
          const g = profile.gaze, scale = model.scale.x;
          const center = { x: model.x + gazeOrigin.x * scale, y: model.y + gazeOrigin.y * scale };
          const enabled = !speaking && !inputFocused && Number.isFinite(pointer?.x) && Number.isFinite(pointer?.y) && !["drag", "preview", "debug"].includes(active);
          let x = enabled ? (pointer.x - center.x) / (bounds.width * scale) : 0;
          let y = enabled ? (pointer.y - center.y) / (bounds.height * scale * 0.5) : 0;
          const length = Math.max(1, Math.hypot(x, y));
          x /= length;
          y /= length;
          const bodyGain = g.sensitivity / Math.max(1, Math.hypot(x, y) * g.sensitivity);
          const blend = 1 - Math.exp(-delta / g.responseSeconds);
          gazeX += (-y * bodyGain * g.verticalRange - gazeX) * blend;
          gazeY += (x * bodyGain * g.horizontalRange - gazeY) * blend;
          gazeBone.offset.x = gazeX;
          gazeBone.offset.y = gazeY;
          gazeBone.invalidUpdate();
          eyeBone.offset.x += (-y * g.eyeRange - eyeBone.offset.x) * blend;
          eyeBone.offset.y += (x * g.eyeRange - eyeBone.offset.y) * blend;
          eyeBone.invalidUpdate();
        }
        if (active !== "idle" && elapsed >= reactionEnd) {
          for (const s of model.animation.getStates()) if (s.group === "reaction" || s.group === "expression") s.fadeOut(0.2);
          expressionState = null;
          active = "idle";
        }
        factory.dragonBones.advanceTime(delta);
      }
      previous = now;
      app.render();
    },
    inspect() {
      const bones = model.armature.getBones();
      const gaze = gazeBone ? { x: gazeX, y: gazeY, control: { ...gazeBone.global }, body: { ...model.armature.getBone("zhuan1").global }, chest: { ...model.armature.getBone("shen").global }, face: { ...model.armature.getBone("lian").global }, eye: { ...model.armature.getBone(profile.gaze.anchor).global } } : null;
      return { debug: debugState ? { name: debugState.name, weight: debugState.weight, time: debugState.currentTime } : null, deforms: Object.fromEntries(model.armature.getSlots().filter((s) => s._displayFrame).map((s) => [s.name, [...s._displayFrame.deformVertices]])), speechFacing: speaking, reactionStates: model.animation.getStates().filter((s) => s.group === "reaction").map((s) => ({ name: s.name, weight: s.weight, time: s.currentTime, completed: s.isCompleted })), mouthWeights: mouthStates.map((state, index) => ({ shape: profile.mouths[index], weight: state.weight })), mouthVertices: [...model.armature.getSlot("zui")._displayFrame.deformVertices], gaze, state: active, mouth: mouth.current, speaking: mouth.active, bones: bones.length, constraints: Object.keys(model.armature.armatureData.constraints).length, activeTransforms: bones.reduce((count, bone) => count + (bone._transformConstraint ? bone._transformConstraint.constraints?.length ?? 1 : 0), 0), bodyTime: model.animation.getState(profile.idle)?.currentTime, head: model.armature.getBone("tou").global.rotation, bounds: model.getBounds(), clockListeners: PIXI.Ticker.shared.count, disposed };
    },
    dispose
  };
}
export {
  createDragonBonesRenderer
};
//# sourceMappingURL=dragonbones.js.map
