import { memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { clamp, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { ThemeContext } from '../context'

export type NotificationItem = {
  id: string
  title: string
  text: string
  time: string
  type: 'special' | 'reminder' | 'message'
  route: string
  params?: any
  /** When false, row cannot be swiped away (stub / framework rows). */
  dismissable?: boolean
}

/** Same lime as home/search price pills — left “rail” on notification tiles. */
const NOTIFICATION_RAIL_ACCENT = '#CBFF00'

/** Feather icons are stroke-based; white reads as a light “outline” on dark rows. */
const NOTIFICATION_ICON_COLOR = '#ffffff'
const NOTIFICATION_ICON_SIZE = 23

/** Registered in `App.tsx` via `@expo-google-fonts/montserrat` (matches home hero). */
const NOTIFICATIONS_TITLE_FONT = 'Montserrat_700Bold' as const

/** Demo deep-link product; shape matches Product screen + cart/saved keys. */
const vaultPopProduct = {
  id: 'demo-vault-pop',
  handle: 'vault-pop',
  title: 'Vault Pop',
  featuredImageUrl: null as string | null,
  image: require('../../public/homepageimgs/product1.webp'),
  price: { amount: '14.99', currencyCode: 'ZAR' },
  productType: 'Collectible',
}

function SwipeNotificationRow({
  item,
  theme,
  rowStyles,
  swipeClampPx,
  onOpenById,
  onDismissById,
}: {
  item: NotificationItem
  theme: any
  rowStyles: ReturnType<typeof getNotificationStyles>
  /** Max horizontal drag from center; derived from layout math (no per-frame onLayout). */
  swipeClampPx: number
  onOpenById: (id: string) => void
  onDismissById: (id: string) => void
}) {
  const translateX = useSharedValue(0)
  const rowOpacity = useSharedValue(1)
  const startX = useSharedValue(0)
  const notificationId = item.id
  const dismissable = item.dismissable !== false

  const fireDismiss = useCallback(() => {
    onDismissById(notificationId)
  }, [onDismissById, notificationId])

  const openJs = useCallback(() => {
    onOpenById(notificationId)
  }, [onOpenById, notificationId])

  const gesture = useMemo(() => {
    if (!dismissable) {
      return Gesture.Tap().onEnd((_e, success) => {
        if (success) {
          runOnJS(openJs)()
        }
      })
    }
    return (
      Gesture.Pan()
        // Prefer horizontal intent early so parent Pressables / slow drags stay on the UI thread.
        .activeOffsetX([-12, 12])
        .failOffsetY([-20, 20])
        .onBegin(() => {
          startX.value = translateX.value
        })
        .onUpdate((e) => {
          const max = Math.max(120, swipeClampPx)
          translateX.value = clamp(startX.value + e.translationX, -max, max)
        })
        .onEnd((e) => {
          const tx = translateX.value
          const threshold = 64
          const v = Math.abs(e.velocityX)
          const dismiss = Math.abs(tx) > threshold || (v > 520 && Math.abs(tx) > 28)
          if (dismiss) {
            const dir = tx >= 0 ? 1 : -1
            const travel = Math.max(240, swipeClampPx + 28)
            translateX.value = withTiming(dir * travel, { duration: 160 })
            rowOpacity.value = withTiming(0, { duration: 160 }, (finished) => {
              if (finished) runOnJS(fireDismiss)()
            })
          } else {
            translateX.value = withTiming(0, { duration: 180 })
            const tapSlop = 10
            if (
              Math.abs(tx) <= tapSlop &&
              Math.abs(e.translationX) <= tapSlop &&
              Math.abs(e.translationY) <= tapSlop &&
              v < 220
            ) {
              runOnJS(openJs)()
            }
          }
        })
    )
  }, [dismissable, fireDismiss, openJs, swipeClampPx])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: rowOpacity.value,
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animStyle}>
        <View style={rowStyles.notificationItem}>
          <View style={rowStyles.notificationItemRow}>
            <View style={rowStyles.notificationItemType}>
              {item.type === 'special' ? (
                <Text style={rowStyles.notificationEmojiFire}>🔥</Text>
              ) : item.type === 'message' ? (
                <FeatherIcon
                  name="message-circle"
                  size={NOTIFICATION_ICON_SIZE}
                  color={NOTIFICATION_ICON_COLOR}
                />
              ) : (
                <FeatherIcon name="bell" size={NOTIFICATION_ICON_SIZE} color={NOTIFICATION_ICON_COLOR} />
              )}
            </View>
            <View style={rowStyles.notificationItemBody}>
              <View style={rowStyles.notificationItemTitleRow}>
                <Text style={rowStyles.notificationItemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={rowStyles.notificationItemTime}>{item.time}</Text>
              </View>
              <Text style={rowStyles.notificationItemText}>{item.text}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

const MemoSwipeNotificationRow = memo(SwipeNotificationRow, (a, b) => {
  return (
    a.item.id === b.item.id &&
    a.item.title === b.item.title &&
    a.item.text === b.item.text &&
    a.item.time === b.item.time &&
    a.item.type === b.item.type &&
    a.item.dismissable === b.item.dismissable &&
    a.swipeClampPx === b.swipeClampPx &&
    a.onDismissById === b.onDismissById &&
    a.onOpenById === b.onOpenById &&
    a.theme === b.theme &&
    a.rowStyles === b.rowStyles
  )
})

type NotificationsModalProps = {
  visible: boolean
  onClose: () => void
  navigation: any
  sessionToken: string
}

export function NotificationsModal({
  visible,
  onClose,
  navigation,
  sessionToken,
}: NotificationsModalProps) {
  const { theme } = useContext(ThemeContext)
  const { width: windowWidth } = useWindowDimensions()
  const rowStyles = useMemo(() => getNotificationStyles(theme), [theme])

  /** Card max 420 + horizontal padding; avoids onLayout on every row during swipe. */
  const swipeClampPx = useMemo(() => {
    const cardOuter = Math.min(420, windowWidth - 44)
    return Math.max(120, cardOuter - 28)
  }, [windowWidth])

  const baseNotifications = useMemo<NotificationItem[]>(
    () => [
      {
        id: 'n-chats-community',
        title: 'New chats',
        text: 'You have new messages in Wonderport Community.',
        time: 'Now',
        type: 'message',
        route: 'Chat',
        params: undefined,
      },
      {
        id: 'n1',
        title: 'Weekend Special',
        text: 'New drops just landed. Check today’s featured collectibles.',
        time: '2m ago',
        type: 'special',
        route: 'Product',
        params: { product: vaultPopProduct },
      },
      {
        id: 'n2',
        title: 'Daily Reward Reminder',
        text: 'You have an unclaimed reward waiting in Daily Rewards.',
        time: '18m ago',
        type: 'reminder',
        route: 'DailyRewards',
        params: { sessionToken },
      },
      {
        id: 'n3',
        title: 'Wonder Jump',
        text: 'Play the endless runner and chase a new high score.',
        time: '1h ago',
        type: 'message',
        route: 'WonderJump',
        params: undefined,
      },
    ],
    [sessionToken]
  )

  const [notifications, setNotifications] = useState<NotificationItem[]>(baseNotifications)

  useEffect(() => {
    if (visible) {
      setNotifications(baseNotifications)
    }
  }, [visible, baseNotifications])

  const dismissNotificationById = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const openNotification = useCallback(
    (item: { id: string; route: string; params?: any }) => {
      onClose()
      setTimeout(() => {
        if (item.route === 'WonderJump') {
          const tabNav = navigation.getParent?.()
          const rootNav = tabNav?.getParent?.()
          ;(rootNav ?? tabNav ?? navigation).navigate('WonderJump' as never)
          return
        }
        if (item.route === 'Chat') {
          navigation.getParent?.()?.navigate('Chat' as never)
          return
        }
        if (item.route === 'DailyRewards') {
          navigation.getParent?.()?.navigate('Home', {
            screen: 'DailyRewards',
            params: item.params ?? { sessionToken },
          })
          return
        }
        if (item.params !== undefined) navigation.navigate(item.route as never, item.params as never)
        else navigation.navigate(item.route as never)
      }, 25)
    },
    [navigation, onClose]
  )

  const openById = useCallback(
    (id: string) => {
      const item = notifications.find((n) => n.id === id)
      if (item) openNotification(item)
    },
    [notifications, openNotification]
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={rowStyles.modalGestureRoot}>
        <View style={rowStyles.notificationsBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityRole="button" />
          <View style={rowStyles.notificationsCard}>
            <View style={rowStyles.notificationsHeader}>
              <Text style={rowStyles.notificationsTitle}>Notifications</Text>
              <Pressable
                style={(state) => [
                  rowStyles.notificationsClose,
                  state.pressed || (state as { hovered?: boolean }).hovered
                    ? rowStyles.notificationsCloseActive
                    : null,
                ]}
                onPress={onClose}
              >
                <FeatherIcon name="x" size={18} color={theme.textColor} />
              </Pressable>
            </View>

            {notifications.length === 0 ? (
              <Text style={rowStyles.notificationsEmpty}>No notifications right now</Text>
            ) : (
              <View style={rowStyles.notificationsList}>
                {notifications.map((item) => (
                  <MemoSwipeNotificationRow
                    key={item.id}
                    item={item}
                    theme={theme}
                    rowStyles={rowStyles}
                    swipeClampPx={swipeClampPx}
                    onOpenById={openById}
                    onDismissById={dismissNotificationById}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

function getNotificationStyles(theme: any) {
  return StyleSheet.create({
    modalGestureRoot: {
      flex: 1,
    },
    notificationsBackdrop: {
      flex: 1,
      backgroundColor: theme.modalOverlayColor || 'rgba(8, 13, 26, 0.46)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    notificationsCard: {
      zIndex: 1,
      elevation: 6,
      width: '100%',
      maxWidth: 420,
      minHeight: 360,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || '#ffffff',
      backgroundColor: theme.sheetBackgroundColor || theme.tileActiveBackgroundColor || '#111111',
      paddingHorizontal: 14,
      paddingVertical: 12,
      shadowColor: '#0f1f46',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      gap: 10,
      overflow: 'hidden',
    },
    notificationsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    notificationsTitle: {
      color: theme.textColor,
      fontFamily: NOTIFICATIONS_TITLE_FONT,
      fontSize: 18,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    notificationsClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || 'rgba(255,255,255,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.tileBackgroundColor || 'rgba(255,255,255,0.08)',
    },
    notificationsCloseActive: {
      backgroundColor: '#d92d20',
      borderColor: '#f7b2aa',
    },
    notificationsList: {
      gap: 8,
      marginHorizontal: -14,
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 2,
    },
    notificationItem: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.tileBorderColor || 'rgba(0,0,0,0.18)',
      borderLeftWidth: 4,
      borderLeftColor: NOTIFICATION_RAIL_ACCENT,
      backgroundColor: theme.sheetRowBackgroundColor || theme.tileBackgroundColor || '#ffffff',
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    notificationItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationItemBody: {
      flex: 1,
      minWidth: 0,
    },
    notificationItemTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 4,
    },
    notificationItemType: {
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      minWidth: 30,
    },
    notificationEmojiFire: {
      fontSize: 22,
      lineHeight: 24,
    },
    notificationItemTitle: {
      flex: 1,
      color: theme.textColor,
      fontFamily: NOTIFICATIONS_TITLE_FONT,
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    notificationItemTime: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 11,
      flexShrink: 0,
    },
    notificationItemText: {
      color: theme.textColor,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      lineHeight: 16,
    },
    notificationsEmpty: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 16,
    },
  })
}
