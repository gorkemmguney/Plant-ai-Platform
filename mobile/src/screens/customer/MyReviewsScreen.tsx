import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Review {
  review_id: number;
  prod_id: number;
  prod_name: string | null;
  rating: number;
  comment: string | null;
  seller_reply: string | null;
  created_at: string;
}

function Stars({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={[styles.star, n <= value ? styles.starOn : styles.starOff]}>★</Text>
      ))}
    </View>
  );
}

export default function MyReviewsScreen() {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Review[]>('/reviews/mine');
      setReviews(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('myReviews.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderReview = ({ item }: { item: Review }) => {
    const date = new Date(item.created_at);
    const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR');
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.prodName} numberOfLines={1}>{item.prod_name ?? `${t('common.product')} #${item.prod_id}`}</Text>
          {!!dateText && <Text style={styles.date}>{dateText}</Text>}
        </View>
        <Stars value={item.rating} />
        {!!item.comment && <Text style={styles.comment}>{item.comment}</Text>}
        {!!item.seller_reply && (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>{t('myReviews.sellerReply')}</Text>
            <Text style={styles.replyText}>{item.seller_reply}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('myReviews.title')}</Text>
        <Text style={styles.headerSub}>{t('myReviews.sub')}</Text>
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
          data={reviews}
          keyExtractor={(item) => String(item.review_id)}
          contentContainerStyle={styles.list}
          renderItem={renderReview}
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
            <Text style={styles.emptyText}>{t('myReviews.empty')}</Text>
          }
        />
      )}
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prodName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, flex: 1, marginRight: spacing.sm },
  date: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted2 },
  star: { fontSize: 18 },
  starOn: { color: '#f5a524' },
  starOff: { color: colors.border },
  comment: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 19 },
  replyBox: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  replyLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10.5,
    color: colors.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  replyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, lineHeight: 18 },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl, lineHeight: 19 },
});
