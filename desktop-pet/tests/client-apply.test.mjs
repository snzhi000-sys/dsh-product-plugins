/**
 * The client bundle must do more than register: the Harness loader calls `apply`, so a body that throws
 * there surfaces only in the assembled app ("Failed to load plugins"). Applying against a document catches
 * that here — an initialization-order mistake did exactly this on 2026-09-18.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mountPanel } from './panel-harness.mjs'

test('the classic client factory applies against a document without throwing', () => {
  const panel = mountPanel()
  try {
    assert.equal(panel.id, 'dsh-desktop-pet')
    assert.equal(panel.isComponent, true, 'the plugin registers a main panel component')
    assert.equal(panel.requests.length > 0, true, 'the mounted panel reads its settings')
    // The pet reads only the conversation on screen, so the client has to say which one that is.
    assert.deepEqual(panel.focusReports.at(-1), JSON.stringify({ sessionId: 'session-active' }), 'the client reports the session the main view retains')
  } finally {
    panel.close()
  }
})

// The picker's watchers tear down through the shell's module table, which this stub cannot provide, so a
// successful run would leave handles open. `node --test` gives every file its own process, and the exit
// code still carries any failure reported above.
setTimeout(() => process.exit(process.exitCode ?? 0), 500)
