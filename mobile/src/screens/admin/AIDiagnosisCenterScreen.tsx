import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing, gradients } from '../../theme/theme';

interface DiseaseStatItem {
  disease: string;
  count: number;
  percentage: number;
}

interface DiagnosisCenterData {
  disease_stats: DiseaseStatItem[];
  ai_commentary: string;
  total_analyses: number;
}

const DISEASE_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#8bc34a',
];

const healthStatusKeys: Record<string, string> = {
  healthy: 'aiDiagnosis.healthy',
  diseased: 'aiDiagnosis.diseased',
  pest_damage: 'aiDiagnosis.pest',
  unknown: 'aiDiagnosis.unknown',
};

export default function AIDiagnosisCenterScreen() {
  const { t } = useI18n();
  const [data, setData] = useState<DiagnosisCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: res } = await apiClient.get<DiagnosisCenterData>('/admin/ai/diagnosis-center');
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('aiDiagnosis.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getBarWidth = (percentage: number) =>
    `${Math.max(percentage, 3)}%` as any;

  const renderDisease = ({ item, index }: { item: DiseaseStatItem; index: number }) => {
    const color = DISEASE_COLORS[index % DISEASE_COLORS.length];
    const label = healthStatusKeys[item.disease] ? t(healthStatusKeys[item.disease]) : item.disease;
    return (
      <View style={styles.diseaseRow}>
        <View style={styles.diseaseLeft}>
          <View style={[styles.diseaseColorDot, { backgroundColor: color }]} />
          <Text style={styles.diseaseName} numberOfLines={1}>{label}</Text>
        </View>
        <View style={styles.diseaseBarContainer}>
          <View style={[styles.diseaseBar, { width: getBarWidth(item.percentage), backgroundColor: color + 'CC' }]} />
        </View>
        <View style={styles.diseaseRight}>
          <Text style={[styles.diseaseCount, { color }]}>{item.count}</Text>
          <Text style={styles.diseasePercent}>{item.percentage}%</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('aiDiagnosis.title')}</Text>
            <Text style={styles.headerSub}>{t('aiDiagnosis.sub')}</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => { setRefreshing(true); load(); }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c4dff" />
          <Text style={styles.loadingText}>{t('aiDiagnosis.analyzing')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Total Stats Card */}
          <View style={styles.totalCard}>
            <LinearGradient colors={['#7c4dff', '#5c35cc']} style={styles.totalGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="leaf" size={28} color="rgba(255,255,255,0.8)" />
              <Text style={styles.totalNumber}>{data.total_analyses}</Text>
              <Text style={styles.totalLabel}>{t('aiDiagnosis.totalAnalyses')}</Text>
            </LinearGradient>
          </View>

          {/* Disease Distribution */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bar-chart" size={18} color={colors.ink} />
              <Text style={styles.sectionTitle}>{t('aiDiagnosis.distribution')}</Text>
            </View>
            <View style={styles.diseaseList}>
              {data.disease_stats.map((item, index) => (
                <View key={item.disease}>
                  {renderDisease({ item, index })}
                </View>
              ))}
            </View>
          </View>

          {/* AI Commentary */}
          <View style={styles.aiCommentaryCard}>
            <View style={styles.aiCommentaryHeader}>
              <LinearGradient colors={['#7c4dff', '#5c35cc']} style={styles.aiIconBox}>
                <Ionicons name="sparkles" size={14} color="#fff" />
              </LinearGradient>
              <Text style={styles.aiCommentaryTitle}>{t('aiDiagnosis.reportTitle')}</Text>
            </View>
            <Text style={styles.aiCommentaryText}>{data.ai_commentary}</Text>
          </View>
        </ScrollView>
      ) : null}
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
  headerSub: { fontFamily: fonts.sans, fontSize: 11.5, color: '#c9c9d6', marginTop: 2 },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  loadingText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  retryButton: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingVertical: 10, paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  // Total card
  totalCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.md,
  },
  totalGradient: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  totalNumber: { fontFamily: fonts.display, fontSize: 48, color: colors.white, lineHeight: 56 },
  totalLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  // Section card
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  diseaseList: { gap: spacing.md },
  diseaseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  diseaseLeft: { width: 120, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  diseaseColorDot: { width: 8, height: 8, borderRadius: 4 },
  diseaseName: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.ink, flex: 1 },
  diseaseBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.borderSoft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  diseaseBar: { height: 8, borderRadius: 4 },
  diseaseRight: { width: 52, alignItems: 'flex-end' },
  diseaseCount: { fontFamily: fonts.sansBold, fontSize: 12 },
  diseasePercent: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted },

  // AI Commentary
  aiCommentaryCard: {
    backgroundColor: '#f5efff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#d8c8ff',
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  aiCommentaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCommentaryTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: '#5c35cc' },
  aiCommentaryText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.ink,
    lineHeight: 22,
  },
});
