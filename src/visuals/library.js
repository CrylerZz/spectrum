export const sceneFamilies = [
  { key: 'all', name: 'Toutes' },
  { key: 'prisms', name: 'Prismes', ids: [8, 22, 23, 70, 71, 72, 73, 74] },
  { key: 'space', name: 'Orbites', ids: [0, 6, 17, 56, 57] },
  { key: 'depth', name: 'Profondeur', ids: [1, 18, 26, 32, 69] },
  { key: 'flow', name: 'Matière', ids: [4, 20, 21, 25, 38, 40, 46, 47, 52, 59, 60, 61] },
  { key: 'digital', name: 'Numérique', ids: [31, 33, 35] },
]
const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
export function filterScenes(
  scenes,
  { query = '', family = 'all', favorites = [], onlyFavorites = false } = {},
) {
  const group = sceneFamilies.find((item) => item.key === family)
  const words = normalize(query).trim().split(/\s+/).filter(Boolean)
  return scenes.filter(
    (scene) =>
      (!group?.ids || group.ids.includes(scene.id)) &&
      (!onlyFavorites || favorites.includes(scene.id)) &&
      words.every((word) => normalize(`${scene.name} ${scene.tag}`).includes(word)),
  )
}
export function cleanFavorites(input, scenes) {
  return Array.isArray(input)
    ? [...new Set(input)].filter((id) => scenes.some((scene) => scene.id === id))
    : []
}
