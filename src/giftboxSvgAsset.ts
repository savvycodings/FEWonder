import { Image } from 'react-native'

const GIFTBOX_SVG = require('../assets/giftbox.svg')

let xmlCache: string | null = null
let inflight: Promise<string> | null = null

/** Current parsed SVG string, if load has finished. */
export function peekGiftboxSvgXml(): string | null {
  return xmlCache
}

/** Resolved Metro/asset URI for SvgUri fallback when Xml is slow or fetch fails (e.g. some web builds). */
export function giftboxSvgAssetUri(): string {
  try {
    const resolved = Image.resolveAssetSource(GIFTBOX_SVG)
    return String(resolved?.uri || '')
  } catch {
    return ''
  }
}

/** Single shared load for Wonder Jump dock, modal, Daily Rewards-style previews, etc. */
export async function ensureGiftboxSvgXml(): Promise<string> {
  if (xmlCache) return xmlCache
  if (!inflight) {
    inflight = (async () => {
      const resolved = Image.resolveAssetSource(GIFTBOX_SVG)
      const uri = resolved?.uri
      if (!uri) throw new Error('giftbox.svg has no uri')
      const res = await fetch(uri)
      if (!res.ok) throw new Error(`giftbox fetch ${res.status}`)
      const xml = await res.text()
      xmlCache = xml
      return xml
    })()
  }
  return inflight
}
