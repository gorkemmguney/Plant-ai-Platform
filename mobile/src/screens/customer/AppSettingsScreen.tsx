import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

export default function AppSettingsScreen({ navigation }: any) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uygulama Ayarları</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('HiddenOrders')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.ink} />
              <View>
                <Text style={styles.menuText}>Gizli Siparişleri Geri Getir</Text>
                <Text style={styles.menuSubText}>Şifre doğrulaması gerektirir</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  content: { flex: 1, padding: spacing.lg },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...shadow.sm,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  menuSubText: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: 2 },
});
