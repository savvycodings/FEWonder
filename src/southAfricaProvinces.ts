/** Official provinces of South Africa (single canonical label per entry). */
export const SOUTH_AFRICA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const

export type SouthAfricaProvince = (typeof SOUTH_AFRICA_PROVINCES)[number]

export function normalizeSouthAfricaProvince(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const match = SOUTH_AFRICA_PROVINCES.find((p) => p.toLowerCase() === trimmed.toLowerCase())
  return match ?? trimmed
}

export function isValidSouthAfricaProvince(value: string): boolean {
  const normalized = normalizeSouthAfricaProvince(value)
  return (SOUTH_AFRICA_PROVINCES as readonly string[]).includes(normalized)
}

/** Value shown in the province picker — empty unless a canonical province is stored. */
export function provinceDisplayValue(stored: string | null | undefined): string {
  const normalized = normalizeSouthAfricaProvince(String(stored || ''))
  return isValidSouthAfricaProvince(normalized) ? normalized : ''
}
