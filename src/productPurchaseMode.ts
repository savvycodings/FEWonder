import type { ShopifyProduct } from '../types'

export type PurchaseMode = 'standard' | 'blind_box'

/** Solid / Window box listings and single-variant items use standard purchase (no packaging picker). */
export function classifyPurchaseMode(
  productType?: string | null,
  packagePrices?: ShopifyProduct['packagePrices'],
): PurchaseMode {
  const t = String(productType || '').trim().toLowerCase()
  const hasSet = Boolean(packagePrices?.set)

  if (/\bsolid\b/.test(t) && /\bbox\b/.test(t)) return 'standard'
  if (/\bwindow\b/.test(t) && /\bbox\b/.test(t)) return 'standard'
  if (/\bblind\b/.test(t) && /\bbox\b/.test(t)) {
    return hasSet ? 'blind_box' : 'standard'
  }

  return hasSet ? 'blind_box' : 'standard'
}

export function getProductPurchaseMode(product: ShopifyProduct | null | undefined): PurchaseMode {
  if (!product) return 'standard'
  if (product.purchaseMode === 'blind_box' || product.purchaseMode === 'standard') {
    return product.purchaseMode
  }
  return classifyPurchaseMode(product.productType, product.packagePrices)
}

export function productShowsPackagingChoice(product: ShopifyProduct | null | undefined): boolean {
  return getProductPurchaseMode(product) === 'blind_box'
}
