import { useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  Login,
  DailyRewards,
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
      <ProfileStack.Screen name="Saved" component={Saved} />
      <ProfileStack.Screen name="ProfileCart" component={Cart} />
      <ProfileStack.Screen
        name="ProfileSettings"
        component={Settings}
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
      />
      <ProfileStack.Screen name="Shipping" component={Shipping} />
      <ProfileStack.Screen name="Payment" component={Payment} />
      <ProfileStack.Screen name="ProfileDailyRewards" component={DailyRewards} />
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
  const { theme } = useContext(ThemeContext)
  const styles = getStyles({ theme, insets })
  
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
          tabBarStyle: {
            position: 'absolute',
            left: 36,
            right: 36,
            bottom: 8,
            height: 64,
            borderRadius: 18,
            borderTopWidth: 1,
            borderColor: theme.tabBarBorderColor,
            backgroundColor:
              theme.tabBarBackgroundColor ||
              theme.tileActiveBackgroundColor ||
              '#111111',
            elevation: 6,
            shadowColor: theme.tabBarBackgroundColor || '#111111',
            shadowOpacity: 0.22,
            shadowRadius: 14,
            shadowOffset: {
              width: 0,
              height: 6,
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
          children={({ navigation }) => <Search navigation={navigation} user={user} />}
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
          children={() => <Chat user={user} sessionToken={sessionToken} />}
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
      <Stack.Screen name="Product" component={Product} />
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
