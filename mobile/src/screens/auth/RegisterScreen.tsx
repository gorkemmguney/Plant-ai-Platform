import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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
import { useAuth } from '../../context/AuthContext';
import { firebaseAuth } from '../../firebase/firebaseConfig';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, spacing } from '../../theme/theme';

const { height } = Dimensions.get('window');

type AccountType = 'customer' | 'seller';

export default function RegisterScreen({ navigation }: any) {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountType>('customer');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      // Seçilen başlangıç rolünü backend'e bildir (müşteri / satıcı)
      try {
        await apiClient.post('/auth/select-role', { role_name: role });
        if (role === 'seller') {
          Alert.alert(
            'Satıcı başvurun alındı',
            'Hesabın oluşturuldu. Satıcı paneline erişebilmen için başvurunun bir admin tarafından onaylanması gerekiyor. Onaya kadar müşteri olarak devam edebilirsin.'
          );
        }
        await refreshProfile();
      } catch (roleErr: any) {
        // Backend'e ulaşılamazsa kayıt yine de tamam; rol sonradan atanabilir
        console.log('[Register] rol seçimi gönderilemedi:', roleErr?.message ?? roleErr);
      }
    } catch (err: any) {
      Alert.alert('Kayıt başarısız', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    Alert.alert('Yakında', 'Microsoft ile giriş entegrasyonu ekleniyor.');
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[colors.secondary, colors.secondaryDeep]} style={styles.hero}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.logoText}>plant ai</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Signup</Text>
            <View style={styles.backButton} />
          </View>

          <Text style={styles.title}>Create your account</Text>

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@email.com"
            placeholderTextColor={colors.muted2}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="En az 6 karakter"
            placeholderTextColor={colors.muted2}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.label}>Hesap türü</Text>
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
                    {r === 'customer' ? '🪴 Müşteri' : '🛍️ Satıcı'}
                  </Text>
                  <Text style={[styles.roleOptionSub, active && styles.roleOptionSubActive]}>
                    {r === 'customer' ? 'Ürün satın al' : 'Ürün sat (onay gerekir)'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.buttonPrimary} style={{ marginTop: spacing.lg }} />
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.oauthButton} onPress={handleMicrosoftLogin} activeOpacity={0.85}>
            <Text style={styles.oauthIcon}>⊞</Text>
            <Text style={styles.oauthButtonText}>Continue with Microsoft</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLinkText}>
              Zaten hesabın var mı? <Text style={styles.footerLinkBold}>Giriş yap</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { height: height * 0.26, paddingTop: 56, paddingHorizontal: spacing.lg },
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
  oauthIcon: { fontSize: 16, color: colors.ink },
  oauthButtonText: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink },
  footerLink: { alignItems: 'center', marginTop: spacing.xl },
  footerLinkText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  footerLinkBold: { fontFamily: fonts.sansBold, color: colors.ink },
});
