import type { ShopifyProduct } from '../types'

export function parseTotalInventory(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(typeof raw === 'number' ? raw : Number.parseFloat(String(raw)))
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.floor(n))
}

export function getProductStockCount(product: ShopifyProduct | null | undefined): number | null {
  if (!product) return null
  return parseTotalInventory(product.totalInventory)
}

export function isProductInStock(product: ShopifyProduct | null | undefined): boolean {
  if (!product) return false
  if (product.availableForSale === false) return false
  const stock = getProductStockCount(product)
  if (stock == null) return false
  return stock > 0
}

export function formatStockLabel(product: ShopifyProduct | null | undefined): string {
  const stock = getProductStockCount(product)
  if (!isProductInStock(product) || stock == null) return 'Stock: 0'
  return `Stock: ${stock}`
}

export function maxPurchasableQuantity(product: ShopifyProduct | null | undefined): number {
  const stock = getProductStockCount(product)
  if (!isProductInStock(product) || stock == null) return 0
  return Math.min(99, stock)
}

/** Validates cart lines before checkout (client-side). */
export function getCartStockError(items: unknown[]): string | null {
  const demand = new Map<string, number>()
  for (const raw of items) {
    const item = raw as ShopifyProduct & { quantity?: number }
    if (!isProductInStock(item)) {
      return `${String(item?.title || 'An item')} is out of stock. Remove it to continue.`
    }
    const id = String(item?.id || '')
    if (!id) {
      return `${String(item?.title || 'An item')} cannot be ordered (missing product id).`
    }
    const qty = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)))
    const next = (demand.get(id) || 0) + qty
    demand.set(id, next)
    const stock = getProductStockCount(item)
    if (stock != null && next > stock) {
      return stock === 0
        ? `${String(item?.title || 'An item')} is out of stock.`
        : `Only ${stock} in stock for ${String(item?.title || 'an item')}.`
    }
  }
  return null
}
