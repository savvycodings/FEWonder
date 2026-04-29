import { Image } from 'react-native'

const JETPACK_SVG = require('../assets/jetpack.svg')

let xmlCache: string | null = null
let inflight: Promise<string> | null = null

export function peekJetpackSvgXml(): string | null {
  return xmlCache
}

export function jetpackSvgAssetUri(): string {
  try {
    const resolved = Image.resolveAssetSource(JETPACK_SVG)
    return String(resolved?.uri || '')
  } catch {
    return ''
  }
}

export async function ensureJetpackSvgXml(): Promise<string> {
  if (xmlCache) return xmlCache
  if (!inflight) {
    inflight = (async () => {
      const resolved = Image.resolveAssetSource(JETPACK_SVG)
      const uri = resolved?.uri
      if (!uri) throw new Error('jetpack.svg has no uri')
      const res = await fetch(uri)
      if (!res.ok) throw new Error(`jetpack fetch ${res.status}`)
      const xml = await res.text()
      xmlCache = xml
      return xml
    })()
  }
  return inflight
}
