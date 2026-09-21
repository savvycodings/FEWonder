import type { OrderQuoteResult } from './ordersApi'
import type { PudoLockerTier } from './pudoLockerSizes'
import { qualifiesForFreeDeliveryZar, shippingZarForTier } from './pudoLockerSizes'

const WONDER_COINS_PER_RAND_VALUE = 10
const FIRST_ORDER_PROMO_CODE = 'WONDER15'
const FIRST_ORDER_PROMO_PERCENT = 15
const INFLUENCER_PROMO_PERCENT = 10

/** Offline display-only list — server ENV is authoritative for real discounts. */
const OFFLINE_INFLUENCER_CODES = new Set([
  'AMANITA10',
  'LEYLA10',
  'MOMWITHME10',
  'PRETTY10',
  'GEEKY10',
  'SICHENGII10',
  'NINA10',
  'BLOB10',
])

function discountCentsFromPoints(points: number): number {
  const p = Math.max(0, Math.floor(points))
  if (p <= 0) return 0
  return Math.floor((p * 100) / WONDER_COINS_PER_RAND_VALUE)
}

function pointsFromDiscountCents(discountCents: number): number {
  const c = Math.max(0, Math.floor(discountCents))
  if (c <= 0) return 0
  return Math.floor((c * WONDER_COINS_PER_RAND_VALUE) / 100)
}

function maxRedeemablePoints(balance: number, subtotalCents: number): number {
  const bal = Math.max(0, Math.floor(balance))
  const sub = Math.max(0, Math.floor(subtotalCents))
  if (bal <= 0 || sub <= 0) return 0
  return Math.min(bal, pointsFromDiscountCents(sub))
}

function normalizePromoCode(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/** Client-side checkout totals when the quote API is unavailable (uses cart subtotal in ZAR). */
export function estimateCheckoutQuote(params: {
  subtotalZar: number
  pudoLockerTier: PudoLockerTier
  wonderCoinsToRedeem?: number
  walletBalance?: number
  promoCode?: string | null
}): OrderQuoteResult {
  const subtotalCents = Math.max(0, Math.round(params.subtotalZar * 100))
  const freeDelivery = qualifiesForFreeDeliveryZar(params.subtotalZar)
  const shippingCents = Math.round(shippingZarForTier(params.pudoLockerTier, params.subtotalZar) * 100)
  const walletBalance = Math.max(0, Math.floor(params.walletBalance ?? 0))

  const normalizedPromo = normalizePromoCode(params.promoCode)
  let promoCode: string | null = null
  let promoDiscountCents = 0
  if (normalizedPromo === FIRST_ORDER_PROMO_CODE) {
    promoDiscountCents = Math.floor((subtotalCents * FIRST_ORDER_PROMO_PERCENT) / 100)
    if (promoDiscountCents > 0) promoCode = FIRST_ORDER_PROMO_CODE
  } else if (OFFLINE_INFLUENCER_CODES.has(normalizedPromo)) {
    promoDiscountCents = Math.floor((subtotalCents * INFLUENCER_PROMO_PERCENT) / 100)
    if (promoDiscountCents > 0) promoCode = normalizedPromo
  }
  const merchandiseAfterPromo = Math.max(0, subtotalCents - promoDiscountCents)

  const maxRedeemableCoins = maxRedeemablePoints(walletBalance, merchandiseAfterPromo)

  let requested = Math.max(0, Math.floor(params.wonderCoinsToRedeem ?? 0))
  const wonderCoinsRedeemed = Math.min(requested, maxRedeemableCoins)
  let discountCents = discountCentsFromPoints(wonderCoinsRedeemed)
  if (discountCents > merchandiseAfterPromo) discountCents = merchandiseAfterPromo

  const settledPoints = pointsFromDiscountCents(discountCents)
  const subtotalAfterDiscount = merchandiseAfterPromo - discountCents
  const totalCents = subtotalAfterDiscount + shippingCents
  const wonderCoinsEarned = Math.floor(subtotalAfterDiscount / 100)

  return {
    subtotalCents,
    discountCents,
    wonderCoinsRedeemed: settledPoints,
    wonderCoinsEarned,
    shippingCents,
    totalCents,
    freeDelivery,
    maxRedeemableCoins,
    walletBalance,
    currency: 'ZAR',
    promoCode,
    promoDiscountCents,
    promoError: null,
  }
}
