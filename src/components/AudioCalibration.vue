<script setup>
import { reactive, ref, watch } from 'vue'
import {
  audioBands,
  calibrationDefaults,
  calibrationLimits,
  cleanCalibration,
} from '../audio/calibration.js'
const props = defineProps({ settings: Object, levels: Object, automatic: Object })
const emit = defineEmits(['change', 'toggle-auto', 'manual'])
const drafts = reactive({})
const editing = ref(null)
watch(
  () =>
    audioBands.flatMap(({ key }) => [
      props.settings[`${key}LowHz`],
      props.settings[`${key}HighHz`],
    ]),
  () => {
    for (const { key } of audioBands)
      for (const edge of ['LowHz', 'HighHz']) {
        const field = key + edge
        if (editing.value !== field) drafts[field] = String(props.settings[field])
      }
  },
  { immediate: true },
)
function beginFrequency(key) {
  editing.value = key
  emit('manual')
}
function typeFrequency(key, value) {
  drafts[key] = value
  emit('manual')
  const number = Number(value)
  const [min, max] = calibrationLimits[key]
  if (value === '' || !Number.isFinite(number) || number < min || number > max) return
  const band = key.replace(/(?:Low|High)Hz$/, '')
  if (key.endsWith('LowHz') && number > props.settings[band + 'HighHz'] - 10) return
  if (key.endsWith('HighHz') && number < props.settings[band + 'LowHz'] + 10) return
  emit('change', { [key]: Math.round(number) })
}
function commitFrequency(key, value) {
  editing.value = null
  update(key, value)
  drafts[key] = String(
    value === ''
      ? props.settings[key]
      : cleanCalibration({ ...props.settings, [key]: Number(value) })[key],
  )
}

const responseControls = [
  {
    key: 'audioAttack',
    label: 'Attaque',
    unit: 'ms',
    step: 1,
    hint: 'Plus courte : les niveaux montent plus vite.',
  },
  {
    key: 'audioRelease',
    label: 'Relâchement',
    unit: 'ms',
    step: 1,
    hint: 'Plus long : les mouvements retombent doucement.',
  },
  {
    key: 'audioSmoothing',
    label: 'Lissage du signal',
    unit: '',
    step: 0.05,
    hint: 'Plus élevé : moins de variations rapides.',
  },
]
const beatControls = [
  {
    key: 'beatSensitivity',
    label: 'Sensibilité des frappes',
    unit: '×',
    step: 0.05,
    hint: 'Plus élevée : détecte des attaques plus discrètes.',
  },
  {
    key: 'beatFloor',
    label: 'Niveau minimum',
    unit: 'dB',
    step: 1,
    hint: 'Plus bas : accepte les signaux plus faibles.',
  },
  {
    key: 'beatInterval',
    label: 'Espacement minimum',
    unit: 'ms',
    step: 10,
    hint: 'Augmente-le pour éviter les doubles frappes.',
  },
]
function update(key, value, element) {
  if (value === '' || !Number.isFinite(Number(value))) {
    if (element) element.value = props.settings[key]
    return
  }
  emit('manual')
  const next = cleanCalibration({ ...props.settings, [key]: Number(value) })
  emit('change', next)
  if (element) element.value = next[key]
}
function changeManually(patch) {
  emit('manual')
  emit('change', patch)
}
function toggleBand(key) {
  const enabled = !props.settings[`${key}Enabled`]
  const patch = { [`${key}Enabled`]: enabled }
  if (enabled && props.settings[`${key}Trim`] === 0) patch[`${key}Trim`] = 1
  // Keep beat detection on one of the bands the user is actually listening to.
  if (!enabled && props.settings.beatSource === key) {
    const next = audioBands.find((band) => band.key !== key && props.settings[`${band.key}Enabled`])
    if (next) patch.beatSource = next.key
  } else if (enabled && !props.settings[`${props.settings.beatSource}Enabled`]) {
    patch.beatSource = key
  }
  changeManually(patch)
}
function display(key) {
  return Math.round(props.settings[key] * 100) / 100
}
</script>

<template>
  <details class="audio-calibration">
    <summary>Calibrer le signal <span>Hz · gains · frappes</span></summary>
    <p class="calibration-intro">
      Ajuste pendant la lecture : les jauges et les scènes réagissent en direct. Le volume d’écoute
      reste identique.
    </p>
    <button
      type="button"
      class="calibration-auto"
      :aria-pressed="automatic.enabled"
      @click="emit('toggle-auto')"
    >
      {{
        automatic.enabled ? 'Arrêter la détection automatique' : 'Activer la détection automatique'
      }}
    </button>
    <p class="calibration-help" role="status" aria-live="polite">{{ automatic.message }}</p>
    <progress
      v-if="automatic.enabled"
      class="calibration-progress"
      :value="automatic.progress"
      max="1"
      aria-label="Analyse du signal"
    ></progress>
    <p class="calibration-help">
      L’auto ajuste les Hz, gains et seuils à partir de 6 secondes de musique, puis continue à
      s’adapter. Modifier un réglage reprend la main. Les frappes restent détectées en mode manuel.
    </p>
    <div class="band-toggles" role="group" aria-label="Bandes audio actives">
      <button
        v-for="band in audioBands"
        :key="band.key"
        type="button"
        :aria-label="`Activer les ${band.label.toLowerCase()}`"
        :aria-pressed="settings[band.key + 'Enabled']"
        @click="toggleBand(band.key)"
      >
        {{ band.label }}<small>{{ settings[band.key + 'Enabled'] ? 'Actives' : 'Coupées' }}</small>
      </button>
    </div>
    <p class="calibration-help">
      Choisis une, deux ou trois bandes. Une bande coupée ne pilote plus les visuels ; son gain et
      son seuil sont mémorisés pour la réactiver.
    </p>
    <fieldset
      v-for="band in audioBands"
      :key="band.key"
      class="calibration-band"
      :disabled="!settings[band.key + 'Enabled']"
    >
      <legend>{{ band.label }}</legend>
      <div
        class="calibration-level"
        :aria-label="`${band.label} : ${Math.round(levels[band.key] * 100)} %`"
        role="meter"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(levels[band.key] * 100)"
      >
        <div><i :style="{ width: `${levels[band.key] * 100}%` }"></i></div>
        <output>{{ Math.round(levels[band.key] * 100) }} %</output>
      </div>
      <div class="frequency-pair">
        <label
          v-for="edge in [
            { key: 'LowHz', label: 'De' },
            { key: 'HighHz', label: 'À' },
          ]"
          :key="edge.key"
        >
          <span>{{ edge.label }} <small>Hz</small></span>
          <input
            type="number"
            :aria-label="`${band.label} : fréquence ${edge.key === 'LowHz' ? 'minimum' : 'maximum'} en Hz`"
            :value="drafts[band.key + edge.key]"
            :min="calibrationLimits[band.key + edge.key][0]"
            :max="calibrationLimits[band.key + edge.key][1]"
            step="1"
            @focus="beginFrequency(band.key + edge.key)"
            @input="typeFrequency(band.key + edge.key, $event.target.value)"
            @change="commitFrequency(band.key + edge.key, $event.target.value)"
            @blur="commitFrequency(band.key + edge.key, $event.target.value)"
            @keydown.enter.prevent="$event.target.blur()"
          />
        </label>
      </div>
      <label class="calibration-control">
        <span
          >Gain <output>{{ display(band.key + 'Trim') }}×</output></span
        >
        <input
          type="range"
          :aria-label="`${band.label} : gain`"
          min="0"
          max="4"
          step="0.05"
          :value="settings[band.key + 'Trim']"
          @input="update(band.key + 'Trim', $event.target.value)"
        />
      </label>
      <label class="calibration-control">
        <span
          >Seuil de bruit
          <output>{{ Math.round(settings[band.key + 'Gate'] * 100) }} %</output></span
        >
        <input
          type="range"
          :aria-label="`${band.label} : seuil de bruit`"
          min="0"
          max="0.5"
          step="0.01"
          :value="settings[band.key + 'Gate']"
          @input="update(band.key + 'Gate', $event.target.value)"
        />
      </label>
    </fieldset>
    <p class="calibration-help">
      Saisis les Hz directement : les valeurs valides s’appliquent sans attendre. La limite haute
      doit dépasser la limite basse d’au moins 10 Hz. Les bandes peuvent se chevaucher. Le seuil de
      bruit ignore les niveaux faibles avant d’appliquer le gain. La précision des fréquences dépend
      de la source.
    </p>
    <fieldset class="calibration-band">
      <legend>Réactivité</legend>
      <label v-for="control in responseControls" :key="control.key" class="calibration-control">
        <span
          >{{ control.label }} <output>{{ display(control.key) }} {{ control.unit }}</output></span
        >
        <input
          type="range"
          :aria-label="control.label"
          :min="calibrationLimits[control.key][0]"
          :max="calibrationLimits[control.key][1]"
          :step="control.step"
          :value="settings[control.key]"
          @input="update(control.key, $event.target.value)"
        />
        <small>{{ control.hint }}</small>
      </label>
    </fieldset>
    <fieldset class="calibration-band">
      <legend>Détection des frappes</legend>
      <label class="calibration-control">
        <span
          >Bande écoutée
          <i class="calibration-beat" :style="{ opacity: 0.15 + levels.beat * 0.85 }"></i
        ></span>
        <select
          :value="settings.beatSource"
          :disabled="!audioBands.some((band) => settings[band.key + 'Enabled'])"
          @change="changeManually({ beatSource: $event.target.value })"
        >
          <option
            v-for="band in audioBands"
            :key="band.key"
            :value="band.key"
            :disabled="!settings[band.key + 'Enabled']"
          >
            {{ band.label }}
          </option>
        </select>
      </label>
      <label v-for="control in beatControls" :key="control.key" class="calibration-control">
        <span
          >{{ control.label }} <output>{{ display(control.key) }} {{ control.unit }}</output></span
        >
        <input
          type="range"
          :aria-label="control.label"
          :min="calibrationLimits[control.key][0]"
          :max="calibrationLimits[control.key][1]"
          :step="control.step"
          :value="settings[control.key]"
          @input="update(control.key, $event.target.value)"
        />
        <small>{{ control.hint }}</small>
      </label>
      <p class="calibration-help">
        Pilote les impacts, les flashs automatiques et l’estimation du BPM. Cette détection est
        indépendante des gains et des seuils de bruit des jauges. En mode live, les impacts et les
        flashs restent manuels.
      </p>
    </fieldset>
    <p class="calibration-help">
      Pour faire suivre un mouvement aux médiums ou aux aigus, choisis sa source dans « Réglages
      avancés des mouvements ».
    </p>
    <button
      type="button"
      class="calibration-reset"
      @click="changeManually({ ...calibrationDefaults })"
    >
      Réinitialiser la calibration
    </button>
    <p class="calibration-help">Sauvegardée automatiquement et incluse dans tes presets.</p>
  </details>
</template>

<style scoped>
.audio-calibration {
  margin-top: 20px;
  border-top: 1px solid var(--border, #303329);
  padding-top: 16px;
}
summary {
  cursor: pointer;
  font-size: 12px;
  color: #d1d4c8;
}
summary span {
  display: block;
  margin: 5px 0 0 14px;
  color: #8d9481;
  font-size: 10px;
}
.calibration-intro,
.calibration-help {
  color: #969c90;
  font-size: 11px;
  line-height: 1.6;
  margin: 12px 0;
}
.calibration-band {
  min-width: 0;
  margin: 18px 0 0;
  padding: 12px;
  border: 1px solid #303329;
  border-radius: 5px;
}
legend {
  padding: 0 6px;
  font-size: 12px;
  color: #cbd1bc;
}
.calibration-level {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.calibration-level > div {
  flex: 1;
  height: 3px;
  background: #2b3025;
}
.calibration-level i {
  display: block;
  height: 100%;
  background: #b9ca9c;
}
output {
  color: #b9ca9c;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}
.calibration-level output {
  width: 36px;
  text-align: right;
}
.frequency-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.frequency-pair label,
.calibration-control {
  display: block;
  min-width: 0;
  font-size: 11px;
}
.frequency-pair span,
.calibration-control > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 4px;
}
.frequency-pair small {
  color: #8d9481;
}
input[type='number'],
select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 8px 6px;
  background: #151812;
  color: #d1d4c8;
  border: 1px solid #404735;
  border-radius: 3px;
  font: inherit;
}
.calibration-control {
  margin-top: 16px;
}
.calibration-control input {
  width: 100%;
}
.calibration-control small {
  display: block;
  color: #969c90;
  line-height: 1.5;
  margin-top: 6px;
  font-size: 10px;
}
.calibration-beat {
  width: 6px;
  height: 6px;
  background: #c2d277;
  border-radius: 50%;
}
.calibration-reset,
.calibration-auto {
  width: 100%;
  border: 1px solid #4b543b;
  border-radius: 3px;
  padding: 10px 6px;
  font-size: 11px;
  color: #cbd1bc;
  background: #1c2116;
  cursor: pointer;
}
.calibration-reset:hover,
.calibration-auto:hover {
  background: #29311f;
}
.calibration-auto {
  margin-top: 4px;
}
.calibration-auto[aria-pressed='true'] {
  border-color: #c2d277;
  color: #d8ed9e;
}
.calibration-progress {
  width: 100%;
  height: 5px;
  accent-color: #c2d277;
}
.band-toggles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 16px;
}
.band-toggles button {
  min-width: 0;
  padding: 10px 2px;
  border: 1px solid #3b4232;
  border-radius: 4px;
  background: #151812;
  color: #a4ac99;
  cursor: pointer;
  font-size: 11px;
}
.band-toggles button[aria-pressed='true'] {
  border-color: #a6bb64;
  color: #d6ec9d;
  background: #262e19;
}
.band-toggles small {
  display: block;
  margin-top: 5px;
  font-size: 9px;
}
.calibration-band:disabled {
  opacity: 0.5;
}
</style>
