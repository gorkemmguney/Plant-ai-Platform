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
import { useI18n } from '../../i18n';
import { specTypeLabel } from '../../i18n/specType';
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
  { key: 'healthy', labelKey: 'plantDetail.healthHealthy', color: colors.primaryDeep },
  { key: 'diseased', labelKey: 'plantDetail.healthSick', color: colors.red },
  { key: 'pest_damage', labelKey: 'plantDetail.healthPest', color: colors.amber },
];

// value = backend'e kaydedilen konum (değiştirme), labelKey = gösterilen çeviri.
const FORM_LOCATIONS: { value: string; labelKey: string }[] = [
  { value: 'Salon', labelKey: 'addPlant.locSalon' },
  { value: 'Mutfak', labelKey: 'addPlant.locKitchen' },
  { value: 'Yatak Odası', labelKey: 'addPlant.locBedroom' },
  { value: 'Balkon', labelKey: 'addPlant.locBalcony' },
  { value: 'Ofis', labelKey: 'addPlant.locOffice' },
  { value: 'Bahçe', labelKey: 'addPlant.locGarden' },
];

const MOCK_TREATMENTS = [
  { id: 1, nameKey: 'plantDetail.treatment1', price: '129.90 TL', seller: 'Yeşil Bahçe', emoji: '🧪' },
  { id: 2, nameKey: 'plantDetail.treatment2', price: '145.00 TL', seller: 'Çiçek Evi', emoji: '🧴' },
  { id: 3, nameKey: 'plantDetail.treatment3', price: '98.50 TL', seller: 'Bahçe Market', emoji: '🌿' },
];

export default function PlantDetailScreen({ route, navigation }: any) {
  const { t, lang } = useI18n();
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
      Alert.alert(t('common.error'), t('plantDetail.loadFailed'));
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
      Alert.alert(t('garden.great'), `${data.name}${t('garden.wateredMsg')}`);
    } catch (err) {
      Alert.alert(t('common.error'), t('garden.waterFailed'));
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
      Alert.alert(t('createPost.success'), t('plantDetail.careLogged'));
    } catch (err) {
      Alert.alert(t('common.error'), t('plantDetail.careLogFailed'));
    } finally {
      setLoggingCare(false);
    }
  };

  const handlePickGrowthImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('imageAnalysis.permissionRequired'), t('createPost.libraryPermMsg'));
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
      Alert.alert(t('common.error'), t('addPlant.pickFailed'));
    }
  };

  const handleTakeGrowthImage = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('imageAnalysis.permissionRequired'), t('createPost.cameraPermMsg'));
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
      Alert.alert(t('common.error'), t('addPlant.cameraFailed'));
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
      Alert.alert(t('common.error'), t('plantDetail.photoUploadFailed'));
    } finally {
      setUploadingGrowth(false);
    }
  };

  const handleSaveGrowthLog = async () => {
    if (!newGrowthNote.trim()) {
      Alert.alert(t('createPost.missingInfo'), t('plantDetail.growthNoteReq'));
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
      Alert.alert(t('createPost.success'), t('plantDetail.growthSaved'));
    } catch (err) {
      Alert.alert(t('common.error'), t('plantDetail.growthSaveFailed'));
    } finally {
      setSavingGrowth(false);
    }
  };

  const handleAiCheckup = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('imageAnalysis.permissionRequired'), t('plantDetail.aiCameraPerm'));
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
        t('plantDetail.aiResultTitle'),
        `${t('plantDetail.aiStatus')}${nextHealth === 'healthy' ? t('plantDetail.aiHealthy') : t('plantDetail.aiSick')}\n\n${t('plantDetail.aiDetail')}${diagnosisObj.diagnosis ?? t('plantDetail.aiUndetermined')}\n\n${t('plantDetail.aiRec')}${diagnosisObj.recommendation ?? t('plantDetail.aiKeepCaring')}`
      );
    } catch (err) {
      Alert.alert(t('common.error'), t('plantDetail.aiFailed'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdate = async () => {
    if (!editName.trim()) {
      Alert.alert(t('createPost.missingInfo'), t('plantDetail.nameReq'));
      return;
    }
    const waterDays = parseInt(editWatering, 10);
    const fertDays = parseInt(editFertilizing, 10);
    const repotDays = parseInt(editRepotting, 10);

    if (isNaN(waterDays) || waterDays <= 0) {
      Alert.alert(t('common.error'), t('plantDetail.wateringReq'));
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
      Alert.alert(t('createPost.success'), t('plantDetail.updated'));
    } catch (err) {
      Alert.alert(t('common.error'), t('plantDetail.updateFailed'));
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('plantDetail.deleteTitle'),
      t('plantDetail.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/customer-products/${custProdId}`);
              Alert.alert(t('postDetail.deleted'), t('plantDetail.deletedMsg'));
              navigation.navigate('MyGarden');
            } catch (err) {
              Alert.alert(t('common.error'), t('plantDetail.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  const handleShareToCommunity = () => {
    if (!plant) return;
    navigation.navigate('CreatePost', {
      prefilledTitle: `${t('plantDetail.shareTitlePre')}${plant.name}${t('plantDetail.shareTitlePost')}`,
      prefilledContent: `${t('plantDetail.shareContentA')}${specTypeLabel(plant.species_name, lang)}${t('plantDetail.shareContentB')}${plant.name}${t('plantDetail.shareContentC')}${plant.description ? t('plantDetail.shareNotes') + plant.description : ''}`,
      prefilledImageUrl: plant.image_url,
      prefilledTag: 'general',
    });
  };

  const handleShareGrowthToCommunity = (log: GrowthLog) => {
    if (!plant) return;
    navigation.navigate('CreatePost', {
      prefilledTitle: `${plant.name}${t('plantDetail.growthShareTitle')}`,
      prefilledContent: `${t('plantDetail.growthShareA')}${plant.name}${t('plantDetail.growthShareB')}${log.note}"`,
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
      return t('plantDetail.tipSpring');
    } else if (month >= 5 && month <= 7) {
      return t('plantDetail.tipSummer');
    } else if (month >= 8 && month <= 10) {
      return t('plantDetail.tipAutumn');
    } else {
      return t('plantDetail.tipWinter');
    }
  };

  if (loading || !plant) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const healthOpt = HEALTH_STATUS_OPTIONS.find((o) => o.key === plant.health_status);
  const health = { label: healthOpt ? t(healthOpt.labelKey) : t('imageAnalysis.unknownStatus'), color: healthOpt?.color ?? colors.muted };
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
        <Text style={styles.headerTitle}>{isEditing ? t('plantDetail.editProfile') : plant.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!isEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color={colors.red} />
            </TouchableOpacity>
          )}
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
                <Text style={styles.overlayPlantSpecies}>{specTypeLabel(plant.species_name, lang)}</Text>
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
              <Text style={styles.petWarnBannerTitle}>{t('plantDetail.petToxicTitle')}</Text>
              <Text style={styles.petWarnBannerText}>{t('plantDetail.petToxicText')}</Text>
            </View>
          </View>
        )}

        {isEditing ? (
          /* EDIT MODE FORM */
          <View style={styles.form}>
            <Text style={styles.label}>{t('plantDetail.nameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('plantDetail.namePlaceholder')}
            />

            <Text style={styles.label}>{t('addPlant.locationLabel')}</Text>
            <View style={styles.locationPills}>
              {FORM_LOCATIONS.map((loc) => {
                const active = editLocation === loc.value;
                return (
                  <TouchableOpacity
                    key={loc.value}
                    style={[styles.locationPill, active && styles.locationPillActive]}
                    onPress={() => setEditLocation(active ? null : loc.value)}
                  >
                    <Text style={[styles.locationPillText, active && styles.locationPillTextActive]}>
                      {t(loc.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('plantDetail.healthLabel')}</Text>
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
                      {t(opt.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('plantDetail.wateringLabel')}</Text>
            <TextInput
              style={styles.input}
              value={editWatering}
              onChangeText={setEditWatering}
              keyboardType="number-pad"
              maxLength={3}
            />

            <Text style={styles.label}>{t('plantDetail.fertilizingLabel')}</Text>
            <TextInput
              style={styles.input}
              value={editFertilizing}
              onChangeText={setEditFertilizing}
              keyboardType="number-pad"
              maxLength={3}
            />

            <Text style={styles.label}>{t('plantDetail.repottingLabel')}</Text>
            <TextInput
              style={styles.input}
              value={editRepotting}
              onChangeText={setEditRepotting}
              keyboardType="number-pad"
              maxLength={4}
            />

            <Text style={styles.label}>{t('plantDetail.descLabel')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={18} color={colors.red} style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>{t('plantDetail.removeBtn')}</Text>
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
                  <Text style={[styles.segmentBtnText, activeTab === 'details' && styles.segmentBtnTextActive]}>{t('plantDetail.tabDetails')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, activeTab === 'care' && styles.segmentBtnActive]}
                  onPress={() => setActiveTab('care')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentBtnText, activeTab === 'care' && styles.segmentBtnTextActive]}>{t('plantDetail.tabCare')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, activeTab === 'growth' && styles.segmentBtnActive]}
                  onPress={() => setActiveTab('growth')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentBtnText, activeTab === 'growth' && styles.segmentBtnTextActive]}>{t('plantDetail.tabGrowth')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TAB 1: DETAILS */}
            {activeTab === 'details' && (
              <View style={styles.tabContent}>
                {/* Meta health summary card */}
                <View style={styles.statusMetaCard}>
                  <View>
                    <Text style={styles.statusMetaTitle}>{t('plantDetail.healthLabel')}</Text>
                    <Text style={styles.statusMetaText}>{t('plantDetail.healthMetaSub')}</Text>
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
                        <Text style={styles.checkupBtnText}>{t('plantDetail.aiCheckupBtn')}</Text>
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
                  <Text style={styles.shareBannerBtnText}>{t('plantDetail.shareBtn')}</Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>{t('addPlant.careProgram')}</Text>
                
                {/* Routine Card 1: Water */}
                <View style={[styles.careCard, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
                  <View style={styles.careCardLeft}>
                    <View style={[styles.careIconWrapper, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="water" size={22} color="#0284c7" />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.careCardTitle}>{t('plantDetail.wateringPeriod')}</Text>
                      <Text style={styles.careCardSub}>{t('plantDetail.everyPre')}{plant.watering_interval_days}{t('plantDetail.everyPost')}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={[styles.daysText, waterLeft !== null && waterLeft <= 0 && { color: colors.red }]}>
                      {waterLeft !== null
                        ? waterLeft <= 0
                          ? t('plantDetail.overdue')
                          : `${waterLeft} ${t('plantDetail.daysLeft')}`
                        : t('plantDetail.notSet')}
                    </Text>
                    <TouchableOpacity
                      style={[styles.routineWaterBtn, { backgroundColor: '#0284c7' }]}
                      onPress={handleWaterPlant}
                      disabled={watering}
                    >
                      {watering ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.waterActionBtnText}>{t('plantDetail.wateredBtn')}</Text>
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
                        <Text style={styles.careCardTitle}>{t('plantDetail.fertilizingPeriod')}</Text>
                        <Text style={styles.careCardSub}>{t('plantDetail.everyPre')}{plant.fertilizing_interval_days}{t('plantDetail.everyPost')}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={[styles.daysText, fertLeft !== null && fertLeft <= 0 && { color: colors.amber }]}>
                        {fertLeft !== null
                          ? fertLeft <= 0
                            ? t('plantDetail.feedTime')
                            : `${fertLeft} ${t('plantDetail.daysLeft')}`
                          : t('plantDetail.notFertilized')}
                      </Text>
                      <TouchableOpacity
                        style={[styles.routineWaterBtn, { backgroundColor: '#16a34a' }]}
                        onPress={() => handleLogCare('fertilize', t('plantDetail.fertilizedNote'))}
                      >
                        <Text style={styles.waterActionBtnText}>{t('plantDetail.fertilizeBtn')}</Text>
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
                        <Text style={styles.careCardTitle}>{t('plantDetail.repottingPeriod')}</Text>
                        <Text style={styles.careCardSub}>{t('plantDetail.everyPre')}{plant.repotting_interval_days}{t('plantDetail.everyPost')}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={[styles.daysText, repotLeft !== null && repotLeft <= 0 && { color: colors.amber }]}>
                        {repotLeft !== null
                          ? repotLeft <= 0
                            ? t('plantDetail.repotTime')
                            : `${repotLeft} ${t('plantDetail.daysLeft')}`
                          : t('plantDetail.notRepotted')}
                      </Text>
                      <TouchableOpacity
                        style={[styles.routineWaterBtn, { backgroundColor: '#b45309' }]}
                        onPress={() => handleLogCare('repot', t('plantDetail.repottedNote'))}
                      >
                        <Text style={styles.waterActionBtnText}>{t('plantDetail.repotBtn')}</Text>
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
                    <Text style={styles.loopTitle}>{t('plantDetail.solutionsTitle')}</Text>
                    <Text style={styles.loopSubtitle}>{t('plantDetail.solutionsSub')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.loopScroll}>
                      {MOCK_TREATMENTS.map((item) => (
                        <View key={item.id} style={styles.treatmentCard}>
                          <Text style={{ fontSize: 24, marginBottom: 4 }}>{item.emoji}</Text>
                          <Text style={styles.treatmentName} numberOfLines={2}>{t(item.nameKey)}</Text>
                          <Text style={styles.treatmentPrice}>{item.price}</Text>
                          <TouchableOpacity
                            style={styles.buyBtn}
                            onPress={() => {
                              Alert.alert(t('plantDetail.info'), t('plantDetail.searchingMarket'));
                              navigation.navigate('Tabs', { screen: 'Marketplace' });
                            }}
                          >
                            <Text style={styles.buyBtnText}>{t('plantDetail.buyBtn')}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Notes Display */}
                {plant.description && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesTitle}>{t('plantDetail.notesTitle')}</Text>
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
                    {showCareForm ? t('common.cancel') : t('plantDetail.logManual')}
                  </Text>
                </TouchableOpacity>

                {showCareForm && (
                  <View style={styles.careForm}>
                    <Text style={styles.label}>{t('plantDetail.actionType')}</Text>
                    <View style={styles.careFormTypes}>
                      {['water', 'fertilize', 'repot', 'prune'].map((careType) => {
                        const active = customCareType === careType;
                        const labelMap: Record<string, string> = {
                          water: t('plantDetail.actWater'),
                          fertilize: t('plantDetail.actFert'),
                          repot: t('plantDetail.actRepot'),
                          prune: t('plantDetail.actPrune'),
                        };
                        return (
                          <TouchableOpacity
                            key={careType}
                            style={[styles.careFormTypeChip, active && styles.careFormTypeChipActive]}
                            onPress={() => setCustomCareType(careType)}
                          >
                            <Text style={[styles.careFormTypeChipText, active && styles.careFormTypeChipTextActive]}>
                              {labelMap[careType]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.label}>{t('plantDetail.customNotes')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('plantDetail.careNotePlaceholder')}
                      value={customCareNotes}
                      onChangeText={setCustomCareNotes}
                    />
                    <TouchableOpacity
                      style={styles.saveLogBtn}
                      onPress={() => handleLogCare(customCareType, customCareNotes)}
                      disabled={loggingCare}
                    >
                      <Text style={styles.saveLogBtnText}>{t('settings.save')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionTitle}>{t('plantDetail.careTimeline')}</Text>
                
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
                            <Text style={styles.logTitle}>{log.notes || t('plantDetail.careApplied')}</Text>
                            <Text style={styles.logDate}>{formatDate(log.created_at)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>{t('plantDetail.noCareLogs')}</Text>
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
                    {showGrowthForm ? t('common.cancel') : t('plantDetail.addGrowthPage')}
                  </Text>
                </TouchableOpacity>

                {showGrowthForm && (
                  <View style={styles.careForm}>
                    <Text style={styles.label}>{t('plantDetail.currentPhoto')}</Text>
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
                          <Text style={styles.photoText}>{t('plantDetail.camera')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.photoCard} onPress={handlePickGrowthImage}>
                          <Ionicons name="images" size={24} color={colors.primaryDeep} />
                          <Text style={styles.photoText}>{t('plantDetail.gallery')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={styles.label}>{t('plantDetail.growthNoteLabel')}</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={t('plantDetail.growthNotePlaceholder')}
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
                        <Text style={styles.saveLogBtnText}>{t('plantDetail.addToDiary')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionTitle}>{t('plantDetail.growthStory')}</Text>

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
                            <Text style={styles.growthShareBtnText}>{t('plantDetail.shareToCommunity')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{t('plantDetail.noGrowthLogs')}</Text>
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
    ...shadow.sm,
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
