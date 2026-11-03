// An estimate needs a cluster of consistent intervals, not just the latest pair.
export class TempoTracker {
  constructor() {
    this.reset()
  }
  reset() {
    this.last = null
    this.intervals = []
    this.bpm = 0
    this.confidence = 0
  }
  hit(time) {
    const interval = this.last === null ? 0 : time - this.last
    this.last = time
    if (interval < 0.24 || interval > 1.5) return
    this.intervals.push(interval)
    if (this.intervals.length > 12) this.intervals.shift()
    let best = []
    for (const candidate of this.intervals) {
      const cluster = this.intervals.filter(
        (value) => Math.abs(value - candidate) < candidate * 0.1,
      )
      if (cluster.length >= best.length) best = cluster
    }
    this.confidence = best.length / Math.max(6, this.intervals.length)
    if (best.length < 4 || this.confidence < 0.55) return
    best.sort((a, b) => a - b)
    const next = 60 / best[Math.floor(best.length / 2)]
    this.bpm = Math.round(
      this.bpm && Math.abs(next - this.bpm) < 8 ? this.bpm * 0.7 + next * 0.3 : next,
    )
  }
  update(time) {
    if (this.last !== null && time - this.last > 3) this.reset()
  }
}

// Time-domain fallback for byte-only spectra. Remove DC before measuring the
// selected frequency band, so a volume offset cannot masquerade as a kick.
export function bandEnvelope(waveform, sampleRate, lowHz, highHz) {
  let mean = 0
  for (const sample of waveform) mean += sample
  mean /= waveform.length || 1
  const low = Math.exp((-2 * Math.PI * lowHz) / sampleRate)
  const high = Math.exp((-2 * Math.PI * highHz) / sampleRate)
  let lp = 0,
    hp = 0,
    energy = 0
  for (const sample of waveform) {
    const value = (sample - mean) / 128
    lp = low * lp + (1 - low) * value
    hp = high * hp + (1 - high) * value
    energy += (hp - lp) ** 2
  }
  return Math.sqrt(energy / Math.max(1, waveform.length))
}
