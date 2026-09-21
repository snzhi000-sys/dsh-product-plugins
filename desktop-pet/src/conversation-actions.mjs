/** Conversation gestures reuse authored playback and yield to direct user interaction. */
import { matchAction } from './satellites.mjs'
export function conversationActions(renderer, available, onError) {
  let owned = false, interrupted = false, speaking = false
  const stop = () => { if (owned) { renderer.cancelSpeaking(); renderer.cancelAutomatic() }; owned = false }
  return {
    get speaking() { return speaking },
    beginSpeech() { stop(); speaking = true; renderer.setSpeaking(true) },
    endSpeech() { stop(); speaking = false; renderer.setSpeaking(false) },
    /**
     * @param text - the words being spoken, matched against the configured keywords.
     * @param keywords - legacy per-model keywords.
     * @param presets - saved variants per model.
     * @returns whether an action took over the character, which the player reports as a mouth-diagnostics fact.
     */
    play(text, keywords, presets) {
      if (interrupted || !available() || !['idle','automatic','speaking'].includes(renderer.state)) return false
      const action = matchAction(text, renderer.info.actionModules, keywords?.[renderer.info.id], presets?.[renderer.info.id])
      if (!action) return false
      stop(); renderer.cancelAutomatic(); owned = true
      Promise.resolve(speaking ? renderer.playSpeaking(action) : renderer.playAutomatic(action)).catch(onError)
      return true
    },
    interrupt() { interrupted = true; stop() },
    reset() { this.endSpeech(); interrupted = false },
    dispose() { this.endSpeech() },
  }
}
