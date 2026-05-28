import { useContext, useMemo } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import FeatherIcon from '@expo/vector-icons/Feather'
import { ThemeContext } from '../context'
import { brandAccentRgba } from '../brandAccent'
import {
  PROFILE_BANNER_COLOR_OPTIONS,
  isProfileBannerColorSelected,
  isProfileBannerImageUri,
} from '../profileHeroBanner'

type Props = {
  visible: boolean
  selectedBannerUri: string | null
  onClose: () => void
  onPickGallery: () => void
  onPickColor: (hex: string) => void
  onUseDefault: () => void
}

export function ProfileHeroBannerPickerModal({
  visible,
  selectedBannerUri,
  onClose,
  onPickGallery,
  onPickColor,
  onUseDefault,
}: Props) {
  const { theme } = useContext(ThemeContext)
  const { width: screenWidth } = useWindowDimensions()
  const styles = useMemo(() => buildStyles(theme), [theme])
  const swatchGap = 10
  const swatchColumns = 4
  const sheetPad = 20
  const swatchSize = Math.floor(
    (Math.min(screenWidth, 420) - sheetPad * 2 - swatchGap * (swatchColumns - 1)) / swatchColumns,
  )
  const hasCustomBanner = Boolean(selectedBannerUri?.trim())

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Choose banner</Text>
          <Text style={styles.subtitle}>Pick a photo from your gallery or a solid color.</Text>

          <Pressable
            style={styles.galleryRow}
            onPress={() => {
              onClose()
              onPickGallery()
            }}
          >
            <View style={styles.galleryIconWrap}>
              <FeatherIcon name="image" size={20} color={theme.brandAccent} />
            </View>
            <View style={styles.galleryTextWrap}>
              <Text style={styles.galleryTitle}>Choose from gallery</Text>
              <Text style={styles.galleryCaption}>
                {isProfileBannerImageUri(selectedBannerUri)
                  ? 'Photo banner active'
                  : 'Use your own image'}
              </Text>
            </View>
            <FeatherIcon name="chevron-right" size={20} color={theme.mutedForegroundColor} />
          </Pressable>

          {hasCustomBanner ? (
            <Pressable style={styles.defaultRow} onPress={onUseDefault}>
              <FeatherIcon name="rotate-ccw" size={18} color={theme.brandAccent} />
              <Text style={styles.defaultRowText}>Use default Wonder Red</Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionLabel}>Solid colors</Text>
          <ScrollView
            style={styles.colorScroll}
            contentContainerStyle={styles.colorGrid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {PROFILE_BANNER_COLOR_OPTIONS.map((option) => {
              const selected = isProfileBannerColorSelected(selectedBannerUri, option.hex)
              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.swatch,
                    {
                      width: swatchSize,
                      height: swatchSize,
                      backgroundColor: option.hex,
                    },
                    selected ? styles.swatchSelected : null,
                  ]}
                  onPress={() => onPickColor(option.hex)}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} banner color`}
                >
                  {selected ? (
                    <View style={styles.swatchCheck}>
                      <FeatherIcon name="check" size={16} color="#ffffff" />
                    </View>
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function buildStyles(theme: any) {
  const L = (a: number) => brandAccentRgba(theme, a)
  const cardFill = theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: cardFill,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
      maxHeight: '78%',
      borderWidth: 1,
      borderColor: theme.tileBorderColor || theme.borderColor,
    },
    title: {
      color: theme.textColor,
      fontFamily: 'Geist-SemiBold',
      fontSize: 18,
    },
    subtitle: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 16,
    },
    galleryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: L(0.06),
      borderWidth: 1,
      borderColor: L(0.2),
      marginBottom: 10,
    },
    galleryIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: L(0.1),
    },
    galleryTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    galleryTitle: {
      color: theme.textColor,
      fontFamily: 'Geist-SemiBold',
      fontSize: 15,
    },
    galleryCaption: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.regularFont,
      fontSize: 12,
      marginTop: 2,
    },
    defaultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      marginBottom: 6,
    },
    defaultRowText: {
      color: theme.brandAccent,
      fontFamily: theme.mediumFont,
      fontSize: 14,
    },
    sectionLabel: {
      color: theme.textColor,
      fontFamily: 'Geist-SemiBold',
      fontSize: 14,
      marginTop: 8,
      marginBottom: 10,
    },
    colorScroll: {
      maxHeight: 220,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingBottom: 8,
    },
    swatch: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchSelected: {
      borderWidth: 2,
      borderColor: theme.brandAccent,
    },
    swatchCheck: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      marginTop: 12,
      alignItems: 'center',
      paddingVertical: 12,
    },
    cancelButtonText: {
      color: theme.mutedForegroundColor,
      fontFamily: theme.mediumFont,
      fontSize: 15,
    },
  })
}
