import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

export default function CartScreen({ navigation }: any) {
  const { items, total, changeQty, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);

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
        items: items.map((i) => ({
          prod_id: i.product.prod_id,
          quantity: i.quantity,
          selected_char_value_ids: i.selectedCharacteristics.map((c) => c.gnl_char_val_id),
        })),
      });
      clearCart();
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
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalValue}>₺{total.toFixed(2)}</Text>
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
