import { useContext, useMemo } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ThemeContext } from '../context'
import { brandAccentRgba } from '../brandAccent'

const PRODUCT_SURFACE_BG = '#111111'
const PRODUCT_TEXT_PRIMARY = '#ffffff'
const HOME_CHIP_FILL = '#000000'
const HOME_ACCENT_TEXT = '#000000'
const HOME_MONTSERRAT_BOLD = 'Montserrat_700Bold' as const

type Props = {
  visible: boolean
  showCard: boolean
  onEft: () => void
  onCard: () => void
  onCancel: () => void
}

export function PaymentMethodModal({ visible, showCard, onEft, onCard, onCancel }: Props) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button">
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <Text style={styles.title}>Payment method</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={onEft}>
                  <Text style={styles.primaryBtnText}>EFT (bank transfer)</Text>
                </TouchableOpacity>
                {showCard ? (
                  <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={onCard}>
                    <Text style={styles.primaryBtnText}>Card</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85} onPress={onCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

function getStyles(theme: { brandAccent: string; semiBoldFont: string; boldFont: string }) {
  const L = (a: number) => brandAccentRgba(theme, a)
  const surfaceBorder = L(0.3)

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    safe: {
      flex: 1,
      justifyContent: 'center',
    },
    cardWrap: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
    },
    card: {
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 18,
      backgroundColor: PRODUCT_SURFACE_BG,
      borderWidth: 1,
      borderColor: surfaceBorder,
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 16,
    },
    title: {
      fontFamily: HOME_MONTSERRAT_BOLD,
      fontSize: 20,
      color: PRODUCT_TEXT_PRIMARY,
      textAlign: 'center',
      marginBottom: 18,
    },
    actions: {
      gap: 10,
    },
    primaryBtn: {
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: theme.brandAccent,
    },
    primaryBtnText: {
      fontFamily: theme.boldFont,
      fontSize: 15,
      color: HOME_ACCENT_TEXT,
    },
    cancelBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: HOME_CHIP_FILL,
      marginTop: 2,
    },
    cancelBtnText: {
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      color: theme.brandAccent,
    },
  })
}
