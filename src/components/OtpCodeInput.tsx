import { useContext, useRef } from 'react'
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native'
import { ThemeContext } from '../context'
import { brandAccentRgba } from '../brandAccent'

const DEFAULT_LENGTH = 6
/** Dash after this many digits (3 → `123-456`). */
const DEFAULT_SEPARATOR_AFTER = 2

type Props = {
  value: string
  onChange: (value: string) => void
  length?: number
  /** Index after which to show a dash (default 2 → XXX-XXX). Pass -1 for no dash. */
  separatorAfterIndex?: number
  disabled?: boolean
  autoFocus?: boolean
}

function digitsOnly(raw: string, max: number): string {
  return raw.replace(/\D/g, '').slice(0, max)
}

export function OtpCodeInput({
  value,
  onChange,
  length = DEFAULT_LENGTH,
  separatorAfterIndex = DEFAULT_SEPARATOR_AFTER,
  disabled = false,
  autoFocus = false,
}: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const refs = useRef<(TextInput | null)[]>([])

  const normalized = digitsOnly(value, length)
  const cells = Array.from({ length }, (_, i) => normalized[i] ?? '')

  function focusIndex(index: number) {
    const ref = refs.current[index]
    if (ref) ref.focus()
  }

  function applyDigits(next: string) {
    const clean = digitsOnly(next, length)
    onChange(clean)
    const focusAt = Math.min(clean.length, length - 1)
    if (clean.length > 0 && clean.length < length) {
      focusIndex(focusAt)
    }
  }

  function setCell(index: number, text: string) {
    const incoming = digitsOnly(text, length)
    if (incoming.length > 1) {
      applyDigits(incoming)
      return
    }

    const arr = cells.slice()
    arr[index] = incoming
    const joined = arr.join('').replace(/\s/g, '')
    const clean = digitsOnly(joined, length)
    onChange(clean)

    if (incoming && index < length - 1) {
      focusIndex(index + 1)
    }
  }

  function onKeyPress(index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key !== 'Backspace') return
    if (cells[index]) return
    if (index > 0) {
      focusIndex(index - 1)
      const arr = cells.slice()
      arr[index - 1] = ''
      onChange(digitsOnly(arr.join(''), length))
    }
  }

  const showSeparator =
    separatorAfterIndex >= 0 &&
    separatorAfterIndex < length - 1

  function renderCell(index: number) {
    const digit = cells[index]
    return (
      <TextInput
        key={`otp-${index}`}
        ref={el => {
          refs.current[index] = el
        }}
        value={digit}
        onChangeText={text => setCell(index, text)}
        onKeyPress={e => onKeyPress(index, e)}
        keyboardType="number-pad"
        maxLength={length}
        editable={!disabled}
        autoFocus={autoFocus && index === 0}
        selectTextOnFocus
        style={[
          styles.cell,
          digit ? styles.cellFilled : null,
          disabled ? styles.cellDisabled : null,
        ]}
        textContentType="oneTimeCode"
        autoComplete={index === 0 ? 'one-time-code' : 'off'}
      />
    )
  }

  if (!showSeparator) {
    return (
      <View style={styles.row}>
        {cells.map((_, index) => renderCell(index))}
      </View>
    )
  }

  const splitAt = separatorAfterIndex + 1
  return (
    <View style={styles.row}>
      <View style={styles.group}>
        {cells.slice(0, splitAt).map((_, i) => renderCell(i))}
      </View>
      <Text style={styles.dash}>–</Text>
      <View style={styles.group}>
        {cells.slice(splitAt).map((_, i) => renderCell(i + splitAt))}
      </View>
    </View>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 20,
    },
    group: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dash: {
      fontSize: 28,
      lineHeight: 34,
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      marginHorizontal: 4,
    },
    cell: {
      width: 52,
      height: 64,
      borderWidth: 1.5,
      borderColor: L(0.22),
      borderRadius: 12,
      textAlign: 'center',
      fontSize: 28,
      fontFamily: theme.boldFont,
      color: theme.textColor,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      padding: 0,
    },
    cellFilled: {
      borderColor: theme.brandAccent,
    },
    cellDisabled: {
      opacity: 0.5,
    },
  })
}
