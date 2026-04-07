import { useContext } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function Payment({ navigation, route }: any) {
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const styles = getStyles(theme)
  const value = String(route?.params?.paymentMethod || '').trim()

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <FeatherIcon name="arrow-left" size={18} color="#2a335f" />
        </Pressable>
        <Text style={styles.title}>Payment Method</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Saved payment method</Text>
        <Text style={styles.value}>
          {value || 'No payment method added yet.'}
        </Text>
      </View>
    </View>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f7f8fb',
      paddingHorizontal: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    title: {
      color: '#243056',
      fontFamily: theme.semiBoldFont,
      fontSize: 22,
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e7ebf3',
      padding: 14,
    },
    label: {
      color: '#8b94aa',
      fontFamily: theme.mediumFont,
      fontSize: 12,
      marginBottom: 8,
    },
    value: {
      color: '#243056',
      fontFamily: theme.regularFont,
      fontSize: 15,
      lineHeight: 20,
    },
  })
