import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { ThemeContext } from '../context'

export type NotificationItem = {
  id: string
  title: string
  text: string
  time: string
  type: 'special' | 'reminder' | 'message'
  route: string
  params?: any
}

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
  onPress,
  onDismiss,
}: {
  item: NotificationItem
  theme: any
  rowStyles: ReturnType<typeof getNotificationStyles>
  onPress: () => void
  onDismiss: () => void
}) {
  const translateX = useSharedValue(0)
  const rowOpacity = useSharedValue(1)
  const rowWidth = useSharedValue(280)
  const startX = useSharedValue(0)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const fireDismiss = () => {
    onDismissRef.current()
  }

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-22, 22])
        .onBegin(() => {
          startX.value = translateX.value
        })
        .onUpdate((e) => {
          const max = Math.max(120, rowWidth.value)
          translateX.value = clamp(startX.value + e.translationX, -max, max)
        })
        .onEnd((e) => {
          const threshold = 64
          const v = Math.abs(e.velocityX)
          const dismiss =
            Math.abs(translateX.value) > threshold || (v > 520 && Math.abs(translateX.value) > 28)
          if (dismiss) {
            const dir = translateX.value >= 0 ? 1 : -1
            const travel = Math.max(240, rowWidth.value + 28)
            translateX.value = withTiming(dir * travel, { duration: 185 })
            rowOpacity.value = withTiming(0, { duration: 185 }, (finished) => {
              if (finished) runOnJS(fireDismiss)()
            })
          } else {
            translateX.value = withSpring(0, {
              damping: 24,
              stiffness: 320,
              mass: 0.65,
              velocity: e.velocityX,
            })
          }
        }),
    []
  )

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: rowOpacity.value,
  }))

  const notificationTypeStyle =
    item.type === 'special'
      ? rowStyles.notificationItemTypeSpecial
      : item.type === 'message'
        ? rowStyles.notificationItemTypeMessage
        : rowStyles.notificationItemTypeReminder
  const notificationRowStyle =
    item.type === 'special'
      ? rowStyles.notificationItemSpecial
      : item.type === 'message'
        ? rowStyles.notificationItemMessage
        : rowStyles.notificationItemReminder

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(ev) => {
          rowWidth.value = ev.nativeEvent.layout.width
        }}
        style={animStyle}
      >
        <Pressable onPress={onPress} style={[rowStyles.notificationItem, notificationRowStyle]}>
          <View style={rowStyles.notificationItemHeader}>
            <View style={rowStyles.notificationItemMeta}>
              <View style={[rowStyles.notificationItemType, notificationTypeStyle]}>
                {item.type === 'special' ? (
                  <Text style={rowStyles.notificationEmojiFire}>🔥</Text>
                ) : item.type === 'message' ? (
                  <FeatherIcon name="message-circle" size={16} color={theme.secondaryTextColor} />
                ) : (
                  <FeatherIcon name="bell" size={16} color={theme.secondaryTextColor} />
                )}
              </View>
              <Text style={rowStyles.notificationItemTitle}>{item.title}</Text>
            </View>
            <Text style={rowStyles.notificationItemTime}>{item.time}</Text>
          </View>
          <Text style={rowStyles.notificationItemText}>{item.text}</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  )
}

const MemoSwipeNotificationRow = memo(SwipeNotificationRow)

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
  const rowStyles = useMemo(() => getNotificationStyles(theme), [theme])

  const baseNotifications = useMemo<NotificationItem[]>(
    () => [
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

  const openNotification = (item: { id: string; route: string; params?: any }) => {
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
      if (item.params !== undefined) navigation.navigate(item.route as never, item.params as never)
      else navigation.navigate(item.route as never)
    }, 25)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={rowStyles.notificationsBackdrop} onPress={onClose}>
        <Pressable style={rowStyles.notificationsCard} onPress={() => {}}>
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
                  onPress={() => openNotification(item)}
                  onDismiss={() => setNotifications((prev) => prev.filter((n) => n.id !== item.id))}
                />
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function getNotificationStyles(theme: any) {
  const railDefault = theme.contentAccentBorderColor || theme.tintColor || theme.tileBorderColor
  return StyleSheet.create({
    notificationsBackdrop: {
      flex: 1,
      backgroundColor: theme.modalOverlayColor || 'rgba(8, 13, 26, 0.46)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    notificationsCard: {
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
      fontFamily: theme.boldFont,
      fontSize: 18,
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
      borderLeftColor: railDefault,
      backgroundColor: theme.sheetRowBackgroundColor || theme.tileBackgroundColor || '#ffffff',
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    notificationItemSpecial: {
      borderLeftColor: theme.tileActiveBackgroundColor || theme.tintColor || railDefault,
    },
    notificationItemMessage: {
      borderLeftColor: theme.contentAccentBorderColor || theme.tintColor || railDefault,
    },
    notificationItemReminder: {
      borderLeftColor: theme.contentAccentBorderColor || theme.tintColor || railDefault,
    },
    notificationItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    notificationItemMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flexShrink: 1,
    },
    notificationItemType: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 1,
    },
    notificationItemTypeSpecial: {
      backgroundColor: theme.tileActiveBackgroundColor || '#ff00ff',
    },
    notificationItemTypeMessage: {
      backgroundColor: theme.tintColor || theme.tileBackgroundColor,
    },
    notificationItemTypeReminder: {
      backgroundColor: theme.tintColor || theme.tileBackgroundColor,
    },
    notificationEmojiFire: {
      fontSize: 18,
      lineHeight: 18,
    },
    notificationItemTitle: {
      color: theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 13,
    },
    notificationItemTime: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 11,
      marginLeft: 8,
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
