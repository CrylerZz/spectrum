const BAND_KEYS = ['bass', 'mid', 'high']
// Soft knee retains level differences instead of flattening loud passages at 100%.
const visualLevel = (v) =>
  v <= 0.65 ? Math.max(0, v) : 0.65 + 0.35 * (1 - Math.exp(-(v - 0.65) / 0.35))
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
    this.values = { bass: 0, mid: 0, high: 0, level: 0, beat: 0, bpm: 0, beatId: 0 }
    this.spectrum = new Uint8Array(64)
    this.ranges = Array.from({ length: 64 }, (_, i) => [
      Math.max(1, Math.floor((25 * (16000 / 25) ** (i / 64) * fftSize) / sampleRate)),
      Math.min(
        fftSize / 2,
        Math.ceil((25 * (16000 / 25) ** ((i + 1) / 64) * fftSize) / sampleRate),
      ),
    ])
    this.previousMagnitudes = new Float32Array(fftSize / 2)
    this.fluxFloor = 0
    this.floor = 0
    this.levelFloor = 0.1
    this.previousLevel = 0
    this.previousBass = 0
    this.lastBeat = -10
    this.intervals = []
  }
  update(frequency, waveform, dt, time, sensitivity = 1, bassGain = 1, decibels = null) {
    for (let b = 0; b < 3; b++) {
      const [lo, hi] = this.bands[b]
      let sum = 0
      for (let i = lo; i < hi; i++) sum += frequency[i] ** 2
      const target = visualLevel(
        (Math.sqrt(sum / Math.max(1, hi - lo)) / 255) * sensitivity * (b === 0 ? bassGain : 1),
      )
      const key = BAND_KEYS[b]
      this.values[key] +=
        (target - this.values[key]) * (1 - Math.exp(-dt * (target > this.values[key] ? 30 : 16)))
    }
    let rms = 0
    for (let i = 0; i < waveform.length; i++) rms += ((waveform[i] - 128) / 128) ** 2
    const rawLevel = Math.sqrt(rms / waveform.length)
    this.values.level = visualLevel(rawLevel * sensitivity * 2)
    // Detection uses unscaled amplitudes, before display gain and compression.
    // Float FFT avoids the ceiling of byte FFT data on heavily mastered music.
    const [lo, hi] = this.bands[0]
    let bassEnergy = 0,
      positiveFlux = 0,
      magnitudeSum = 0
    for (let i = lo; i < hi; i++) {
      const magnitude = decibels
        ? Number.isFinite(decibels[i])
          ? 10 ** (decibels[i] / 20)
          : 0
        : frequency[i] / 255
      bassEnergy += magnitude * magnitude
      positiveFlux += Math.max(0, magnitude - this.previousMagnitudes[i])
      magnitudeSum += magnitude
      this.previousMagnitudes[i] = magnitude
    }
    const bass = Math.sqrt(bassEnergy / Math.max(1, hi - lo))
    const flux = magnitudeSum > 0.0001 ? positiveFlux / magnitudeSum / Math.max(dt, 0.004) : 0
    const onset =
      (bass > 0.0005 && flux > Math.max(2.1, this.fluxFloor * 1.65)) ||
      (rawLevel > Math.max(0.008, this.levelFloor * 1.12) &&
        rawLevel - this.previousLevel > Math.max(0.001, dt * 0.065))
    this.floor += (bass - this.floor) * (1 - Math.exp(-dt * 1.5))
    this.fluxFloor += (flux - this.fluxFloor) * (1 - Math.exp(-dt * 2))
    this.levelFloor += (rawLevel - this.levelFloor) * (1 - Math.exp(-dt * 2))
    this.values.beat *= Math.exp(-dt * 9)
    this.previousBass = bass
    this.previousLevel = rawLevel
    if (onset && time - this.lastBeat > 0.22) {
      const interval = time - this.lastBeat
      if (interval > 0.25 && interval < 1) {
        this.intervals.push(interval)
        if (this.intervals.length > 12) this.intervals.shift()
        if (this.intervals.length >= 4) {
          const sorted = [...this.intervals].sort((a, b) => a - b)
          this.values.bpm = Math.round(60 / sorted[Math.floor(sorted.length / 2)])
        }
      }
      this.lastBeat = time
      this.values.beat = 1
      this.values.beatId++
    }
    if (time - this.lastBeat > 3) {
      this.values.bpm = 0
      this.intervals.length = 0
    }
    for (let j = 0; j < 64; j++) {
      const [lo, hi] = this.ranges[j]
      let max = 0
      for (let i = lo; i < hi; i++) max = Math.max(max, frequency[i])
      this.spectrum[j] =
        visualLevel(
          (max / 255) * sensitivity * (this.ranges[j][0] < this.bands[0][1] ? bassGain : 1),
        ) * 255
    }
    return this.values
  }
}
