import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

type CareStatus = 'urgent' | 'soon' | 'ok';

interface CareReminder {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: CareStatus;
  message: string;
}

interface Product {
  prod_id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
}

const CARE_REMINDERS: CareReminder[] = [
  { id: '1', name: 'Monstera Deliciosa', icon: 'water', status: 'urgent', message: 'Sulama zamanı geldi' },
  { id: '2', name: 'Sansevieria', icon: 'leaf', status: 'ok', message: '4 gün sonra sulanacak' },
  { id: '3', name: 'Orkide', icon: 'flower', status: 'soon', message: 'Yarın sulanmalı' },
  { id: '4', name: 'Ficus Lyrata', icon: 'leaf', status: 'ok', message: '6 gün sonra sulanacak' },
];

const statusColors: Record<CareStatus, { bg: string; text: string }> = {
  urgent: badgeColors.red,
  soon: badgeColors.amber,
  ok: badgeColors.green,
};

const CATEGORIES: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Süs Bitkisi', icon: 'leaf-outline' },
  { label: 'Çiçek', icon: 'flower-outline' },
  { label: 'Kaktüs', icon: 'flash-outline' },
  { label: 'Sukulent', icon: 'water-outline' },
  { label: 'İç Mekan', icon: 'home-outline' },
  { label: 'Dış Mekan', icon: 'sunny-outline' },
];

export default function HomeScreen({ navigation }: any) {
  const { firebaseUser, firstName } = useAuth();
  const { count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await apiClient.get<Product[]>('/catalog/products');
        if (active) setProducts(data);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoadingProducts(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName = firstName || firebaseUser?.email?.split('@')[0] || 'Bitki Sever';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const featured = products.slice(0, 6);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[colors.secondary, colors.secondaryDeep]} style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.brand}>PLANTORA</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Cart')} activeOpacity={0.7}>
              <Ionicons name="cart-outline" size={19} color={colors.white} />
              {count > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Orders')} activeOpacity={0.7}>
              <Ionicons name="receipt-outline" size={19} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={19} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.greetRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Merhaba, {displayName}</Text>
            <Text style={styles.greetingSub}>Bugün bitkilerine göz atalım</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          style={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={styles.categoryChip}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Marketplace')}
            >
              <View style={styles.categoryIconWrap}>
                <Ionicons name={cat.icon} size={18} color={colors.primaryDeep} />
              </View>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <LinearGradient
          colors={[colors.secondary, colors.secondaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerEyebrow}>BU HAFTA</Text>
            <Text style={styles.bannerTitle}>Nadir bitkilerde{'\n'}%20'ye varan indirim</Text>
            <TouchableOpacity
              style={styles.bannerButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Marketplace')}
            >
              <Text style={styles.bannerButtonText}>Keşfet</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <View style={styles.bannerIconWrap}>
            <Ionicons name="pricetags" size={30} color={colors.primary} />
          </View>
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
              <Text style={[styles.bannerButtonText, { color: '#1e4832' }]}>Fotoğraf Analiz Et</Text>
              <Ionicons name="camera" size={14} color="#1e4832" />
            </TouchableOpacity>
          </View>
          <View style={[styles.bannerIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Ionicons name="pulse" size={30} color="#eda972" />
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bakım Takibi</Text>
          <Text style={styles.sectionBadgeAI}>AI destekli</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reminderRow}>
          {CARE_REMINDERS.map((item) => (
            <View key={item.id} style={styles.reminderCard}>
              <View style={[styles.reminderIconWrap, { backgroundColor: statusColors[item.status].bg }]}>
                <Ionicons name={item.icon} size={20} color={statusColors[item.status].text} />
              </View>
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
        {loadingProducts ? (
          <ActivityIndicator color={colors.buttonPrimary} style={{ marginTop: spacing.lg }} />
        ) : featured.length === 0 ? (
          <Text style={styles.emptyListings}>Henüz ürün yok. Satıcılar ekledikçe burada görünür.</Text>
        ) : (
          <View style={styles.grid}>
            {featured.map((item) => (
              <TouchableOpacity
                key={item.prod_id}
                style={styles.listingCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Marketplace')}
              >
                <View style={styles.listingImage}>
                  <Ionicons name="leaf" size={30} color={colors.primaryDeep} />
                </View>
                <Text style={styles.listingName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.listingBottomRow}>
                  <Text style={styles.listingPrice}>₺{Number(item.price).toFixed(2)}</Text>
                  <View style={[styles.stockDot, item.stock <= 0 && styles.stockDotOut]} />
                </View>
                <Text style={styles.listingLocation}>
                  {item.stock > 0 ? `Stok: ${item.stock}` : 'Stokta yok'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcons: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { fontFamily: fonts.sansBold, fontSize: 9.5, color: colors.white },
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
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(237,169,114,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(237,169,114,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.display, fontSize: 18, color: colors.primary },
  greeting: { fontFamily: fonts.display, fontSize: 19, color: colors.white, marginBottom: 2 },
  greetingSub: { fontFamily: fonts.sans, fontSize: 12.5, color: '#c9c9d6' },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  categoryScroll: { marginTop: spacing.lg },
  categoryRow: { gap: spacing.md, paddingRight: spacing.lg, paddingBottom: 2 },
  categoryChip: { alignItems: 'center', width: 68 },
  categoryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  categoryLabel: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.muted, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
    ...shadow.md,
  },
  bannerEyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.primary, letterSpacing: 1, marginBottom: 4 },
  bannerTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.white, marginBottom: spacing.md },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  bannerButtonText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.ink },
  bannerIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
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
    width: 138,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  reminderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
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
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  listingName: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink, marginBottom: 4 },
  listingBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listingPrice: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  stockDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  stockDotOut: { backgroundColor: colors.red },
  listingLocation: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted2, marginTop: 2 },
  emptyListings: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
