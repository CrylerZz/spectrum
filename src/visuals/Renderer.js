import { vertex, fragment } from './shaders'
import { palettes } from './scenes'
import { OrbitalScene } from './OrbitalScene'

export class Renderer {
  constructor(canvas, settings, onError = () => {}) {
    this.canvas = canvas
    this.settings = settings
    this.onError = onError
    this.time = 0
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
    const compile = (type, source) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error(`Shader WebGL : ${log}`)
      }
      return shader
    }
    const vs = compile(gl.VERTEX_SHADER, vertex),
      fs = compile(gl.FRAGMENT_SHADER, fragment)
    this.program = gl.createProgram()
    gl.attachShader(this.program, vs)
    gl.attachShader(this.program, fs)
    gl.linkProgram(this.program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(this.program))
    gl.useProgram(this.program)
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(this.program, 'a_position')
    this.position = pos
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
    this.uniforms = {}
    for (const name of [
      'resolution',
      'time',
      'audio',
      'settings',
      'layers',
      'waves',
      'c1',
      'c2',
      'c3',
      'scene',
      'previous',
      'mix',
      'spectrum',
      'orbital',
      'orbitalImpact',
      'orbitalTint',
    ])
      this.uniforms[name] = gl.getUniformLocation(this.program, `u_${name}`)
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
    gl.uniform1i(this.uniforms.spectrum, 0)
    gl.uniform1i(this.uniforms.orbital, 1)
    gl.activeTexture(gl.TEXTURE1)
    this.orbital = new OrbitalScene(gl)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    this.palette = -1
    this.resize()
  }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect()
    const mode = this.settings.quality
    const budget = this.preview
      ? 480000
      : mode === 'high'
        ? 2073600
        : mode === 'eco'
          ? 520000
          : 1250000 * this.scale
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
    if (this.lost) return
    const start = performance.now(),
      s = this.settings,
      gl = this.gl,
      u = this.uniforms
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
    if (!s.frozen) this.time += Math.min(dt, 0.1) * s.speed
    if (s.scene !== this.scene && this.mix >= 1) {
      this.previous = this.scene
      this.scene = s.scene
      this.mix = 0
    }
    this.mix = s.transition <= 0 ? 1 : Math.min(1, this.mix + dt / s.transition)
    if (!s.frozen) {
      this.spectrum.set(spectrum)
      this.lastAudio[0] = audio.bass
      this.lastAudio[1] = audio.mid
      this.lastAudio[2] = audio.high
      this.lastAudio[3] = audio.beat
    }
    let orbitalImpact = 0
    if (this.scene === 0 || (this.previous === 0 && this.mix < 1)) {
      gl.activeTexture(gl.TEXTURE1)
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
    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.enableVertexAttribArray(this.position)
    gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 0, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1f(u.orbitalImpact, orbitalImpact)
    gl.uniform1f(u.orbitalTint, s.palette === 0 ? 0 : 1)
    if (s.palette !== this.palette) {
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
      this.palette = s.palette
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.spectrum)
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height)
    gl.uniform1f(u.time, this.time)
    gl.uniform4fv(u.audio, this.lastAudio)
    gl.uniform4f(u.settings, s.intensity, s.detail, s.glow, s.blackout ? 1 : 0)
    gl.uniform4f(u.layers, +s.ring, +s.dna, +s.grid, +s.eye)
    gl.uniform1f(u.waves, +s.waves)
    gl.uniform1i(u.scene, this.scene)
    gl.uniform1i(u.previous, this.previous)
    gl.uniform1f(u.mix, this.mix)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.renderMs += (performance.now() - start - this.renderMs) * 0.1
  }
  destroy() {
    this.observer.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    this.orbital.destroy()
    this.gl.deleteTexture(this.texture)
    this.gl.deleteBuffer(this.buffer)
    this.gl.deleteProgram(this.program)
  }
}
