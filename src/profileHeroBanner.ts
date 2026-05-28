import { BRAND_ACCENT_DEFAULT_HEX } from './brandAccent'

/** Stored in `profile_banner_url` / local `bannerUri` — not a fetchable image URL. */
export const PROFILE_BANNER_COLOR_PREFIX = 'wonderport-banner-color:'

export type ProfileBannerColorOption = {
  id: string
  label: string
  hex: string
}

/** Plain banner fills available in Edit profile (Wonderport palette + neutrals). */
export const PROFILE_BANNER_COLOR_OPTIONS: ReadonlyArray<ProfileBannerColorOption> = [
  { id: 'red', label: 'Wonder Red', hex: BRAND_ACCENT_DEFAULT_HEX },
  { id: 'cream', label: 'Off White', hex: '#F5F0E8' },
  { id: 'charcoal', label: 'Charcoal', hex: '#1E293B' },
  { id: 'slate', label: 'Slate', hex: '#475569' },
  { id: 'midnight', label: 'Midnight', hex: '#8C00FF' },
  { id: 'sunset', label: 'Sunset', hex: '#FA5528' },
  { id: 'royal', label: 'Royal', hex: '#2054C7' },
  { id: 'mint', label: 'Mint', hex: '#6EE7B7' },
  { id: 'forest', label: 'Forest', hex: '#157A3D' },
  { id: 'peach', label: 'Peach', hex: '#FFB4A2' },
  { id: 'sky', label: 'Sky', hex: '#7DD3FC' },
  { id: 'rose', label: 'Rose', hex: '#F43F5E' },
]

function normalizeHexInput(hex: string): string | null {
  const raw = String(hex || '')
    .trim()
    .replace(/^#/, '')
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw.toUpperCase()}`
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    const expanded = raw
      .split('')
      .map((c) => c + c)
      .join('')
    return `#${expanded.toUpperCase()}`
  }
  return null
}

export function encodeProfileBannerColor(hex: string): string {
  const normalized = normalizeHexInput(hex)
  if (!normalized) return encodeProfileBannerColor(BRAND_ACCENT_DEFAULT_HEX)
  return `${PROFILE_BANNER_COLOR_PREFIX}${normalized.replace('#', '')}`
}

export function parseProfileBannerColor(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const v = value.trim()
  if (!v.startsWith(PROFILE_BANNER_COLOR_PREFIX)) return null
  return normalizeHexInput(v.slice(PROFILE_BANNER_COLOR_PREFIX.length))
}

export function isProfileBannerImageUri(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return parseProfileBannerColor(value) === null
}

export function profileBannerUsesLightForeground(bannerUri: string | null | undefined): boolean {
  const hex = parseProfileBannerColor(bannerUri) ?? BRAND_ACCENT_DEFAULT_HEX
  const raw = hex.replace('#', '')
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62
}

export function isProfileBannerColorSelected(
  bannerUri: string | null | undefined,
  hex: string,
): boolean {
  const current = parseProfileBannerColor(bannerUri)
  const target = normalizeHexInput(hex)
  if (!current || !target) return false
  return current.toUpperCase() === target.toUpperCase()
}
