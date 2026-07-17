import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing, gradients } from '../../theme/theme';

interface PeriodReport {
  period_days: number;
  report: string;
  stats: Record<string, number>;
}

interface ContentModerationResult {
  verdict: string;
  verdict_label: string;
  reason: string;
  risk_score: number;
}

const PERIOD_OPTIONS = [
  { label: '7 Gün', value: 7 },
  { label: '30 Gün', value: 30 },
  { label: '90 Gün', value: 90 },
];

const verdictConfig: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  ok:        { bg: '#e3f3ea', text: '#3d8f66', border: '#3d8f6640', icon: 'checkmark-circle' },
  warning:   { bg: '#fdf7e7', text: '#b3711a', border: '#b3711a40', icon: 'warning' },
  violation: { bg: '#fdecea', text: '#c0392b', border: '#c0392b40', icon: 'close-circle' },
};

export default function AIReportScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [modTitle, setModTitle] = useState('');
  const [modDesc, setModDesc] = useState('');
  const [modResult, setModResult] = useState<ContentModerationResult | null>(null);
  const [loadingMod, setLoadingMod] = useState(false);

  // Campaign States
  const [campaignResult, setCampaignResult] = useState<{
    campaign_disease: string;
    notification_title: string;
    notification_template: string;
    recommended_product: string;
    users_notified_count: number;
  } | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);

  const handleLoadReport = async () => {
    setLoadingReport(true);
    setReport(null);
    try {
      const { data } = await apiClient.get<PeriodReport>(`/admin/ai/period-report?period=${selectedPeriod}`);
      setReport(data);
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.detail ?? 'Rapor oluşturulamadı.');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleContentModeration = async () => {
    if (!modTitle.trim()) {
      Alert.alert('Hata', 'Lütfen ürün başlığını girin.');
      return;
    }
    setLoadingMod(true);
    setModResult(null);
    try {
      const { data } = await apiClient.post<ContentModerationResult>('/admin/ai/content-moderation', {
        title: modTitle,
        description: modDesc,
      });
      setModResult(data);
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.detail ?? 'İçerik denetimi yapılamadı.');
    } finally {
      setLoadingMod(false);
    }
  };

  const vConfig = modResult ? (verdictConfig[modResult.verdict] ?? verdictConfig.warning) : null;

  const handleTriggerCampaign = async () => {
    setLoadingCampaign(true);
    setCampaignResult(null);
    try {
      const { data } = await apiClient.post('/admin/ai/trigger-campaign');
      setCampaignResult(data);
      Alert.alert('Başarılı', `Akıllı kampanya tetiklendi! ${data.users_notified_count} kullanıcıya bildirim gönderildi.`);
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.detail ?? 'Kampanya tetiklenemedi.');
    } finally {
      setLoadingCampaign(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <Text style={styles.headerTitle}>AI Rapor & Denetim</Text>
        <Text style={styles.headerSub}>Dönem raporları ve içerik moderasyonu</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Period Report Section ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#0288d1', '#0263a0']} style={styles.sectionIconBox}>
              <Ionicons name="document-text" size={14} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Dönem Raporu</Text>
          </View>
          <Text style={styles.sectionSub}>Gemini, seçili dönem verilerini analiz eder ve yönetici özeti oluşturur.</Text>

          {/* Period Selector */}
          <View style={styles.periodRow}>
            {PERIOD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.periodBtn, selectedPeriod === opt.value && styles.periodBtnActive]}
                onPress={() => setSelectedPeriod(opt.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodBtnText, selectedPeriod === opt.value && styles.periodBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#0288d1' }, loadingReport && { opacity: 0.6 }]}
            onPress={handleLoadReport}
            disabled={loadingReport}
            activeOpacity={0.85}
          >
            {loadingReport ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={colors.white} />
                <Text style={styles.actionButtonText}>Rapor Oluştur</Text>
              </>
            )}
          </TouchableOpacity>

          {loadingReport && (
            <View style={styles.loadingHint}>
              <Text style={styles.loadingHintText}>Gemini {selectedPeriod} günlük verilerinizi analiz ediyor...</Text>
            </View>
          )}

          {report && (
            <View style={styles.reportCard}>
              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: '#0288d1' }]}>{report.stats.new_users ?? 0}</Text>
                  <Text style={styles.statLbl}>Yeni Üye</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: '#7c4dff' }]}>{report.stats.recent_analyses ?? 0}</Text>
                  <Text style={styles.statLbl}>AI Teşhis</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: '#3d8f66' }]}>{report.stats.total_products ?? 0}</Text>
                  <Text style={styles.statLbl}>Ürün</Text>
                </View>
              </View>
              <View style={styles.reportDivider} />
              <Text style={styles.reportText}>{report.report}</Text>
            </View>
          )}
        </View>

        {/* ── AI Campaign Wizard Section ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#7c4dff', '#5c35cc']} style={styles.sectionIconBox}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>AI Akıllı Kampanya Sihirbazı</Text>
          </View>
          <Text style={styles.sectionSub}>
            Gemini veritabanındaki son bitki teşhislerini tarar, en yaygın bitki hastalığını tespit eder ve bu probleme sahip tüm üyelere hedeflenmiş akıllı indirim bildirimleri tetikler.
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#7c4dff' }, loadingCampaign && { opacity: 0.6 }]}
            onPress={handleTriggerCampaign}
            disabled={loadingCampaign}
            activeOpacity={0.85}
          >
            {loadingCampaign ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="rocket-outline" size={16} color={colors.white} />
                <Text style={styles.actionButtonText}>Otomatik AI Kampanyası Başlat</Text>
              </>
            )}
          </TouchableOpacity>

          {loadingCampaign && (
            <View style={styles.loadingHint}>
              <Text style={styles.loadingHintText}>Gemini verileri analiz ediyor ve kişiye özel bildirimleri hazırlıyor...</Text>
            </View>
          )}

          {campaignResult && (
            <View style={[styles.reportCard, { backgroundColor: '#f5efff', borderColor: '#d8c8ff' }]}>
              <View style={styles.verdictHeader}>
                <Ionicons name="sparkles" size={20} color="#7c4dff" />
                <Text style={[styles.verdictLabel, { color: '#5c35cc' }]}>Aktif Kampanya Raporu</Text>
              </View>
              
              <View style={styles.campaignMetaRow}>
                <Text style={styles.campaignMetaLabel}>Tespit Edilen En Yaygın Hastalık:</Text>
                <Text style={styles.campaignMetaValue}>{campaignResult.campaign_disease}</Text>
              </View>

              <View style={styles.campaignMetaRow}>
                <Text style={styles.campaignMetaLabel}>Önerilen Kampanya Ürünü:</Text>
                <Text style={styles.campaignMetaValue}>{campaignResult.recommended_product}</Text>
              </View>

              <View style={styles.campaignMetaRow}>
                <Text style={styles.campaignMetaLabel}>Bildirim Alıcı Sayısı:</Text>
                <Text style={styles.campaignMetaValue}>{campaignResult.users_notified_count} Aktif Üye</Text>
              </View>

              <View style={styles.reportDivider} />

              <Text style={[styles.campaignTemplateTitle, { color: '#5c35cc' }]}>Gönderilen Bildirim Şablonu:</Text>
              
              <View style={styles.campaignTemplateBox}>
                <Text style={styles.campaignTemplateSubject}>Başlık: {campaignResult.notification_title}</Text>
                <Text style={styles.campaignTemplateBody}>{campaignResult.notification_template}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Content Moderation Section ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#e67e22', '#c0392b']} style={styles.sectionIconBox}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>AI İçerik Denetimi</Text>
          </View>
          <Text style={styles.sectionSub}>Bir ürün ilanını yapay zeka ile politika ihlallerine karşı denetle.</Text>

          <TextInput
            placeholder="Ürün Başlığı (zorunlu)"
            placeholderTextColor={colors.muted2}
            value={modTitle}
            onChangeText={setModTitle}
            style={styles.input}
          />
          <TextInput
            placeholder="Ürün Açıklaması (opsiyonel)..."
            placeholderTextColor={colors.muted2}
            value={modDesc}
            onChangeText={setModDesc}
            style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
            multiline
          />

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#e67e22' }, loadingMod && { opacity: 0.6 }]}
            onPress={handleContentModeration}
            disabled={loadingMod}
            activeOpacity={0.85}
          >
            {loadingMod ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="search" size={16} color={colors.white} />
                <Text style={styles.actionButtonText}>İçerik Denetle</Text>
              </>
            )}
          </TouchableOpacity>

          {modResult && vConfig && (
            <View style={[styles.verdictCard, { backgroundColor: vConfig.bg, borderColor: vConfig.border }]}>
              {/* Verdict Header */}
              <View style={styles.verdictHeader}>
                <Ionicons name={vConfig.icon} size={22} color={vConfig.text} />
                <Text style={[styles.verdictLabel, { color: vConfig.text }]}>{modResult.verdict_label}</Text>
                <View style={styles.riskBadge}>
                  <Text style={[styles.riskBadgeText, { color: vConfig.text }]}>Risk: {modResult.risk_score}/100</Text>
                </View>
              </View>
              {/* Risk Bar */}
              <View style={styles.riskBarBg}>
                <View style={[styles.riskBarFill, {
                  width: `${modResult.risk_score}%` as any,
                  backgroundColor: vConfig.text,
                }]} />
              </View>
              <Text style={[styles.verdictReason, { color: vConfig.text + 'cc' }]}>{modResult.reason}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
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
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  headerSub: { fontFamily: fonts.sans, fontSize: 11.5, color: '#c9c9d6', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },

  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIconBox: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  sectionSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: -spacing.xs },

  // Period selector
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  periodBtnActive: { backgroundColor: '#0288d1', borderColor: '#0288d1' },
  periodBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.muted },
  periodBtnTextActive: { color: colors.white },

  // Action button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderRadius: radius.sm,
  },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white },

  loadingHint: { alignItems: 'center', paddingVertical: spacing.sm },
  loadingHintText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, textAlign: 'center' },

  // Report card
  reportCard: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontFamily: fonts.display, fontSize: 22 },
  statLbl: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  reportDivider: { height: 1, backgroundColor: colors.border },
  reportText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 22 },

  // Content moderation inputs
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.bg,
  },

  // Verdict card
  verdictCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  verdictHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verdictLabel: { fontFamily: fonts.sansBold, fontSize: 15, flex: 1 },
  riskBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  riskBadgeText: { fontFamily: fonts.sansBold, fontSize: 11 },
  riskBarBg: {
    height: 6, backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3, overflow: 'hidden',
  },
  riskBarFill: { height: 6, borderRadius: 3 },
  verdictReason: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },

  // Campaign Styles
  campaignMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  campaignMetaLabel: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.muted,
  },
  campaignMetaValue: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.ink,
  },
  campaignTemplateTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12.5,
    marginTop: 2,
  },
  campaignTemplateBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e8e5f0',
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  campaignTemplateSubject: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.ink,
  },
  campaignTemplateBody: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 18,
  },
});

