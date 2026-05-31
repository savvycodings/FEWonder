export const PUDO_LOCKER_TIERS = ['locker', 'door'] as const
export type PudoLockerTier = (typeof PUDO_LOCKER_TIERS)[number]

export const PUDO_LOCKER_PRICES_ZAR: Record<PudoLockerTier, number> = {
  locker: 90,
  door: 110,
}

export const PUDO_LOCKER_LABELS: Record<PudoLockerTier, string> = {
  locker: 'Locker',
  door: 'Door',
}

export const PUDO_DELIVERY_HINT =
  'Choose locker collection (R90) or door delivery (R110). Enter your Pudo point details below.'

/** @deprecated Legacy size tiers — display only for older orders. */
const LEGACY_TIER_LABELS: Record<string, string> = {
  xs: 'Extra small',
  s: 'Small',
  m: 'Medium',
  l: 'Large',
  xl: 'Extra large',
}

export function tierAllowedForCart(
  tier: PudoLockerTier,
  hasWholeSet: boolean,
): boolean {
  if (!hasWholeSet) return true
  return tier === 'door'
}

export function defaultTierForCart(hasWholeSet: boolean): PudoLockerTier {
  return hasWholeSet ? 'door' : 'locker'
}

export function formatTierPrice(tier: PudoLockerTier): string {
  return `R${PUDO_LOCKER_PRICES_ZAR[tier]}`
}

export function lockerTierDisplay(tier: string | null | undefined): string {
  const t = String(tier || '').trim().toLowerCase()
  if ((PUDO_LOCKER_TIERS as readonly string[]).includes(t)) {
    const key = t as PudoLockerTier
    return `${PUDO_LOCKER_LABELS[key]} (${formatTierPrice(key)})`
  }
  if (LEGACY_TIER_LABELS[t]) {
    return `${LEGACY_TIER_LABELS[t]} (${t.toUpperCase()})`
  }
  return tier ? String(tier).toUpperCase() : '—'
}

export function packagingLabel(p: string | null | undefined): string {
  if (p === 'set') return 'Whole set'
  if (p === 'single') return 'Single / blind box'
  return 'Standard'
}

export function cartHasWholeSet(items: { selectedPackaging?: string; title?: string }[]): boolean {
  return items.some(
    (item) =>
      item?.selectedPackaging === 'set' || String(item?.title || '').includes('(Whole set)'),
  )
}

export function linePackagingFromItem(item: {
  selectedPackaging?: string
  title?: string
}): 'single' | 'set' {
  if (item?.selectedPackaging === 'set') return 'set'
  if (String(item?.title || '').includes('(Whole set)')) return 'set'
  return 'single'
}
