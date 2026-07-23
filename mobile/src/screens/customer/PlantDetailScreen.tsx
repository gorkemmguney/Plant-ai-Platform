import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { isPetToxic } from '../../utils/petToxic';
import { colors, fonts, radius, shadow, spacing, badgeColors } from '../../theme/theme';

interface CareLog {
  care_log_id: number;
  cust_prod_id: number;
  care_type: string;
  notes: string | null;
  created_at: string;
}

interface GrowthLog {
  growth_log_id: number;
  cust_prod_id: number;
  image_url: string | null;
  note: string;
  created_at: string;
}

interface CustProd {
  cust_prod_id: number;
  cust_id: number;
  prod_spec_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  health_status: string;
  location: string | null;
  watering_interval_days: number;
  last_watered_at: string;
  fertilizing_interval_days: number | null;
  last_fertilized_at: string | null;
  repotting_interval_days: number | null;
  last_repotted_at: string | null;
  created_at: string;
  updated_at: string;
  species_name: string;
  care_logs: CareLog[];
  growth_logs: GrowthLog[];
}

const HEALTH_STATUS_OPTIONS = [
  { key: 'healthy', label: 'Sağlıklı 🌿', color: colors.primaryDeep },
  { key: 'diseased', label: 'Hasta 🩺', color: colors.red },
  { key: 'pest_damage', label: 'Zararlı Var 🐛', color: colors.amber },
];

const FORM_LOCATIONS = ['Salon', 'Mutfak', 'Yatak Odası', 'Balkon', 'Ofis', 'Bahçe'];

const MOCK_TREATMENTS = [
  { id: 1, name: 'Organik Sıvı Bitki Gübresi (Hızlı Büyüme)', price: '129.90 TL', seller: 'Yeşil Bahçe', emoji: '🧪' },
  { id: 2, name: 'Mantar ve Küf Önleyici Doğal Bakır Spreyi', price: '145.00 TL', seller: 'Çiçek Evi', emoji: '🧴' },
  { id: 3, name: 'Doğal Neem Yağı (Yaprak Koruyucu Sprey)', price: '98.50 TL', seller: 'Bahçe Market', emoji: '🌿' },
];

export default function PlantDetailScreen({ route, navigation }: any) {
  const { custProdId } = route.params;

  const [plant, setPlant] = useState<CustProd | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'care' | 'growth'>('details');

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState<string | null>(null);
  const [editWatering, setEditWatering] = useState('7');
  const [editFertilizing, setEditFertilizing] = useState('30');
  const [editRepotting, setEditRepotting] = useState('365');
  const [editDescription, setEditDescription] = useState('');
  const [editHealth, setEditHealth] = useState('healthy');
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Growth Log Form states
  const [newGrowthNote, setNewGrowthNote] = useState('');
  const [newGrowthUri, setNewGrowthUri] = useState<string | null>(null);
  const [newGrowthUrl, setNewGrowthUrl] = useState<string | null>(null);
  const [uploadingGrowth, setUploadingGrowth] = useState(false);
  const [savingGrowth, setSavingGrowth] = useState(false);
  const [showGrowthForm, setShowGrowthForm] = useState(false);

  // Care Log Form states
  const [customCareType, setCustomCareType] = useState('water');
  const [customCareNotes, setCustomCareNotes] = useState('');
  const [loggingCare, setLoggingCare] = useState(false);
  const [showCareForm, setShowCareForm] = useState(false);

  const [watering, setWatering] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const loadDetail = async () => {
    try {
      const { data } = await apiClient.get<CustProd>(`/customer-products/${custProdId}`);
      setPlant(data);
      
      // Initialize edit fields
      setEditName(data.name);
      setEditLocation(data.location);
      setEditWatering(String(data.watering_interval_days));
      setEditFertilizing(String(data.fertilizing_interval_days ?? 30));
      setEditRepotting(String(data.repotting_interval_days ?? 365));
      setEditDescription(data.description ?? '');
      setEditHealth(data.health_status);
      setEditImageUrl(data.image_url);
    } catch (err: any) {
      Alert.alert('Hata', 'Bitki detayları yüklenemedi.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [custProdId]);

  const handleWaterPlant = async () => {
    if (!plant) return;
    setWatering(true);
    try {
      const { data } = await apiClient.post<CustProd>(`/customer-products/${plant.cust_prod_id}/water`);
      setPlant(data);
      Alert.alert('Harika!', `${data.name} sulandı! 💧`);
    } catch (err) {
      Alert.alert('Hata', 'Sulama işlemi kaydedilemedi.');
    } finally {
      setWatering(false);
    }
  };

  const handleLogCare = async (type: string, notes: string) => {
    setLoggingCare(true);
    try {
      const { data } = await apiClient.post<CustProd>(`/customer-products/${custProdId}/care`, {
        care_type: type,
        notes: notes.trim() || undefined,
      });
      setPlant(data);
      setCustomCareNotes('');
      setShowCareForm(false);
      Alert.alert('Başarılı', 'Bakım eylemi günlüğe eklendi! 🍃');
    } catch (err) {
      Alert.alert('Hata', 'Bakım eylemi kaydedilemedi.');
    } finally {
      setLoggingCare(false);
    }
  };

  const handlePickGrowthImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçebilmek için galeri izni vermelisiniz.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await uploadGrowthImage(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  };

  const handleTakeGrowthImage = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekebilmek için kamera izni vermelisiniz.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await uploadGrowthImage(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Hata', 'Kamera açılamadı.');
    }
  };

  const uploadGrowthImage = async (uri: string) => {
    setUploadingGrowth(true);
    setNewGrowthUri(uri);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'growth.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type,
      } as any);

      const { data } = await apiClient.post('/ai/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNewGrowthUrl(data.image_url);
    } catch (err) {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setUploadingGrowth(false);
    }
  };

  const handleSaveGrowthLog = async () => {
    if (!newGrowthNote.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen gelişim notunuzu yazın.');
      return;
    }
    setSavingGrowth(true);
    try {
      const { data } = await apiClient.post<CustProd>(`/customer-products/${custProdId}/growth`, {
        image_url: newGrowthUrl,
        note: newGrowthNote.trim(),
      });
      setPlant(data);
      setNewGrowthNote('');
      setNewGrowthUri(null);
      setNewGrowthUrl(null);
      setShowGrowthForm(false);
      Alert.alert('Başarılı', 'Gelişim günlüğünüze yeni bir sayfa eklendi! 📝');
    } catch (err) {
      Alert.alert('Hata', 'Günlük kaydedilemedi.');
    } finally {
      setSavingGrowth(false);
    }
  };

  const handleAiCheckup = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'AI analizi için kamera izni vermelisiniz.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      setAnalyzing(true);
      const uri = result.assets[0].uri;
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'checkup.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type,
      } as any);

      // 1. Analyze via AI
      const { data: analysis } = await apiClient.post('/ai/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      let diagnosisObj: any = {};
      try {
        diagnosisObj = JSON.parse(analysis.result);
      } catch (e) {
        console.log('Error parsing checkup analysis json:', e);
      }

      const isDiseased = diagnosisObj.healthStatus && diagnosisObj.healthStatus.toLowerCase().includes('diseased');
      const nextHealth = isDiseased ? 'diseased' : 'healthy';

      // 2. Automatically update health state on backend
      const { data: updated } = await apiClient.patch<CustProd>(`/customer-products/${custProdId}`, {
        name: plant?.name ?? '',
        location: plant?.location,
        watering_interval_days: plant?.watering_interval_days ?? 7,
        fertilizing_interval_days: plant?.fertilizing_interval_days ?? 30,
        repotting_interval_days: plant?.repotting_interval_days ?? 365,
        health_status: nextHealth,
        description: plant?.description,
        image_url: plant?.image_url,
      });

      setPlant(updated);

      Alert.alert(
        'AI Teşhis Sonucu',
        `Durum: ${nextHealth === 'healthy' ? 'Sağlıklı 🌿' : 'Hasta / Bakıma Muhtaç 🩺'}\n\nDetay: ${diagnosisObj.diagnosis ?? 'Belirlenemedi'}\n\nÖneri: ${diagnosisObj.recommendation ?? 'Bakıma devam edin.'}`
      );
    } catch (err) {
      Alert.alert('Hata', 'AI analiz işlemi başarısız oldu.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdate = async () => {
    if (!editName.trim()) {
      Alert.alert('Eksik Bilgi', 'Bitki adı boş olamaz.');
      return;
    }
    const waterDays = parseInt(editWatering, 10);
    const fertDays = parseInt(editFertilizing, 10);
    const repotDays = parseInt(editRepotting, 10);

    if (isNaN(waterDays) || waterDays <= 0) {
      Alert.alert('Hata', 'Geçerli bir sulama aralığı girin.');
      return;
    }

    try {
      const { data } = await apiClient.patch<CustProd>(`/customer-products/${custProdId}`, {
        name: editName.trim(),
        location: editLocation,
        watering_interval_days: waterDays,
        fertilizing_interval_days: isNaN(fertDays) ? null : fertDays,
        repotting_interval_days: isNaN(repotDays) ? null : repotDays,
        health_status: editHealth,
        description: editDescription.trim() || null,
        image_url: editImageUrl,
      });
      setPlant(data);
      setIsEditing(false);
      Alert.alert('Başarılı', 'Bitki detayları güncellendi!');
    } catch (err) {
      Alert.alert('Hata', 'Güncelleme işlemi başarısız oldu.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Bitkiyi Sil',
      'Bu bitkiyi bahçenizden tamamen silmek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/customer-products/${custProdId}`);
              Alert.alert('Silindi', 'Bitkiniz bahçenizden kaldırıldı.');
              navigation.navigate('MyGarden');
            } catch (err) {
              Alert.alert('Hata', 'Silme işlemi başarısız.');
            }
          },
        },
      ]
    );
  };

  const handleShareToCommunity = () => {
    if (!plant) return;
    navigation.navigate('CreatePost', {
      prefilledTitle: `Benim Bahçemden: ${plant.name} 🌿`,
      prefilledContent: `Merhaba doğaseverler! Bahçemde özenle büyüttüğüm ${plant.species_name} türündeki bitkim "${plant.name}". ${plant.description ? '\n\nNotlarım: ' + plant.description : ''}`,
      prefilledImageUrl: plant.image_url,
      prefilledTag: 'general',
    });
  };

  const handleShareGrowthToCommunity = (log: GrowthLog) => {
    if (!plant) return;
    navigation.navigate('CreatePost', {
      prefilledTitle: `${plant.name} - Gelişim Günlüğü Güncellemesi 📸`,
      prefilledContent: `Bitkim "${plant.name}" için son gelişim günlüğüm:\n\n"${log.note}"`,
      prefilledImageUrl: log.image_url || plant.image_url,
      prefilledTag: 'general',
    });
  };

  const getDaysLeft = (lastActionStr: string | null, intervalDays: number | null) => {
    if (!lastActionStr || !intervalDays) return null;
    const lastAction = new Date(lastActionStr);
    const nextActionTime = lastAction.getTime() + intervalDays * 24 * 60 * 60 * 1000;
    const diffTime = nextActionTime - Date.now();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getSeasonalTip = () => {
    const month = new Date().getMonth(); // 0-11
    if (month >= 2 && month <= 4) {
      return 'İlkbahar Dönemi: Bitkinizin aktif büyüme dönemi başladı! Gübreleme sıklığını artırabilir ve toprağını havalandırabilirsiniz.';
    } else if (month >= 5 && month <= 7) {
      return 'Yaz Dönemi: Sıcaklar nedeniyle toprağı daha hızlı kuruyabilir. Sulamayı kontrol etmeyi ihmal etmeyin ve direkt yakıcı güneşten koruyun.';
    } else if (month >= 8 && month <= 10) {
      return 'Sonbahar Dönemi: Havaların serinlemesiyle bitkinin gelişim hızı düşer. Saksı değişimi için son şansınızdır, sulamayı yavaş yavaş azaltın.';
    } else {
      return 'Kış Dönemi: Bitkiniz dinlenme (uyku) evresinde. Sulamayı en aza indirin, gübre vermeyin ve soğuk cereyanlardan uzak sıcak bir köşede tutun.';
    }
  };

  if (loading || !plant) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const health = HEALTH_STATUS_OPTIONS.find((o) => o.key === plant.health_status) || { label: 'Bilinmiyor', color: colors.muted };
  const waterLeft = getDaysLeft(plant.last_watered_at, plant.watering_interval_days);
  const fertLeft = getDaysLeft(plant.last_fertilized_at, plant.fertilizing_interval_days);
  const repotLeft = getDaysLeft(plant.last_repotted_at, plant.repotting_interval_days);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Profili Düzenle' : plant.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleShareToCommunity}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={22} color={colors.primaryDeep} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              if (isEditing) {
                handleUpdate();
              } else {
                setIsEditing(true);
              }
            }}
            activeOpacity={0.8}
          >
            {isEditing ? (
              <Ionicons name="checkmark" size={24} color={colors.primaryDeep} />
            ) : (
              <Ionicons name="create-outline" size={24} color={colors.ink} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Plant Photo Display with Overlay Info */}
        <View style={styles.photoContainer}>
          {isEditing ? (
            <View style={styles.editPhotoContainer}>
              {editImageUrl ? (
                <Image source={{ uri: editImageUrl }} style={styles.detailImage} />
              ) : (
                <View style={styles.placeholderPhoto}>
                  <Ionicons name="leaf-outline" size={48} color={colors.muted} />
                </View>
              )}
              {uploadingImage && (
                <View style={styles.photoLoadingOverlay}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              )}
              <View style={styles.editPhotoOverlay}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={handleAiCheckup}>
                  <Ionicons name="camera" size={20} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickGrowthImage}>
                  <Ionicons name="images" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
              {plant.image_url ? (
                <Image source={{ uri: plant.image_url }} style={styles.detailImage} />
              ) : (
                <View style={[styles.placeholderPhoto, { flex: 1, backgroundColor: colors.bgAlt }]}>
                  <Ionicons name="leaf" size={64} color={colors.primaryDeep} />
                </View>
              )}
              
              {/* Bottom Gradient Overlay on Image */}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.imageOverlayGradient}>
                <Text style={styles.overlayPlantSpecies}>{plant.species_name}</Text>
                {plant.location && (
                  <View style={styles.overlayLocationBadge}>
                    <Text style={styles.overlayLocationText}>📍 {plant.location}</Text>
                  </View>
                )}
              </LinearGradient>
            </View>
          )}
        </View>

        {isPetToxic(plant) && (
          <View style={styles.petWarnBanner}>
            <Text style={styles.petWarnBannerIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.petWarnBannerTitle}>Evcil hayvana zararlı</Text>
              <Text style={styles.petWarnBannerText}>
                Bu bitki kedi/köpekler için toksik olabilir. Evcil dostunun erişemeyeceği bir yerde tut.
              </Text>
            </View>
          </View>
        )}

        {isEditing ? (
          /* EDIT MODE FORM */
          <View style={styles.form}>
            <Text style={styles.label}>Bitki Takma Adı</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Takma ad girin"
            />

            <Text style={styles.label}>Bitki Konumu / Odası</Text>
            <View style={styles.locationPills}>
              {FORM_LOCATIONS.map((loc) => {
                const active = editLocation === loc;
                return (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.locationPill, active && styles.locationPillActive]}
                    onPress={() => setEditLocation(active ? null : loc)}
                  >
                    <Text style={[styles.locationPillText, active && styles.locationPillTextActive]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Bitki Sağlığı</Text>
            <View style={styles.healthOptions}>
              {HEALTH_STATUS_OPTIONS.map((opt) => {
                const active = editHealth === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.healthChip, active && { backgroundColor: opt.color }]}
                    onPress={() => setEditHealth(opt.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.healthChipText, active && { color: colors.white, fontFamily: fonts.sansBold }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Sulama Aralığı (Gün)</Text>
            <TextInput
              style={styles.input}
              value={editWatering}
              onChangeText={setEditWatering}
              keyboardType="number-pad"
              maxLength={3}
            />

            <Text style={styles.label}>Gübreleme Aralığı (Gün)</Text>
            <TextInput
              style={styles.input}
              value={editFertilizing}
              onChangeText={setEditFertilizing}
              keyboardType="number-pad"
              maxLength={3}
            />

            <Text style={styles.label}>Saksı Değişim Aralığı (Gün)</Text>
            <TextInput
              style={styles.input}
              value={editRepotting}
              onChangeText={setEditRepotting}
              keyboardType="number-pad"
              maxLength={4}
            />

            <Text style={styles.label}>Açıklama / Bakım Notları</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={18} color={colors.red} style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>Bu Bitkiyi Bahçemden Kaldır</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* MAIN THREE-TAB LAYOUT */
          <View>
            {/* iOS style Segmented Control Tabs */}
            <View style={styles.segmentedControlWrapper}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segmentBtn, activeTab === 'details' && styles.segmentBtnActive]}
                  onPress={() => setActiveTab('details')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentBtnText, activeTab === 'details' && styles.segmentBtnTextActive]}>Detaylar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, activeTab === 'care' && styles.segmentBtnActive]}
                  onPress={() => setActiveTab('care')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentBtnText, activeTab === 'care' && styles.segmentBtnTextActive]}>Bakım</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, activeTab === 'growth' && styles.segmentBtnActive]}
                  onPress={() => setActiveTab('growth')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentBtnText, activeTab === 'growth' && styles.segmentBtnTextActive]}>Günlük</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TAB 1: DETAILS */}
            {activeTab === 'details' && (
              <View style={styles.tabContent}>
                {/* Meta health summary card */}
                <View style={styles.statusMetaCard}>
                  <View>
                    <Text style={styles.statusMetaTitle}>Bitki Sağlığı</Text>
                    <Text style={styles.statusMetaText}>Gemini AI ile analiz edilen durum</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: plant.health_status === 'healthy' ? badgeColors.green.bg : badgeColors.red.bg }]}>
                    <Text style={[styles.badgeText, { color: plant.health_status === 'healthy' ? badgeColors.green.text : badgeColors.red.text }]}>
                      {health.label}
                    </Text>
                  </View>
                </View>

                {/* AI Checkup Option */}
                <TouchableOpacity
                  style={[styles.checkupBtn, analyzing && { opacity: 0.6 }]}
                  disabled={analyzing}
                  onPress={handleAiCheckup}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={['#10b981', '#059669']} style={styles.checkupBtnGradient}>
                    {analyzing ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={18} color={colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.checkupBtnText}>Anlık AI Sağlık Check-up'ı Yap</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Share to Community Banner */}
                <TouchableOpacity
                  style={styles.shareBannerBtn}
                  onPress={handleShareToCommunity}
                  activeOpacity={0.9}
                >
                  <Ionicons name="people" size={18} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.shareBannerBtnText}>Bu Bitkimi Toplulukta Paylaş 👥</Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Bakım Programı</Text>
                
                {/* Routine Card 1: Water */}
                <View style={[styles.careCard, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
                  <View style={styles.careCardLeft}>
                    <View style={[styles.careIconWrapper, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="water" size={22} color="#0284c7" />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.careCardTitle}>Sulama Periyodu</Text>
                      <Text style={styles.careCardSub}>Her {plant.watering_interval_days} günde bir</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={[styles.daysText, waterLeft !== null && waterLeft <= 0 && { color: colors.red }]}>
                      {waterLeft !== null
                        ? waterLeft <= 0
                          ? 'Günü Geçti ⚠️'
                          : `${waterLeft} gün kaldı`
                        : 'Belirlenmedi'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.routineWaterBtn, { backgroundColor: '#0284c7' }]}
                      onPress={handleWaterPlant}
                      disabled={watering}
                    >
                      {watering ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.waterActionBtnText}>Sulandı</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Routine Card 2: Fertilize */}
                {plant.fertilizing_interval_days ? (
                  <View style={[styles.careCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <View style={styles.careCardLeft}>
                      <View style={[styles.careIconWrapper, { backgroundColor: '#dcfce7' }]}>
                        <Ionicons name="flask" size={20} color="#16a34a" />
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.careCardTitle}>Gübreleme Periyodu</Text>
                        <Text style={styles.careCardSub}>Her {plant.fertilizing_interval_days} günde bir</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={[styles.daysText, fertLeft !== null && fertLeft <= 0 && { color: colors.amber }]}>
                        {fertLeft !== null
                          ? fertLeft <= 0
                            ? 'Besleme Zamanı!'
                            : `${fertLeft} gün kaldı`
                          : 'Gübrelenmedi'}
                      </Text>
                      <TouchableOpacity
                        style={[styles.routineWaterBtn, { backgroundColor: '#16a34a' }]}
                        onPress={() => handleLogCare('fertilize', 'Gübrelendi')}
                      >
                        <Text style={styles.waterActionBtnText}>Gübrele</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* Routine Card 3: Repot */}
                {plant.repotting_interval_days ? (
                  <View style={[styles.careCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                    <View style={styles.careCardLeft}>
                      <View style={[styles.careIconWrapper, { backgroundColor: '#fef3c7' }]}>
                        <Ionicons name="basket" size={20} color="#b45309" />
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.careCardTitle}>Saksı Değişimi</Text>
                        <Text style={styles.careCardSub}>Her {plant.repotting_interval_days} günde bir</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={[styles.daysText, repotLeft !== null && repotLeft <= 0 && { color: colors.amber }]}>
                        {repotLeft !== null
                          ? repotLeft <= 0
                            ? 'Saksı Zamanı!'
                            : `${repotLeft} gün kaldı`
                          : 'Değiştirilmedi'}
                      </Text>
                      <TouchableOpacity
                        style={[styles.routineWaterBtn, { backgroundColor: '#b45309' }]}
                        onPress={() => handleLogCare('repot', 'Saksı Değiştirildi')}
                      >
                        <Text style={styles.waterActionBtnText}>Değiştir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* Seasonal Care Section */}
                <View style={styles.tipsBox}>
                  <Ionicons name="sunny" size={22} color={colors.secondary} style={{ marginRight: 8 }} />
                  <Text style={styles.tipsText}>{getSeasonalTip()}</Text>
                </View>

                {/* Product Suggestions Loop for Diseased Plants */}
                {(plant.health_status === 'diseased' || plant.health_status === 'pest_damage') && (
                  <View style={styles.marketplaceLoop}>
                    <Text style={styles.loopTitle}>🩺 Bitkiniz İçin Önerilen Çözümler</Text>
                    <Text style={styles.loopSubtitle}>Pazaryerindeki satıcılardan bitki sağlığı ürünleri:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.loopScroll}>
                      {MOCK_TREATMENTS.map((item) => (
                        <View key={item.id} style={styles.treatmentCard}>
                          <Text style={{ fontSize: 24, marginBottom: 4 }}>{item.emoji}</Text>
                          <Text style={styles.treatmentName} numberOfLines={2}>{item.name}</Text>
                          <Text style={styles.treatmentPrice}>{item.price}</Text>
                          <TouchableOpacity
                            style={styles.buyBtn}
                            onPress={() => {
                              Alert.alert('Bilgi', 'Pazaryerinde aratılıyor...');
                              navigation.navigate('Tabs', { screen: 'Marketplace' });
                            }}
                          >
                            <Text style={styles.buyBtnText}>Satın Al</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Notes Display */}
                {plant.description && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesTitle}>Bitki Hakkında Notlar</Text>
                    <Text style={styles.notesText}>{plant.description}</Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: CARE LOGS */}
            {activeTab === 'care' && (
              <View style={styles.tabContent}>
                <TouchableOpacity
                  style={styles.addLogToggleBtn}
                  onPress={() => setShowCareForm(!showCareForm)}
                  activeOpacity={0.9}
                >
                  <Ionicons name={showCareForm ? 'close' : 'add'} size={20} color={colors.white} />
                  <Text style={styles.addLogToggleText}>
                    {showCareForm ? 'Vazgeç' : 'Manuel Eylem Kaydet'}
                  </Text>
                </TouchableOpacity>

                {showCareForm && (
                  <View style={styles.careForm}>
                    <Text style={styles.label}>Eylem Türü</Text>
                    <View style={styles.careFormTypes}>
                      {['water', 'fertilize', 'repot', 'prune'].map((t) => {
                        const active = customCareType === t;
                        const labelMap: Record<string, string> = {
                          water: 'Sulama 💧',
                          fertilize: 'Gübre 🧪',
                          repot: 'Saksı 🪴',
                          prune: 'Budama ✂️',
                        };
                        return (
                          <TouchableOpacity
                            key={t}
                            style={[styles.careFormTypeChip, active && styles.careFormTypeChipActive]}
                            onPress={() => setCustomCareType(t)}
                          >
                            <Text style={[styles.careFormTypeChipText, active && styles.careFormTypeChipTextActive]}>
                              {labelMap[t]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.label}>Özel Notlar</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Eyleme dair not (Örn: Sararan yapraklar budandı)"
                      value={customCareNotes}
                      onChangeText={setCustomCareNotes}
                    />
                    <TouchableOpacity
                      style={styles.saveLogBtn}
                      onPress={() => handleLogCare(customCareType, customCareNotes)}
                      disabled={loggingCare}
                    >
                      <Text style={styles.saveLogBtnText}>Kaydet</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionTitle}>Bakım Zaman Tüneli</Text>
                
                {plant.care_logs && plant.care_logs.length > 0 ? (
                  <View style={styles.timelineContainer}>
                    {plant.care_logs.map((log, idx) => {
                      const iconMap: Record<string, { icon: string; color: string }> = {
                        water: { icon: 'water', color: '#0284c7' },
                        fertilize: { icon: 'flask', color: '#16a34a' },
                        repot: { icon: 'basket', color: '#b45309' },
                        prune: { icon: 'cut', color: '#6b7280' },
                      };
                      const care = iconMap[log.care_type] || { icon: 'leaf', color: colors.primaryDeep };
                      const isLast = idx === plant.care_logs.length - 1;

                      return (
                        <View key={log.care_log_id} style={styles.timelineRow}>
                          <View style={styles.timelineLeftColumn}>
                            <View style={[styles.timelineIconBox, { backgroundColor: care.color }]}>
                              <Ionicons name={care.icon as any} size={15} color={colors.white} />
                            </View>
                            {!isLast && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineRightColumn}>
                            <Text style={styles.logTitle}>{log.notes || 'Bakım eylemi uygulandı.'}</Text>
                            <Text style={styles.logDate}>{formatDate(log.created_at)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>Henüz bir bakım kaydı girilmedi.</Text>
                )}
              </View>
            )}

            {/* TAB 3: GROWTH DIARY */}
            {activeTab === 'growth' && (
              <View style={styles.tabContent}>
                <TouchableOpacity
                  style={[styles.addLogToggleBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => setShowGrowthForm(!showGrowthForm)}
                  activeOpacity={0.9}
                >
                  <Ionicons name={showGrowthForm ? 'close' : 'images'} size={20} color={colors.white} />
                  <Text style={styles.addLogToggleText}>
                    {showGrowthForm ? 'Vazgeç' : 'Fotoğraflı Günlük Sayfası Ekle'}
                  </Text>
                </TouchableOpacity>

                {showGrowthForm && (
                  <View style={styles.careForm}>
                    <Text style={styles.label}>Bitkinin Güncel Fotoğrafı</Text>
                    {newGrowthUri ? (
                      <View style={styles.growthFormImageContainer}>
                        <Image source={{ uri: newGrowthUri }} style={styles.growthFormImage} />
                        {uploadingGrowth && (
                          <View style={styles.photoLoadingOverlay}>
                            <ActivityIndicator size="small" color={colors.white} />
                          </View>
                        )}
                        <TouchableOpacity style={styles.removePhotoBtn} onPress={() => { setNewGrowthUri(null); setNewGrowthUrl(null); }}>
                          <Ionicons name="trash" size={16} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.photoOptions}>
                        <TouchableOpacity style={styles.photoCard} onPress={handleTakeGrowthImage}>
                          <Ionicons name="camera" size={24} color={colors.primaryDeep} />
                          <Text style={styles.photoText}>Kamera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.photoCard} onPress={handlePickGrowthImage}>
                          <Ionicons name="images" size={24} color={colors.primaryDeep} />
                          <Text style={styles.photoText}>Galeri</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={styles.label}>Gelişim Notunuz *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Boyu ne kadar uzadı? Yeni bir yaprak mı verdi? Gözlemlerinizi buraya not edin..."
                      value={newGrowthNote}
                      onChangeText={setNewGrowthNote}
                      multiline
                      numberOfLines={3}
                    />

                    <TouchableOpacity
                      style={[styles.saveLogBtn, { backgroundColor: colors.secondary }]}
                      onPress={handleSaveGrowthLog}
                      disabled={savingGrowth || uploadingGrowth}
                    >
                      {savingGrowth ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.saveLogBtnText}>Günlüğe Ekle</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionTitle}>Gelişim Hikayesi</Text>

                {plant.growth_logs && plant.growth_logs.length > 0 ? (
                  plant.growth_logs.map((log) => (
                    <View key={log.growth_log_id} style={styles.growthCard}>
                      {log.image_url ? (
                        <Image source={{ uri: log.image_url }} style={styles.growthImage} />
                      ) : null}
                      <View style={styles.growthCardBody}>
                        <Text style={styles.growthNoteText}>{log.note}</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                          <Text style={styles.growthDate}>{formatDate(log.created_at)}</Text>
                          <TouchableOpacity
                            style={styles.growthShareBtn}
                            onPress={() => handleShareGrowthToCommunity(log)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="people-outline" size={14} color={colors.primaryDeep} style={{ marginRight: 4 }} />
                            <Text style={styles.growthShareBtnText}>Toplulukta Paylaş</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Henüz bir gelişim günlüğü girilmedi.</Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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
    borderBottomColor: colors.borderSoft,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink },
  editButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },
  
  // Photo presentation
  photoContainer: { width: '100%', height: 280, backgroundColor: colors.bgAlt },
  detailImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderPhoto: { alignItems: 'center', justifyContent: 'center' },
  editPhotoContainer: { width: '100%', height: '100%', position: 'relative' },
  photoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPhotoOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  photoActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlayGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  overlayPlantSpecies: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.white },
  overlayLocationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: 4,
  },
  overlayLocationText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.white },

  // Edit Mode form styles
  form: { padding: spacing.lg, gap: spacing.sm },
  petWarnBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: badgeColors.red.bg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  petWarnBannerIcon: { fontSize: 18 },
  petWarnBannerTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: badgeColors.red.text },
  petWarnBannerText: { fontFamily: fonts.sansMedium, fontSize: 12, color: badgeColors.red.text, marginTop: 2, lineHeight: 17 },
  label: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.sans,
    color: colors.ink,
    backgroundColor: colors.card,
    marginBottom: spacing.xs,
  },
  textArea: { height: 90, textAlignVertical: 'top', paddingTop: 12 },
  healthOptions: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs },
  healthChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthChipText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.ink },
  locationPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: spacing.xs },
  locationPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  locationPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationPillText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink },
  locationPillTextActive: { color: colors.white, fontFamily: fonts.sansBold },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginTop: spacing.xxl,
  },
  deleteBtnText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.red },
  
  // Segmented Control Tabs Layout
  segmentedControlWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: radius.lg,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  segmentBtnActive: {
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  segmentBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.muted,
  },
  segmentBtnTextActive: {
    color: colors.primaryDeep,
    fontFamily: fonts.sansBold,
  },
  
  tabContent: { paddingHorizontal: spacing.lg },
  statusMetaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.xs,
  },
  statusMetaTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink },
  statusMetaText: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10.5 },
  
  checkupBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadow.sm,
  },
  checkupBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  checkupBtnText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.white },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.ink, marginBottom: spacing.md, marginTop: spacing.sm },
  
  // Color-coded routine cards
  careCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  careCardLeft: { flexDirection: 'row', alignItems: 'center' },
  careIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careCardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  careCardSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  daysText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.primaryDeep, textAlign: 'right' },
  routineWaterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  waterActionBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.white },
  tipsBox: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#e8f5e9',
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.lg,
  },
  tipsText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primaryDeep, lineHeight: 18 },
  notesContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  notesTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink, marginBottom: spacing.sm },
  notesText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 20 },
  
  // Marketplace loop
  marketplaceLoop: {
    marginVertical: spacing.md,
    paddingTop: spacing.xs,
  },
  loopTitle: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.ink, marginBottom: 2 },
  loopSubtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginBottom: spacing.md },
  loopScroll: { gap: spacing.md },
  treatmentCard: {
    width: 150,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadow.sm,
  },
  treatmentName: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.ink, textAlign: 'center', height: 32 },
  treatmentPrice: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.primaryDeep },
  buyBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginTop: 4,
  },
  buyBtnText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.primaryDeep },

  // Care timeline logs styling
  addLogToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: 6,
    ...shadow.sm,
  },
  addLogToggleText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.white },
  careForm: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadow.sm,
  },
  careFormTypes: { flexDirection: 'row', gap: 6, marginVertical: spacing.sm },
  careFormTypeChip: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  careFormTypeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  careFormTypeChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.ink },
  careFormTypeChipTextActive: { color: colors.white, fontFamily: fonts.sansBold },
  saveLogBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveLogBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.white },
  
  // Timeline tracking list
  timelineContainer: { paddingLeft: 8, marginVertical: spacing.sm },
  timelineRow: { flexDirection: 'row', minHeight: 65 },
  timelineLeftColumn: { alignItems: 'center', width: 30 },
  timelineIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  timelineRightColumn: { flex: 1, paddingLeft: 12, paddingTop: 3 },
  logTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink },
  logDate: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 2 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 30 },

  // Growth logs timeline styling
  growthCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  growthImage: { width: '100%', height: 180, resizeMode: 'cover' },
  growthCardBody: { padding: spacing.md },
  growthNoteText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink, lineHeight: 18 },
  growthDate: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: spacing.sm },

  growthFormImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.md,
  },
  growthFormImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removePhotoBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  photoCard: {
    flex: 1,
    height: 80,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primaryDeep,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primaryDeep },
  shareBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    ...shadow.sm,
  },
  shareBannerBtnText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.white },
  growthShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  growthShareBtnText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.primaryDeep },
});
