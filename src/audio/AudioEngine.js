import { Features } from './features.js'

export class AudioEngine {
  constructor(onEnded = () => {}) {
    this.context = null
    this.kind = 'idle'
    this.generation = 0
    this.onEnded = onEnded
    this.element = new Audio()
    this.element.preload = 'metadata'
    this.element.addEventListener('ended', () => this.onEnded('file-ended'))
    this.features = new Features()
    this.volume = 0.6
  }
  async init() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' })
      this.analyser = this.context.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.25
      this.analyser.minDecibels = -85
      this.analyser.maxDecibels = -15
      this.frequency = new Uint8Array(this.analyser.frequencyBinCount)
      this.decibels = new Float32Array(this.analyser.frequencyBinCount)
      this.waveform = new Uint8Array(this.analyser.fftSize)
      this.features = new Features(this.context.sampleRate, this.analyser.fftSize)
      this.output = this.context.createGain()
      this.output.gain.value = this.volume
      this.output.connect(this.context.destination)
    }
    await this.context.resume()
  }
  stop() {
    this.generation++
    this.kind = 'idle'
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.onended = null
        track.stop()
      }
      this.stream = null
    }
    if (this.demo) {
      try {
        this.demo.stop()
      } catch {}
      this.demo.disconnect()
      this.demo = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    this.element.pause()
    this.element.removeAttribute('src')
    this.element.load()
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
    this.features = new Features(this.context?.sampleRate || 48000)
  }
  async file(file) {
    this.stop()
    const generation = this.generation
    await this.init()
    if (generation !== this.generation) return false
    this.objectUrl = URL.createObjectURL(file)
    this.element.src = this.objectUrl
    this.mediaSource ||= this.context.createMediaElementSource(this.element)
    this.source = this.mediaSource
    this.source.connect(this.analyser)
    this.source.connect(this.output)
    this.kind = 'file'
    try {
      await this.element.play()
    } catch (error) {
      if (generation === this.generation) this.stop()
      throw error
    }
    return generation === this.generation
  }
  async capture(kind, deviceId = '') {
    this.stop()
    const generation = this.generation
    if (!navigator.mediaDevices)
      throw new Error('La capture audio nécessite localhost ou une connexion HTTPS.')
    // Invoke the chooser synchronously from the click, before awaiting resume().
    const request =
      kind === 'tab'
        ? navigator.mediaDevices.getDisplayMedia?.({ video: true, audio: true })
        : navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            },
            video: false,
          })
    if (!request)
      throw new Error(
        'La capture d’onglet n’est pas disponible dans ce navigateur. Essaie Chrome ou un fichier audio.',
      )
    let stream
    try {
      stream = await request
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop())
        return false
      }
      if (!stream.getAudioTracks().length)
        throw new Error(
          'Aucun son partagé. Choisis un onglet et coche « Partager le son de l’onglet ».',
        )
      await this.init()
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop())
        return false
      }
      this.stream = stream
      this.source = this.context.createMediaStreamSource(stream)
      this.source.connect(this.analyser) // Never monitor inputs: avoids acoustic feedback.
      this.kind = kind
      for (const track of stream.getTracks())
        track.onended = () => {
          if (generation === this.generation) {
            this.stop()
            this.onEnded('capture-ended')
          }
        }
      return true
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop())
      throw error
    }
  }
  async startDemo() {
    this.stop()
    const generation = this.generation
    await this.init()
    if (generation !== this.generation) return false
    this.demoBuffer ||= this.makeDemo()
    this.demo = this.context.createBufferSource()
    this.demo.buffer = this.demoBuffer
    this.demo.loop = true
    this.demo.connect(this.analyser)
    this.demo.connect(this.output)
    this.demo.start()
    this.kind = 'demo'
    return true
  }
  makeDemo() {
    const rate = this.context.sampleRate,
      beat = 60 / 124,
      duration = beat * 16
    const buffer = this.context.createBuffer(2, Math.round(rate * duration), rate)
    const notes = [55, 55, 65.406, 49, 55, 82.407, 73.416, 65.406]
    let seed = 123456
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < data.length; i++) {
        const t = i / rate,
          q = t % beat,
          eighth = t % (beat / 2)
        const phase = 2 * Math.PI * (48 * q + 10 * (1 - Math.exp(-q * 40)))
        const kick = Math.sin(phase) * Math.exp(-q * 15) * 0.62
        seed = (seed * 1664525 + 1013904223) >>> 0
        const hat = ((seed / 4294967296) * 2 - 1) * Math.exp(-eighth * 100) * 0.085
        const note = notes[Math.floor(t / (beat * 2)) % notes.length]
        const bass =
          Math.sin(2 * Math.PI * note * eighth) * Math.sin((Math.PI * eighth) / (beat / 2)) * 0.18
        const pad =
          (Math.sin(t * Math.PI * 2 * 220 + ch * 0.4) + Math.sin(t * Math.PI * 2 * 329.628)) * 0.026
        const fade = Math.min(1, t * 40, (duration - t) * 40)
        data[i] = (kick + hat + bass + pad) * fade
      }
    }
    return buffer
  }
  setVolume(volume) {
    this.volume = volume
    if (this.output) this.output.gain.setTargetAtTime(volume, this.context.currentTime, 0.02)
  }
  async togglePlayback() {
    if (this.kind === 'demo') {
      if (this.context.state === 'running') await this.context.suspend()
      else await this.context.resume()
      return
    }
    if (this.kind !== 'file') return
    if (this.element.paused) {
      await this.context.resume()
      await this.element.play()
    } else this.element.pause()
  }
  update(dt, time, sensitivity, bassGain = 1) {
    if (this.kind === 'idle' || !this.analyser) return this.features.values
    if (this.context.state === 'suspended') {
      this.frequency.fill(0)
      this.decibels.fill(-Infinity)
      this.waveform.fill(128)
    } else {
      this.analyser.getByteFrequencyData(this.frequency)
      this.analyser.getFloatFrequencyData(this.decibels)
      this.analyser.getByteTimeDomainData(this.waveform)
    }
    return this.features.update(
      this.frequency,
      this.waveform,
      dt,
      time,
      sensitivity,
      bassGain,
      this.decibels,
    )
  }
  async devices() {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
  }
  async destroy() {
    this.stop()
    await this.context?.close()
  }
}

export function audioError(error) {
  if (error.name === 'NotAllowedError')
    return 'Autorisation refusée ou partage annulé. Tu peux réessayer, ou utiliser la démo et un fichier audio.'
  if (error.name === 'NotFoundError')
    return 'Aucune entrée audio détectée. Branche une interface ou utilise un fichier audio.'
  if (error.name === 'NotReadableError')
    return 'Cette entrée est indisponible ou utilisée par une autre application.'
  if (error.name === 'OverconstrainedError')
    return 'Cette entrée n’est plus disponible. Actualise la liste des périphériques.'
  if (error.name === 'NotSupportedError')
    return 'Ce format audio n’est pas lisible ici. Essaie un fichier MP3, WAV ou OGG.'
  return error.message || 'Impossible de démarrer cette source audio.'
}
