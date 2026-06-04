import 'react-native-gesture-handler'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { Main } from './src/main'
import { useFonts } from 'expo-font'
import { Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat'
import { ThemeContext, AppContext } from './src/context'
import {
  BRAND_ACCENT_STORAGE_KEY,
  mergeBrandAccentIntoTheme,
  normalizeBrandAccentId,
} from './src/brandAccent'
import * as themes from './src/theme'
import { IMAGE_MODELS, MODELS } from './constants'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ChatModelModal } from './src/components/index'
import { Model } from './types'
import { ActionSheetProvider } from '@expo/react-native-action-sheet'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { Alert, StyleSheet, LogBox } from 'react-native'
import {
  isSameSavedProduct,
  shopifyProductToSavePayload,
  type ProductSavePayload,
} from './src/productSave'
import {
  fetchSavedProducts,
  saveProductToAccount,
  unsaveProductFromAccount,
} from './src/savedProductsApi'
import { fetchCart, syncCartToAccount } from './src/cartApi'
import { cartItemsToSyncLines } from './src/cartLine'
import { readPersistedCartItems, writePersistedCartItems } from './src/cartPersistence'
import {
  clearPersistedSavedItems,
  readPersistedSavedItems,
  writePersistedSavedItems,
} from './src/savedPersistence'
import type { ShopifyProduct } from './types'
import { getCartStockError, isProductInStock, maxPurchasableQuantity } from './src/productStock'
import { getProductSaveImageSource } from './src/productSave'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'

LogBox.ignoreLogs([
  'Key "cancelled" in the image picker result is deprecated and will be removed in SDK 48, use "canceled" instead',
  'No native splash screen registered',
  /** Hermes dev noise when Metro serves a stale bundle — harmless once reload clears cache */
  "Property 'categories' doesn't exist",
  "Property 'SECTION_TITLE' doesn't exist",
  "Property 'NotificationsModal' doesn't exist",
])

function cartLineQuantityTotal(items: { quantity?: number }[]): number {
  return items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0)
}

export default function App() {
  const [theme, setTheme] = useState<string>('wonderport')
  const [brandAccentId, setBrandAccentId] = useState<string>('default')
  const [chatType, setChatType] = useState<Model>(MODELS.claudeOpus)
  const [imageModel, setImageModel] = useState<string>(IMAGE_MODELS.nanoBanana.label)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [savedItems, setSavedItems] = useState<ProductSavePayload[]>([])
  const [sessionToken, setSessionToken] = useState('')
  const [modalVisible, setModalVisible] = useState<boolean>(false)
  const skipNextCartSyncRef = useRef(false)
  const cartAccountReadyRef = useRef(false)
  const cartSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cartBadgeDismissed, setCartBadgeDismissed] = useState(false)
  const cartQtyTotal = useMemo(() => cartLineQuantityTotal(cartItems), [cartItems])
  const prevCartQtyRef = useRef(cartQtyTotal)
  const [fontsLoaded] = useFonts({
    'Geist-Regular': require('./assets/fonts/Geist-Regular.otf'),
    'Geist-Light': require('./assets/fonts/Geist-Light.otf'),
    'Geist-Bold': require('./assets/fonts/Geist-Bold.otf'),
    'Geist-Medium': require('./assets/fonts/Geist-Medium.otf'),
    'Geist-Black': require('./assets/fonts/Geist-Black.otf'),
    'Geist-SemiBold': require('./assets/fonts/Geist-SemiBold.otf'),
    'Geist-Thin': require('./assets/fonts/Geist-Thin.otf'),
    'Geist-UltraLight': require('./assets/fonts/Geist-UltraLight.otf'),
    'Geist-UltraBlack': require('./assets/fonts/Geist-UltraBlack.otf'),
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  })

  useEffect(() => {
    configureStorage()
  }, [])

  async function configureStorage() {
    try {
      const _theme = await AsyncStorage.getItem('rnai-theme')
      if (_theme) setTheme(_theme === 'dark' ? 'wonderport' : _theme)
      const _accent = await AsyncStorage.getItem(BRAND_ACCENT_STORAGE_KEY)
      if (_accent) setBrandAccentId(normalizeBrandAccentId(_accent))
      const _chatType = await AsyncStorage.getItem('rnai-chatType')
      if (_chatType) setChatType(JSON.parse(_chatType))
      const _imageModel = await AsyncStorage.getItem('rnai-imageModel')
      if (_imageModel) setImageModel(_imageModel)
      const localCart = await readPersistedCartItems()
      if (localCart.length > 0) {
        skipNextCartSyncRef.current = true
        setCartItems(localCart)
      }
      const localSaved = await readPersistedSavedItems()
      if (localSaved.length > 0) {
        setSavedItems(localSaved)
      }
    } catch (err) {
      console.log('error configuring storage', err)
    }
  }

  function applyCartItemsFromRemote(items: any[]) {
    skipNextCartSyncRef.current = true
    setCartItems(
      items.map((item) => ({
        ...item,
        image: getProductSaveImageSource(item),
      })),
    )
  }

  const bottomSheetModalRef = useRef<BottomSheetModal>(null)

  function blurActiveElementOnWeb() {
    if (Platform.OS !== 'web') return
    try {
      const el = (document.activeElement as any) as HTMLElement | null
      el?.blur?.()
    } catch {
      // ignore
    }
  }

  function closeModal() {
    blurActiveElementOnWeb()
    bottomSheetModalRef.current?.dismiss()
    setModalVisible(false)
  }

  function handlePresentModalPress() {
    if (modalVisible) {
      closeModal()
    } else {
      blurActiveElementOnWeb()
      bottomSheetModalRef.current?.present()
      setModalVisible(true)
    }
  }

  function _setChatType(type) {
    setChatType(type)
    AsyncStorage.setItem('rnai-chatType', JSON.stringify(type))
  }

  function _setImageModel(model) {
    setImageModel(model)
    AsyncStorage.setItem('rnai-imageModel', model)
  }

  function _setTheme(theme) {
    setTheme(theme)
    AsyncStorage.setItem('rnai-theme', theme)
  }

  function _setBrandAccentId(next: string) {
    const id = normalizeBrandAccentId(next)
    setBrandAccentId(id)
    AsyncStorage.setItem(BRAND_ACCENT_STORAGE_KEY, id)
  }

  function addToCart(item: any, quantity: number = 1) {
    if (!isProductInStock(item)) {
      Alert.alert('Out of stock', 'This item is not available to purchase right now.')
      return
    }
    const max = maxPurchasableQuantity(item)
    const qty = Math.min(Math.max(1, Math.floor(quantity) || 1), max)
    setCartItems(prev => {
      const existingIndex = prev.findIndex(v => v.title === item.title)
      if (existingIndex === -1) {
        const next = [...prev, { ...item, quantity: qty }]
        const err = getCartStockError(next)
        if (err) {
          Alert.alert('Out of stock', err)
          return prev
        }
        return next
      }
      const copy = [...prev]
      const combined = copy[existingIndex].quantity + qty
      copy[existingIndex] = {
        ...copy[existingIndex],
        quantity: Math.min(combined, max),
      }
      const err = getCartStockError(copy)
      if (err) {
        Alert.alert('Out of stock', err)
        return prev
      }
      return copy
    })
  }

  function updateCartItemQuantity(title: string, quantity: number) {
    if (quantity < 1) return
    setCartItems(prev =>
      prev.map(item => item.title === title ? { ...item, quantity } : item)
    )
  }

  function removeFromCart(title: string) {
    setCartItems(prev => prev.filter(item => item.title !== title))
  }

  function clearCart() {
    setCartItems([])
  }

  useEffect(() => {
    if (cartQtyTotal > prevCartQtyRef.current) {
      setCartBadgeDismissed(false)
    }
    prevCartQtyRef.current = cartQtyTotal
  }, [cartQtyTotal])

  const showHomeCartBadge = cartQtyTotal > 0 && !cartBadgeDismissed

  const markCartViewed = useCallback(() => {
    setCartBadgeDismissed(true)
  }, [])

  const refreshCart = useCallback(async (token?: string) => {
    const activeToken = token ?? sessionToken
    if (!activeToken) {
      cartAccountReadyRef.current = false
      return
    }
    cartAccountReadyRef.current = false
    try {
      const items = await fetchCart(activeToken)
      applyCartItemsFromRemote(items)
    } catch (error) {
      console.log('Failed to load cart', error)
    } finally {
      cartAccountReadyRef.current = true
    }
  }, [sessionToken])

  const refreshSavedItems = useCallback(async (token?: string) => {
    const activeToken = token ?? sessionToken
    if (!activeToken) {
      setSavedItems([])
      await clearPersistedSavedItems()
      return
    }
    try {
      const products = await fetchSavedProducts(activeToken)
      const next = products.map((p) => shopifyProductToSavePayload(p as ShopifyProduct))
      setSavedItems(next)
      await writePersistedSavedItems(next)
    } catch (error) {
      console.log('Failed to load saved products', error)
    }
  }, [sessionToken])

  useEffect(() => {
    void writePersistedCartItems(cartItems)
    if (skipNextCartSyncRef.current) {
      skipNextCartSyncRef.current = false
      return
    }
    if (!sessionToken || !cartAccountReadyRef.current) return
    if (cartSyncTimerRef.current) clearTimeout(cartSyncTimerRef.current)
    cartSyncTimerRef.current = setTimeout(() => {
      const lines = cartItemsToSyncLines(cartItems)
      void syncCartToAccount(sessionToken, lines).catch((error) => {
        console.log('Failed to sync cart', error)
      })
    }, 500)
    return () => {
      if (cartSyncTimerRef.current) clearTimeout(cartSyncTimerRef.current)
    }
  }, [cartItems, sessionToken])

  useEffect(() => {
    if (savedItems.length === 0 && !sessionToken) return
    void writePersistedSavedItems(savedItems)
  }, [savedItems, sessionToken])

  const toggleSavedItem = useCallback(
    async (item: ProductSavePayload) => {
      const productId = String(item.id || '').trim()
      if (!productId) return

      if (!sessionToken) {
        Alert.alert('Sign in required', 'Log in to save items to your profile.')
        return
      }

      const exists = savedItems.some((v) => isSameSavedProduct(v, item))
      const previous = savedItems

      setSavedItems((prev) => {
        if (exists) return prev.filter((v) => !isSameSavedProduct(v, item))
        return [...prev, item]
      })

      try {
        const products = exists
          ? await unsaveProductFromAccount(sessionToken, productId)
          : await saveProductToAccount(sessionToken, productId)
        const next = products.map((p) => shopifyProductToSavePayload(p as ShopifyProduct))
        setSavedItems(next)
        await writePersistedSavedItems(next)
      } catch (error) {
        console.log('Failed to update saved product', error)
        setSavedItems(previous)
        Alert.alert('Could not update saved items', 'Please try again.')
      }
    },
    [savedItems, sessionToken],
  )

  const removeSavedItem = useCallback(
    async (productIdOrTitle: string) => {
      const target = savedItems.find(
        (item) => item.id === productIdOrTitle || item.title === productIdOrTitle,
      )
      if (!target?.id) {
        setSavedItems((prev) => prev.filter((item) => item.title !== productIdOrTitle))
        return
      }
      if (!sessionToken) {
        setSavedItems((prev) => prev.filter((item) => !isSameSavedProduct(item, target)))
        return
      }
      const previous = savedItems
      setSavedItems((prev) => prev.filter((item) => !isSameSavedProduct(item, target)))
      try {
        const products = await unsaveProductFromAccount(sessionToken, target.id)
        const next = products.map((p) => shopifyProductToSavePayload(p as ShopifyProduct))
        setSavedItems(next)
        await writePersistedSavedItems(next)
      } catch (error) {
        console.log('Failed to remove saved product', error)
        setSavedItems(previous)
        Alert.alert('Could not remove item', 'Please try again.')
      }
    },
    [savedItems, sessionToken],
  )

  const resolvedTheme = mergeBrandAccentIntoTheme(getTheme(theme), brandAccentId)
  const bottomSheetStyles = getBottomsheetStyles(resolvedTheme)

  if (!fontsLoaded) return null
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <AppContext.Provider
            value={{
              chatType,
              setChatType: _setChatType,
              handlePresentModalPress,
              imageModel,
              setImageModel: _setImageModel,
              closeModal,
              cartItems,
              addToCart,
              updateCartItemQuantity,
              removeFromCart,
              clearCart,
              showHomeCartBadge,
              markCartViewed,
              savedItems,
              sessionToken,
              setSessionToken,
              refreshSavedItems,
              refreshCart,
              toggleSavedItem,
              removeSavedItem,
            }}
          >
            <ThemeContext.Provider
              value={{
                theme: resolvedTheme,
                themeName: theme,
                setTheme: _setTheme,
                brandAccentId,
                setBrandAccentId: _setBrandAccentId,
              }}
            >
              <ActionSheetProvider>
                <NavigationContainer>
                  <Main />
                </NavigationContainer>
              </ActionSheetProvider>
              <BottomSheetModalProvider>
                <BottomSheetModal
                  handleIndicatorStyle={bottomSheetStyles.handleIndicator}
                  handleStyle={bottomSheetStyles.handle}
                  backgroundStyle={bottomSheetStyles.background}
                  ref={bottomSheetModalRef}
                  enableDynamicSizing={true}
                  backdropComponent={props => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} />}
                  enableDismissOnClose
                  enablePanDownToClose
                  onDismiss={() => setModalVisible(false)}
                >
                  <BottomSheetView>
                    <ChatModelModal handlePresentModalPress={handlePresentModalPress} />
                  </BottomSheetView>
                </BottomSheetModal>
              </BottomSheetModalProvider>
            </ThemeContext.Provider>
          </AppContext.Provider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const getBottomsheetStyles = theme => StyleSheet.create({
  background: {
    paddingHorizontal: 24,
    backgroundColor: theme.backgroundColor
  },
  handle: {
    marginHorizontal: 15,
    backgroundColor: theme.backgroundColor,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, .3)'
  }
})

function getTheme(theme: any) {
  const label = String(theme || '').trim()
  const allThemes = Object.values(themes) as any[]

  const matched =
    allThemes.find((t) => t?.label === label) ??
    allThemes.find((t) => t?.label === 'wonderport') ??
    (themes as any).wonderportTheme ??
    (themes as any).darkTheme

  return matched
}
