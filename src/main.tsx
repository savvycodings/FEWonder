import { useContext, useEffect, useMemo, useState } from 'react';
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
  Chat,
  Settings,
  ProfileAccountSettings,
  ProfileHeroEdit,
  RedeemCode,
  Login,
  DailyRewards,
  AdminOrdersLogin,
  AdminOrdersHub,
  AdminOrderDetail,
  AdminUserOrders,
  MyOrders,
  MyOrderDetail,
  CommunityUserProfile,
} from './screens'
import { WonderJump } from './screens/wonderJump'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeContext } from './context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthPayload, User } from '../types'
import { logoutUser } from './utils'

/** Tab shell padding below status bar; Search hero bleed should match. */
const TAB_SHELL_TOP_EXTRA = 6

/** Matches `tabBarStyle.borderRadius` — clips blur + tint to the floating pill. */
const TAB_BAR_RADIUS = 18
/** Horizontal inset from screen edge; tab bar width = window width − 2×inset (narrower pill). */
const TAB_BAR_SIDE_INSET_MIN = 48
const TAB_BAR_SIDE_INSET_MAX = 80
const TAB_BAR_SIDE_INSET_RATIO = 0.125

/**
 * Frosted charcoal glass behind the tab bar: native blur + grey/black wash (no green).
 */
function FrostedTabBarBackground() {
  /** Slightly stronger blur so content behind reads softer (platform caps differ). */
  const blurIntensity = Platform.OS === 'ios' ? 92 : Platform.OS === 'android' ? 58 : 78
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: TAB_BAR_RADIUS, overflow: 'hidden' }]}
    >
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(24, 24, 26, 0.62)', 'rgba(12, 12, 14, 0.7)', 'rgba(4, 4, 6, 0.66)']}
        locations={[0, 0.52, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: TAB_BAR_RADIUS,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      />
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
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
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
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      >
        {({ navigation }) => (
          <ProfileHeroEdit navigation={navigation} user={user} sessionToken={sessionToken} />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="Saved" component={Saved} />
      <ProfileStack.Screen name="ProfileCart" component={Cart} />
      <ProfileStack.Screen
        name="ProfileMyOrders"
        component={MyOrders}
        options={{
          headerShown: true,
          headerTitle: 'My orders',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="ProfileMyOrderDetail"
        component={MyOrderDetail}
        options={{
          headerShown: true,
          headerTitle: 'Order detail',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="ProfileSettings"
        options={{
          headerShown: true,
          headerTitle: 'Settings',
          headerBackTitle: '',
          headerStyle: {
            backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
          },
          headerTitleStyle: {
            color: theme.textColor,
            fontFamily: theme.boldFont,
          },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      >
        {() => (
          <Settings
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="ProfileAccountSettings"
        options={{
          headerShown: true,
          headerTitle: 'Profile',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      >
        {() => (
          <ProfileAccountSettings
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="Shipping"
        options={{
          headerShown: true,
          headerTitle: 'Shipping address',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      >
        {() => (
          <Shipping
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="Payment"
        options={{
          headerShown: true,
          headerTitle: 'Payments & billing',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      >
        {() => (
          <Payment
            user={user}
            sessionToken={sessionToken}
            onUserUpdated={onUserUpdated}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="RedeemCode"
        options={{
          headerShown: true,
          headerTitle: 'Redeem code',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      >
        {() => <RedeemCode sessionToken={sessionToken} />}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="ProfileDailyRewards" component={DailyRewards} />
      <ProfileStack.Screen
        name="AdminOrdersLogin"
        component={AdminOrdersLogin}
        options={{
          headerShown: true,
          headerTitle: 'Admin orders',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="AdminOrdersHub"
        component={AdminOrdersHub}
        options={{
          headerShown: true,
          headerTitle: 'Orders',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="AdminOrderDetail"
        component={AdminOrderDetail}
        options={{
          headerShown: true,
          headerTitle: 'Order',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="AdminUserOrders"
        component={AdminUserOrders}
        options={{
          headerShown: true,
          headerTitle: 'User orders',
          headerBackTitle: '',
          headerStyle: { backgroundColor: theme.appBackgroundColor || theme.backgroundColor },
          headerTitleStyle: { color: theme.textColor, fontFamily: theme.boldFont },
          headerTintColor: theme.textColor,
          headerShadowVisible: false,
        }}
      />
    </ProfileStack.Navigator>
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

  /** Stable component identity so Chat does not remount every Tabs render (would cancel hero timer). */
  const ChatTabScreen = useMemo(
    () =>
      function ChatTabScreen() {
        return <Chat user={user} sessionToken={sessionToken} />
      },
    [user, sessionToken]
  )

  return (
    <View style={styles.container}>
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
          tabBarItemStyle: {
            paddingVertical: 4,
          },
          tabBarBackground: () => <FrostedTabBarBackground />,
          tabBarStyle: {
            position: 'absolute',
            left: tabBarSideInset,
            right: tabBarSideInset,
            bottom: 8,
            height: 64,
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
            tabBarHideOnKeyboard: false,
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

export function Main() {
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

  async function onUserUpdated(nextUser: User) {
    const nextAuth: AuthPayload = { user: nextUser, sessionToken }
    await AsyncStorage.setItem('wonderport-auth', JSON.stringify(nextAuth))
    await AsyncStorage.setItem('wonderport-user', JSON.stringify(nextUser))
    setUser(nextUser)
  }

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
        <Stack.Screen name="Login">
          {() => <Login onAuthSuccess={onRegisterSuccess} />}
        </Stack.Screen>
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
      <Stack.Screen name="Product" component={Product} />
      <Stack.Screen
        name="CommunityUserProfile"
        component={CommunityUserProfile}
        options={{
          headerShown: true,
          headerBackTitle: '',
          headerTitle: 'Member',
        }}
      />
      <Stack.Screen name="WonderJump" component={WonderJump} />
    </Stack.Navigator>
  )
}

const getStyles = ({ theme, insets } : { theme: any, insets: any}) => StyleSheet.create({
  container: {
    backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
    flex: 1,
    paddingTop: insets.top + TAB_SHELL_TOP_EXTRA,
    paddingBottom: insets.bottom + 8,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  },
})
