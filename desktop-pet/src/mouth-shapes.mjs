/**
 * The authored four mouth shapes as Live2D parameters. Live2D models ship no per-shape mouth animation, so the
 * shapes are expressed as how far the mouth opens — the same approximation the DragonBones path makes with its
 * authored poses, and no phoneme-precision claim either.
 *
 * Only the open parameter is driven. `ParamMouthForm` exists on many models but reads as a smile, and writing it
 * from a vowel guess changes the face rather than the mouth.
 */

/** Each shape's fraction of a fully open mouth. */
export const MOUTH_OPENING = Object.freeze({ a: 1, o: .72, i: .34, m: .02 })

/**
 * The parameter value for one shape at one weight.
 * @param shape - `a`, `o`, `i`, or `m`.
 * @param weight - the cue's weight from the configured mouth recipe.
 * @returns the mouth-open value the model expects, 0 to 1.
 */
export function mouthOpening(shape, weight = 1) {
  const base = MOUTH_OPENING[shape] ?? MOUTH_OPENING.m
  const scaled = Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 1
  return base * scaled
}

/** The parameter name per engine: cubism 4 names it `ParamMouthOpenY`, cubism 2 `PARAM_MOUTH_OPEN_Y`. */
export const MOUTH_PARAMETER = Object.freeze({ cubism2: 'PARAM_MOUTH_OPEN_Y', cubism4: 'ParamMouthOpenY' })
