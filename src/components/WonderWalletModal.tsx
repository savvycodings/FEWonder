import { useContext, useMemo } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { WonderGemIcon, WonderSpinningCoin } from './WonderCoin'

export const WONDER_WALLET_HELP_TITLE = 'Wonder Wallet'

export const WONDER_WALLET_HELP_TEXT =
  'Wonder Gems — earn by claiming daily login rewards and opening gift boxes in WonderJump. Spend them on cosmetics in the Wonder Store (themes, avatar frames, and more).\n\nWonder Coins — earn 1 coin per R1 spent on merchandise when you checkout. Redeem at checkout: 10 coins = R1 off your order (shipping is not discounted).'

export function showWonderWalletHelp() {
  Alert.alert(WONDER_WALLET_HELP_TITLE, WONDER_WALLET_HELP_TEXT)
}

type WonderWalletModalProps = {
  visible: boolean
  balance: number
  gemBalance: number
  onClose: () => void
  /** When set, shows a primary action (e.g. jump to Wonder Store from Profile). */
  onWonderStorePress?: () => void
}

export function WonderWalletModal({
  visible,
  balance,
  gemBalance,
  onClose,
  onWonderStorePress,
}: WonderWalletModalProps) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.walletModalCard]}>
          <Pressable
            style={styles.walletHelpIconWrap}
            onPress={showWonderWalletHelp}
            accessibilityRole="button"
            accessibilityLabel="How Wonder Wallet works"
            hitSlop={8}
          >
            <FeatherIcon name="help-circle" size={18} color={theme.mutedForegroundColor} />
          </Pressable>
          <Text style={styles.walletModalTitle}>Wonder Wallet</Text>
          <Text style={styles.walletModalSubtitle}>Your current Wonder Wallet balances.</Text>

          <View style={styles.walletModalBalanceRow}>
            <View style={styles.walletModalIconSlot}>
              <WonderGemIcon size={20} scale={1} />
            </View>
            <View style={styles.walletModalBalanceTextCol}>
              <Text style={styles.walletModalBalanceLabel}>Wonder Gems</Text>
              <Text style={styles.walletModalBalanceValue}>{gemBalance}</Text>
            </View>
          </View>

          <View style={styles.walletModalBalanceRow}>
            <View style={styles.walletModalIconSlot}>
              <WonderSpinningCoin size={20} fallbackColor={theme.textColor} />
            </View>
            <View style={styles.walletModalBalanceTextCol}>
              <Text style={styles.walletModalBalanceLabel}>Wonder Coins</Text>
              <Text style={styles.walletModalBalanceValue}>{balance}</Text>
            </View>
          </View>

          <View style={styles.walletModalButtons}>
            <Pressable style={styles.walletModalButtonSecondary} onPress={onClose}>
              <Text style={styles.walletModalButtonSecondaryText}>Close</Text>
            </Pressable>
            {onWonderStorePress ? (
              <Pressable style={styles.walletModalButtonPrimary} onPress={onWonderStorePress}>
                <Text style={styles.walletModalButtonPrimaryText}>Wonder Store</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.modalOverlayColor || 'rgba(22, 27, 46, .35)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      width: '100%',
      backgroundColor: theme.tileBackgroundColor || '#ffffff',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || '#e7ebf3',
    },
    walletModalCard: {
      position: 'relative',
    },
    walletHelpIconWrap: {
      position: 'absolute',
      top: 14,
      left: 14,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || '#ffffff',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || '#e7ebf3',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    walletModalTitle: {
      color: theme.textColor,
      fontFamily: 'Geist-SemiBold',
      fontSize: 20,
      textAlign: 'center',
    },
    walletModalSubtitle: {
      color: theme.mutedForegroundColor,
      fontFamily: 'Geist-Regular',
      fontSize: 12,
      marginTop: 3,
      marginBottom: 12,
      textAlign: 'center',
    },
    walletModalBalanceRow: {
      marginTop: 4,
      marginBottom: 6,
      alignSelf: 'stretch',
      borderRadius: 12,
      backgroundColor: theme.sheetRowBackgroundColor || theme.appBackgroundColor || '#f4f6fb',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || '#e7ebf3',
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    walletModalIconSlot: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    walletModalBalanceTextCol: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    walletModalBalanceLabel: {
      color: theme.mutedForegroundColor,
      fontFamily: 'Geist-Regular',
      fontSize: 13,
    },
    walletModalBalanceValue: {
      color: theme.textColor,
      fontFamily: 'Geist-Bold',
      fontSize: 22,
    },
    walletModalButtons: {
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    walletModalButtonSecondary: {
      flex: 1,
      maxWidth: 150,
      minHeight: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || '#cfd8ec',
      backgroundColor: theme.tileBackgroundColor || '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    walletModalButtonSecondaryText: {
      color: theme.textColor,
      fontFamily: 'Geist-SemiBold',
      fontSize: 13,
    },
    walletModalButtonPrimary: {
      flex: 1,
      maxWidth: 150,
      minHeight: 40,
      borderRadius: 10,
      backgroundColor: theme.tintColor || theme.tileActiveBackgroundColor,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    walletModalButtonPrimaryText: {
      color: theme.tintTextColor || '#ffffff',
      fontFamily: 'Geist-SemiBold',
      fontSize: 13,
    },
  })
}
