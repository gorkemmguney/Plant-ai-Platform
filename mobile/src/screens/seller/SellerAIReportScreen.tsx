import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface NamedQty { name: string; qty: number }
interface NamedRating { name: string; rating: number }

interface Stats {
  total_products: number;
  active_products: number;
  out_of_stock: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  avg_rating: number | null;
  review_count: number;
  top_products: NamedQty[];
  cancelled_products: NamedQty[];
  low_rated: NamedRating[];
}

export default function SellerAIReportScreen() {
  const [report, setReport] = useState<string>('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get('/seller/ai-report');
      setReport(data.report);
      setStats(data.stats);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Rapor oluşturulamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metric = (icon: any, label: string, value: string | number, tint?: string) => (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={18} color={tint ?? colors.primaryDeep} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const listBlock = (title: string, icon: any, rows: { name: string; value: string }[], empty: string) => (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={16} color={colors.primaryDeep} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyRow}>{empty}</Text>
      ) : (
        rows.map((r, i) => (
          <View key={`${r.name}-${i}`} style={styles.row}>
            <Text style={styles.rowRank}>{i + 1}</Text>
            <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.rowValue}>{r.value}</Text>
          </View>
        ))
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.buttonPrimary} />
        <Text style={styles.loadingText}>Mağazan analiz ediliyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <LinearGradient colors={[colors.secondary, colors.secondaryDeep]} style={styles.hero}>
        <Ionicons name="sparkles" size={22} color={colors.primary} />
        <Text style={styles.heroTitle}>AI Mağaza Raporu</Text>
        <Text style={styles.heroSub}>Satış verilerin yapay zeka ile analiz edildi</Text>
      </LinearGradient>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {stats && (
            <>
              <View style={styles.metricsRow}>
                {metric('cube-outline', 'Aktif Ürün', stats.active_products)}
                {metric('checkmark-circle-outline', 'Teslim', stats.delivered_orders)}
                {metric('close-circle-outline', 'İptal', stats.cancelled_orders, colors.red)}
              </View>
              <View style={styles.metricsRow}>
                {metric('cash-outline', 'Ciro', `₺${Number(stats.total_revenue).toFixed(0)}`)}
                {metric('star-outline', 'Puan', stats.avg_rating ?? '—')}
                {metric('alert-circle-outline', 'Stok Yok', stats.out_of_stock, colors.amber)}
              </View>

              {listBlock('En Çok Tercih Edilenler', 'flame-outline',
                stats.top_products.map((p) => ({ name: p.name, value: `${p.qty} adet` })),
                'Henüz satış verisi yok.')}

              {listBlock('En Çok İptal Edilenler', 'trending-down-outline',
                stats.cancelled_products.map((p) => ({ name: p.name, value: `${p.qty} adet` })),
                'İptal edilen ürün yok — harika!')}

              {listBlock('Düşük Puanlı Ürünler', 'warning-outline',
                stats.low_rated.map((p) => ({ name: p.name, value: `${p.rating} ★` })),
                'Düşük puanlı ürünün yok.')}
            </>
          )}

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="bulb-outline" size={16} color={colors.primaryDeep} />
              <Text style={styles.cardTitle}>Yapay Zeka Yorumu</Text>
            </View>
            <Text style={styles.reportText}>{report}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 56, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing.md },
  loadingText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  hero: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'flex-start', gap: 4 },
  heroTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  heroSub: { fontFamily: fonts.sans, fontSize: 12.5, color: 'rgba(255,255,255,0.75)' },
  metricsRow: { flexDirection: 'row', gap: spacing.md },
  metricCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, alignItems: 'center', gap: 2, ...shadow.sm,
  },
  metricValue: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginTop: 4 },
  metricLabel: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.muted2, textAlign: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, ...shadow.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  rowRank: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.muted2, width: 16 },
  rowName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink, flex: 1 },
  rowValue: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.primaryDeep },
  emptyRow: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, paddingVertical: 6 },
  reportText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 21 },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center',
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
});
