import { useContext, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeContext } from '../context'
import { adminOrdersLogin } from '../ordersApi'

const HOME_ACCENT_BG = '#CBFF00'
const HOME_ACCENT_TEXT = '#000000'
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const

export function AdminOrdersLogin({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const insets = useSafeAreaInsets()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    setError(null)
    setBusy(true)
    try {
      await adminOrdersLogin(password)
      navigation.replace('AdminOrdersHub')
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <KeyboardAwareScrollView
          style={styles.flex}
          bottomOffset={insets.bottom + 20}
          extraKeyboardSpace={12}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Admin orders</Text>
          <View style={styles.accentRule} />
          <Text style={styles.subtitle}>Enter the admin password to view and manage orders.</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••••"
              placeholderTextColor={theme.mutedForegroundColor}
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, !password.trim() && styles.buttonDisabled]}
              disabled={!password.trim() || busy}
              onPress={onSubmit}
              activeOpacity={0.88}
            >
              {busy ? (
                <ActivityIndicator color={HOME_ACCENT_TEXT} />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
      justifyContent: 'center',
    },
    title: {
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 28,
      lineHeight: 34,
      color: theme.headingColor || theme.textColor,
      letterSpacing: -0.3,
    },
    accentRule: {
      width: 40,
      height: 3,
      borderRadius: 2,
      backgroundColor: HOME_ACCENT_BG,
      marginTop: 8,
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: theme.regularFont,
      fontSize: 14,
      lineHeight: 20,
      color: theme.mutedForegroundColor,
      marginBottom: 20,
    },
    card: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    fieldLabel: {
      fontFamily: theme.boldFont,
      fontSize: 11,
      color: HOME_ACCENT_BG,
      letterSpacing: 0.55,
      textTransform: 'uppercase',
      marginBottom: 8,
      opacity: 0.92,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: theme.textColor,
      marginBottom: 12,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    error: {
      color: '#f87171',
      fontFamily: theme.mediumFont,
      marginBottom: 12,
      lineHeight: 20,
      fontSize: 13,
    },
    button: {
      backgroundColor: HOME_ACCENT_BG,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: HOME_ACCENT_TEXT, fontFamily: theme.boldFont, fontSize: 16 },
  })
