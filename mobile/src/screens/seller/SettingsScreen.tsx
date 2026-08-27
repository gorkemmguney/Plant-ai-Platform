import { supabase } from '../../lib/supabaseClient';
import React, { useEffect, useState } from 'react';
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
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';
import appjson from '../../../app.json';

const roleLabelKeys: Record<string, string> = {
  admin: 'role.admin',
  seller: 'role.seller',
  customer: 'role.customer',
};

const sellerStatusInfo: Record<string, { labelKey: string; badge: keyof typeof badgeColors }> = {
  pending: { labelKey: 'sellerStatus.pending', badge: 'amber' },
  verified: { labelKey: 'sellerStatus.verified', badge: 'green' },
  rejected: { labelKey: 'sellerStatus.rejected', badge: 'red' },
};

export default function SettingsScreen({ navigation }: any) {
  const { firebaseUser, roles, sellerStatus, firstName, lastName, phoneNumber, storeName, storeAddress, bankIban, refreshProfile, chooseRole } = useAuth();
  const { t } = useI18n();
  const sellerInfo = sellerStatusInfo[sellerStatus];

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFirst, setFormFirst] = useState('');
  const [formLast, setFormLast] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStore, setFormStore] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formIban, setFormIban] = useState('');

  const openEdit = () => {
    setFormFirst(firstName);
    setFormLast(lastName);
    setFormPhone(phoneNumber);
    setFormStore(storeName);
    setFormAddress(storeAddress);
    setFormIban(bankIban);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!formFirst.trim()) {
      Alert.alert(t('settings.missingInfo'), t('settings.firstNameRequired'));
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch('/auth/me', {
        first_name: formFirst.trim(),
        last_name: formLast.trim(),
        phone_number: formPhone.trim(),
        store_name: formStore.trim(),
        store_address: formAddress.trim(),
        bank_iban: formIban.trim(),
      });
      await refreshProfile();
      setEditing(false);
    } catch (err: any) {
      Alert.alert(t('settings.saveFailed'), err?.response?.data?.detail ?? t('settings.profileUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('sellerSettings.title')}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 110 }}>
        <TouchableOpacity
          style={styles.profileCardBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('UserProfile')}
        >
          <View style={styles.profileBannerLeft}>
            <View style={styles.profileIconCircle}>
              <Ionicons name="storefront" size={24} color={colors.primaryDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileBannerTitle}>Mağaza Profil Hesabım</Text>
              <Text style={styles.profileBannerSub}>Mağaza puanı, yorumlar, rozetler ve bilgileriniz</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primaryDeep} />
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('sellerSettings.store')}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('sellerSettings.storeName')}</Text>
            <View style={styles.nameRight}>
              <Text style={styles.rowValue}>{storeName || t('sellerSettings.notSet')}</Text>
              <TouchableOpacity onPress={openEdit} activeOpacity={0.7}>
                <Text style={styles.editLink}>{t('settings.edit')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Mağaza Adresi</Text>
            <Text style={styles.rowValue}>{storeAddress || '—'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>IBAN Numarası</Text>
            <Text style={styles.rowValue}>{bankIban || '—'}</Text>
          </View>

          {sellerInfo && (
            <View style={styles.rowLast}>
              <Text style={styles.rowLabel}>{t('sellerSettings.sellerStatus')}</Text>
              <View style={[styles.badge, { backgroundColor: badgeColors[sellerInfo.badge].bg }]}>
                <Text style={[styles.badgeText, { color: badgeColors[sellerInfo.badge].text }]}>
                  {t(sellerInfo.labelKey)}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('settings.accountInfo')}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.fullName')}</Text>
            <View style={styles.nameRight}>
              <Text style={styles.rowValue}>{fullName || '—'}</Text>
              <TouchableOpacity onPress={openEdit} activeOpacity={0.7}>
                <Text style={styles.editLink}>{t('settings.edit')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.email')}</Text>
            <Text style={styles.rowValue}>{firebaseUser?.email}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Telefon</Text>
            <Text style={styles.rowValue}>{phoneNumber || '—'}</Text>
          </View>

          <View style={styles.rowLast}>
            <Text style={styles.rowLabel}>{t('settings.roles')}</Text>
            <View style={styles.badgeRow}>

              {roles.length > 0 ? (
                roles.map((role) => (
                  <View key={role} style={[styles.badge, { backgroundColor: badgeColors.primary.bg }]}>
                    <Text style={[styles.badgeText, { color: badgeColors.primary.text }]}>
                      {roleLabelKeys[role] ? t(roleLabelKeys[role]) : role}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.rowValue}>{t('settings.loading')}</Text>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.switchButton} onPress={() => navigation.navigate('SellerChatList')} activeOpacity={0.85}>
          <Ionicons name="chatbubbles-outline" size={16} color={colors.ink} />
          <Text style={styles.switchButtonText}>{t('sellerChat.title')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => navigation.navigate('Support', { sourcePanel: 'seller' })} activeOpacity={0.85}>
          <Ionicons name="help-buoy-outline" size={16} color={colors.ink} />
          <Text style={styles.switchButtonText}>{t('settings.support')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => navigation.navigate('AppSettings')} activeOpacity={0.85}>
          <Ionicons name="options-outline" size={16} color={colors.ink} />
          <Text style={styles.switchButtonText}>{t('settings.appSettings')}</Text>
        </TouchableOpacity>

        {roles.length > 1 && (
          <TouchableOpacity style={styles.switchButton} onPress={() => chooseRole(null)} activeOpacity={0.85}>
            <Ionicons name="swap-horizontal" size={16} color={colors.ink} />
            <Text style={styles.switchButtonText}>{t('settings.switchPanel')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>{t('settings.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}> {appjson.plantai?.version ?? '—'}</Text>
      </ScrollView>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('plantDetail.editProfile')}</Text>

            <Text style={styles.label}>{t('sellerSettings.storeName')}</Text>
            <TextInput
              style={styles.input}
              value={formStore}
              onChangeText={setFormStore}
              placeholder={t('sellerSettings.storePlaceholder')}
              placeholderTextColor={colors.muted2}
            />

            <Text style={styles.label}>Mağaza Adresi</Text>
            <TextInput
              style={styles.input}
              value={formAddress}
              onChangeText={setFormAddress}
              placeholder="Mağaza Adresi"
              placeholderTextColor={colors.muted2}
            />

            <Text style={styles.label}>IBAN Numarası</Text>
            <TextInput
              style={styles.input}
              value={formIban}
              onChangeText={setFormIban}
              placeholder="TRXX XXXX XXXX XXXX XXXX XXXX XX"
              placeholderTextColor={colors.muted2}
            />

            <Text style={styles.label}>{t('settings.firstName')}</Text>
            <TextInput
              style={styles.input}
              value={formFirst}
              onChangeText={setFormFirst}
              placeholder={t('settings.firstNamePlaceholder')}
              placeholderTextColor={colors.muted2}
            />

            <Text style={styles.label}>{t('settings.lastName')}</Text>
            <TextInput
              style={styles.input}
              value={formLast}
              onChangeText={setFormLast}
              placeholder={t('settings.lastNamePlaceholder')}
              placeholderTextColor={colors.muted2}
            />

            <Text style={styles.label}>Telefon Numarası</Text>
            <TextInput
              style={styles.input}
              value={formPhone}
              onChangeText={setFormPhone}
              placeholder="05XX XXX XX XX"
              keyboardType="phone-pad"
              placeholderTextColor={colors.muted2}
            />


            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveText}>{t('settings.save')}</Text>
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
  versionText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted2,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
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
  profileCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  profileBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm },
  profileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  profileBannerTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  profileBannerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
});
