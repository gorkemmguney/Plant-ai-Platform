import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabaseClient';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { badgeColors, colors, fonts, gradients, radius, shadow, spacing } from '../theme/theme';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  seller: 'Satıcı',
  customer: 'Müşteri',
};

export default function HomeScreen() {
  const { firebaseUser, roles } = useAuth();

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.brand}>PLANT AI</Text>
        </View>
        <Text style={styles.headerTitle}>Ana Sayfa</Text>
        <Text style={styles.headerSub}>{firebaseUser?.email}</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Hesap Bilgileri</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{firebaseUser?.email}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.rowLabel}>Roller</Text>
            <View style={styles.badgeRow}>
              {roles.length > 0 ? (
                roles.map((role) => (
                  <View key={role} style={[styles.badge, { backgroundColor: badgeColors.primary.bg }]}>
                    <Text style={[styles.badgeText, { color: badgeColors.primary.text }]}>
                      {roleLabels[role] ?? role}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.rowValue}>yükleniyor...</Text>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  logoMark: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(237,169,114,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  brand: { fontFamily: fonts.displaySemi, fontSize: 12, color: colors.white, letterSpacing: 1.2 },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.white, marginBottom: 2 },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: '#c9c9d6' },
  content: { flex: 1, padding: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
    marginBottom: spacing.lg,
  },
  cardLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowLast: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  rowValue: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10.5 },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.red },
});
