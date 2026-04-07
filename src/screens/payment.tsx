import { useContext } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { SafeAreaView } from 'react-native-safe-area-context'

export function Payment({ navigation, route }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const value = String(route?.params?.paymentMethod || '').trim()

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <View style={styles.topNavRow}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FeatherIcon name="arrow-left" size={20} color="#2a335f" />
            </Pressable>
            <Text style={styles.title}>Payment Method</Text>
          </View>
        </View>
      </SafeAreaView>

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
    },
    safeTop: {
      backgroundColor: '#f7f8fb',
    },
    topNavRow: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    headerRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      marginHorizontal: 16,
      marginTop: 8,
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
