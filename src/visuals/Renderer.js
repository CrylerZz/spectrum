import { vertex, fragmentForScene } from './shaders'
import { palettes, scenes } from './scenes'
import { OrbitalScene } from './OrbitalScene'
import { Motion } from './Motion'

export class Renderer {
  constructor(canvas, settings, onError = () => {}, onLoading = () => {}) {
    this.canvas = canvas
    this.settings = settings
    this.onError = onError
    this.onLoading = onLoading
    this.generation = 0
    this.destroyed = false
    this.programs = new Map()
    this.failures = new Set()
    this.failureMessages = new Map()
    this.time = 0
    this.motion = new Motion()
    this.scene = settings.scene
    this.previous = settings.scene
    this.mix = 1
    this.scale = 1
    this.preview = false
    this.fps = 0
    this.renderMs = 0
    this.frameCount = 0
    this.elapsed = 0
    this.qualityElapsed = 0
    this.lost = false
    this.dimensions = [0, 0]
    this.spectrum = new Uint8Array(64)
    this.lastAudio = new Float32Array(4)
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!this.gl)
      throw new Error(
        'WebGL est indisponible. Active l’accélération graphique de ton navigateur et recharge la page.',
      )
    this.onLost = (e) => {
      e.preventDefault()
      this.lost = true
      this.generation++
      onError('Le rendu graphique a été interrompu. Restauration en cours…')
    }
    this.onRestored = () => {
      try {
        this.initialize()
        this.lost = false
        onError('')
      } catch (e) {
        onError(e.message)
      }
    }
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    this.initialize()
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
  }
  initialize() {
    const gl = this.gl
    this.generation++
    this.programs.clear()
    this.failures.clear()
    this.failureMessages.clear()
    this.pendingProgram = null
    this.parallelCompile = gl.getExtension('KHR_parallel_shader_compile')
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.activeTexture(gl.TEXTURE0)
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      64,
      1,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      this.spectrum,
    )
    this.orbital = null
    this.resize()
    this.preload(this.generation)
  }
  reportLoading(active = true) {
    this.onLoading({
      active,
      completed: this.programs.size + this.failures.size,
      total: scenes.length,
      failed: this.failures.size,
      current: scenes.find((scene) => scene.id === this.compiling)?.name || '',
      waiting: !this.programs.has(this.settings.scene),
    })
  }
  async preload(generation) {
    const remaining = new Set(scenes.map((scene) => scene.id))
    while (remaining.size && generation === this.generation && !this.destroyed) {
      const selected = this.settings.scene
      const id = remaining.has(selected) ? selected : remaining.values().next().value
      remaining.delete(id)
      this.compiling = id
      this.reportLoading()
      // Paint the progress UI and process input before submitting the next compile.
      await new Promise((resolve) => setTimeout(resolve, 40))
      if (generation !== this.generation || this.destroyed) return
      try {
        const entry = await this.compileScene(id, generation)
        if (!entry || generation !== this.generation || this.destroyed) return
        this.programs.set(id, entry)
        if ([0, 6].includes(id) && !this.orbital) {
          this.gl.activeTexture(this.gl.TEXTURE1)
          this.orbital = new OrbitalScene(this.gl)
          this.gl.activeTexture(this.gl.TEXTURE0)
          this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
        }
        this.reportLoading()
      } catch (error) {
        if (generation !== this.generation || this.destroyed) return
        const failedEntry = this.programs.get(id)
        if (failedEntry) {
          this.gl.deleteProgram(failedEntry.program)
          this.programs.delete(id)
        }
        this.failures.add(id)
        const message = `Préparation de ${scenes.find((scene) => scene.id === id)?.name} : ${error.message}`
        this.failureMessages.set(id, message)
        if (this.settings.scene === id) this.onError(message)
      }
    }
    if (generation === this.generation && !this.destroyed) {
      this.compiling = null
      this.reportLoading(false)
    }
  }
  async compileScene(id, generation) {
    const gl = this.gl
    const vs = gl.createShader(gl.VERTEX_SHADER),
      fs = gl.createShader(gl.FRAGMENT_SHADER)
    const program = gl.createProgram()
    gl.shaderSource(vs, vertex)
    gl.shaderSource(fs, fragmentForScene(id))
    gl.compileShader(vs)
    gl.compileShader(fs)
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    this.pendingProgram = { program, vs, fs }
    try {
      if (this.parallelCompile) {
        while (!gl.getProgramParameter(program, this.parallelCompile.COMPLETION_STATUS_KHR)) {
          await new Promise((resolve) => setTimeout(resolve, 16))
          if (generation !== this.generation || this.destroyed) return null
        }
      } else {
        // Without the extension the driver may still block, but only for one small scene.
        await new Promise((resolve) => setTimeout(resolve, 32))
        if (generation !== this.generation || this.destroyed) return null
      }
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error =
          gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(program)
        gl.deleteProgram(program)
        throw new Error(error || 'Compilation graphique impossible.')
      }
      const uniforms = {}
      for (const name of [
        'resolution',
        'time',
        'motion',
        'impact',
        'rave',
        'kick',
        'live',
        'audio',
        'settings',
        'layers',
        'waves',
        'c1',
        'c2',
        'c3',
        'spectrum',
        'orbital',
        'orbitalImpact',
        'orbitalTint',
        'opacity',
      ]) {
        uniforms[name] = gl.getUniformLocation(program, `u_${name}`)
      }
      return {
        program,
        uniforms,
        position: gl.getAttribLocation(program, 'a_position'),
        palette: -1,
      }
    } finally {
      if (generation === this.generation && !this.destroyed) {
        gl.deleteShader(vs)
        gl.deleteShader(fs)
        this.pendingProgram = null
      }
    }
  }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect()
    const mode = this.settings.quality
    const baseBudget = this.preview
      ? 480000
      : mode === 'high'
        ? 2073600
        : mode === 'eco'
          ? 520000
          : 1250000 * this.scale
    const expensive =
      [1, 9, 26, 27, 28, 30, 36, 39, 41, 42, 43, 44, 48, 55, 56].includes(this.scene) ||
      (this.mix < 1 &&
        [1, 9, 26, 27, 28, 30, 36, 39, 41, 42, 43, 44, 48, 55, 56].includes(this.previous))
    const budget = Math.min(
      baseBudget,
      expensive
        ? mode === 'high'
          ? 700000
          : mode === 'eco'
            ? 200000
            : 420000 * this.scale
        : baseBudget,
    )
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      Math.sqrt(budget / Math.max(1, width * height)),
    )
    const w = Math.max(1, Math.round(width * ratio)),
      h = Math.max(1, Math.round(height * ratio))
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.dimensions[0] = w
    this.dimensions[1] = h
    this.gl.viewport(0, 0, w, h)
    this.lastQuality = mode
  }
  render(dt, audio, spectrum) {
    if (this.lost || this.destroyed) return
    const start = performance.now(),
      s = this.settings,
      gl = this.gl
    if (this.loadingScene !== s.scene) {
      this.loadingScene = s.scene
      this.reportLoading(this.programs.size + this.failures.size < scenes.length)
      this.onError(this.failureMessages.get(s.scene) || '')
    }
    this.elapsed += dt
    this.frameCount++
    this.qualityElapsed += dt
    if (this.elapsed >= 1) {
      this.fps = Math.round(this.frameCount / this.elapsed)
      if (s.quality === 'auto' && this.qualityElapsed >= 3) {
        const old = this.scale
        if (this.fps < 48) this.scale = Math.max(0.25, this.scale * 0.78)
        else if (this.fps >= 58) this.scale = Math.min(1, this.scale * 1.08)
        if (this.scale !== old) this.resize()
        this.qualityElapsed = 0
      }
      this.frameCount = 0
      this.elapsed = 0
    }
    if (s.quality !== this.lastQuality) {
      this.scale = 1
      this.resize()
    }
    if (!s.frozen)
      this.time += Math.min(dt, 0.1) * s.speed * (s.liveMode ? 1 + this.motion.boost * 2.5 : 1)
    this.motion.update(dt, audio, s)
    if (s.scene !== this.scene && this.mix >= 1 && this.programs.has(s.scene)) {
      this.previous = this.scene
      this.scene = s.scene
      this.mix = 0
      this.resize()
    }
    const wasTransitioning = this.mix < 1
    this.mix = s.transition <= 0 ? 1 : Math.min(1, this.mix + dt / s.transition)
    if (wasTransitioning && this.mix === 1) this.resize()
    if (!s.frozen) {
      this.spectrum.set(spectrum)
      this.lastAudio[0] = audio.bass
      this.lastAudio[1] = audio.mid
      this.lastAudio[2] = audio.high
      this.lastAudio[3] = s.liveMode ? Math.min(1, this.motion.impact) : audio.beat
    }
    if (!this.programs.has(this.scene)) return
    let orbitalImpact = 0
    if ([0, 6].includes(this.scene) || ([0, 6].includes(this.previous) && this.mix < 1)) {
      gl.activeTexture(gl.TEXTURE1)
      if (!this.orbital) this.orbital = new OrbitalScene(gl)
      orbitalImpact = this.orbital.render(
        this.time,
        this.lastAudio,
        this.spectrum,
        s,
        this.canvas.width,
        this.canvas.height,
      )
      gl.bindTexture(gl.TEXTURE_2D, this.orbital.texture)
    }
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.spectrum)
    gl.disable(gl.BLEND)
    if (this.mix < 1 && this.programs.has(this.previous)) {
      this.drawScene(this.previous, 1, orbitalImpact)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      const fade = this.mix * this.mix * (3 - 2 * this.mix)
      this.drawScene(this.scene, fade, orbitalImpact)
      gl.disable(gl.BLEND)
    } else this.drawScene(this.scene, 1, orbitalImpact)
    this.renderMs += (performance.now() - start - this.renderMs) * 0.1
  }
  drawScene(id, opacity, orbitalImpact) {
    const gl = this.gl,
      s = this.settings,
      entry = this.programs.get(id),
      u = entry.uniforms
    gl.useProgram(entry.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.enableVertexAttribArray(entry.position)
    gl.vertexAttribPointer(entry.position, 2, gl.FLOAT, false, 0, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(u.spectrum, 0)
    gl.uniform1i(u.orbital, 1)
    gl.uniform1f(u.opacity, opacity)
    gl.uniform1f(u.orbitalImpact, orbitalImpact)
    gl.uniform1f(u.orbitalTint, s.palette === 0 ? 0 : 1)
    if (s.palette !== entry.palette) {
      const colors = palettes[s.palette]?.colors || palettes[0].colors
      for (let i = 0; i < 3; i++) {
        const n = parseInt(colors[i].slice(1), 16)
        gl.uniform3f(
          u[`c${i + 1}`],
          ((n >> 16) & 255) / 255,
          ((n >> 8) & 255) / 255,
          (n & 255) / 255,
        )
      }
      entry.palette = s.palette
    }
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height)
    gl.uniform1f(u.time, this.time)
    gl.uniform3f(u.motion, ...this.motion.phases)
    gl.uniform1f(u.impact, this.motion.impact)
    gl.uniform4f(
      u.rave,
      s.raveEnergy ?? 1.5,
      s.raveDepth ?? 1.2,
      s.ravePsy ?? 1.1,
      s.raveFlash ?? 0.7,
    )
    gl.uniform4f(
      u.kick,
      this.motion.membrane,
      this.motion.flash,
      this.motion.hitAge,
      this.motion.springVelocity,
    )
    gl.uniform4f(
      u.live,
      s.liveMode ? 1 : 0,
      this.motion.explosion,
      this.motion.boost,
      this.motion.impact,
    )
    gl.uniform4fv(u.audio, this.lastAudio)
    gl.uniform4f(u.settings, s.intensity, s.detail, s.glow, s.blackout ? 1 : 0)
    gl.uniform4f(u.layers, +s.ring, +s.dna, +s.grid, +s.eye)
    gl.uniform1f(u.waves, +s.waves)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  destroy() {
    this.destroyed = true
    this.generation++
    this.observer.disconnect()
    if (this.pendingProgram) {
      this.gl.deleteShader(this.pendingProgram.vs)
      this.gl.deleteShader(this.pendingProgram.fs)
      this.gl.deleteProgram(this.pendingProgram.program)
      this.pendingProgram = null
    }
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    this.orbital?.destroy()
    this.gl.deleteTexture(this.texture)
    this.gl.deleteBuffer(this.buffer)
    for (const entry of this.programs.values()) this.gl.deleteProgram(entry.program)
    this.programs.clear()
  }
}
