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
    [14, 0],
    [19, 20],
    [24, 17],
    [58, 0],
    [2, 0],
    [3, 0],
    [5, 0],
    [7, 0],
    [9, 0],
    [10, 0],
    [11, 0],
    [12, 0],
    [15, 0],
    [16, 0],
    [27, 0],
    [28, 0],
    [29, 0],
    [30, 0],
    [34, 0],
    [36, 0],
    [37, 0],
    [39, 0],
    [41, 0],
    [42, 0],
    [43, 0],
    [44, 0],
    [45, 0],
    [48, 0],
    [49, 0],
    [50, 0],
    [51, 0],
    [53, 0],
    [54, 0],
    [55, 0],
    [62, 0],
    [63, 0],
    [64, 0],
    [65, 0],
    [66, 0],
    [67, 0],
    [68, 0],
  ]) {
    const saved = cleanSettings({ scene: oldId, intensity: 1.7, palette: 7, liveMode: true })
    assert.equal(saved.scene, newId)
    assert.equal(saved.intensity, 1.7)
    assert.equal(saved.palette, 7)
    assert.equal(saved.liveMode, false)
  }
})

test('automatic motion ignores bass fluctuations without detected beats', () => {
  const motion = new Motion()
  for (let i = 0; i < 600; i++) {
    motion.update(1 / 60, { ...silent, bass: i % 20 < 10 ? 0.9 : 0.3 }, defaults)
  }
  assert.equal(motion.phases[0], 0)
  assert.ok(motion.velocities.every((v) => v === 0))
})
test('Vortex and Data Tunnel advance slowly with short non-stacking beat impulses', () => {
  const simulate = (scene, tunnelTravel = 0.35) => {
    const motion = new Motion()
    for (let i = 0; i < 600; i++)
      motion.update(
        1 / 60,
        { ...silent, bass: 0.9, beat: i % 30 === 0 ? 1 : 0, beatId: Math.floor(i / 30) + 1 },
        { ...defaults, scene, tunnelTravel, speed: 1.5 },
      )
    return motion
  }
  const normal = simulate(4)
  for (const scene of [1, 32]) {
    const tunnel = simulate(scene)
    assert.ok(tunnel.phases[2] < normal.phases[2] * 0.35)
    assert.ok(tunnel.phases[2] > 0)
    assert.equal(simulate(scene, 0).phases[2], 0)
  }
})
