import { calibrationDefaults, cleanCalibration } from '../audio/calibration.js'

export const scenes = [
  { id: 0, name: 'Orbital', tag: 'ADN original · relief psychédélique', type: 'orbital' },
  { id: 1, name: 'Vortex', tag: 'Tunnel · cubes 3D', type: 'tunnel' },
  { id: 4, name: 'Plasma', tag: 'Turbulence · décharges', type: 'liquid' },
  { id: 6, name: 'Orbital Overdrive', tag: 'ADN · surcharge psychédélique', type: 'orbital' },
  { id: 8, name: 'Prisme', tag: 'Cristaux · kaléidoscope', type: 'prism' },
  {
    id: 70,
    name: 'Prisme Dentelle',
    tag: '5 niveaux · entrelacs et filigranes',
    type: 'prism-lace',
  },
  { id: 71, name: 'Prisme Couronnes', tag: '5 niveaux · anneaux polygonaux', type: 'prism-crowns' },
  { id: 72, name: 'Prisme Éclats', tag: '5 niveaux · fragments de cristal', type: 'prism-shards' },
  { id: 73, name: 'Prisme Spirale', tag: '5 niveaux · bras et volutes', type: 'prism-spiral' },
  {
    id: 74,
    name: 'Prisme Cristal',
    tag: '5 niveaux · facettes en profondeur',
    type: 'prism-crystal',
  },
  { id: 17, name: 'Gyroscope', tag: 'Orbites · précession', type: 'gyro' },
  { id: 18, name: 'Matrice', tag: 'Blocs 3D · sculpture mobile', type: 'matrix' },
  { id: 20, name: 'Plasma Cyclone', tag: 'Matière · vortex turbulent', type: 'liquid' },
  { id: 21, name: 'Plasma Fission', tag: 'Matière · fractures électriques', type: 'inferno' },
  { id: 22, name: 'Prisme Abyssal', tag: 'Kaléidoscope · plongée', type: 'prism' },
  { id: 23, name: 'Prisme Fracture', tag: 'Facettes · fragmentation', type: 'crystal' },
  { id: 25, name: 'Faille dimensionnelle', tag: 'Déchirure · monde intérieur', type: 'rift' },
  { id: 26, name: 'Métal liquide', tag: 'Chrome · pression et pointes', type: 'metal' },
  { id: 31, name: 'Matrix Rain', tag: 'Code · pluie en profondeur', type: 'code-rain' },
  { id: 32, name: 'Data Tunnel', tag: 'Données · traversée numérique', type: 'data-tunnel' },
  { id: 33, name: 'Circuit', tag: 'Pistes · impulsions électriques', type: 'circuit' },
  { id: 35, name: 'Interférences', tag: 'Ondes · déchirures numériques', type: 'interference' },
  { id: 38, name: 'Orage', tag: 'Éclairs · ramifications électriques', type: 'thunderstorm' },
  { id: 40, name: 'Dunes néon', tag: 'Relief · courbes topographiques', type: 'neon-dunes' },
  { id: 46, name: 'Tectonique', tag: 'Plaques · failles lumineuses', type: 'tectonic' },
  { id: 47, name: 'Aurore boréale', tag: 'Rideaux · ondulations lumineuses', type: 'borealis' },
  { id: 52, name: 'Lampe à lave', tag: 'Bulles · fusion organique', type: 'lava-lamp' },
  { id: 56, name: 'Nébuleuse', tag: 'Nuages · couches cosmiques', type: 'nebula' },
  {
    id: 57,
    name: 'Résonance rétro',
    tag: 'Cœur plasma · couronnes électriques',
    type: 'retro-resonance',
  },
  { id: 59, name: 'Soie moirée', tag: 'Voile · points et plis lumineux', type: 'moire-silk' },
  { id: 60, name: 'Courants', tag: 'Lignes · tourbillons continus', type: 'contour-currents' },
  { id: 61, name: 'Drapés acides', tag: 'Rubans · vagues psychédéliques', type: 'acid-drapes' },
  { id: 69, name: 'Abysse liquide', tag: 'Tunnel · chrome bleu et rose', type: 'liquid-abyss' },
]
export const palettes = [
  { name: 'Neon', colors: ['#ea57ff', '#55e9ff', '#a193ff'] },
  { name: 'Acid', colors: ['#d5ff62', '#40e6b4', '#f4c95d'] },
  { name: 'Ember', colors: ['#ff713d', '#ffd891', '#e74783'] },
  { name: 'Glacier', colors: ['#c9f3ff', '#6799ff', '#e4ddff'] },
  { name: 'Ultraviolet', colors: ['#a771ff', '#ff5faa', '#4f6bff'] },
  { name: 'Rouge laser', colors: ['#ff1234', '#d90816', '#ff5738'] },
  { name: 'Crimson', colors: ['#a61032', '#e32245', '#520c29'] },
  { name: 'Bordeaux noir', colors: ['#520b20', '#8a1634', '#240918'] },
  { name: 'Braise sombre', colors: ['#a52b0d', '#59200d', '#db4b16'] },
  { name: 'Minuit', colors: ['#122459', '#254a85', '#10152f'] },
  { name: 'Violet abyssal', colors: ['#38134f', '#692976', '#1c153c'] },
  { name: 'Forêt noire', colors: ['#124438', '#28715a', '#0b242b'] },
  { name: 'Pétrole', colors: ['#08555c', '#16868c', '#112d43'] },
  { name: 'Or', colors: ['#ffbd38', '#c67b17', '#ffe19a'] },
  { name: 'Rose électrique', colors: ['#ff168b', '#ed45df', '#9216ad'] },
  { name: 'Laser vert', colors: ['#52ff37', '#00d979', '#b9ff69'] },
  { name: 'Argent', colors: ['#dce1eb', '#828c9e', '#454d62'] },
]
// Starting mix reapplied at launch; saved presets keep their own exact values.
export const startupMix = {
  intensity: 1,
  speed: 0.65,
  sensitivity: 1,
  bassGain: 0.8,
  detail: 0.7,
  glow: 0.5,
  raveEnergy: 1,
  raveDepth: 0.45,
  ravePsy: 0.2,
  raveFlash: 0,
  advancedMotion: false,
  bassRotation: true,
}
export const defaults = {
  scene: 0,
  palette: 0,
  ...startupMix,
  ...calibrationDefaults,
  prismLevel: 0, // 0 follows music; 1–5 select a composition density.
  dynamicMix: false,
  dynamicAmount: 0.75,
  dynamicRelease: 1.6,
  dynamicFlash: 0.45,
  tunnelTravel: 0.35,
  dynamicColorEnabled: true,
  dynamicCalmColor: '#385b9f',
  dynamicHotColor: '#ff167a',
  orbitalDepth: 1,
  orbitalPsy: 1,
  rotationMode: 'audio',
  rotationSource: 'bass',
  deformationMode: 'hybrid',
  deformationSource: 'mid',
  travelMode: 'hybrid',
  travelSource: 'bass',
  motionStrength: 1.3,
  motionInertia: 0.45,
  motionThreshold: 0.16,
  quality: 'auto',
  transition: 1.5,
  auto: false,
  autoInterval: 24,
  liveMode: false, // Session-only: reopening the app starts in automatic mode.
  frozen: false,
  blackout: false,
  ring: true,
  dna: true,
  grid: true,
  eye: true,
  waves: true,
}
export function cleanSettings(input) {
  const out = { ...defaults }
  if (!input || typeof input !== 'object') return out
  const limits = {
    scene: [0, Math.max(...scenes.map((scene) => scene.id))],
    palette: [0, palettes.length - 1],
    intensity: [0.2, 2],
    speed: [0, 2],
    sensitivity: [0.3, 3],
    bassGain: [0, 2],
    detail: [0.2, 1],
    glow: [0, 1],
    orbitalDepth: [0, 1.5],
    orbitalPsy: [0, 1.5],
    raveEnergy: [0, 2],
    raveDepth: [0, 2],
    ravePsy: [0, 2],
    raveFlash: [0, 1],
    motionStrength: [0, 3],
    motionInertia: [0, 1],
    motionThreshold: [0.02, 0.8],
    transition: [0, 4],
    autoInterval: [8, 90],
    prismLevel: [0, 5],
    dynamicAmount: [0, 1],
    dynamicRelease: [0.3, 4],
    dynamicFlash: [0, 1],
    tunnelTravel: [0, 1],
  }
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key]))
      out[key] = Math.min(max, Math.max(min, input[key]))
  }
  Object.assign(out, cleanCalibration(input))
  out.scene = Math.round(out.scene)
  // Never reuse retired IDs: old presets keep their palettes and all other settings.
  out.scene = { 13: 8, 14: 0, 19: 20, 24: 17, 58: 0 }[out.scene] ?? out.scene
  if (!scenes.some((scene) => scene.id === out.scene)) out.scene = 0
  for (const key of ['dynamicCalmColor', 'dynamicHotColor'])
    if (typeof input[key] === 'string' && /^#[0-9a-f]{6}$/i.test(input[key]))
      out[key] = input[key].toLowerCase()
  out.prismLevel = Math.round(out.prismLevel)
  out.palette = Math.round(out.palette)
  for (const key of [
    'auto',
    'dynamicMix',
    'dynamicColorEnabled',
    'ring',
    'dna',
    'grid',
    'eye',
    'waves',
    'advancedMotion',
    'bassRotation',
  ])
    if (typeof input[key] === 'boolean') out[key] = input[key]
  if (['auto', 'eco', 'high'].includes(input.quality)) out.quality = input.quality
  for (const channel of ['rotation', 'deformation', 'travel']) {
    if (['continuous', 'audio', 'hybrid'].includes(input[`${channel}Mode`]))
      out[`${channel}Mode`] = input[`${channel}Mode`]
    if (['bass', 'mid', 'high', 'beat'].includes(input[`${channel}Source`]))
      out[`${channel}Source`] = input[`${channel}Source`]
  }
  return out
}
