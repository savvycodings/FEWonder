/** Max length for profile / leaderboard display name (keeps hero row + badges readable). */
export const MAX_PROFILE_DISPLAY_NAME_LENGTH = 15

export function clampProfileDisplayNameInput(raw: string): string {
  return raw.slice(0, MAX_PROFILE_DISPLAY_NAME_LENGTH)
}

export function normalizeProfileDisplayName(raw: string): string {
  return raw.trim().slice(0, MAX_PROFILE_DISPLAY_NAME_LENGTH)
}

export function isProfileDisplayNameValid(raw: string): boolean {
  const name = raw.trim()
  return name.length > 0 && name.length <= MAX_PROFILE_DISPLAY_NAME_LENGTH
}

export const PROFILE_DISPLAY_NAME_LENGTH_HINT = `Up to ${MAX_PROFILE_DISPLAY_NAME_LENGTH} characters.`
