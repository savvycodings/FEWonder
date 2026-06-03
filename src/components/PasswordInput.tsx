import { useContext, useMemo, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'

type PasswordInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>
}

export function PasswordInput({ style, containerStyle, ...rest }: PasswordInputProps) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const [visible, setVisible] = useState(false)

  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        {...rest}
        style={[styles.input, style as StyleProp<TextStyle>]}
        secureTextEntry={!visible}
        autoCapitalize={rest.autoCapitalize ?? 'none'}
        autoCorrect={rest.autoCorrect ?? false}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={8}
      >
        <FeatherIcon
          name={visible ? 'eye-off' : 'eye'}
          size={20}
          color={theme.mutedForegroundColor || '#a8a8a8'}
        />
      </Pressable>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    wrap: {
      position: 'relative',
      justifyContent: 'center',
    },
    input: {
      paddingRight: 44,
    },
    toggle: {
      position: 'absolute',
      right: 12,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
  })
}
