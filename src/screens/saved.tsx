import { useContext, useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppContext, ThemeContext } from '../context'
import { ProfilePageHeading, ProfileStackBackBar } from '../components'
import { formatMoney } from '../money'
import { brandAccentRgba } from '../brandAccent'
import { savedProductListKey } from '../productSave'

export function Saved({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = useMemo(() => getStyles(theme), [theme])
  const { savedItems, removeSavedItem } = useContext(AppContext)
  const insets = useSafeAreaInsets()

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
      <View style={[styles.container, styles.screenFill]}>
        <ProfileStackBackBar backLabel="Profile" />
        <ProfilePageHeading title="Saved items" />
        <View style={[styles.emptyBody, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.emptyIconWrap}>
            <FeatherIcon name="heart" size={28} color={theme.brandAccent} />
          </View>
          <Text style={styles.emptyTitle}>No saved items yet</Text>
          <Text style={styles.emptySub}>Tap the heart on a product page to save it here.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, styles.screenFill]}>
      <ProfileStackBackBar backLabel="Profile" />
      <ProfilePageHeading
        title="Saved items"
        right={<Text style={styles.count}>{savedItems.length} saved</Text>}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {savedItems.map((item) => {
          const thumb = thumbSource(item)
          return (
            <Pressable
              key={savedProductListKey(item)}
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
              <Pressable
                style={styles.removeButton}
                onPress={() => void removeSavedItem(item.id || item.title)}
              >
                <FeatherIcon name="x" size={14} color={theme.mutedForegroundColor || '#a8a8a8'} />
              </Pressable>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const getStyles = (theme: any) => {
  const L = (a: number) => brandAccentRgba(theme, a)
  return StyleSheet.create({
    container: {
      backgroundColor: theme.appBackgroundColor || theme.backgroundColor,
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
      color: theme.brandAccent,
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
      borderColor: L(0.4),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      color: theme.headingColor || theme.textColor || '#ffffff',
      fontFamily: 'Montserrat_700Bold',
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
}
