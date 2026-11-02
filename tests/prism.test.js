import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanSettings, scenes } from '../src/visuals/scenes.js'
import { PrismDynamics } from '../src/visuals/PrismDynamics.js'
function profile(audio, seconds = 8) {
  const p = new PrismDynamics()
  for (let i = 0; i < seconds * 60; i++) p.update(1 / 60, audio)
  return p
}
test('Prism distinguishes intro, bright mids, fuller music and heavy peaks', () => {
  const intro = profile({ bass: 0.12, mid: 0.03, high: 0.01 })
  const bright = profile({ bass: 0.34, mid: 0.62, high: 0.44 })
  const fuller = profile({ bass: 0.55, mid: 0.51, high: 0.43 })
  const peak = profile({ bass: 0.72, mid: 0.72, high: 0.57 })
  assert.ok(intro.level < 0.1)
  assert.ok(bright.level > intro.level && bright.level < fuller.level)
  assert.ok(peak.level > 0.9)
  assert.ok(profile({ bass: 0, mid: 1, high: 1 }).level <= 0.6)
})
test('Prism fades between levels, retains fine band response and respects freeze', () => {
  const p = profile({ bass: 0.8, mid: 0.8, high: 0.8 })
  const peak = p.level
  p.update(1 / 60, { bass: 0, mid: 0, high: 0 })
  assert.ok(p.level > peak * 0.95)
  const before = p.snapshot()
  p.update(1, { bass: 0, mid: 0, high: 0 }, true)
  assert.deepEqual(p.snapshot(), before)
  for (let i = 0; i < 900; i++) p.update(1 / 60, { bass: 0, mid: 0, high: 0 })
  assert.ok(p.level < 0.001)
})

test('five new Prism compositions preserve the original and persist chosen levels', () => {
  assert.equal(scenes.find((scene) => scene.id === 8).name, 'Prisme')
  assert.equal(scenes.filter((scene) => scene.id >= 70).length, 5)
  for (let level = 0; level <= 5; level++)
    assert.equal(cleanSettings({ prismLevel: level }).prismLevel, level)
  assert.equal(cleanSettings({ prismLevel: 99 }).prismLevel, 5)
  assert.equal(cleanSettings({ prismLevel: -2 }).prismLevel, 0)
})
