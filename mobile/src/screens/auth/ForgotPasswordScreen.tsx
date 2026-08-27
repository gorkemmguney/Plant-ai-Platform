import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, spacing } from '../../theme/theme';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Adım 1: Backend /auth/forgot-password → Resend üzerinden OTP maili gönderir
  const handleSend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: cleanEmail });
      setSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || 'Kod gönderilemedi.';
      Alert.alert(t('forgotPassword.failed'), msg);
    } finally {
      setLoading(false);
    }
  };

  // Adım 2: Backend /auth/reset-password → srvc_log'daki OTP ile doğrular + şifreyi günceller
  const handleVerifyAndReset = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = otpCode.trim();

    if (!cleanCode) {
      Alert.alert('Hata', 'Lütfen e-postanıza gelen 8 haneli doğrulama kodunu girin.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email: cleanEmail,
        code: cleanCode,
        new_password: newPassword,
      });
      Alert.alert('Başarılı', 'Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz.');
      navigation.goBack();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || 'Şifre güncellenemedi.';
      Alert.alert('Şifre Güncellenemedi', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{t('forgotPassword.title')}</Text>

          {sent ? (
            <>
              <Text style={styles.subtitle}>
                {email.trim()} adresine 8 haneli doğrulama kodu gönderildi. Lütfen gelen kodu ve yeni şifrenizi girin.
              </Text>

              <Text style={styles.label}>Doğrulama Kodu (8 Haneli)</Text>
              <TextInput
                style={styles.input}
                placeholder="12345678"
                placeholderTextColor={colors.muted2}
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={setOtpCode}
              />

              <Text style={styles.label}>Yeni Şifre</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.muted2}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              {loading ? (
                <ActivityIndicator color={colors.buttonPrimary} style={{ marginTop: spacing.lg }} />
              ) : (
                <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyAndReset} activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>Şifreyi Güncelle</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>

              <Text style={styles.label}>{t('forgotPassword.emailLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@email.com"
                placeholderTextColor={colors.muted2}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              {loading ? (
                <ActivityIndicator color={colors.buttonPrimary} style={{ marginTop: spacing.lg }} />
              ) : (
                <TouchableOpacity style={styles.primaryButton} onPress={handleSend} activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>{t('forgotPassword.send')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: 56, flexGrow: 1 },
  headerRow: { marginBottom: spacing.xl },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 20, color: colors.ink, marginTop: -2 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginBottom: spacing.xl, lineHeight: 20 },
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
});
