import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Review {
  review_id: number;
  prod_id: number;
  rating: number;
  comment: string | null;
  seller_reply: string | null;
  created_at: string;
  reviewer_name: string | null;
  prod_name: string | null;
}

export default function SellerReviewsScreen() {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Review[]>('/reviews/seller');
      setReviews(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('sellerReviews.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendReply = async (review: Review) => {
    const text = (drafts[review.review_id] ?? '').trim();
    if (!text) {
      Alert.alert(t('sellerReviews.emptyReply'), t('sellerReviews.emptyReplyMsg'));
      return;
    }
    setSavingId(review.review_id);
    try {
      await apiClient.post(`/reviews/${review.review_id}/reply`, { reply: text });
      setReviews((prev) =>
        prev.map((r) => (r.review_id === review.review_id ? { ...r, seller_reply: text } : r))
      );
      setEditingId(null);
    } catch (err: any) {
      Alert.alert(t('support.sendFailed'), err?.response?.data?.detail ?? t('sellerReviews.replySaveFailed'));
    } finally {
      setSavingId(null);
    }
  };

  const startEditing = (review: Review) => {
    setDrafts((prev) => ({ ...prev, [review.review_id]: review.seller_reply ?? '' }));
    setEditingId(review.review_id);
  };

  const renderReview = ({ item }: { item: Review }) => {
    const date = new Date(item.created_at);
    const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR');
    const isEditing = editingId === item.review_id;
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.prodName} numberOfLines={1}>{item.prod_name ?? t('common.product')}</Text>
          {!!dateText && <Text style={styles.date}>{dateText}</Text>}
        </View>
        <Text style={styles.stars}>
          {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
        </Text>
        <Text style={styles.reviewer}>{item.reviewer_name ?? t('role.customer')}</Text>
        {!!item.comment && <Text style={styles.comment}>{item.comment}</Text>}

        {/* Satıcı cevabı */}
        {item.seller_reply && !isEditing ? (
          <View style={styles.replyBox}>
            <Text style={styles.replyLabel}>{t('sellerReviews.yourReply')}</Text>
            <Text style={styles.replyText}>{item.seller_reply}</Text>
            <TouchableOpacity onPress={() => startEditing(item)} activeOpacity={0.7}>
              <Text style={styles.editLink}>{t('settings.edit')}</Text>
            </TouchableOpacity>
          </View>
        ) : isEditing ? (
          <View style={styles.replyEditor}>
            <TextInput
              style={styles.input}
              value={drafts[item.review_id] ?? ''}
              onChangeText={(val) => setDrafts((prev) => ({ ...prev, [item.review_id]: val }))}
              placeholder={t('sellerReviews.replyPlaceholder')}
              placeholderTextColor={colors.muted2}
              multiline
            />
            <View style={styles.editorActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingId(null)} activeOpacity={0.8}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => sendReply(item)}
                disabled={savingId === item.review_id}
                activeOpacity={0.85}
              >
                {savingId === item.review_id ? (
                  <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
                ) : (
                  <Text style={styles.sendText}>{t('common.submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.replyBtn} onPress={() => startEditing(item)} activeOpacity={0.85}>
            <Text style={styles.replyBtnText}>{t('sellerReviews.reply')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('sellerReviews.title')}</Text>
        <Text style={styles.headerSub}>{t('sellerReviews.sub')}</Text>
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
          ListEmptyComponent={<Text style={styles.emptyText}>{t('sellerReviews.empty')}</Text>}
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prodName: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, flex: 1, marginRight: spacing.sm },
  date: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted2 },
  stars: { fontSize: 15, color: '#f5a524', marginTop: 6 },
  reviewer: { fontFamily: fonts.sansSemi, fontSize: 12, color: colors.muted, marginTop: 4 },
  comment: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, marginTop: 6, lineHeight: 19 },
  replyBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
  },
  replyLabel: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.primaryDeep },
  replyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, marginTop: 3, lineHeight: 18 },
  editLink: { fontFamily: fonts.sansSemi, fontSize: 12, color: colors.primaryDeep, marginTop: 6 },
  replyBtn: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  replyBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primaryDeep },
  replyEditor: { marginTop: spacing.md, gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 64,
    textAlignVertical: 'top',
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  editorActions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  sendBtn: {
    flex: 1.4,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
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
