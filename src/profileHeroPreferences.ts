import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'

const STORAGE_KEY = 'wonderport-profile-hero-prefs'

export type ProfileHeroBadgeSlots = [string | null, string | null, string | null]

/** Edit-profile "sample:*" placeholders count as empty for Wonder Store equips (they get replaced). */
export function isProfileBadgeSlotFreeForWonderEquip(slot: string | null): boolean {
  if (!slot) return true
  return slot.startsWith('sample:')
}

export type ProfileHeroPreferences = {
  bannerUri: string | null
  badgeSlots: ProfileHeroBadgeSlots
}

const DEFAULT_PREFS: ProfileHeroPreferences = {
  bannerUri: null,
  badgeSlots: [null, null, null],
}

function normalizeSlots(raw: unknown): ProfileHeroBadgeSlots {
  if (!Array.isArray(raw)) return [...DEFAULT_PREFS.badgeSlots] as ProfileHeroBadgeSlots
  const a = raw.map((x) => (typeof x === 'string' && x.trim() ? x.trim() : null))
  while (a.length < 3) a.push(null)
  return [a[0] ?? null, a[1] ?? null, a[2] ?? null] as ProfileHeroBadgeSlots
}

export async function loadProfileHeroPreferences(): Promise<ProfileHeroPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as { bannerUri?: unknown; badgeSlots?: unknown }
    const bannerUri =
      typeof parsed.bannerUri === 'string' && parsed.bannerUri.trim() ? parsed.bannerUri.trim() : null
    return {
      bannerUri,
      badgeSlots: normalizeSlots(parsed.badgeSlots),
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export async function saveProfileHeroPreferences(next: ProfileHeroPreferences): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      bannerUri: next.bannerUri,
      badgeSlots: next.badgeSlots,
    })
  )
}

/** Copy picked image into app storage so the banner survives restarts (native). Web keeps picker URI. */
export async function persistBannerFromPickedAssetUri(pickedUri: string): Promise<string | null> {
  if (!pickedUri) return null
  if (Platform.OS === 'web') return pickedUri
  try {
    const base = FileSystem.documentDirectory
    if (!base) return pickedUri
    const dest = `${base}profile-banner-${Date.now()}.jpg`
    await FileSystem.copyAsync({ from: pickedUri, to: dest })
    return dest
  } catch {
    return pickedUri
  }
}
