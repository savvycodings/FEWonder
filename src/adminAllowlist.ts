/**
 * Emails allowed to see the Admin section in Settings.
 * Add new addresses here (lowercase) when more staff need access.
 */
export const ADMIN_SETTINGS_EMAILS = [
  'kaidenmcintosh27@gmail.com',
  'chalyn.smit101@gmail.com',
  'zkkylenoome@gmail.com',
  'lindsayhoar476@gmail.com',
] as const

export function canSeeAdminSettings(email: string | null | undefined): boolean {
  const normalized = (email || '').trim().toLowerCase()
  if (!normalized) return false
  return (ADMIN_SETTINGS_EMAILS as readonly string[]).includes(normalized)
}
