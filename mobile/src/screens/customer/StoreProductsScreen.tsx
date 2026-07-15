import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Product {
  prod_id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
  seller_id: number | null;
}

export default function StoreProductsScreen({ route }: any) {
  const { sellerId, sellerName } = route.params ?? {};
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Product[]>('/catalog/products');
      setProducts(data.filter((p) => p.seller_id === sellerId));
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ürünler yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmAdd = () => {
    if (selected) addToCart(selected, qty);
    setSelected(null);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const out = item.stock < 1;
    return (
      <View style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.thumbEmoji}>🪴</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.stock, out && styles.stockOut]}>
            {out ? 'Stokta yok' : `Stok: ${item.stock}`}
          </Text>
        </View>
        <View style={styles.buyCol}>
          <Text style={styles.price}>₺{Number(item.price).toFixed(2)}</Text>
          <TouchableOpacity
            style={[styles.buyButton, out && styles.buyButtonDisabled]}
            onPress={() => {
              setSelected(item);
              setQty(1);
            }}
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
        <Text style={styles.headerTitle}>{sellerName ?? 'Mağaza'}</Text>
        <Text style={styles.headerSub}>Bu satıcının ürünleri</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.prod_id)}
          contentContainerStyle={styles.list}
          renderItem={renderProduct}
          ListEmptyComponent={<Text style={styles.emptyText}>Bu satıcının ürünü yok.</Text>}
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
  header: { paddingTop: 24, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
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
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl },
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
