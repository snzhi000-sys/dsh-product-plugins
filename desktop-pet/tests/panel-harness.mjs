/**
 * Shared jsdom harness for the pet client tests. The bundle is a classic script whose factory runs against
 * the shell's document, React, and slot registry, so both client tests need the same borrowed globals and the
 * same stubs. Keeping them here means a change to that boot contract is made once.
 */
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const source = readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8')

/** Globals the plugin body reads that jsdom must supply instead of the Node host. */
const BORROWED = ['window', 'document', 'navigator', 'fetch', 'location', 'EventSource']

/**
 * Load the built client bundle, apply the plugin against stubs, and mount its main panel.
 * @returns the mounted panel: its id, the requests the body made, the shadow root, and a disposer.
 */
export function mountPanel() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1/' })
  // Some of these are accessor-only on the Node host (navigator, fetch), so every swap goes through
  // defineProperty and is restored from the descriptor this harness saves.
  const saved = BORROWED.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  const borrow = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  const requests = [], posts = [], focusReports = [], cleanups = [], disposers = [], entries = []
  let panel, handoff
  borrow('window', dom.window)
  borrow('document', dom.window.document)
  borrow('navigator', dom.window.navigator)
  borrow('location', dom.window.location)
  borrow('fetch', async (input, init) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? '')
    requests.push(url)
    if (init?.body) posts.push({ url, body: String(init.body) })
    // The client reports the session on screen; a test reads the report back to prove the choice it made.
    if (url.includes('/broadcast/focus') && init?.body) focusReports.push(String(init.body))
    return { ok: true, json: async () => ({}) }
  })
  // The read-out control watches the host's event stream; jsdom ships no EventSource, so the test supplies one
  // and records the streams it opened.
  const streams = []
  class StubEventSource {
    constructor(url) { this.url = String(url); streams.push(this); this.listeners = new Map() }
    addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]) }
    close() { this.closed = true }
  }
  borrow('EventSource', StubEventSource)
  // jsdom implements Selection and Range but not the range's own geometry, which is the only thing the floating
  // pill positions itself from. A fixed rectangle keeps the placement assertion deterministic.
  dom.window.Range.prototype.getBoundingClientRect = function () {
    return { x: 40, y: 120, top: 120, left: 40, right: 200, bottom: 140, width: 160, height: 20 }
  }
  globalThis.__ModuleLoader__ = { load: entry => { handoff = entry } }
  // eslint-disable-next-line no-new-func -- the bundle is a classic script, not an importable module.
  new Function(source)()
  // React arrives through the shell's module table; this stub is enough to render the panel component,
  // which is where the picker body (and any initialization-order mistake in it) actually runs.
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    // The real panel host is already in the layout when its effect runs, so the ref element is attached:
    // the tests read the picker through the document, the way the packaged probes do.
    useRef: () => { const element = dom.window.document.createElement('div'); dom.window.document.body.append(element); return { current: element } },
    // The panel's effect returns the picker's disposer; keeping it is what lets a test end.
    useEffect: callback => { const cleanup = callback(); if (typeof cleanup === 'function') cleanups.push(cleanup) },
    // The per-message control is a stateful component; its hooks only need a stable value here.
    useState: initial => [initial, () => {}],
    useReducer: (_reducer, initial) => [initial, () => {}],
  }
  const plugin = handoff.factory(specifier => {
    if (specifier === 'react') return react
    throw new Error(`unexpected external: ${specifier}`)
  })
  // The panel contributes a sidebar entry and a main panel through the slots registry, and selects its
  // panel when the pet window asks for settings, so the stub provides both seams and records the panel.
  // `inject` is Cordis's "wait for this optional service" fiber: a parked request is satisfied only once the named
  // service exists, which is how the pet contributes into the file browser's selection bubble without caring about
  // activation order. The stub keeps requests parked so a test can prove a missing provider registers nothing.
  const services = new Map()
  const injectRequests = []
  const scopeEffect = callback => { const dispose = callback(); if (typeof dispose === 'function') disposers.push(dispose); return dispose }
  const flushInjects = () => {
    for (const request of injectRequests) {
      if (request.satisfied || !request.deps.every(dep => services.has(dep))) continue
      request.satisfied = true
      const scope = { effect: scopeEffect }
      for (const dep of request.deps) scope[dep] = services.get(dep)
      request.callback(scope)
    }
  }
  plugin.apply({
    effect: scopeEffect,
    get: name => services.get(name),
    inject(deps, callback) {
      const request = { deps: [...deps], callback, satisfied: false }
      injectRequests.push(request)
      flushInjects()
      return () => { const at = injectRequests.indexOf(request); if (at >= 0) injectRequests.splice(at, 1) }
    },
    // The shell's own public signal for the session in the main view: one row retains it, the other does not.
    sessions: {
      list: {
        getSnapshot: () => ({ byId: { 'session-active': { retainedBy: { mainView: 1 } }, 'session-other': { retainedBy: {} } } }),
        subscribe: () => () => {},
      },
    },
    slots: {
      inject: (name, callback) => { callback(); return () => {} },
      register: (definition, Component) => { entries.push({ definition, Component }); if (definition.name === 'main') panel = Component; return () => {} },
    },
    layout: { selectPanel: () => {} },
  })
  const isComponent = typeof panel === 'function'
  if (isComponent) panel()
  return {
    id: handoff.id,
    isComponent,
    requests,
    posts,
    focusReports,
    entries,
    streams,
    injectRequests,
    /** Publish an optional client service, the way the file browser publishes its selection bubble. */
    provide(name, value) { services.set(name, value); flushInjects() },
    window: () => dom.window,
    document: () => dom.window.document,
    shadow: () => dom.window.document.querySelector('[data-plugin="desktop-pet"]').shadowRoot,
    close() {
      for (const cleanup of cleanups.reverse()) cleanup()
      for (const dispose of disposers.reverse()) dispose()
      for (const [name, descriptor] of saved) {
        if (descriptor === undefined) delete globalThis[name]
        else Object.defineProperty(globalThis, name, descriptor)
      }
      delete globalThis.__ModuleLoader__
      dom.window.close()
    },
  }
}
