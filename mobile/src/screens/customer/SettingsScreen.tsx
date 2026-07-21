import { supabase } from '../../lib/supabaseClient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  seller: 'Satıcı',
  customer: 'Müşteri',
};

const sellerStatusInfo: Record<string, { label: string; badge: keyof typeof badgeColors }> = {
  pending: { label: 'Onay bekliyor', badge: 'amber' },
  verified: { label: 'Onaylandı', badge: 'green' },
  rejected: { label: 'Reddedildi', badge: 'red' },
};

export default function SettingsScreen({ navigation }: any) {
  const { firebaseUser, roles, sellerStatus, firstName, lastName, refreshProfile, chooseRole } = useAuth();
  const sellerInfo = sellerStatusInfo[sellerStatus];

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFirst, setFormFirst] = useState('');
  const [formLast, setFormLast] = useState('');

  const openEdit = () => {
    setFormFirst(firstName);
    setFormLast(lastName);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!formFirst.trim()) {
      Alert.alert('Eksik bilgi', 'Ad boş olamaz.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch('/auth/me', {
        first_name: formFirst.trim(),
        last_name: formLast.trim(),
      });
      await refreshProfile();
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Kaydedilemedi', err?.response?.data?.detail ?? 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Hesap Bilgileri</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Ad Soyad</Text>
            <View style={styles.nameRight}>
              <Text style={styles.rowValue}>{fullName || '—'}</Text>
              <TouchableOpacity onPress={openEdit} activeOpacity={0.7}>
                <Text style={styles.editLink}>Düzenle</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{firebaseUser?.email}</Text>
          </View>

          <View style={sellerInfo ? styles.row : styles.rowLast}>
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

          {sellerInfo && (
            <View style={styles.rowLast}>
              <Text style={styles.rowLabel}>Satıcı başvurusu</Text>
              <View style={[styles.badge, { backgroundColor: badgeColors[sellerInfo.badge].bg }]}>
                <Text style={[styles.badgeText, { color: badgeColors[sellerInfo.badge].text }]}>
                  {sellerInfo.label}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Orders')} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="receipt-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>Siparişlerim</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('MyReviews')} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="star-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>Değerlendirmelerim</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
        </View>

        {roles.length > 1 && (
          <TouchableOpacity style={styles.switchButton} onPress={() => chooseRole(null)} activeOpacity={0.85}>
            <Ionicons name="swap-horizontal" size={16} color={colors.ink} />
            <Text style={styles.switchButtonText}>Panel Değiştir</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ad Soyad Düzenle</Text>

            <Text style={styles.label}>Ad</Text>
            <TextInput
              style={styles.input}
              value={formFirst}
              onChangeText={setFormFirst}
              placeholder="Adın"
              placeholderTextColor={colors.muted2}
            />

            <Text style={styles.label}>Soyad</Text>
            <TextInput
              style={styles.input}
              value={formLast}
              onChangeText={setFormLast}
              placeholder="Soyadın"
              placeholderTextColor={colors.muted2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
                <Text style={styles.cancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  nameRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  editLink: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.primaryDeep },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10.5 },
  switchButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  switchButtonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.red },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: spacing.lg },
  label: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  saveButton: {
    flex: 1,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...shadow.sm,
    marginBottom: spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuDivider: { height: 1, backgroundColor: colors.borderSoft },
  menuText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
});
