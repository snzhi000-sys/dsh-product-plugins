import test from 'node:test'
import assert from 'node:assert/strict'
import { validateConversation } from '../src/conversation-store.mjs'
import { defaultMouthRecipes, weightedTimeline } from '../src/action-presets.mjs'
import { matchAction } from '../src/satellites.mjs'
import { speechCues } from '../src/speech-cues.mjs'
import { MouthCues } from '../src/mouth-cues.mjs'
import { conversationStore } from '../src/conversation-store.mjs'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('legacy keywords become full-weight variants and independent variants match by longest tag then order',()=>{
  const c=validateConversation({actionKeywords:{mengmei:{xi:['笑']}}})
  assert.equal(c.actionPresets.mengmei[0].weight,1)
  const mild={...c.actionPresets.mengmei[0],id:'mild',name:'浅笑',weight:.3,keywords:['微笑']}
  const modules=[{id:'xi',category:'body',automaticEligible:true}]
  assert.equal(matchAction('微笑',modules,{},[mild,...c.actionPresets.mengmei]).weight,.3)
  assert.equal(matchAction('微笑',modules,{},[{...mild,enabled:false},...c.actionPresets.mengmei]).weight,1)
  assert.throws(()=>validateConversation({...c,actionPresets:{mengmei:[mild,{...mild}]}}),/无效/)
  assert.throws(()=>validateConversation({...c,actionPresets:{mengmei:[{...mild,weight:1.1}]}}),/无效/)
})
test('pinyin e/w/y resolves configurable authored poses and weights on the audio timeline',()=>{
  const timeline=speechCues('鹅我也',3)
  for(const phoneme of ['e','w','y'])assert.ok(timeline.cues.some(c=>c.phoneme===phoneme),phoneme)
  const weighted=weightedTimeline(timeline,defaultMouthRecipes)
  for(const phoneme of ['e','w','y']){
    const cue=weighted.cues.find(c=>c.phoneme===phoneme),recipe=defaultMouthRecipes.find(r=>r.phoneme===phoneme)
    assert.equal(cue.shape,recipe.base);assert.equal(cue.weight,recipe.weight)
  }
  let time=0;const controller=new MouthCues(()=>{},['a','o','i','m'],'m')
  controller.start({duration:2,cues:[{time:0,shape:'i',weight:.3},{time:1,shape:'i',weight:.8}]},()=>time)
  assert.equal(controller.weight,.3);assert.equal(controller.remaining,1)
  time=1;controller.update();assert.equal(controller.weight,.8)
  controller.silent=true;controller.update();assert.equal(controller.current,'m')
  time=2;controller.update();assert.equal(controller.active,false)
  assert.throws(()=>controller.start({duration:2,cues:[{time:0,shape:'i',weight:-.1}]},()=>0),/无效/)
})
test('saved variants and recipes survive store reopen and new conversation; invalid edits retain the saved configuration',()=>{
  const path=mkdtempSync(join(tmpdir(),'pet-weight-config-'))
  try {
    const store=conversationStore(path),config=structuredClone(store.config)
    config.actionPresets.mengmei=[{id:'gentle',name:'轻笑',actionId:'xi',weight:.3,enabled:true,keywords:['轻笑']}]
    config.mouthRecipes.mengmei.find(r=>r.phoneme==='e').weight=.42
    store.save({config});store.reset()
    assert.deepEqual(conversationStore(path).config,config)
    const invalid=structuredClone(config);invalid.mouthRecipes.mengmei.push({...invalid.mouthRecipes.mengmei[0]})
    assert.throws(()=>store.save({config:invalid}),/唯一/)
    assert.deepEqual(conversationStore(path).config,config)
  }finally{rmSync(path,{recursive:true,force:true})}
})

test('a DragonBones mouth keeps every vowel visible while another engine keeps its poses', () => {
  // Measured on the shipped DragonBones character: its authored `i` pose moves the mouth 8.7px, barely more than
  // the closed pose at 8.7px, while `a` moves 17.1px. Digit and letter readings are almost all `i` vowels, so
  // that pose is what made a read-out of "2025 年 5.4%" look like a still mouth (75 of 164 cues, 2026-09-20).
  const timeline = { duration: 2, cues: [{ time: 0, shape: 'm' }, { time: .5, shape: 'i' }, { time: 1, shape: 'o' }, { time: 1.5, shape: 'a', weight: .5 }] }
  const dragon = weightedTimeline(timeline, undefined, 'dragonbones')
  assert.deepEqual(dragon.cues.map(cue => cue.shape), ['m', 'a', 'o', 'a'], 'a narrow vowel becomes a visible `a`')
  assert.equal(dragon.cues[1].weight, .7, 'and it is narrower than a full `a`')
  assert.equal(dragon.cues[3].weight, .5, 'a cue that already carried a weight keeps it')
  const cubism = weightedTimeline(timeline, undefined, 'cubism4')
  assert.deepEqual(cubism.cues.map(cue => cue.shape), ['m', 'i', 'o', 'a'], 'Live2D keeps its own four poses')
  // A configured recipe still wins over the engine default.
  const recipe = weightedTimeline(timeline, [{ phoneme: 'i', base: 'o', weight: .4 }], 'dragonbones')
  assert.deepEqual(recipe.cues.map(cue => cue.shape), ['m', 'o', 'o', 'a'])
  assert.equal(recipe.cues[1].weight, .4)
  // A recipe whose result is the weak `i` pose is narrowed on DragonBones as well, keeping its relative weight;
  // another engine keeps the recipe exactly as configured.
  const withPhoneme = { duration: 2, cues: [{ time: 0, shape: 'm' }, { time: .5, shape: 'a', phoneme: 'e' }] }
  const narrowed = weightedTimeline(withPhoneme, [{ phoneme: 'e', base: 'i', weight: .5 }], 'dragonbones')
  assert.deepEqual(narrowed.cues.map(cue => cue.shape), ['m', 'a'], 'a recipe landing on `i` is narrowed on DragonBones')
  assert.equal(narrowed.cues[1].weight, .35, 'the recipe weight is kept as a multiplier')
  const kept = weightedTimeline(withPhoneme, [{ phoneme: 'e', base: 'i', weight: .5 }], 'cubism4')
  assert.deepEqual(kept.cues.map(cue => cue.shape), ['m', 'i'], 'Cubism keeps the configured recipe')
  // The timeline itself is never mutated.
  assert.deepEqual(timeline.cues.map(cue => cue.shape), ['m', 'i', 'o', 'a'])
})
