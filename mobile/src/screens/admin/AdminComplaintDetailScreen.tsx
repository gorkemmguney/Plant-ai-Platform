import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const statusOptions = [
  { key: 'pending', labelKey: 'support.statusPending', bg: '#fef3c7', text: '#d97706', activeBorder: '#d97706' },
  { key: 'in_progress', labelKey: 'support.statusInProgress', bg: '#eff6ff', text: '#2563eb', activeBorder: '#2563eb' },
  { key: 'resolved', labelKey: 'support.statusResolved', bg: '#ecfdf5', text: '#059669', activeBorder: '#059669' },
  { key: 'rejected', labelKey: 'support.statusRejected', bg: '#fef2f2', text: '#dc2626', activeBorder: '#dc2626' },
];

const typeMapping: Record<string, { labelKey: string; icon: string }> = {
  general: { labelKey: 'adminComplaints.typeGeneral', icon: 'help-circle-outline' },
  order: { labelKey: 'adminComplaints.typeOrder', icon: 'receipt-outline' },
  product: { labelKey: 'adminComplaints.typeProduct', icon: 'leaf-outline' },
  seller: { labelKey: 'adminComplaints.typeSeller', icon: 'business-outline' },
  suggestion: { labelKey: 'adminComplaints.typeSuggestion', icon: 'bulb-outline' },
};

export default function AdminComplaintDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { t } = useI18n();
  const { complaintId } = route.params;

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('pending');
  const [adminNote, setAdminNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [riskAdvice, setRiskAdvice] = useState<any>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);

  const handleAiDraft = async () => {
    setDrafting(true);
    try {
      const { data } = await apiClient.post(`/complaints/admin/${complaintId}/ai-draft?target_status=${status}`);
      if (data && data.suggested_note) {
        setAdminNote(data.suggested_note);
      } else {
        Alert.alert(t('common.error'), t('cDetail.aiNoResponse'));
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('cDetail.aiDraftFailed'));
    } finally {
      setDrafting(false);
    }
  };

  const fetchRiskAdvice = async (compId: number) => {
    setLoadingRisk(true);
    try {
      const { data } = await apiClient.get(`/complaints/admin/${compId}/seller-risk-advisor`);
      setRiskAdvice(data);
    } catch {
      setRiskAdvice(null);
    } finally {
      setLoadingRisk(false);
    }
  };

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<Complaint>(`/complaints/admin/${complaintId}`);
      setComplaint(data);
      setStatus(data.status);
      setAdminNote(data.admin_note ?? '');
      // Eşzamanlı risk analizini tetikle
      if (data.reported_seller_id || data.prod_id) {
        fetchRiskAdvice(complaintId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('cDetail.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [complaintId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/complaints/admin/${complaintId}`, {
        status,
        admin_note: adminNote.trim() || null,
      });
      Alert.alert(t('createPost.success'), t('cDetail.updated'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('cDetail.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.buttonPrimary} />
        <Text style={styles.loadingText}>{t('cDetail.loading')}</Text>
      </View>
    );
  }

  if (error || !complaint) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error ?? t('cDetail.notFound')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDetail}>
          <Text style={styles.retryText}>{t('cDetail.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typeInfo = typeMapping[complaint.complaint_type];
  const typeLabel = typeInfo ? t(typeInfo.labelKey) : t('adminComplaints.unknown');
  const typeIcon = (typeInfo?.icon ?? 'help-outline') as any;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Type and Date Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.typeTag}>
              <Ionicons name={typeIcon} size={16} color={colors.primaryDeep} style={{ marginRight: 5 }} />
              <Text style={styles.typeTagText}>{typeLabel}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(complaint.created_at)}</Text>
          </View>

          <Text style={styles.title}>{complaint.title}</Text>
          <Text style={styles.description}>{complaint.description}</Text>
        </View>

        {/* AI Executive Summary Card */}
        {complaint.ai_summary && (
          <View style={styles.aiSummaryCard}>
            <View style={styles.aiSummaryHeader}>
              <Ionicons name="sparkles" size={16} color="#7c4dff" style={{ marginRight: 6 }} />
              <Text style={styles.aiSummaryTitle}>{t('cDetail.aiSummary')}</Text>
            </View>
            <Text style={styles.aiSummaryText}>{complaint.ai_summary}</Text>
          </View>
        )}

        {/* User Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>{t('cDetail.complainantInfo')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={36} color={colors.muted} style={{ marginRight: spacing.sm }} />
            <View>
              <Text style={styles.infoValue}>{complaint.user_name || t('cDetail.noName')}</Text>
              <Text style={styles.infoLabel}>{complaint.user_email}</Text>
            </View>
          </View>
        </View>

        {/* Reference Context Card */}
        {(complaint.cust_ord_id || complaint.prod_id || complaint.reported_seller_id) && (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>{t('cDetail.relatedRecord')}</Text>
            
            {complaint.complaint_type === 'order' && complaint.cust_ord_id && (
              <View style={styles.refRow}>
                <Ionicons name="receipt-outline" size={24} color={colors.primaryDeep} style={{ marginRight: spacing.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.refTitle}>{t('cDetail.orderNo')}#{complaint.cust_ord_id}</Text>
                  <Text style={styles.refSubtitle}>
                    {t('cDetail.amount')}: {complaint.order_price ? `${complaint.order_price} TL` : '—'} | {t('cDetail.date')}: {complaint.order_date ? formatDate(complaint.order_date) : '—'}
                  </Text>
                </View>
              </View>
            )}

            {complaint.complaint_type === 'product' && complaint.prod_id && (
              <View style={styles.refRow}>
                <Ionicons name="leaf-outline" size={24} color={colors.primaryDeep} style={{ marginRight: spacing.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.refTitle}>{t('cDetail.productName')}{complaint.product_name || t('cDetail.notLoaded')}</Text>
                  <Text style={styles.refSubtitle}>{t('cDetail.productId')}#{complaint.prod_id}</Text>
                </View>
              </View>
            )}

            {complaint.complaint_type === 'seller' && complaint.reported_seller_id && (
              <View style={styles.refRow}>
                <Ionicons name="business-outline" size={24} color={colors.primaryDeep} style={{ marginRight: spacing.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.refTitle}>{t('cDetail.sellerStore')}{complaint.reported_seller_name || t('cDetail.notLoaded')}</Text>
                  <Text style={styles.refSubtitle}>{t('cDetail.sellerId')}#{complaint.reported_seller_id}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* AI Seller Risk Assessment Card */}
        {loadingRisk ? (
          <View style={styles.card}>
            <ActivityIndicator size="small" color={colors.primaryDeep} />
            <Text style={styles.loadingRiskText}>{t('cDetail.riskAnalyzing')}</Text>
          </View>
        ) : riskAdvice ? (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>{t('cDetail.riskAssessment')}</Text>
            <View style={styles.riskHeaderRow}>
              <Text style={styles.riskLabelText}>{t('cDetail.riskLevel')}</Text>
              <View style={[styles.riskBadge, { backgroundColor: riskAdvice.risk_level === 'high' ? '#fde8e8' : riskAdvice.risk_level === 'medium' ? '#fef3c7' : '#edfcf2' }]}>
                <Text style={[styles.riskBadgeText, { color: riskAdvice.risk_level === 'high' ? '#e02424' : riskAdvice.risk_level === 'medium' ? '#d97706' : '#0e7043' }]}>
                  {riskAdvice.risk_label}
                </Text>
              </View>
            </View>
            <Text style={styles.riskAnalysisText}>{riskAdvice.analysis}</Text>
            <View style={styles.recommendationBox}>
              <Ionicons name="shield-checkmark" size={16} color={colors.primaryDeep} style={{ marginRight: 6 }} />
              <Text style={styles.recommendationText}>
                <Text style={{ fontWeight: 'bold' }}>{t('cDetail.recommendation')}</Text>
                {riskAdvice.recommendation}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Resolution Action Card */}
        <View style={[styles.card, { marginBottom: spacing.xl }]}>
          <Text style={styles.cardSectionTitle}>{t('cDetail.resolutionMgmt')}</Text>

          <Text style={styles.inputLabel}>{t('cDetail.complaintStatus')}</Text>
          <View style={styles.statusOptionsRow}>
            {statusOptions.map((opt) => {
              const isActive = status === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.statusOptionBtn,
                    { backgroundColor: opt.bg },
                    isActive && { borderWidth: 2, borderColor: opt.activeBorder },
                  ]}
                  onPress={() => setStatus(opt.key)}
                >
                  <Text style={[styles.statusOptionText, { color: opt.text, fontWeight: isActive ? '700' : '500' }]}>
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.noteHeaderRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.noteLabel}>{t('cDetail.adminNote')}</Text>
            </View>
            <TouchableOpacity
              onPress={handleAiDraft}
              disabled={drafting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8a2be2', '#4b0082']}
                style={styles.aiDraftBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {drafting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={12} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={styles.aiDraftText}>{t('cDetail.aiDraftBtn')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            value={adminNote}
            onChangeText={setAdminNote}
            placeholder={t('cDetail.notePlaceholder')}
            placeholderTextColor={colors.muted2}
          />

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.buttonPrimaryText} style={{ marginRight: 6 }} />
                <Text style={styles.saveButtonText}>{t('cDetail.saveUpdate')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    fontSize: 11,
    color: colors.primaryDeep,
  },
  dateText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  cardSectionTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingBottom: spacing.xs,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
  infoValue: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.ink,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  refTitle: {
    fontFamily: fonts.sansSemi,
    fontSize: 13.5,
    color: colors.ink,
  },
  refSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  inputLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statusOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusOptionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  statusOptionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
  },
  textArea: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgAlt,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  saveButtonText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.buttonPrimaryText,
  },
  disabledButton: {
    backgroundColor: colors.muted2,
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
  noteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  noteLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.ink,
  },
  aiDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    ...shadow.sm,
  },
  aiDraftText: {
    fontFamily: fonts.sansBold,
    fontSize: 10.5,
    color: colors.white,
    letterSpacing: 0.5,
  },
  aiSummaryCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  aiSummaryTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: '#6b21a8',
  },
  aiSummaryText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: '#581c87',
    lineHeight: 18,
  },
  loadingRiskText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  riskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  riskLabelText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
    marginRight: spacing.xs,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  riskBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
  },
  riskAnalysisText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderSoft,
    padding: spacing.sm,
    borderRadius: radius.xs,
  },
  recommendationText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink,
  },
});
