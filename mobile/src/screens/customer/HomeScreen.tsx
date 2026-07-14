import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { badgeColors, colors, fonts, gradients, radius, shadow, spacing } from '../../theme/theme';

type CareStatus = 'urgent' | 'soon' | 'ok';

interface CareReminder {
  id: string;
  name: string;
  emoji: string;
  status: CareStatus;
  message: string;
}

interface Listing {
  id: string;
  name: string;
  price: string;
  emoji: string;
  location: string;
}

const CARE_REMINDERS: CareReminder[] = [
  { id: '1', name: 'Monstera Deliciosa', emoji: '🌿', status: 'urgent', message: 'Sulama zamanı geldi' },
  { id: '2', name: 'Sansevieria', emoji: '🪴', status: 'ok', message: '4 gün sonra sulanacak' },
  { id: '3', name: 'Orkide', emoji: '🌸', status: 'soon', message: 'Yarın sulanmalı' },
  { id: '4', name: 'Ficus Lyrata', emoji: '🌱', status: 'ok', message: '6 gün sonra sulanacak' },
];

const LISTINGS: Listing[] = [
  { id: '1', name: 'Monstera Albo', price: '₺2.450', emoji: '🌿', location: 'Kadıköy' },
  { id: '2', name: 'Kaktüs Seti (3\'lü)', price: '₺320', emoji: '🌵', location: 'Beşiktaş' },
  { id: '3', name: 'Pothos Marble', price: '₺180', emoji: '🍃', location: 'Üsküdar' },
  { id: '4', name: 'Anthurium', price: '₺650', emoji: '🌺', location: 'Şişli' },
  { id: '5', name: 'Zamioculcas', price: '₺290', emoji: '🪴', location: 'Bakırköy' },
  { id: '6', name: 'Orkide Beyaz', price: '₺410', emoji: '🌸', location: 'Maltepe' },
];

const statusColors: Record<CareStatus, { bg: string; text: string }> = {
  urgent: badgeColors.red,
  soon: badgeColors.amber,
  ok: badgeColors.green,
};

export default function HomeScreen({ navigation }: any) {
  const { firebaseUser } = useAuth();
  const [query, setQuery] = useState('');

  const firstName = firebaseUser?.email?.split('@')[0] ?? 'Bitki Sever';

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.brand}>PLANT AI</Text>
        </View>
        <Text style={styles.greeting}>Merhaba, {firstName} 👋</Text>
        <Text style={styles.greetingSub}>Bugün bitkilerine göz atalım</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Bitki, tür veya satıcı ara"
            placeholderTextColor={colors.muted2}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <LinearGradient
          colors={[colors.secondary, colors.secondaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerEyebrow}>BU HAFTA</Text>
            <Text style={styles.bannerTitle}>Nadir bitkilerde{'\n'}%20'ye varan indirim</Text>
            <TouchableOpacity style={styles.bannerButton} activeOpacity={0.85}>
              <Text style={styles.bannerButtonText}>Keşfet</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bannerEmoji}>🌴</Text>
        </LinearGradient>

        <LinearGradient
          colors={['#2c694a', '#1e4832']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerEyebrow, { color: '#eda972' }]}>YAPAY ZEKA</Text>
            <Text style={styles.bannerTitle}>Bitki Teşhis &{'\n'}Sağlık Analizi</Text>
            <TouchableOpacity
              style={styles.bannerButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ImageAnalysis')}
            >
              <Text style={[styles.bannerButtonText, { color: '#1e4832' }]}>Fotoğraf Analiz Et 📸</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bannerEmoji}>🩺</Text>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bakım Takibi</Text>
          <Text style={styles.sectionBadgeAI}>AI destekli</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reminderRow}>
          {CARE_REMINDERS.map((item) => (
            <View key={item.id} style={styles.reminderCard}>
              <Text style={styles.reminderEmoji}>{item.emoji}</Text>
              <Text style={styles.reminderName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status].bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusColors[item.status].text }]}>
                  {item.message}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Öne Çıkan İlanlar</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Marketplace')}>
            <Text style={styles.sectionLink}>Tümü</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {LISTINGS.map((item) => (
            <TouchableOpacity key={item.id} style={styles.listingCard} activeOpacity={0.85}>
              <View style={styles.listingImage}>
                <Text style={styles.listingEmoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.listingName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.listingPrice}>{item.price}</Text>
              <Text style={styles.listingLocation}>{item.location}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logoMark: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(237,169,114,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  brand: { fontFamily: fonts.displaySemi, fontSize: 12, color: colors.white, letterSpacing: 1.2 },
  greeting: { fontFamily: fonts.display, fontSize: 22, color: colors.white, marginBottom: 2 },
  greetingSub: { fontFamily: fonts.sans, fontSize: 12.5, color: '#c9c9d6' },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.xl,
    ...shadow.sm,
  },
  searchIcon: { fontSize: 16, color: colors.muted2, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 14, fontFamily: fonts.sans, fontSize: 14, color: colors.ink },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  bannerEyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.primary, letterSpacing: 1, marginBottom: 4 },
  bannerTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.white, marginBottom: spacing.md },
  bannerButton: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  bannerButtonText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.ink },
  bannerEmoji: { fontSize: 56, marginLeft: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  sectionBadgeAI: {
    fontFamily: fonts.sansBold,
    fontSize: 10.5,
    color: badgeColors.secondary.text,
    backgroundColor: badgeColors.secondary.bg,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  sectionLink: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.muted },
  reminderRow: { gap: spacing.md, paddingRight: spacing.lg },
  reminderCard: {
    width: 132,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  reminderEmoji: { fontSize: 28, marginBottom: spacing.sm },
  reminderName: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink, marginBottom: spacing.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, alignSelf: 'flex-start' },
  statusBadgeText: { fontFamily: fonts.sansBold, fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  listingCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  listingImage: {
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  listingEmoji: { fontSize: 34 },
  listingName: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink, marginBottom: 2 },
  listingPrice: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink, marginBottom: 2 },
  listingLocation: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted2 },
});
