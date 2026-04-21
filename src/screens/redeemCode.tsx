import { useContext, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { ThemeContext } from '../context'

const ACCENT = '#CBFF00'

export function RedeemCode() {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function onRedeem() {
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Enter a code to redeem.')
      setSuccess('')
      return
    }
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      // Hook for future POST /auth/redeem-code — keep UX ready without blocking ship.
      await new Promise((r) => setTimeout(r, 400))
      setSuccess('Redeem is coming soon. Your code was not applied yet.')
      setCode('')
    } catch (e: any) {
      setError(e?.message || 'Could not redeem code.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Redeem code</Text>
        <Text style={styles.subtitle}>Enter a promotional or reward code when available.</Text>
        <View style={styles.accentRule} />
        <View style={styles.card}>
          <Text style={styles.label}>Code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Enter your code"
            placeholderTextColor={theme.mutedForegroundColor}
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}
          <TouchableOpacity
            style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
            onPress={onRedeem}
            disabled={submitting}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color="#050505" />
            ) : (
              <Text style={styles.saveText}>Redeem</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    content: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 28,
    },
    title: {
      color: theme.headingColor || theme.textColor,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 30,
      marginBottom: 4,
    },
    subtitle: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 13,
      marginBottom: 8,
    },
    accentRule: {
      width: 62,
      height: 4,
      borderRadius: 999,
      backgroundColor: ACCENT,
      marginBottom: 14,
    },
    card: {
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: 'rgba(203,255,0,0.3)',
      padding: 12,
    },
    label: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: 'rgba(203,255,0,0.22)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      marginBottom: 10,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    saveButton: {
      minHeight: 42,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT,
      marginTop: 2,
    },
    saveButtonDisabled: { opacity: 0.45 },
    saveText: {
      color: '#050505',
      fontFamily: theme.boldFont,
      fontSize: 14,
    },
    errorText: {
      color: '#ef4444',
      fontFamily: theme.mediumFont,
      marginBottom: 8,
    },
    successText: {
      color: '#22c55e',
      fontFamily: theme.mediumFont,
      marginBottom: 8,
    },
  })
