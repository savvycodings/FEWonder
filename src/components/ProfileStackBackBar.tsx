import { useContext, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useNavigation } from '@react-navigation/native'
import { ThemeContext } from '../context'

const PREVIOUS_ROUTE_BACK_LABEL: Record<string, string> = {
  ProfileHome: 'Profile',
  ProfileSettings: 'Settings',
  ProfileMyOrders: 'My orders',
  ProfileCart: 'Profile',
  Saved: 'Profile',
  ProfileHeroEdit: 'Profile',
  AdminOrdersLogin: 'Settings',
  AdminOrdersHub: 'Settings',
  AdminOrderDetail: 'Orders',
  AdminUserOrders: 'Orders',
  AdminReportedMessages: 'Settings',
  Tabs: 'Home',
  Product: 'Product',
  Cart: 'Shopping cart',
  CheckoutDelivery: 'Delivery & contact',
  CartCheckout: 'Checkout',
}

export function resolveProfileStackBackLabel(navigation: { getState: () => unknown }): string {
  const state = navigation.getState() as { index?: number; routes?: { name: string }[] } | undefined
  const idx = state?.index ?? 0
  const routes = state?.routes ?? []
  if (idx > 0) {
    const prevName = routes[idx - 1]?.name
    if (prevName && PREVIOUS_ROUTE_BACK_LABEL[prevName]) {
      return PREVIOUS_ROUTE_BACK_LABEL[prevName]
    }
  }
  return 'Profile'
}

type ProfileStackBackBarProps = {
  backLabel?: string
  onBack?: () => void
}

/** Chevron + label at top of profile-stack screens (reliable on production builds). */
export function ProfileStackBackBar({ backLabel, onBack }: ProfileStackBackBarProps) {
  const navigation = useNavigation<any>()
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const label = backLabel ?? resolveProfileStackBackLabel(navigation)
  const tint = theme.textColor || '#111111'

  return (
    <View style={styles.bar}>
      <Pressable
        style={styles.backButton}
        onPress={onBack ?? (() => navigation.goBack())}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${label}`}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 12 }}
      >
        <FeatherIcon name="chevron-left" size={22} color={tint} />
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </View>
  )
}

function getStyles(theme: any) {
  const pageBg = theme.appBackgroundColor || theme.backgroundColor
  return StyleSheet.create({
    bar: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 8,
      backgroundColor: pageBg,
      borderBottomWidth: 0,
      ...(Platform.OS === 'android'
        ? { elevation: 0 }
        : {
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
          }),
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingRight: 8,
      gap: 2,
    },
    label: {
      fontSize: 17,
      fontFamily: theme.regularFont,
    },
  })
}
