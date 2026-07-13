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
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface PendingSeller {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  seller_status: string;
}

export default function SellerApprovalsScreen() {
  const [sellers, setSellers] = useState<PendingSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<PendingSeller[]>('/admin/sellers/pending');
      setSellers(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Başvurular yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (seller: PendingSeller, approve: boolean) => {
    setBusyId(seller.user_id);
    try {
      const endpoint = approve
        ? `/admin/verify-seller/${seller.user_id}`
        : `/admin/reject-seller/${seller.user_id}`;
      await apiClient.post(endpoint);
      // Karar verilen başvuru listeden düşer
      setSellers((prev) => prev.filter((s) => s.user_id !== seller.user_id));
    } catch (err: any) {
      Alert.alert('İşlem başarısız', err?.response?.data?.detail ?? 'Başvuru güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: PendingSeller }) => {
    const fullName = `${item.first_name} ${item.last_name}`.trim() || 'İsimsiz kullanıcı';
    const busy = busyId === item.user_id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Onay bekliyor</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.rejectBtn, busy && styles.btnDisabled]}
            onPress={() => decide(item, false)}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.rejectText}>Reddet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveBtn, busy && styles.btnDisabled]}
            onPress={() => decide(item, true)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.approveText}>Onayla</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Satıcı Onayları</Text>
        <Text style={styles.headerSub}>Bekleyen satıcı başvurularını onayla/reddet</Text>
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
          data={sellers}
          keyExtractor={(item) => String(item.user_id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Bekleyen satıcı başvurusu yok. 🎉</Text>}
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
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  email: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  pendingBadge: {
    backgroundColor: '#fdf0dc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pendingBadgeText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: '#b3711a' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.red },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
  btnDisabled: { opacity: 0.5 },
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
