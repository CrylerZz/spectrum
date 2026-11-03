import test from 'node:test'
import assert from 'node:assert/strict'
import { MusicalForm, shouldAdvanceScene } from '../src/visuals/MusicalForm.js'
import { DynamicMix } from '../src/visuals/DynamicMix.js'
import { defaults, scenes, cleanSettings } from '../src/visuals/scenes.js'
import { sceneDirections } from '../src/visuals/sceneDirection.js'
const quiet = { level: 0.06, bass: 0.03, mid: 0.08, high: 0.04, beat: 0 }
const loud = { level: 0.9, bass: 0.85, mid: 0.8, high: 0.7, beat: 1 }
const run = (form, audio, seconds) => {
  for (let i = 0; i < seconds * 60; i++) form.update(1 / 60, audio)
  return form
}

test('an isolated kick stays an accent; a sustained drop builds composition and colour', () => {
  const short = new DynamicMix(),
    long = new DynamicMix(),
    settings = { ...defaults, dynamicMix: true }
  for (let i = 0; i < 180; i++) short.update(1 / 60, quiet, settings)
  const calm = [...short.output.dynamicColors]
  for (let i = 0; i < 6; i++) short.update(1 / 60, loud, settings)
  assert.ok(short.energy < 0.25)
  assert.notEqual(short.output.dynamicColors[0], settings.dynamicHotColor)
  assert.ok(short.impact > 0.7)
  for (let i = 0; i < 240; i++) long.update(1 / 60, loud, settings)
  assert.ok(long.energy > 0.9)
  assert.notDeepEqual(long.output.dynamicColors, calm)
  assert.equal(long.output.dynamicColors[0], settings.dynamicHotColor)
})
test('passage estimates follow intro, drop, sustained intensity and break without chattering', () => {
  const form = run(new MusicalForm(), quiet, 4)
  assert.equal(form.phase, 'intro')
  let sawDrop = false
  for (let i = 0; i < 240; i++) {
    form.update(1 / 60, loud)
    sawDrop ||= form.phase === 'drop'
  }
  assert.equal(sawDrop, true)
  assert.equal(form.phase, 'drive')
  run(form, quiet, 3)
  assert.equal(form.phase, 'break')
  const phase = form.phase
  for (let i = 0; i < 6; i++) form.update(1 / 60, loud)
  assert.equal(form.phase, phase)
  const energy = form.energy
  for (let i = 0; i < 60; i++) form.update(1 / 60, loud, true)
  assert.equal(form.energy, energy)
})
test('autopilot waits for a phrase but never waits indefinitely for beats', () => {
  assert.equal(shouldAdvanceScene(23, 24, { boundary: true }), false)
  assert.equal(shouldAdvanceScene(25, 24, { boundary: false, phase: 'flow' }), false)
  assert.equal(shouldAdvanceScene(25, 24, { boundary: true }), true)
  assert.equal(shouldAdvanceScene(32, 24, { boundary: false, phase: 'flow' }), true)
  assert.equal(shouldAdvanceScene(25, 24, { boundary: false, phase: 'silence' }), true)
})
test('every scene has bounded art direction and transition preferences survive presets', () => {
  assert.deepEqual(
    [...sceneDirections.keys()].sort((a, b) => a - b),
    scenes.map((s) => s.id).sort((a, b) => a - b),
  )
  for (const profile of sceneDirections.values()) {
    assert.ok(profile.motion.every((v) => v > 0 && v <= 1))
    assert.ok(profile.exposure > 0 && profile.exposure <= 1)
    assert.ok(profile.note.length > 20)
  }
  assert.equal(cleanSettings({ transitionStyle: 'fade' }).transitionStyle, 'fade')
  assert.equal(cleanSettings({ transitionStyle: 'unexpected' }).transitionStyle, 'breathe')
})
test('one hour of musical history keeps constant-size state and finite envelopes', () => {
  const form = new MusicalForm()
  const keys = Object.keys(form)
  for (let i = 0; i < 3600 * 60; i++) form.update(1 / 60, i % 1200 < 600 ? quiet : loud)
  assert.deepEqual(Object.keys(form), keys)
  assert.ok(form.energy >= 0 && form.energy <= 1)
  assert.ok(form.color >= 0 && form.color <= 1)
  assert.ok(form.beats >= 0 && form.beats < 4)
})
