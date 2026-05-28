import type { ImageSourcePropType } from 'react-native'
import type { ShopifyMoney, ShopifyProduct } from '../types'
import { formatMoney } from './money'

export type ProductSavePayload = {
  id: string
  handle: string
  title: string
  price?: string | ShopifyMoney | null
  image?: ImageSourcePropType
  featuredImageUrl?: string | null
  category?: string
  productType?: string | null
}

export function getProductSaveImageSource(
  item: Pick<ShopifyProduct, 'featuredImageUrl'> & { image?: ImageSourcePropType },
): ImageSourcePropType | undefined {
  if (item?.featuredImageUrl) return { uri: item.featuredImageUrl }
  return item.image
}

export function shopifyProductToSavePayload(item: ShopifyProduct): ProductSavePayload {
  const priceLabel =
    item.price?.amount != null && item.price.amount !== '' ? formatMoney(item.price) : undefined
  return {
    id: String(item.id),
    handle: item.handle,
    title: item.title,
    price: item.price ?? priceLabel,
    image: getProductSaveImageSource(item),
    featuredImageUrl: item.featuredImageUrl ?? null,
    category: item.productType || undefined,
    productType: item.productType,
  }
}

export function isSameSavedProduct(
  a: { id?: string; handle?: string; title?: string },
  b: { id?: string; handle?: string; title?: string },
): boolean {
  if (a.id && b.id) return String(a.id) === String(b.id)
  if (a.handle && b.handle) return a.handle === b.handle
  return Boolean(a.title && b.title && a.title === b.title)
}

export function savedProductListKey(item: { id?: string; handle?: string; title: string }): string {
  if (item.id) return `id:${item.id}`
  if (item.handle) return `handle:${item.handle}`
  return `title:${item.title}`
}
