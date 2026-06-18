import { useMemo } from 'react'
import {
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { WonderportAccentCard } from './WonderportAccentCard'
import { ProductTileImageWithHeart } from './ProductTileImageWithHeart'
import type { ProductSavePayload } from './ProductImageSaveHeart'
import type { ShopifyMoney } from '../../types'
import { formatMoney } from '../money'

/** Two-line title slot — keeps price pills aligned across grid rows. */
export const PRODUCT_GRID_TILE_TITLE_LINE_HEIGHT = 18
export const PRODUCT_GRID_TILE_TITLE_LINES = 2
export const PRODUCT_GRID_TILE_TITLE_SLOT_HEIGHT =
  PRODUCT_GRID_TILE_TITLE_LINE_HEIGHT * PRODUCT_GRID_TILE_TITLE_LINES

export const PRODUCT_GRID_MEDIA_HEIGHT = 250

const ACCENT_ON_BADGE_TEXT = '#ffffff'

export function productGridPriceLabel(price: ShopifyMoney | null | undefined): string {
  if (price?.amount != null && String(price.amount).trim() !== '') {
    return formatMoney(price)
  }
  return 'View details'
}

type ProductGridTileProps = {
  theme: any
  cardWidth: number
  frameFill: string
  title: string
  priceLabel: string
  savePayload: ProductSavePayload
  imageSource?: ImageSourcePropType
  onPress: () => void
}

export function ProductGridTile({
  theme,
  cardWidth,
  frameFill,
  title,
  priceLabel,
  savePayload,
  imageSource,
  onPress,
}: ProductGridTileProps) {
  const styles = useMemo(() => getStyles(theme), [theme])

  return (
    <WonderportAccentCard
      style={{ width: cardWidth, alignSelf: 'stretch' }}
      borderVariant="solid"
      borderWidth={2}
      borderRadius={18}
      innerBackgroundColor={frameFill}
      contentStyle={styles.cardFrameInner}
    >
      {imageSource ? (
        <ProductTileImageWithHeart
          product={savePayload}
          source={imageSource}
          resizeMode="cover"
          imageTranslateY={0}
          wrapStyle={styles.media}
          imageStyle={styles.mediaImage}
          onPress={onPress}
        />
      ) : (
        <Pressable style={styles.media} onPress={onPress}>
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaPlaceholderText} numberOfLines={2} ellipsizeMode="tail">
              {title}
            </Text>
          </View>
        </Pressable>
      )}

      <View style={styles.footerBand}>
        <Pressable style={styles.cardFooter} onPress={onPress}>
          <View style={styles.titleSlot}>
            <Text style={styles.itemTitle} numberOfLines={2} ellipsizeMode="tail">
              {title}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <View style={styles.pricePill}>
              <Text
                style={styles.pricePillText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {priceLabel}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    </WonderportAccentCard>
  )
}

function getStyles(theme: any) {
  return StyleSheet.create({
    cardFrameInner: {
      flexGrow: 1,
      flexDirection: 'column',
      alignSelf: 'stretch',
      paddingHorizontal: 4,
      paddingTop: 4,
      paddingBottom: 4,
    },
    media: {
      position: 'relative',
      width: '100%',
      height: PRODUCT_GRID_MEDIA_HEIGHT,
      paddingTop: 6,
      overflow: 'hidden',
      backgroundColor: theme.tileBackgroundColor || theme.secondaryBackgroundColor,
      borderRadius: 14,
    },
    mediaImage: {
      width: '100%',
      height: '100%',
    },
    mediaPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
    },
    mediaPlaceholderText: {
      color: theme.headingColor || theme.textColor,
      fontFamily: theme.semiBoldFont,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    footerBand: {
      flexGrow: 1,
      minHeight: PRODUCT_GRID_TILE_TITLE_SLOT_HEIGHT + 44,
    },
    cardFooter: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 8,
    },
    titleSlot: {
      height: PRODUCT_GRID_TILE_TITLE_SLOT_HEIGHT,
      justifyContent: 'flex-start',
    },
    itemTitle: {
      color: theme.headingColor || theme.textColor,
      fontFamily: theme.boldFont,
      fontSize: 14,
      lineHeight: PRODUCT_GRID_TILE_TITLE_LINE_HEIGHT,
      letterSpacing: -0.15,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: 8,
    },
    pricePill: {
      backgroundColor: theme.brandAccent,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
      flexShrink: 0,
      maxWidth: '100%',
    },
    pricePillText: {
      color: ACCENT_ON_BADGE_TEXT,
      fontFamily: theme.boldFont,
      fontSize: 13,
      lineHeight: 16,
    },
  })
}
