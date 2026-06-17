import { useContext, useMemo } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { ThemeContext } from '../context'
import { WonderGemIcon } from './WonderCoin'

export const INSUFFICIENT_WONDER_COINS_TITLE = 'Insufficient Wonder Gems'

export const INSUFFICIENT_WONDER_COINS_BODY =
  'Earn more Wonder Gems by:\n• Claiming your daily login rewards\n• Opening gift boxes in Sunset Keys while playing WonderJump'

export function isInsufficientWonderCoinsError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('not enough coin') ||
    m.includes('insufficient coin') ||
    m.includes('not enough gem') ||
    m.includes('not enough wonder')
  )
}

type InsufficientWonderCoinsModalProps = {
  visible: boolean
  balance: number
  onClose: () => void
}

export function InsufficientWonderCoinsModal({
  visible,
  balance,
  onClose,
}: InsufficientWonderCoinsModalProps) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{INSUFFICIENT_WONDER_COINS_TITLE}</Text>
          <Text style={styles.body}>{INSUFFICIENT_WONDER_COINS_BODY}</Text>

          <View style={styles.balanceRow}>
            <WonderGemIcon size={24} />
            <Text style={styles.balanceValue}>{balance}</Text>
          </View>

          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeButtonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.modalOverlayColor || 'rgba(22, 27, 46, 0.38)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.tileBackgroundColor || '#ffffff',
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || '#e7ebf3',
    },
    title: {
      color: theme.textColor,
      fontFamily: 'Geist-SemiBold',
      fontSize: 20,
      textAlign: 'center',
      marginBottom: 10,
    },
    body: {
      color: theme.mutedForegroundColor,
      fontFamily: 'Geist-Regular',
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'left',
    },
    balanceRow: {
      marginTop: 14,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor || '#f4f6fb',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || '#e7ebf3',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    balanceValue: {
      color: theme.textColor,
      fontFamily: 'Geist-Bold',
      fontSize: 18,
    },
    closeButton: {
      marginTop: 16,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: theme.tintColor || theme.brandAccent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonText: {
      color: theme.tintTextColor || '#ffffff',
      fontFamily: 'Geist-SemiBold',
      fontSize: 15,
    },
  })
}
