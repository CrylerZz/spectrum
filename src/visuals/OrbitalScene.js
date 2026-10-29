// The original Canvas geometry, batched into a single GPU triangle stream.
// Coordinates use the original 800 px stage; no per-frame Canvas readback.
const TAU = Math.PI * 2
const NEON = [
  [0, 0.94, 1],
  [1, 0, 0.8],
  [0, 1, 0.52],
  [0.984, 0, 0.58],
  [0.494, 0.357, 0.937],
]
const VERTEX = `
attribute vec2 a_position;
attribute vec4 a_color;
uniform vec2 u_size;
varying vec4 v_color;
void main() {
  gl_Position = vec4(a_position.x * 2.0 / u_size.x, -a_position.y * 2.0 / u_size.y, 0.0, 1.0);
  v_color = a_color;
}`
const FRAGMENT = `precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }`

export class OrbitalScene {
  constructor(gl) {
    this.gl = gl
    this.vertices = new Float32Array(180000 * 6)
    this.dna = new Float32Array(5)
    this.matrix = new Float32Array([1, 0, 0, 1, 0, 0])
    this.waves = []
    this.shocks = []
    this.lastWave = -10
    this.lastShock = -10
    this.lastTime = 0
    this.energy = 0
    this.blink = 1
    this.lastBlink = -10
    this.width = 0
    this.height = 0
    this.color = [1, 1, 1, 1]
    this.colors = Array.from({ length: 360 }, (_, i) => {
      const hue = i / 60,
        x = 1 - Math.abs((hue % 2) - 1)
      const rgb =
        hue < 1
          ? [1, x, 0]
          : hue < 2
            ? [x, 1, 0]
            : hue < 3
              ? [0, 1, x]
              : hue < 4
                ? [0, x, 1]
                : hue < 5
                  ? [x, 0, 1]
                  : [1, 0, x]
      return rgb.map((v) => 0.3 + v * 0.7) // Original hsla(...,100%,65%).
    })
    const compile = (type, source) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader))
      return shader
    }
    const vs = compile(gl.VERTEX_SHADER, VERTEX),
      fs = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    this.program = gl.createProgram()
    gl.attachShader(this.program, vs)
    gl.attachShader(this.program, fs)
    gl.linkProgram(this.program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(this.program))
    this.position = gl.getAttribLocation(this.program, 'a_position')
    this.rgba = gl.getAttribLocation(this.program, 'a_color')
    this.size = gl.getUniformLocation(this.program, 'u_size')
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW)
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
    this.framebuffer = gl.createFramebuffer()
  }
  resize(width, height) {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    const scale = Math.min(width / 1000, height / 800)
    this.logicalWidth = width / scale
    this.logicalHeight = height / scale
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error('La cible de rendu Orbital est indisponible.')
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
  vertex(x, y, color = this.color) {
    if (this.count + 6 > this.vertices.length) return
    const m = this.matrix,
      v = this.vertices,
      n = this.count
    v[n] = m[0] * x + m[2] * y + m[4]
    v[n + 1] = m[1] * x + m[3] * y + m[5]
    v[n + 2] = color[0]
    v[n + 3] = color[1]
    v[n + 4] = color[2]
    v[n + 5] = color[3]
    this.count += 6
  }
  setColor(rgb, alpha = 1) {
    this.color[0] = rgb[0]
    this.color[1] = rgb[1]
    this.color[2] = rgb[2]
    this.color[3] = alpha
  }
  line(x1, y1, x2, y2, width) {
    const dx = x2 - x1,
      dy = y2 - y1,
      scale = (width * 0.5) / (Math.hypot(dx, dy) || 1),
      nx = -dy * scale,
      ny = dx * scale
    this.vertex(x1 + nx, y1 + ny)
    this.vertex(x1 - nx, y1 - ny)
    this.vertex(x2 + nx, y2 + ny)
    this.vertex(x2 + nx, y2 + ny)
    this.vertex(x1 - nx, y1 - ny)
    this.vertex(x2 - nx, y2 - ny)
  }
  disk(x, y, rx, ry, segments = 32, center = null) {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU,
        b = ((i + 1) / segments) * TAU
      this.vertex(x, y, center || this.color)
      this.vertex(x + Math.cos(a) * rx, y + Math.sin(a) * ry)
      this.vertex(x + Math.cos(b) * rx, y + Math.sin(b) * ry)
    }
  }
  plane(depth, time, energy, amount) {
    const strength = Math.pow(Math.max(0, energy - 10 / 255) / (245 / 255), 1.5)
    const pitch = (Math.sin(time * 0.3 + depth * 0.2) * 0.25 + 0.15) * amount
    const tilt = (Math.cos(time * 0.25 + depth * 0.1) * 0.22 + 0.1) * amount
    const rotation = time * 0.24 * amount,
      cr = Math.cos(rotation),
      sr = Math.sin(rotation)
    const ct = Math.cos(tilt),
      st = Math.sin(tilt),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch)
    const sx = 1 - depth * 0.03 * strength * amount,
      sy = sx * (1 - (1 - (0.55 + energy * 0.2)) * strength * amount)
    const m = this.matrix
    m[0] = (ct * cr - st * sr) * sx
    m[1] = (sp * cr + cp * sr) * sx
    m[2] = (-ct * sr - st * cr) * sy
    m[3] = (-sp * sr + cp * cr) * sy
    m[4] = Math.sin(time * 1.5 + depth) * 15 * amount
    m[5] = Math.cos(time * 1.5 + depth) * 15 * amount
    return strength
  }
  sample(spectrum, hz) {
    const p = Math.max(0, Math.min(63, (Math.log(Math.max(25, hz) / 25) / Math.log(640)) * 64)),
      i = Math.floor(p)
    return (spectrum[i] * (1 - (p - i)) + spectrum[Math.min(63, i + 1)] * (p - i)) / 255
  }
  render(time, audio, spectrum, settings, width, height) {
    this.resize(width, height)
    this.count = 0
    // Same nominal movement as the original at the default speed (0.65).
    const t = time / 0.65,
      dt = Math.max(0, Math.min(0.1, t - this.lastTime))
    this.lastTime = t
    this.energy += (audio[0] - this.energy) * (1 - Math.exp(-dt * 12))
    const e = this.energy,
      impact = audio[3],
      depth = settings.orbitalDepth ?? 1
    const psy = settings.orbitalPsy ?? 1,
      hot =
        Math.min(1, (settings.liveMode ? 0 : Math.max(0, (e - 0.76) / 0.18)) + impact * 0.35) * psy
    const circle =
      (this.sample(spectrum, 43) + this.sample(spectrum, 86) + this.sample(spectrum, 129)) / 3
    for (let i = 0; i < 5; i++) {
      let sum = 0,
        n = 0
      for (let j = Math.max(0, i - 2); j <= Math.min(4, i + 2); j++) {
        sum += this.sample(spectrum, j * 43)
        n++
      }
      this.dna[i] = sum / n
    }
    const baseRadius = 80 + Math.pow(e, 1.5) * 80
    const radius = baseRadius + Math.min(Math.pow(circle, 1.25) * 1.2, 0.85) * 70
    const count = Math.min(3, Math.floor(1 + e * 2)),
      frame = Math.floor(t * 18)
    const maxRadius = Math.hypot(this.logicalWidth / 2, this.logicalHeight / 2)
    if (((!settings.liveMode && e > 195 / 255) || impact > 0.85) && t - this.lastWave > 0.28) {
      this.waves.push(t)
      this.lastWave = t
    }
    if (((!settings.liveMode && e > 195 / 255) || impact > 0.85) && t - this.lastShock > 0.6) {
      this.shocks.push({
        time: t,
        radius: baseRadius,
        frequency: 0.2 + ((frame * 17) % 10) / 100,
        amplitude: 4 + ((frame * 7) % 6),
      })
      this.lastShock = t
    }
    // Cull when the wave leaves the stage, not 1,000 frames later.
    while (this.waves.length && (t - this.waves[0]) * 72 > maxRadius / 16 + 9) this.waves.shift()
    while (this.shocks.length && t - this.shocks[0].time > 1.9) this.shocks.shift()
    if (settings.grid) {
      this.plane(0, t, e, depth)
      const morph = (Math.sin(t * 0.6) + 1) / 2
      for (const born of this.waves) {
        const life = (t - born) * 72
        for (let r = 40; r < maxRadius; r += 40) {
          const pulse = Math.max(0, 1 - Math.abs(life - r / 16) / 9)
          if (pulse < 0.02) continue
          const gradient = Math.min(1, r / (this.logicalWidth / 1.5))
          this.setColor(
            [1 - gradient, gradient, 0.333 * (1 - gradient) + 0.969 * gradient],
            0.25 * (1 - gradient) + 0.05 * gradient,
          )
          for (let j = 0; j < 60; j++) {
            const a = (j / 60) * TAU,
              z = (Math.sin(j * 37 + r * 3) + 1) * 0.5
            const scale = 1 / (1 + z * 0.7 * Math.max(0, depth - 1))
            const x = Math.cos(a) * r * scale,
              y = Math.sin(a) * r * scale
            const boost = 1 + Math.pow(Math.max(0, Math.sin(t * 2 + j + r)), 20) * 1.5
            const size = pulse * 5 * boost * scale
            if (size < 1.2) this.line(x, y, x + 1, y, 1)
            else {
              this.disk(x, y, size * (1 - morph), size * (1 - morph), 8)
              const side = size * morph
              this.vertex(x - side, y - side)
              this.vertex(x + side, y - side)
              this.vertex(x + side, y + side)
              this.vertex(x - side, y - side)
              this.vertex(x + side, y + side)
              this.vertex(x - side, y + side)
            }
          }
        }
      }
    }
    if (settings.dna) {
      this.plane(2, t, e, depth)
      const points = Math.round(40 + settings.detail * 123),
        twist = Math.sin(t * 0.5) * 0.5,
        rotation = t * 0.2
      for (let i = 0; i < points; i++) {
        const a = (i / points) * TAU,
          ca = Math.cos(a + rotation),
          sa = Math.sin(a + rotation)
        const strength = Math.pow(this.dna[Math.min(4, Math.floor((i * 5) / points))], 1.2)
        const outer = radius + strength * (60 + e * 20)
        for (let layer = -count; layer <= count; layer++) {
          const offset = layer * 1.5 + Math.sin(a + layer * twist) * 30 * depth
          const rainbow = this.colors[Math.floor((i / points) * 359)]
          this.setColor(
            layer === 0
              ? rainbow
              : hot > 0.25
                ? NEON[(i * 13 + layer * 7 + frame * 3 + 1000) % 5]
                : NEON[2],
            0.35 - Math.abs(layer) * 0.06,
          )
          this.line(
            ca * radius,
            sa * radius + offset,
            ca * outer,
            sa * outer + offset,
            0.8 + e * 1.5 + Math.abs(layer) * 0.5,
          )
        }
      }
    }
    if (settings.waves) {
      this.plane(1, t, e, depth)
      for (const wave of this.shocks) {
        const age = t - wave.time,
          r = wave.radius + age * 240,
          alpha = Math.exp(-age * 2.45)
        for (let layer = -1; layer <= 1; layer++)
          for (let j = 0; j < 48; j++) {
            const a = (j / 48) * TAU,
              b = ((j + 1) / 48) * TAU
            const ra = r + Math.sin(j * wave.frequency) * wave.amplitude,
              rb = r + Math.sin((j + 1) * wave.frequency) * wave.amplitude
            const y = Math.sin(a) * 0.5 + 0.5
            this.setColor(
              y < 0.5 ? [1 - y * 2, y * 2, 0.33 + y * 1.3] : [(y - 0.5) * 2, 1, 1 - (y - 0.5) * 2],
              alpha * (1 - Math.abs(layer) * 0.15),
            )
            this.line(
              Math.cos(a) * ra,
              Math.sin(a) * ra + layer * 1.5,
              Math.cos(b) * rb,
              Math.sin(b) * rb + layer * 1.5,
              1,
            )
          }
      }
    }
    if (settings.ring) {
      const strength = this.plane(3, t, e, depth)
      const rebound = -strength * 30 * depth
      for (let layer = -count; layer <= count; layer++) {
        this.setColor(hot > 0.25 ? NEON[(frame + layer * 3 + 100) % 5] : NEON[3])
        for (let i = 0; i < 256; i++) {
          const a = (i / 256) * TAU,
            b = ((i + 1) / 256) * TAU
          this.line(
            Math.cos(a) * radius,
            Math.sin(a) * radius + rebound + layer * 1.5,
            Math.cos(b) * radius,
            Math.sin(b) * radius + rebound + layer * 1.5,
            4 + count - Math.abs(layer),
          )
        }
      }
      // The dark fill masks the inner side of the DNA, as in the original.
      this.setColor([10 / 255, 10 / 255, 18 / 255], 0.8)
      this.disk(0, rebound + count * 1.5, radius, radius, 128)
    }
    if (settings.eye) {
      this.plane(2, t, e, depth)
      if (t - this.lastBlink > 4.6) {
        this.blink = 0
        this.lastBlink = t
      }
      this.blink += (1 - this.blink) * (1 - Math.exp(-dt * 13.4))
      const openness = 0.6 * this.blink + 0.1 + e * 0.2
      this.setColor([0.96, 0.96, 1], 0.04)
      this.disk(0, 0, 100, 100 * openness, 64)
      const x = Math.sin(t * 0.8) * 8,
        y = Math.cos(t * 0.6) * 5,
        iris = 40 + e * 20
      this.setColor(NEON[4])
      this.disk(x, y, iris, iris, 64, [0.984, 0, 0.58, 1])
      const pupil = 6 + Math.pow(e, 1.5) * 6 + Math.max(0, e * 255 - 210) * 0.3
      this.setColor([0, 0, 0])
      this.disk(x, y, pupil, pupil, 32)
      this.setColor([1, 1, 1], 0.15)
      this.disk(x - 8, y - 8, 4, 4, 16)
    }
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.viewport(0, 0, width, height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices.subarray(0, this.count))
    gl.enableVertexAttribArray(this.position)
    gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(this.rgba)
    gl.vertexAttribPointer(this.rgba, 4, gl.FLOAT, false, 24, 8)
    gl.uniform2f(this.size, this.logicalWidth, this.logicalHeight)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLES, 0, this.count / 6)
    gl.disable(gl.BLEND)
    gl.disableVertexAttribArray(this.rgba)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return hot
  }
  destroy() {
    const gl = this.gl
    gl.deleteTexture(this.texture)
    gl.deleteFramebuffer(this.framebuffer)
    gl.deleteBuffer(this.buffer)
    gl.deleteProgram(this.program)
  }
}
