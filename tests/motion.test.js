import test from 'node:test'
import assert from 'node:assert/strict'
import { Motion } from '../src/visuals/Motion.js'
import { defaults, cleanSettings, scenes } from '../src/visuals/scenes.js'
const silent = { bass: 0, mid: 0, high: 0, beat: 0, beatId: 0 }

test('live mode suppresses automatic hits, keeps motion and separates pads', () => {
  const m = new Motion(),
    settings = { ...defaults, liveMode: true }
  m.update(1 / 60, { ...silent, bass: 1, beat: 1, beatId: 1 }, settings)
  assert.equal(m.impact, 0)
  assert.equal(m.flash, 0)
  assert.ok(m.phases[2] > 0)
  m.trigger('strike', settings)
  assert.ok(m.impact > 0)
  assert.equal(m.flash, 0)
  m.trigger('flash', settings)
  assert.equal(m.flash, 1)
  m.trigger('explosion', settings)
  assert.equal(m.explosion, 1)
  m.setBoost(true, settings)
  for (let i = 0; i < 60; i++) m.update(1 / 60, silent, settings)
  assert.ok(m.boost > 0.9)
  m.setBoost(false, settings)
  for (let i = 0; i < 120; i++) m.update(1 / 60, silent, settings)
  assert.ok(m.boost < 0.001)
  const snapshot = m.snapshot(),
    other = new Motion()
  other.restore(snapshot)
  assert.deepEqual(other.snapshot(), snapshot)
  settings.liveMode = false
  m.update(1 / 60, { ...silent, beat: 1, beatId: 2 }, settings)
  assert.ok(m.impact > 0)
  assert.equal(m.explosion, 0)
})

test('frozen and blacked out views cannot queue manual effects', () => {
  for (const state of ['frozen', 'blackout']) {
    const m = new Motion(),
      s = { ...defaults, liveMode: true, [state]: true }
    m.trigger('strike', s)
    m.trigger('flash', s)
    m.trigger('explosion', s)
    m.setBoost(true, s)
    assert.equal(m.impact, 0)
    assert.equal(m.flash, 0)
    assert.equal(m.explosion, 0)
    assert.equal(m.boostHeld, false)
  }
})

test('every scene survives preset cleaning, removed scenes migrate without losing tuning', () => {
  for (const scene of scenes) assert.equal(cleanSettings({ scene: scene.id }).scene, scene.id)
  for (const [oldId, newId] of [
    [13, 8],
    [14, 9],
    [19, 20],
    [24, 17],
  ]) {
    const saved = cleanSettings({ scene: oldId, intensity: 1.7, palette: 7, liveMode: true })
    assert.equal(saved.scene, newId)
    assert.equal(saved.intensity, 1.7)
    assert.equal(saved.palette, 7)
    assert.equal(saved.liveMode, false)
  }
})
