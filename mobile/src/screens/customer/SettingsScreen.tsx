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
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';
import appjson from '../../../app.json';

// Rol ve satıcı durumu etiketleri i18n anahtarlarıyla tutulur, render sırasında t() ile çevrilir.
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
  const [formStoreName, setFormStoreName] = useState('');
  const [formStoreAddress, setFormStoreAddress] = useState('');
  const [formBankIban, setFormBankIban] = useState('');

  const openEdit = () => {
    setFormFirst(firstName);
    setFormLast(lastName);
    setFormPhone(phoneNumber);
    setFormStoreName(storeName);
    setFormStoreAddress(storeAddress);
    setFormBankIban(bankIban);
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
        store_name: formStoreName.trim(),
        store_address: formStoreAddress.trim(),
        bank_iban: formBankIban.trim(),
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
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 110 }}>
        <TouchableOpacity
          style={styles.profileCardBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('UserProfile')}
        >
          <View style={styles.profileBannerLeft}>
            <View style={styles.profileIconCircle}>
              <Ionicons name="person" size={24} color={colors.primaryDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileBannerTitle}>Profil Hesabım & Rozetlerim</Text>
              <Text style={styles.profileBannerSub}>Biyografi, şehir, rozetler ve istatistiklerin</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primaryDeep} />
        </TouchableOpacity>

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

          {roles.includes('seller') && (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Mağaza Adı</Text>
                <Text style={styles.rowValue}>{storeName || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Mağaza Adresi</Text>
                <Text style={styles.rowValue}>{storeAddress || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>IBAN</Text>
                <Text style={styles.rowValue}>{bankIban || '—'}</Text>
              </View>
            </>
          )}

          <View style={sellerInfo ? styles.row : styles.rowLast}>
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

          {sellerInfo && (
            <View style={styles.rowLast}>
              <Text style={styles.rowLabel}>{t('settings.sellerApplication')}</Text>
              <View style={[styles.badge, { backgroundColor: badgeColors[sellerInfo.badge].bg }]}>
                <Text style={[styles.badgeText, { color: badgeColors[sellerInfo.badge].text }]}>
                  {t(sellerInfo.labelKey)}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Orders')} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="receipt-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>{t('settings.orders')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('SellerChatList')} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="chatbubbles-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>{t('sellerChat.title')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Support', { sourcePanel: 'customer' })} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="help-buoy-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>{t('settings.support')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('MyReviews')} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="star-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>{t('settings.myReviews')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('AddressScreen')} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="location-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>{t('settings.myAddresses')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('AppSettings')} activeOpacity={0.7}>
            <View style={styles.menuLeft}>
              <Ionicons name="options-outline" size={18} color={colors.ink} />
              <Text style={styles.menuText}>{t('settings.appSettings')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </TouchableOpacity>
        </View>

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
            <Text style={styles.modalTitle}>{t('settings.editName')}</Text>

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

            {roles.includes('seller') && (
              <>
                <Text style={styles.label}>Mağaza Adı</Text>
                <TextInput
                  style={styles.input}
                  value={formStoreName}
                  onChangeText={setFormStoreName}
                  placeholder="Mağaza Adı"
                  placeholderTextColor={colors.muted2}
                />

                <Text style={styles.label}>Mağaza Adresi</Text>
                <TextInput
                  style={styles.input}
                  value={formStoreAddress}
                  onChangeText={setFormStoreAddress}
                  placeholder="Mağaza Adresi"
                  placeholderTextColor={colors.muted2}
                />

                <Text style={styles.label}>IBAN Numarası</Text>
                <TextInput
                  style={styles.input}
                  value={formBankIban}
                  onChangeText={setFormBankIban}
                  placeholder="TRXX XXXX XXXX XXXX XXXX XXXX XX"
                  placeholderTextColor={colors.muted2}
                />
              </>
            )}


            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)} disabled={saving}>
                <Text style={styles.cancelText}>{t('settings.cancel')}</Text>
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
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl },
});
