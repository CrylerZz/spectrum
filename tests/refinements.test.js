import test from 'node:test'
import assert from 'node:assert/strict'
import { TempoTracker, bandEnvelope } from '../src/audio/TempoTracker.js'
import { Features } from '../src/audio/features.js'
import { stabilizeCalibration } from '../src/audio/AutoCalibration.js'
import { defaults, scenes } from '../src/visuals/scenes.js'
import { sceneFamilies, filterScenes, cleanFavorites } from '../src/visuals/library.js'

test('tempo rejects isolated intervals, tolerates a missed beat and clears stale estimates', () => {
  const tempo = new TempoTracker()
  tempo.hit(0)
  tempo.hit(0.5)
  assert.equal(tempo.bpm, 0)
  for (const time of [1, 1.5, 2, 2.5, 3, 4, 4.5, 5]) tempo.hit(time)
  assert.equal(tempo.bpm, 120)
  assert.ok(tempo.confidence > 0.8)
  tempo.update(8.1)
  assert.equal(tempo.bpm, 0)
  assert.equal(tempo.confidence, 0)
})

test('threshold adjustments preserve tempo but changing detector band resets it', () => {
  const features = new Features()
  for (let i = 0; i <= 8; i++) features.tempo.hit(i * 0.5)
  features.configure({ ...features.calibration, beatFloor: -45, beatSensitivity: 1.5 })
  assert.equal(features.tempo.bpm, 120)
  features.configure({ ...features.calibration, beatSource: 'mid' })
  assert.equal(features.tempo.bpm, 0)
})

test('waveform fallback ignores DC and favours the selected bass band', () => {
  const wave = new Uint8Array(2048)
  assert.equal(bandEnvelope(wave.fill(190), 48000, 30, 160), 0)
  const tone = (hz) => {
    for (let i = 0; i < wave.length; i++)
      wave[i] = 128 + 70 * Math.sin((2 * Math.PI * hz * i) / 48000)
    return bandEnvelope(wave, 48000, 30, 160)
  }
  assert.ok(tone(80) > tone(8000) * 10)
})

test('later calibration ignores small variations and bounds large corrections', () => {
  assert.deepEqual(
    stabilizeCalibration(defaults, { bassHighHz: defaults.bassHighHz + 10, bassTrim: 1.05 }),
    {},
  )
  const patch = stabilizeCalibration(defaults, {
    bassHighHz: 250,
    bassTrim: 4,
    bassGate: 0.08,
    beatFloor: -20,
  })
  assert.ok(patch.bassHighHz <= defaults.bassHighHz * 1.15 + 5)
  assert.equal(patch.bassTrim, 1.25)
  assert.equal(patch.bassGate, 0.02)
  assert.ok(Math.abs(patch.beatFloor - defaults.beatFloor) <= 3)
})

test('scene families cover each retained scene exactly once and search combines filters', () => {
  const ids = sceneFamilies.flatMap((family) => family.ids ?? [])
  assert.deepEqual(
    [...ids].sort((a, b) => a - b),
    scenes.map((scene) => scene.id).sort((a, b) => a - b),
  )
  assert.equal(new Set(ids).size, ids.length)
  const matches = filterScenes(scenes, { query: 'eclats', family: 'prisms' })
  assert.equal(matches.length, 1)
  assert.equal(matches[0].id, 72)
  assert.deepEqual(
    filterScenes(scenes, { family: 'prisms', favorites: [0, 72], onlyFavorites: true }),
    matches,
  )
  assert.deepEqual(cleanFavorites([72, 72, 0, 999, '72'], scenes), [72, 0])
  assert.deepEqual(cleanFavorites(null, scenes), [])
})
