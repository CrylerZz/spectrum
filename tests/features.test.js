import test from 'node:test'
import assert from 'node:assert/strict'
import { Features } from '../src/audio/features.js'
import { cleanSettings } from '../src/visuals/scenes.js'

test('bass, voice and treble occupy independent bands at common sample rates', () => {
  for (const rate of [44100, 48000, 96000]) {
    for (const [hz, key] of [
      [80, 'bass'],
      [1000, 'mid'],
      [8000, 'high'],
    ]) {
      const f = new Features(rate)
      const bins = new Uint8Array(1024),
        wave = new Uint8Array(2048).fill(128)
      bins[Math.round((hz * 2048) / rate)] = 255
      for (let i = 0; i < 60; i++) f.update(bins, wave, 1 / 60, i / 60)
      assert.ok(f.values[key] > 0.02, `${rate} Hz: ${key}`)
      for (const other of ['bass', 'mid', 'high'].filter((k) => k !== key))
        assert.equal(f.values[other], 0)
    }
  }
})
test('silence is finite and releases previous levels at different frame rates', () => {
  for (const fps of [30, 60, 144]) {
    const f = new Features(),
      bins = new Uint8Array(1024).fill(240),
      wave = new Uint8Array(2048).fill(160)
    for (let i = 0; i < fps; i++) f.update(bins, wave, 1 / fps, i / fps)
    assert.ok(f.values.level > 0.4)
    bins.fill(0)
    wave.fill(128)
    for (let i = 0; i < fps * 4; i++) f.update(bins, wave, 1 / fps, 1 + i / fps)
    for (const key of ['bass', 'mid', 'high', 'level', 'beat'])
      assert.ok(f.values[key] < 0.001, key)
    assert.equal(f.values.bpm, 0)
    assert.ok(f.spectrum.every((v) => v === 0))
  }
})
test('stable 120 BPM impulses produce an estimate and buffers are reused', () => {
  const f = new Features(),
    bins = new Uint8Array(1024),
    wave = new Uint8Array(2048).fill(128),
    spectrum = f.spectrum
  for (let i = 0; i < 600; i++) {
    bins.fill(0)
    if (i % 30 < 7) bins.fill(255, 1, 7)
    f.update(bins, wave, 1 / 60, i / 60)
  }
  assert.ok(Math.abs(f.values.bpm - 120) <= 2, String(f.values.bpm))
  assert.equal(f.spectrum, spectrum)
})
test('untrusted presets cannot inject invalid shader settings or transient performance state', () => {
  const s = cleanSettings({
    scene: 100,
    palette: -1,
    intensity: NaN,
    speed: 'fast',
    detail: Infinity,
    quality: 'ultra',
    eye: false,
    blackout: true,
    frozen: true,
    auto: true,
  })
  assert.equal(s.scene, 5)
  assert.equal(s.palette, 0)
  assert.equal(s.intensity, 1)
  assert.equal(s.speed, 0.65)
  assert.equal(s.quality, 'auto')
  assert.equal(s.eye, false)
  assert.equal(s.blackout, false)
  assert.equal(s.frozen, false)
  assert.equal(s.auto, true)
  assert.equal(cleanSettings(null).scene, 0)
})

test('waveform transients still detect kicks when compressed FFT levels stay flat', () => {
  const f = new Features()
  const bins = new Uint8Array(1024).fill(180)
  const wave = new Uint8Array(2048)
  for (let i = 0; i < 600; i++) {
    wave.fill(i % 30 < 7 ? 170 : 132)
    f.update(bins, wave, 1 / 60, i / 60)
  }
  assert.ok(Math.abs(f.values.bpm - 120) <= 2, String(f.values.bpm))
})

test('existing presets inherit the restored Orbital look and new controls stay bounded', () => {
  const old = cleanSettings({ scene: 0, palette: 0 })
  assert.equal(old.orbitalDepth, 1)
  assert.equal(old.orbitalPsy, 1)
  const imported = cleanSettings({ orbitalDepth: 99, orbitalPsy: -4 })
  assert.equal(imported.orbitalDepth, 1.5)
  assert.equal(imported.orbitalPsy, 0)
})
