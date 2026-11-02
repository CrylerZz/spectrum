export const audioBands = [
  { key: 'bass', label: 'Basses', low: 30, high: 160 },
  { key: 'mid', label: 'Médiums', low: 160, high: 2500 },
  { key: 'high', label: 'Aigus', low: 2500, high: 14000 },
]
export const calibrationDefaults = {
  audioAttack: 1000 / 30,
  audioRelease: 1000 / 16,
  audioSmoothing: 0.25,
  beatSource: 'bass',
  beatSensitivity: 1,
  beatFloor: -66,
  beatInterval: 220,
}
export const calibrationLimits = {
  audioAttack: [5, 500],
  audioRelease: [10, 2000],
  audioSmoothing: [0, 0.95],
  beatSensitivity: [0.25, 4],
  beatFloor: [-90, -10],
  beatInterval: [100, 1000],
}
for (const band of audioBands) {
  Object.assign(calibrationDefaults, {
    [`${band.key}Enabled`]: true,
    [`${band.key}LowHz`]: band.low,
    [`${band.key}HighHz`]: band.high,
    [`${band.key}Trim`]: 1,
    [`${band.key}Gate`]: 0,
  })
  Object.assign(calibrationLimits, {
    [`${band.key}LowHz`]: [20, 19990],
    [`${band.key}HighHz`]: [30, 20000],
    [`${band.key}Trim`]: [0, 4],
    [`${band.key}Gate`]: [0, 0.5],
  })
}
export function cleanCalibration(input = {}) {
  const out = { ...calibrationDefaults }
  for (const [key, [min, max]] of Object.entries(calibrationLimits)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key]))
      out[key] = Math.min(max, Math.max(min, input[key]))
  }
  for (const { key } of audioBands) {
    if (typeof input[`${key}Enabled`] === 'boolean') out[`${key}Enabled`] = input[`${key}Enabled`]
    out[`${key}LowHz`] = Math.round(out[`${key}LowHz`])
    out[`${key}HighHz`] = Math.max(out[`${key}LowHz`] + 10, Math.round(out[`${key}HighHz`]))
  }
  if (audioBands.some(({ key }) => key === input.beatSource)) out.beatSource = input.beatSource
  return out
}
