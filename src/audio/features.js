const BAND_KEYS = ['bass', 'mid', 'high']
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))

// All work buffers are allocated once, outside the animation loop.
export class Features {
  constructor(sampleRate = 48000, fftSize = 2048) {
    this.bands = [
      [30, 160],
      [160, 2500],
      [2500, 14000],
    ].map(([lo, hi]) => [
      Math.max(1, Math.floor((lo * fftSize) / sampleRate)),
      Math.min(fftSize / 2, Math.ceil((hi * fftSize) / sampleRate)),
    ])
    this.values = { bass: 0, mid: 0, high: 0, level: 0, beat: 0, bpm: 0 }
    this.spectrum = new Uint8Array(64)
    this.ranges = Array.from({ length: 64 }, (_, i) => [
      Math.max(1, Math.floor((25 * (16000 / 25) ** (i / 64) * fftSize) / sampleRate)),
      Math.min(
        fftSize / 2,
        Math.ceil((25 * (16000 / 25) ** ((i + 1) / 64) * fftSize) / sampleRate),
      ),
    ])
    this.floor = 0.15
    this.levelFloor = 0.1
    this.previousLevel = 0
    this.previousBass = 0
    this.lastBeat = -10
    this.intervals = []
  }
  update(frequency, waveform, dt, time, sensitivity = 1) {
    for (let b = 0; b < 3; b++) {
      const [lo, hi] = this.bands[b]
      let sum = 0
      for (let i = lo; i < hi; i++) sum += frequency[i] ** 2
      const target = clamp((Math.sqrt(sum / Math.max(1, hi - lo)) / 255) * sensitivity)
      const key = BAND_KEYS[b]
      this.values[key] +=
        (target - this.values[key]) * (1 - Math.exp(-dt * (target > this.values[key] ? 25 : 7)))
    }
    let rms = 0
    for (let i = 0; i < waveform.length; i++) rms += ((waveform[i] - 128) / 128) ** 2
    this.values.level = clamp(Math.sqrt(rms / waveform.length) * sensitivity * 2)
    const bass = this.values.bass
    this.floor += (bass - this.floor) * (1 - Math.exp(-dt * 1.5))
    this.levelFloor += (this.values.level - this.levelFloor) * (1 - Math.exp(-dt * 1.5))
    this.values.beat *= Math.exp(-dt * 7)
    // Log-scaled FFT magnitudes can stay almost flat on compressed music.
    // Combine bass onsets with waveform RMS transients to retain the kick.
    const onset =
      (bass > Math.max(0.22, this.floor * 1.12) && bass > this.previousBass + 0.015) ||
      (this.values.level > Math.max(0.1, this.levelFloor * 1.4) &&
        this.values.level > this.previousLevel + 0.015)
    this.previousBass = bass
    this.previousLevel = this.values.level
    if (onset && time - this.lastBeat > 0.28) {
      const interval = time - this.lastBeat
      if (interval > 0.3 && interval < 1) {
        this.intervals.push(interval)
        if (this.intervals.length > 12) this.intervals.shift()
        if (this.intervals.length >= 4) {
          const sorted = [...this.intervals].sort((a, b) => a - b)
          this.values.bpm = Math.round(60 / sorted[Math.floor(sorted.length / 2)])
        }
      }
      this.lastBeat = time
      this.values.beat = 1
    }
    if (time - this.lastBeat > 3) {
      this.values.bpm = 0
      this.intervals.length = 0
    }
    for (let j = 0; j < 64; j++) {
      const [lo, hi] = this.ranges[j]
      let max = 0
      for (let i = lo; i < hi; i++) max = Math.max(max, frequency[i])
      this.spectrum[j] = clamp((max / 255) * sensitivity) * 255
    }
    return this.values
  }
}
