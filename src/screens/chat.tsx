import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import EventSource from 'react-native-sse'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { ThemeContext } from '../context'
import { CommunityMessage, User } from '../../types'
import { DOMAIN } from '../../constants'
import {
  deleteCommunityMessage,
  editCommunityMessage,
  getCommunityMessages,
  listDbProducts,
  sendCommunityMessage,
} from '../utils'
import { formatMoney } from '../money'
import { ShopifyProduct } from '../../types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  cancelAnimation,
  Easing,
  KeyboardState,
  runOnUI,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import { AvatarFrameWrapper, useEquippedAvatarFrame } from '../components'

const REF_ITEM_PREFIX = '__REF_ITEM__:'

/** Matches `TAB_SHELL_TOP_EXTRA` in `main.tsx` — cancels tab shell top padding so the hero sits flush. */
const TAB_SHELL_TOP_EXTRA = 6

/** Community chat palette: black canvas, lime-framed incoming bubbles, grey own bubbles + composer */
const CHAT_LIME = '#CBFF00'
const CHAT_BLACK = '#000000'
const CHAT_TILE_GREY = '#2d2d2d'

/** Gap above the floating tab bar when keyboard is hidden (clearance over the pill nav). */
const CHAT_ABOVE_TAB_BAR = 68

/** Approximate composer row height for list padding / stacking (attach + field + send). */
const COMPOSER_BAR_HEIGHT = 58

/** Extra px between the visible keyboard top and the composer bottom (0 = hug the adjusted frame). */
const KEYBOARD_GAP = 0

/** Small cushion above the composer row inside the scroll area (list + composer lift together). */
const LIST_SCROLL_TAIL = 8

/**
 * Pulls composer toward the visible keyboard (more negative = tighter).
 * Halved keyboard–dock gap vs prior -16/-10 step.
 */
const KEYBOARD_FRAME_NUDGE = Platform.select({ ios: -24, android: -15, default: -15 })!

/**
 * Keyboard lift: timing + easing keeps motion fluid and in-family with OS keyboard (~280ms),
 * without spring overshoot / micro-jitter from stiff springs.
 */
const CHAT_LIFT_TIMING = {
  duration: 280,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
}

/** Delay before the hero banner swipes up off-screen after opening Chat; dismiss animation duration. */
const HERO_DISMISS_DELAY_MS = 3000
const HERO_DISMISS_DURATION_MS = 580

/**
 * Composer `bottom` in screen space: idle above tab bar, or `keyboardHeight + gap` when typing.
 * Uses keyboard state so closing does not snap from ~gap px to the idle inset (common Reanimated pitfall).
 */
function composerDockBottomFromKeyboard(
  kb: number,
  keyboardState: KeyboardState,
  closedBottom: number,
  gap: number,
  frameNudge: number
) {
  'worklet'
  const lift = kb + frameNudge
  if (keyboardState === KeyboardState.CLOSED) {
    return closedBottom
  }
  if (keyboardState === KeyboardState.CLOSING) {
    return Math.max(closedBottom, lift + gap)
  }
  if (keyboardState === KeyboardState.OPENING && kb < 1) {
    return closedBottom
  }
  if (kb < 1 && keyboardState !== KeyboardState.OPEN) {
    return closedBottom
  }
  return lift + gap
}

/** Stored value is product `handle` (new); legacy messages may use `title`. */
function getReferenceToken(handle: string) {
  return `${REF_ITEM_PREFIX}${handle.trim()}`
}

function parseReferenceFromBody(body: string) {
  const lines = String(body || '').split('\n')
  const refLine = lines.find((line) => line.startsWith(REF_ITEM_PREFIX))
  const referenceKey = refLine ? refLine.slice(REF_ITEM_PREFIX.length).trim() : ''
  const cleanBody = lines.filter((line) => !line.startsWith(REF_ITEM_PREFIX)).join('\n').trim()
  return {
    cleanBody,
    referenceKey: referenceKey || null,
  }
}

function productImageSource(product: ShopifyProduct | null | undefined) {
  const url = product?.featuredImageUrl?.trim()
  if (url) return { uri: url }
  return null
}

function resolveReferencedProduct(key: string, catalog: ShopifyProduct[]) {
  const k = String(key || '').trim()
  if (!k || !catalog.length) return null
  return catalog.find((p) => p.handle === k) || catalog.find((p) => p.title === k) || null
}

export function Chat({
  user,
  sessionToken,
}: {
  user: User
  sessionToken: string
}) {
  const { theme } = useContext(ThemeContext)
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const styles = useMemo(() => getStyles(theme, insets), [theme, insets])
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showComposerMenu, setShowComposerMenu] = useState(false)
  const [editingMessage, setEditingMessage] = useState<CommunityMessage | null>(null)
  const [editInput, setEditInput] = useState('')
  const [editingBusy, setEditingBusy] = useState(false)
  const [activeOwnMessageId, setActiveOwnMessageId] = useState<string | null>(null)
  const [showReferencePicker, setShowReferencePicker] = useState(false)
  const [referenceSearch, setReferenceSearch] = useState('')
  const [catalogProducts, setCatalogProducts] = useState<ShopifyProduct[]>([])
  const [dbPickerProducts, setDbPickerProducts] = useState<ShopifyProduct[]>([])
  const [pendingReferenceItem, setPendingReferenceItem] = useState<ShopifyProduct | null>(null)
  const [pendingImage, setPendingImage] = useState<{
    uri: string
    base64: string
    mimeType: string
  } | null>(null)
  const listRef = useRef<FlatList<CommunityMessage> | null>(null)
  const { frameId: avatarFrameId, refresh: refreshAvatarFrame } = useEquippedAvatarFrame()

  const heroLayoutHeight = useSharedValue(108)
  const heroTranslateY = useSharedValue(0)
  /** Keeps messages below the banner — does not shrink when banner slides away (banner is an overlay). */
  const [messagesTopPad, setMessagesTopPad] = useState(108)

  useFocusEffect(
    useCallback(() => {
      refreshAvatarFrame()
    }, [refreshAvatarFrame])
  )

  useEffect(() => {
    loadInitialMessages()
    const es = connectStream()
    return () => es?.close()
  }, [sessionToken])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listDbProducts({ first: 120 })
        if (!cancelled) setCatalogProducts(list)
      } catch (error) {
        console.log('Failed to load catalog for community refs', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showReferencePicker) return
    let cancelled = false
    const q = referenceSearch.trim()
    const t = setTimeout(() => {
      ;(async () => {
        try {
          const list = await listDbProducts({ first: 48, query: q || undefined })
          if (!cancelled) setDbPickerProducts(list)
        } catch (error) {
          console.log('Failed to load products for reference picker', error)
          if (!cancelled) setDbPickerProducts([])
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [showReferencePicker, referenceSearch])

  useEffect(() => {
    if (!dbPickerProducts.length) return
    setCatalogProducts((prev) => {
      const byId = new Map<string, ShopifyProduct>()
      for (const p of prev) {
        const k = p.id || p.handle
        if (k) byId.set(k, p)
      }
      for (const p of dbPickerProducts) {
        const k = p.id || p.handle
        if (k) byId.set(k, p)
      }
      return Array.from(byId.values())
    })
  }, [dbPickerProducts])

  async function loadInitialMessages() {
    try {
      const history = await getCommunityMessages(sessionToken)
      setMessages(history)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50)
    } catch (error) {
      console.log('Failed to load community messages', error)
    } finally {
      setLoading(false)
    }
  }

  function connectStream() {
    if (!DOMAIN || !sessionToken) return null
    const es = new EventSource(`${DOMAIN}/community/stream`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
    const esAny = es as any

    esAny.addEventListener('history', (event: any) => {
      try {
        const history = JSON.parse(event.data) as CommunityMessage[]
        setMessages(history)
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50)
      } catch (error) {
        console.log('Failed to parse history event', error)
      }
    })

    esAny.addEventListener('message', (event: any) => {
      try {
        const message = JSON.parse(event.data) as CommunityMessage
        setMessages((prev) => [...prev, message])
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
      } catch (error) {
        console.log('Failed to parse message event', error)
      }
    })

    esAny.addEventListener('message_updated', (event: any) => {
      try {
        const message = JSON.parse(event.data) as CommunityMessage
        setMessages((prev) => prev.map((item) => (item.id === message.id ? message : item)))
      } catch (error) {
        console.log('Failed to parse message_updated event', error)
      }
    })

    esAny.addEventListener('message_deleted', (event: any) => {
      try {
        const payload = JSON.parse(event.data) as { id: string }
        setMessages((prev) => prev.filter((item) => item.id !== payload.id))
      } catch (error) {
        console.log('Failed to parse message_deleted event', error)
      }
    })

    esAny.addEventListener('error', (event: any) => {
      console.log('Community stream error', event?.message)
    })

    return es
  }

  async function onSend() {
    const body = input.trim()
    if ((!body && !pendingImage && !pendingReferenceItem) || sending) return

    setSending(true)
    setInput('')
    const imageToSend = pendingImage
    const referenceToSend = pendingReferenceItem
    setPendingImage(null)
    setPendingReferenceItem(null)
    try {
      const bodyWithReference = referenceToSend
        ? [body, getReferenceToken(referenceToSend.handle)].filter(Boolean).join('\n')
        : body
      await sendCommunityMessage({
        sessionToken,
        body: bodyWithReference,
        imageBase64: imageToSend?.base64,
        mimeType: imageToSend?.mimeType,
      })
    } catch (error) {
      console.log('Failed to send community message', error)
      setInput(body)
      if (imageToSend) {
        setPendingImage(imageToSend)
      }
      if (referenceToSend) {
        setPendingReferenceItem(referenceToSend)
      }
    } finally {
      setSending(false)
    }
  }

  function openComposerActions() {
    setShowComposerMenu(true)
  }

  function handleComposerOption(option: 'image' | 'reference' | 'report') {
    setShowComposerMenu(false)
    if (option === 'image') {
      pickImageForMessage()
    } else if (option === 'reference') {
      setReferenceSearch('')
      setShowReferencePicker(true)
    } else {
      console.log('Report message selected')
    }
  }

  async function pickImageForMessage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    })
    if (picked.canceled || !picked.assets?.[0]?.base64) return

    const asset = picked.assets[0]
    setPendingImage({
      uri: asset.uri,
      base64: String(asset.base64),
      mimeType: asset.mimeType || 'image/jpeg',
    })
  }

  function getAvatarUri(item: CommunityMessage, isMe: boolean) {
    if (isMe) {
      return user.profilePicture || null
    }

    const incoming = item.user as CommunityMessage['user'] & {
      profile_picture?: string | null
    }
    return incoming.profilePicture || incoming.profile_picture || null
  }

  function openOwnMessageActions(item: CommunityMessage) {
    setActiveOwnMessageId((prev) => (prev === item.id ? null : item.id))
  }

  function beginEditForMessage(item: CommunityMessage) {
    setActiveOwnMessageId(null)
    setEditingMessage(item)
    setEditInput(item.body || '')
  }

  async function confirmDeleteForMessage(item: CommunityMessage) {
    if (editingBusy) return
    setEditingBusy(true)
    try {
      await deleteCommunityMessage({
        sessionToken,
        messageId: item.id,
      })
      setMessages((prev) => prev.filter((msg) => msg.id !== item.id))
      setActiveOwnMessageId(null)
      Alert.alert('Deleted', 'Your message was successfully deleted.')
    } catch (error) {
      console.log('Failed to delete message', error)
    } finally {
      setEditingBusy(false)
    }
  }

  async function saveEditedMessage() {
    if (!editingMessage || editingBusy) return
    const nextBody = editInput.trim()
    if (!nextBody) return
    setEditingBusy(true)
    try {
      const updated = await editCommunityMessage({
        sessionToken,
        messageId: editingMessage.id,
        body: nextBody,
      })
      setMessages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setEditingMessage(null)
      setEditInput('')
      setActiveOwnMessageId(null)
    } catch (error) {
      console.log('Failed to edit message', error)
    } finally {
      setEditingBusy(false)
    }
  }

  const pageBg = { backgroundColor: CHAT_BLACK }
  const heroBleedWidth = windowWidth + insets.left + insets.right
  const closedComposerBottom = useMemo(
    () => insets.bottom + CHAT_ABOVE_TAB_BAR,
    [insets.bottom]
  )

  const keyboard = useAnimatedKeyboard()
  const chatLiftY = useSharedValue(0)

  useAnimatedReaction(
    () => {
      const kb = keyboard.height.value
      const st = keyboard.state.value
      const dockBottom = composerDockBottomFromKeyboard(
        kb,
        st,
        closedComposerBottom,
        KEYBOARD_GAP,
        KEYBOARD_FRAME_NUDGE
      )
      return -(dockBottom - closedComposerBottom)
    },
    (targetY) => {
      chatLiftY.value = withTiming(targetY, CHAT_LIFT_TIMING)
    },
    [closedComposerBottom]
  )

  const chatGroupLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chatLiftY.value }],
  }))

  const onHeroLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height
      if (h <= 0) return
      heroLayoutHeight.value = h
      setMessagesTopPad(h + 12)
    },
    [heroLayoutHeight]
  )

  useFocusEffect(
    useCallback(() => {
      cancelAnimation(heroTranslateY)
      heroTranslateY.value = 0

      const timer = setTimeout(() => {
        runOnUI(() => {
          'worklet'
          const H = heroLayoutHeight.value
          if (H <= 1) return
          heroTranslateY.value = withTiming(-H, {
            duration: HERO_DISMISS_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          })
        })()
      }, HERO_DISMISS_DELAY_MS)

      return () => {
        clearTimeout(timer)
        cancelAnimation(heroTranslateY)
        heroTranslateY.value = 0
      }
    }, [])
  )

  const heroOverlayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: heroTranslateY.value }],
  }))

  const menuAnchorBottom = closedComposerBottom + COMPOSER_BAR_HEIGHT + 6

  return (
    <Pressable style={[styles.container, pageBg]} onPress={() => setActiveOwnMessageId(null)}>
      <View style={[styles.chatShell, pageBg]}>
      <Animated.View
        style={[
          styles.chatKeyboardGroup,
          chatGroupLiftStyle,
          { paddingBottom: closedComposerBottom },
        ]}
      >
      <View style={styles.chatMain}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={CHAT_LIME} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.messagesList}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            styles.listScrollPad,
            { paddingTop: messagesTopPad },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          removeClippedSubviews={false}
          renderItem={({ item }) => {
            const isMe = item.user.id === user.id
            const showOwnActions = isMe && activeOwnMessageId === item.id
            const avatarUri = getAvatarUri(item, isMe)
            const initial = (item.user.fullName || 'U').slice(0, 1).toUpperCase()
            return (
              <View style={[styles.messageShell, isMe ? styles.meShell : styles.otherShell]}>
                {!isMe ? (
                  <View style={styles.avatarBubble}>
                    <AvatarFrameWrapper
                      frameId={avatarFrameId}
                      size={34}
                      fit="chat"
                      innerBackgroundColor={
                        avatarUri ? 'transparent' : CHAT_TILE_GREY
                      }
                    >
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarText}>{initial}</Text>
                      )}
                    </AvatarFrameWrapper>
                  </View>
                ) : null}
                <Pressable
                  style={[styles.messageRow, isMe ? styles.meRow : styles.otherRow]}
                  onPress={(event) => {
                    event.stopPropagation()
                    if (isMe) {
                      openOwnMessageActions(item)
                    } else {
                      setActiveOwnMessageId(null)
                    }
                  }}
                >
                  {(() => {
                    const { cleanBody, referenceKey } = parseReferenceFromBody(item.body || '')
                    const referencedProduct = referenceKey
                      ? resolveReferencedProduct(referenceKey, catalogProducts)
                      : null
                    const refImage = referencedProduct ? productImageSource(referencedProduct) : null
                    return (
                      <>
                  <Text style={[styles.authorLabel, isMe ? styles.authorLabelMe : styles.authorLabelOtherOnDark]}>
                    {isMe ? 'You' : item.user.fullName}
                  </Text>
                  {item.imageUrl ? (
                    <View style={styles.messageImageFrame}>
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}
                        {referencedProduct ? (
                          <Pressable
                            style={[styles.referencedItemCard, styles.referencedItemCardMe]}
                            onPress={() => navigation.navigate('Product', { product: referencedProduct })}
                          >
                            <View style={[styles.referencedItemImageWrap, styles.referencedItemImageWrapMe]}>
                              {refImage ? (
                                <Image source={refImage} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                              ) : (
                                <View style={styles.referencedItemImagePlaceholder}>
                                  <Text
                                    numberOfLines={2}
                                    style={[styles.referencedItemPlaceholderText, styles.referencedItemPlaceholderTextMe]}
                                  >
                                    {referencedProduct.title}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text numberOfLines={2} style={[styles.referencedItemName, styles.referencedItemNameMe]}>
                              {referencedProduct.title}
                            </Text>
                            {referencedProduct.price?.amount ? (
                              <Text style={[styles.referencedItemPrice, styles.referencedItemPriceMe]}>
                                {formatMoney(referencedProduct.price)}
                              </Text>
                            ) : null}
                          </Pressable>
                        ) : referenceKey ? (
                          <View style={[styles.referencedItemFallback, styles.referencedItemFallbackMe]}>
                            <Text
                              numberOfLines={2}
                              style={[styles.referencedItemFallbackText, styles.referencedItemFallbackTextMe]}
                            >
                              Item (unavailable): {referenceKey}
                            </Text>
                          </View>
                        ) : null}
                        {cleanBody ? (
                          <Text style={[styles.bodyText, isMe ? styles.meBodyText : styles.otherBodyText]}>
                            {cleanBody}
                          </Text>
                        ) : null}
                      </>
                    )
                  })()}
                  {showOwnActions ? (
                    <View style={styles.inlineActionRow}>
                      <Pressable
                        style={styles.inlineActionButton}
                        onPress={(event) => {
                          event.stopPropagation()
                          beginEditForMessage(item)
                        }}
                      >
                        <Text style={styles.inlineActionText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.inlineActionButton, styles.inlineDeleteButton]}
                        onPress={(event) => {
                          event.stopPropagation()
                          confirmDeleteForMessage(item)
                        }}
                      >
                        <Text style={[styles.inlineActionText, styles.inlineDeleteText]}>Delete</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Pressable>
                {isMe ? (
                  <View style={styles.avatarBubble}>
                    <AvatarFrameWrapper
                      frameId={avatarFrameId}
                      size={34}
                      fit="chat"
                      innerBackgroundColor={
                        avatarUri ? 'transparent' : CHAT_TILE_GREY
                      }
                    >
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(user.fullName || 'Y').slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </AvatarFrameWrapper>
                  </View>
                ) : null}
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>Start the first community message.</Text>
            </View>
          }
        />
      )}
      </View>

      {(pendingImage || pendingReferenceItem) ? (
        <View style={styles.pendingThumbnailRow}>
          {pendingImage ? (
            <View style={styles.pendingImageCard}>
              <Image source={{ uri: pendingImage.uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              <Pressable style={styles.removePendingImage} onPress={() => setPendingImage(null)}>
                <FeatherIcon name="x" size={12} color="#243056" />
              </Pressable>
            </View>
          ) : null}
          {pendingReferenceItem ? (
            <View style={styles.pendingReferenceCard}>
              <View style={styles.pendingReferenceImageFrame}>
                {productImageSource(pendingReferenceItem) ? (
                  <Image
                    source={productImageSource(pendingReferenceItem)!}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.pendingReferenceImagePlaceholder}>
                    <Text numberOfLines={2} style={styles.pendingReferencePlaceholderLabel}>
                      {pendingReferenceItem.title}
                    </Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={styles.pendingReferenceText}>
                {pendingReferenceItem.title}
              </Text>
              <Pressable style={styles.removePendingReference} onPress={() => setPendingReferenceItem(null)}>
                <FeatherIcon name="x" size={12} color="#243056" />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.composerDock}>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachButton} onPress={openComposerActions}>
            <FeatherIcon name="link-2" size={16} color={CHAT_LIME} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Message community"
            placeholderTextColor="#888888"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.sendButton} onPress={onSend} disabled={sending}>
            <FeatherIcon name="send" size={16} color={CHAT_BLACK} style={styles.sendIcon} />
          </TouchableOpacity>
        </View>
      </View>

      {showComposerMenu ? (
        <>
          <Pressable style={styles.menuDismissOverlay} onPress={() => setShowComposerMenu(false)} />
          <View style={[styles.menuAnchorWrap, { bottom: menuAnchorBottom }]}>
            <View style={styles.menuCard}>
              <Pressable style={styles.menuRow} onPress={() => handleComposerOption('image')}>
                <Text style={styles.menuText}>Add image</Text>
              </Pressable>
              <Pressable style={styles.menuRow} onPress={() => handleComposerOption('reference')}>
                <Text style={styles.menuText}>Reference product</Text>
              </Pressable>
              <Pressable style={[styles.menuRow, styles.menuRowLast]} onPress={() => handleComposerOption('report')}>
                <Text style={styles.menuText}>Report message</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}

      </Animated.View>

      </View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.heroBleedOuter,
          heroOverlayAnimatedStyle,
          {
            top: -(insets.top + TAB_SHELL_TOP_EXTRA),
            marginLeft: -insets.left,
            marginRight: -insets.right,
            width: heroBleedWidth,
          },
        ]}
      >
        <View
          onLayout={onHeroLayout}
          style={[
            styles.heroBleed,
            {
              paddingTop: insets.top + 12,
              paddingHorizontal: 16,
              paddingBottom: 14,
            },
          ]}
        >
          <Text style={styles.heroTitle}>Wonderport Community</Text>
          <Text style={styles.heroSubtitle}>
            One shared room for everyone. Keep it friendly and fun.
          </Text>
        </View>
      </Animated.View>

      {showReferencePicker ? (
        <View style={styles.referencePickerOverlay}>
          <View style={styles.referencePickerHeader}>
            <Text style={styles.referencePickerTitle}>Reference item</Text>
            <Pressable
              style={styles.referencePickerClose}
              onPress={() => {
                setShowReferencePicker(false)
                setReferenceSearch('')
              }}
            >
              <FeatherIcon name="x" size={16} color="#2a335f" />
            </Pressable>
          </View>
          <View style={styles.referenceSearchWrap}>
            <FeatherIcon name="search" size={16} color="#8b94aa" />
            <TextInput
              value={referenceSearch}
              onChangeText={setReferenceSearch}
              style={styles.referenceSearchInput}
              placeholder="Search item for sale"
              placeholderTextColor="#9da7bf"
            />
          </View>
          <FlatList
            data={dbPickerProducts}
            keyExtractor={(item) => `${item.id}:${item.handle}`}
            numColumns={2}
            columnWrapperStyle={styles.referenceGridRow}
            contentContainerStyle={styles.referenceGridContent}
            renderItem={({ item: product }) => {
              const src = productImageSource(product)
              return (
              <Pressable
                style={styles.referenceProductCard}
                onPress={() => {
                  setPendingReferenceItem(product)
                  setShowReferencePicker(false)
                  setReferenceSearch('')
                }}
              >
                <View style={styles.referenceProductImageFrame}>
                  {src ? (
                    <Image source={src} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <View style={styles.referenceProductImagePlaceholder}>
                      <Text numberOfLines={2} style={styles.referenceProductImagePlaceholderText}>
                        {product.title}
                      </Text>
                    </View>
                  )}
                </View>
                <Text numberOfLines={2} style={styles.referenceProductTitle}>
                  {product.title}
                </Text>
                {product.price?.amount ? (
                  <Text style={styles.referenceProductPrice}>{formatMoney(product.price)}</Text>
                ) : null}
              </Pressable>
            )}}
            ListEmptyComponent={
              <View style={styles.referenceEmptyState}>
                <Text style={styles.referenceEmptyText}>No matching items found.</Text>
              </View>
            }
          />
        </View>
      ) : null}

      {editingMessage ? (
        <>
          <Pressable
            style={styles.menuDismissOverlay}
            onPress={() => {
              if (!editingBusy) {
                setEditingMessage(null)
                setEditInput('')
              }
            }}
          />
          <View style={styles.editCardWrap}>
            <View style={styles.editCard}>
              <Text style={styles.editTitle}>Edit message</Text>
              <TextInput
                style={styles.editInput}
                value={editInput}
                onChangeText={setEditInput}
                placeholder="Update your message"
                placeholderTextColor={theme.placeholderTextColor}
                editable={!editingBusy}
              />
              <View style={styles.editActionsRow}>
                <Pressable
                  style={styles.editSecondaryButton}
                  disabled={editingBusy}
                  onPress={() => {
                    setEditingMessage(null)
                    setEditInput('')
                  }}
                >
                  <Text style={styles.editSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.editPrimaryButton, editingBusy || !editInput.trim() ? styles.editPrimaryDisabled : null]}
                  disabled={editingBusy || !editInput.trim()}
                  onPress={saveEditedMessage}
                >
                  <Text style={styles.editPrimaryText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </>
      ) : null}
    </Pressable>
  )
}

const getStyles = (theme: any, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: CHAT_BLACK,
      position: 'relative',
    },
    chatShell: {
      flex: 1,
      minHeight: 0,
      position: 'relative',
      zIndex: 1,
    },
    chatKeyboardGroup: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 1,
    },
    composerDock: {
      marginHorizontal: 12,
      zIndex: 3,
    },
    chatMain: {
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    messagesList: {
      flex: 1,
      minHeight: 0,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    heroBleedOuter: {
      position: 'absolute',
      zIndex: 25,
      elevation: 12,
    },
    heroBleed: {
      backgroundColor: CHAT_TILE_GREY,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      overflow: 'hidden',
    },
    heroTitle: {
      color: CHAT_LIME,
      fontFamily: theme.boldFont,
      fontSize: 18,
      marginBottom: 2,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,.7)',
      fontFamily: theme.regularFont,
      fontSize: 12,
    },
    listContent: {
      paddingHorizontal: 12,
      gap: 8,
    },
    listScrollPad: {
      paddingBottom: 12 + LIST_SCROLL_TAIL,
    },
    messageShell: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    meShell: {
      justifyContent: 'flex-end',
    },
    otherShell: {
      justifyContent: 'flex-start',
    },
    messageRow: {
      maxWidth: '78%',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
    },
    meRow: {
      alignSelf: 'flex-end',
      backgroundColor: CHAT_TILE_GREY,
      borderColor: '#404040',
    },
    otherRow: {
      alignSelf: 'flex-start',
      backgroundColor: CHAT_BLACK,
      borderColor: CHAT_LIME,
      borderWidth: 3,
    },
    avatarBubble: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
      marginTop: 2,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      color: CHAT_LIME,
      fontFamily: theme.boldFont,
      fontSize: 11,
    },
    authorLabel: {
      fontSize: 11,
      marginBottom: 2,
      fontFamily: theme.mediumFont,
    },
    authorLabelMe: {
      color: 'rgba(255,255,255,.55)',
    },
    /** Incoming bubbles sit on black — lime label matches border. */
    authorLabelOtherOnDark: {
      color: CHAT_LIME,
      opacity: 0.85,
    },
    bodyText: {
      color: CHAT_BLACK,
      fontFamily: theme.regularFont,
      fontSize: 14,
    },
    messageImageFrame: {
      width: 170,
      height: 170,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 6,
      marginTop: 2,
      backgroundColor: '#000000',
    },
    inlineActionRow: {
      marginTop: 8,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    inlineActionButton: {
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,.35)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,.08)',
    },
    inlineDeleteButton: {
      borderColor: 'rgba(255,180,180,.55)',
      backgroundColor: 'rgba(180,30,30,.18)',
    },
    inlineActionText: {
      color: '#ffffff',
      fontFamily: theme.semiBoldFont,
      fontSize: 11,
    },
    inlineDeleteText: {
      color: '#ffd5d5',
    },
    meBodyText: {
      color: '#ffffff',
    },
    otherBodyText: {
      color: 'rgba(255,255,255,.92)',
    },
    emptyState: {
      marginTop: 40,
      alignItems: 'center',
    },
    emptyTitle: {
      color: CHAT_LIME,
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      marginBottom: 4,
    },
    emptyText: {
      color: '#9aa0a8',
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 8,
      borderRadius: 16,
      backgroundColor: CHAT_TILE_GREY,
      borderWidth: 1,
      borderColor: '#404040',
    },
    attachButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#3a3a3a',
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuAnchorWrap: {
      position: 'absolute',
      left: 12,
      width: 210,
      zIndex: 4,
    },
    menuDismissOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 3,
    },
    menuCard: {
      backgroundColor: '#ffffff',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#e1e7f2',
      overflow: 'hidden',
    },
    menuRow: {
      minHeight: 48,
      paddingHorizontal: 14,
      alignItems: 'flex-start',
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#edf1f8',
    },
    menuRowLast: {
      borderBottomWidth: 0,
    },
    menuText: {
      color: '#243056',
      fontFamily: theme.semiBoldFont,
      fontSize: 14,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#4a4a4a',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: '#1a1a1a',
      color: '#f2f2f2',
      fontFamily: theme.mediumFont,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: CHAT_LIME,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendIcon: {
      transform: [{ translateX: 0.5 }, { translateY: 0.5 }],
    },
    pendingThumbnailRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 18,
      marginBottom: 8,
      gap: 8,
      zIndex: 4,
    },
    pendingImageCard: {
      width: 72,
      height: 72,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#d9dee8',
      backgroundColor: '#ffffff',
    },
    removePendingImage: {
      position: 'absolute',
      right: 4,
      top: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(255,255,255,.85)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingReferenceCard: {
      width: 86,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#d9dee8',
      backgroundColor: '#ffffff',
      paddingBottom: 6,
    },
    pendingReferenceImageFrame: {
      width: '100%',
      height: 68,
      overflow: 'hidden',
      backgroundColor: '#edf1f9',
    },
    pendingReferenceImagePlaceholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    pendingReferencePlaceholderLabel: {
      color: '#5c6788',
      fontFamily: theme.mediumFont,
      fontSize: 9,
      textAlign: 'center',
    },
    pendingReferenceText: {
      color: '#243056',
      fontFamily: theme.semiBoldFont,
      fontSize: 11,
      paddingHorizontal: 6,
      paddingTop: 4,
    },
    removePendingReference: {
      position: 'absolute',
      right: 4,
      top: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(255,255,255,.85)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    referencedItemCard: {
      width: 170,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#333333',
      overflow: 'hidden',
      backgroundColor: '#ffffff',
      marginBottom: 6,
      marginTop: 2,
    },
    referencedItemCardMe: {
      borderColor: '#525252',
      backgroundColor: '#252525',
    },
    referencedItemImageWrap: {
      width: '100%',
      height: 130,
      overflow: 'hidden',
      backgroundColor: '#e8e8e8',
    },
    referencedItemImageWrapMe: {
      backgroundColor: '#1f1f1f',
    },
    referencedItemImagePlaceholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    referencedItemPlaceholderText: {
      color: '#555555',
      fontFamily: theme.mediumFont,
      fontSize: 11,
      textAlign: 'center',
    },
    referencedItemPlaceholderTextMe: {
      color: 'rgba(255,255,255,.75)',
    },
    referencedItemName: {
      color: '#111111',
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      paddingHorizontal: 8,
      paddingTop: 7,
      paddingBottom: 2,
    },
    referencedItemNameMe: {
      color: '#ffffff',
    },
    referencedItemPrice: {
      color: '#333333',
      fontFamily: theme.boldFont,
      fontSize: 12,
      paddingHorizontal: 8,
      paddingBottom: 7,
    },
    referencedItemPriceMe: {
      color: CHAT_LIME,
    },
    referencedItemFallback: {
      maxWidth: 200,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#333333',
      backgroundColor: '#ffffff',
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 6,
      marginTop: 2,
    },
    referencedItemFallbackMe: {
      borderColor: '#525252',
      backgroundColor: '#363636',
    },
    referencedItemFallbackText: {
      color: '#444444',
      fontFamily: theme.mediumFont,
      fontSize: 12,
    },
    referencedItemFallbackTextMe: {
      color: 'rgba(255,255,255,.85)',
    },
    referencePickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      elevation: 24,
      backgroundColor: '#f4f6fb',
      paddingTop: insets.top + 12,
      paddingHorizontal: 14,
      paddingBottom: insets.bottom + 18,
    },
    referencePickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    referencePickerTitle: {
      color: '#1f2b52',
      fontFamily: theme.boldFont,
      fontSize: 20,
    },
    referencePickerClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#e8edf7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    referenceSearchWrap: {
      borderWidth: 1,
      borderColor: '#d7deec',
      borderRadius: 12,
      backgroundColor: '#ffffff',
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 8,
    },
    referenceSearchInput: {
      flex: 1,
      color: '#243056',
      fontFamily: theme.mediumFont,
      fontSize: 14,
    },
    referenceGridContent: {
      paddingTop: 6,
      paddingBottom: 24,
      gap: 10,
    },
    referenceGridRow: {
      gap: 10,
    },
    referenceProductCard: {
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e1e7f2',
    },
    referenceProductImageFrame: {
      width: '100%',
      height: 160,
      overflow: 'hidden',
      backgroundColor: '#edf1f9',
    },
    referenceProductImagePlaceholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    referenceProductImagePlaceholderText: {
      color: '#5c6788',
      fontFamily: theme.mediumFont,
      fontSize: 11,
      textAlign: 'center',
    },
    referenceProductTitle: {
      color: '#1f2b52',
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 2,
    },
    referenceProductPrice: {
      color: '#e8703a',
      fontFamily: theme.boldFont,
      fontSize: 12,
      paddingHorizontal: 10,
      paddingBottom: 8,
    },
    referenceEmptyState: {
      alignItems: 'center',
      paddingTop: 50,
    },
    referenceEmptyText: {
      color: '#8b94aa',
      fontFamily: theme.mediumFont,
      fontSize: 13,
    },
    editCardWrap: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 45,
      elevation: 26,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    editCard: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#dfe5f1',
      backgroundColor: '#ffffff',
      padding: 14,
      gap: 10,
    },
    editTitle: {
      color: '#1f2b52',
      fontFamily: theme.boldFont,
      fontSize: 16,
    },
    editInput: {
      borderWidth: 1,
      borderColor: '#d9dee8',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: '#243056',
      fontFamily: theme.mediumFont,
    },
    editActionsRow: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
    },
    editSecondaryButton: {
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#d9dee8',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editSecondaryText: {
      color: '#243056',
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
    },
    editPrimaryButton: {
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: CHAT_LIME,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editPrimaryDisabled: {
      opacity: 0.55,
    },
    editPrimaryText: {
      color: CHAT_BLACK,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
    },
  })
