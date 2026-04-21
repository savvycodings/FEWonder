import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { useContext } from 'react'
import { useNavigation } from '@react-navigation/native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { User } from '../../types'

/** Keep code paths available for future use, but hidden in UI for now. */
const SHOW_THEME_SECTION = false
const SHOW_CHAT_MODEL_SECTION = false
const SHOW_IMAGE_MODEL_SECTION = false
const ACCENT = '#CBFF00'

type SettingsProps = {
  user: User
  sessionToken: string
  onUserUpdated: (user: User) => Promise<void>
}

export function Settings({ user, sessionToken, onUserUpdated }: SettingsProps) {
  const navigation = useNavigation<any>()
  const { theme } = useContext(ThemeContext)

  const styles = getStyles(theme)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.pageTitle}>Settings</Text>
      <Text style={styles.pageSubtitle}>Manage your account information and billing preferences.</Text>
      <View style={styles.accentRule} />

      <View style={styles.sectionCard}>
        <Pressable
          style={[styles.bannerRow, styles.rowGap]}
          onPress={() => navigation.navigate('ProfileAccountSettings')}
        >
          <View style={styles.leftWrap}>
            <View style={styles.iconBubble}>
              <FeatherIcon name="user" size={17} color={theme.tintColor} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.rowTitle}>Profile</Text>
              <Text style={styles.rowSub}>{user.fullName || user.email}</Text>
            </View>
          </View>
          <FeatherIcon name="chevron-right" size={18} color={theme.tintColor} />
        </Pressable>

        <Pressable
          style={[styles.bannerRow, styles.rowGap]}
          onPress={() => navigation.navigate('Shipping')}
        >
          <View style={styles.leftWrap}>
            <View style={styles.iconBubble}>
              <FeatherIcon name="map-pin" size={17} color={theme.tintColor} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.rowTitle}>Shipping address</Text>
              <Text style={styles.rowSub}>
                {user.shippingAddress?.trim() || 'Add where we should deliver your orders'}
              </Text>
            </View>
          </View>
          <FeatherIcon name="chevron-right" size={18} color={theme.tintColor} />
        </Pressable>

        <Pressable
          style={styles.bannerRow}
          onPress={() => navigation.navigate('Payment')}
        >
          <View style={styles.leftWrap}>
            <View style={styles.iconBubble}>
              <FeatherIcon name="credit-card" size={17} color={theme.tintColor} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.rowTitle}>Payments & billing</Text>
              <Text style={styles.rowSub}>
                {user.eftBankName?.trim() || user.phone?.trim() || 'Manage EFT and billing details'}
              </Text>
            </View>
          </View>
          <FeatherIcon name="chevron-right" size={18} color={theme.tintColor} />
        </Pressable>
      </View>

      {SHOW_THEME_SECTION ? (
        <View />
      ) : null}
      <View style={styles.titleContainer}>
        <Text style={styles.mainText}>Admin</Text>
      </View>
      <Pressable
        style={styles.chatChoiceButton}
        onPress={() => navigation.navigate('AdminOrdersLogin')}
      >
        <Text style={styles.chatTypeText}>View orders (Peach / EFT)</Text>
      </Pressable>
      {SHOW_CHAT_MODEL_SECTION ? (
        <View />
      ) : null}
      {SHOW_IMAGE_MODEL_SECTION ? (
        <View />
      ) : null}
    </ScrollView>
  )
}

const getStyles = (theme:any) => StyleSheet.create({
  buttonContainer: {
    marginBottom: 20
  },
  container: {
    flex: 1,
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
  },
  pageTitle: {
    marginTop: 12,
    marginBottom: 4,
    color: theme.headingColor || theme.textColor,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 30,
  },
  pageSubtitle: {
    marginBottom: 8,
    color: theme.mutedForegroundColor,
    fontFamily: theme.regularFont,
    fontSize: 13,
    lineHeight: 19,
  },
  accentRule: {
    width: 62,
    height: 4,
    borderRadius: 999,
    backgroundColor: ACCENT,
    marginBottom: 14,
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 40
  },
  titleContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 10
  },
  chatChoiceButton: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.28)',
    marginBottom: 18,
  },
  chatTypeText: {
    fontFamily: theme.semiBoldFont,
    color: theme.textColor
  },
  mainText: {
    fontFamily: theme.boldFont,
    fontSize: 18,
    color: theme.textColor
  },
  sectionCard: {
    borderRadius: 14,
    backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
    borderWidth: 2,
    borderColor: 'rgba(203,255,0,0.32)',
    padding: 12,
    marginBottom: 10,
  },
  bannerRow: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(203,255,0,0.24)',
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowGap: {
    marginBottom: 10,
  },
  leftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.textColor,
    fontFamily: theme.semiBoldFont,
    fontSize: 14,
  },
  rowSub: {
    color: theme.mutedForegroundColor,
    fontFamily: theme.regularFont,
    fontSize: 12,
    marginTop: 1,
  },
})