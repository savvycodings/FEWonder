import AsyncStorage from '@react-native-async-storage/async-storage'

export type WonderJumpCharacterStyle = 'classic' | 'ghost'

export const WONDER_JUMP_CHARACTER_STORAGE_KEY = 'wonder-jump-character-style'

export const WONDER_JUMP_CHARACTER_OPTIONS: ReadonlyArray<{
  id: WonderJumpCharacterStyle
  label: string
  blurb: string
}> = [
  { id: 'classic', label: 'Classic', blurb: 'Original jumper look.' },
  { id: 'ghost', label: 'Ghost', blurb: 'Soft ghost body with smile.' },
]

export function isWonderJumpCharacterStyle(value: string): value is WonderJumpCharacterStyle {
  return value === 'classic' || value === 'ghost'
}

export async function loadWonderJumpCharacterStyle(): Promise<WonderJumpCharacterStyle> {
  try {
    const raw = await AsyncStorage.getItem(WONDER_JUMP_CHARACTER_STORAGE_KEY)
    if (raw && isWonderJumpCharacterStyle(raw)) return raw
  } catch {
    // Ignore storage read errors and fallback to default style.
  }
  return 'classic'
}

export async function saveWonderJumpCharacterStyle(style: WonderJumpCharacterStyle): Promise<void> {
  try {
    await AsyncStorage.setItem(WONDER_JUMP_CHARACTER_STORAGE_KEY, style)
  } catch {
    // Ignore storage write errors.
  }
}
