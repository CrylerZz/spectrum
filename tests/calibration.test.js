import test from 'node:test'
import assert from 'node:assert/strict'
import { Features } from '../src/audio/features.js'
import { cleanCalibration, calibrationDefaults } from '../src/audio/calibration.js'
import { cleanSettings, defaults } from '../src/visuals/scenes.js'
import { Motion } from '../src/visuals/Motion.js'

const wave = new Uint8Array(2048).fill(128)
function settle(f, bins, frames = 120) {
  for (let i = 0; i < frames; i++) f.update(bins, wave, 1 / 60, i / 60)
}
test('live Hz edits move a tone between bands at different sample rates', () => {
  for (const rate of [22050, 44100, 48000, 96000]) {
    const f = new Features(rate)
    const bins = new Uint8Array(1024)
    bins[Math.round((1000 * 2048) / rate)] = 220
    settle(f, bins)
    assert.ok(f.values.mid > 0)
    f.configure({ bassLowHz: 900, bassHighHz: 1100, midLowHz: 1200 })
    settle(f, bins)
    assert.ok(f.values.bass > 0.1)
    assert.ok(f.values.mid < 0.001)
    f.configure({ highLowHz: 19000, highHighHz: 20000 })
    settle(f, bins)
    assert.ok(Object.values(f.values).every(Number.isFinite))
    for (const [lo, hi] of f.bands) assert.ok(lo >= 1 && hi > lo && hi <= 1024)
  }
})
test('gain, gate, attack and release control measured band levels', () => {
  const bins = new Uint8Array(1024).fill(60)
  const f = new Features()
  settle(f, bins)
  const base = f.values.mid
  f.configure({ midTrim: 2 })
  settle(f, bins)
  assert.ok(f.values.mid > base * 1.9)
  f.configure({ midGate: 0.3 })
  settle(f, bins)
  assert.ok(f.values.mid < 0.001)
  const fast = new Features(),
    slow = new Features()
  fast.configure({ audioAttack: 5, audioRelease: 10 })
  slow.configure({ audioAttack: 500, audioRelease: 2000 })
  fast.update(bins, wave, 0.05, 0)
  slow.update(bins, wave, 0.05, 0)
  assert.ok(fast.values.mid > slow.values.mid * 5)
  settle(fast, bins)
  settle(slow, bins)
  bins.fill(0)
  fast.update(bins, wave, 0.1, 3)
  slow.update(bins, wave, 0.1, 3)
  assert.ok(slow.values.mid > fast.values.mid * 100)
})
function pulses(config) {
  const f = new Features()
  f.configure(config)
  const bins = new Uint8Array(1024),
    db = new Float32Array(1024).fill(-100)
  for (let i = 0; i < 600; i++) {
    bins.fill(0)
    db.fill(-100)
    if (i % 30 < 5) {
      bins.fill(180, 15, 60)
      db.fill(-35, 15, 60)
    }
    f.update(bins, wave, 1 / 60, i / 60, 1, 1, db)
  }
  return f
}
test('beat band, floor and spacing govern detection independently of visual gain', () => {
  assert.equal(pulses({}).values.beatId, 0)
  const f = pulses({ beatSource: 'mid', midTrim: 0 })
  assert.ok(f.values.beatId >= 18)
  assert.equal(f.values.mid, 0)
  assert.equal(f.values.bpm, 120)
  assert.equal(pulses({ beatSource: 'mid', beatFloor: -20 }).values.beatId, 0)
  assert.ok(pulses({ beatSource: 'mid', beatInterval: 800 }).values.beatId < f.values.beatId)
  const count = f.values.beatId
  f.configure({ beatSource: 'high' })
  f.update(new Uint8Array(1024).fill(255), wave, 1 / 60, 11)
  assert.equal(f.values.beatId, count, 'changing bands must not create a hit')
})
test('calibration persists through settings cleanup and malformed presets remain bounded', () => {
  const settings = cleanSettings({
    midLowHz: 300,
    midHighHz: 1800,
    midTrim: 2.5,
    beatSource: 'mid',
  })
  assert.equal(cleanSettings(JSON.parse(JSON.stringify(settings))).midLowHz, 300)
  assert.equal(settings.midHighHz, 1800)
  assert.equal(settings.midTrim, 2.5)
  assert.equal(settings.beatSource, 'mid')
  const bad = cleanCalibration({
    bassLowHz: 40000,
    bassHighHz: -3,
    midTrim: Infinity,
    audioAttack: NaN,
    beatSource: 'invalid',
  })
  assert.equal(bad.bassLowHz, 19990)
  assert.equal(bad.bassHighHz, 20000)
  assert.equal(bad.midTrim, 1)
  assert.equal(bad.audioAttack, calibrationDefaults.audioAttack)
  assert.equal(bad.beatSource, 'bass')
  const f = new Features()
  const bands = f.bands
  f.configure(calibrationDefaults)
  assert.equal(f.bands, bands, 'unchanged calibration reuses its buffers')
})
test('visual impacts respect the calibrated detector instead of bypassing its threshold', () => {
  const m = new Motion()
  m.update(1 / 60, { bass: 1, mid: 0, high: 0, beat: 0, beatId: 0 }, defaults)
  assert.equal(m.impact, 0)
  m.update(1 / 60, { bass: 1, mid: 0, high: 0, beat: 1, beatId: 1 }, defaults)
  assert.ok(m.impact > 0)
})

test('redistribution between bass notes at constant energy does not create repeated kicks', () => {
  const f = new Features()
  const bins = new Uint8Array(1024)
  for (let i = 0; i < 600; i++) {
    bins.fill(0)
    bins[i % 30 < 15 ? 2 : 5] = 220
    f.update(bins, wave, 1 / 60, i / 60)
  }
  assert.ok(f.values.beatId <= 1, String(f.values.beatId))
})

test('every band combination independently mutes levels, spectrum and overall visual energy', () => {
  for (let mask = 0; mask < 8; mask++) {
    const f = new Features()
    const config = {
      bassEnabled: !!(mask & 1),
      midEnabled: !!(mask & 2),
      highEnabled: !!(mask & 4),
    }
    f.configure(config)
    const bins = new Uint8Array(1024).fill(150)
    const waveform = new Uint8Array(2048).fill(170)
    for (let i = 0; i < 60; i++) f.update(bins, waveform, 1 / 60, i / 60)
    for (const key of ['bass', 'mid', 'high']) {
      if (config[key + 'Enabled']) assert.ok(f.values[key] > 0.1, key)
      else assert.equal(f.values[key], 0, key)
    }
    if (mask === 0) {
      assert.equal(f.values.level, 0)
      assert.equal(f.values.beatId, 0)
      assert.ok(f.spectrum.every((value) => value === 0))
    }
  }
})
test('muting is immediate, saved gains survive re-enabling and auto cannot re-enable a band', () => {
  const f = new Features()
  const bins = new Uint8Array(1024).fill(180)
  f.configure({ midTrim: 1.7, midGate: 0.12 })
  settle(f, bins)
  assert.ok(f.values.mid > 0)
  f.configure({ midTrim: 1.7, midGate: 0.12, midEnabled: false })
  assert.equal(f.values.mid, 0)
  const saved = cleanSettings(JSON.parse(JSON.stringify(f.calibration)))
  assert.equal(saved.midEnabled, false)
  assert.equal(saved.midTrim, 1.7)
  assert.equal(saved.midGate, 0.12)
  f.configure({ ...saved, midEnabled: true })
  settle(f, bins)
  assert.ok(f.values.mid > 0)
  assert.equal(f.calibration.midTrim, 1.7)
})
