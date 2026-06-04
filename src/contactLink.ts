import { Alert, Linking, Platform } from 'react-native'
import * as Clipboard from 'expo-clipboard'

async function copyWithMessage(label: string, value: string, message: string) {
  await Clipboard.setStringAsync(value)
  Alert.alert(`${label} copied`, message)
}

export async function openEmailAddress(email: string): Promise<void> {
  const url = `mailto:${email.trim()}`
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.location.href = url
        return
      }
    } else {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
        return
      }
    }
  } catch {
    /* fall through to clipboard */
  }
  await copyWithMessage(
    'Email',
    email,
    `Paste ${email} into your email app if it did not open automatically.`,
  )
}

export async function openPhoneNumber(display: string, dial: string): Promise<void> {
  const url = `tel:${dial}`
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.location.href = url
        return
      }
    } else {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
        return
      }
    }
  } catch {
    /* fall through to clipboard */
  }
  await copyWithMessage(
    'Phone number',
    display,
    `Paste ${display} into your phone app if the dialer did not open.`,
  )
}
