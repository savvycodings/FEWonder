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
import { ThemeContext } from '../context'
import { adminOrdersLogin } from '../ordersApi'

export function AdminOrdersLogin({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Admin orders</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Password"
          placeholderTextColor={theme.mutedForegroundColor}
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, !password.trim() && styles.buttonDisabled]}
          disabled={!password.trim() || busy}
          onPress={onSubmit}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    container: { flex: 1, padding: 20, paddingTop: 24, justifyContent: 'center' },
    title: {
      fontFamily: theme.boldFont,
      fontSize: 22,
      color: theme.headingColor || theme.textColor,
      marginBottom: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: theme.mediumFont,
      fontSize: 16,
      color: theme.textColor,
      marginBottom: 12,
    },
    error: { color: '#c62828', fontFamily: theme.mediumFont, marginBottom: 8, lineHeight: 20 },
    button: {
      backgroundColor: theme.tintColor || '#2a335f',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: theme.tintTextColor || '#fff', fontFamily: theme.boldFont, fontSize: 16 },
  })
