import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../../i18n';
import { Lang } from '../../i18n/translations';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

// Tüm paneller (müşteri/satıcı/admin) tarafından kullanılan ortak dil seçici ekranı.
export default function AppSettingsScreen({ navigation }: any) {
  const { t, lang, setLang } = useI18n();

  const languages: Lang[] = ['tr', 'en'];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('appSettings.title')}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Dil seçimi */}
        <View style={styles.menuCard}>
          <View style={styles.sectionRow}>
            <Ionicons name="language-outline" size={18} color={colors.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>{t('appSettings.language')}</Text>
              <Text style={styles.menuSubText}>{t('appSettings.languageSub')}</Text>
            </View>
          </View>

          {languages.map((code) => {
            const selected = lang === code;
            return (
              <TouchableOpacity
                key={code}
                style={styles.optionRow}
                onPress={() => setLang(code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                  {t(`lang.${code}`)}
                </Text>
                {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  content: { flex: 1, padding: spacing.lg },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 15,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  optionTextActive: { fontFamily: fonts.sansMedium, color: colors.ink },
  menuText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  menuSubText: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: 2 },
});
