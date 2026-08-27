import { Ionicons } from '@expo/vector-icons';
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
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { trackInteraction } from '../../services/interactionService';
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

function SwipeToHide({ children, onHide, hideLabel }: { children: React.ReactNode; onHide: () => void; hideLabel: string }) {
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
        <Text style={styles.hideActionText}>{hideLabel}</Text>
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
  is_hidden: boolean;
  items: OrderItem[];
}

const statusKeys: Record<number, string> = {
  5: 'orderStatus.5',
  6: 'orderStatus.6',
  7: 'orderStatus.7',
  8: 'orderStatus.8',
  9: 'orderStatus.9',
};

const CANCELLABLE = [5, 6];

export default function OrdersScreen({ navigation }: any) {
  const { t } = useI18n();
  const { addToCart } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [hidingId, setHidingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'active' | 'hidden' | 'all'>('active');

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
      Alert.alert(t('orders.ratingRequired'), t('orders.ratingRequiredMsg'));
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
      trackInteraction('REVIEW_SUBMIT');
      setReviewedItemIds((prev) => new Set(prev).add(reviewItem.cust_ord_item_id));
      setReviewItem(null);
      Alert.alert(t('orders.thanks'), t('orders.reviewSaved'));
    } catch (err: any) {
      Alert.alert(t('common.saveFailed'), err?.response?.data?.detail ?? t('orders.reviewSaveFailed'));
    } finally {
      setSavingReview(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Order[]>('/orders/my');
      setOrders(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('orders.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadReviewedItems();
  }, [load, loadReviewedItems]);

  // Gizleme backend'de kalıcı (is_hidden). Gizlenen sipariş "Gizlenenler" sekmesinde
  // görünür ve oradan "Geri Getir" ile tekrar gösterilebilir (şifre gerekmez).
  const setVisibility = async (id: number, hidden: boolean) => {
    const prevOrders = orders;
    setHidingId(id);
    setOrders((prev) => prev.map((o) => (o.cust_ord_id === id ? { ...o, is_hidden: hidden } : o)));
    try {
      await apiClient.patch(`/orders/${id}/visibility`, { is_hidden: hidden });
    } catch (err: any) {
      setOrders(prevOrders);
      Alert.alert(t('orders.actionFailed'), err?.response?.data?.detail ?? t('orders.actionFailedMsg'));
    } finally {
      setHidingId(null);
    }
  };

  const hideOrder = (id: number) => setVisibility(id, true);
  const unhideOrder = (id: number) => setVisibility(id, false);

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
        Alert.alert(t('orders.reorderEmpty'), t('orders.reorderEmptyMsg'));
      } else {
        Alert.alert(
          t('orders.addedToCart'),
          skipped > 0
            ? `${added} ${t('orders.itemsAdded')}, ${skipped} ${t('orders.itemsUnavailable')}`
            : `${added} ${t('orders.itemsAddedToCart')}`,
          [
            { text: t('orders.goToCart'), onPress: () => navigation.navigate('Cart') },
            { text: t('common.ok') },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('common.productsLoadFailed'));
    } finally {
      setReorderingId(null);
    }
  };

  const handleCancel = (order: Order) => {
    Alert.alert(t('orders.cancelTitle'), `${t('orders.cancelQPre')}#${order.cust_ord_id}${t('orders.cancelQPost')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('orders.confirmCancel'),
        style: 'destructive',
        onPress: async () => {
          setCancellingId(order.cust_ord_id);
          try {
            await apiClient.post(`/orders/${order.cust_ord_id}/cancel`);
            await load();
          } catch (err: any) {
            Alert.alert(t('orders.cancelFailed'), err?.response?.data?.detail ?? t('orders.cancelFailedMsg'));
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
          <Text style={styles.orderId}>{t('orders.orderPrefix')}#{item.cust_ord_id}</Text>
          <Text style={styles.total}>₺{Number(item.total_price).toFixed(2)}</Text>
        </View>
        <Text style={styles.meta}>
          {dateText}
          {dateText ? ' · ' : ''}
          {itemCount} {t('common.items')}
        </Text>
        <View style={styles.badgeRow}>
          {(() => {
            const delivered = item.gnl_st_id === 8;
            const sb = item.gnl_st_id === 9 ? badgeColors.red : delivered ? badgeColors.green : badgeColors.secondary;
            return (
              <View style={[styles.badge, styles.badgeWithIcon, { backgroundColor: sb.bg }]}>
                {delivered && <Ionicons name="checkmark-circle" size={13} color={sb.text} />}
                <Text style={[styles.badgeText, { color: sb.text }]}>
                  {statusKeys[item.gnl_st_id] ? t(statusKeys[item.gnl_st_id]) : t('orders.statusUnknown')}
                </Text>
              </View>
            );
          })()}
          <Text style={styles.detailHint}>{expanded ? t('orders.collapse') : t('orders.detail')}</Text>
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
                  <Text style={styles.rateRowText} numberOfLines={1}>⭐ {t('orders.rate')} — {it.prod_name}</Text>
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
                <Text style={styles.reorderText}>{t('orders.reorder')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chatSellerOrderBtn}
              onPress={async () => {
                const firstSeller = (item.items.find((i: any) => i.seller_id) as any)?.seller_id || 1;
                try {
                  const { startCommunication } = require('../../services/communicationService');
                  const interaction = await startCommunication({
                    seller_id: firstSeller,
                    related_ord_id: item.cust_ord_id,
                    subject: `Sipariş #${item.cust_ord_id} Hakkında`,
                    initial_message: `Merhaba, Sipariş #${item.cust_ord_id} hakkında bilgi almak istiyorum.`,
                  });
                  navigation.navigate('SellerChatDetail', {
                    interactionId: interaction.comm_interaction_id,
                    partnerName: interaction.partner_name || 'Satıcı',
                    ordId: item.cust_ord_id,
                    prodName: interaction.related_prod_name,
                    prodImage: interaction.related_prod_image,
                  });
                } catch (err: any) {
                  Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('sellerChat.startError'));
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubbles-outline" size={15} color={colors.primaryDeep} style={{ marginRight: 6 }} />
              <Text style={styles.chatSellerOrderText}>Satıcıya Sipariş Hakkında Soru Sor</Text>
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
                  <Text style={styles.cancelOrderText}>{t('orders.cancelOrder')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );

    // Gizlenmiş sipariş (Gizlenenler/Tümü sekmesinde) → "Geri Getir" butonu
    if (item.is_hidden) {
      return (
        <View>
          {card}
          <TouchableOpacity
            style={styles.unhideBtn}
            onPress={() => unhideOrder(item.cust_ord_id)}
            disabled={hidingId === item.cust_ord_id}
            activeOpacity={0.85}
          >
            {hidingId === item.cust_ord_id ? (
              <ActivityIndicator size="small" color={colors.primaryDeep} />
            ) : (
              <Text style={styles.unhideText}>{t('orders.restore')}</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // İptal edilmiş ve gizlenmemiş → sola kaydırıp gizlenebilir
    if (item.gnl_st_id === 9) {
      return (
        <SwipeToHide onHide={() => hideOrder(item.cust_ord_id)} hideLabel={t('orders.hide')}>
          {hidingId === item.cust_ord_id ? (
            <View style={styles.hidingOverlay}>
              <ActivityIndicator size="small" color={colors.muted} />
            </View>
          ) : (
            card
          )}
        </SwipeToHide>
      );
    }
    return card;
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('orders.title')}</Text>
        <Text style={styles.headerSub}>{t('orders.sub')}</Text>

        <View style={styles.filterRow}>
          {([
            { key: 'active', label: t('orders.filterActive') },
            { key: 'hidden', label: t('orders.filterHidden') },
            { key: 'all', label: t('orders.filterAll') },
          ] as { key: 'active' | 'hidden' | 'all'; label: string }[]).map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterBtn, active && styles.filterBtnActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
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
          data={orders.filter((o) => {
            if (filter === 'active') return !o.is_hidden;
            if (filter === 'hidden') return o.is_hidden;
            return true; // tümü
          })}
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
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {filter === 'hidden'
                ? t('orders.emptyHidden')
                : filter === 'active'
                ? t('orders.emptyActive')
                : t('orders.emptyAll')}
            </Text>
          }
        />
      )}

      <Modal visible={reviewItem !== null} transparent animationType="fade" onRequestClose={() => setReviewItem(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={2}>{reviewItem?.prod_name}</Text>
            <Text style={styles.modalSub}>{t('orders.reviewSub')}</Text>

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
              placeholder={t('orders.commentPlaceholder')}
              placeholderTextColor={colors.muted2}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setReviewItem(null)} disabled={savingReview}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={submitReview} disabled={savingReview}>
                {savingReview ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>{t('common.submit')}</Text>
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
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    padding: 4,
  },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.full, alignItems: 'center' },
  filterBtnActive: { backgroundColor: colors.buttonPrimary },
  filterText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.muted },
  filterTextActive: { color: colors.buttonPrimaryText, fontFamily: fonts.sansBold },
  unhideBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  unhideText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.primaryDeep },
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
  hidingOverlay: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
  chatSellerOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: 11,
    marginTop: spacing.xs,
  },
  chatSellerOrderText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primaryDeep },
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
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: 2 },
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
