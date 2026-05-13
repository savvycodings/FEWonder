/** Default Wonderport UI accent (lime). */
export const BRAND_ACCENT_LIME_HEX = '#CBFF00'

export const BRAND_ACCENT_STORAGE_KEY = 'wonderport-brand-accent-id'

/** Accent palette keys match Wonder Store theme ids + `default` (lime). */
export const BRAND_ACCENT_ID_TO_HEX: Record<string, string> = {
  default: BRAND_ACCENT_LIME_HEX,
  midnight: '#8C00FF',
  sunset: '#fa5528',
  mint: '#6ee7b7',
  royal: '#2054c7',
  peach: '#ffb4a2',
  forest: '#157a3d',
}

export function hexToRgbString(hex: string): string {
  const raw = String(hex || '').replace('#', '').trim()
  if (!raw) return '203, 255, 0'
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const n = parseInt(full, 16)
  if (!Number.isFinite(n) || full.length !== 6) return '203, 255, 0'
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `${r}, ${g}, ${b}`
}

export function normalizeBrandAccentId(id: string | undefined | null): string {
  const k = (id ?? 'default').trim().toLowerCase() || 'default'
  if (k === 'default') return 'default'
  return BRAND_ACCENT_ID_TO_HEX[k] ? k : 'default'
}

export function resolveBrandAccentHex(id: string | undefined | null): string {
  const k = normalizeBrandAccentId(id)
  return BRAND_ACCENT_ID_TO_HEX[k] ?? BRAND_ACCENT_LIME_HEX
}

export function brandAccentRgba(theme: { brandAccentRgb?: string } | undefined, alpha: number): string {
  const rgb = theme?.brandAccentRgb ?? hexToRgbString(BRAND_ACCENT_LIME_HEX)
  return `rgba(${rgb},${alpha})`
}

export function mergeBrandAccentIntoTheme(baseTheme: any, accentId: string | undefined | null) {
  const id = normalizeBrandAccentId(accentId)
  const brandAccent = resolveBrandAccentHex(id)
  const brandAccentRgb = hexToRgbString(brandAccent)
  return {
    ...baseTheme,
    brandAccent,
    brandAccentRgb,
    brandAccentId: id,
  }
}
