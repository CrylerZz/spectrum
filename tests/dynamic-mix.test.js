import test from 'node:test'
import assert from 'node:assert/strict'
import { DynamicMix, dynamicControls } from '../src/visuals/DynamicMix.js'
import { fullAutoSettings } from '../src/visuals/fullAuto.js'
import { defaults, cleanSettings } from '../src/visuals/scenes.js'
const silent = { bass: 0, mid: 0, high: 0, level: 0, beat: 0 }
const loud = { bass: 0.9, mid: 0.8, high: 0.7, level: 0.9, beat: 1 }
const base = { ...defaults, dynamicMix: true }
function advance(mix, audio, seconds = 3, fps = 60, settings = base) {
  let result
  for (let i = 0; i < seconds * fps; i++) result = mix.update(1 / fps, audio, settings)
  return { ...result }
}
test('loud passages increase the mix and silence smoothly calms every controlled parameter', () => {
  const mix = new DynamicMix()
  const quiet = advance(mix, silent)
  const strong = advance(mix, loud)
  for (const key of Object.keys(dynamicControls)) {
    assert.ok(strong[key] > quiet[key], key)
    assert.ok(strong[key] > base[key], key)
  }
  const immediate = { ...mix.update(1 / 60, silent, base) }
  assert.ok(immediate.speed > quiet.speed)
  assert.ok(immediate.speed <= strong.speed, 'a saturated peak may briefly stay at the ceiling')
  assert.ok(advance(mix, silent, 1).speed < strong.speed)
  const calm = advance(mix, silent, 12)
  assert.ok(calm.speed < base.speed * 0.5)
  assert.ok(mix.energy < 0.001)
  assert.equal(base.intensity, defaults.intensity, 'base settings never change')
})
test('disabled mode, zero amplitude and live mode return exact manual values', () => {
  for (const patch of [{ dynamicMix: false }, { dynamicAmount: 0 }, { liveMode: true }]) {
    const result = advance(new DynamicMix(), loud, 2, 60, { ...base, ...patch })
    for (const key of Object.keys(dynamicControls)) assert.equal(result[key], base[key], key)
  }
})
test('audio settings and stopped movement stay intact while auto can lift weak effects', () => {
  const settings = {
    ...base,
    speed: 0,
    glow: 0,
    ravePsy: 0,
    raveFlash: 0,
    sensitivity: 1.7,
    bassGain: 1.2,
  }
  const result = advance(new DynamicMix(), loud, 3, 60, settings)
  for (const key of ['speed', 'sensitivity', 'bassGain']) assert.equal(result[key], settings[key])
  assert.ok(result.glow > 0.5)
  assert.ok(result.ravePsy > 1)
  assert.ok(result.raveFlash > 0)
  assert.equal(
    advance(new DynamicMix(), loud, 3, 60, { ...settings, dynamicFlash: 0 }).raveFlash,
    0,
  )
  const maxed = { ...base }
  for (const [key, [, , , max]] of Object.entries(dynamicControls)) maxed[key] = max
  const high = advance(new DynamicMix(), loud, 3, 60, maxed)
  for (const [key, [, , min, max]] of Object.entries(dynamicControls))
    assert.ok(high[key] >= min && high[key] <= max)
})
test('quiet signals stay quiet; phantom beats cannot amplify silence', () => {
  const mix = new DynamicMix()
  advance(mix, { bass: 0.01, mid: 0.01, high: 0.01, level: 0.01, beat: 0 }, 30)
  assert.ok(mix.energy < 0.01)
  advance(mix, { ...silent, beat: 1 }, 20)
  assert.ok(mix.energy < 0.001)
})
test('freeze holds the envelope, release is configurable and timing is frame-rate independent', () => {
  const mix = new DynamicMix()
  advance(mix, loud)
  const energy = mix.energy
  advance(mix, silent, 2, 60, { ...base, frozen: true })
  assert.equal(mix.energy, energy)
  const outcomes = [30, 60, 144].map((fps) => {
    const model = new DynamicMix()
    advance(model, loud, 1, fps)
    advance(model, silent, 2, fps)
    return model.energy
  })
  assert.ok(Math.max(...outcomes) - Math.min(...outcomes) < 0.001)
  const fast = new DynamicMix(),
    slow = new DynamicMix()
  advance(fast, loud)
  advance(slow, loud)
  advance(fast, silent, 2, 60, { ...base, dynamicRelease: 0.3 })
  advance(slow, silent, 2, 60, { ...base, dynamicRelease: 4 })
  assert.ok(slow.energy > fast.energy * 10)
})
test('mix preference persists, with bounded controls for imported presets', () => {
  const cleaned = cleanSettings({ dynamicMix: true, dynamicAmount: 99, dynamicRelease: -2 })
  assert.equal(cleaned.dynamicMix, true)
  assert.equal(cleaned.dynamicAmount, 1)
  assert.equal(cleaned.dynamicRelease, 0.3)
  assert.equal(cleanSettings(JSON.parse(JSON.stringify(cleaned))).dynamicMix, true)
  assert.equal(cleanSettings({ dynamicMix: 'yes', dynamicAmount: NaN }).dynamicMix, false)
})

test('automatic colours transition from calm to vivid, reset correctly and survive preset cleanup', () => {
  const mix = new DynamicMix()
  const quiet = advance(mix, silent)
  assert.equal(quiet.dynamicColors[0], base.dynamicCalmColor)
  const strong = advance(mix, loud)
  assert.equal(strong.dynamicColors[0], base.dynamicHotColor)
  assert.notDeepEqual(strong.dynamicColors, quiet.dynamicColors)
  assert.equal(advance(mix, loud, 1, 60, { ...base, dynamicMix: false }).dynamicColors, null)
  assert.equal(
    advance(mix, loud, 1, 60, { ...base, dynamicColorEnabled: false }).dynamicColors,
    null,
  )
  const cleaned = cleanSettings({
    dynamicCalmColor: '#123abc',
    dynamicHotColor: 'oops',
    dynamicFlash: 99,
    tunnelTravel: -1,
  })
  assert.equal(cleaned.dynamicCalmColor, '#123abc')
  assert.equal(cleaned.dynamicHotColor, defaults.dynamicHotColor)
  assert.equal(cleaned.dynamicFlash, 1)
  assert.equal(cleaned.tunnelTravel, 0)
})

test('full automation keeps quiet passages dark and reserves maximum motion/density for sustained energy', () => {
  const settings = cleanSettings({ ...defaults, ...fullAutoSettings })
  const mix = new DynamicMix()
  const quiet = advance(
    mix,
    { level: 0.04, bass: 0.05, mid: 0.03, high: 0.02, beat: 0 },
    8,
    60,
    settings,
  )
  assert.ok(quiet.intensity < 0.2)
  assert.ok(quiet.speed < 0.25)
  assert.ok(quiet.detail < 0.4)
  assert.equal(quiet.dynamicColors[0], '#080d1c')
  const accent = { ...mix.update(1 / 60, loud, settings) }
  assert.ok(accent.speed < 0.6, 'one accent is not a sustained climax')
  const peak = advance(mix, loud, 5, 60, settings)
  assert.equal(peak.detail, 1)
  assert.equal(peak.speed, 2)
  assert.equal(peak.intensity, 2)
  assert.equal(peak.dynamicColors[0], settings.dynamicHotColor)
  assert.ok(peak.raveDepth > 1.5 && peak.ravePsy > 1.5 && peak.raveFlash > 0.5)
  const calm = advance(mix, silent, 12, 60, settings)
  assert.ok(calm.speed < 0.1 && calm.intensity < 0.1)
  assert.equal(calm.dynamicColors[0], settings.dynamicCalmColor)
  assert.equal(settings.tunnelTravel, 0.3)
  for (const band of ['bass', 'mid', 'high']) assert.equal(settings[band + 'Enabled'], true)
})
