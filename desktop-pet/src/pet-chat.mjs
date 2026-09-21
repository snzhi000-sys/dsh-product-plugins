/**
 * Compact pet input shares the Host's latest conversation; reply lifetime follows playback acknowledgement.
 *
 * The bubble has one producer: the pet's own reply. The main agent's prose is spoken while the pet broadcasts it
 * but never written here, and a read-out never captions at all, so text the person asked to hear cannot overwrite
 * what the character is saying (2026-09-20).
 *
 * A press always answers. The busy flags this page holds arrive on the event stream, so they can outlive the
 * Host's own turn; a refusal therefore asks the Host what it is really doing, and every failure says why instead
 * of leaving the message sitting in the box as if the button were dead (reported 2026-09-21).
 */
import { conversationApi as api } from './conversation-api.mjs'
import { renderBubbleText } from './bubble-text.mjs'
export function mountPetChat(bubble, command, onInputFocus) {
  const form = document.getElementById('pet-chat'), input = document.getElementById('pet-input'), send = form.querySelector('button')
  const toggle = document.querySelector('[data-action="chat"]'), events = new EventSource('/desktop-pet/api/conversation/events')
  let open = false, sending = false, generating = false, recording = false, disposed = false, timer, sessionId, held = false
  const show = text => { renderBubbleText(bubble, text); bubble.scrollTop = bubble.scrollHeight }
  // `aria-disabled` rather than `disabled`: a disabled button swallows the press completely, so a person cannot
  // tell "the pet is busy" from "this button is broken". The control stays clickable and every press answers.
  const busy = () => sending || generating || recording
  const render = () => {
    send.setAttribute('aria-disabled', String(busy()))
    send.textContent = sending ? '发送中…' : '发送'
    input.placeholder = sending ? '正在发送…' : generating ? '正在回复…' : '想聊些什么？'
  }
  render()
  const reply = value => {
    clearTimeout(timer); held = true; show(value.text || '正在想…')
    if (value.generating || value.speaking) return
    if (value.voiced) { held = false; show(''); return }
    timer = setTimeout(() => { held = false; show('') }, Math.min(10000, Math.max(2000, [...value.text].length * 220)))
  }
  events.addEventListener('state', e => { const state = JSON.parse(e.data); if (sessionId !== state.session.id) { clearTimeout(timer); held = false; show(''); sessionId = state.session.id } generating = state.generating; recording = Boolean(state.recording); render(); if (state.reply && (state.reply.generating || state.reply.speaking)) reply(state.reply) })
  events.addEventListener('reply', e => reply(JSON.parse(e.data)))
  events.addEventListener('notice', e => { if (!held) local(JSON.parse(e.data).message) })
  // The broadcast caption is deliberately not shown here. This bubble is the pet's own conversation: sharing it
  // with the main agent's prose brought back a caption the person had already dismissed and kept one on screen
  // after the speech that produced it had ended (2026-09-20). The prose is still spoken while broadcast is on.
  events.onerror = () => { clearTimeout(timer); held = false; local('连接中断，正在重连…') }
  // `force` is for the answer to the person's own press: a held reply must not swallow the reason their message
  // did not go out, while background notices still wait for the character to finish speaking.
  function local(text, force = false) { if ((held && !force) || disposed) return; clearTimeout(timer); show(text); timer = setTimeout(() => show(''), 2800) }
  /**
   * Whether the Host really is busy, asked rather than assumed.
   * @returns true when the message must wait, after the reason has been shown.
   */
  const blocked = async () => {
    if (!generating && !recording) return false
    const live = await api().catch(() => null)
    if (live) { generating = Boolean(live.generating); recording = Boolean(live.recording); render() }
    if (!generating && !recording) return false
    local(generating ? '上一条还在回复，等它说完或先按停止。' : '正在录音，先结束录音再发。', true)
    return true
  }
  const submit = async () => {
    const text = input.value.trim(); if (!text || sending) return
    // The press is acknowledged before anything is asked, so the control never looks dead while it waits.
    sending = true; render()
    try {
      if (await blocked()) return
      // The request only hands over the message; the reply arrives on the stream. The bound keeps a stalled
      // connection from leaving the box saying 发送中… with the text still in it and no way out.
      await api('/send', { text }, { signal: AbortSignal.timeout(30_000) })
      if (!disposed) input.value = ''
    } catch (error) { local(error?.name === 'TimeoutError' ? '发送超时了，请再试一次。' : error?.message || '发送失败', true) }
    finally { sending = false; if (!disposed) render() }
  }
  form.onsubmit = e => { e.preventDefault(); void submit() }
  input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); void submit() } }
  const updateFocus = () => onInputFocus(open && document.hasFocus() && document.activeElement === input)
  input.addEventListener('focus', updateFocus)
  input.addEventListener('blur', updateFocus)
  window.addEventListener('focus', updateFocus)
  window.addEventListener('blur', updateFocus)
  return {
    local,
    async toggle() {
      const next = !open
      await command({ action: 'chat-input', open: next })
      if (disposed) return
      open = next; form.hidden = !open; document.body.classList.toggle('chat-open', open); toggle.textContent = open ? '关闭聊天' : '聊天'
      if (open) input.focus(); else input.blur()
      updateFocus()
    },
    dispose() { disposed = true; clearTimeout(timer); events.close(); form.onsubmit = null; input.onkeydown = null; input.removeEventListener('focus', updateFocus); input.removeEventListener('blur', updateFocus); window.removeEventListener('focus', updateFocus); window.removeEventListener('blur', updateFocus); onInputFocus(false) },
  }
}
