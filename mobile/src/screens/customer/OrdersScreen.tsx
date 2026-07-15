import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface OrderItem {
  cust_ord_item_id: number;
  prod_id: number;
  quantity: number;
  unit_price: string | number;
}

interface Order {
  cust_ord_id: number;
  total_price: string | number;
  order_date: string;
  gnl_st_id: number;
  items: OrderItem[];
}

// Sipariş durumları (backend order_service ile aynı id'ler)
const statusLabels: Record<number, string> = {
  5: 'Alındı',
  6: 'Hazırlanıyor',
  7: 'Kargoda',
  8: 'Teslim edildi',
  9: 'İptal edildi',
};

// Sadece erken aşamada iptal edilebilir (Alındı, Hazırlanıyor)
const CANCELLABLE = [5, 6];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productNames, setProductNames] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      // Siparişler + ürün adları (item'larda sadece prod_id var, adı katalogdan alıyoruz)
      const [ordersRes, productsRes] = await Promise.all([
        apiClient.get<Order[]>('/orders'),
        apiClient.get<{ prod_id: number; name: string }[]>('/catalog/products'),
      ]);
      setOrders(ordersRes.data);
      const names: Record<number, string> = {};
      productsRes.data.forEach((p) => {
        names[p.prod_id] = p.name;
      });
      setProductNames(names);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Siparişler yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    return (
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
          <View style={[styles.badge, { backgroundColor: badgeColors.secondary.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors.secondary.text }]}>
              {statusLabels[item.gnl_st_id] ?? 'Durum bilinmiyor'}
            </Text>
          </View>
          <Text style={styles.detailHint}>{expanded ? 'Gizle ▲' : 'Detay ▼'}</Text>
        </View>

        {expanded && (
          <View style={styles.itemsBox}>
            {item.items.map((it) => (
              <View key={it.cust_ord_item_id} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {productNames[it.prod_id] ?? `Ürün #${it.prod_id}`} × {it.quantity}
                </Text>
                <Text style={styles.itemPrice}>₺{(Number(it.unit_price) * it.quantity).toFixed(2)}</Text>
              </View>
            ))}

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
          data={orders}
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
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, flex: 1, marginRight: spacing.sm },
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
