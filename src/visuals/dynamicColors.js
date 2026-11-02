const clamp = (n) => Math.min(1, Math.max(0, n))
function hsv(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min
  let h =
    d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h / 6 + 1) % 1, max === 0 ? 0 : d / max, max]
}
function hex([h, s, v]) {
  const channel = (offset) => {
    const k = (offset + h * 6) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}
export function dynamicPalette(calm, strong, energy) {
  const a = hsv(calm),
    b = hsv(strong),
    t = clamp(energy)
  const delta = ((b[0] - a[0] + 1.5) % 1) - 0.5
  const h = (a[0] + delta * t + 1) % 1,
    s = a[1] + (b[1] - a[1]) * t,
    v = a[2] + (b[2] - a[2]) * t
  return [
    hex([h, s, v]),
    hex([(h + 0.08) % 1, s, v]),
    hex([(h + 0.92) % 1, s * 0.8, Math.min(1, v * 1.15)]),
  ]
}
