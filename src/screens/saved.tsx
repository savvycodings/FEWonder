import { useContext, useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppContext, ThemeContext } from '../context'
import { formatMoney } from '../money'

/** Matches Home / Profile accent */
const ACCENT = '#CBFF00'
/** Montserrat — registered in App.tsx `useFonts` */
const HEADING_FONT = 'Montserrat_700Bold' as const

export function Saved({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const { savedItems, removeSavedItem } = useContext(AppContext)
  const insets = useSafeAreaInsets()
  const iconColor = theme.textColor || '#ffffff'

  function thumbSource(item: any) {
    if (item?.featuredImageUrl && String(item.featuredImageUrl).trim()) {
      return { uri: String(item.featuredImageUrl).trim() }
    }
    if (item?.image) return item.image
    return null
  }

  const scrollBottomPad = 110 + insets.bottom

  if (!savedItems.length) {
    return (
      <SafeAreaView style={[styles.container, styles.screenFill]} edges={['top', 'left', 'right']}>
        <View style={styles.topNavRow}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <FeatherIcon name="arrow-left" size={20} color={iconColor} />
              </Pressable>
              <Text style={styles.title} numberOfLines={1}>
                Saved Items
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.emptyBody, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.emptyIconWrap}>
            <FeatherIcon name="heart" size={28} color={ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>No saved items yet</Text>
          <Text style={styles.emptySub}>Tap the heart on a product page to save it here.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, styles.screenFill]} edges={['top', 'left', 'right']}>
      <View style={styles.topNavRow}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <FeatherIcon name="arrow-left" size={20} color={iconColor} />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              Saved Items
            </Text>
          </View>
          <Text style={styles.count}>{savedItems.length} saved</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {savedItems.map((item) => {
          const thumb = thumbSource(item)
          return (
            <Pressable
              key={item.title}
              style={styles.itemCard}
              onPress={() => navigation.navigate('Product', { product: item })}
            >
              <View style={styles.imageWrap}>
                {thumb ? (
                  <Image source={thumb} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>{String(item.title || '?').slice(0, 1)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemCategory}>{item.category || item.productType || 'Collectible'}</Text>
                <Text style={styles.itemPrice}>
                  {item.price && typeof item.price === 'object' ? formatMoney(item.price) : String(item.price || '')}
                </Text>
              </View>
              <Pressable style={styles.removeButton} onPress={() => removeSavedItem(item.title)}>
                <FeatherIcon name="x" size={14} color={theme.mutedForegroundColor || '#a8a8a8'} />
              </Pressable>
            </Pressable>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor || '#000000',
    },
    screenFill: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    topNavRow: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    header: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      marginRight: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#2a2a2a',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.12)',
    },
    title: {
      flex: 1,
      minWidth: 0,
      color: theme.headingColor || theme.textColor || '#ffffff',
      fontFamily: HEADING_FONT,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.25,
    },
    count: {
      flexShrink: 0,
      color: theme.mutedForegroundColor || '#a8a8a8',
      fontFamily: theme.mediumFont,
      fontSize: 12,
    },
    itemCard: {
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#1a1a1a',
      borderRadius: 16,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      position: 'relative',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.1)',
    },
    imageWrap: {
      width: 74,
      height: 74,
      borderRadius: 12,
      backgroundColor: theme.secondaryBackgroundColor || '#2a2a2a',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.secondaryBackgroundColor || '#2a2a2a',
    },
    imagePlaceholderText: {
      color: theme.mutedForegroundColor || '#a8a8a8',
      fontFamily: theme.boldFont,
      fontSize: 22,
    },
    itemBody: {
      flex: 1,
      marginLeft: 10,
    },
    itemTitle: {
      color: theme.textColor || '#ffffff',
      fontFamily: theme.semiBoldFont,
      fontSize: 15,
      marginBottom: 3,
    },
    itemCategory: {
      color: theme.mutedForegroundColor || '#a8a8a8',
      fontFamily: theme.regularFont,
      fontSize: 12,
      marginBottom: 5,
    },
    itemPrice: {
      color: ACCENT,
      fontFamily: theme.boldFont,
      fontSize: 14,
    },
    removeButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#2a2a2a',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.08)',
    },
    emptyBody: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },
    emptyIconWrap: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor || '#1a1a1a',
      borderWidth: 2,
      borderColor: 'rgba(203, 255, 0, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      color: theme.headingColor || theme.textColor || '#ffffff',
      fontFamily: HEADING_FONT,
      fontSize: 22,
      lineHeight: 28,
      marginBottom: 6,
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    emptySub: {
      color: theme.mutedForegroundColor || '#a8a8a8',
      fontFamily: theme.regularFont,
      fontSize: 13,
      textAlign: 'center',
    },
  })
