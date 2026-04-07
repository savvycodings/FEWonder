import { useContext } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { AppContext } from '../context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatMoney } from '../money'

export function Saved({ navigation }: any) {
  const { savedItems, removeSavedItem } = useContext(AppContext)
  const insets = useSafeAreaInsets()

  if (!savedItems.length) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <FeatherIcon name="heart" size={28} color="#f08080" />
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
      <View style={styles.header}>
        <Text style={styles.title}>Saved Items</Text>
        <Text style={styles.count}>{savedItems.length} saved</Text>
      </View>

      {savedItems.map((item) => (
        <Pressable
          key={item.title}
          style={styles.itemCard}
          onPress={() => navigation.navigate('Product', { product: item })}
        >
          <View style={styles.imageWrap}>
            <Image
              source={item.featuredImageUrl ? { uri: item.featuredImageUrl } : item.image}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          <View style={styles.itemBody}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemCategory}>{item.category || 'Collectible'}</Text>
            <Text style={styles.itemPrice}>
              {item.price && typeof item.price === 'object' ? formatMoney(item.price) : String(item.price || '')}
            </Text>
          </View>
          <Pressable
            style={styles.removeButton}
            onPress={() => removeSavedItem(item.title)}
          >
            <FeatherIcon name="x" size={14} color="#8f97ad" />
          </Pressable>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#243056',
    fontFamily: 'Geist-Bold',
    fontSize: 28,
  },
  count: {
    color: '#8f97ad',
    fontFamily: 'Geist-Medium',
    fontSize: 12,
  },
  itemCard: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#eff3fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemBody: {
    flex: 1,
    marginLeft: 10,
  },
  itemTitle: {
    color: '#2a3359',
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    marginBottom: 3,
  },
  itemCategory: {
    color: '#8f97ad',
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    marginBottom: 5,
  },
  itemPrice: {
    color: '#f5a25d',
    fontFamily: 'Geist-Bold',
    fontSize: 14,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f2f5fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    backgroundColor: '#f7f8fb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#ffecef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#2a3359',
    fontFamily: 'Geist-Bold',
    fontSize: 22,
    marginBottom: 6,
  },
  emptySub: {
    color: '#8f97ad',
    fontFamily: 'Geist-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
})
