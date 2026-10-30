import { linePackagingFromItem } from './pudoLockerSizes'

function cartLineKey(item: { id?: string; title?: string; selectedPackaging?: string }): string {
  const id = String(item?.id || '').trim()
  const packaging = linePackagingFromItem(item)
  if (id) return `${id}:${packaging}`
  const title = String(item?.title || '').trim().toLowerCase()
  return title ? `title:${title}:${packaging}` : ''
}

/**
 * Merge device cart with account cart so a stale/partial server cart cannot wipe local lines.
 * Same product+packaging keeps the higher quantity.
 */
export function mergeCartItems(local: any[], remote: any[]): any[] {
  const map = new Map<string, any>()

  const upsert = (item: any) => {
    const key = cartLineKey(item)
    if (!key) return
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...item, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) })
      return
    }
    const qty = Math.max(
      Math.max(1, Math.floor(Number(existing.quantity) || 1)),
      Math.max(1, Math.floor(Number(item.quantity) || 1)),
    )
    map.set(key, {
      ...existing,
      ...item,
      quantity: qty,
      title: item.title || existing.title,
      price: item.price ?? existing.price,
      featuredImageUrl: item.featuredImageUrl ?? existing.featuredImageUrl,
      image: item.image ?? existing.image,
      selectedPackaging: linePackagingFromItem(item) || linePackagingFromItem(existing),
    })
  }

  for (const item of remote || []) upsert(item)
  for (const item of local || []) upsert(item)
  return Array.from(map.values())
}
