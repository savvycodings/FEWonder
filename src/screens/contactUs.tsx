import { useContext, useMemo } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ProfilePageHeading, ProfileStackBackBar } from '../components'
import { ThemeContext } from '../context'
import { brandAccentRgba } from '../brandAccent'
import { openEmailAddress, openPhoneNumber } from '../contactLink'

export const CONTACT_EMAIL = 'info@wonderporthobbies.com'
export const CONTACT_PHONE_DISPLAY = '+27 71 294 7615'
const CONTACT_PHONE_DIAL = '+27712947615'

async function copyValue(label: string, value: string) {
  await Clipboard.setStringAsync(value)
  Alert.alert('Copied', `${label} copied to clipboard.`)
}

export function ContactUs() {
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => getStyles(theme), [theme])
  const contentBottomPad = 32 + insets.bottom

  return (
    <View style={styles.page}>
      <ProfileStackBackBar backLabel="Profile" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ProfilePageHeading title="Contact us" flush />

        <Text style={styles.lead}>
          Need help with an order, your account, deliveries, or anything else on WonderPort?
        </Text>
        <Text style={styles.leadFollow}>
          Reach out anytime. We are happy to assist!
        </Text>

        <View style={styles.card}>
          <View style={styles.contactRow}>
            <Pressable
              style={styles.contactMain}
              onPress={() => void openEmailAddress(CONTACT_EMAIL)}
              accessibilityRole="button"
              accessibilityLabel={`Email ${CONTACT_EMAIL}`}
            >
              <View style={styles.contactIconWrap}>
                <FeatherIcon name="mail" size={20} color={theme.brandAccent} />
              </View>
              <Text
                style={styles.contactValue}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {CONTACT_EMAIL}
              </Text>
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() => void copyValue('Email', CONTACT_EMAIL)}
              accessibilityRole="button"
              accessibilityLabel="Copy email"
            >
              <FeatherIcon name="copy" size={18} color={theme.mutedForegroundColor} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.contactRow}>
            <Pressable
              style={styles.contactMain}
              onPress={() => void openPhoneNumber(CONTACT_PHONE_DISPLAY, CONTACT_PHONE_DIAL)}
              accessibilityRole="button"
              accessibilityLabel={`Phone ${CONTACT_PHONE_DISPLAY}`}
            >
              <View style={styles.contactIconWrap}>
                <FeatherIcon name="phone" size={20} color={theme.brandAccent} />
              </View>
              <Text style={styles.contactValue}>{CONTACT_PHONE_DISPLAY}</Text>
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() => void copyValue('Phone number', CONTACT_PHONE_DISPLAY)}
              accessibilityRole="button"
              accessibilityLabel="Copy phone number"
            >
              <FeatherIcon name="copy" size={18} color={theme.mutedForegroundColor} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

function getStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    },
    flex: { flex: 1 },
    content: {
      paddingHorizontal: 14,
    },
    lead: {
      color: theme.textColor,
      fontFamily: theme.regularFont,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 10,
    },
    leadFollow: {
      color: theme.textColor,
      fontFamily: theme.regularFont,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 22,
    },
    card: {
      borderRadius: 14,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderWidth: 1,
      borderColor: L(0.3),
      overflow: 'hidden',
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 14,
      paddingRight: 10,
      paddingVertical: 14,
      gap: 4,
    },
    contactMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
      marginRight: 0,
    },
    contactIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: L(0.12),
      borderWidth: 1,
      borderColor: L(0.22),
    },
    contactValue: {
      flex: 1,
      flexShrink: 1,
      color: theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      minWidth: 0,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: L(0.25),
      marginHorizontal: 14,
    },
  })
}
