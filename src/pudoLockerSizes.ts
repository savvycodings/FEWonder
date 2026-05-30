export const PUDO_LOCKER_TIERS = ['xs', 's', 'm', 'l', 'xl'] as const
export type PudoLockerTier = (typeof PUDO_LOCKER_TIERS)[number]

export const PUDO_LOCKER_PRICES_ZAR: Record<PudoLockerTier, number> = {
  xs: 60,
  s: 70,
  m: 120,
  l: 160,
  xl: 220,
}

export const PUDO_LOCKER_LABELS: Record<PudoLockerTier, string> = {
  xs: 'Extra small',
  s: 'Small',
  m: 'Medium',
  l: 'Large',
  xl: 'Extra large',
}

export const PUDO_SIZE_DISCLAIMER =
  'Choose the locker size you think fits your order. If anything looks wrong or will not fit, we will contact you and adjust the sizing before dispatch.'

export function tierAllowedForCart(
  tier: PudoLockerTier,
  hasWholeSet: boolean,
): boolean {
  if (!hasWholeSet) return true
  return tier === 'l' || tier === 'xl'
}

export function defaultTierForCart(hasWholeSet: boolean): PudoLockerTier {
  return hasWholeSet ? 'l' : 'xs'
}

export function formatTierPrice(tier: PudoLockerTier): string {
  return `R${PUDO_LOCKER_PRICES_ZAR[tier]}`
}

export function lockerTierDisplay(tier: string | null | undefined): string {
  const t = String(tier || '').trim().toLowerCase()
  if ((PUDO_LOCKER_TIERS as readonly string[]).includes(t)) {
    return `${PUDO_LOCKER_LABELS[t as PudoLockerTier]} (${t.toUpperCase()})`
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
