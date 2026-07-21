import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

export default function StoresScreen({ navigation }: any) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Seller[]>('/catalog/sellers');
      setSellers(data);
      // Her mağazanın ortalama puanını çek (az sayıda mağaza olduğu için sorun değil)
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
      setError(err?.response?.data?.detail ?? 'Satıcılar yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderSeller = ({ item }: { item: Seller }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate('StoreProducts', { sellerId: item.seller_id, sellerName: item.seller_name })
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.seller_name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.seller_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.count}>{item.product_count} ürün</Text>
          {ratings[item.seller_id]?.count > 0 && (
            <Text style={styles.rating}>
              ⭐ {ratings[item.seller_id].average.toFixed(1)} ({ratings[item.seller_id].count})
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mağazalar</Text>
        <Text style={styles.headerSub}>Mağazaları gez, ürünlerini incele</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sellers}
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
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz ürün ekleyen satıcı yok.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.display, fontSize: 20, color: colors.primaryDeep },
  info: { flex: 1 },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  count: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  rating: { fontFamily: fonts.sansBold, fontSize: 12.5, color: '#b3711a' },
  arrow: { fontFamily: fonts.sans, fontSize: 22, color: colors.muted2 },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
});
