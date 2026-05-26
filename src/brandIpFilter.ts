import { getIpMatchTerms } from './brandIpCatalog'
import type { ShopifyProduct } from '../types'

function isValidProduct(product: ShopifyProduct | null | undefined): product is ShopifyProduct {
  return product != null && typeof product === 'object'
}

function productSearchHaystack(product: ShopifyProduct): string {
  if (!isValidProduct(product)) return ''
  const parts = [
    product.title,
    product.vendor,
    product.productType,
    ...(Array.isArray(product.tags) ? product.tags : []),
  ]
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function compactHaystack(hay: string): string {
  return hay.replace(/\s+/g, '')
}

function imageUrlFromUnknown(entry: unknown): string | null {
  if (!entry) return null
  if (typeof entry === 'string') {
    const url = entry.trim()
    return url || null
  }
  if (typeof entry === 'object') {
    const obj = entry as Record<string, unknown>
    for (const key of ['url', 'src', 'originalSrc']) {
      const url = String(obj[key] || '').trim()
      if (url) return url
    }
  }
  return null
}

/** First usable image URL on a product (featured or gallery). */
export function productImageUrl(product: ShopifyProduct | null | undefined): string | null {
  if (!isValidProduct(product)) return null
  const featured = String(product.featuredImageUrl || '').trim()
  if (featured) return featured
  const gallery = product.images
  if (Array.isArray(gallery)) {
    for (const entry of gallery) {
      const url = imageUrlFromUnknown(entry)
      if (url) return url
    }
  }
  return null
}

/** First product image in a list (any item). */
export function firstProductImageUrl(
  products: ShopifyProduct[],
  skipUrls?: ReadonlySet<string>,
): string | null {
  for (const product of products) {
    if (!isValidProduct(product)) continue
    const url = productImageUrl(product)
    if (!url) continue
    if (skipUrls?.has(url)) continue
    return url
  }
  for (const product of products) {
    if (!isValidProduct(product)) continue
    const url = productImageUrl(product)
    if (url) return url
  }
  return null
}

function haystackMatchesTerm(hay: string, term: string): boolean {
  const needle = String(term || '').trim().toLowerCase()
  if (!needle) return false
  if (hay.includes(needle)) return true
  const compactNeedle = needle.replace(/\s+/g, '')
  if (compactNeedle && compactHaystack(hay).includes(compactNeedle)) return true
  return false
}

/** True when the product title/tags/type/vendor mention this IP (label + brand aliases). */
export function productMatchesIp(
  product: ShopifyProduct | null | undefined,
  ipName: string,
  slug?: string,
): boolean {
  if (!isValidProduct(product)) return false
  const terms = slug ? getIpMatchTerms(slug, ipName) : [ipName]
  const hay = productSearchHaystack(product)
  return terms.some((term) => haystackMatchesTerm(hay, term))
}

export function filterProductsByIp(
  products: ShopifyProduct[],
  ipName: string,
  slug?: string,
): ShopifyProduct[] {
  return products.filter((p): p is ShopifyProduct => productMatchesIp(p, ipName, slug))
}

export function countProductsByIp(
  products: ShopifyProduct[],
  ipName: string,
  slug?: string,
): number {
  return filterProductsByIp(products, ipName, slug).length
}

export function firstProductImageForIp(
  products: ShopifyProduct[],
  ipName: string,
  slug?: string,
  skipUrls?: ReadonlySet<string>,
): string | null {
  const matched = filterProductsByIp(products, ipName, slug)
  const fromIp = firstProductImageUrl(matched, skipUrls)
  if (fromIp) return fromIp
  return firstProductImageUrl(matched)
}

/**
 * Cover for an IP hub tile: matched product image first, then any in-collection product image.
 */
export function ipHubTilePreviewUri(
  products: ShopifyProduct[],
  ipName: string,
  slug?: string,
  skipUrls?: ReadonlySet<string>,
): string | null {
  const fromIp = firstProductImageForIp(products, ipName, slug, skipUrls)
  if (fromIp) return fromIp
  return firstProductImageUrl(products, skipUrls)
}

export function productMatchesAnyBrandIp(
  product: ShopifyProduct,
  ipNames: readonly string[],
  slug?: string,
): boolean {
  return ipNames.some((ip) => productMatchesIp(product, ip, slug))
}

export function filterProductsNotMatchingBrandIps(
  products: ShopifyProduct[],
  ipNames: readonly string[],
  slug?: string,
): ShopifyProduct[] {
  return products.filter((p) => !productMatchesAnyBrandIp(p, ipNames, slug))
}

export function countProductsNotMatchingBrandIps(
  products: ShopifyProduct[],
  ipNames: readonly string[],
  slug?: string,
): number {
  return filterProductsNotMatchingBrandIps(products, ipNames, slug).length
}

export function firstProductImageNotMatchingBrandIps(
  products: ShopifyProduct[],
  ipNames: readonly string[],
): string | null {
  for (const p of products) {
    if (!isValidProduct(p) || productMatchesAnyBrandIp(p, ipNames)) continue
    const url = productImageUrl(p)
    if (url) return url
  }
  return null
}
