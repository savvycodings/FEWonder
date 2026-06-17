import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useContext } from 'react'
import { ThemeContext } from '../context'

export function ProductSoldOutOverlay() {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <View style={styles.overlay} pointerEvents="none" accessibilityRole="text" accessibilityLiveRegion="polite">
      <Text style={styles.heading}>SOLD OUT</Text>
      <Text style={styles.subcopy}>
        Add to your favourites and get notified when this item is available again.
      </Text>
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: theme.modalOverlayColor || 'rgba(0, 0, 0, 0.55)',
    },
    heading: {
      fontFamily: theme.boldFont || theme.semiBoldFont,
      fontSize: 28,
      letterSpacing: 4,
      color: '#ffffff',
      textAlign: 'center',
      marginBottom: 10,
    },
    subcopy: {
      fontFamily: theme.regularFont,
      fontSize: 13,
      lineHeight: 18,
      color: 'rgba(255,255,255,0.92)',
      textAlign: 'center',
      maxWidth: 280,
    },
  })
}
