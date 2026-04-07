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
import { loginUser, registerUser } from '../utils'
import { AuthPayload } from '../../types'

type Props = {
  onAuthSuccess: (payload: AuthPayload) => Promise<void>
}

export function Login({ onAuthSuccess }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreateAccount() {
    if (loading) return
    setError('')

    const normalizedFullName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (mode === 'signup' && !normalizedFullName) {
      setError('Please fill in full name, email, and password.')
      return
    }

    if (!normalizedEmail || !password) {
      setError('Please fill in email and password.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    try {
      setLoading(true)
      console.log('[login] create account tapped', {
        email: normalizedEmail,
        fullNameLength: normalizedFullName.length,
      })
      const authPayload = mode === 'signup'
        ? await registerUser({
            fullName: normalizedFullName,
            email: normalizedEmail,
            password,
            shippingAddress: shippingAddress.trim(),
            paymentMethod: paymentMethod.trim(),
          })
        : await loginUser({
            email: normalizedEmail,
            password,
          })
      console.log('[login] account created successfully', {
        userId: authPayload.user.id,
        email: authPayload.user.email,
      })
      await onAuthSuccess(authPayload)
    } catch (registerError: any) {
      console.log('[login] create account failed', {
        message: registerError?.message,
        name: registerError?.name,
        stack: registerError?.stack,
      })
      setError(registerError?.message || 'Failed to create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>
          Sign in to your Wonderport account or create a new one.
        </Text>
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'signin' ? styles.modeButtonActive : null]}
            onPress={() => {
              setMode('signin')
              setError('')
            }}
          >
            <Text style={[styles.modeButtonText, mode === 'signin' ? styles.modeButtonTextActive : null]}>
              Sign in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'signup' ? styles.modeButtonActive : null]}
            onPress={() => {
              setMode('signup')
              setError('')
            }}
          >
            <Text style={[styles.modeButtonText, mode === 'signup' ? styles.modeButtonTextActive : null]}>
              Create account
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'signup' ? (
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor={theme.placeholderTextColor}
            style={styles.input}
            autoCapitalize="words"
          />
        ) : null}
        {mode === 'signup' ? (
          <TextInput
            value={shippingAddress}
            onChangeText={setShippingAddress}
            placeholder="Shipping address (optional)"
            placeholderTextColor={theme.placeholderTextColor}
            style={styles.input}
            autoCapitalize="words"
          />
        ) : null}
        {mode === 'signup' ? (
          <TextInput
            value={paymentMethod}
            onChangeText={setPaymentMethod}
            placeholder="Payment method (optional)"
            placeholderTextColor={theme.placeholderTextColor}
            style={styles.input}
            autoCapitalize="none"
          />
        ) : null}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={theme.placeholderTextColor}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (min 8 chars)"
          placeholderTextColor={theme.placeholderTextColor}
          style={styles.input}
          secureTextEntry
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.submitButton}
          activeOpacity={0.85}
          onPress={handleCreateAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.tintTextColor} />
          ) : (
            <Text style={styles.submitText}>
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 12,
    },
    title: {
      color: theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 30,
      marginBottom: 6,
    },
    subtitle: {
      color: theme.secondaryTextColor,
      fontFamily: theme.regularFont,
      fontSize: 15,
      marginBottom: 18,
    },
    modeSwitch: {
      flexDirection: 'row',
      backgroundColor: '#e9edf5',
      borderRadius: 12,
      padding: 4,
      marginBottom: 6,
    },
    modeButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeButtonActive: {
      backgroundColor: '#2a335f',
    },
    modeButtonText: {
      color: '#6b738f',
      fontFamily: theme.mediumFont,
      fontSize: 13,
    },
    modeButtonTextActive: {
      color: '#ffffff',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.textColor,
      fontFamily: theme.mediumFont,
    },
    submitButton: {
      marginTop: 10,
      backgroundColor: '#2a335f',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    submitText: {
      color: theme.tintTextColor,
      fontFamily: theme.boldFont,
      fontSize: 16,
    },
    errorText: {
      color: '#ef4444',
      fontFamily: theme.mediumFont,
      marginTop: 2,
    },
  })
