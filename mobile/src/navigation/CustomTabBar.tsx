import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../theme/theme';

export interface TabBarIconMap {
  [routeName: string]: { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap };
}

export interface TabBarLabelMap {
  [routeName: string]: string;
}

interface Props extends BottomTabBarProps {
  icons: TabBarIconMap;
  labels: TabBarLabelMap;
}


export default function CustomTabBar({ state, navigation, icons }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView intensity={50} tint="light" style={[styles.bar, { bottom: Math.max(insets.bottom, 18) }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const iconSet = icons[route.name];
        const iconName = iconSet ? (isFocused ? iconSet.active : iconSet.inactive) : 'ellipse-outline';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.8}
            style={[styles.icon, isFocused && styles.iconActive]}
          >
            <Ionicons name={iconName} size={22} color={isFocused ? colors.white : colors.ink} />
          </TouchableOpacity>
        );
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 22,
    right: 22,
    height: 72,
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBar,
    ...shadow.md,
  },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
});
