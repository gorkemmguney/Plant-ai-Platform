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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing, gradients, badgeColors } from '../../theme/theme';

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
      setError(err?.response?.data?.detail ?? 'Başvurular yüklenemedi.');
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
      setSellers((prev) => prev.filter((s) => s.user_id !== seller.user_id));
    } catch (err: any) {
      Alert.alert('İşlem başarısız', err?.response?.data?.detail ?? 'Başvuru güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const getInitials = (first: string, last: string) => {
    const f = first ? first.charAt(0).toUpperCase() : '';
    const l = last ? last.charAt(0).toUpperCase() : '';
    return `${f}${l}` || '?';
  };

  const renderItem = ({ item }: { item: PendingSeller }) => {
    const fullName = `${item.first_name} ${item.last_name}`.trim() || 'İsimsiz Kullanıcı';
    const initials = getInitials(item.first_name, item.last_name);
    const busy = busyId === item.user_id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
          </View>
          <View style={[styles.pendingBadge, { backgroundColor: badgeColors.amber.bg }]}>
            <Text style={[styles.pendingBadgeText, { color: badgeColors.amber.text }]}>Onay Bekliyor</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.rejectBtn, busy && styles.btnDisabled]}
            onPress={() => decide(item, false)}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.red} style={{ marginRight: 6 }} />
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
              <View style={styles.btnContent}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.approveText}>Onayla</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Satıcı Onayları</Text>
          {sellers.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{sellers.length} Başvuru</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSub}>Platformda mağaza açmak isteyen satıcıların başvuruları</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.secondary} />
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>Tümü Tamamlandı!</Text>
              <Text style={styles.emptyText}>Bekleyen satıcı mağaza başvurusu bulunmuyor.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  countText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.white,
  },
  headerSub: { fontFamily: fonts.sans, fontSize: 11.5, color: '#c9c9d6', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.muted,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  name: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  email: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pendingBadgeText: { fontFamily: fonts.sansBold, fontSize: 10 },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.red },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.green,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.white },
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
});
