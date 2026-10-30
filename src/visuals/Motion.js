// Independent accumulated phases: audio impulses never reset an angle or position.
export const motionChannels = ['rotation', 'deformation', 'travel']
export class Motion {
  constructor() {
    this.phases = [0, 0, 0]
    this.velocities = [0, 0, 0]
    this.previous = { bass: 0, mid: 0, high: 0, beat: 0, beatId: 0 }
    this.cooldowns = [0, 0, 0]
    this.liveMode = false
    this.explosion = 0
    this.boost = 0
    this.boostHeld = false
    this.impact = 0
    this.membrane = 0
    this.springVelocity = 0
    this.flash = 0
    this.hitAge = 10
    this.hitCooldown = 0
    this.bassFloor = 0.1
  }
  setLiveMode(enabled) {
    if (this.liveMode === enabled) return
    this.liveMode = enabled
    this.impact = this.flash = this.explosion = this.boost = 0
    this.membrane = this.springVelocity = 0
    this.boostHeld = false
    this.hitAge = 10
    this.velocities.fill(0)
    this.cooldowns.fill(0)
    this.hitCooldown = 0
  }
  trigger(action, settings) {
    this.setLiveMode(!!settings.liveMode)
    if (!this.liveMode || settings.frozen || settings.blackout) return
    const energy = settings.raveEnergy ?? 1.5
    if (action === 'flash') {
      this.flash = 1
    } else if (action === 'strike' || action === 'explosion') {
      this.impact = 0.7 + energy * 0.8
      this.springVelocity = 16 + energy * 12
      this.hitAge = 0
      for (let i = 0; i < 3; i++) this.velocities[i] = Math.min(12, this.velocities[i] + 4 + energy)
      if (action === 'explosion') {
        this.explosion = 1
        this.springVelocity *= 1.5
        this.velocities[1] = 16
        this.velocities[2] = 18
      }
    }
  }
  setBoost(held, settings) {
    this.setLiveMode(!!settings.liveMode)
    this.boostHeld = !!held && this.liveMode && !settings.frozen && !settings.blackout
    if (settings.frozen || settings.blackout) this.boost = 0
  }
  update(dt, audio, settings) {
    this.setLiveMode(!!settings.liveMode)
    if (settings.frozen) return
    dt = Math.min(Math.max(dt, 0), 0.1)
    const automatic = !settings.advancedMotion
    const energy = settings.raveEnergy ?? 1.5
    const strength = automatic ? 1.5 + energy : (settings.motionStrength ?? 1.3)
    const inertia = automatic ? 0.22 : (settings.motionInertia ?? 0.45)
    const threshold = automatic ? 0.08 : (settings.motionThreshold ?? 0.16)
    const decay = Math.exp(-dt / (0.035 + inertia * 1.4))
    const beat = Number.isFinite(audio.beatId)
      ? audio.beatId !== this.previous.beatId && audio.beat > 0.1
      : audio.beat > 0.7 && this.previous.beat < 0.7
    this.bassFloor += (audio.bass - this.bassFloor) * (1 - Math.exp(-dt * 1.8))
    this.hitCooldown = Math.max(0, this.hitCooldown - dt)
    const bassOnset =
      audio.bass > Math.max(0.07, this.bassFloor * 1.13) &&
      audio.bass - this.previous.bass > Math.max(0.004, dt * 0.65)
    const hit = !this.liveMode && this.hitCooldown === 0 && (beat || bassOnset)
    this.impact *= Math.exp(-dt * 7)
    this.flash *= Math.exp(-dt * 32)
    this.explosion *= Math.exp(-dt * 3.2)
    this.boost += ((this.boostHeld ? 1 : 0) - this.boost) * (1 - Math.exp(-dt * 10))
    this.hitAge = Math.min(10, this.hitAge + dt)
    if (hit) {
      this.impact = 0.7 + energy * 0.8
      this.flash = 1
      this.hitAge = 0
      this.hitCooldown = 0.16
      this.springVelocity = 16 + energy * 12
    }
    // Damped physical spring: forward punch, backwards recoil, then rest.
    const steps = Math.max(1, Math.ceil(dt / 0.008))
    const h = dt / steps
    for (let step = 0; step < steps; step++) {
      this.springVelocity += (-230 * this.membrane - 13 * this.springVelocity) * h
      this.membrane += this.springVelocity * h
    }
    motionChannels.forEach((key, i) => {
      const mode = automatic
        ? i === 0 && settings.bassRotation !== false
          ? 'audio'
          : 'hybrid'
        : (settings[`${key}Mode`] ?? 'hybrid')
      const source = automatic ? 'bass' : (settings[`${key}Source`] ?? 'bass')
      const value = audio[source] || 0
      this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt)
      const onset =
        source === 'beat'
          ? beat
          : value > threshold &&
            (this.previous[source] <= threshold ||
              value - this.previous[source] > Math.max(0.006, dt * 1.1) ||
              (source === 'bass' && (beat || bassOnset)))
      if (!this.liveMode && mode !== 'continuous' && onset && this.cooldowns[i] === 0) {
        this.velocities[i] = Math.min(12, this.velocities[i] + strength * (1 + value * 3))
        this.cooldowns[i] = 0.12
      }
      if (!this.liveMode && mode === 'continuous') this.velocities[i] = 0
      // Analytic exponential integral keeps the impulse distance stable across frame rates.
      const distance = this.velocities[i] * (1 - decay) * (0.035 + inertia * 1.4)
      this.phases[i] +=
        ((mode === 'audio' && !this.liveMode ? 0 : dt) + distance) *
        settings.speed *
        (1 + this.boost * 2.5)
      this.velocities[i] *= decay
      if (this.velocities[i] < 0.001) this.velocities[i] = 0
    })
    Object.assign(this.previous, audio)
  }
  snapshot() {
    return {
      liveMode: this.liveMode,
      explosion: this.explosion,
      boost: this.boost,
      boostHeld: this.boostHeld,
      phases: [...this.phases],
      velocities: [...this.velocities],
      cooldowns: [...this.cooldowns],
      previous: { ...this.previous },
      impact: this.impact,
      membrane: this.membrane,
      springVelocity: this.springVelocity,
      flash: this.flash,
      hitAge: this.hitAge,
      hitCooldown: this.hitCooldown,
      bassFloor: this.bassFloor,
    }
  }
  restore(state) {
    if (!state) return
    this.liveMode = !!state.liveMode
    this.boostHeld = !!state.boostHeld
    this.explosion = state.explosion ?? 0
    this.boost = state.boost ?? 0
    this.phases = [...state.phases]
    this.velocities = [...state.velocities]
    this.cooldowns = [...state.cooldowns]
    this.previous = { ...state.previous }
    this.impact = state.impact
    for (const key of [
      'membrane',
      'springVelocity',
      'flash',
      'hitAge',
      'hitCooldown',
      'bassFloor',
    ]) {
      if (Number.isFinite(state[key])) this[key] = state[key]
    }
  }
}
