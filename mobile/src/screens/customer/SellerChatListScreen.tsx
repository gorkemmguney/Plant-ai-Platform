import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useI18n } from '../../i18n';
import { CommInteraction, fetchInteractions } from '../../services/communicationService';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

export default function SellerChatListScreen({ navigation }: any) {
  const { t } = useI18n();
  const [interactions, setInteractions] = useState<CommInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchInteractions();
      setInteractions(data);
    } catch (err) {
      console.log('[SellerChatList] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderItem = ({ item }: { item: CommInteraction }) => {
    const formattedDate = new Date(item.last_message_at).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={styles.chatCard}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('SellerChatDetail', {
            interactionId: item.comm_interaction_id,
            partnerName: item.partner_name,
            prodName: item.related_prod_name,
            prodImage: item.related_prod_image,
            ordId: item.related_ord_id,
          })
        }
      >
        <View style={styles.avatar}>
          <Ionicons name="storefront" size={20} color={colors.primaryDeep} />
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.topRow}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {item.partner_name}
            </Text>
            <Text style={styles.timeText}>{formattedDate}</Text>
          </View>

          {item.related_ord_id && (
            <View style={styles.orderBadge}>
              <Ionicons name="receipt-outline" size={12} color={colors.primaryDeep} style={{ marginRight: 4 }} />
              <Text style={styles.orderBadgeText} numberOfLines={1}>
                Sipariş #{item.related_ord_id}
              </Text>
            </View>
          )}

          {item.related_prod_name && (
            <View style={styles.productBadge}>
              <Ionicons name="leaf-outline" size={12} color={colors.primaryDeep} style={{ marginRight: 4 }} />
              <Text style={styles.productBadgeText} numberOfLines={1}>
                {item.related_prod_name}
              </Text>
            </View>
          )}

          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message_text || t('sellerChat.noMessages')}
          </Text>
        </View>

        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mesajlarım 💬</Text>
          <Text style={styles.headerSub}>Satıcılar ve Bitki Severlerle Sohbetleriniz</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={interactions}
          keyExtractor={(item) => String(item.comm_interaction_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={54} color={colors.muted2} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>{t('sellerChat.noInteractions')}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.secondary,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.white },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: '#c9c9d6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.md, gap: spacing.sm },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  chatInfo: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  partnerName: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, flex: 1, marginRight: 8 },
  timeText: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  orderBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primaryDeep },
  productBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  productBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primaryDeep },
  lastMessage: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
  unreadBadge: {
    backgroundColor: colors.red,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.white },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted, textAlign: 'center' },
});
