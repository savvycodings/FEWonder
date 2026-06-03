import { ReactNode, useContext, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ThemeContext } from '../context'

type ProfilePageHeadingProps = {
  title: string
  /** e.g. item count or “Clear” — sits on the same row as the title */
  right?: ReactNode
  /** Parent already applies horizontal padding (e.g. Settings scroll). */
  flush?: boolean
}

/** Large Montserrat title + brand accent rule (matches Settings / My orders). */
export function ProfilePageHeading({ title, right, flush }: ProfilePageHeadingProps) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <View style={[styles.wrap, flush && styles.wrapFlush]}>
      <View style={[styles.titleRow, !right && styles.titleRowSolo]}>
        <Text style={styles.pageTitle} numberOfLines={2}>
          {title}
        </Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <View style={styles.accentRule} />
    </View>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
    },
    wrapFlush: {
      paddingHorizontal: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    titleRowSolo: {
      marginBottom: 8,
    },
    pageTitle: {
      flex: 1,
      minWidth: 0,
      color: theme.headingColor || theme.textColor,
      fontFamily: 'Montserrat_700Bold',
      fontSize: 30,
    },
    right: {
      flexShrink: 0,
      marginLeft: 12,
    },
    accentRule: {
      width: 62,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.brandAccent,
      marginBottom: 12,
    },
  })
}
