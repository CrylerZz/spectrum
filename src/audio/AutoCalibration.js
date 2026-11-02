import { audioBands, cleanCalibration } from './calibration.js'

const zones = [
  [30, 250, 80],
  [250, 4000, 500],
  [4000, 16000, 2000],
]
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0
}
const bound = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Six seconds of actual signal, sampled at 10 Hz. Never learn from calibrated gains.
export class AutoCalibration {
  constructor() {
    this.reset()
  }
  reset() {
    this.frames = []
    this.elapsed = 0
    this.sampleElapsed = 0
    this.silence = 0
    this.progress = 0
    this.waiting = true
  }
  update(frequency, decibels, dt, sampleRate, fftSize, settings) {
    let energy = 0
    for (const value of frequency) energy += value * value
    if (Math.sqrt(energy / frequency.length) / 255 < 0.01) {
      this.waiting = true
      this.silence += dt
      if (this.silence > 1) this.reset()
      return null
    }
    this.waiting = false
    this.silence = 0
    this.elapsed += Math.min(dt, 0.1)
    this.sampleElapsed += Math.min(dt, 0.1)
    this.progress = Math.min(1, this.elapsed / 6)
    if (this.sampleElapsed < 0.1) return null
    this.sampleElapsed = 0
    this.frames.push({ frequency: frequency.slice(), decibels: decibels?.slice() })
    if (this.elapsed < 6 || this.frames.length < 20) return null
    const next = this.recommend(sampleRate, fftSize, settings)
    this.reset()
    return next
  }
  recommend(sampleRate, fftSize, settings) {
    const patch = {}
    const hzPerBin = sampleRate / fftSize
    const size = this.frames[0].frequency.length
    const range = (low, high) => {
      const lo = bound(Math.floor(low / hzPerBin), 1, size - 1)
      return [lo, bound(Math.ceil(high / hzPerBin), lo + 1, size)]
    }
    audioBands.forEach(({ key }, index) => {
      if (settings[`${key}Enabled`] === false) return
      const [zoneLow, zoneHigh, width] = zones[index]
      if (zoneLow >= sampleRate / 2) return
      const ceiling = Math.min(zoneHigh, sampleRate / 2)
      const [start, end] = range(zoneLow, ceiling)
      const powers = new Float64Array(end - start)
      let total = 0
      for (const { frequency } of this.frames) {
        for (let i = start; i < end; i++) {
          const power = Math.max(0, frequency[i] - 8) ** 2
          powers[i - start] += power
          total += power
        }
      }
      // Leave absent bands alone instead of amplifying their noise.
      if (Math.sqrt(total / (end - start) / this.frames.length) / 255 < 0.025) return
      const quantileHz = (fraction) => {
        let accumulated = 0
        for (let i = 0; i < powers.length; i++) {
          accumulated += powers[i]
          if (accumulated >= total * fraction) return (i + start) * hzPerBin
        }
        return ceiling
      }
      const center = (quantileHz(0.05) + quantileHz(0.95)) / 2
      const span = Math.max(width, quantileHz(0.95) - quantileHz(0.05) + 2 * hzPerBin)
      const low = Math.max(zoneLow, Math.min(center - span / 2, ceiling - width))
      const high = Math.min(ceiling, Math.max(low + width, center + span / 2))
      patch[`${key}LowHz`] = Math.round(low / 10) * 10
      patch[`${key}HighHz`] = Math.round(high / 10) * 10
      const [lo, hi] = range(patch[`${key}LowHz`], patch[`${key}HighHz`])
      const levels = this.frames.map(({ frequency }) => {
        let sum = 0
        for (let i = lo; i < hi; i++) sum += frequency[i] ** 2
        return Math.sqrt(sum / (hi - lo)) / 255
      })
      const gate = Math.min(0.08, percentile(levels, 0.1) * 0.2)
      patch[`${key}Gate`] = Math.round(gate * 100) / 100
      const peak = Math.max(0.01, (percentile(levels, 0.9) - gate) / (1 - gate))
      const gain = (settings.sensitivity ?? 1) * (key === 'bass' ? (settings.bassGain ?? 1) : 1)
      if (gain > 0) patch[`${key}Trim`] = Math.round(bound(0.55 / (peak * gain), 0.25, 4) * 20) / 20
    })
    const next = cleanCalibration({ ...settings, ...patch })
    const key = next.beatSource
    const [lo, hi] = range(next[`${key}LowHz`], next[`${key}HighHz`])
    const levelsDb = this.frames
      .filter((frame) => frame.decibels)
      .map(({ decibels }) => {
        let power = 0
        for (let i = lo; i < hi; i++)
          power += Number.isFinite(decibels[i]) ? 10 ** (decibels[i] / 10) : 0
        return 10 * Math.log10(Math.max(1e-12, power / (hi - lo)))
      })
    if (next[`${key}Enabled`] && levelsDb.length && percentile(levelsDb, 0.9) > -85)
      patch.beatFloor = Math.round(bound(percentile(levelsDb, 0.2) - 6, -85, -20))
    return patch
  }
}
