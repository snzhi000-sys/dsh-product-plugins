/**
 * What may be read aloud. The rules matter more than the plumbing: a person listens to what the model says to
 * them, never to its deliberation, its tool calls, or the internal compaction and title requests.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { broadcasts, createProseFilter, createProseReader, observeProse } from '../src/broadcast.mjs'

/** Collect one request's prose through the same wrapper the host installs on `llm/stream`. */
async function read(chunks, options = { sessionId: 'session-1' }, focus = 'session-1') {
  const sentences = [], bubbles = []
  let done = 0
  const chunksOut = []
  const sink = () => ({ sentenceChars: 100, sentence: text => sentences.push(text), bubble: text => bubbles.push(text), done: () => { done++ } })
  async function* source() { for (const chunk of chunks) yield chunk }
  const sinkFor = () => sink()
  for await (const chunk of observeProse(source(), options, sinkFor, focus)) chunksOut.push(chunk)
  return { sentences, bubbles, chunksOut, done }
}

test('only the focused session of a real agent-loop turn is broadcast', () => {
  assert.equal(broadcasts({ sessionId: 'session-1' }, 'session-1'), true)
  assert.equal(broadcasts({ sessionId: 'session-2' }, 'session-1'), false, 'a task in another session stays silent')
  assert.equal(broadcasts({ sessionId: 'session-1' }, undefined), false, 'nothing is read before the UI reports what it shows')
  assert.equal(broadcasts({ sessionId: 'session-1' }, ''), false)
  assert.equal(broadcasts({ sessionId: 'session-1', purpose: 'compaction' }, 'session-1'), false, 'compaction is internal')
  assert.equal(broadcasts({ sessionId: 'session-1', purpose: 'session-title' }, 'session-1'), false, 'titles are internal')
  assert.equal(broadcasts({ messages: [] }, 'session-1'), false, 'a hand-built one-shot has no session')
  assert.equal(broadcasts(undefined, 'session-1'), false)
})

test('reasoning, tool calls, and structure never reach the pet', async () => {
  const { sentences, chunksOut } = await read([
    { type: 'block-start', index: 0, blockType: 'reasoning' },
    { type: 'reasoning-delta', index: 0, text: '用户想要一个计时器，我得先看看现有代码。' },
    { type: 'block-end', index: 0, block: { kind: 'reasoning' } },
    { type: 'block-start', index: 1, blockType: 'text' },
    { type: 'text-delta', index: 1, text: '我先看一下计时器模块。' },
    { type: 'block-end', index: 1, block: { kind: 'text' } },
    { type: 'block-start', index: 2, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 2, id: 'call-1', name: 'read_file', argumentsDelta: '{"path":"src/timer.mjs"}' },
    { type: 'block-end', index: 2, block: { kind: 'tool-call' } },
    { type: 'usage', usage: { input: 10, output: 10 } },
    { type: 'finish', reason: 'stop' },
  ])
  assert.deepEqual(sentences, ['我先看一下计时器模块。'], 'only the assistant text is spoken')
  assert.equal(chunksOut.length, 11, 'every chunk still reaches the caller untouched')
})

test('a one-shot read-out speaks the tail it has no later push to complete', () => {
  // A selected passage, or a reply that ends without closing punctuation, has no further delta to finish its line:
  // the reader must speak what is left instead of dropping the last words of what was asked for.
  const sentences = []
  const reader = createProseReader({ sentenceChars: 100, sentence: text => sentences.push(text), bubble: () => {}, done: () => {} })
  reader.push('工厂很忙，消费很淡')
  reader.end()
  assert.deepEqual(sentences, ['工厂很忙，消费很淡'])
  // An unfinished code fence is not speech: the tail inside it stays unspoken.
  const fenced = []
  const other = createProseReader({ sentenceChars: 100, sentence: text => fenced.push(text), bubble: () => {}, done: () => {} })
  other.push('说明。\n\n```js\nconst a = 1')
  other.end()
  assert.deepEqual(fenced, ['说明。'], 'an unterminated fence is never read out')
})

test('a stream that is not broadcastable passes through without a sink', async () => {
  const sentences = []
  async function* source() { yield { type: 'text-delta', index: 0, text: '这是内部标题' }; yield { type: 'finish', reason: 'stop' } }
  const out = []
  for await (const chunk of observeProse(source(), { purpose: 'session-title' }, () => { throw new Error('a sink must not be built') }, 'session-1')) out.push(chunk)
  assert.equal(out.length, 2)
  assert.deepEqual(sentences, [])
})

test('fenced code is dropped whole, and its fence may arrive split across chunks', async () => {
  const { sentences } = await read([
    { type: 'text-delta', index: 0, text: '改好了。\n' },
    { type: 'text-delta', index: 0, text: '``' },
    { type: 'text-delta', index: 0, text: '`js\nconst a = 1\n' },
    { type: 'text-delta', index: 0, text: '```\n' },
    { type: 'text-delta', index: 0, text: '现在运行测试。\n' },
  ])
  // The pet's own speech rule merges a sentence shorter than four letters into the next one, so the two
  // prose lines around the dropped code block become a single utterance.
  assert.deepEqual(sentences, ['改好了。 现在运行测试。'], 'code is not read aloud, the prose around it is')
})

test('markdown decoration and links read as plain sentences', async () => {
  const { sentences } = await read([
    { type: 'text-delta', index: 0, text: '## 结论\n' },
    { type: 'text-delta', index: 0, text: '- **已完成** [计时器](https://example.com/timer) 的改动。\n' },
    { type: 'text-delta', index: 0, text: '| 文件 | 状态 |\n' },
    { type: 'text-delta', index: 0, text: '下一步用 `npm test` 验证。\n' },
  ])
  assert.deepEqual(sentences, ['结论 已完成 计时器 的改动。', '下一步用 npm test 验证。'], 'a short heading merges with the sentence it introduces')
})

test('a JSON answer is read from its string values, and code stays out', async () => {
  const answer = [
    '这是三个版本：\n',
    '```json\n',
    '{ "versions": [\n',
    '  { "id": "v1", "tone": "克制", "text": "我不贪心，只要你分我一点时间。" },\n',
    '  { "id": "v2", "tone": "俏皮", "text": "你别急着走，再坐一会儿嘛。" },\n',
    '  { "id": "v3", "api": "https://example.com/x", "count": 3 }\n',
    '] }\n',
    '```\n',
    '挑一个喜欢的告诉我。\n',
  ]
  const { sentences } = await read(answer.map(text => ({ type: 'text-delta', index: 0, text })))
  const spoken = sentences.join(' ')
  assert.equal(spoken.includes('我不贪心，只要你分我一点时间。'), true, `a JSON answer speaks its prose, got ${JSON.stringify(sentences)}`)
  assert.equal(spoken.includes('你别急着走，再坐一会儿嘛。'), true, 'every string value is read in order')
  assert.equal(spoken.includes('v1') || spoken.includes('克制'), false, 'identifiers and labels stay out of the reading')
  assert.equal(spoken.includes('example.com'), false, 'a URL is not read aloud')
  assert.equal(spoken.includes('挑一个喜欢的告诉我。'), true, 'the prose after the block still reads')

  // An untagged block whose body is not JSON stays dropped, and so does a code block tagged as one.
  const code = await read([
    { type: 'text-delta', index: 0, text: '看一下：\n```\n{"a": 1}\nplain text line\n```\n' },
    { type: 'text-delta', index: 0, text: '```python\nprint("我不该被念")\n```\n' },
  ])
  assert.deepEqual(code.sentences, ['看一下：'], `only the prose around code is read, got ${JSON.stringify(code.sentences)}`)
})

test('an interrupted stream is not spoken to its end', async () => {
  const sentences = []
  async function* source() {
    yield { type: 'text-delta', index: 0, text: '第一句完成了。第二句还' }
    throw new Error('provider failed')
  }
  await assert.rejects(async () => { for await (const chunk of observeProse(source(), { sessionId: 'session-1' }, () => ({ sentenceChars: 100, sentence: text => sentences.push(text), bubble: () => {}, done: () => {} }), 'session-1')) void chunk }, /provider failed/)
  assert.deepEqual(sentences, ['第一句完成了。'], 'only the finished sentence was spoken')
})

test('the four mouth shapes map to the model\'s own mouth parameter', async () => {
  const { MOUTH_PARAMETER, MOUTH_OPENING, mouthOpening } = await import('../src/mouth-shapes.mjs')
  assert.deepEqual(Object.keys(MOUTH_OPENING).sort(), ['a', 'i', 'm', 'o'], 'the authored poses are the four shapes')
  assert.equal(mouthOpening('a'), 1, 'an open vowel opens the mouth fully')
  assert.equal(mouthOpening('m') < 0.05, true, 'a closed shape closes it')
  assert.equal(mouthOpening('a') > mouthOpening('o'), true, 'the shapes stay ordered by how far they open')
  assert.equal(mouthOpening('o') > mouthOpening('i'), true)
  assert.equal(mouthOpening('i') > mouthOpening('m'), true)
  assert.equal(mouthOpening('i', 0.55), mouthOpening('i') * 0.55, 'a recipe weight scales the opening')
  assert.equal(mouthOpening('i', 4), mouthOpening('i'), 'a weight above one cannot over-open the mouth')
  assert.equal(mouthOpening('i', Number.NaN), mouthOpening('i'), 'a broken weight falls back to full')
  assert.equal(mouthOpening('unknown'), mouthOpening('m'), 'an unknown shape is a closed mouth, never a crash')
  assert.equal(MOUTH_PARAMETER.cubism4, 'ParamMouthOpenY')
  assert.equal(MOUTH_PARAMETER.cubism2, 'PARAM_MOUTH_OPEN_Y')
})

test('the mouth driver applies each cue with its own weight', async () => {
  const { MouthCues } = await import('../src/mouth-cues.mjs')
  const applied = []
  let clock = 0
  const mouth = new MouthCues((shape, weight) => { applied.push([shape, weight]) }, ['a', 'o', 'i', 'm'], 'm')
  mouth.start({ duration: 3, cues: [{ time: 0, shape: 'm' }, { time: 1, shape: 'i', weight: 0.5 }, { time: 2, shape: 'a' }] }, () => clock)
  clock = 1.5; mouth.update()
  clock = 2.5; mouth.update()
  assert.deepEqual(applied, [['m', 1], ['i', 0.5], ['a', 1]], 'each cue carries the weight it was authored with')
  clock = 3; mouth.update()
  assert.equal(mouth.active, false, 'reaching the end releases the mouth')
  assert.equal(applied.at(-1)[0], 'm', 'and returns it to neutral')
})


test('the streaming caption follows the unfinished line', async () => {
  const { bubbles } = await read([
    { type: 'text-delta', index: 0, text: '第一句。' },
    { type: 'text-delta', index: 0, text: '第二句正在' },
    { type: 'text-delta', index: 0, text: '生成' },
  ])
  assert.equal(bubbles.at(-1), '第一句。第二句正在生成', 'the caption shows the text as it streams')
  assert.equal(bubbles.some(text => text.includes('```')), false)
})

test('the prose filter reports clean lines and drops table rows', () => {
  const filter = createProseFilter()
  assert.equal(filter.push('| a | b |\n'), '', 'a table row carries no prose')
  assert.equal(filter.push('正文 **粗体**\n'), '正文 粗体\n')
  assert.equal(filter.display(), '正文 粗体\n')
})
