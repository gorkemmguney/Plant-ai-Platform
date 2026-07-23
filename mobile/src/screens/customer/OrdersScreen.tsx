import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
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

interface CatalogProduct {
  prod_id: number;
  name: string;
  price: string | number;
  stock: number;
  seller_id: number | null;
  seller_name: string | null;
  image_url: string | null;
}

const HIDE_BTN_W = 92;

function SwipeToHide({ children, onHide }: { children: React.ReactNode; onHide: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const next = Math.min(0, Math.max(-HIDE_BTN_W, offset.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const next = offset.current + g.dx;
        const open = next < -HIDE_BTN_W / 2;
        offset.current = open ? -HIDE_BTN_W : 0;
        Animated.spring(translateX, { toValue: offset.current, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <View style={styles.swipeWrap}>
      <TouchableOpacity style={styles.hideAction} onPress={onHide} activeOpacity={0.85}>
        <Text style={styles.hideActionText}>Gizle</Text>
      </TouchableOpacity>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

interface OrderItemChar {
  gnl_char_id: number;
  value: string;
}

interface OrderItem {
  cust_ord_item_id: number;
  prod_id: number | null;
  prod_name: string;
  quantity: number;
  unit_price: string | number;
  char_values: OrderItemChar[];
}

interface Order {
  cust_ord_id: number;
  total_price: string | number;
  order_date: string;
  gnl_st_id: number;
  items: OrderItem[];
}

const statusLabels: Record<number, string> = {
  5: 'Alındı',
  6: 'Hazırlanıyor',
  7: 'Kargoda',
  8: 'Teslim edildi',
  9: 'İptal edildi',
};

const CANCELLABLE = [5, 6];

const HIDDEN_ORDERS_KEY = 'hidden_order_ids';

export default function OrdersScreen({ navigation }: any) {
  const { addToCart } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);

  // Değerlendirme (yıldız + yorum) modalı — sipariş KALEMİ bazında tek seferlik
  const [reviewItem, setReviewItem] = useState<{ prod_id: number; prod_name: string; cust_ord_item_id: number } | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [reviewedItemIds, setReviewedItemIds] = useState<Set<number>>(new Set());

  const loadReviewedItems = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/reviews/mine');
      setReviewedItemIds(new Set(data.map((r: any) => r.cust_ord_item_id)));
    } catch {
      // sessizce yoksay
    }
  }, []);

  const openReview = (prod_id: number, prod_name: string, cust_ord_item_id: number) => {
    setReviewItem({ prod_id, prod_name, cust_ord_item_id });
    setStars(0);
    setComment('');
  };

  const submitReview = async () => {
    if (!reviewItem || stars < 1) {
      Alert.alert('Puan gerekli', 'Lütfen 1-5 arası yıldız ver.');
      return;
    }
    setSavingReview(true);
    try {
      await apiClient.post('/reviews', {
        prod_id: reviewItem.prod_id,
        cust_ord_item_id: reviewItem.cust_ord_item_id,
        rating: stars,
        comment: comment.trim() || null,
      });
      setReviewedItemIds((prev) => new Set(prev).add(reviewItem.cust_ord_item_id));
      setReviewItem(null);
      Alert.alert('Teşekkürler 🌿', 'Değerlendirmen kaydedildi.');
    } catch (err: any) {
      Alert.alert('Kaydedilemedi', err?.response?.data?.detail ?? 'Değerlendirme kaydedilemedi.');
    } finally {
      setSavingReview(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Order[]>('/orders');
      setOrders(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Siparişler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadReviewedItems();
  }, [load, loadReviewedItems]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(HIDDEN_ORDERS_KEY);
        if (stored) setHiddenIds(JSON.parse(stored));
      } catch {
        // sessizce geç
      }
    })();
  }, []);

  const hideOrder = (id: number) => {
    setHiddenIds((prev) => {
      const next = [...prev, id];
      AsyncStorage.setItem(HIDDEN_ORDERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleReorder = async (order: Order) => {
    setReorderingId(order.cust_ord_id);
    try {
      const { data: products } = await apiClient.get<CatalogProduct[]>('/catalog/products');
      const byId = new Map(products.map((p) => [p.prod_id, p]));
      let added = 0;
      let skipped = 0;
      for (const it of order.items) {
        const p = it.prod_id != null ? byId.get(it.prod_id) : undefined;
        if (!p || p.stock <= 0) {
          skipped += 1;
          continue;
        }
        const qty = Math.min(it.quantity, p.stock);
        addToCart(
          {
            prod_id: p.prod_id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            seller_id: p.seller_id,
            seller_name: p.seller_name,
            image_url: p.image_url,
          },
          qty,
          []
        );
        added += 1;
      }
      if (added === 0) {
        Alert.alert('Eklenemedi', 'Bu siparişteki ürünler artık satışta değil.');
      } else {
        Alert.alert(
          'Sepete eklendi 🛒',
          skipped > 0 ? `${added} ürün eklendi, ${skipped} ürün artık mevcut değil.` : `${added} ürün sepete eklendi.`,
          [
            { text: 'Sepete git', onPress: () => navigation.navigate('Cart') },
            { text: 'Tamam' },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.detail ?? 'Ürünler yüklenemedi.');
    } finally {
      setReorderingId(null);
    }
  };

  const handleCancel = (order: Order) => {
    Alert.alert('Siparişi iptal et', `Sipariş #${order.cust_ord_id} iptal edilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal Et',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(order.cust_ord_id);
          try {
            await apiClient.post(`/orders/${order.cust_ord_id}/cancel`);
            await load();
          } catch (err: any) {
            Alert.alert('İptal edilemedi', err?.response?.data?.detail ?? 'Sipariş iptal edilemedi.');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const date = new Date(item.order_date);
    const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR');
    const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
    const expanded = expandedId === item.cust_ord_id;
    const card = (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => setExpandedId(expanded ? null : item.cust_ord_id)}
      >
        <View style={styles.cardTop}>
          <Text style={styles.orderId}>Sipariş #{item.cust_ord_id}</Text>
          <Text style={styles.total}>₺{Number(item.total_price).toFixed(2)}</Text>
        </View>
        <Text style={styles.meta}>
          {dateText}
          {dateText ? ' · ' : ''}
          {itemCount} ürün
        </Text>
        <View style={styles.badgeRow}>
          {(() => {
            const delivered = item.gnl_st_id === 8;
            const sb = item.gnl_st_id === 9 ? badgeColors.red : delivered ? badgeColors.green : badgeColors.secondary;
            return (
              <View style={[styles.badge, styles.badgeWithIcon, { backgroundColor: sb.bg }]}>
                {delivered && <Ionicons name="checkmark-circle" size={13} color={sb.text} />}
                <Text style={[styles.badgeText, { color: sb.text }]}>
                  {statusLabels[item.gnl_st_id] ?? 'Durum bilinmiyor'}
                </Text>
              </View>
            );
          })()}
          <Text style={styles.detailHint}>{expanded ? 'Gizle ▲' : 'Detay ▼'}</Text>
        </View>

        {item.gnl_st_id === 8 && (
          <View style={styles.rateSection}>
            {item.items
              .filter((it) => it.prod_id != null && !reviewedItemIds.has(it.cust_ord_item_id))
              .map((it) => (
                <TouchableOpacity
                  key={`rate-${it.cust_ord_item_id}`}
                  style={styles.rateRowBtn}
                  onPress={() => openReview(it.prod_id as number, it.prod_name, it.cust_ord_item_id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rateRowText} numberOfLines={1}>⭐ Değerlendir — {it.prod_name}</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {expanded && (
          <View style={styles.itemsBox}>
            {item.items.map((it) => {
              const variantLabel = (it.char_values ?? []).map((c) => c.value).join(' · ');
              return (
                <View key={it.cust_ord_item_id} style={styles.itemBlock}>
                  <View style={styles.itemRow}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {it.prod_name} × {it.quantity}
                      </Text>
                      {variantLabel ? (
                        <Text style={styles.itemVariant} numberOfLines={1}>{variantLabel}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.itemPrice}>₺{(Number(it.unit_price) * it.quantity).toFixed(2)}</Text>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.reorderBtn}
              onPress={() => handleReorder(item)}
              disabled={reorderingId === item.cust_ord_id}
              activeOpacity={0.85}
            >
              {reorderingId === item.cust_ord_id ? (
                <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
              ) : (
                <Text style={styles.reorderText}>🔁 Tekrar Sipariş Ver</Text>
              )}
            </TouchableOpacity>

            {CANCELLABLE.includes(item.gnl_st_id) && (
              <TouchableOpacity
                style={styles.cancelOrderBtn}
                onPress={() => handleCancel(item)}
                disabled={cancellingId === item.cust_ord_id}
                activeOpacity={0.85}
              >
                {cancellingId === item.cust_ord_id ? (
                  <ActivityIndicator size="small" color={colors.red} />
                ) : (
                  <Text style={styles.cancelOrderText}>Siparişi İptal Et</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );

    if (item.gnl_st_id === 9) {
      return (
        <SwipeToHide onHide={() => hideOrder(item.cust_ord_id)}>
          {card}
        </SwipeToHide>
      );
    }
    return card;
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Siparişlerim</Text>
        <Text style={styles.headerSub}>Verdiğin siparişleri takip et</Text>
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
          data={orders.filter((o) => !hiddenIds.includes(o.cust_ord_id))}
          keyExtractor={(item) => String(item.cust_ord_id)}
          contentContainerStyle={styles.list}
          renderItem={renderOrder}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz siparişin yok. Mağaza'dan alışverişe başla!</Text>}
        />
      )}

      <Modal visible={reviewItem !== null} transparent animationType="fade" onRequestClose={() => setReviewItem(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={2}>{reviewItem?.prod_name}</Text>
            <Text style={styles.modalSub}>Bu ürünü değerlendir — bu işlem sonradan değiştirilemez</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} activeOpacity={0.7}>
                  <Text style={[styles.star, n <= stars ? styles.starOn : styles.starOff]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Yorumun (isteğe bağlı)"
              placeholderTextColor={colors.muted2}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setReviewItem(null)} disabled={savingReview}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={submitReview} disabled={savingReview}>
                {savingReview ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Gönder</Text>
                )}
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
  header: { paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md },
  swipeWrap: { position: 'relative', justifyContent: 'center' },
  hideAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 92,
    backgroundColor: colors.red,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideActionText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  total: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDeep },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 3, marginBottom: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 11 },
  detailHint: { fontFamily: fonts.sansSemi, fontSize: 12, color: colors.muted },
  itemsBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.sm,
  },
  itemBlock: { gap: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  rateSection: { marginTop: spacing.sm, gap: spacing.xs },
  rateRowBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  rateRowText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.primaryDeep },
  itemVariant: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.muted2, marginTop: 1 },
  itemPrice: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  cancelOrderBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelOrderText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.red },
  reorderBtn: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  reorderText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
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
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  modalSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  starsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.lg },
  star: { fontSize: 38 },
  starOn: { color: '#f5a524' },
  starOff: { color: colors.border },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  modalSave: {
    flex: 1.3,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
});
