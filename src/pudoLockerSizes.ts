export const PUDO_LOCKER_TIERS = ['locker', 'door'] as const
export type PudoLockerTier = (typeof PUDO_LOCKER_TIERS)[number]

export const PUDO_LOCKER_PRICES_ZAR: Record<PudoLockerTier, number> = {
  locker: 90,
  door: 110,
}

/** Orders at or above this ZAR subtotal qualify for free Pudo delivery. */
export const FREE_DELIVERY_MIN_SUBTOTAL_ZAR = 1000

export const PUDO_LOCKER_LABELS: Record<PudoLockerTier, string> = {
  locker: 'Locker',
  door: 'Door',
}

export const FREE_DELIVERY_MESSAGE =
  'Free delivery on orders of R1,000 or more.'

export const PUDO_DELIVERY_HINT =
  'Choose locker collection (R90) or door delivery (R110). Free delivery when your order is R1,000 or more.'

export function qualifiesForFreeDeliveryZar(subtotalZar: number): boolean {
  return Number.isFinite(subtotalZar) && subtotalZar >= FREE_DELIVERY_MIN_SUBTOTAL_ZAR
}

export function shippingZarForTier(tier: PudoLockerTier, subtotalZar: number): number {
  if (qualifiesForFreeDeliveryZar(subtotalZar)) return 0
  return PUDO_LOCKER_PRICES_ZAR[tier]
}

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

export function formatTierPrice(tier: PudoLockerTier, subtotalZar?: number): string {
  if (subtotalZar != null && qualifiesForFreeDeliveryZar(subtotalZar)) return 'Free'
  return `R${PUDO_LOCKER_PRICES_ZAR[tier]}`
}

export function shippingHintForTier(
  tier: PudoLockerTier,
  hasWholeSet: boolean,
  subtotalZar: number,
): string {
  if (qualifiesForFreeDeliveryZar(subtotalZar)) {
    return hasWholeSet
      ? 'Your order qualifies for free door delivery.'
      : tier === 'door'
        ? 'Your order qualifies for free door delivery.'
        : 'Your order qualifies for free locker collection.'
  }
  if (hasWholeSet) return 'Whole set orders use door delivery (R110).'
  if (tier === 'door') return 'Door delivery (R110). Use your saved address or enter it below.'
  return 'Locker collection (R90). Enter your Pudo locker details below.'
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
