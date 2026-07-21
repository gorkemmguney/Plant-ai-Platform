import { Ionicons } from '@expo/vector-icons';
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
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Campaign {
  campaign_id: number;
  title: string;
  description: string | null;
  required_points: number;
  reward_text: string | null;
  seller_id: number | null;
  seller_name: string | null;
}

export default function CampaignsScreen() {
  const { points, refreshProfile } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Campaign[]>('/campaigns');
      setCampaigns(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Kampanyalar yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = (c: Campaign) => {
    Alert.alert('Kampanyayı kullan', `"${c.title}" için ${c.required_points} puan harcanacak. Onaylıyor musun?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kullan',
        onPress: async () => {
          setRedeemingId(c.campaign_id);
          try {
            const { data } = await apiClient.post(`/campaigns/${c.campaign_id}/redeem`);
            await refreshProfile();
            Alert.alert(
              'Kupon oluşturuldu 🎉',
              `Kupon kodun: ${data.coupon_code}\nSepette "Kampanyalarım"dan seçip kullanabilirsin.\nKalan puan: ${data.remaining_points}`
            );
          } catch (err: any) {
            Alert.alert('Kullanılamadı', err?.response?.data?.detail ?? 'Kampanya kullanılamadı.');
          } finally {
            setRedeemingId(null);
          }
        },
      },
    ]);
  };

  const renderCampaign = ({ item }: { item: Campaign }) => {
    const enough = points >= item.required_points;
    const busy = redeemingId === item.campaign_id;
    return (
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="gift" size={22} color={colors.primaryDeep} />
        </View>
        <View style={styles.info}>
          {!!item.seller_name && <Text style={styles.store}>🏪 {item.seller_name}</Text>}
          <Text style={styles.title}>{item.title}</Text>
          {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
          <Text style={styles.points}>{item.required_points} puan</Text>
        </View>
        <TouchableOpacity
          style={[styles.useBtn, (!enough || busy) && styles.useBtnDisabled]}
          onPress={() => redeem(item)}
          disabled={!enough || busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
          ) : (
            <Text style={styles.useBtnText}>{enough ? 'Kullan' : 'Yetersiz'}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kampanyalar</Text>
        <View style={styles.pointsPill}>
          <Ionicons name="sparkles" size={13} color={colors.primaryDeep} />
          <Text style={styles.pointsText}>{points} puan</Text>
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
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => String(item.campaign_id)}
          contentContainerStyle={styles.list}
          renderItem={renderCampaign}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Şu an aktif kampanya yok.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 16,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pointsText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.primaryDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
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
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  store: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: colors.muted, marginBottom: 2 },
  title: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink },
  desc: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  points: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.primaryDeep, marginTop: 4 },
  useBtn: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    minWidth: 74,
    alignItems: 'center',
  },
  useBtnDisabled: { backgroundColor: colors.border },
  useBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.buttonPrimaryText },
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
