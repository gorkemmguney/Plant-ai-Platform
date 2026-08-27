import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_ROLE_PREFIX } from '../../constants/auth';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { supabase } from '../../lib/supabaseClient';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, spacing } from '../../theme/theme';

const { height } = Dimensions.get('window');

type AccountType = 'customer' | 'seller';

export default function RegisterScreen({ navigation }: any) {
  const { refreshProfile } = useAuth();
  const { t } = useI18n();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [role, setRole] = useState<AccountType>('customer');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Müşteride ad/soyad, satıcıda mağaza adı zorunlu
    if (role === 'customer' && (!firstName.trim() || !lastName.trim())) {
      Alert.alert(t('register.failed'), t('register.nameRequired'));
      return;
    }
    if (role === 'seller' && !storeName.trim()) {
      Alert.alert(t('register.failed'), t('register.storeNameRequired'));
      return;
    }
    if (!email.trim() && !phone.trim()) {
      Alert.alert(t('register.failed'), t('register.emailOrPhoneRequired'));
      return;
    }
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone_number: phone.trim(),
            store_name: storeName.trim(),
            store_address: storeAddress.trim(),
            bank_iban: bankIban.trim(),
          },
        },
      });
      if (error) throw error;

      if (data.session) {
        try {
          await supabase.auth.setSession(data.session);
          await apiClient.post('/auth/select-role', { role_name: role });
          await apiClient.patch('/auth/me', {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: trimmedEmail,
            phone_number: phone.trim(),
            store_name: storeName.trim(),
            store_address: storeAddress.trim(),
            bank_iban: bankIban.trim(),
          }).catch(() => {});

          if (role === 'seller') {
            Alert.alert(t('register.sellerApplied'), t('register.sellerAppliedMsg'));
          }
          await refreshProfile();
        } catch (roleErr: any) {
          console.log('[Register] rol seçimi ve profil senkronize edilemedi:', roleErr?.message ?? roleErr);
        }
      }

 else {
        await AsyncStorage.setItem(`${PENDING_ROLE_PREFIX}${trimmedEmail.toLowerCase()}`, role);
        Alert.alert(
          t('register.confirmEmail'),
          `${t('register.confirmEmailPre')}${trimmedEmail}${t('register.confirmEmailPost')}`
        );
        navigation.navigate('Login');
      }
    } catch (err: any) {
      Alert.alert(t('register.failed'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    Alert.alert(t('login.soon'), t('login.soonMsg'));
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[colors.secondary, colors.secondaryDeep]} style={styles.hero}>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('register.header')}</Text>
            <View style={styles.backButton} />
          </View>

          <Text style={styles.title}>{t('register.title')}</Text>

          <Text style={styles.label}>{t('register.accountType')}</Text>
          <View style={styles.roleRow}>
            {(['customer', 'seller'] as AccountType[]).map((r) => {
              const active = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleOption, active && styles.roleOptionActive]}
                  onPress={() => setRole(r)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleOptionText, active && styles.roleOptionTextActive]}>
                    {r === 'customer' ? t('register.customer') : t('register.seller')}
                  </Text>
                  <Text style={[styles.roleOptionSub, active && styles.roleOptionSubActive]}>
                    {r === 'customer' ? t('register.customerSub') : t('register.sellerSub')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Müşteride ad/soyad, satıcıda mağaza bilgileri gösterilir */}
          {role === 'customer' ? (
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('register.firstNameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.firstNamePlaceholder')}
                  placeholderTextColor={colors.muted2}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('register.lastNameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.lastNamePlaceholder')}
                  placeholderTextColor={colors.muted2}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>{t('register.storeNameLabel')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('register.storeNamePlaceholder')}
                placeholderTextColor={colors.muted2}
                value={storeName}
                onChangeText={setStoreName}
              />

              <Text style={styles.label}>{t('register.storeAddressLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('register.storeAddressPlaceholder')}
                placeholderTextColor={colors.muted2}
                value={storeAddress}
                onChangeText={setStoreAddress}
              />

              <Text style={styles.label}>{t('register.bankIbanLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('register.bankIbanPlaceholder')}
                placeholderTextColor={colors.muted2}
                autoCapitalize="characters"
                value={bankIban}
                onChangeText={setBankIban}
              />
            </View>
          )}

          <Text style={styles.label}>{t('register.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@email.com"
            placeholderTextColor={colors.muted2}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>{t('register.phoneLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.phonePlaceholder')}
            placeholderTextColor={colors.muted2}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>{t('register.passwordLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.passwordPlaceholder')}
            placeholderTextColor={colors.muted2}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />


          {loading ? (
            <ActivityIndicator color={colors.buttonPrimary} style={{ marginTop: spacing.lg }} />
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>{t('register.continue')}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.oauthButton} onPress={handleMicrosoftLogin} activeOpacity={0.85}>
            <Text style={styles.oauthButtonText}>{t('register.microsoft')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLinkText}>
              {t('register.haveAccount')}<Text style={styles.footerLinkBold}>{t('register.signIn')}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { height: height * 0.15, paddingTop: 56, paddingHorizontal: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(237,169,114,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  logoText: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.white, letterSpacing: 0.5 },
  sheetWrap: { flex: 1, marginTop: -radius.lg },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  sheetContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 20, color: colors.ink, marginTop: -2 },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginBottom: spacing.xl },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  label: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  sellerBox: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  roleOption: {

    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  roleOptionActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  roleOptionText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink },
  roleOptionTextActive: { color: colors.buttonPrimaryText },
  roleOptionSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
  roleOptionSubActive: { color: 'rgba(255,255,255,0.7)' },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.buttonPrimaryText },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted2, marginHorizontal: spacing.md },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 15,
    backgroundColor: colors.card,
  },
  oauthButtonText: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink },
  footerLink: { alignItems: 'center', marginTop: spacing.xl },
  footerLinkText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  footerLinkBold: { fontFamily: fonts.sansBold, color: colors.ink },
});
