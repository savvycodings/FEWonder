import { useContext } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { AppContext, ThemeContext } from '../context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney } from '../money'

export function Saved({ navigation }: any) {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const { savedItems, removeSavedItem } = useContext(AppContext)
  const insets = useSafeAreaInsets()

  function thumbSource(item: any) {
    if (item?.featuredImageUrl && String(item.featuredImageUrl).trim()) {
      return { uri: String(item.featuredImageUrl).trim() }
    }
    if (item?.image) return item.image
    return null
  }

  if (!savedItems.length) {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyHeader, { top: insets.top + 8 }]}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <FeatherIcon name="arrow-left" size={18} color={theme.textColor} />
          </Pressable>
        </View>
        <View style={styles.emptyIconWrap}>
          <FeatherIcon name="heart" size={28} color={theme.tintColor} />
        </View>
        <Text style={styles.emptyTitle}>No saved items yet</Text>
        <Text style={styles.emptySub}>Tap the heart on a product page to save it here.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <FeatherIcon name="arrow-left" size={18} color={theme.textColor} />
        </Pressable>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Items</Text>
        <Text style={styles.count}>{savedItems.length} saved</Text>
      </View>

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
              <FeatherIcon name="x" size={14} color={theme.mutedForegroundColor} />
            </Pressable>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || '#f7f8fb',
    },
    content: {
      padding: 16,
      paddingBottom: 110,
    },
    topRow: {
      marginBottom: 8,
    },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.tileBackgroundColor || '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      color: theme.textColor,
      fontFamily: 'Geist-Bold',
      fontSize: 28,
    },
    count: {
      color: theme.mutedForegroundColor,
      fontFamily: 'Geist-Medium',
      fontSize: 12,
    },
    itemCard: {
      backgroundColor: theme.tileBackgroundColor || '#ffffff',
      borderRadius: 16,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      position: 'relative',
    },
    imageWrap: {
      width: 74,
      height: 74,
      borderRadius: 12,
      backgroundColor: theme.appBackgroundColor || '#eff3fa',
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
      backgroundColor: theme.appBackgroundColor || '#e4eaf5',
    },
    imagePlaceholderText: {
      color: theme.mutedForegroundColor,
      fontFamily: 'Geist-Bold',
      fontSize: 22,
    },
    itemBody: {
      flex: 1,
      marginLeft: 10,
    },
    itemTitle: {
      color: theme.textColor,
      fontFamily: 'Geist-SemiBold',
      fontSize: 15,
      marginBottom: 3,
    },
    itemCategory: {
      color: theme.mutedForegroundColor,
      fontFamily: 'Geist-Regular',
      fontSize: 12,
      marginBottom: 5,
    },
    itemPrice: {
      color: theme.textColor,
      fontFamily: 'Geist-Bold',
      fontSize: 14,
    },
    removeButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.appBackgroundColor || '#f2f5fb',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyWrap: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor || '#f7f8fb',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },
    emptyHeader: {
      position: 'absolute',
      left: 16,
      zIndex: 2,
    },
    emptyIconWrap: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: theme.tileBackgroundColor || '#edf1f8',
      borderWidth: 2,
      borderColor: theme.tintColor || theme.tileBorderColor,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      color: theme.textColor,
      fontFamily: 'Geist-Bold',
      fontSize: 22,
      marginBottom: 6,
    },
    emptySub: {
      color: theme.mutedForegroundColor,
      fontFamily: 'Geist-Regular',
      fontSize: 13,
      textAlign: 'center',
    },
  })
