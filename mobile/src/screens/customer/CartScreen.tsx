import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

// Seed ile eklenen varsayılan satış kanalı (sale_cnl_id = 1: "Mobil Uygulama")
const SALE_CHANNEL_ID = 1;

interface Coupon {
  coupon_id: number;
  code: string;
  discount_amount: number;
  seller_id: number | null;
  seller_name: string | null;
}

interface Suggestion {
  prod_id: number;
  name: string;
  price: string | number;
  stock: number;
  seller_id: number | null;
  seller_name: string | null;
}

export default function CartScreen({ navigation }: any) {
  const { items, total, addToCart, changeQty, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);

  // Birlikte alınabilecek öneriler (sepetteki ilk ürüne göre)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const cartKey = items.map((i) => i.product.prod_id).join(',');
  useEffect(() => {
    if (items.length === 0) {
      setSuggestions([]);
      return;
    }
    const cartIds = items.map((i) => i.product.prod_id);
    apiClient
      .get<Suggestion[]>(`/catalog/products/${items[0].product.prod_id}/related?limit=6`)
      .then(({ data }) => setSuggestions(data.filter((s) => !cartIds.includes(s.prod_id)).slice(0, 3)))
      .catch(() => setSuggestions([]));
  }, [cartKey]);

  const loadCoupons = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Coupon[]>('/coupons/mine');
      setCoupons(data);
    } catch {
      setCoupons([]);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  // Bir kuponun kendi mağazasındaki sepet ara toplamı (indirim sadece o kadarına uygulanır)
  const storeSubtotal = (sellerId: number | null) =>
    items
      .filter((i) => i.product.seller_id === sellerId)
      .reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);

  const selectedCoupon = coupons.find((c) => c.coupon_id === selectedCouponId) ?? null;
  const discount = selectedCoupon
    ? Math.min(Number(selectedCoupon.discount_amount), storeSubtotal(selectedCoupon.seller_id))
    : 0;
  const finalTotal = Math.max(0, total - discount);

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

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    try {
      await ensureCustomerProfile();
      await apiClient.post('/orders', {
        sale_cnl_id: SALE_CHANNEL_ID,
        coupon_id: selectedCouponId,
        items: items.map((i) => ({
          prod_id: i.product.prod_id,
          quantity: i.quantity,
          selected_char_value_ids: i.selectedCharacteristics.map((c) => c.gnl_char_val_id),
        })),
      });
      clearCart();
      setSelectedCouponId(null);
      loadCoupons();
      Alert.alert('Sipariş alındı 🎉', 'Siparişin oluşturuldu.', [
        { text: 'Siparişlerim', onPress: () => navigation.navigate('Orders') },
        { text: 'Tamam' },
      ]);
    } catch (err: any) {
      Alert.alert('Sipariş verilemedi', err?.response?.data?.detail ?? 'Sipariş oluşturulamadı.');
    } finally {
      setPlacing(false);
    }
  };

  const renderItem = ({ item }: { item: (typeof items)[number] }) => {
    const variantLabel = item.selectedCharacteristics.map((c) => `${c.char_name}: ${c.value}`).join(' · ');
    return (
      <View style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.thumbEmoji}>🪴</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.product.name}</Text>
          {variantLabel ? (
            <Text style={styles.variant} numberOfLines={1}>{variantLabel}</Text>
          ) : null}
          <Text style={styles.price}>₺{Number(item.product.price).toFixed(2)}</Text>
        </View>
        <View style={styles.qtyBox}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => changeQty(item.lineKey, -1)}
            activeOpacity={0.7}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => changeQty(item.lineKey, 1)}
            activeOpacity={0.7}
            disabled={item.quantity >= item.product.stock}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyText}>Sepetin boş.</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate('Tabs', { screen: 'Marketplace' })}
            activeOpacity={0.85}
          >
            <Text style={styles.shopButtonText}>Alışverişe başla</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.lineKey}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListFooterComponent={
          suggestions.length > 0 ? (
            <View style={styles.suggestBox}>
              <Text style={styles.suggestTitle}>Birlikte alınabilir</Text>
              <View style={styles.suggestRow}>
                {suggestions.map((s) => (
                  <View key={s.prod_id} style={styles.suggestCard}>
                    <View style={styles.suggestThumb}>
                      <Text style={styles.suggestEmoji}>🪴</Text>
                    </View>
                    <Text style={styles.suggestName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.suggestPrice}>₺{Number(s.price).toFixed(2)}</Text>
                    <TouchableOpacity
                      style={styles.suggestAdd}
                      onPress={() =>
                        addToCart(
                          {
                            prod_id: s.prod_id,
                            name: s.name,
                            price: s.price,
                            stock: s.stock,
                            seller_id: s.seller_id,
                            seller_name: s.seller_name,
                          },
                          1,
                          []
                        )
                      }
                      activeOpacity={0.85}
                    >
                      <Text style={styles.suggestAddText}>+ Ekle</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      <View style={styles.footer}>
        {coupons.length > 0 && (
          <View style={styles.couponSection}>
            <Text style={styles.couponTitle}>Kampanyalarım</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.couponRow}>
              {coupons.map((c) => {
                const active = c.coupon_id === selectedCouponId;
                const usable = storeSubtotal(c.seller_id) > 0; // bu mağazadan sepette ürün var mı
                return (
                  <TouchableOpacity
                    key={c.coupon_id}
                    style={[styles.couponChip, active && styles.couponChipActive, !usable && styles.couponChipDisabled]}
                    onPress={() => usable && setSelectedCouponId(active ? null : c.coupon_id)}
                    disabled={!usable}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.couponChipText, active && styles.couponChipTextActive]}>
                      ₺{Number(c.discount_amount).toFixed(0)} indirim
                    </Text>
                    <Text style={[styles.couponChipStore, active && styles.couponChipTextActive]} numberOfLines={1}>
                      {c.seller_name ?? 'Mağaza'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {discount > 0 && (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.subLabel}>Ara toplam</Text>
              <Text style={styles.subValue}>₺{total.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.discountLabel}>İndirim</Text>
              <Text style={styles.discountValue}>−₺{discount.toFixed(2)}</Text>
            </View>
          </>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalValue}>₺{finalTotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, placing && styles.checkoutDisabled]}
          onPress={handleCheckout}
          disabled={placing}
          activeOpacity={0.85}
        >
          {placing ? (
            <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
          ) : (
            <Text style={styles.checkoutText}>Sipariş Ver</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyEmoji: { fontSize: 52 },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  shopButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  shopButtonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
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
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  variant: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.muted, marginTop: 2 },
  price: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primaryDeep, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink },
  qtyText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink, minWidth: 20, textAlign: 'center' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  suggestBox: { marginTop: spacing.lg, gap: spacing.sm },
  suggestTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  suggestRow: { flexDirection: 'row', gap: spacing.sm },
  suggestCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 5,
    ...shadow.sm,
  },
  suggestThumb: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestEmoji: { fontSize: 22 },
  suggestName: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.ink },
  suggestPrice: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primaryDeep },
  suggestAdd: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 1,
  },
  suggestAddText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primaryDeep },
  couponSection: { gap: spacing.sm },
  couponTitle: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.muted },
  couponRow: { gap: spacing.sm, paddingBottom: 2 },
  couponChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  couponChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  couponChipDisabled: { opacity: 0.45 },
  couponChipText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.muted },
  couponChipStore: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.muted2, marginTop: 1 },
  couponChipTextActive: { color: colors.primaryDeep },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  subValue: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  discountLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.primaryDeep },
  discountValue: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primaryDeep },
  totalLabel: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.muted },
  totalValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  checkoutButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  checkoutDisabled: { opacity: 0.6 },
  checkoutText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.buttonPrimaryText },
});
