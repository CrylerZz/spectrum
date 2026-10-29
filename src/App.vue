<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { AudioEngine, audioError } from './audio/AudioEngine'
import { Renderer } from './visuals/Renderer'
import { defaults, startupMix, cleanSettings, scenes, palettes } from './visuals/scenes'

const outputId = new URLSearchParams(location.search).get('output')
const isOutput = !!outputId
let restored = defaults
try {
  restored = cleanSettings(JSON.parse(localStorage.getItem('spectrum.settings.v1')))
} catch {}
restored = { ...restored, ...startupMix }
const settings = reactive({ ...restored })
const engineSettings = { ...restored }
const canvas = ref(null),
  stage = ref(null),
  audioInput = ref(null),
  presetInput = ref(null)
const sourceTab = ref('file'),
  source = ref('idle'),
  sourceName = ref('Aucune source connectée')
const busy = ref(false),
  error = ref(''),
  graphicsError = ref(''),
  help = ref(false),
  dragging = ref(false)
const devices = ref([]),
  deviceId = ref(''),
  volume = ref(0.6),
  playing = ref(false),
  trackTime = ref(0),
  duration = ref(0)
const stats = reactive({
  fps: 0,
  ms: 0,
  width: 0,
  height: 0,
  bass: 0,
  mid: 0,
  high: 0,
  level: 0,
  bpm: 0,
  beat: 0,
})
const bars = ref(Array(32).fill(0)),
  outputOpen = ref(false),
  outputConnected = ref(false),
  notice = ref('')
const savedPresets = ref([]),
  presetName = ref(''),
  presetSelection = ref('')
try {
  const stored = JSON.parse(localStorage.getItem('spectrum.presets.v1'))
  if (Array.isArray(stored))
    savedPresets.value = stored
      .filter((p) => typeof p.name === 'string')
      .slice(0, 30)
      .map((p) => ({ name: p.name.slice(0, 40), settings: cleanSettings(p.settings) }))
} catch {}
let backgroundTimer, previousFocus
let renderer,
  frame,
  uiTime = 0,
  sendTime = 0,
  last = 0,
  autoTime = 0,
  channel,
  projection,
  saveTimer,
  toastTimer,
  requestId = 0
let remoteAudio = { bass: 0, mid: 0, high: 0, beat: 0 },
  remoteSpectrum = new Uint8Array(64),
  lastPacket = 0
const channelId = outputId || crypto.randomUUID()
const audio = new AudioEngine((reason) => {
  if (reason === 'capture-ended') {
    source.value = 'idle'
    sourceName.value = 'Partage terminé'
    playing.value = false
  }
  if (reason === 'file-ended') playing.value = false
})
const graphicsLoading = reactive({
  active: true,
  completed: 0,
  total: scenes.length,
  failed: 0,
  current: '',
  waiting: true,
})
const currentScene = computed(
  () => scenes.find((scene) => scene.id === settings.scene) || scenes[0],
)
const isOrbital = computed(() => settings.scene === 0 || settings.scene === 6)
const sourceTitle = computed(
  () =>
    ({
      idle: 'EN ATTENTE',
      demo: 'DÉMO LIVE',
      file: 'FICHIER AUDIO',
      mic: 'ENTRÉE AUDIO',
      tab: 'CAPTURE LIVE',
    })[source.value],
)
const formatTime = (value) =>
  Number.isFinite(value)
    ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
    : '0:00'
const controls = [
  { key: 'sensitivity', name: 'Sensibilité audio', min: 0.3, max: 3, unit: '×' },
  { key: 'bassGain', name: 'Réponse des basses', min: 0, max: 2, unit: '×' },
  { key: 'intensity', name: 'Intensité', min: 0.2, max: 2, unit: '×' },
  { key: 'speed', name: 'Mouvement', min: 0, max: 2, unit: '×' },
  { key: 'detail', name: 'Détail / densité', min: 0.2, max: 1, unit: '%' },
  { key: 'glow', name: 'Halo lumineux', min: 0, max: 1, unit: '%' },
  { key: 'orbitalDepth', name: 'Relief 3D · Orbital', min: 0, max: 1.5, unit: '%', orbital: true },
  {
    key: 'orbitalPsy',
    name: 'Psychédélisme · Orbital',
    min: 0,
    max: 1.5,
    unit: '%',
    orbital: true,
  },
]
const raveControls = [
  { key: 'raveEnergy', name: 'Énergie', max: 2 },
  { key: 'raveDepth', name: 'Coup de sub · profondeur', max: 2 },
  { key: 'ravePsy', name: 'Psychédélisme', max: 2 },
  { key: 'raveFlash', name: 'Flashs sur les frappes', max: 1 },
]
const motionChannels = [
  { key: 'rotation', name: 'Rotation' },
  { key: 'deformation', name: 'Déformation' },
  { key: 'travel', name: 'Déplacement' },
]
const motionControls = [
  { key: 'motionStrength', name: 'Force des impulsions', min: 0, max: 3 },
  { key: 'motionInertia', name: 'Inertie', min: 0, max: 1 },
  { key: 'motionThreshold', name: 'Seuil de déclenchement', min: 0.02, max: 0.8 },
]
const livePads = [
  { action: 'strike', name: 'Frappe', key: 'J', hint: 'Coup de sub' },
  { action: 'flash', name: 'Flash', key: 'K', hint: 'Éclair bref' },
  { action: 'explosion', name: 'Explosion', key: 'L', hint: 'Dispersion' },
]
const liveActive = ref('')
const boostHeld = ref(false)
const boostInputs = new Set()
let liveFeedbackTimer
function syncLive() {
  if (!isOutput && outputOpen.value && renderer)
    channel?.postMessage({
      type: 'live',
      settings: { ...engineSettings },
      motion: renderer.motion.snapshot(),
    })
}
function triggerLive(action) {
  if (!settings.liveMode || settings.frozen || settings.blackout || isOutput) return
  renderer?.motion.trigger(action, engineSettings)
  liveActive.value = action
  clearTimeout(liveFeedbackTimer)
  liveFeedbackTimer = setTimeout(() => (liveActive.value = ''), 140)
  syncLive()
}
function setBoostInput(input, pressed) {
  if (pressed && settings.liveMode && !settings.frozen && !settings.blackout && !isOutput)
    boostInputs.add(input)
  else boostInputs.delete(input)
  boostHeld.value = boostInputs.size > 0
  renderer?.motion.setBoost(boostHeld.value, engineSettings)
  syncLive()
}
function releaseLive() {
  boostInputs.clear()
  boostHeld.value = false
  renderer?.motion.setBoost(false, engineSettings)
  liveActive.value = ''
  clearTimeout(liveFeedbackTimer)
  syncLive()
}
function boostPointer(event) {
  if (event.button !== 0) return
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  setBoostInput(`pointer-${event.pointerId}`, true)
}
function releaseBoostPointer(event) {
  setBoostInput(`pointer-${event.pointerId}`, false)
}
function releaseBoostKeyboard() {
  setBoostInput('button-space', false)
  setBoostInput('button-enter', false)
}
function liveKeyup(event) {
  if (event.key.toLowerCase() === 'u') setBoostInput('keyboard', false)
}
function liveVisibility() {
  if (document.hidden) releaseLive()
}
watch(
  () => settings.liveMode,
  (enabled) => {
    renderer?.motion.setLiveMode(enabled)
    releaseLive()
  },
)
watch(() => [settings.frozen, settings.blackout, settings.scene, help.value], releaseLive)
const layers = [
  { key: 'ring', label: 'Cercle' },
  { key: 'dna', label: 'ADN' },
  { key: 'grid', label: 'Grille' },
  { key: 'eye', label: 'Œil' },
  { key: 'waves', label: 'Ondes' },
]
watch(
  settings,
  () => {
    Object.assign(engineSettings, settings)
    if (!isOutput) {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem('spectrum.settings.v1', JSON.stringify(cleanSettings(settings)))
        } catch {}
      }, 400)
    }
  },
  { deep: true, flush: 'sync' },
)
watch(volume, (v) => audio.setVolume(v))
watch(help, async (open) => {
  if (open) {
    previousFocus = document.activeElement
    await nextTick()
    document.querySelector('.close-dialog')?.focus()
  } else previousFocus?.focus()
})
function toast(message) {
  notice.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (notice.value = ''), 4000)
}
async function run(kind, name, action) {
  const id = ++requestId
  busy.value = true
  error.value = ''
  source.value = 'idle'
  playing.value = false
  sourceName.value = 'Connexion…'
  try {
    const started = await action()
    if (id !== requestId || !started) return
    source.value = kind
    sourceName.value = name
    playing.value = true
    if (kind === 'mic') await refreshDevices()
  } catch (e) {
    if (id === requestId) {
      error.value = audioError(e)
      sourceName.value = 'Aucune source connectée'
    }
  } finally {
    if (id === requestId) busy.value = false
  }
}
function demo() {
  return run('demo', 'Night drive · boucle démo · 124 BPM', () => audio.startDemo())
}
function loadFile(file) {
  if (!file) return
  if (
    file.type &&
    !file.type.startsWith('audio/') &&
    !/\.(mp3|wav|ogg|m4a|aac|flac|aiff|webm)$/i.test(file.name)
  ) {
    error.value = 'Choisis un fichier audio (MP3, WAV, OGG, M4A…).'
    return
  }
  sourceTab.value = 'file'
  return run('file', file.name, () => audio.file(file))
}
function fileChange(event) {
  loadFile(event.target.files?.[0])
  event.target.value = ''
}
function drop(event) {
  dragging.value = false
  loadFile(event.dataTransfer.files?.[0])
}
function capture(kind) {
  const name =
    kind === 'tab'
      ? 'Son partagé par le navigateur'
      : devices.value.find((d) => d.deviceId === deviceId.value)?.label ||
        'Micro / entrée par défaut'
  return run(kind, name, () => audio.capture(kind, deviceId.value))
}
function stop() {
  requestId++
  audio.stop()
  busy.value = false
  source.value = 'idle'
  playing.value = false
  sourceName.value = 'Aucune source connectée'
  trackTime.value = 0
  duration.value = 0
}
async function playback() {
  try {
    await audio.togglePlayback()
    playing.value =
      source.value === 'demo' ? audio.context.state === 'running' : !audio.element.paused
  } catch (e) {
    error.value = audioError(e)
  }
}
function seek(event) {
  if (Number.isFinite(audio.element.duration))
    audio.element.currentTime = Number(event.target.value)
}
async function refreshDevices() {
  try {
    devices.value = await audio.devices()
  } catch (e) {
    error.value = audioError(e)
  }
}
function selectScene(id) {
  settings.scene = id
  autoTime = 0
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await stage.value.requestFullscreen()
  } catch {
    toast('Le plein écran n’est pas disponible ici. Utilise la fenêtre de projection.')
  }
}
function openProjection() {
  if (projection && !projection.closed) {
    projection.focus()
    return
  }
  projection = window.open(
    `${location.pathname}?output=${encodeURIComponent(channelId)}`,
    'spectrum-output-' + channelId,
    'popup,width=1280,height=720',
  )
  if (!projection) {
    error.value =
      'La fenêtre a été bloquée. Autorise les fenêtres surgissantes pour ouvrir la projection.'
    return
  }
  outputOpen.value = true
  if (renderer) {
    renderer.preview = true
    renderer.resize()
  }
  toast('Déplace la fenêtre sur ton écran de sortie, puis passe-la en plein écran.')
}
function savePreset() {
  const name = presetName.value.trim().slice(0, 40)
  if (!name) {
    toast('Donne un nom à ton preset.')
    return
  }
  const preset = { name, settings: cleanSettings(settings) }
  const index = savedPresets.value.findIndex((p) => p.name === name)
  if (index >= 0) savedPresets.value[index] = preset
  else {
    if (savedPresets.value.length >= 30) {
      toast('Limite de 30 presets atteinte. Supprime un preset.')
      return
    }
    savedPresets.value.push(preset)
  }
  persistPresets()
  presetName.value = ''
  presetSelection.value = name
  toast('Preset enregistré sur cet ordinateur.')
}
function persistPresets() {
  try {
    localStorage.setItem('spectrum.presets.v1', JSON.stringify(savedPresets.value))
  } catch {
    error.value = 'Le navigateur ne peut pas enregistrer les presets. Exporte-les en JSON.'
  }
}
function applyPreset() {
  const p = savedPresets.value.find((p) => p.name === presetSelection.value)
  if (p) {
    Object.assign(settings, cleanSettings(p.settings), { liveMode: settings.liveMode })
    autoTime = 0
  }
}
function removePreset() {
  savedPresets.value = savedPresets.value.filter((p) => p.name !== presetSelection.value)
  presetSelection.value = ''
  persistPresets()
}
function exportPreset() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          name: presetSelection.value || currentScene.value.name,
          settings: cleanSettings(settings),
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  )
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = 'spectrum-preset.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function importPreset(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    if (file.size > 100000) throw new Error('Fichier trop volumineux.')
    const preset = JSON.parse(await file.text())
    if (preset.version !== 1 || !preset.settings || typeof preset.settings !== 'object')
      throw new Error('Format de preset non reconnu.')
    Object.assign(settings, cleanSettings(preset.settings), { liveMode: settings.liveMode })
    presetName.value = String(preset.name || 'Preset importé').slice(0, 40)
    toast('Preset chargé. Enregistre-le pour le retrouver.')
  } catch (e) {
    error.value = `Import impossible : ${e.message}`
  }
}
function keydown(event) {
  if (help.value) {
    if (event.key === 'Escape') {
      help.value = false
      return
    }
    if (event.key === 'Tab') {
      const buttons = document.querySelectorAll('.help-dialog button')
      const first = buttons[0],
        last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    return
  }
  if (
    event.target.closest?.('input,select,textarea,[contenteditable="true"]') ||
    (event.target.closest?.('button') && [' ', 'Enter'].includes(event.key)) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat
  )
    return
  if (event.key === 'Escape') {
    help.value = false
    return
  }
  if (help.value) return
  const key = event.key.toLowerCase()
  if (key === 'f') {
    event.preventDefault()
    fullscreen()
  }
  if (isOutput) return
  if (settings.liveMode) {
    const pad = livePads.find((pad) => pad.key.toLowerCase() === key)
    if (pad || key === 'u') {
      event.preventDefault()
      if (pad) triggerLive(pad.action)
      else setBoostInput('keyboard', true)
      return
    }
  }
  if (/^[1-9]$/.test(key)) selectScene(Number(key) - 1)
  if (key === '0') selectScene(9)
  if (key === ' ') {
    event.preventDefault()
    settings.frozen = !settings.frozen
  }
  if (key === 'b') settings.blackout = !settings.blackout
  if (key === 'a') settings.auto = !settings.auto
  if (key === 'arrowright') {
    event.preventDefault()
    selectScene(
      scenes[(scenes.findIndex((scene) => scene.id === settings.scene) + 1) % scenes.length].id,
    )
  }
  if (key === '?') help.value = true
}
function tick(now) {
  frame = requestAnimationFrame(tick)
  if (!document.hidden) processFrame(now)
}
function processFrame(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.25) : 1 / 60
  last = now
  let values, spectrum
  if (isOutput) {
    values = remoteAudio
    spectrum = remoteSpectrum
    outputConnected.value = now - lastPacket < 3000 && lastPacket > 0
    if (!outputConnected.value) renderer?.motion.setBoost(false, engineSettings)
  } else {
    values = audio.update(dt, now / 1000, engineSettings.sensitivity, engineSettings.bassGain)
    spectrum = audio.features.spectrum
    if (
      settings.auto &&
      !settings.frozen &&
      source.value !== 'idle' &&
      !(
        (source.value === 'file' && audio.element.paused) ||
        (source.value === 'demo' && !playing.value)
      )
    ) {
      autoTime += dt
      if (autoTime >= settings.autoInterval)
        selectScene(
          scenes[(scenes.findIndex((scene) => scene.id === settings.scene) + 1) % scenes.length].id,
        )
    }
    if (projection?.closed && outputOpen.value) {
      outputOpen.value = false
      if (renderer) {
        renderer.preview = false
        renderer.resize()
      }
    }
    if (document.hidden && renderer) {
      renderer.motion.update(dt, values, engineSettings)
      if (!engineSettings.frozen)
        renderer.time +=
          Math.min(dt, 0.1) *
          engineSettings.speed *
          (engineSettings.liveMode ? 1 + renderer.motion.boost * 2.5 : 1)
    }
    if (outputOpen.value && now - sendTime >= 1000 / 30) {
      channel.postMessage({
        type: 'frame',
        settings: { ...engineSettings },
        audio: { ...values },
        spectrum,
        time: renderer?.time || 0,
        motion: renderer?.motion.snapshot(),
      })
      sendTime = now
    }
  }
  if (!document.hidden) renderer?.render(dt, values, spectrum)
  if (now - uiTime > 100) {
    Object.assign(stats, {
      ...values,
      fps: renderer?.fps || 0,
      ms: renderer?.renderMs || 0,
      width: renderer?.dimensions[0] || 0,
      height: renderer?.dimensions[1] || 0,
    })
    if (!isOutput) {
      bars.value = Array.from(
        { length: 32 },
        (_, i) => Math.max(spectrum[i * 2], spectrum[i * 2 + 1]) / 255,
      )
      trackTime.value = audio.element.currentTime || 0
      duration.value = Number.isFinite(audio.element.duration) ? audio.element.duration : 0
      if (source.value === 'file') playing.value = !audio.element.paused
    }
    uiTime = now
  }
}
onMounted(() => {
  try {
    renderer = new Renderer(
      canvas.value,
      engineSettings,
      (message) => (graphicsError.value = message),
      (progress) => Object.assign(graphicsLoading, progress),
    )
  } catch (e) {
    graphicsError.value = e.message
    graphicsLoading.active = false
  }
  channel = new BroadcastChannel('spectrum-' + channelId)
  if (isOutput)
    channel.onmessage = ({ data }) => {
      if (data.type === 'live') {
        Object.assign(engineSettings, data.settings)
        renderer?.motion.restore(data.motion)
        return
      }
      if (data.type !== 'frame') return
      Object.assign(engineSettings, data.settings)
      remoteAudio = data.audio
      remoteSpectrum.set(data.spectrum)
      lastPacket = performance.now()
      if (renderer) {
        if (Math.abs(renderer.time - data.time) > 0.15) renderer.time = data.time
        renderer.motion.restore(data.motion)
      }
    }
  else refreshDevices()
  frame = requestAnimationFrame(tick)
  backgroundTimer = setInterval(() => {
    if (document.hidden && !isOutput && outputOpen.value) processFrame(performance.now())
  }, 50)
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', liveKeyup)
  window.addEventListener('blur', releaseLive)
  document.addEventListener('visibilitychange', liveVisibility)
  navigator.mediaDevices?.addEventListener('devicechange', refreshDevices)
  // A read-only diagnostic surface for profiling. No audio data or controls are exposed.
  if (import.meta.env.DEV)
    window.__spectrumMetrics = () => ({
      ...stats,
      time: renderer?.time,
      contextLost: renderer?.lost,
      renderedScene: renderer?.scene,
      readyScenes: renderer?.programs.size || 0,
      failedScenes: [...(renderer?.failureMessages.entries() || [])],
      loading: { ...graphicsLoading },
      live: renderer
        ? {
            mode: renderer.motion.liveMode,
            impact: renderer.motion.impact,
            flash: renderer.motion.flash,
            explosion: renderer.motion.explosion,
            boost: renderer.motion.boost,
            held: renderer.motion.boostHeld,
          }
        : null,
      source: source.value,
    })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearInterval(backgroundTimer)
  clearTimeout(saveTimer)
  clearTimeout(toastTimer)
  releaseLive()
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('keyup', liveKeyup)
  window.removeEventListener('blur', releaseLive)
  document.removeEventListener('visibilitychange', liveVisibility)
  navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices)
  channel?.close()
  renderer?.destroy()
  audio.destroy()
})
</script>

<template>
  <div v-if="isOutput" ref="stage" class="projection-stage">
    <canvas ref="canvas" aria-label="Projection des visuels Spectrum"></canvas>
    <div class="projection-tools">
      <span>SPECTRUM / OUTPUT</span><button @click="fullscreen">Plein écran ↗</button>
    </div>
    <div v-if="!outputConnected" class="projection-wait">
      En attente du poste de contrôle…<small>Garde la fenêtre Spectrum ouverte.</small>
    </div>
    <div
      v-if="graphicsLoading.active"
      class="graphics-loading"
      :class="{ 'scene-waiting': graphicsLoading.waiting }"
      role="status"
    >
      <div>
        <strong>{{
          graphicsLoading.waiting ? 'Préparation de la scène…' : 'Préchargement des scènes'
        }}</strong
        ><span>{{ graphicsLoading.completed }} / {{ graphicsLoading.total }}</span>
      </div>
      <progress
        :value="graphicsLoading.completed"
        :max="graphicsLoading.total"
        aria-label="Préchargement des scènes"
      ></progress>
      <small
        >{{ graphicsLoading.current
        }}<template v-if="graphicsLoading.failed">
          · {{ graphicsLoading.failed }} échec(s)</template
        ></small
      >
    </div>
    <div v-if="graphicsError" class="graphics-error">{{ graphicsError }}</div>
  </div>
  <div v-else class="studio">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Spectrum, accueil"
        ><span class="brand-mark"><i></i><i></i><i></i><i></i><i></i></span
        ><strong>SPECTRUM<span>LIVE VISUAL STUDIO</span></strong></a
      >
      <div class="session-name">
        <span class="status-dot" :class="{ active: source !== 'idle' }"></span
        >{{ source === 'idle' ? 'Prêt à jouer' : 'Session en direct'
        }}<span class="session-divider">/</span><span>Session locale</span>
      </div>
      <div class="top-actions">
        <button class="quiet help-button" @click="help = true" aria-label="Ouvrir l’aide">?</button
        ><button class="button output-button" @click="openProjection">
          <span>▣</span> {{ outputOpen ? 'Voir la projection' : 'Ouvrir la projection' }}
          <span>↗</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="source-panel panel">
        <div class="panel-heading">
          <span class="eyebrow">01 / AUDIO</span
          ><span class="tiny-dot" :class="{ on: source !== 'idle' }"></span>
        </div>
        <h2>Le son donne le rythme.</h2>
        <p class="muted intro">Choisis ta source. Les visuels suivent.</p>
        <button class="demo-button" :disabled="busy" @click="demo">
          <span class="play-symbol">▶</span
          ><span
            ><strong>Lancer la démo</strong><small>Un premier voyage, sans branchement</small></span
          ><span>↗</span>
        </button>
        <div class="section-label">SOURCE AUDIO</div>
        <div class="source-tabs" role="tablist" aria-label="Source audio">
          <button
            v-for="tab in [
              { id: 'file', label: 'Fichier' },
              { id: 'tab', label: 'Onglet' },
              { id: 'mic', label: 'Entrée' },
            ]"
            :key="tab.id"
            role="tab"
            :aria-selected="sourceTab === tab.id"
            :class="{ selected: sourceTab === tab.id }"
            @click="sourceTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="source-content">
          <button
            v-if="sourceTab === 'file'"
            class="dropzone"
            :class="{ dragging }"
            :disabled="busy"
            @click="audioInput.click()"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="drop"
          >
            <span class="upload-symbol">↥</span><strong>Dépose ton morceau ici</strong
            ><span>ou clique pour parcourir</span><small>MP3, WAV, FLAC, OGG, M4A</small>
          </button>
          <div v-else-if="sourceTab === 'tab'" class="source-instructions">
            <span class="source-icon">▤</span><strong>La musique de ton navigateur</strong>
            <p>
              Ouvre YouTube, une radio ou ton lecteur web. Sélectionne son onglet et coche
              <b>Partager le son</b>.
            </p>
            <button class="button wide" :disabled="busy" @click="capture('tab')">
              Capturer un onglet ↗</button
            ><small
              >Chrome / Edge conseillés. La capture du son système dépend du navigateur et de
              l’OS.</small
            >
          </div>
          <div v-else class="source-instructions">
            <span class="source-icon">◉</span><strong>Micro ou interface audio</strong>
            <p>Écoute autour de toi, ou choisis une entrée reliée à une table de mixage.</p>
            <label class="sr-only" for="device">Entrée audio</label
            ><select id="device" v-model="deviceId">
              <option value="">Entrée par défaut</option>
              <option
                v-for="(device, i) in devices"
                :key="device.deviceId || i"
                :value="device.deviceId"
              >
                {{ device.label || `Entrée audio ${i + 1}` }}
              </option></select
            ><button class="button wide" :disabled="busy" @click="capture('mic')">
              {{ source === 'mic' ? 'Reconnecter cette entrée' : 'Activer l’entrée' }}</button
            ><button class="text-button" @click="refreshDevices">↻ Actualiser les entrées</button
            ><small
              >Les noms apparaissent après autorisation du micro. Le son capturé n’est pas renvoyé
              aux enceintes.</small
            >
          </div>
        </div>
        <input
          ref="audioInput"
          class="sr-only"
          tabindex="-1"
          type="file"
          accept="audio/*,.flac,.m4a"
          @change="fileChange"
        />
        <div v-if="error" class="error-box" role="alert">
          {{ error }}<button @click="error = ''" aria-label="Fermer l’erreur">×</button>
        </div>
        <div class="signal-panel">
          <div class="section-label signal-title">
            <span>SIGNAL ENTRANT</span
            ><span class="signal-state">{{ stats.level > 0.01 ? 'ACTIF' : 'SILENCE' }}</span>
          </div>
          <div class="spectrum-bars" aria-hidden="true">
            <i
              v-for="(bar, i) in bars"
              :key="i"
              :style="{ height: `${Math.max(4, bar * 100)}%`, opacity: 0.2 + bar * 0.8 }"
            ></i>
          </div>
          <details class="audio-details">
            <summary>Détails du signal audio</summary>
            <div
              class="band-meter"
              v-for="band in [
                { key: 'bass', label: 'Basses' },
                { key: 'mid', label: 'Médiums' },
                { key: 'high', label: 'Aigus' },
              ]"
              :key="band.key"
            >
              <span>{{ band.label }}</span>
              <div><i :style="{ width: `${stats[band.key] * 100}%` }"></i></div>
              <small>{{ Math.round(stats[band.key] * 100) }}</small>
            </div>
            <div class="bpm-row">
              <span class="beat-dot" :style="{ opacity: 0.2 + stats.beat * 0.8 }"></span
              ><strong>{{ source === 'demo' ? '124' : stats.bpm || '—' }}</strong
              ><span>BPM {{ source === 'demo' ? 'DÉMO' : 'ESTIMÉS' }}</span>
            </div>
          </details>
          <p class="motion-hint">
            Branche ta musique : les frappes déclenchent les impacts et les flashs automatiquement.
          </p>
        </div>
        <div class="local-note">
          <span>⌁</span>
          <p>Le son reste sur ton ordinateur.<br />Aucun fichier envoyé en ligne.</p>
        </div>
      </aside>

      <section class="center-column">
        <div class="preview-toolbar">
          <div>
            <span class="eyebrow">02 / LIVE CANVAS</span
            ><span class="live-pill"
              ><i></i> {{ settings.blackout ? 'NOIR' : settings.frozen ? 'FIGÉ' : 'LIVE' }}</span
            >
          </div>
          <div class="preview-meta">
            <span>{{ stats.width }} × {{ stats.height }}</span
            ><span class="fps" :class="{ low: stats.fps > 0 && stats.fps < 45 }"
              >{{ stats.fps || '—' }} FPS</span
            ><button
              class="icon-button"
              @click="fullscreen"
              aria-label="Visuels en plein écran"
              title="Plein écran · F"
            >
              ⛶
            </button>
          </div>
        </div>
        <div ref="stage" class="visual-stage" @dblclick="fullscreen">
          <canvas ref="canvas" aria-label="Visualisation audio réactive"></canvas>
          <div class="stage-top">
            <span class="stage-label">{{ currentScene.name.toUpperCase() }}</span
            ><span>SPECTRUM ENGINE / 01</span>
          </div>
          <div class="stage-bottom">
            <span>{{ currentScene.tag }}</span
            ><span>RÉACTIF AU SON <i :class="{ active: stats.level > 0.01 }"></i></span>
          </div>
          <button class="fullscreen-exit" @click="fullscreen">Quitter le plein écran ↙</button>
          <div
            v-if="graphicsLoading.active"
            class="graphics-loading"
            :class="{ 'scene-waiting': graphicsLoading.waiting }"
            role="status"
          >
            <div>
              <strong>{{
                graphicsLoading.waiting ? 'Préparation de la scène…' : 'Préchargement des scènes'
              }}</strong
              ><span>{{ graphicsLoading.completed }} / {{ graphicsLoading.total }}</span>
            </div>
            <progress
              :value="graphicsLoading.completed"
              :max="graphicsLoading.total"
              aria-label="Préchargement des scènes"
            ></progress>
            <small
              >{{ graphicsLoading.current
              }}<template v-if="graphicsLoading.failed">
                · {{ graphicsLoading.failed }} échec(s)</template
              ></small
            >
          </div>
          <div v-if="graphicsError" class="graphics-error" role="alert">{{ graphicsError }}</div>
        </div>
        <div class="transport">
          <button
            class="transport-play"
            :disabled="busy || source === 'mic' || source === 'tab'"
            :aria-label="
              ['file', 'demo'].includes(source)
                ? playing
                  ? 'Pause'
                  : 'Lire'
                : source === 'idle'
                  ? 'Lancer la démo'
                  : 'Capture active'
            "
            @click="['file', 'demo'].includes(source) ? playback() : demo()"
          >
            {{ ['file', 'demo'].includes(source) && playing ? 'Ⅱ' : '▶' }}
          </button>
          <div class="track-info">
            <span>{{ busy ? 'CONNEXION…' : sourceTitle }}</span
            ><strong :title="sourceName">{{ sourceName }}</strong>
          </div>
          <button
            class="stop-button"
            :disabled="source === 'idle' && !busy"
            @click="stop"
            aria-label="Arrêter et libérer la source"
            title="Arrêter la source"
          >
            ■
          </button>
          <div class="volume-control">
            <span aria-hidden="true">◖</span
            ><input
              v-model.number="volume"
              aria-label="Volume d’écoute des fichiers et de la démo"
              type="range"
              min="0"
              max="1"
              step=".01"
              :disabled="source === 'tab' || source === 'mic'"
            /><small>{{ Math.round(volume * 100) }}%</small>
          </div>
          <div v-if="source === 'file'" class="seek-row">
            <span>{{ formatTime(trackTime) }}</span
            ><input
              aria-label="Position dans le morceau"
              type="range"
              min="0"
              :max="duration || 1"
              :value="trackTime"
              step=".1"
              @input="seek"
            /><span>{{ formatTime(duration) }}</span>
          </div>
        </div>
        <section class="scenes-panel">
          <div class="scenes-heading">
            <div>
              <span class="eyebrow">03 / SCÈNES</span
              ><span class="scene-count">{{ scenes.length }} univers à explorer</span>
            </div>
            <label class="auto-control"
              ><span>Auto-pilote</span
              ><input v-model="settings.auto" type="checkbox" role="switch" /><span
                class="switch"
              ></span
            ></label>
          </div>
          <div class="scene-grid">
            <button
              v-for="(scene, sceneIndex) in scenes"
              :key="scene.id"
              class="scene-card"
              :class="{ selected: settings.scene === scene.id }"
              :aria-pressed="settings.scene === scene.id"
              :title="scene.tag"
              @click="selectScene(scene.id)"
            >
              <div class="scene-art" :class="scene.type">
                <i></i><i></i><i></i
                ><span class="scene-index">{{ String(sceneIndex + 1).padStart(2, '0') }}</span
                ><span v-if="settings.scene === scene.id" class="scene-active">↗</span>
              </div>
              <div class="scene-caption">
                <strong>{{ scene.name }}</strong
                ><kbd v-if="scene.id < 10">{{ (scene.id + 1) % 10 }}</kbd>
              </div>
            </button>
          </div>
          <div class="scene-footer">
            <span>Des transitions fluides, une même énergie.</span
            ><label v-if="settings.auto"
              >Changer toutes les
              <select
                v-model.number="settings.autoInterval"
                aria-label="Intervalle du mode automatique"
              >
                <option :value="12">12 s</option>
                <option :value="24">24 s</option>
                <option :value="48">48 s</option>
              </select></label
            ><span v-else><kbd>→</kbd> pour parcourir les {{ scenes.length }} scènes</span>
          </div>
        </section>
      </section>

      <aside class="controls-panel panel">
        <div class="panel-heading">
          <span class="eyebrow">04 / MIX VISUEL</span
          ><button
            class="text-button"
            @click="Object.assign(settings, defaults)"
            title="Rétablir tous les réglages"
          >
            ↺ Réinitialiser
          </button>
        </div>
        <section class="live-console control-group" :class="{ 'live-enabled': settings.liveMode }">
          <label class="live-switch">
            <span
              >MODE LIVE
              <small>{{
                settings.liveMode ? 'Tu commandes les impacts' : 'Réactions automatiques'
              }}</small></span
            >
            <input
              v-model="settings.liveMode"
              type="checkbox"
              role="switch"
              aria-label="Activer le pilotage live"
            />
          </label>
          <template v-if="settings.liveMode">
            <p class="motion-hint">
              La scène continue de vivre. Déclenche les impacts toi-même, même sans musique.
            </p>
            <div class="live-pads">
              <button
                v-for="pad in livePads"
                :key="pad.action"
                type="button"
                :class="{ 'pad-active': liveActive === pad.action }"
                :disabled="settings.frozen || settings.blackout"
                :aria-keyshortcuts="pad.key.toLowerCase()"
                @pointerdown="
                  (event) => {
                    if (event.button === 0) {
                      event.preventDefault()
                      triggerLive(pad.action)
                    }
                  }
                "
                @click="
                  (event) => {
                    if (event.detail === 0) triggerLive(pad.action)
                  }
                "
              >
                <kbd>{{ pad.key }}</kbd
                ><strong>{{ pad.name }}</strong
                ><small>{{ pad.hint }}</small>
              </button>
              <button
                type="button"
                class="boost-pad"
                :class="{ 'pad-active': boostHeld }"
                :disabled="settings.frozen || settings.blackout"
                aria-keyshortcuts="u"
                @pointerdown="boostPointer"
                @pointerup="releaseBoostPointer"
                @pointercancel="releaseBoostPointer"
                @lostpointercapture="releaseBoostPointer"
                @keydown.space.prevent.stop="setBoostInput('button-space', true)"
                @keyup.space.prevent.stop="setBoostInput('button-space', false)"
                @keydown.enter.prevent.stop="setBoostInput('button-enter', true)"
                @keyup.enter.prevent.stop="setBoostInput('button-enter', false)"
                @blur="releaseBoostKeyboard"
              >
                <kbd>U</kbd><strong>Boost</strong><small>Maintenir pour accélérer</small>
              </button>
            </div>
            <p class="motion-hint" v-if="settings.frozen || settings.blackout">
              Réactive l’image pour utiliser les pads.
            </p>
            <p class="motion-hint" v-else>
              J · frappe / K · flash / L · explosion / U maintenu · boost. Désactive le mode pour
              retrouver l’automatique.
            </p>
          </template>
        </section>
        <div class="control-group palette-group">
          <div class="section-label">
            PALETTE <span>{{ palettes[settings.palette].name }}</span>
          </div>
          <div class="palette-options">
            <button
              v-for="(palette, i) in palettes"
              :key="palette.name"
              :aria-label="`Palette ${palette.name}`"
              :aria-pressed="settings.palette === i"
              :title="palette.name"
              :class="{ selected: settings.palette === i }"
              :style="{ background: `linear-gradient(135deg, ${palette.colors.join(',')})` }"
              @click="settings.palette = i"
            >
              <span v-if="settings.palette === i">✓</span>
            </button>
          </div>
        </div>
        <div class="render-controls">
          <div class="control-group sliders">
            <label
              v-for="control in controls"
              :key="control.key"
              :class="{
                dimmed: control.orbital && !isOrbital,
              }"
              ><span
                >{{ control.name
                }}<output
                  >{{
                    control.unit === '%'
                      ? Math.round(settings[control.key] * 100)
                      : settings[control.key].toFixed(2)
                  }}{{ control.unit }}</output
                ></span
              ><input
                v-model.number="settings[control.key]"
                type="range"
                :min="control.min"
                :max="control.max"
                step=".01"
                :disabled="control.orbital && !isOrbital"
            /></label>
          </div>
        </div>
        <div v-if="settings.scene !== 0" class="control-group motion-controls">
          <div class="section-label">
            MODE RAVE <span>{{ currentScene.name }}</span>
          </div>
          <p class="motion-hint">
            La musique fait le travail. Dose simplement l’énergie, le relief et les effets.
          </p>
          <div class="sliders">
            <label v-for="control in raveControls" :key="control.key">
              <span
                >{{ control.name
                }}<output>{{ Math.round(settings[control.key] * 100) }}%</output></span
              >
              <input
                v-model.number="settings[control.key]"
                type="range"
                min="0"
                :max="control.max"
                step=".01"
              />
            </label>
          </div>
          <label class="rave-toggle"
            ><input
              type="checkbox"
              v-model="settings.bassRotation"
              :disabled="settings.advancedMotion"
            />
            Tourner uniquement sur les basses</label
          >
          <details class="advanced-motion">
            <summary>Réglages avancés des mouvements</summary>
            <label class="rave-toggle"
              ><input type="checkbox" v-model="settings.advancedMotion" /> Utiliser mes réglages
              manuels</label
            >
            <p class="motion-hint">
              Désactivé : les mouvements suivent automatiquement la musique. Activé : les réglages
              ci-dessous prennent la main.
            </p>
            <fieldset :disabled="!settings.advancedMotion" class="motion-fieldset">
              <div v-for="motion in motionChannels" :key="motion.key" class="motion-row">
                <span>{{ motion.name }}</span>
                <select
                  v-model="settings[`${motion.key}Mode`]"
                  :aria-label="`${motion.name} : mode`"
                >
                  <option value="continuous">Continu</option>
                  <option value="audio">Audio uniquement</option>
                  <option value="hybrid">Continu + audio</option>
                </select>
                <select
                  v-model="settings[`${motion.key}Source`]"
                  :disabled="settings[`${motion.key}Mode`] === 'continuous'"
                  :aria-label="`${motion.name} : déclencheur`"
                >
                  <option value="bass">Basses</option>
                  <option value="mid">Médiums</option>
                  <option value="high">Aigus</option>
                  <option value="beat">Frappes détectées</option>
                </select>
              </div>
              <div class="sliders motion-sliders">
                <label v-for="control in motionControls" :key="control.key">
                  <span
                    >{{ control.name
                    }}<output>{{ Math.round(settings[control.key] * 100) }}%</output></span
                  >
                  <input
                    v-model.number="settings[control.key]"
                    type="range"
                    :min="control.min"
                    :max="control.max"
                    step=".01"
                  />
                </label>
              </div>
            </fieldset>
          </details>
        </div>
        <div v-if="isOrbital" class="control-group">
          <div class="section-label">COUCHES ORBITAL</div>
          <div class="layer-buttons">
            <button
              v-for="layer in layers"
              :key="layer.key"
              :class="{ selected: settings[layer.key] }"
              :aria-pressed="settings[layer.key]"
              :disabled="!isOrbital"
              @click="settings[layer.key] = !settings[layer.key]"
            >
              {{ layer.label }}
            </button>
          </div>
        </div>
        <div class="control-group compact-controls">
          <label
            ><span>Transition</span
            ><select v-model.number="settings.transition">
              <option :value="0">Cut direct</option>
              <option :value="0.6">Rapide · 0,6 s</option>
              <option :value="1.5">Fluide · 1,5 s</option>
              <option :value="3">Lente · 3 s</option>
            </select></label
          ><label
            ><span>Qualité</span
            ><select v-model="settings.quality">
              <option value="auto">Auto · adaptative</option>
              <option value="eco">Éco · léger</option>
              <option value="high">Haute · jusqu’à 1080p</option>
            </select></label
          >
        </div>
        <div class="performance-buttons">
          <button
            :class="{ engaged: settings.frozen }"
            :aria-pressed="settings.frozen"
            @click="settings.frozen = !settings.frozen"
          >
            Ⅱ Figer <kbd>SPACE</kbd></button
          ><button
            :class="{ engaged: settings.blackout }"
            :aria-pressed="settings.blackout"
            @click="settings.blackout = !settings.blackout"
          >
            ■ Noir <kbd>B</kbd>
          </button>
        </div>
        <div class="presets control-group">
          <div class="section-label">
            MES PRESETS <span>{{ savedPresets.length.toString().padStart(2, '0') }}</span>
          </div>
          <div v-if="savedPresets.length" class="preset-row">
            <select v-model="presetSelection" aria-label="Charger un preset" @change="applyPreset">
              <option value="" disabled>Choisir un preset</option>
              <option v-for="preset in savedPresets" :key="preset.name" :value="preset.name">
                {{ preset.name }}
              </option></select
            ><button
              class="icon-button"
              :disabled="!presetSelection"
              @click="removePreset"
              aria-label="Supprimer le preset sélectionné"
            >
              ×
            </button>
          </div>
          <form class="preset-row" @submit.prevent="savePreset">
            <input
              v-model="presetName"
              aria-label="Nom du preset"
              placeholder="Nom du preset…"
              maxlength="40"
            /><button class="save-preset" type="submit" aria-label="Enregistrer le preset">
              ＋
            </button>
          </form>
          <div class="preset-links">
            <button @click="exportPreset">↓ Exporter</button
            ><button @click="presetInput.click()">↑ Importer</button>
          </div>
          <input
            ref="presetInput"
            type="file"
            accept="application/json,.json"
            class="sr-only"
            tabindex="-1"
            @change="importPreset"
          />
        </div>
      </aside>
    </main>
    <footer class="statusbar">
      <div>
        <span class="status-dot active"></span><span>MOTEUR WEBGL</span
        ><span class="status-separator">/</span
        ><span
          >Qualité
          {{
            settings.quality === 'auto'
              ? 'adaptative'
              : settings.quality === 'eco'
                ? 'éco'
                : 'haute'
          }}</span
        >
      </div>
      <div>
        <span>{{ outputOpen ? '↗ Projection connectée' : 'Sortie locale' }}</span
        ><span class="status-separator">/</span
        ><button @click="help = true">Raccourcis & aide <kbd>?</kbd></button>
      </div>
    </footer>
    <Transition name="toast"
      ><div v-if="notice" class="toast-message" role="status">{{ notice }}</div></Transition
    >
    <div v-if="help" class="modal-backdrop" @click.self="help = false" @keydown.esc="help = false">
      <section class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button class="close-dialog" @click="help = false" aria-label="Fermer l’aide" autofocus>
          ×</button
        ><span class="eyebrow">PRISE EN MAIN</span>
        <h2 id="help-title">Du son à l’image.</h2>
        <p>
          <b>Sans aucun branchement :</b> lance la démo, dépose un morceau, ou capture un onglet
          musical en partageant son audio.
        </p>
        <p>
          <b>Avec une table :</b> choisis « Entrée » puis le périphérique audio exposé à ton
          ordinateur. Une table autonome nécessite une sortie reliée à une interface audio
          compatible.
        </p>
        <p>
          <b>Sur un deuxième écran :</b> ouvre la projection, déplace cette fenêtre sur l’écran
          étendu, puis clique sur « Plein écran ». HDMI, DisplayPort ou un écran étendu sans fil
          fonctionnent de la même façon pour l’application.
        </p>
        <p>
          Un écran simplement connecté au réseau n’est pas détecté automatiquement. Pour un logiciel
          musical, utilise le partage audio proposé par ton système ou une entrée de routage audio
          virtuel.
        </p>
        <div class="shortcut-grid">
          <span><kbd>1–9 / 0</kbd> Scènes 1 à 10</span><span><kbd>F</kbd> Plein écran</span
          ><span><kbd>ESPACE</kbd> Figer les visuels</span><span><kbd>B</kbd> Écran noir</span
          ><span><kbd>J / K / L</kbd> Frappe / Flash / Explosion en mode live</span
          ><span><kbd>U</kbd> Boost maintenu en mode live</span><span><kbd>A</kbd> Auto-pilote</span
          ><span><kbd>→</kbd> Scène suivante</span>
        </div>
        <p class="muted">
          Les BPM sont une estimation. Garde le poste de contrôle ouvert. Si ton navigateur suspend
          les onglets en arrière-plan, laisse-le visible sur ton écran. Les presets sont enregistrés
          dans ce navigateur.
        </p>
        <button class="button primary wide" @click="help = false">C’est parti ↗</button>
      </section>
    </div>
  </div>
</template>
