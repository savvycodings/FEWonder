import { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import FeatherIcon from '@expo/vector-icons/Feather'
import { provinceDisplayValue, SOUTH_AFRICA_PROVINCES } from '../southAfricaProvinces'

const OPTION_ROW_HEIGHT = 44
const LIST_HEIGHT = OPTION_ROW_HEIGHT * SOUTH_AFRICA_PROVINCES.length
const ANIM_DURATION_MS = 280

const OPEN_EASING = Easing.bezier(0.4, 0, 0.2, 1)
const CLOSE_EASING = Easing.bezier(0.4, 0, 0.6, 1)

type Props = {
  theme: any
  value: string
  onChange: (province: string) => void
  placeholder?: string
  hasError?: boolean
  variant?: 'profile' | 'checkout'
}

export function ProvinceSelectField({
  theme,
  value,
  onChange,
  placeholder = 'Select province',
  hasError = false,
  variant = 'profile',
}: Props) {
  const [open, setOpen] = useState(false)
  const progress = useSharedValue(0)
  const styles = useMemo(() => getStyles(theme, variant), [theme, variant])
  const selected = provinceDisplayValue(value)

  const listAnimatedStyle = useAnimatedStyle(() => ({
    height: LIST_HEIGHT * progress.value,
  }))

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }))

  const elevationStyle = useAnimatedStyle(() => ({
    elevation: progress.value > 0.01 ? 8 : 0,
  }))

  function setExpanded(next: boolean) {
    setOpen(next)
    progress.value = withTiming(next ? 1 : 0, {
      duration: ANIM_DURATION_MS,
      easing: next ? OPEN_EASING : CLOSE_EASING,
    })
  }

  function toggleOpen() {
    setExpanded(!open)
  }

  function selectProvince(province: string) {
    onChange(province)
    setExpanded(false)
  }

  return (
    <Animated.View
      style={[styles.wrapper, open && styles.wrapperOpen, elevationStyle]}
      collapsable={false}
    >
      <View style={[styles.container, hasError && styles.containerError]}>
        <Pressable
          style={styles.trigger}
          onPress={toggleOpen}
          accessibilityRole="button"
          accessibilityLabel="Province"
          accessibilityState={{ expanded: open }}
        >
          <Text
            style={[styles.triggerText, !selected && styles.triggerPlaceholder]}
            numberOfLines={1}
          >
            {selected || placeholder}
          </Text>
          <Animated.View style={chevronAnimatedStyle}>
            <FeatherIcon
              name="chevron-down"
              size={20}
              color={theme.mutedForegroundColor || theme.textColor}
            />
          </Animated.View>
        </Pressable>

        <Animated.View
          style={[styles.listClip, listAnimatedStyle]}
          pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
        >
          <View style={styles.listInner}>
            {SOUTH_AFRICA_PROVINCES.map((item, index) => {
              const isSelected = selected.toLowerCase() === item.toLowerCase()
              return (
                <Pressable
                  key={item}
                  style={[
                    styles.optionRow,
                    index > 0 && styles.optionRowBorder,
                    isSelected && styles.optionRowSelected,
                  ]}
                  onPress={() => selectProvince(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {item}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

function getStyles(theme: any, variant: 'profile' | 'checkout') {
  const isProfile = variant === 'profile'
  const border = theme.tileBorderColor || theme.borderColor || 'rgba(255,255,255,0.12)'
  const surface = isProfile
    ? theme.appBackgroundColor || theme.backgroundColor
    : theme.frameInnerBackgroundColor || theme.tileBackgroundColor || '#FFFFFF'
  const radius = isProfile ? 10 : 12

  return StyleSheet.create({
    wrapper: {
      marginBottom: isProfile ? 10 : 4,
      position: 'relative',
    },
    wrapperOpen: {
      zIndex: 50,
      ...(Platform.OS === 'web'
        ? {
            // Keep dropdown above scroll siblings on web.
            position: 'relative' as const,
          }
        : null),
    },
    container: {
      borderWidth: 1,
      borderColor: border,
      borderRadius: radius,
      backgroundColor: surface,
      overflow: 'hidden',
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : null),
    },
    containerError: {
      borderColor: '#ef4444',
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    triggerText: {
      flex: 1,
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: theme.textColor,
      marginRight: 8,
    },
    triggerPlaceholder: {
      color: theme.mutedForegroundColor,
    },
    listClip: {
      overflow: 'hidden',
    },
    listInner: {
      height: LIST_HEIGHT,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: border,
    },
    optionRow: {
      height: OPTION_ROW_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    optionRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: border,
    },
    optionRowSelected: {
      backgroundColor: `${theme.brandAccent}14`,
    },
    optionText: {
      fontFamily: theme.mediumFont,
      fontSize: 15,
      color: theme.textColor,
    },
    optionTextSelected: {
      fontFamily: theme.semiBoldFont,
      color: theme.brandAccent,
    },
  })
}
