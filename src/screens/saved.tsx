import { useContext } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { AppContext } from '../context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney } from '../money'

export function Saved({ navigation }: any) {
  const styles = getStyles()
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
            <FeatherIcon name="arrow-left" size={18} color="#ffffff" />
          </Pressable>
        </View>
        <View style={styles.emptyIconWrap}>
          <FeatherIcon name="heart" size={28} color="#E53935" />
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
          <FeatherIcon name="arrow-left" size={18} color="#ffffff" />
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
              <FeatherIcon name="x" size={14} color="#a8a8a8" />
            </Pressable>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const getStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
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
      backgroundColor: '#2a2a2a',
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
      color: '#ffffff',
      fontFamily: 'Geist-Bold',
      fontSize: 28,
    },
    count: {
      color: '#a8a8a8',
      fontFamily: 'Geist-Medium',
      fontSize: 12,
    },
    itemCard: {
      backgroundColor: '#1a1a1a',
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
      backgroundColor: '#2a2a2a',
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
      backgroundColor: '#2a2a2a',
    },
    imagePlaceholderText: {
      color: '#a8a8a8',
      fontFamily: 'Geist-Bold',
      fontSize: 22,
    },
    itemBody: {
      flex: 1,
      marginLeft: 10,
    },
    itemTitle: {
      color: '#ffffff',
      fontFamily: 'Geist-SemiBold',
      fontSize: 15,
      marginBottom: 3,
    },
    itemCategory: {
      color: '#a8a8a8',
      fontFamily: 'Geist-Regular',
      fontSize: 12,
      marginBottom: 5,
    },
    itemPrice: {
      color: '#ffffff',
      fontFamily: 'Geist-Bold',
      fontSize: 14,
    },
    removeButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#2a2a2a',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyWrap: {
      flex: 1,
      backgroundColor: '#000000',
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
      backgroundColor: '#1a1a1a',
      borderWidth: 2,
      borderColor: 'rgba(229, 57, 53, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      color: '#ffffff',
      fontFamily: 'Geist-Bold',
      fontSize: 22,
      marginBottom: 6,
    },
    emptySub: {
      color: '#a8a8a8',
      fontFamily: 'Geist-Regular',
      fontSize: 13,
      textAlign: 'center',
    },
  })
