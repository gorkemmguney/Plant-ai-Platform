import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Product {
  prod_id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
  seller_id: number | null;
  seller_name: string | null;
}

export default function MarketplaceScreen({ navigation }: any) {
  const { addToCart, count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Adet seçme modalı
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  const openAddModal = (product: Product) => {
    setSelected(product);
    setQty(1);
  };

  const confirmAdd = () => {
    if (selected) addToCart(selected, qty);
    setSelected(null);
  };

  // Arama: ürün adına göre filtrele
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  // Fiyat karşılaştırma: aynı isimdeki ürünün kaç satıcıda olduğu ve en ucuz fiyatı
  const priceByName: Record<string, { min: number; count: number }> = {};
  products.forEach((p) => {
    const key = p.name.trim().toLowerCase();
    const price = Number(p.price);
    if (!priceByName[key]) priceByName[key] = { min: price, count: 0 };
    priceByName[key].count += 1;
    priceByName[key].min = Math.min(priceByName[key].min, price);
  });

  const loadProducts = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Product[]>('/catalog/products');
      setProducts(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const renderProduct = ({ item }: { item: Product }) => {
    const out = item.stock < 1;
    const info = priceByName[item.name.trim().toLowerCase()];
    // Aynı üründen birden fazla satıcı varsa ve bu en ucuzsa "En ucuz" rozeti
    const cheapest = info && info.count > 1 && Number(item.price) === info.min;
    return (
      <View style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.thumbEmoji}>🪴</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {cheapest && (
              <View style={styles.cheapBadge}>
                <Text style={styles.cheapBadgeText}>En ucuz</Text>
              </View>
            )}
          </View>
          {!!item.seller_name && (
            <Text style={styles.seller} numberOfLines={1}>Satıcı: {item.seller_name}</Text>
          )}
          <Text style={[styles.stock, out && styles.stockOut]}>
            {out ? 'Stokta yok' : `Stok: ${item.stock}`}
          </Text>
        </View>
        <View style={styles.buyCol}>
          <Text style={styles.price}>₺{Number(item.price).toFixed(2)}</Text>
          <TouchableOpacity
            style={[styles.buyButton, out && styles.buyButtonDisabled]}
            onPress={() => openAddModal(item)}
            disabled={out}
            activeOpacity={0.85}
          >
            <Text style={styles.buyButtonText}>Sepete Ekle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Mağaza</Text>
            <Text style={styles.headerSub}>Bitkileri keşfet ve satın al</Text>
          </View>
          <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')} activeOpacity={0.7}>
            <Ionicons name="cart-outline" size={24} color={colors.ink} />
            {count > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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

      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
            <Text style={styles.modalPrice}>₺{Number(selected?.price ?? 0).toFixed(2)}</Text>
            <Text style={styles.modalStock}>Stok: {selected?.stock ?? 0}</Text>

            <Text style={styles.modalLabel}>Adet</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))} activeOpacity={0.7}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{qty}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQty((q) => Math.min(selected?.stock ?? 1, q + 1))}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setSelected(null)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAdd} onPress={confirmAdd} activeOpacity={0.85}>
                <Text style={styles.modalAddText}>Sepete Ekle ({qty})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  cartBtn: { padding: spacing.xs },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.white },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, flexShrink: 1 },
  cheapBadge: { backgroundColor: badgeColors.green.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  cheapBadgeText: { fontFamily: fonts.sansBold, fontSize: 9.5, color: badgeColors.green.text },
  seller: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted2, marginTop: 2 },
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
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  modalPrice: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryDeep, marginTop: spacing.xs },
  modalStock: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  modalLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    color: colors.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink },
  qtyValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, minWidth: 28, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  modalAdd: {
    flex: 1.4,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalAddText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
});
