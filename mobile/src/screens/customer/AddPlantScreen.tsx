import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
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
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface SpecOption {
  prod_spec_id: number;
  name: string;
  description: string | null;
}

// value = backend'e kaydedilen konum (değiştirme), labelKey = gösterilen çeviri.
const FORM_LOCATIONS: { value: string; labelKey: string }[] = [
  { value: 'Salon', labelKey: 'addPlant.locSalon' },
  { value: 'Mutfak', labelKey: 'addPlant.locKitchen' },
  { value: 'Yatak Odası', labelKey: 'addPlant.locBedroom' },
  { value: 'Balkon', labelKey: 'addPlant.locBalcony' },
  { value: 'Ofis', labelKey: 'addPlant.locOffice' },
  { value: 'Bahçe', labelKey: 'addPlant.locGarden' },
];

// Bitki türüne göre önerilen bakım aralıkları (gün) — türün adındaki anahtar kelimeyle eşleşir
const CARE_BY_TYPE: { match: string; water: number; fertilize: number; repot: number }[] = [
  { match: 'kaktüs', water: 21, fertilize: 60, repot: 730 },
  { match: 'sukulent', water: 14, fertilize: 45, repot: 540 },
  { match: 'çiçek', water: 5, fertilize: 14, repot: 365 },
  { match: 'palmiye', water: 7, fertilize: 30, repot: 730 },
  { match: 'yaprak', water: 7, fertilize: 30, repot: 365 },
  { match: 'dış', water: 4, fertilize: 30, repot: 365 },
  { match: 'fidan', water: 4, fertilize: 30, repot: 365 },
];
const DEFAULT_CARE = { water: 7, fertilize: 30, repot: 365 };

function careForSpecName(name: string | undefined) {
  if (!name) return DEFAULT_CARE;
  const n = name.toLowerCase();
  return CARE_BY_TYPE.find((c) => n.includes(c.match)) ?? DEFAULT_CARE;
}

// Bitki türü içindeki yaygın cinsler + evcil hayvana (kedi/köpek) zararlı mı
// nameKey = i18n anahtarı (görünen ad), toxic = evcil hayvana zararlı mı.
const SPECIES_BY_TYPE: { match: string; species: { nameKey: string; toxic: boolean }[] }[] = [
  { match: 'yaprak', species: [
    { nameKey: 'species.monstera', toxic: true },
    { nameKey: 'species.zamioculcas', toxic: true },
    { nameKey: 'species.ficusRubber', toxic: true },
    { nameKey: 'species.dieffenbachia', toxic: true },
    { nameKey: 'species.pothos', toxic: true },
    { nameKey: 'species.calathea', toxic: false },
  ]},
  { match: 'çiçek', species: [
    { nameKey: 'species.orchid', toxic: false },
    { nameKey: 'species.gerbera', toxic: false },
    { nameKey: 'species.rose', toxic: false },
    { nameKey: 'species.violet', toxic: false },
    { nameKey: 'species.lily', toxic: true },
    { nameKey: 'species.lavender', toxic: true },
  ]},
  { match: 'kaktüs', species: [
    { nameKey: 'species.echinocactus', toxic: false },
    { nameKey: 'species.mammillaria', toxic: false },
    { nameKey: 'species.miniCactus', toxic: false },
  ]},
  { match: 'sukulent', species: [
    { nameKey: 'species.echeveria', toxic: false },
    { nameKey: 'species.haworthia', toxic: false },
    { nameKey: 'species.aloeVera', toxic: true },
    { nameKey: 'species.kalanchoe', toxic: true },
    { nameKey: 'species.jade', toxic: true },
  ]},
  { match: 'palmiye', species: [
    { nameKey: 'species.arecaPalm', toxic: false },
    { nameKey: 'species.kentiaPalm', toxic: false },
    { nameKey: 'species.sagoPalm', toxic: true },
  ]},
  { match: 'dış', species: [
    { nameKey: 'species.roseSapling', toxic: false },
    { nameKey: 'species.lavender', toxic: true },
    { nameKey: 'species.oleander', toxic: true },
    { nameKey: 'species.hydrangea', toxic: true },
  ]},
  { match: 'fidan', species: [
    { nameKey: 'species.roseSapling', toxic: false },
    { nameKey: 'species.oleander', toxic: true },
  ]},
];

function speciesForSpecName(name: string | undefined) {
  if (!name) return [];
  const n = name.toLowerCase();
  return SPECIES_BY_TYPE.find((s) => n.includes(s.match))?.species ?? [];
}

export default function AddPlantScreen({ route, navigation }: any) {
  const { t, lang } = useI18n();
  const { prefilledData } = route.params || {};

  const [name, setName] = useState('');
  const [specs, setSpecs] = useState<SpecOption[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [editingCare, setEditingCare] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [wateringInterval, setWateringInterval] = useState('7');
  const [fertilizingInterval, setFertilizingInterval] = useState('30');
  const [repottingInterval, setRepottingInterval] = useState('365');
  const [description, setDescription] = useState('');
  
  const [imageUri, setImageUri] = useState<string | null>(prefilledData?.imageUrl ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(prefilledData?.imageUrl ?? null);
  
  const [loadingSpecs, setLoadingSpecs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get<SpecOption[]>('/catalog/product-specs');
        // Malzemeler (saksı/toprak vb.) bahçeye bitki olarak eklenmez — tür listesinden çıkar
        const plantSpecs = data.filter((s) => !s.name.toLowerCase().includes('malzeme'));
        setSpecs(plantSpecs);

        // AI analizinden gelen tür varsa eşleştir; yoksa seçimi boş bırak (kullanıcı seçsin)
        if (prefilledData?.species && plantSpecs.length > 0) {
          const match = plantSpecs.find(
            (s) =>
              s.name.toLowerCase().includes(prefilledData.species.toLowerCase()) ||
              prefilledData.species.toLowerCase().includes(s.name.toLowerCase())
          );
          if (match) setSelectedSpecId(match.prod_spec_id);
        }
      } catch (err) {
        Alert.alert(t('common.error'), t('addPlant.specsLoadFailed'));
      } finally {
        setLoadingSpecs(false);
      }
    })();
  }, [prefilledData]);

  // Bitki türü seçilince bakım aralıklarını türe göre otomatik ayarla + cins seçimini sıfırla
  useEffect(() => {
    setSelectedSpecies(null);
    setEditingCare(false);
    if (selectedSpecId == null) return;
    const spec = specs.find((s) => s.prod_spec_id === selectedSpecId);
    const care = careForSpecName(spec?.name);
    setWateringInterval(String(care.water));
    setFertilizingInterval(String(care.fertilize));
    setRepottingInterval(String(care.repot));
  }, [selectedSpecId, specs]);

  // Seçili türe ait cinsler
  const speciesOptions = useMemo(() => {
    const spec = specs.find((s) => s.prod_spec_id === selectedSpecId);
    return speciesForSpecName(spec?.name);
  }, [selectedSpecId, specs]);

  const pickSpecies = (sp: { nameKey: string; toxic: boolean }) => {
    setSelectedSpecies(sp.nameKey);
    setName(t(sp.nameKey)); // bitki adını cinse göre doldur (kullanıcı sonra kişiselleştirebilir)
  };

  const handlePickImage = async () => {
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
        const uri = result.assets[0].uri;
        setImageUri(uri);
        await uploadSelectedImage(uri);
      }
    } catch (err) {
      Alert.alert(t('common.error'), t('addPlant.pickFailed'));
    }
  };

  const handleTakeImage = async () => {
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
        const uri = result.assets[0].uri;
        setImageUri(uri);
        await uploadSelectedImage(uri);
      }
    } catch (err) {
      Alert.alert(t('common.error'), t('addPlant.cameraFailed'));
    }
  };

  const uploadSelectedImage = async (uri: string) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'plant.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type,
      } as any);

      // Reusing analysis endpoint for image hosting
      const { data } = await apiClient.post('/ai/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(data.image_url);
    } catch (err) {
      console.log('[AddPlant] Image upload error:', err);
      Alert.alert(t('common.error'), t('addPlant.uploadFailed'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddPlant = async () => {
    if (!name.trim()) {
      Alert.alert(t('createPost.missingInfo'), t('addPlant.nameReq'));
      return;
    }
    if (!selectedSpecId) {
      Alert.alert(t('createPost.missingInfo'), t('addPlant.typeReq'));
      return;
    }
    const days = parseInt(wateringInterval, 10);
    if (isNaN(days) || days <= 0) {
      Alert.alert(t('createPost.missingInfo'), t('addPlant.wateringReq'));
      return;
    }

    const fertDays = parseInt(fertilizingInterval, 10);
    const repotDays = parseInt(repottingInterval, 10);

    setSubmitting(true);
    try {
      await apiClient.post('/customer-products', {
        name: name.trim(),
        prod_spec_id: selectedSpecId,
        location: location,
        watering_interval_days: days,
        fertilizing_interval_days: isNaN(fertDays) ? null : fertDays,
        repotting_interval_days: isNaN(repotDays) ? null : repotDays,
        description: description.trim() || null,
        image_url: imageUrl,
      });

      Alert.alert(t('createPost.success'), t('addPlant.successMsg'));
      navigation.navigate('MyGarden');
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? t('addPlant.saveFailed');
      Alert.alert(t('common.error'), detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('addPlant.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Photo Section */}
        <View style={styles.photoSection}>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              {uploadingImage && (
                <View style={styles.imageOverlayLoading}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.uploadingText}>{t('addPlant.uploading')}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => {
                  setImageUri(null);
                  setImageUrl(null);
                }}
              >
                <Ionicons name="trash" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoOptions}>
              <TouchableOpacity style={styles.photoCard} onPress={handleTakeImage} activeOpacity={0.8}>
                <Ionicons name="camera" size={32} color={colors.primaryDeep} />
                <Text style={styles.photoText}>{t('createPost.takePhoto')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoCard} onPress={handlePickImage} activeOpacity={0.8}>
                <Ionicons name="images" size={32} color={colors.primaryDeep} />
                <Text style={styles.photoText}>{t('createPost.pickGallery')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.form}>
          {/* Custom Name */}
          <Text style={styles.label}>{t('addPlant.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('addPlant.namePlaceholder')}
            placeholderTextColor={colors.muted2}
            value={name}
            onChangeText={setName}
            editable={!submitting}
          />
          <Text style={styles.fieldHint}>{t('addPlant.nameHint')}</Text>

          {/* Plant Location Selection */}
          <Text style={styles.label}>{t('addPlant.locationLabel')}</Text>
          <View style={styles.specsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specsScroll}>
              {FORM_LOCATIONS.map((loc) => {
                const isSelected = location === loc.value;
                return (
                  <TouchableOpacity
                    key={loc.value}
                    style={[styles.specChip, isSelected && styles.specChipSelected]}
                    onPress={() => setLocation(isSelected ? null : loc.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.specChipText, isSelected && styles.specChipTextSelected]}>
                      {t(loc.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Plant Specification Selection */}
          <Text style={styles.label}>{t('addPlant.typeLabel')}</Text>
          {loadingSpecs ? (
            <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
          ) : (
            <View style={styles.specsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specsScroll}>
                {specs.map((s) => {
                  const isSelected = selectedSpecId === s.prod_spec_id;
                  return (
                    <TouchableOpacity
                      key={s.prod_spec_id}
                      style={[styles.specChip, isSelected && styles.specChipSelected]}
                      onPress={() => setSelectedSpecId(s.prod_spec_id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.specChipText, isSelected && styles.specChipTextSelected]}>
                        {specTypeLabel(s.name, lang)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Bitki Cinsi — tür seçilince o türe ait yaygın cinsler */}
          {speciesOptions.length > 0 && (
            <>
              <Text style={styles.label}>{t('addPlant.speciesLabel')}</Text>
              <View style={styles.specsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specsScroll}>
                  {speciesOptions.map((sp) => {
                    const isSelected = selectedSpecies === sp.nameKey;
                    return (
                      <TouchableOpacity
                        key={sp.nameKey}
                        style={[styles.specChip, isSelected && styles.specChipSelected]}
                        onPress={() => pickSpecies(sp)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.specChipText, isSelected && styles.specChipTextSelected]}>
                          {sp.toxic ? '⚠️ ' : ''}{t(sp.nameKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              {selectedSpecies != null &&
                speciesOptions.find((s) => s.nameKey === selectedSpecies)?.toxic && (
                  <View style={styles.speciesWarn}>
                    <Text style={styles.speciesWarnText}>
                      ⚠️ {t(selectedSpecies)}{t('addPlant.toxicWarn')}
                    </Text>
                  </View>
                )}
            </>
          )}

          {/* Bakım programı — yalnızca bir bitki türü seçilince, türe göre otomatik */}
          <Text style={styles.label}>{t('addPlant.careProgram')}</Text>
          {selectedSpecId == null ? (
            <View style={styles.careHint}>
              <Text style={styles.careHintText}>{t('addPlant.careHint')}</Text>
            </View>
          ) : (
            <View style={styles.careCard}>
              <TouchableOpacity
                style={styles.careEditBtn}
                onPress={() => setEditingCare((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Ionicons name={editingCare ? 'checkmark' : 'pencil'} size={16} color={colors.primaryDeep} />
              </TouchableOpacity>

              {[
                { icon: '💧', label: t('addPlant.careWatering'), value: wateringInterval, set: setWateringInterval },
                { icon: '🌿', label: t('addPlant.careFertilizing'), value: fertilizingInterval, set: setFertilizingInterval },
                { icon: '🪴', label: t('addPlant.careRepotting'), value: repottingInterval, set: setRepottingInterval },
              ].map((row) => (
                <View key={row.label} style={styles.careRow}>
                  <Text style={styles.careIcon}>{row.icon}</Text>
                  {editingCare ? (
                    <View style={styles.careEditRow}>
                      <Text style={styles.careText}>{row.label}:</Text>
                      <TextInput
                        style={styles.careInput}
                        keyboardType="number-pad"
                        maxLength={4}
                        value={row.value}
                        onChangeText={row.set}
                        editable={!submitting}
                      />
                      <Text style={styles.careText}>{t('addPlant.daysUnit')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.careText}>
                      {row.label}: <Text style={styles.careDays}>{row.value}</Text> {t('addPlant.daysUnit')}
                    </Text>
                  )}
                </View>
              ))}
              <Text style={styles.careNote}>
                {editingCare ? t('addPlant.careNoteEdit') : t('addPlant.careNoteAuto')}
              </Text>
            </View>
          )}

          {/* Description / Notes */}
          <Text style={styles.label}>{t('addPlant.notesLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('addPlant.notesPlaceholder')}
            placeholderTextColor={colors.muted2}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            editable={!submitting}
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, (submitting || uploadingImage) && styles.saveBtnDisabled]}
            disabled={submitting || uploadingImage}
            onPress={handleAddPlant}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>{t('addPlant.saveBtn')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scroll: { paddingBottom: 40 },
  photoSection: { padding: spacing.lg, alignItems: 'center' },
  photoOptions: { flexDirection: 'row', gap: spacing.lg, width: '100%' },
  photoCard: {
    flex: 1,
    height: 110,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryDeep,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primaryDeep },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOverlayLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadingText: { fontFamily: fonts.sans, fontSize: 12, color: colors.white },
  removePhotoBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  specsContainer: { marginVertical: spacing.xs },
  specsScroll: { gap: spacing.xs },
  specChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  specChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  specChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  specChipTextSelected: { color: colors.white, fontFamily: fonts.sansBold },
  wateringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  wateringSuffix: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  careCard: {
    position: 'relative',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    paddingRight: 40,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  careEditBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 30 },
  careEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  careInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 54,
    textAlign: 'center',
    fontFamily: fonts.sansBold,
    fontSize: 13.5,
    color: colors.primaryDeep,
  },
  careIcon: { fontSize: 16 },
  careText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink },
  careDays: { fontFamily: fonts.sansBold, color: colors.primaryDeep },
  careNote: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  careHint: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  careHintText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  fieldHint: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: -spacing.xs, marginBottom: spacing.md, lineHeight: 16 },
  speciesWarn: {
    backgroundColor: '#fbe4e8',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  speciesWarnText: { fontFamily: fonts.sansMedium, fontSize: 12, color: '#c23434', lineHeight: 17 },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    ...shadow.glow,
  },
  saveBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
  saveBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.white },
});
