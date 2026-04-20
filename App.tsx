import 'react-native-gesture-handler'
import { useState, useEffect, useRef } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { Main } from './src/main'
import { useFonts } from 'expo-font'
import { Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat'
import { ThemeContext, AppContext } from './src/context'
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
import { StyleSheet, LogBox } from 'react-native'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

LogBox.ignoreLogs([
  'Key "cancelled" in the image picker result is deprecated and will be removed in SDK 48, use "canceled" instead',
  'No native splash screen registered'
])

export default function App() {
  const [theme, setTheme] = useState<string>('dark')
  const [chatType, setChatType] = useState<Model>(MODELS.claudeOpus)
  const [imageModel, setImageModel] = useState<string>(IMAGE_MODELS.nanoBanana.label)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [savedItems, setSavedItems] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState<boolean>(false)
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
      if (_theme) setTheme(_theme)
      const _chatType = await AsyncStorage.getItem('rnai-chatType')
      if (_chatType) setChatType(JSON.parse(_chatType))
      const _imageModel = await AsyncStorage.getItem('rnai-imageModel')
      if (_imageModel) setImageModel(_imageModel)
    } catch (err) {
      console.log('error configuring storage', err)
    }
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

  function addToCart(item: any, quantity: number = 1) {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(v => v.title === item.title)
      if (existingIndex === -1) {
        return [...prev, { ...item, quantity }]
      }
      const copy = [...prev]
      copy[existingIndex] = {
        ...copy[existingIndex],
        quantity: copy[existingIndex].quantity + quantity,
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

  function toggleSavedItem(item: any) {
    setSavedItems(prev => {
      const exists = prev.some(v => v.title === item.title)
      if (exists) {
        return prev.filter(v => v.title !== item.title)
      }
      return [...prev, item]
    })
  }

  function removeSavedItem(title: string) {
    setSavedItems(prev => prev.filter(item => item.title !== title))
  }

  const resolvedTheme = getTheme(theme)
  const bottomSheetStyles = getBottomsheetStyles(resolvedTheme)

  if (!fontsLoaded) return null
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
          savedItems,
          toggleSavedItem,
          removeSavedItem,
        }}
      >
        <ThemeContext.Provider value={{
          theme: getTheme(theme),
          themeName: theme,
          setTheme: _setTheme
          }}>
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
                backdropComponent={(props) => <BottomSheetBackdrop {...props}  disappearsOnIndex={-1}/>}
                enableDismissOnClose
                enablePanDownToClose
                onDismiss={() => setModalVisible(false)}
              >
                <BottomSheetView>
                  <ChatModelModal
                    handlePresentModalPress={handlePresentModalPress}
                  />
                </BottomSheetView>
              </BottomSheetModal>
            </BottomSheetModalProvider>
        </ThemeContext.Provider>
      </AppContext.Provider>
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
    allThemes.find((t) => t?.label === 'dark') ??
    (themes as any).darkTheme

  return matched
}
