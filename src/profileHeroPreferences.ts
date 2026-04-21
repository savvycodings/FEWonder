import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'

const STORAGE_KEY = 'wonderport-profile-hero-prefs'

/** Shown on your profile until you write a real bio (edit screen). */
export const PROFILE_HERO_BIO_PLACEHOLDER =
  'This is sample text for your public bio: say what you enjoy on Wonderport or what you are looking for from others. Open Edit profile to write your own and save it here.'

export const PROFILE_HERO_BIO_MAX_LEN = 500

export type ProfileHeroBadgeSlots = [string | null, string | null, string | null]

export type ProfileHeroPreferences = {
  bannerUri: string | null
  badgeSlots: ProfileHeroBadgeSlots
  /** Short public line under display name (local prefs until API). */
  bio: string | null
}

const DEFAULT_PREFS: ProfileHeroPreferences = {
  bannerUri: null,
  badgeSlots: [null, null, null],
  bio: null,
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
    const parsed = JSON.parse(raw) as { bannerUri?: unknown; badgeSlots?: unknown; bio?: unknown }
    const bannerUri =
      typeof parsed.bannerUri === 'string' && parsed.bannerUri.trim() ? parsed.bannerUri.trim() : null
    const bioRaw = parsed.bio
    const bio =
      typeof bioRaw === 'string' && bioRaw.trim()
        ? bioRaw.trim().slice(0, PROFILE_HERO_BIO_MAX_LEN)
        : null
    return {
      bannerUri,
      badgeSlots: normalizeSlots(parsed.badgeSlots),
      bio,
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
      bio: next.bio && next.bio.trim() ? next.bio.trim().slice(0, PROFILE_HERO_BIO_MAX_LEN) : null,
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
