import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SelectedCharacteristic, useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface ProductCharacteristic {
  gnl_char_id: number;
  char_name: string;
  gnl_char_val_id: number;
  value: string;
}

interface Product {
  prod_id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
  seller_id: number | null;
  category: string;
  image_url: string | null;
  characteristics: ProductCharacteristic[];
}

// Bir ürünün karakteristiklerini isimlerine göre gruplar.
// Bir karakteristiğin TEK değeri varsa bilgi amaçlı (otomatik seçili) rozet olur;
// BİRDEN FAZLA değeri varsa müşterinin seçim yapması gereken bir varyant grubudur.
function groupCharacteristics(characteristics: ProductCharacteristic[]) {
  const byChar = new Map<number, { char_name: string; options: { gnl_char_val_id: number; value: string }[] }>();
  for (const c of characteristics) {
    const group = byChar.get(c.gnl_char_id) ?? { char_name: c.char_name, options: [] };
    group.options.push({ gnl_char_val_id: c.gnl_char_val_id, value: c.value });
    byChar.set(c.gnl_char_id, group);
  }
  return Array.from(byChar.entries()).map(([gnl_char_id, group]) => ({ gnl_char_id, ...group }));
}

export default function StoreProductsScreen({ route }: any) {
  const { sellerId, sellerName } = route.params ?? {};
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  // gnl_char_id -> seçilen gnl_char_val_id
  const [picked, setPicked] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Product[]>('/catalog/products');
      setProducts(data.filter((p) => p.seller_id === sellerId));
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    load();
  }, [load]);

  const charGroups = useMemo(
    () => (selected ? groupCharacteristics(selected.characteristics ?? []) : []),
    [selected]
  );
  const multiChoiceGroups = charGroups.filter((g) => g.options.length > 1);
  const infoGroups = charGroups.filter((g) => g.options.length === 1);

  const openProduct = (item: Product) => {
    // Tek seçenekli karakteristikler otomatik "seçili" sayılır (bilgi amaçlı,
    // sipariş anlık kopyasına yine de dahil edilir). Çok seçenekli olanlar
    // için başlangıçta hiçbir şey seçili değildir, müşteri seçmelidir.
    const initial: Record<number, number> = {};
    (item.characteristics ?? []).forEach((c) => {
      const sameChar = (item.characteristics ?? []).filter((x) => x.gnl_char_id === c.gnl_char_id);
      if (sameChar.length === 1) initial[c.gnl_char_id] = c.gnl_char_val_id;
    });
    setPicked(initial);
    setSelected(item);
    setQty(1);
  };

  const canAdd = multiChoiceGroups.every((g) => picked[g.gnl_char_id] != null);

  const confirmAdd = () => {
    if (!selected || !canAdd) return;
    const selectedCharacteristics: SelectedCharacteristic[] = charGroups
      .map((g) => {
        const valId = picked[g.gnl_char_id];
        if (valId == null) return null;
        const opt = g.options.find((o) => o.gnl_char_val_id === valId);
        if (!opt) return null;
        return { gnl_char_id: g.gnl_char_id, char_name: g.char_name, gnl_char_val_id: valId, value: opt.value };
      })
      .filter((x): x is SelectedCharacteristic => x !== null);

    addToCart(selected, qty, selectedCharacteristics);
    setSelected(null);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const out = item.stock < 1;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openProduct(item)}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} />
        ) : (
          <View style={styles.thumb}>
            <Text style={styles.thumbEmoji}>🪴</Text>
          </View>
        )}
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
            onPress={() => openProduct(item)}
            disabled={out}
            activeOpacity={0.85}
          >
            <Text style={styles.buyButtonText}>Sepete Ekle</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
              {selected?.image_url ? (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomImageUrl(selected.image_url)}>
                  <Image source={{ uri: selected.image_url }} style={styles.modalImage} />
                  <View style={styles.zoomHint}>
                    <Ionicons name="expand-outline" size={14} color={colors.white} />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.modalImage, styles.modalImagePlaceholder]}>
                  <Text style={{ fontSize: 40 }}>🪴</Text>
                </View>
              )}

              <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
              <Text style={styles.modalPrice}>₺{Number(selected?.price ?? 0).toFixed(2)}</Text>
              <Text style={styles.modalStock}>Stok: {selected?.stock ?? 0}</Text>

              {infoGroups.length > 0 && (
                <View style={styles.infoBadgeRow}>
                  {infoGroups.map((g) => (
                    <View key={g.gnl_char_id} style={styles.infoBadge}>
                      <Text style={styles.infoBadgeText}>
                        {g.char_name}: {g.options[0].value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {multiChoiceGroups.map((g) => (
                <View key={g.gnl_char_id} style={styles.choiceGroup}>
                  <Text style={styles.modalLabel}>{g.char_name}</Text>
                  <View style={styles.choiceRow}>
                    {g.options.map((opt) => {
                      const active = picked[g.gnl_char_id] === opt.gnl_char_val_id;
                      return (
                        <TouchableOpacity
                          key={opt.gnl_char_val_id}
                          style={[styles.choiceChip, active && styles.choiceChipActive]}
                          onPress={() => setPicked((prev) => ({ ...prev, [g.gnl_char_id]: opt.gnl_char_val_id }))}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                            {opt.value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

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
                <TouchableOpacity
                  style={[styles.modalAdd, !canAdd && styles.modalAddDisabled]}
                  onPress={confirmAdd}
                  disabled={!canAdd}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalAddText}>Sepete Ekle ({qty})</Text>
                </TouchableOpacity>
              </View>
              {!canAdd && (
                <Text style={styles.warnText}>Devam etmeden önce yukarıdaki seçenekleri belirleyin.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Tam ekran görsel büyütme */}
      <Modal
        visible={zoomImageUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.fullscreenImageWrap}
          activeOpacity={1}
          onPress={() => setZoomImageUrl(null)}
        >
          {zoomImageUrl && (
            <Image source={{ uri: zoomImageUrl }} style={styles.fullscreenImage} resizeMode="contain" />
          )}
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setZoomImageUrl(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
        </TouchableOpacity>
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
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '80%' },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  modalPrice: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryDeep, marginTop: spacing.xs },
  modalStock: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  infoBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  infoBadge: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  infoBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted },
  choiceGroup: { marginTop: spacing.md },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choiceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  choiceChipActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  choiceChipText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  choiceChipTextActive: { color: colors.buttonPrimaryText },
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
  modalAddDisabled: { backgroundColor: colors.border },
  modalAddText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
  warnText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.red,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  modalImagePlaceholder: {
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomHint: {
    position: 'absolute',
    bottom: spacing.md + 8,
    right: spacing.sm + 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImageWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: { width: '100%', height: '80%' },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
