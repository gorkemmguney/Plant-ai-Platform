import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme/theme';

const { height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: any) {
  return (
    <View style={styles.screen}>
      <LinearGradient colors={[colors.secondary, colors.secondaryDeep]} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.logoText}>plant ai</Text>
        </View>

        <View style={styles.heroIconWrap}>
          <Text style={styles.heroIcon}>🌿</Text>
        </View>

        <Text style={styles.heroTitle}>BİTKİ ALIM SATIM{'\n'}TOPLULUĞU</Text>

        <View style={styles.dotsRow}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>
      </LinearGradient>

      <View style={styles.sheet}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryButtonText}>Giriş Yap</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.secondaryButtonText}>Kayıt Ol</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Devam ederek Plant AI&apos;ın{' '}
          <Text style={styles.legalLink}>Gizlilik Politikası</Text> ve{' '}
          <Text style={styles.legalLink}>Kullanım Şartları</Text>&apos;nı kabul etmiş olursunuz.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: {
    height: height * 0.62,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  heroIconWrap: { alignSelf: 'center' },
  heroIcon: { fontSize: 84 },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.white,
    textAlign: 'center',
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 18, backgroundColor: colors.primary },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    marginTop: -radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.buttonPrimaryText },
  secondaryButton: {
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  secondaryButtonText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  legal: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.muted2,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 17,
  },
  legalLink: { fontFamily: fonts.sansSemi, color: colors.muted, textDecorationLine: 'underline' },
});
