import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Seller {
  seller_id: number;
  seller_name: string;
  product_count: number;
}

interface Rating {
  average: number;
  count: number;
}

// Predefined store badges for rich visual identity
const STORE_BADGES = [
  { label: '🟢 Onaylı Sera', bg: '#e8f8f0', color: colors.primaryDeep },
  { label: '🚀 Hızlı Kargo', bg: '#eef2ff', color: '#4f46e5' },
  { label: '🌿 %100 Organik', bg: '#fef3c7', color: '#b45309' },
];

export default function StoresScreen({ navigation }: any) {
  const { t } = useI18n();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Seller[]>('/catalog/sellers');
      setSellers(data);
      const entries = await Promise.all(
        data.map(async (s) => {
          try {
            const res = await apiClient.get<Rating>(`/reviews/store/${s.seller_id}`);
            return [s.seller_id, res.data] as const;
          } catch {
            return [s.seller_id, { average: 0, count: 0 }] as const;
          }
        })
      );
      const map: Record<number, Rating> = {};
      entries.forEach(([id, r]) => {
        map[id] = r;
      });
      setRatings(map);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('stores.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSellers = sellers.filter((s) =>
    s.seller_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const renderSeller = ({ item, index }: { item: Seller; index: number }) => {
    const rating = ratings[item.seller_id];
    const isSuperSeller = rating && rating.average >= 4.5 && rating.count > 0;
    const badge = STORE_BADGES[index % STORE_BADGES.length];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() =>
          navigation.navigate('StoreProducts', { sellerId: item.seller_id, sellerName: item.seller_name })
        }
      >
        <LinearGradient
          colors={index % 2 === 0 ? ['#1B4332', '#0F2A1F'] : ['#1DAA63', '#178A50']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardBanner}
        >
          <View style={styles.bannerBadgeRow}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.badgePillText}>{badge.label}</Text>
            </View>
            {isSuperSeller && (
              <View style={[styles.badgePill, { backgroundColor: '#f5a524' }]}>
                <Text style={[styles.badgePillText, { color: colors.white }]}>⭐ Süper Satıcı</Text>
              </View>
            )}
          </View>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{item.seller_name.charAt(0).toUpperCase()}</Text>
          </View>
        </LinearGradient>

        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.seller_name}</Text>
              <Text style={styles.subText}>Botanik Sera & Bitki Üreticisi</Text>
            </View>
            <View style={styles.arrowCircle}>
              <Ionicons name="chevron-forward" size={18} color={colors.primaryDeep} />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="leaf-outline" size={14} color={colors.primaryDeep} />
              <Text style={styles.metaChipText}>{item.product_count} {t('stores.products')}</Text>
            </View>

            {rating && rating.count > 0 ? (
              <View style={styles.ratingChip}>
                <Ionicons name="star" size={13} color="#f5a524" />
                <Text style={styles.ratingValue}>{rating.average.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>({rating.count})</Text>
              </View>
            ) : (
              <View style={[styles.ratingChip, { backgroundColor: colors.bgAlt }]}>
                <Text style={[styles.ratingCount, { color: colors.muted }]}>Yeni Mağaza</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('stores.title')}</Text>
        <Text style={styles.headerSub}>{t('stores.sub')}</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Mağaza veya sera ara..."
            placeholderTextColor={colors.muted2}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSellers}
          keyExtractor={(item) => String(item.seller_id)}
          contentContainerStyle={styles.list}
          renderItem={renderSeller}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="storefront-outline" size={48} color={colors.muted2} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Aramanızla eşleşen bir mağaza bulunamadı.' : t('stores.empty')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, padding: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.md,
  },
  cardBanner: {
    height: 90,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  bannerBadgeRow: { flexDirection: 'row', gap: spacing.xs },
  badgePill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgePillText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.white },
  avatarWrap: {
    position: 'absolute',
    bottom: -20,
    left: spacing.md,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 22, color: colors.primaryDeep },
  cardBody: { paddingTop: 28, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  subText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  metaChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primaryDeep },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  ratingValue: { fontFamily: fonts.sansBold, fontSize: 12, color: '#b3711a' },
  ratingCount: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
});

