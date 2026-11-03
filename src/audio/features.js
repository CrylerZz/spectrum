import { TempoTracker, bandEnvelope } from './TempoTracker.js'
import { audioBands, calibrationDefaults, cleanCalibration } from './calibration.js'

const BAND_KEYS = ['bass', 'mid', 'high']
const CALIBRATION_KEYS = Object.keys(calibrationDefaults)
// Soft knee retains level differences instead of flattening loud passages at 100%.
const visualLevel = (v) =>
  v <= 0.65 ? Math.max(0, v) : 0.65 + 0.35 * (1 - Math.exp(-(v - 0.65) / 0.35))
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))

// All work buffers are allocated once, outside the animation loop.
export class Features {
  constructor(sampleRate = 48000, fftSize = 2048) {
    this.sampleRate = sampleRate
    this.fftSize = fftSize
    this.calibration = null
    this.bands = []
    this.configure(calibrationDefaults)
    this.values = {
      bass: 0,
      mid: 0,
      high: 0,
      level: 0,
      beat: 0,
      bpm: 0,
      bpmConfidence: 0,
      beatId: 0,
    }
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
    this.previousBandEnergy = 0
    this.lastBeat = -10
    this.tempo = new TempoTracker()
    this.previousEnvelope = 0
  }
  configure(input) {
    if (
      this.calibration &&
      CALIBRATION_KEYS.every(
        (key) => (input?.[key] ?? calibrationDefaults[key]) === this.calibration[key],
      )
    )
      return
    const next = cleanCalibration(input)
    if (this.calibration && Object.keys(next).every((key) => next[key] === this.calibration[key]))
      return
    const previous = this.calibration
    this.calibration = next
    this.bands = audioBands.map(({ key }) => {
      const lo = Math.min(
        this.fftSize / 2 - 1,
        Math.max(1, Math.floor((next[`${key}LowHz`] * this.fftSize) / this.sampleRate)),
      )
      const hi = Math.min(
        this.fftSize / 2,
        Math.max(lo + 1, Math.ceil((next[`${key}HighHz`] * this.fftSize) / this.sampleRate)),
      )
      return [lo, hi]
    })
    this.bandMask = new Uint8Array(this.fftSize / 2)
    this.filtered = audioBands.some(({ key }) => !next[`${key}Enabled`])
    if (!this.filtered) this.bandMask.fill(1)
    else
      this.bands.forEach(([lo, hi], index) => {
        if (next[`${BAND_KEYS[index]}Enabled`]) this.bandMask.fill(1, lo, hi)
      })
    if (this.values) for (const key of BAND_KEYS) if (!next[`${key}Enabled`]) this.values[key] = 0
    // Recalibration must not turn a newly included frequency into a false beat.
    const detectorKeys = [
      'beatSource',
      `${next.beatSource}Enabled`,
      `${next.beatSource}LowHz`,
      `${next.beatSource}HighHz`,
    ]
    if (previous && detectorKeys.some((key) => previous[key] !== next[key])) {
      this.previousMagnitudes.fill(0)
      this.fluxFloor = 0
      this.lastBeat = -10
      this.tempo.reset()
      this.previousEnvelope = 0
      this.values.beat = this.values.bpm = this.values.bpmConfidence = 0
      this.primeDetector = true
    }
  }
  update(frequency, waveform, dt, time, sensitivity = 1, bassGain = 1, decibels = null) {
    const c = this.calibration
    for (let b = 0; b < 3; b++) {
      const [lo, hi] = this.bands[b]
      let sum = 0
      for (let i = lo; i < hi; i++) sum += frequency[i] ** 2
      const key = BAND_KEYS[b]
      if (!c[`${key}Enabled`]) {
        this.values[key] = 0
        continue
      }
      const raw = Math.sqrt(sum / Math.max(1, hi - lo)) / 255
      const gated = Math.max(0, raw - c[`${key}Gate`]) / (1 - c[`${key}Gate`])
      const target = visualLevel(gated * sensitivity * c[`${key}Trim`] * (b === 0 ? bassGain : 1))
      this.values[key] +=
        (target - this.values[key]) *
        (1 - Math.exp(-dt * (1000 / (target > this.values[key] ? c.audioAttack : c.audioRelease))))
    }
    let rms = 0
    for (let i = 0; i < waveform.length; i++) rms += ((waveform[i] - 128) / 128) ** 2
    const rawLevel = Math.sqrt(rms / waveform.length)
    let retained = 1
    if (this.filtered) {
      let total = 0,
        active = 0
      for (let i = 1; i < frequency.length; i++) {
        const power = frequency[i] ** 2
        total += power
        if (this.bandMask[i]) active += power
      }
      retained = total > 0 ? Math.sqrt(active / total) : 0
    }
    this.values.level = visualLevel(rawLevel * sensitivity * 2 * retained)
    // Detection uses unscaled amplitudes, before display gain and compression.
    // Float FFT avoids the ceiling of byte FFT data on heavily mastered music.
    const [lo, hi] = this.bands[BAND_KEYS.indexOf(c.beatSource)]
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
    // Frequency redistribution between sustained bass notes is not a new kick.
    const risingEnergy =
      bass - this.previousBandEnergy >
      Math.max(0.00005, (this.previousBandEnergy * 0.08) / c.beatSensitivity)
    this.previousBandEnergy = bass
    // Detect attacks in the selected band, independently of visual gains.
    const envelope = decibels
      ? 0
      : bandEnvelope(
          waveform,
          this.sampleRate,
          c[`${c.beatSource}LowHz`],
          c[`${c.beatSource}HighHz`],
        )
    const temporalOnset =
      !decibels &&
      envelope > 0.015 &&
      envelope > this.previousEnvelope * 1.6 &&
      envelope - this.previousEnvelope > 0.008
    this.previousEnvelope = envelope
    const onset =
      c[`${c.beatSource}Enabled`] &&
      !this.primeDetector &&
      bass > 10 ** (c.beatFloor / 20) &&
      ((risingEnergy && flux > Math.max(2.1, this.fluxFloor * 1.65) / c.beatSensitivity) ||
        temporalOnset)
    this.primeDetector = false
    this.fluxFloor += (flux - this.fluxFloor) * (1 - Math.exp(-dt * 2))
    this.values.beat *= Math.exp(-dt * 9)
    if (onset && time - this.lastBeat > c.beatInterval / 1000) {
      this.tempo.hit(time)
      this.lastBeat = time
      this.values.beat = 1
      this.values.beatId++
    }
    this.tempo.update(time)
    this.values.bpm = this.tempo.bpm
    this.values.bpmConfidence = this.tempo.confidence
    for (let j = 0; j < 64; j++) {
      const [lo, hi] = this.ranges[j]
      let max = 0
      for (let i = lo; i < hi; i++) if (this.bandMask[i]) max = Math.max(max, frequency[i])
      this.spectrum[j] =
        visualLevel(
          (max / 255) * sensitivity * (this.ranges[j][0] < this.bands[0][1] ? bassGain : 1),
        ) * 255
    }
    return this.values
  }
}
