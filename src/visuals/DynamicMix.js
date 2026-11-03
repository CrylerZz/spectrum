import { MusicalForm } from './MusicalForm.js'
import { dynamicPalette } from './dynamicColors.js'
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
// Multipliers at silence and at full musical energy, followed by render limits.
export const dynamicControls = {
  intensity: [0.06, 2.2, 0.05, 2],
  speed: [0.08, 2.0, 0, 2],
  detail: [0.3, 1.25, 0.2, 1],
  glow: [0.15, 2.2, 0, 1],
  orbitalDepth: [0.2, 2.0, 0, 1.5],
  orbitalPsy: [0.08, 2.5, 0, 1.5],
  raveEnergy: [0.4, 1.6, 0, 2],
  raveDepth: [0.15, 2.5, 0, 2],
  ravePsy: [0.05, 3.0, 0, 2],
  raveFlash: [0, 1, 0, 1],
}
const controlEntries = Object.entries(dynamicControls)
const peakTargets = {
  intensity: 2.4,
  speed: 2.6,
  detail: 1.4,
  glow: 0.9,
  orbitalDepth: 1.5,
  orbitalPsy: 1.5,
  raveEnergy: 1.9,
  raveDepth: 2,
  ravePsy: 1.9,
}
export class DynamicMix {
  constructor() {
    this.music = new MusicalForm()
    this.energy = 0
    this.impact = 0
    this.peak = 0.35
    this.paletteKey = null
    this.palette = null
    this.output = {}
  }
  reset() {
    this.music.reset()
    this.energy = this.impact = 0
    this.peak = 0.35
    this.paletteKey = null
  }
  update(dt, audio, base) {
    this.music.update(dt, audio, base.frozen, base.dynamicRelease ?? 1.6)
    Object.assign(this.output, base)
    this.output.dynamicColors = null
    this.output.dynamicStrength = 0
    if (!base.dynamicMix || base.liveMode) {
      this.energy = 0
      this.impact = 0
      this.peak = 0.35
      return this.output
    }
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1)
    if (!base.frozen) {
      const value = (key) => clamp(Number.isFinite(audio[key]) ? audio[key] : 0)
      const raw =
        value('level') * 0.5 + value('bass') * 0.3 + value('mid') * 0.15 + value('high') * 0.05
      // A minimum reference prevents silence or a quiet passage becoming a climax.
      this.peak = Math.max(0.35, raw, this.peak * Math.exp(-dt / 8))
      const presence = clamp(raw / 0.12)
      this.impact = Math.max(value('beat') * presence, this.impact * Math.exp(-dt * 9))
      this.energy = this.music.energy
    }
    const amount = clamp(base.dynamicAmount ?? 0.75)
    const drive = clamp(this.energy * 0.85 + this.impact * 0.15)
    this.output.dynamicStrength = amount
    for (const [key, [quiet, loud, min, max]] of controlEntries) {
      if (!Number.isFinite(base[key])) continue
      const peak =
        key === 'speed' && base.speed === 0 ? 0 : Math.max(base[key] * loud, peakTargets[key] ?? 0)
      const target = base[key] * quiet * (1 - drive) + peak * drive
      this.output[key] = clamp(base[key] * (1 - amount) + amount * target, min, max)
    }
    const hot = clamp((this.energy - 0.4) / 0.5)
    this.output.raveFlash = clamp(
      base.raveFlash * (1 - amount + amount * hot) + (base.dynamicFlash ?? 0.45) * amount * hot,
    )
    if (base.dynamicColorEnabled !== false && amount > 0) {
      const colorEnergy = this.music.color
      // Reuse perceptually identical colours instead of parsing three hex strings every frame.
      const step = Math.round(colorEnergy * 256) / 256
      const calm = base.dynamicCalmColor ?? '#080d1c'
      const hotColor = base.dynamicHotColor ?? '#ff167a'
      const key = `${calm}:${hotColor}:${step}`
      if (key !== this.paletteKey) {
        this.palette = dynamicPalette(calm, hotColor, step)
        this.paletteKey = key
      }
      this.output.dynamicColors = this.palette
    }
    return this.output
  }
}
