import test from 'node:test'
import assert from 'node:assert/strict'
import { AutoCalibration } from '../src/audio/AutoCalibration.js'
import { defaults } from '../src/visuals/scenes.js'
import { cleanCalibration } from '../src/audio/calibration.js'

function analyse(hz, amplitude = 180, rate = 48000) {
  const auto = new AutoCalibration()
  const bins = new Uint8Array(1024),
    db = new Float32Array(1024).fill(-100)
  let result
  for (let i = 0; i < 400 && !result; i++) {
    bins.fill(0)
    db.fill(-100)
    for (const tone of [hz, 1000, 7000]) {
      const bin = Math.round((tone * 2048) / rate)
      bins[bin] = amplitude * (i % 30 < 10 ? 1 : 0.5)
      db[bin] = i % 30 < 10 ? -30 : -45
    }
    result = auto.update(bins, db, 1 / 60, rate, 2048, defaults)
  }
  return result
}
test('automatic calibration waits for actual sound without boosting silence', () => {
  const auto = new AutoCalibration()
  const bins = new Uint8Array(1024)
  for (let i = 0; i < 1000; i++)
    assert.equal(auto.update(bins, null, 1 / 60, 48000, 2048, defaults), null)
  assert.equal(auto.progress, 0)
  assert.equal(auto.waiting, true)
})
test('recommendations follow observed frequencies and levels, and remain valid', () => {
  for (const rate of [44100, 48000, 96000]) {
    const low = analyse(70, 180, rate)
    const high = analyse(200, 180, rate)
    assert.ok(low && high)
    assert.ok(high.bassLowHz > low.bassLowHz)
    assert.ok(low.bassLowHz <= 70 && low.bassHighHz >= 70)
    assert.ok(high.bassLowHz <= 200 && high.bassHighHz >= 200)
    const clean = cleanCalibration({ ...defaults, ...low })
    for (const [key, value] of Object.entries(low)) assert.equal(clean[key], value, key)
    assert.ok(low.beatFloor >= -85 && low.beatFloor <= -20)
  }
  assert.ok(analyse(70, 100).bassTrim > analyse(70, 220).bassTrim)
})
test('missing bands keep their current values and reset discards previous samples', () => {
  const auto = new AutoCalibration()
  const bins = new Uint8Array(1024)
  bins[3] = 240
  let result
  for (let i = 0; i < 400 && !result; i++)
    result = auto.update(bins, null, 1 / 60, 48000, 2048, defaults)
  assert.ok(result.bassLowHz)
  assert.equal(result.midLowHz, undefined)
  assert.equal(result.highTrim, undefined)
  auto.update(bins, null, 0.1, 48000, 2048, defaults)
  assert.ok(auto.frames.length)
  auto.reset()
  assert.equal(auto.frames.length, 0)
  assert.equal(auto.progress, 0)
})

test('automatic calibration leaves muted band tuning intact', () => {
  const auto = new AutoCalibration()
  const bins = new Uint8Array(1024).fill(200)
  let patch
  for (let i = 0; i < 400 && !patch; i++)
    patch = auto.update(bins, null, 1 / 60, 48000, 2048, { ...defaults, midEnabled: false })
  assert.ok(patch)
  assert.equal(patch.midTrim, undefined)
  assert.equal(patch.midGate, undefined)
  assert.equal(patch.midLowHz, undefined)
  assert.equal(patch.midEnabled, undefined)
})
