import { signOut } from 'firebase/auth';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { firebaseAuth } from '../../firebase/firebaseConfig';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  seller: 'Satıcı',
  customer: 'Müşteri',
};

export default function SettingsScreen() {
  const { firebaseUser, roles } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

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

        <TouchableOpacity style={styles.logoutButton} onPress={() => signOut(firebaseAuth)} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
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
