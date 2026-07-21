import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabaseClient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

type Role = 'admin' | 'seller' | 'customer';

const roleInfo: Record<Role, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  admin: { title: 'Admin Paneli', subtitle: 'Kullanıcılar, onaylar, AI teşhis ve raporlar', icon: 'shield-checkmark' },
  seller: { title: 'Satıcı Paneli', subtitle: 'Ürünlerini ve siparişlerini yönet', icon: 'storefront' },
  customer: { title: 'Müşteri', subtitle: 'Alışveriş yap, AI ile bitkini analiz et', icon: 'leaf' },
};

export default function RoleSelectScreen() {
  const { roles, chooseRole } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Hangi panelle devam edelim?</Text>
        <Text style={styles.subtitle}>Birden fazla hesap türün var. Dilediğin zaman ayarlardan panel değiştirebilirsin.</Text>
      </View>

      <View style={styles.list}>
        {roles.map((role) => {
          const info = roleInfo[role];
          if (!info) return null;
          return (
            <TouchableOpacity
              key={role}
              style={styles.card}
              onPress={() => chooseRole(role)}
              activeOpacity={0.85}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={info.icon} size={22} color={colors.buttonPrimaryText} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{info.title}</Text>
                <Text style={styles.cardSubtitle}>{info.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted2} />
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.logoutLink} onPress={() => supabase.auth.signOut()} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, paddingTop: 72 },
  header: { marginBottom: spacing.xxl },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, lineHeight: 20 },
  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, marginBottom: 2 },
  cardSubtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  logoutLink: { alignItems: 'center', marginTop: spacing.xxl },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.red },
});
