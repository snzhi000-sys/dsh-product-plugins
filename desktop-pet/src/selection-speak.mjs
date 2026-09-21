/**
 * Reading a selection aloud.
 *
 * The official client offers no selection affordance at all — the only first-party code that looks at a selection
 * guards its own click and hover handlers against one — and its slot surface has no transcript-overlay seat, so
 * the button that appears over selected text belongs to this plugin. It is offered in two places that share one
 * implementation: a floating pill over a selection in the conversation panel, and a pill contributed into the
 * file browser's own selection bubble so that 引用 and 朗读 sit side by side.
 *
 * The conversation-panel pill is plain DOM, because it has to survive independently of any React tree; the
 * contributed one is a React component, because another plugin renders it. Both speak through the same host route
 * and read the same playing state, so they cannot disagree about what is being read.
 */

/** The host's read-out owner for selected text; the shared read-out store keys the playing state by this id. */
export const SELECTION_OWNER = 'selection'

/**
 * The conversation slot keys a selection may come from.
 *
 * The official renderer wraps every slot in `[data-slot="<key>"]`, so the frame around the transcript is a stable,
 * official anchor rather than a class name. Only these keys are accepted: a selection anywhere else in the app —
 * the file browser has its own bubble, the composer is excluded below — must not raise this button.
 */
const CONVERSATION_SLOTS = ['conversation.view', 'conversation.session', 'conversation.content']

/** Slot prefixes that mean "the composer": a draft is not something to read out on selection. */
const COMPOSER_SLOTS = ['conversation.composer', 'conversation.input']

/** The longest selection the pill offers; the host rejects anything longer, so the two limits stay equal. */
const MAX_SELECTION = 5000

/** How long a failed read-out explains itself in the pill before the label returns. */
const ERROR_MS = 4000

/** The pill's look: the same pill and tokens the file browser's 引用 bubble uses. */
export const SELECTION_SPEAK_STYLE = `
.dsh-pet-speakpill{display:inline-flex;align-items:center;height:30px;padding:0 12px;border:0;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1;white-space:nowrap;cursor:pointer;box-shadow:var(--dsw-elevation-soft)}
/* The pill sets its own display, which would otherwise beat the hidden attribute's display:none. */
.dsh-pet-speakpill[hidden]{display:none}
.dsh-pet-speakpill:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
.dsh-pet-speakpill:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-label-primary) 45%,transparent);outline-offset:2px}
.dsh-pet-speakpill[data-playing="true"]{color:var(--dsw-alias-state-business-primary)}
.dsh-pet-speakpill[data-error="true"]{color:var(--dsw-alias-state-error-primary)}
.dsh-pet-speakpill-float{position:fixed;z-index:81}
`

/** How much of a failure the pill itself shows; the complete message stays in its tooltip. */
const ERROR_CHARS = 28

/** @param message - the host's explanation. @returns as much of it as fits in a pill. */
const shorten = message => (message.length > ERROR_CHARS ? `${message.slice(0, ERROR_CHARS)}…` : message)

/** @param node - a selection endpoint. @returns the nearest `[data-slot]` key, or null outside the app shell. */
function nearestSlot(node) {
  let element = node?.nodeType === 1 ? node : node?.parentElement
  while (element) {
    const slot = element.getAttribute?.('data-slot')
    if (slot) return slot
    element = element.parentElement
  }
  return null
}

/** @param node - a selection endpoint. @returns whether any ancestor is the composer or one of its controls. */
function insideComposer(node) {
  let element = node?.nodeType === 1 ? node : node?.parentElement
  while (element) {
    if (element.hasAttribute?.('data-composer-input')) return true
    const slot = element.getAttribute?.('data-slot')
    if (slot && COMPOSER_SLOTS.some(prefix => slot === prefix || slot.startsWith(`${prefix}.`))) return true
    element = element.parentElement
  }
  return false
}

/** @param node - a selection endpoint. @returns whether the selection sits inside the conversation panel. */
function insideConversation(node) {
  let element = node?.nodeType === 1 ? node : node?.parentElement
  while (element) {
    const slot = element.getAttribute?.('data-slot')
    if (slot && CONVERSATION_SLOTS.includes(slot)) return true
    element = element.parentElement
  }
  return false
}

/**
 * The selected text and where it sits, when the selection is one this pill should offer.
 *
 * Both endpoints must be in the conversation panel: a half-selected outside range has no single owner, and the
 * panel is the only place whose text this pill is responsible for.
 * @returns `{ text, rect }`, or null when there is nothing to offer.
 */
export function conversationSelection() {
  const selection = typeof window === 'undefined' ? null : window.getSelection?.()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (insideComposer(range.startContainer) || insideComposer(range.endContainer)) return null
  if (!insideConversation(range.startContainer) || !insideConversation(range.endContainer)) return null
  // Whitespace is normalised here so the pill speaks what the person sees as one passage; the host repeats it.
  const text = selection.toString().replace(/\s+/gu, ' ').trim()
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return null
  // A selection longer than the host accepts is not offered at all: showing a pill that can only fail would be
  // worse than not offering it, and silently reading a prefix of what was selected is worse still.
  if (text.length > MAX_SELECTION) return null
  return { text, rect: range.getBoundingClientRect() }
}

/**
 * Build the two mounts of the selection read-aloud control.
 * @param options - `api` posts to the pet's host, `readout` is the shared read-out store, `React` renders the pill
 *   that another plugin's tree will mount.
 * @returns the stylesheet, the contributed pill, and the conversation-panel mount.
 */
export function createSelectionSpeak({ api, readout, React }) {
  /** Ask the host to read this text. A failure carries the host's own explanation, which the caller shows. */
  const start = text => api('selection/speak', { text })
  /** Stop the current read-out, whichever control owns it: the person pressed the pill that is playing. */
  const stop = () => api('conversation/stop', { speechOnly: true })
  const speaking = () => readout.has(SELECTION_OWNER)
  const label = () => (speaking() ? '停止' : '朗读')
  const hint = () => (speaking() ? '停止朗读' : '用桌宠的声音朗读选中的内容')
  const press = async (text, report) => {
    try {
      if (speaking()) await stop()
      else await start(text)
      report('')
    } catch (error) { report(error instanceof Error ? error.message : String(error)) }
  }

  /**
   * The pill another plugin mounts: it receives the selected text and the file it came from.
   * @param props - `{ text }` from the selection bubble; the remaining props describe where the text came from.
   */
  const ContributedPill = props => {
    const [, force] = React.useReducer(value => value + 1, 0)
    const [message, setMessage] = React.useState('')
    React.useEffect(() => readout.subscribe(force), [])
    const playing = speaking()
    return React.createElement('button', {
      type: 'button',
      className: 'dsh-pet-speakpill',
      'data-playing': String(playing),
      'data-error': String(Boolean(message)),
      title: message || hint(),
      'aria-label': message || hint(),
      'aria-pressed': String(playing),
      // Pointer down must not collapse the selection the bubble was raised for.
      onPointerDown: event => { event.preventDefault() },
      onClick: () => { void press(props.text, setMessage) },
    }, message ? shorten(message) : label())
  }

  /**
   * Mount the conversation-panel pill on the document, and keep it where the selection is.
   * @returns a disposer that removes the pill and every listener it added.
   */
  const mountConversation = () => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'dsh-pet-speakpill dsh-pet-speakpill-float'
    button.hidden = true
    document.body.append(button)
    let current = null, message = '', timer
    const render = () => {
      const playing = speaking()
      button.dataset.playing = String(playing)
      button.dataset.error = String(Boolean(message))
      button.textContent = message ? shorten(message) : label()
      button.title = message || hint()
      button.setAttribute('aria-label', button.title)
      button.setAttribute('aria-pressed', String(playing))
    }
    const hide = () => { current = null; button.hidden = true }
    const place = () => {
      const rect = current?.rect
      if (!rect) return
      const height = 30, gap = 8, width = button.offsetWidth || 96
      const above = rect.top - gap - height
      const top = above >= 8 ? above : Math.min(window.innerHeight - height - 8, rect.bottom + gap)
      button.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
      button.style.top = `${Math.max(8, top)}px`
    }
    // The selection is re-read on every event rather than remembered: scrolling moves the text under a selection
    // that is still live, and a stale rectangle would leave the pill pointing at nothing.
    const sync = () => {
      const found = conversationSelection()
      if (!found) return hide()
      current = found
      button.hidden = false
      place()
      render()
    }
    // Pointer down on the pill must not collapse the selection it was raised for.
    button.addEventListener('pointerdown', event => event.preventDefault())
    button.addEventListener('click', () => {
      void press(current?.text ?? '', value => {
        message = value
        render()
        clearTimeout(timer)
        if (value) timer = setTimeout(() => { message = ''; render() }, ERROR_MS)
      })
    })
    const unsubscribe = readout.subscribe(render)
    document.addEventListener('selectionchange', sync)
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    render()
    return () => {
      clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('selectionchange', sync)
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
      button.remove()
    }
  }

  return { style: SELECTION_SPEAK_STYLE, pill: ContributedPill, mountConversation }
}
