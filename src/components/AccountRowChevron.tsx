import { StyleSheet, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'

type AccountRowChevronProps = {
  /** Theme accent (e.g. `theme.tintColor`) — border, fill tint, and icon */
  accentColor: string
  size?: number
}

/**
 * Chevron-in-circle used on account-style list rows; reads as “tap here” using the active accent.
 */
export function AccountRowChevron({ accentColor, size = 16 }: AccountRowChevronProps) {
  return (
    <View style={[styles.wrap, { borderColor: accentColor }]}>
      <View style={[styles.fill, { backgroundColor: accentColor }]} pointerEvents="none" />
      <FeatherIcon name="chevron-right" size={size} color={accentColor} style={styles.icon} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
  },
  icon: {
    marginLeft: 1,
    zIndex: 1,
  },
})
