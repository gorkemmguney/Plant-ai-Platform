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
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { supabase } from '../../lib/supabaseClient';
import { colors, fonts, radius, spacing } from '../../theme/theme';

export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const { clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('resetPassword.tooShort'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('common.error'), t('resetPassword.mismatch'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert(t('common.ok'), t('resetPassword.success'));
      await supabase.auth.signOut();
      clearPasswordRecovery();
    } catch (err: any) {
      Alert.alert(t('resetPassword.failed'), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('resetPassword.title')}</Text>
          <Text style={styles.subtitle}>{t('resetPassword.subtitle')}</Text>

          <Text style={styles.label}>{t('resetPassword.newPasswordLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.muted2}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.label}>{t('resetPassword.confirmLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.muted2}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          {loading ? (
            <ActivityIndicator color={colors.buttonPrimary} style={{ marginTop: spacing.lg }} />
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>{t('resetPassword.save')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: 80, flexGrow: 1 },
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
