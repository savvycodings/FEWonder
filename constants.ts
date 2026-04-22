import { NativeModules, Platform } from 'react-native'
import { AnthropicIcon } from './src/components/AnthropicIcon'
import { GeminiIcon } from './src/components/GeminiIcon'
import { OpenAIIcon } from './src/components/OpenAIIcon'

const normalizeDomain = (value?: string) => {
  if (!value) return ''
  let v = value.trim()
  if (!v.startsWith('http://') && !v.startsWith('https://')) {
    v = `http://${v}`
  }
  return v.replace(/\/+$/, '')
}

/** Android physical device: localhost in .env is the phone, not your PC. Metro’s bundle URL shares the PC’s LAN IP (or 10.0.2.2 on emulator). */
function androidDevApiHostFromMetro(): string | null {
  if (Platform.OS !== 'android' || !__DEV__) return null
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined
    if (!scriptURL) return null
    const m = scriptURL.match(/^https?:\/\/([^/:?]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function devPortFromUrl(url?: string): number {
  const m = (url || '').match(/:(\d+)(?:\/|$)/)
  return m ? parseInt(m[1], 10) : 3050
}

const env = (process.env.EXPO_PUBLIC_ENV || 'DEVELOPMENT').toUpperCase()
const devUrl = process.env.EXPO_PUBLIC_DEV_API_URL
const prodUrl = process.env.EXPO_PUBLIC_PROD_API_URL
let rawDomain = env === 'DEVELOPMENT' ? devUrl : prodUrl
if (env === 'DEVELOPMENT' && __DEV__) {
  const configured = normalizeDomain(rawDomain || devUrl || '')
  const metroHost = androidDevApiHostFromMetro()
  const pointsAtLoopback =
    !configured || /localhost|127\.0\.0\.1/i.test(configured)
  if (metroHost && pointsAtLoopback) {
    const port = devPortFromUrl(devUrl)
    rawDomain = `http://${metroHost}:${port}`
  }
}

export const DOMAIN = normalizeDomain(rawDomain || devUrl || prodUrl || '')

export const MODELS = {
  claudeOpus: {
    name: 'Claude Opus',
    label: 'claudeOpus',
    icon: AnthropicIcon
  },
  claudeSonnet: {
    name: 'Claude Sonnet',
    label: 'claudeSonnet',
    icon: AnthropicIcon
  },
  claudeHaiku: {
    name: 'Claude Haiku',
    label: 'claudeHaiku',
    icon: AnthropicIcon
  },
  claudeSonnet4: {
    name: 'Claude Sonnet 4',
    label: 'claudeSonnet4',
    icon: AnthropicIcon
  },
  gpt52: { name: 'GPT 5.2', label: 'gpt52', icon: OpenAIIcon },
  gpt5Mini: { name: 'GPT 5 Mini', label: 'gpt5Mini', icon: OpenAIIcon },
  gemini: { name: 'Gemini', label: 'gemini', icon: GeminiIcon },
}

export const IMAGE_MODELS = {
  nanoBanana: { name: 'Nano Banana (Gemini Flash Image)', label: 'nanoBanana' },
  nanoBananaPro: { name: 'Nano Banana Pro (Gemini 3 Pro)', label: 'nanoBananaPro' },
}
