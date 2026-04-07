import {
  StyleSheet, View, TouchableHighlight
} from 'react-native'
import { useContext } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Icon } from './Icon'
import { ThemeContext, AppContext } from '../../src/context'
import FontAwesome from '@expo/vector-icons/FontAwesome5'

export function Header({ showLogo = true }: { showLogo?: boolean }) {
  const { theme } = useContext(ThemeContext)
  const {
    handlePresentModalPress
  } = useContext(AppContext)
  const styles = getStyles(theme)

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: theme.backgroundColor, borderBottomColor: theme.borderColor }]}
    >
      <View style={styles.container}>
        {showLogo ? (
          <Icon size={34} fill={theme.textColor} />
        ) : (
          <View style={styles.logoSpacer} />
        )}
        <TouchableHighlight
          style={styles.buttonContainer}
          underlayColor={'transparent'}
          activeOpacity={0.6}
          onPress={handlePresentModalPress}
        >
          <FontAwesome
            name="ellipsis-h"
            size={20}
            color={theme.textColor}
          />
        </TouchableHighlight>
      </View>
    </SafeAreaView>
  )
}

function getStyles(theme:any) {
  return StyleSheet.create({
    safe: {
      borderBottomWidth: 1,
    },
    buttonContainer: {
      position: 'absolute', right: 15,
      padding: 15
    },
    container: {
      minHeight: 44,
      paddingVertical: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoSpacer: {
      width: 34,
      height: 34,
    }
  })
}