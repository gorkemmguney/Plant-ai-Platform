import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Product {
  prod_id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
}

// Seed ile eklenen varsayılan satış kanalı (sale_cnl_id = 1: "Mobil Uygulama")
const SALE_CHANNEL_ID = 1;

export default function MarketplaceScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  // Arama: ürün adına göre filtrele
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const loadProducts = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Product[]>('/catalog/products');
      setProducts(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ürünler yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Sipariş için müşteri profili gerekli; yoksa otomatik oluştur (bireysel)
  const ensureCustomerProfile = async () => {
    try {
      await apiClient.get('/customers/me');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        await apiClient.post('/customers/me', { customer_type: 'IND', individual: {} });
      } else {
        throw err;
      }
    }
  };

  const handleBuy = async (product: Product) => {
    if (product.stock < 1) {
      Alert.alert('Stok yok', 'Bu ürün şu an stokta değil.');
      return;
    }
    setBuyingId(product.prod_id);
    try {
      await ensureCustomerProfile();
      await apiClient.post('/orders', {
        sale_cnl_id: SALE_CHANNEL_ID,
        items: [{ prod_id: product.prod_id, quantity: 1 }],
      });
      Alert.alert('Sipariş alındı 🎉', `"${product.name}" için siparişin oluşturuldu.`);
      // Stok güncellensin diye listeyi yenile
      loadProducts();
    } catch (err: any) {
      Alert.alert('Satın alınamadı', err?.response?.data?.detail ?? 'Sipariş oluşturulamadı.');
    } finally {
      setBuyingId(null);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const out = item.stock < 1;
    const busy = buyingId === item.prod_id;
    return (
      <View style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.thumbEmoji}>🪴</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {!!item.description && (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          )}
          <Text style={[styles.stock, out && styles.stockOut]}>
            {out ? 'Stokta yok' : `Stok: ${item.stock}`}
          </Text>
        </View>
        <View style={styles.buyCol}>
          <Text style={styles.price}>₺{Number(item.price).toFixed(2)}</Text>
          <TouchableOpacity
            style={[styles.buyButton, (out || busy) && styles.buyButtonDisabled]}
            onPress={() => handleBuy(item)}
            disabled={out || busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
            ) : (
              <Text style={styles.buyButtonText}>Satın Al</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mağaza</Text>
        <Text style={styles.headerSub}>Bitkileri keşfet ve satın al</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün ara"
            placeholderTextColor={colors.muted2}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProducts} activeOpacity={0.85}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.prod_id)}
          contentContainerStyle={styles.list}
          renderItem={renderProduct}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadProducts();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim()
                ? `"${query.trim()}" için sonuç bulunamadı.`
                : 'Henüz ürün yok. Satıcılar ekledikçe burada görünür.'}
            </Text>
          }
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchIcon: { fontSize: 16, color: colors.muted2, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: fonts.sans, fontSize: 14, color: colors.ink },
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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 28 },
  info: { flex: 1 },
  name: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink },
  description: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  stock: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted2, marginTop: 4 },
  stockOut: { color: colors.red },
  buyCol: { alignItems: 'flex-end', gap: spacing.sm },
  price: { fontFamily: fonts.display, fontSize: 15, color: colors.primaryDeep },
  buyButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    minWidth: 78,
    alignItems: 'center',
  },
  buyButtonDisabled: { backgroundColor: colors.border },
  buyButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.buttonPrimaryText },
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
