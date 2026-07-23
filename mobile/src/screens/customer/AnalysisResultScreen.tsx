import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

export default function AnalysisResultScreen({ route, navigation }: any) {
  const { analysisId, imageUrl, result, confidence, createdAt, recommendedProducts } = route.params || {};
  const [feedbackSent, setFeedbackSent] = useState<boolean | null>(null);

  const parseAnalysisResult = (resultStr: string | null) => {
    if (!resultStr) return null;
    try {
      let clean = resultStr;
      if (clean.startsWith("{'") || clean.includes("':")) {
        // Python tek tırnaklı dict str modelini geçerli JSON yapalım
        clean = clean.replace(/'/g, '"');
      }
      return JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse hatası:', e);
      return null;
    }
  };

  const analysis = parseAnalysisResult(result);
  const species = analysis?.species || 'Tespit Edilemeyen Tür';
  const healthStatus = analysis?.health_status || 'unknown';
  const careRecommendation = analysis?.care_recommendation || 'Bakım önerisi bulunmuyor.';
  const issuesDetected = analysis?.issues_detected || [];

  const confidencePct = confidence ? Math.round(Number(confidence) * 100) : 0;

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          bg: badgeColors.green.bg,
          text: 'Sağlıklı',
          color: badgeColors.green.text,
          icon: 'checkmark-circle',
          desc: 'Bitkiniz oldukça sağlıklı görünüyor. Mevcut bakım düzenine devam edebilirsiniz.',
        };
      case 'diseased':
        return {
          bg: badgeColors.red.bg,
          text: 'Hasta / Hastalıklı',
          color: badgeColors.red.text,
          icon: 'alert-circle',
          desc: 'Bitkide hastalık belirtileri gözlemlendi. Aşağıdaki önerileri dikkatle uygulayın.',
        };
      case 'pest_damage':
        return {
          bg: badgeColors.amber.bg,
          text: 'Zararlı Tehdidi',
          color: badgeColors.amber.text,
          icon: 'bug',
          desc: 'Bitkide böcek veya zararlı hasarı tespit edildi. Bitkiyi diğerlerinden ayırmanız önerilir.',
        };
      default:
        return {
          bg: colors.bgAlt,
          text: 'Belirlenemedi',
          color: colors.muted,
          icon: 'help-circle',
          desc: 'Görüntü kalitesi veya bitki yapısından ötürü net bir analiz yapılamadı.',
        };
    }
  };

  const statusInfo = getStatusDetails(healthStatus);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analiz Sonucu</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {imageUrl ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.image} />
          </View>
        ) : null}

        <View style={styles.contentCard}>
          <Text style={styles.speciesName}>{species}</Text>
          
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon as any} size={18} color={statusInfo.color} style={{ marginRight: 6 }} />
            <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>

          <Text style={styles.statusDescription}>{statusInfo.desc}</Text>

          {confidencePct > 0 && (
            <View style={styles.confidenceSection}>
              <View style={styles.confidenceHeader}>
                <Text style={styles.confidenceLabel}>Yapay Zeka Doğruluk Payı</Text>
                <Text style={styles.confidenceValue}>%{confidencePct}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${confidencePct}%`, backgroundColor: statusInfo.color }]} />
              </View>
            </View>
          )}
        </View>

        {issuesDetected.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>⚠️ Tespit Edilen Sorunlar</Text>
            <View style={styles.issuesList}>
              {issuesDetected.map((issue: string, idx: number) => (
                <View key={idx} style={styles.issueRow}>
                  <Ionicons name="warning-outline" size={16} color={colors.red} style={{ marginTop: 2 }} />
                  <Text style={styles.issueText}>{issue}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.sectionCard, styles.recommendationCard]}>
          <Text style={styles.sectionTitle}>🌿 Bakım & Çözüm Önerisi</Text>
          <Text style={styles.recommendationText}>{careRecommendation}</Text>
        </View>

        {recommendedProducts && recommendedProducts.length > 0 && (
          <View style={styles.productsSection}>
            <Text style={styles.productsSectionTitle}>🌿 Bitkiniz İçin Önerilen Ürünler</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsList}>
              {recommendedProducts.map((product: string, idx: number) => {
                let emoji = '🌿';
                const lowerName = product.toLowerCase();
                if (lowerName.includes('ilaç') || lowerName.includes('sprey') || lowerName.includes('pest') || lowerName.includes('bit')) {
                  emoji = '🧪';
                } else if (lowerName.includes('gübre') || lowerName.includes('besin') || lowerName.includes('fertilizer')) {
                  emoji = '🧪';
                } else if (lowerName.includes('toprak') || lowerName.includes('soil') || lowerName.includes('torf')) {
                  emoji = '🪨';
                } else if (lowerName.includes('saksı') || lowerName.includes('pot')) {
                  emoji = '🪴';
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.productCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      Alert.alert(
                        'Ürünü Ara',
                        `"${product}" ürününü internette aratmak ister misiniz?`,
                        [
                          { text: 'Vazgeç', style: 'cancel' },
                          {
                            text: 'Google\'da Ara',
                            onPress: () => {
                              const url = `https://www.google.com/search?q=${encodeURIComponent(product)}`;
                              Linking.openURL(url).catch((err) =>
                                console.error('Link açma hatası:', err)
                              );
                            },
                          },
                        ]
                      )
                    }
                  >
                    <View style={styles.productIconContainer}>
                      <Text style={styles.productEmoji}>{emoji}</Text>
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product}
                    </Text>
                    <Text style={styles.searchLink}>İnternette Ara 🔍</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackTitle}>Bu analiz yardımcı oldu mu?</Text>
          {feedbackSent === null ? (
            <View style={styles.feedbackButtons}>
              <TouchableOpacity
                style={[styles.feedbackButton, styles.feedbackYes]}
                onPress={() => setFeedbackSent(true)}
              >
                <Ionicons name="thumbs-up" size={18} color={badgeColors.green.text} style={{ marginRight: 6 }} />
                <Text style={[styles.feedbackBtnText, { color: badgeColors.green.text }]}>Evet</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.feedbackButton, styles.feedbackNo]}
                onPress={() => setFeedbackSent(false)}
              >
                <Ionicons name="thumbs-down" size={18} color={colors.red} style={{ marginRight: 6 }} />
                <Text style={[styles.feedbackBtnText, { color: colors.red }]}>Hayır</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.feedbackSuccessText}>
              {feedbackSent ? 'Geri bildiriminiz için teşekkürler! 👍' : 'Geri bildiriminiz kaydedildi. Asistanımızı geliştirmeye devam edeceğiz.'}
            </Text>
          )}
        </View>
        
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <TouchableOpacity
            style={styles.addToGardenBtn}
            onPress={() => {
              navigation.navigate('AddPlant', {
                prefilledData: {
                  species: species,
                  healthStatus: healthStatus,
                  imageUrl: imageUrl,
                }
              });
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="leaf-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.addToGardenBtnText}>Bu Bitkiyi Bahçeme Ekle</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink },
  scrollContent: { paddingBottom: spacing.xxl },
  imageContainer: { height: 280, width: '100%', overflow: 'hidden' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  contentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    margin: spacing.lg,
    padding: spacing.lg,
    marginTop: -spacing.xl,
    ...shadow.md,
  },
  speciesName: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: spacing.sm },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  statusBadgeText: { fontFamily: fonts.sansBold, fontSize: 12.5 },
  statusDescription: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginBottom: spacing.lg },
  confidenceSection: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.md },
  confidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  confidenceLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  confidenceValue: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  progressBarBg: { height: 6, backgroundColor: colors.bgAlt, borderRadius: radius.full, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: radius.full },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  recommendationCard: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(237,169,114,0.3)',
  },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, marginBottom: spacing.md },
  issuesList: { gap: spacing.sm },
  issueRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  issueText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink, flex: 1, lineHeight: 18 },
  recommendationText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 22 },
  feedbackContainer: {
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  feedbackTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink, marginBottom: spacing.md },
  feedbackButtons: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  feedbackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  feedbackYes: {
    backgroundColor: badgeColors.green.bg,
    borderColor: 'rgba(95,184,138,0.3)',
  },
  feedbackNo: {
    backgroundColor: badgeColors.red.bg,
    borderColor: 'rgba(224,85,107,0.3)',
  },
  feedbackBtnText: { fontFamily: fonts.sansBold, fontSize: 13 },
  feedbackSuccessText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, textAlign: 'center' },
  productsSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  productsSectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  productsList: {
    gap: spacing.md,
  },
  productCard: {
    width: 140,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  productIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  productEmoji: {
    fontSize: 22,
  },
  productName: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.ink,
    textAlign: 'center',
    height: 32,
    marginBottom: 6,
  },
  searchLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.primaryDeep,
    textDecorationLine: 'underline',
  },
  addToGardenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    ...shadow.md,
  },
  addToGardenBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.white,
  },
});
