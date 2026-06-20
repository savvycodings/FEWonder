import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import {
  Home,
  Search,
  Profile,
  Shipping,
  Payment,
  Cart,
  Saved,
  Product,
  CategoryProducts,
  Chat,
  Settings,
  ProfileAccountSettings,
  ProfileHeroEdit,
  RedeemCode,
  Login,
  ForgotPassword,
  SignupVerifyEmail,
  DailyRewards,
  AdminOrdersLogin,
  AdminOrdersHub,
  AdminOrderDetail,
  AdminUserOrders,
  AdminReportedMessages,
  AdminNotificationsHub,
  MyOrders,
  MyOrderDetail,
  ContactUs,
  CommunityUserProfile,
} from './screens'
import { CartCheckout } from './screens/cartCheckout'
import { CheckoutDelivery } from './screens/checkoutDelivery'
import { WonderJump } from './screens/wonderJump'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeContext } from './context'
import { WonderJumpControllerIcon } from './components'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthPayload, User } from '../types'
import { logoutUser } from './utils'
import { AppSessionBridge } from './AppSessionBridge'
import { FLOATING_TAB_BAR_BOTTOM, FLOATING_TAB_BAR_HEIGHT } from './tabBarLayout'

/** Tab shell padding below status bar; Search hero bleed should match. */
const TAB_SHELL_TOP_EXTRA = 6

/** Only Edit profile uses the native stack header (with tab-shell lift). Other profile screens use in-app “Profile” back bar. */
const PROFILE_STACK_HEADER_ROUTE_NAMES = new Set(['ProfileHeroEdit'])

/** Matches `tabBarStyle.borderRadius` — clips blur + tint to the floating pill. */
const TAB_BAR_RADIUS = 18
/**
 * Horizontal inset from screen edge (floating pill). Match Home scroll `paddingHorizontal: 16`.
 * RN Navigation v7 tab bar uses `start`/`end: 0` on the outer bar; `left`/`right` do not override that,
 * so we set `start` + `end` to these insets.
 */
const TAB_BAR_SIDE_INSET_MIN = 16
const TAB_BAR_SIDE_INSET_MAX = 28
const TAB_BAR_SIDE_INSET_RATIO = 0.045

/**
 * Frosted “liquid glass” tab bar: native blur + stacked grey translucency (iOS-style material).
 * Blur smears content behind; each layer tints without killing legibility of icons.
 */
function FrostedTabBarBackground() {
  const { theme } = useContext(ThemeContext)
  const isLight = theme?.tabBarBlurTint === 'light'
  const blurIntensity = Platform.OS === 'ios' ? 100 : Platform.OS === 'android' ? 72 : 88
  const shell = [StyleSheet.absoluteFill, { borderRadius: TAB_BAR_RADIUS, overflow: 'hidden' }]
  return (
    <View pointerEvents="none" style={shell}>
      <BlurView intensity={blurIntensity} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
      {isLight ? (
        <>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.72)' }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(255, 255, 255, 0.88)',
              'rgba(246, 244, 239, 0.82)',
              'rgba(240, 238, 232, 0.78)',
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0, 0, 0, 0.06)', 'transparent', 'rgba(0, 0, 0, 0.06)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: TAB_BAR_RADIUS,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.tabBarBorderColor || 'rgba(0, 0, 0, 0.1)',
              },
            ]}
          />
        </>
      ) : (
        <>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20, 20, 22, 0.48)' }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(56, 56, 60, 0.42)',
              'rgba(34, 34, 38, 0.5)',
              'rgba(18, 18, 22, 0.58)',
              'rgba(10, 10, 12, 0.62)',
            ]}
            locations={[0, 0.35, 0.72, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0, 0, 0, 0.18)', 'transparent', 'rgba(0, 0, 0, 0.18)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.05)', 'transparent']}
            locations={[0, 0.18, 0.45]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0, 0, 0, 0.22)']}
            locations={[0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: TAB_BAR_RADIUS,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255, 255, 255, 0.14)',
              },
            ]}
          />
        </>
      )}
    </View>
  )
}

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()
const ProfileStack = createNativeStackNavigator()
const HomeStack = createNativeStackNavigator()

function HomeStackScreen({ sessionToken }: { sessionToken: string }) {
  const { theme } = useContext(ThemeContext)
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
        },
      }}
    >
      <HomeStack.Screen name="HomeMain">
        {({ navigation }) => (
          <Home navigation={navigation} sessionToken={sessionToken} />
        )}
      </HomeStack.Screen>
      <HomeStack.Screen name="DailyRewards" component={DailyRewards} />
    </HomeStack.Navigator>
  )
}

function ProfileStackScreen({
  user,
  onLogout,
  onUserUpdated,
  sessionToken,
}: {
  user: User
  onLogout: () => Promise<void>
  onUserUpdated: (user: User) => Promise<void>
  sessionToken: string
}) {
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const [stackRouteName, setStackRouteName] = useState('ProfileHome')
  const liftStackPastTabShellPad = PROFILE_STACK_HEADER_ROUTE_NAMES.has(stackRouteName)
  const stackLiftStyle =
    liftStackPastTabShellPad
      ? { marginTop: -(insets.top + TAB_SHELL_TOP_EXTRA) }
      : null

  return (
    <View style={[{ flex: 1 }, stackLiftStyle]}>
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
        },
      }}
      screenListeners={{
        state: (event) => {
          const state = event.data.state as { index: number; routes: { name: string }[] } | undefined
          const name = state?.routes?.[state.index]?.name
          if (name) setStackRouteName(name)
        },
      }}
    >
      <ProfileStack.Screen name="ProfileHome">
        {({ navigation }) => (
          <Profile
            navigation={navigation}
            user={user}
            onLogout={onLogout}
            onUserUpdated={onUserUpdated}
            sessionToken={sessionToken}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="ProfileHeroEdit"
        options={{
          headerShown: true,
          headerTitle: 'Edit profile',
          ...profileStackNativeHeaderOptions(theme),
          contentStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
        }}
      >
        {({ navigation }) => (
          <ProfileHeroEdit
            navigation={navigation}
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="Saved" component={Saved} />
      <ProfileStack.Screen name="ProfileCart" component={Cart} />
      <ProfileStack.Screen name="ProfileMyOrders" component={MyOrders} />
      <ProfileStack.Screen name="ProfileMyOrderDetail" component={MyOrderDetail} />
      <ProfileStack.Screen
        name="ProfileSettings"
        options={{
          headerShown: false,
        }}
      >
        {() => (
          <Settings
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
            onLogout={onLogout}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="ProfileAccountSettings">
        {() => (
          <ProfileAccountSettings
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="Shipping">
        {() => (
          <Shipping
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="Payment">
        {() => (
          <Payment
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="RedeemCode">
        {() => <RedeemCode sessionToken={sessionToken} />}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="ContactUs"
        component={ContactUs}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen name="ProfileDailyRewards" component={DailyRewards} />
      <ProfileStack.Screen name="AdminOrdersLogin" component={AdminOrdersLogin} />
      <ProfileStack.Screen name="AdminOrdersHub" component={AdminOrdersHub} />
      <ProfileStack.Screen name="AdminOrderDetail" component={AdminOrderDetail} />
      <ProfileStack.Screen name="AdminUserOrders" component={AdminUserOrders} />
      <ProfileStack.Screen name="AdminReportedMessages" component={AdminReportedMessages} />
      <ProfileStack.Screen name="AdminNotificationsHub" component={AdminNotificationsHub} />
    </ProfileStack.Navigator>
    </View>
  )
}

function Tabs({
  user,
  sessionToken,
  onLogout,
  onUserUpdated,
}: {
  user: User
  sessionToken: string
  onLogout: () => Promise<void>
  onUserUpdated: (user: User) => Promise<void>
}) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const { theme } = useContext(ThemeContext)
  const styles = getStyles({ theme, insets })
  const tabBarSideInset = Math.min(
    TAB_BAR_SIDE_INSET_MAX,
    Math.max(TAB_BAR_SIDE_INSET_MIN, Math.round(windowWidth * TAB_BAR_SIDE_INSET_RATIO)),
  )

  /** Keep latest user in a ref so Chat tab identity stays stable (avoids remount + loading loop). */
  const chatUserRef = useRef(user)
  chatUserRef.current = user

  /** Stable component identity so Chat does not remount every Tabs render (would cancel hero timer). */
  const ChatTabScreen = useMemo(
    () =>
      function ChatTabScreen() {
        return <Chat user={chatUserRef.current} sessionToken={sessionToken} />
      },
    [sessionToken]
  )

  const WonderJumpTabScreen = useMemo(
    () =>
      function WonderJumpTabScreen(props: { navigation: any; route: any }) {
        return <WonderJump {...props} sessionToken={sessionToken} onUserUpdated={onUserUpdated} />
      },
    [sessionToken, onUserUpdated]
  )

  return (
    <View style={styles.container}>
      <AppSessionBridge sessionToken={sessionToken} />
      <View pointerEvents="none" style={styles.bottomSafeFill} />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: theme.tabBarActiveTintColor,
          tabBarInactiveTintColor: theme.tabBarInactiveTintColor,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontFamily: theme.mediumFont,
            fontSize: 11,
            marginBottom: 2,
          },
          tabBarContentContainerStyle: {
            paddingHorizontal: 4,
            columnGap: 0,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
            paddingHorizontal: 2,
          },
          tabBarBackground: () => <FrostedTabBarBackground />,
          tabBarStyle: {
            position: 'absolute',
            /** `start`/`end` override the library’s full-width `styles.bottom` (not `left`/`right`). */
            start: tabBarSideInset,
            end: tabBarSideInset,
            bottom: insets.bottom + FLOATING_TAB_BAR_BOTTOM,
            height: FLOATING_TAB_BAR_HEIGHT,
            borderRadius: TAB_BAR_RADIUS,
            overflow: 'hidden',
            borderTopWidth: 0,
            borderWidth: 0,
            backgroundColor: 'transparent',
            elevation: 8,
            shadowColor: '#000000',
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: {
              width: 0,
              height: 8,
            },
          },
        }}
      >
        <Tab.Screen
          name="Home"
          children={() => <HomeStackScreen sessionToken={sessionToken} />}
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <FeatherIcon
                name="home"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          children={({ navigation }) => <Search navigation={navigation} />}
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <FeatherIcon
                name="search"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="WonderJump"
          component={WonderJumpTabScreen}
          options={{
            headerShown: false,
            tabBarLabel: 'Jump',
            tabBarIcon: ({ color, size }) => (
              <WonderJumpControllerIcon color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          children={() => (
            <ProfileStackScreen
              user={user}
              onLogout={onLogout}
              onUserUpdated={onUserUpdated}
              sessionToken={sessionToken}
            />
          )}
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <FeatherIcon
                name="user"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatTabScreen}
          options={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarIcon: ({ color, size }) => (
              <FeatherIcon
                name="message-circle"
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

function themedNativeHeaderOptions(theme: {
  appBackgroundColor?: string
  backgroundColor?: string
  textColor?: string
  boldFont?: string
}) {
  return {
    headerBackTitle: '',
    headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
    headerTintColor: theme.textColor,
    headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
    headerShadowVisible: false,
  } as const
}

/** Native stack header inside the Profile tab (offset tab-shell top pad via stack lift). */
function profileStackNativeHeaderOptions(theme: {
  appBackgroundColor?: string
  backgroundColor?: string
  textColor?: string
  boldFont?: string
}) {
  return {
    ...themedNativeHeaderOptions(theme),
    headerTopInsetEnabled: true,
    statusBarTranslucent: false,
  } as const
}

export function Main() {
  const { theme } = useContext(ThemeContext)
  const [user, setUser] = useState<User | null>(null)
  const [sessionToken, setSessionToken] = useState<string>('')
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    hydrateUser()
  }, [])

  async function hydrateUser() {
    try {
      const rawAuth = await AsyncStorage.getItem('wonderport-auth')
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth) as AuthPayload
        setUser(parsed.user)
        setSessionToken(parsed.sessionToken)
      }
    } catch (error) {
      console.log('Unable to restore user session', error)
    } finally {
      setIsHydrated(true)
    }
  }

  async function onRegisterSuccess(payload: AuthPayload) {
    await AsyncStorage.setItem('wonderport-auth', JSON.stringify(payload))
    await AsyncStorage.setItem('wonderport-user', JSON.stringify(payload.user))
    setUser(payload.user)
    setSessionToken(payload.sessionToken)
  }

  const onUserUpdated = useCallback(async (nextUser: User) => {
    const nextAuth: AuthPayload = { user: nextUser, sessionToken }
    await AsyncStorage.setItem('wonderport-auth', JSON.stringify(nextAuth))
    await AsyncStorage.setItem('wonderport-user', JSON.stringify(nextUser))
    setUser(nextUser)
  }, [sessionToken])

  async function onLogout() {
    if (sessionToken) {
      await logoutUser(sessionToken)
    }
    await AsyncStorage.removeItem('wonderport-auth')
    await AsyncStorage.removeItem('wonderport-user')
    setUser(null)
    setSessionToken('')
  }

  if (!isHydrated) {
    return null
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login">
            {() => <Login onAuthSuccess={onRegisterSuccess} />}
          </Stack.Screen>
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          <Stack.Screen name="SignupVerifyEmail">
            {() => <SignupVerifyEmail onAuthSuccess={onRegisterSuccess} />}
          </Stack.Screen>
        </>
      ) : (
        <Stack.Screen name="Tabs">
          {() => (
            <Tabs
              user={user}
              sessionToken={sessionToken}
              onLogout={onLogout}
              onUserUpdated={onUserUpdated}
            />
          )}
        </Stack.Screen>
      )}
      <Stack.Screen name="Cart" component={Cart} />
      <Stack.Screen name="CheckoutDelivery" component={CheckoutDelivery} />
      <Stack.Screen name="CartCheckout" component={CartCheckout} />
      <Stack.Screen name="Product" component={Product} />
      <Stack.Screen
        name="CategoryProducts"
        component={CategoryProducts}
        options={({ route }) => ({
          headerShown: true,
          headerTitle: String(route.params?.headerLabel || 'Category'),
          ...themedNativeHeaderOptions(theme),
        })}
      />
      <Stack.Screen
        name="CommunityUserProfile"
        component={CommunityUserProfile}
        options={{
          headerShown: true,
          headerTitle: 'Member',
          ...themedNativeHeaderOptions(theme),
        }}
      />
    </Stack.Navigator>
  )
}

const getStyles = ({ theme, insets }: { theme: any; insets: any }) =>
  StyleSheet.create({
  container: {
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    flex: 1,
    paddingTop: insets.top + TAB_SHELL_TOP_EXTRA,
    paddingBottom: 0,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  },
  /**
   * Fills the home-indicator/system-bar strip under the floating tab pill.
   * Prevents translucent iOS production composition from showing a bright seam.
   */
  bottomSafeFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: insets.bottom + FLOATING_TAB_BAR_BOTTOM + 2,
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
  },
})
