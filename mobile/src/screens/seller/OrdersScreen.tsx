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
  cust_id: number;
  total_price: string | number;
  order_date: string;
  gnl_st_id: number;
  items: OrderItem[];
}

// Sipariş durumları (order_service.py ile aynı id'ler)
const STATUSES: { id: number; label: string }[] = [
  { id: 5, label: 'Alındı' },
  { id: 6, label: 'Hazırlanıyor' },
  { id: 7, label: 'Kargoda' },
  { id: 8, label: 'Teslim' },
  { id: 9, label: 'İptal' },
];

const statusLabel = (id: number) => STATUSES.find((s) => s.id === id)?.label ?? `#${id}`;

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Order[]>('/orders/all');
      setOrders(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Siparişler yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const changeStatus = async (order: Order, statusId: number) => {
    if (order.gnl_st_id === statusId) return;
    setBusyId(order.cust_ord_id);
    try {
      await apiClient.patch(`/orders/${order.cust_ord_id}/status`, { gnl_st_id: statusId });
      setOrders((prev) =>
        prev.map((o) => (o.cust_ord_id === order.cust_ord_id ? { ...o, gnl_st_id: statusId } : o))
      );
    } catch (err: any) {
      Alert.alert('Güncellenemedi', err?.response?.data?.detail ?? 'Sipariş durumu güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const date = new Date(item.order_date);
    const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR');
    const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.orderId}>Sipariş #{item.cust_ord_id}</Text>
            <Text style={styles.meta}>
              {dateText}
              {dateText ? ' · ' : ''}
              {itemCount} ürün · Müşteri #{item.cust_id}
            </Text>
          </View>
          <Text style={styles.total}>₺{Number(item.total_price).toFixed(2)}</Text>
        </View>

        <View style={[styles.currentBadge, { backgroundColor: badgeColors.secondary.bg }]}>
          <Text style={[styles.currentBadgeText, { color: badgeColors.secondary.text }]}>
            Durum: {statusLabel(item.gnl_st_id)}
          </Text>
        </View>

        <Text style={styles.updateLabel}>Durumu güncelle</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const active = item.gnl_st_id === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.statusChip, active ? styles.statusChipActive : styles.statusChipInactive]}
                onPress={() => changeStatus(item, s.id)}
                disabled={busyId === item.cust_ord_id}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    active ? styles.statusChipTextActive : styles.statusChipTextInactive,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {busyId === item.cust_ord_id && (
          <ActivityIndicator size="small" color={colors.muted} style={{ marginTop: spacing.sm }} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Siparişler</Text>
        <Text style={styles.headerSub}>Gelen siparişleri yönet</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadOrders} activeOpacity={0.85}>
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
                loadOrders();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz sipariş yok.</Text>}
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
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderId: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 3 },
  total: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDeep },
  currentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  currentBadgeText: { fontFamily: fonts.sansBold, fontSize: 11 },
  updateLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statusRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  statusChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  statusChipActive: { backgroundColor: colors.buttonPrimary },
  statusChipInactive: { backgroundColor: colors.bgAlt },
  statusChipText: { fontFamily: fonts.sansBold, fontSize: 11.5 },
  statusChipTextActive: { color: colors.white },
  statusChipTextInactive: { color: colors.muted },
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
