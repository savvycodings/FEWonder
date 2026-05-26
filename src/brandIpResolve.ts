import {
  BRAND_IP_CHARACTERS,
  BRAND_IP_CANDIDATE_POOL,
  getBrandIpCharacters,
  normalizeBrandSlug,
} from './brandIpCatalog'
import { countProductsByIp } from './brandIpFilter'
import type { ShopifyProduct } from '../types'

const FEATURED_IP_COUNT = 4

function getCandidatePool(slug: string): readonly string[] {
  const key = normalizeBrandSlug(slug)
  const extra = BRAND_IP_CANDIDATE_POOL[key]
  if (extra?.length) return extra
  return BRAND_IP_CHARACTERS[key] ?? []
}

/**
 * Pick the four IP tiles with the most in-stock products in this collection.
 * Falls back to the static catalog order when products are not loaded yet.
 */
export function resolveFeaturedBrandIps(
  slug: string,
  products: ShopifyProduct[],
): string[] | null {
  const key = normalizeBrandSlug(slug)
  const defaults = getBrandIpCharacters(slug)
  if (!defaults?.length) return null

  if (!products.length) return defaults

  const pool = getCandidatePool(slug)
  if (!pool.length) return defaults

  const seen = new Set<string>()
  const uniquePool: string[] = []
  for (const name of pool) {
    const label = String(name || '').trim()
    if (!label) continue
    const dedupe = label.toLowerCase()
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    uniquePool.push(label)
  }

  const ranked = uniquePool
    .map((ip) => ({ ip, count: countProductsByIp(products, ip, slug) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.ip.localeCompare(b.ip))

  const picked: string[] = []
  const pickedKeys = new Set<string>()
  for (const row of ranked) {
    if (picked.length >= FEATURED_IP_COUNT) break
    picked.push(row.ip)
    pickedKeys.add(row.ip.toLowerCase())
  }

  for (const ip of defaults) {
    if (picked.length >= FEATURED_IP_COUNT) break
    const k = ip.toLowerCase()
    if (pickedKeys.has(k)) continue
    picked.push(ip)
    pickedKeys.add(k)
  }

  return picked.slice(0, FEATURED_IP_COUNT)
}
