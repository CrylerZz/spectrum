const clamp = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
export const passageNames = {
  silence: 'Silence',
  intro: 'Introduction',
  calm: 'Calme',
  build: 'Montée',
  break: 'Break',
  drop: 'Drop',
  drive: 'Intense',
  flow: 'En mouvement',
}

// Causal estimates, not song recognition. Two time scales distinguish a short
// accent from a sustained passage; all history is bounded scalar state.
export class MusicalForm {
  constructor() {
    this.reset()
  }
  reset() {
    this.fast = this.slow = this.energy = this.color = 0
    this.quiet = this.age = this.hold = this.candidateAge = 0
    this.phase = this.candidate = 'silence'
    this.hadBody = false
    this.lastBeat = 0
    this.previousBeat = 0
    this.beats = 0
    this.boundary = false
    this.dropWindow = 0
  }
  update(dt, audio, frozen = false, release = 1.6) {
    this.boundary = false
    if (frozen) return this
    dt = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0))
    const raw =
      clamp(audio.level) * 0.4 +
      clamp(audio.bass) * 0.3 +
      clamp(audio.mid) * 0.22 +
      clamp(audio.high) * 0.08
    const before = this.fast
    this.fast += (raw - this.fast) * (1 - Math.exp(-dt / 0.22))
    this.slow += (raw - this.slow) * (1 - Math.exp(-dt / 3))
    this.age += dt
    this.hold += dt
    this.quiet = raw < 0.16 ? this.quiet + dt : 0
    if (this.quiet > 0.8) this.dropWindow = 1.5
    else this.dropWindow = Math.max(0, this.dropWindow - dt)
    const beat = Number.isFinite(audio.beatId)
      ? audio.beatId !== this.lastBeat && audio.beat > 0.1
      : audio.beat > 0.7 && this.previousBeat <= 0.7
    this.lastBeat = audio.beatId ?? this.lastBeat
    this.previousBeat = audio.beat || 0
    if (beat) {
      this.beats = (this.beats + 1) % 4
      this.boundary = this.beats === 0
    }
    // The floor stops a quiet intro being normalised into a climax.
    const target = clamp((raw - 0.025) / 0.72) * clamp(raw / 0.12)
    this.energy +=
      (target - this.energy) * (1 - Math.exp(-dt / (target > this.energy ? 0.55 : release)))
    const colorTarget = clamp((this.energy - 0.12) / 0.63)
    this.color +=
      (colorTarget - this.color) *
      (1 - Math.exp(-dt / (colorTarget > this.color ? 0.35 : Math.max(1.2, release))))
    let next =
      raw < 0.012 && this.fast < 0.025
        ? 'silence'
        : this.quiet > 0.8
          ? this.hadBody
            ? 'break'
            : 'intro'
          : this.fast > 0.54
            ? 'drive'
            : this.fast - this.slow > 0.1 && this.fast > 0.22
              ? 'build'
              : this.fast < 0.18
                ? 'calm'
                : 'flow'
    if (this.dropWindow > 0 && before <= 0.52 && this.fast > 0.52 && clamp(audio.bass) > 0.45) {
      next = 'drop'
      this.dropWindow = 0
      this.phase = 'drop'
      this.hold = 0
      this.boundary = true
    }
    if (this.phase === 'drop' && this.hold < 1.2) next = 'drop'
    if (next !== this.candidate) {
      this.candidate = next
      this.candidateAge = 0
    } else this.candidateAge += dt
    if (next !== this.phase && this.candidateAge >= 0.45 && this.hold >= 0.65) {
      this.phase = next
      this.hold = 0
      if (next === 'break') this.boundary = true
    }
    if (this.energy > 0.6) this.hadBody = true
    return this
  }
}

// An overdue change waits for a phrase accent, then falls back within 8 seconds
// for ambient tracks or unreliable beat detection. Manual selection never waits.
export function shouldAdvanceScene(elapsed, interval, music) {
  return (
    elapsed >= interval && (music.boundary || music.phase === 'silence' || elapsed >= interval + 8)
  )
}
