import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../theme/theme';

export default function MarketplaceScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>🛒</Text>
      <Text style={styles.title}>Satış Platformu</Text>
      <Text style={styles.subtitle}>
        Tüm ilanları filtreleyip inceleyebileceğin, favorileyip satıcıyla iletişime geçebileceğin alan yakında burada.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
