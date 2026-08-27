import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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

interface Complaint {
  complaint_id: number;
  user_id: number;
  complaint_type: string;
  cust_ord_id: number | null;
  prod_id: number | null;
  reported_seller_id: number | null;
  title: string;
  description: string;
  status: string;
  admin_note: string | null;
  sentiment: string | null;
  urgency: string | null;
  ai_summary: string | null;
  ai_tags: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  reported_seller_name: string | null;
  product_name: string | null;
  order_price: number | null;
  order_date: string | null;
}

const statusMapping: Record<string, { labelKey: string; bg: string; text: string; icon: string }> = {
  pending: { labelKey: 'support.statusPending', bg: '#fef3c7', text: '#d97706', icon: 'time-outline' },
  in_progress: { labelKey: 'support.statusInProgress', bg: '#eff6ff', text: '#2563eb', icon: 'sync-outline' },
  resolved: { labelKey: 'support.statusResolved', bg: '#ecfdf5', text: '#059669', icon: 'checkmark-circle-outline' },
  rejected: { labelKey: 'support.statusRejected', bg: '#fef2f2', text: '#dc2626', icon: 'close-circle-outline' },
};

const typeMapping: Record<string, { labelKey: string; icon: string }> = {
  general: { labelKey: 'adminComplaints.typeGeneral', icon: 'help-circle-outline' },
  order: { labelKey: 'adminComplaints.typeOrder', icon: 'receipt-outline' },
  product: { labelKey: 'adminComplaints.typeProduct', icon: 'leaf-outline' },
  seller: { labelKey: 'adminComplaints.typeSeller', icon: 'business-outline' },
  suggestion: { labelKey: 'adminComplaints.typeSuggestion', icon: 'bulb-outline' },
};

const filters = [
  { key: 'all', labelKey: 'adminComplaints.filterAll' },
  { key: 'pending', labelKey: 'adminComplaints.filterPending' },
  { key: 'in_progress', labelKey: 'adminComplaints.filterInProgress' },
  { key: 'resolved', labelKey: 'adminComplaints.filterResolved' },
  { key: 'rejected', labelKey: 'adminComplaints.filterRejected' },
];

export default function AdminComplaintsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useI18n();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activePanel, setActivePanel] = useState<'customer' | 'seller'>('customer');
  const [error, setError] = useState<string | null>(null);

  const fetchComplaints = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') params.append('status_filter', activeFilter);
      params.append('source_panel', activePanel);
      const url = `/complaints/admin/all?${params.toString()}`;

      const { data } = await apiClient.get<Complaint[]>(url);
      setComplaints(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('adminComplaints.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, activePanel]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // When focusing back on this screen, refresh (e.g. status changed in detail view)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchComplaints();
    });
    return unsubscribe;
  }, [navigation, fetchComplaints]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const renderItem = ({ item }: { item: Complaint }) => {
    const statusInfo = statusMapping[item.status];
    const statusLabel = statusInfo ? t(statusInfo.labelKey) : item.status;
    const statusBg = statusInfo?.bg ?? colors.borderSoft;
    const statusText = statusInfo?.text ?? colors.muted;
    const statusIcon = (statusInfo?.icon ?? 'help-outline') as any;
    const typeInfo = typeMapping[item.complaint_type];
    const typeLabel = typeInfo ? t(typeInfo.labelKey) : t('adminComplaints.unknown');
    const typeIcon = (typeInfo?.icon ?? 'help-outline') as any;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('AdminComplaintDetail', { complaintId: item.complaint_id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.typeTag}>
            <Ionicons name={typeIcon} size={15} color={colors.primaryDeep} style={{ marginRight: 4 }} />
            <Text style={styles.typeTagText}>{typeLabel}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Ionicons name={statusIcon} size={13} color={statusText} style={{ marginRight: 3 }} />
            <Text style={[styles.statusBadgeText, { color: statusText }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.userInfo}>
            <Ionicons name="person-outline" size={13} color={colors.muted2} style={{ marginRight: 4 }} />
            <Text style={styles.userText}>{item.user_name || item.user_email || t('adminComplaints.user')}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.panelTabs}>
        {([
          { key: 'customer', labelKey: 'adminComplaints.customerRequests' },
          { key: 'seller', labelKey: 'adminComplaints.sellerRequests' },
        ] as { key: 'customer' | 'seller'; labelKey: string }[]).map((tab) => {
          const active = activePanel === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={[styles.panelTab, active && styles.panelTabActive]}
              onPress={() => setActivePanel(tab.key)} activeOpacity={0.8}>
              <Text style={[styles.panelTabText, active && styles.panelTabTextActive]}>{t(tab.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === item.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === item.key && styles.filterChipTextActive,
                ]}
              >
                {t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
          <Text style={styles.loadingText}>{t('adminComplaints.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchComplaints()}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : complaints.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyEmoji}>📬</Text>
          <Text style={styles.emptyTitle}>{t('adminComplaints.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('adminComplaints.emptyText')}</Text>
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(item) => item.complaint_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchComplaints(true)}
              colors={[colors.buttonPrimary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  panelTabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  panelTab: { flex: 1, paddingVertical: 11, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  panelTabActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  panelTabText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  panelTabTextActive: { color: colors.buttonPrimaryText },
  filterContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingVertical: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 6,
  },
  filterChipActive: {
    borderColor: colors.buttonPrimary,
    backgroundColor: colors.buttonPrimary,
  },
  filterChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.muted,
  },
  filterChipTextActive: {
    color: colors.buttonPrimaryText,
    fontFamily: fonts.sansBold,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  typeTagText: {
    fontFamily: fonts.sansSemi,
    fontSize: 10.5,
    color: colors.primaryDeep,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  statusBadgeText: {
    fontFamily: fonts.sansSemi,
    fontSize: 10.5,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 15.5,
    color: colors.ink,
    marginBottom: 4,
  },
  description: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.muted,
  },
  dateText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
  },
  errorText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.red,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.buttonPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  retryText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.buttonPrimaryText,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  aiBadgesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  aiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  aiBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 9.5,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  tagText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.primaryDeep,
  },
});
