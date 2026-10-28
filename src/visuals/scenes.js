export const scenes = [
  { id: 0, name: 'Orbital', tag: 'ADN original · relief psychédélique', type: 'orbital' },
  { id: 1, name: 'Hyperdrive', tag: 'Tunnel · profondeur', type: 'tunnel' },
  { id: 2, name: 'Aurora', tag: 'Ondes · organique', type: 'aurora' },
  { id: 3, name: 'Terrain', tag: 'Grille · perspective', type: 'terrain' },
  { id: 4, name: 'Liquid', tag: 'Matière · hypnotique', type: 'liquid' },
  { id: 5, name: 'Stardust', tag: 'Étoiles · immersion', type: 'stars' },
]
export const palettes = [
  { name: 'Neon', colors: ['#ea57ff', '#55e9ff', '#a193ff'] },
  { name: 'Acid', colors: ['#d5ff62', '#40e6b4', '#f4c95d'] },
  { name: 'Ember', colors: ['#ff713d', '#ffd891', '#e74783'] },
  { name: 'Glacier', colors: ['#c9f3ff', '#6799ff', '#e4ddff'] },
  { name: 'Ultraviolet', colors: ['#a771ff', '#ff5faa', '#4f6bff'] },
]
export const defaults = {
  scene: 0,
  palette: 0,
  intensity: 1,
  speed: 0.65,
  sensitivity: 1.2,
  detail: 0.65,
  glow: 0.65,
  orbitalDepth: 1,
  orbitalPsy: 1,
  quality: 'auto',
  transition: 1.5,
  auto: false,
  autoInterval: 24,
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
    scene: [0, 5],
    palette: [0, 4],
    intensity: [0.2, 2],
    speed: [0, 2],
    sensitivity: [0.3, 3],
    detail: [0.2, 1],
    glow: [0, 1],
    orbitalDepth: [0, 1.5],
    orbitalPsy: [0, 1.5],
    transition: [0, 4],
    autoInterval: [8, 90],
  }
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key]))
      out[key] = Math.min(max, Math.max(min, input[key]))
  }
  out.scene = Math.round(out.scene)
  out.palette = Math.round(out.palette)
  for (const key of ['auto', 'ring', 'dna', 'grid', 'eye', 'waves'])
    if (typeof input[key] === 'boolean') out[key] = input[key]
  if (['auto', 'eco', 'high'].includes(input.quality)) out.quality = input.quality
  return out
}
