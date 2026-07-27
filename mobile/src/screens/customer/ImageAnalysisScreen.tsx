import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { trackInteraction } from '../../services/interactionService';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface AnalysisHistoryItem {
  analysis_id: number;
  image_url: string;
  result: string | null;
  confidence: number | null;
  created_at: string;
  recommended_products?: any[];
}

export default function ImageAnalysisScreen({ navigation }: any) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get('/ai/analyses');
      setHistory(response.data);
    } catch (err: any) {
      console.error('Geçmiş yüklenirken hata oluştu:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kamera ile fotoğraf çekebilmek için kamera izni vermeniz gerekmektedir.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriden fotoğraf seçebilmek için fotoğraf galerisi izni vermeniz gerekmektedir.');
        return false;
      }
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    const hasPermission = await requestPermission(useCamera ? 'camera' : 'library');
    if (!hasPermission) return;

    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Resim seçilirken hata oluştu:', err);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir sorun oluştu.');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setLoadingMessage('Fotoğraf yükleniyor...');

    try {
      const formData = new FormData();
      
      const uriParts = selectedImage.split('/');
      const fileName = uriParts[uriParts.length - 1] || 'plant_photo.jpg';
      const fileType = fileName.split('.').pop() === 'png' ? 'image/png' : 'image/jpeg';

      formData.append('file', {
        uri: selectedImage,
        name: fileName,
        type: fileType,
      } as any);

      setLoadingMessage('Yapay zeka bitkiyi analiz ediyor...');
      
      const response = await apiClient.post('/ai/analyze-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data;
      trackInteraction('AI_ANALYSIS');
      setSelectedImage(null);
      
      fetchHistory();

      navigation.navigate('AnalysisResult', {
        analysisId: data.analysis_id,
        imageUrl: data.image_url,
        result: data.result,
        confidence: data.confidence,
        createdAt: data.created_at,
        recommendedProducts: data.recommended_products,
      });

    } catch (err: any) {
      console.error('Analiz hatası:', err);
      const detail = err?.response?.data?.detail ?? 'Sunucu bağlantısı kurulamadı. Lütfen internetinizi ve backend adresini kontrol edin.';
      Alert.alert('Analiz Başarısız', detail);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

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
      return null;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getDate()} ${d.toLocaleString('tr-TR', { month: 'short' })} ${d.getFullYear()} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return { bg: badgeColors.green.bg, text: 'Sağlıklı', color: badgeColors.green.text };
      case 'diseased':
        return { bg: badgeColors.red.bg, text: 'Hasta', color: badgeColors.red.text };
      case 'pest_damage':
        return { bg: badgeColors.amber.bg, text: 'Zararlı Hasarı', color: badgeColors.amber.text };
      default:
        return { bg: colors.bgAlt, text: 'Bilinmiyor', color: colors.muted };
    }
  };

  const renderHistoryItem = ({ item }: { item: AnalysisHistoryItem }) => {
    const analysis = parseAnalysisResult(item.result);
    const speciesName = analysis?.species || 'Bitki Türü Tespit Edilemedi';
    const healthStatus = analysis?.health_status || 'unknown';
    const statusBadge = getStatusBadge(healthStatus);

    return (
      <TouchableOpacity
        style={styles.historyCard}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('AnalysisResult', {
            analysisId: item.analysis_id,
            imageUrl: item.image_url,
            result: item.result,
            confidence: item.confidence,
            createdAt: item.created_at,
            recommendedProducts: item.recommended_products,
          })
        }
      >
        <Image source={{ uri: item.image_url }} style={styles.historyThumb} />
        <View style={styles.historyInfo}>
          <Text style={styles.historyTitle} numberOfLines={1}>
            {speciesName}
          </Text>
          <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
          <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[styles.badgeText, { color: statusBadge.color }]}>{statusBadge.text}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted2} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bitki Sağlığı Analizi</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.analysis_id.toString()}
        renderItem={renderHistoryItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.topSection}>
            <Text style={styles.sectionSubtitle}>
              Bitkinizin fotoğrafını çekin veya yükleyin; yapay zeka ile türünü, hastalıklarını teşhis edip bakım önerileri sunalım.
            </Text>

            {selectedImage ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={() => setSelectedImage(null)}>
                  <Ionicons name="close" size={20} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.analyzeButton} onPress={handleAnalyze} disabled={loading}>
                  <Text style={styles.analyzeButtonText}>Analizi Başlat 🚀</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(true)}>
                  <LinearGradientHelper colors={['#3e895c', '#2c694a']}>
                    <Ionicons name="camera" size={32} color={colors.white} />
                    <Text style={styles.actionCardTitle}>Kamera Kullan</Text>
                    <Text style={styles.actionCardSub}>Fotoğraf çek</Text>
                  </LinearGradientHelper>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(false)}>
                  <LinearGradientHelper colors={['#4c4c6a', '#393952']}>
                    <Ionicons name="images" size={32} color={colors.white} />
                    <Text style={styles.actionCardTitle}>Galeri Aç</Text>
                    <Text style={styles.actionCardSub}>Fotoğraf yükle</Text>
                  </LinearGradientHelper>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.historyHeader}>
              <Text style={styles.historyTitleText}>Geçmiş Analizlerim</Text>
              <TouchableOpacity onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🍃</Text>
              <Text style={styles.emptyText}>Henüz hiç analiz yapmadınız.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primaryDeep} />
            <Text style={styles.loadingText}>{loadingMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
function LinearGradientHelper({ children, colors }: { children: React.ReactNode; colors: readonly [string, string, ...string[]] }) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </LinearGradient>
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
  topSection: { padding: spacing.lg },
  sectionSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: spacing.md, height: 140, marginBottom: spacing.xl },
  actionCard: { flex: 1, borderRadius: radius.md, overflow: 'hidden', ...shadow.sm },
  actionCardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white, marginTop: spacing.sm },
  actionCardSub: { fontFamily: fonts.sans, fontSize: 11, color: '#eef0f1', marginTop: 2 },
  previewContainer: { borderRadius: radius.md, overflow: 'hidden', height: 260, position: 'relative', marginBottom: spacing.xl, ...shadow.md },
  previewImage: { width: '100%', height: '100%' },
  removeImageButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButton: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  analyzeButtonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyTitleText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  historyThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.bgAlt },
  historyInfo: { flex: 1, marginLeft: spacing.md, gap: 4 },
  historyTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  historyDate: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, marginTop: spacing.md },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  loadingCard: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: spacing.md,
    ...shadow.md,
    width: '80%',
  },
  loadingText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink, textAlign: 'center' },
});
