/** In-store collection branches (match server collectStores). */
export const COLLECT_STORES = [
  {
    key: 'woodstock_cpt',
    name: 'Wonderport Woodstock CPT Branch',
    address: '282 Victoria Rd, Woodstock',
  },
  {
    key: 'lynnwood_pta',
    name: 'Wonderport Lynnwood PTA Branch',
    address: '315 Lynnwood Rd, Menlo Park',
  },
] as const

export type CollectStore = (typeof COLLECT_STORES)[number]
export type CollectStoreKey = CollectStore['key']

export function findCollectStore(key: string): CollectStore | null {
  const k = String(key || '').trim().toLowerCase()
  return COLLECT_STORES.find((s) => s.key === k) || null
}

/** Single-line label for fallbacks (no em dashes). */
export function formatCollectStoreLabel(store: { name: string; address: string }): string {
  return `${store.name}, ${store.address}`
}
