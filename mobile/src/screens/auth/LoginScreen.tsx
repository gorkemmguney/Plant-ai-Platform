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
import { useI18n } from '../../i18n';
import { supabase } from '../../lib/supabaseClient';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, spacing } from '../../theme/theme';

const { height } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (data?.session?.user?.user_metadata) {
        const meta = data.session.user.user_metadata;
        if (meta.first_name || meta.last_name || meta.phone_number || meta.store_name) {
          apiClient.patch('/auth/me', {
            first_name: meta.first_name,
            last_name: meta.last_name,
            phone_number: meta.phone_number,
            store_name: meta.store_name,
            store_address: meta.store_address,
            bank_iban: meta.bank_iban,
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      Alert.alert(t('login.failed'), err.message);
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
            <Text style={styles.headerTitle}>{t('login.header')}</Text>
            <View style={styles.backButton} />
          </View>

          <Text style={styles.title}>{t('login.title')}</Text>

          <Text style={styles.label}>{t('login.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@email.com"
            placeholderTextColor={colors.muted2}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>{t('login.passwordLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.muted2}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotLinkText}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator color={colors.buttonPrimary} style={{ marginTop: spacing.lg }} />
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>{t('login.continue')}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.oauthButton} onPress={handleMicrosoftLogin} activeOpacity={0.85}>
            <Text style={styles.oauthIcon}>⊞</Text>
            <Text style={styles.oauthButtonText}>{t('login.microsoft')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLinkText}>
              {t('login.noAccount')}<Text style={styles.footerLinkBold}>{t('login.signUp')}</Text>
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

  forgotLink: { alignItems: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.md },
  
  forgotLinkText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.primaryDeep },

  backIcon: { fontSize: 20, color: colors.ink, marginTop: -2 },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginBottom: spacing.xl },
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
  oauthIcon: { fontSize: 16, color: colors.ink },
  oauthButtonText: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink },
  footerLink: { alignItems: 'center', marginTop: spacing.xl },
  footerLinkText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  footerLinkBold: { fontFamily: fonts.sansBold, color: colors.ink },
});
