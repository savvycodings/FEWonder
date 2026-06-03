import type { ShopifyProduct } from '../types'
import { linePackagingFromItem } from './pudoLockerSizes'

export type CartPackaging = 'single' | 'set'

export function cartLineTitle(productTitle: string, packaging: CartPackaging): string {
  if (packaging === 'set') return `${productTitle} (Whole set)`
  return productTitle
}

export function priceForPackaging(
  product: Pick<ShopifyProduct, 'price' | 'packagePrices'>,
  packaging: CartPackaging,
) {
  const single = product.packagePrices?.single ?? product.price ?? null
  const set = product.packagePrices?.set
  return packaging === 'set' ? set ?? single : single
}

export function cartItemFromProduct(
  product: ShopifyProduct,
  packaging: CartPackaging,
  quantity: number,
) {
  return {
    ...product,
    price: priceForPackaging(product, packaging),
    selectedPackaging: packaging,
    title: cartLineTitle(String(product.title || 'Product'), packaging),
    quantity,
  }
}

export type CartSyncLine = { productId: string; packaging: CartPackaging; quantity: number }

export function cartItemsToSyncLines(
  items: { id?: string; quantity?: number; selectedPackaging?: string; title?: string }[],
): CartSyncLine[] {
  return items
    .map((item) => ({
      productId: String(item.id || '').trim(),
      packaging: linePackagingFromItem(item),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }))
    .filter((line) => line.productId.length > 0)
}
