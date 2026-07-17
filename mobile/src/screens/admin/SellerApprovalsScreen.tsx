import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { colors, fonts, radius, shadow, spacing, gradients } from '../../theme/theme';

interface PendingSeller {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  seller_status: string;
}

interface AiSellerProfile {
  verdict: string;
  verdict_label: string;
  summary: string;
  risk_score: number;
}

type AiProfileState = AiSellerProfile | 'loading' | 'error';

// trust_score = 100 - risk_score
const getTrustScore = (risk: number) => 100 - risk;

const getScoreStyle = (trust: number) => {
  if (trust >= 72) return { color: '#2ecc71', bg: '#e3f9ed', label: 'Güvenilir', gradient: ['#27ae60', '#2ecc71'] as [string, string] };
  if (trust >= 45) return { color: '#e67e22', bg: '#fdf3e3', label: 'İnceleme Önerilir', gradient: ['#d35400', '#e67e22'] as [string, string] };
  return { color: '#e74c3c', bg: '#fdecea', label: 'Şüpheli', gradient: ['#c0392b', '#e74c3c'] as [string, string] };
};

const getInitials = (first: string, last: string) => {
  const f = first ? first.charAt(0).toUpperCase() : '';
  const l = last ? last.charAt(0).toUpperCase() : '';
  return `${f}${l}` || '?';
};

// Animated circular score ring component
function ScoreRing({ trust, loading }: { trust: number; loading: boolean }) {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(animVal, {
        toValue: 1,
        duration: 700,
        useNativeDriver: false,
      }).start();
    }
  }, [loading]);

  const style = getScoreStyle(trust);

  if (loading) {
    return (
      <View style={[styles.scoreRing, { borderColor: colors.border, backgroundColor: colors.bgAlt }]}>
        <ActivityIndicator size="small" color="#7c4dff" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={style.gradient}
      style={styles.scoreRingGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.scoreRingInner}>
        <Text style={styles.scoreNumber}>{trust}</Text>
        <Text style={styles.scoreMax}>/100</Text>
      </View>
    </LinearGradient>
  );
}

export default function SellerApprovalsScreen() {
  const [sellers, setSellers] = useState<PendingSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [aiProfiles, setAiProfiles] = useState<Record<number, AiProfileState>>({});

  // Auto-fetch AI profile for a single seller
  const fetchAiProfile = useCallback(async (seller: PendingSeller) => {
    setAiProfiles(prev => ({ ...prev, [seller.user_id]: 'loading' }));
    try {
      const { data } = await apiClient.get<AiSellerProfile>(`/admin/ai/seller-profile/${seller.user_id}`);
      setAiProfiles(prev => ({ ...prev, [seller.user_id]: data }));
    } catch {
      setAiProfiles(prev => ({ ...prev, [seller.user_id]: 'error' }));
    }
  }, []);

  // Load sellers then fire AI analyses in parallel
  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<PendingSeller[]>('/admin/sellers/pending');
      setSellers(data);
      // Fire all AI analyses simultaneously (non-blocking)
      data.forEach(seller => fetchAiProfile(seller));
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Başvurular yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAiProfile]);

  useEffect(() => { load(); }, [load]);

  const decide = async (seller: PendingSeller, approve: boolean) => {
    setBusyId(seller.user_id);
    try {
      const endpoint = approve
        ? `/admin/verify-seller/${seller.user_id}`
        : `/admin/reject-seller/${seller.user_id}`;
      await apiClient.post(endpoint);
      setSellers(prev => prev.filter(s => s.user_id !== seller.user_id));
      setAiProfiles(prev => {
        const next = { ...prev };
        delete next[seller.user_id];
        return next;
      });
    } catch (err: any) {
      Alert.alert('İşlem başarısız', err?.response?.data?.detail ?? 'Başvuru güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: PendingSeller }) => {
    const fullName = `${item.first_name} ${item.last_name}`.trim() || 'İsimsiz Kullanıcı';
    const initials = getInitials(item.first_name, item.last_name);
    const busy = busyId === item.user_id;
    const profileState = aiProfiles[item.user_id];
    const isProfileLoading = !profileState || profileState === 'loading';
    const profile = (profileState && profileState !== 'loading' && profileState !== 'error')
      ? profileState as AiSellerProfile
      : null;
    const trust = profile ? getTrustScore(profile.risk_score) : 0;
    const scoreStyle = profile ? getScoreStyle(trust) : null;

    return (
      <View style={styles.card}>
        {/* ── Top Row: Avatar + Info + Score Ring ── */}
        <View style={styles.cardTop}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>{fullName}</Text>
            <Text style={styles.sellerEmail} numberOfLines={1}>{item.email}</Text>
            {/* Verdict badge (shown after AI loads) */}
            {profile && scoreStyle && (
              <View style={[styles.verdictBadge, { backgroundColor: scoreStyle.bg }]}>
                <Ionicons
                  name={trust >= 72 ? 'shield-checkmark' : trust >= 45 ? 'eye' : 'warning'}
                  size={11}
                  color={scoreStyle.color}
                />
                <Text style={[styles.verdictBadgeText, { color: scoreStyle.color }]}>
                  {scoreStyle.label}
                </Text>
              </View>
            )}
          </View>

          {/* Score Ring */}
          <ScoreRing trust={profile ? trust : 0} loading={isProfileLoading} />
        </View>

        {/* ── AI Summary ── */}
        {isProfileLoading ? (
          <View style={styles.aiLoadingRow}>
            <Ionicons name="sparkles" size={13} color="#7c4dff" />
            <Text style={styles.aiLoadingText}>Gemini başvuruyu analiz ediyor...</Text>
          </View>
        ) : profileState === 'error' ? (
          <TouchableOpacity style={styles.retryAiRow} onPress={() => fetchAiProfile(item)} activeOpacity={0.7}>
            <Ionicons name="refresh" size={13} color={colors.muted} />
            <Text style={styles.retryAiText}>AI analizi başarısız — tekrar dene</Text>
          </TouchableOpacity>
        ) : profile && scoreStyle ? (
          <View style={[styles.aiSummaryBox, { backgroundColor: scoreStyle.bg, borderColor: scoreStyle.color + '30' }]}>
            <View style={styles.aiSummaryHeader}>
              <Ionicons name="sparkles" size={13} color="#7c4dff" />
              <Text style={styles.aiSummaryLabel}>Gemini Değerlendirmesi</Text>
            </View>
            <Text style={[styles.aiSummaryText, { color: scoreStyle.color }]}>{profile.summary}</Text>
          </View>
        ) : null}

        {/* ── Action Buttons ── */}
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
            style={[styles.approveBtn, busy && styles.btnDisabled,
              profile && trust < 45 && { backgroundColor: '#e67e22' }
            ]}
            onPress={() => {
              if (profile && trust < 45) {
                Alert.alert(
                  '⚠️ Düşük Güvenilirlik Skoru',
                  `Gemini bu başvuru için ${trust}/100 güvenilirlik puanı verdi. Onaylamak istediğinize emin misiniz?`,
                  [
                    { text: 'İptal', style: 'cancel' },
                    { text: 'Yine de Onayla', style: 'destructive', onPress: () => decide(item, true) },
                  ]
                );
              } else {
                decide(item, true);
              }
            }}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.approveText}>
                  {profile && trust < 45 ? 'Yine de Onayla' : 'Onayla'}
                </Text>
              </>
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
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Satıcı Onayları</Text>
            <Text style={styles.headerSub}>AI güvenilirlik puanlarını inceleyin ve karar verin</Text>
          </View>
          {sellers.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{sellers.length} Başvuru</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sellers}
          keyExtractor={item => String(item.user_id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>Tümü Tamamlandı!</Text>
              <Text style={styles.emptyText}>Bekleyen satıcı başvurusu bulunmuyor.</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  headerSub: { fontFamily: fonts.sans, fontSize: 11, color: '#c9c9d6', marginTop: 2 },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  countText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.white },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  retryButton: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingVertical: 10, paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },

  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },

  // Top Row
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatarBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.muted },
  sellerInfo: { flex: 1, gap: 3 },
  sellerName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  sellerEmail: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  verdictBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: 2,
  },
  verdictBadgeText: { fontFamily: fonts.sansBold, fontSize: 10 },

  // Score Ring
  scoreRingGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    ...shadow.sm,
  },
  scoreRingInner: {
    flex: 1,
    borderRadius: 29,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.ink, lineHeight: 20 },
  scoreMax: { fontFamily: fonts.sans, fontSize: 9, color: colors.muted, marginTop: -2 },

  // AI Loading / Error rows
  aiLoadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#f5efff',
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  aiLoadingText: { fontFamily: fonts.sans, fontSize: 12, color: '#7c4dff' },
  retryAiRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgAlt, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  retryAiText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },

  // AI Summary Box
  aiSummaryBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  aiSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiSummaryLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: '#7c4dff' },
  aiSummaryText: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 19 },

  // Divider & Actions
  divider: { height: 1, backgroundColor: colors.borderSoft },
  actions: { flexDirection: 'row', gap: spacing.md },
  rejectBtn: {
    flex: 1, flexDirection: 'row',
    borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.sm, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.red },
  approveBtn: {
    flex: 1, flexDirection: 'row',
    backgroundColor: colors.green,
    borderRadius: radius.sm, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  approveText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.white },
  btnDisabled: { opacity: 0.5 },

  // Empty State
  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xxl, marginTop: spacing.xl, gap: spacing.xs,
  },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.xs },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.ink, textAlign: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
});
