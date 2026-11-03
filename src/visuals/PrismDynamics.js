const clamp = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
export const prismLevels = ['Éveil', 'Dentelle', 'Éclat', 'Expansion', 'Apogée']

// Absolute calibrated levels keep an intro gentle, even when it is the loudest
// sound heard so far. Bass unlocks the final build; treble alone adds fine detail.
export class PrismDynamics {
  constructor() {
    this.level = 0
    this.bands = [0, 0, 0]
  }
  reset() {
    this.level = 0
    this.bands.fill(0)
  }
  update(dt, audio, frozen = false) {
    if (frozen) return
    dt = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0))
    for (const [index, key] of ['bass', 'mid', 'high'].entries()) {
      const value = clamp(audio[key])
      const response = value > this.bands[index] ? 0.12 : 0.6
      this.bands[index] += (value - this.bands[index]) * (1 - Math.exp(-dt / response))
    }
    const [bass, mid, high] = this.bands
    const load = bass * 0.45 + mid * 0.35 + high * 0.2
    const body = clamp((load - 0.06) / 0.64)
    const bassLimit = 0.6 + 0.4 * clamp((bass - 0.35) / 0.3)
    const target = Math.min(body, bassLimit)
    this.level += (target - this.level) * (1 - Math.exp(-dt / (target > this.level ? 0.4 : 1.6)))
  }
  snapshot() {
    return { level: this.level, bands: [...this.bands] }
  }
}
