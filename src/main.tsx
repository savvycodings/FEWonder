import { useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Home, Search, Profile, Shipping, Payment, Cart, Saved, Product, Chat, Settings, Login } from './screens'
import { Header } from './components'
import FeatherIcon from '@expo/vector-icons/Feather'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { ThemeContext } from './context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthPayload, User } from '../types'
import { logoutUser } from './utils'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()
const ProfileStack = createNativeStackNavigator()

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
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
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
      <ProfileStack.Screen name="Shipping" component={Shipping} />
      <ProfileStack.Screen name="Payment" component={Payment} />
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
          tabBarActiveTintColor: '#ffffff',
          tabBarInactiveTintColor: 'rgba(255, 255, 255, .6)',
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
            left: 12,
            right: 12,
            bottom: 8,
            height: 64,
            borderRadius: 18,
            borderTopWidth: 0,
            backgroundColor: '#2a335f',
            elevation: 6,
            shadowColor: '#2a335f',
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
          component={Home}
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
            unmountOnBlur: true,
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
            header: () => <Header showLogo={false} />,
            tabBarIcon: ({ color, size }) => (
              <FeatherIcon
                name="message-circle"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={Settings}
          options={{
            header: () => <Header />,
            tabBarIcon: ({ color, size }) => (
              <FeatherIcon
                name="sliders"
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
    <SafeAreaProvider>
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
      </Stack.Navigator>
    </SafeAreaProvider>
  )
}

const getStyles = ({ theme, insets } : { theme: any, insets: any}) => StyleSheet.create({
  container: {
    backgroundColor: '#f4f6fb',
    flex: 1,
    paddingTop: 0,
    paddingBottom: insets.bottom + 8,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  },
})
