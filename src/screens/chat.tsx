import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import EventSource from 'react-native-sse'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useNavigation } from '@react-navigation/native'
import { ThemeContext } from '../context'
import { CommunityMessage, User } from '../../types'
import { DOMAIN } from '../../constants'
import {
  deleteCommunityMessage,
  editCommunityMessage,
  getCommunityMessages,
  sendCommunityMessage,
} from '../utils'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'

const referenceProducts: {
  title: string
  price: string
  category: string
  image: ImageSourcePropType
}[] = [
  {
    title: 'Vault Pop',
    price: '$14.99',
    category: 'Hirono',
    image: require('../../public/homepageimgs/product1.webp'),
  },
  {
    title: 'Orange Hero',
    price: '$19.49',
    category: 'Anime',
    image: require('../../public/homepageimgs/product2.webp'),
  },
  {
    title: 'Galaxy Figure',
    price: '$28.00',
    category: 'Space',
    image: require('../../public/homepageimgs/product3.webp'),
  },
  {
    title: 'Dragon Mini',
    price: '$12.99',
    category: 'Designer Toy',
    image: require('../../public/homepageimgs/product4.webp'),
  },
]

const REF_ITEM_PREFIX = '__REF_ITEM__:'

function getReferenceToken(itemTitle: string) {
  return `${REF_ITEM_PREFIX}${itemTitle}`
}

function parseReferenceFromBody(body: string) {
  const lines = String(body || '').split('\n')
  const refLine = lines.find((line) => line.startsWith(REF_ITEM_PREFIX))
  const referenceItemTitle = refLine ? refLine.slice(REF_ITEM_PREFIX.length).trim() : ''
  const cleanBody = lines.filter((line) => !line.startsWith(REF_ITEM_PREFIX)).join('\n').trim()
  return {
    cleanBody,
    referenceItemTitle: referenceItemTitle || null,
  }
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
  const styles = useMemo(() => getStyles(theme, insets), [theme, insets])
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [showComposerMenu, setShowComposerMenu] = useState(false)
  const [editingMessage, setEditingMessage] = useState<CommunityMessage | null>(null)
  const [editInput, setEditInput] = useState('')
  const [editingBusy, setEditingBusy] = useState(false)
  const [activeOwnMessageId, setActiveOwnMessageId] = useState<string | null>(null)
  const [showReferencePicker, setShowReferencePicker] = useState(false)
  const [referenceSearch, setReferenceSearch] = useState('')
  const [pendingReferenceItem, setPendingReferenceItem] = useState<{
    title: string
    image: ImageSourcePropType
  } | null>(null)
  const [pendingImage, setPendingImage] = useState<{
    uri: string
    base64: string
    mimeType: string
  } | null>(null)
  const listRef = useRef<FlatList<CommunityMessage> | null>(null)

  useEffect(() => {
    loadInitialMessages()
    const es = connectStream()
    return () => es?.close()
  }, [sessionToken])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const onShow = Keyboard.addListener(showEvent, () => setKeyboardVisible(true))
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false))
    return () => {
      onShow.remove()
      onHide.remove()
    }
  }, [])

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
        ? [body, getReferenceToken(referenceToSend.title)].filter(Boolean).join('\n')
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

  return (
    <Pressable style={styles.container} onPress={() => setActiveOwnMessageId(null)}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Wonderport Community</Text>
        <Text style={styles.heroSubtitle}>
          One shared room for everyone. Keep it friendly and fun.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isMe = item.user.id === user.id
            const showOwnActions = isMe && activeOwnMessageId === item.id
            const avatarUri = getAvatarUri(item, isMe)
            const initial = (item.user.fullName || 'U').slice(0, 1).toUpperCase()
            return (
              <View style={[styles.messageShell, isMe ? styles.meShell : styles.otherShell]}>
                {!isMe ? (
                  <View style={styles.avatarBubble}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{initial}</Text>
                    )}
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
                    const { cleanBody, referenceItemTitle } = parseReferenceFromBody(item.body || '')
                    const referencedItem = referenceItemTitle
                      ? referenceProducts.find((product) => product.title === referenceItemTitle) || null
                      : null
                    return (
                      <>
                  <Text style={styles.authorText}>
                    {isMe ? 'You' : item.user.fullName}
                  </Text>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
                  ) : null}
                        {referencedItem ? (
                          <Pressable
                            style={[styles.referencedItemCard, isMe ? styles.referencedItemCardMe : null]}
                            onPress={() => navigation.navigate('Product', { product: referencedItem })}
                          >
                            <Image source={referencedItem.image} style={styles.referencedItemImage} resizeMode="cover" />
                            <Text numberOfLines={1} style={[styles.referencedItemName, isMe ? styles.referencedItemNameMe : null]}>
                              {referencedItem.title}
                            </Text>
                          </Pressable>
                        ) : null}
                        {cleanBody ? (
                          <Text style={[styles.bodyText, isMe ? styles.meBodyText : null]}>
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
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {(user.fullName || 'Y').slice(0, 1).toUpperCase()}
                      </Text>
                    )}
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

      <View
        style={[
          styles.inputRow,
          { marginBottom: keyboardVisible ? insets.bottom + 8 : insets.bottom + 78 },
        ]}
      >
        <TouchableOpacity style={styles.attachButton} onPress={openComposerActions}>
          <FeatherIcon name="link-2" size={16} color="#2a335f" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Message community"
          placeholderTextColor={theme.placeholderTextColor}
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.sendButton} onPress={onSend} disabled={sending}>
          <FeatherIcon name="send" size={16} color="#ffffff" style={styles.sendIcon} />
        </TouchableOpacity>
      </View>

      {pendingImage ? (
        <View style={[styles.pendingImageCard, { bottom: keyboardVisible ? insets.bottom + 62 : insets.bottom + 132 }]}>
          <Image source={{ uri: pendingImage.uri }} style={styles.pendingImagePreview} />
          <Pressable style={styles.removePendingImage} onPress={() => setPendingImage(null)}>
            <FeatherIcon name="x" size={12} color="#243056" />
          </Pressable>
        </View>
      ) : null}
      {pendingReferenceItem ? (
        <View style={[styles.pendingReferenceCard, { bottom: keyboardVisible ? insets.bottom + 62 : insets.bottom + 132 }]}>
          <Image source={pendingReferenceItem.image} style={styles.pendingReferenceImage} resizeMode="cover" />
          <Text numberOfLines={1} style={styles.pendingReferenceText}>
            {pendingReferenceItem.title}
          </Text>
          <Pressable style={styles.removePendingReference} onPress={() => setPendingReferenceItem(null)}>
            <FeatherIcon name="x" size={12} color="#243056" />
          </Pressable>
        </View>
      ) : null}

      {showComposerMenu ? (
        <>
          <Pressable style={styles.menuDismissOverlay} onPress={() => setShowComposerMenu(false)} />
          <View
            style={[
              styles.menuAnchorWrap,
              { bottom: keyboardVisible ? insets.bottom + 64 : insets.bottom + 134 },
            ]}
          >
            <View style={styles.menuCard}>
              <Pressable style={styles.menuRow} onPress={() => handleComposerOption('image')}>
                <Text style={styles.menuText}>Add image</Text>
              </Pressable>
              <Pressable style={styles.menuRow} onPress={() => handleComposerOption('reference')}>
                <Text style={styles.menuText}>Refrence item</Text>
              </Pressable>
              <Pressable style={[styles.menuRow, styles.menuRowLast]} onPress={() => handleComposerOption('report')}>
                <Text style={styles.menuText}>Report message</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
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
            data={referenceProducts.filter((product) =>
              !referenceSearch.trim()
                ? true
                : product.title.toLowerCase().includes(referenceSearch.trim().toLowerCase())
            )}
            keyExtractor={(item) => item.title}
            numColumns={2}
            columnWrapperStyle={styles.referenceGridRow}
            contentContainerStyle={styles.referenceGridContent}
            renderItem={({ item: product }) => (
              <Pressable
                style={styles.referenceProductCard}
                onPress={() => {
                  setPendingReferenceItem(product)
                  setShowReferencePicker(false)
                  setReferenceSearch('')
                }}
              >
                <Image source={product.image} style={styles.referenceProductImage} resizeMode="cover" />
                <Text numberOfLines={1} style={styles.referenceProductTitle}>
                  {product.title}
                </Text>
              </Pressable>
            )}
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
      </KeyboardAvoidingView>
    </Pressable>
  )
}

const getStyles = (theme: any, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f4f6fb',
    },
    heroCard: {
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 2,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: '#2a335f',
    },
    heroTitle: {
      color: '#ffffff',
      fontFamily: theme.boldFont,
      fontSize: 18,
      marginBottom: 2,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,.75)',
      fontFamily: theme.regularFont,
      fontSize: 12,
    },
    loader: {
      marginTop: 28,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 8,
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
      backgroundColor: '#2a335f',
      borderColor: '#2a335f',
    },
    otherRow: {
      alignSelf: 'flex-start',
      backgroundColor: '#eef2fa',
      borderColor: '#cfd7e8',
      borderWidth: 1.5,
    },
    avatarBubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#dfe6f5',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginTop: 2,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      color: '#2a335f',
      fontFamily: theme.boldFont,
      fontSize: 11,
    },
    authorText: {
      fontSize: 11,
      marginBottom: 2,
      color: '#8b94aa',
      fontFamily: theme.mediumFont,
    },
    bodyText: {
      color: '#1a2445',
      fontFamily: theme.regularFont,
      fontSize: 14,
    },
    messageImage: {
      width: 170,
      height: 170,
      borderRadius: 10,
      marginBottom: 6,
      marginTop: 2,
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
    emptyState: {
      marginTop: 40,
      alignItems: 'center',
    },
    emptyTitle: {
      color: '#2a335f',
      fontFamily: theme.semiBoldFont,
      fontSize: 16,
      marginBottom: 4,
    },
    emptyText: {
      color: '#8b94aa',
      fontFamily: theme.regularFont,
      fontSize: 13,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 12,
      marginBottom: 10,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 8,
      borderRadius: 16,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e7ebf3',
    },
    attachButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#edf1f9',
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
      borderColor: '#d9dee8',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: '#243056',
      fontFamily: theme.mediumFont,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#2a335f',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendIcon: {
      transform: [{ translateX: 0.5 }, { translateY: 0.5 }],
    },
    pendingImageCard: {
      position: 'absolute',
      left: 18,
      width: 72,
      height: 72,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#d9dee8',
      backgroundColor: '#ffffff',
      zIndex: 4,
    },
    pendingImagePreview: {
      width: '100%',
      height: '100%',
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
      position: 'absolute',
      left: 98,
      width: 86,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#d9dee8',
      backgroundColor: '#ffffff',
      zIndex: 4,
      paddingBottom: 6,
    },
    pendingReferenceImage: {
      width: '100%',
      height: 68,
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
      borderColor: '#d9dee8',
      overflow: 'hidden',
      backgroundColor: '#ffffff',
      marginBottom: 6,
      marginTop: 2,
    },
    referencedItemCardMe: {
      borderColor: 'rgba(255,255,255,.35)',
      backgroundColor: 'rgba(255,255,255,.12)',
    },
    referencedItemImage: {
      width: '100%',
      height: 130,
    },
    referencedItemName: {
      color: '#243056',
      fontFamily: theme.semiBoldFont,
      fontSize: 12,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    referencedItemNameMe: {
      color: '#ffffff',
    },
    referencePickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 8,
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
    referenceProductImage: {
      width: '100%',
      height: 160,
      backgroundColor: '#edf1f9',
    },
    referenceProductTitle: {
      color: '#1f2b52',
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      paddingHorizontal: 10,
      paddingVertical: 8,
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
      zIndex: 5,
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
      backgroundColor: '#2a335f',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editPrimaryDisabled: {
      opacity: 0.55,
    },
    editPrimaryText: {
      color: '#ffffff',
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
    },
  })
