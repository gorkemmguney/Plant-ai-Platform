import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface SpecOption {
  prod_spec_id: number;
  name: string;
  description: string | null;
}

const FORM_LOCATIONS = ['Salon', 'Mutfak', 'Yatak Odası', 'Balkon', 'Ofis', 'Bahçe'];

export default function AddPlantScreen({ route, navigation }: any) {
  const { prefilledData } = route.params || {};

  const [name, setName] = useState('');
  const [specs, setSpecs] = useState<SpecOption[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
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
        setSpecs(data);

        // Try to match prefilled species to a spec_id
        if (prefilledData?.species && data.length > 0) {
          const match = data.find(
            (s) =>
              s.name.toLowerCase().includes(prefilledData.species.toLowerCase()) ||
              prefilledData.species.toLowerCase().includes(s.name.toLowerCase())
          );
          if (match) {
            setSelectedSpecId(match.prod_spec_id);
          } else {
            // Find "Bilinmeyen Bitki" or "Diğer" or default to first
            const fallback = data.find((s) => s.name.includes('Bilinmeyen') || s.name.includes('Diğer'));
            setSelectedSpecId(fallback ? fallback.prod_spec_id : data[0].prod_spec_id);
          }
        } else if (data.length > 0) {
          setSelectedSpecId(data[0].prod_spec_id);
        }
      } catch (err) {
        Alert.alert('Hata', 'Bitki türleri yüklenemedi.');
      } finally {
        setLoadingSpecs(false);
      }
    })();
  }, [prefilledData]);

  const handlePickImage = async () => {
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
        const uri = result.assets[0].uri;
        setImageUri(uri);
        await uploadSelectedImage(uri);
      }
    } catch (err) {
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  };

  const handleTakeImage = async () => {
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
        const uri = result.assets[0].uri;
        setImageUri(uri);
        await uploadSelectedImage(uri);
      }
    } catch (err) {
      Alert.alert('Hata', 'Kamera açılamadı.');
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
      Alert.alert('Hata', 'Görsel sunucuya yüklenemedi, ancak yerel olarak saklandı.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddPlant = async () => {
    if (!name.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen bitkinize bir takma ad verin.');
      return;
    }
    if (!selectedSpecId) {
      Alert.alert('Eksik Bilgi', 'Lütfen bir bitki türü seçin.');
      return;
    }
    const days = parseInt(wateringInterval, 10);
    if (isNaN(days) || days <= 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir sulama aralığı (gün) girin.');
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

      Alert.alert('Başarılı', 'Bitkiniz bahçenize eklendi! 🎉');
      navigation.navigate('MyGarden');
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Bitki kaydedilirken bir hata oluştu.';
      Alert.alert('Hata', detail);
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
        <Text style={styles.headerTitle}>Yeni Bitki Ekle</Text>
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
                  <Text style={styles.uploadingText}>Yükleniyor...</Text>
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
                <Text style={styles.photoText}>Fotoğraf Çek</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoCard} onPress={handlePickImage} activeOpacity={0.8}>
                <Ionicons name="images" size={32} color={colors.primaryDeep} />
                <Text style={styles.photoText}>Galeriden Seç</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.form}>
          {/* Custom Name */}
          <Text style={styles.label}>Bitki Takma Adı *</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Salon Monsteram, Ofis Kaktüsü"
            placeholderTextColor={colors.muted2}
            value={name}
            onChangeText={setName}
            editable={!submitting}
          />

          {/* Plant Location Selection */}
          <Text style={styles.label}>Bitki Konumu / Odası</Text>
          <View style={styles.specsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specsScroll}>
              {FORM_LOCATIONS.map((loc) => {
                const isSelected = location === loc;
                return (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.specChip, isSelected && styles.specChipSelected]}
                    onPress={() => setLocation(isSelected ? null : loc)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.specChipText, isSelected && styles.specChipTextSelected]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Plant Specification Selection */}
          <Text style={styles.label}>Bitki Türü *</Text>
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
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Watering Interval */}
          <Text style={styles.label}>Sulama Aralığı (Gün) *</Text>
          <View style={styles.wateringRow}>
            <TextInput
              style={[styles.input, { width: 80, textAlign: 'center', marginBottom: 0 }]}
              keyboardType="number-pad"
              maxLength={3}
              value={wateringInterval}
              onChangeText={setWateringInterval}
              editable={!submitting}
            />
            <Text style={styles.wateringSuffix}>günde bir sulanmalı.</Text>
          </View>

          {/* Fertilizing Interval */}
          <Text style={styles.label}>Gübreleme Aralığı (Gün)</Text>
          <View style={styles.wateringRow}>
            <TextInput
              style={[styles.input, { width: 80, textAlign: 'center', marginBottom: 0 }]}
              keyboardType="number-pad"
              maxLength={3}
              value={fertilizingInterval}
              onChangeText={setFertilizingInterval}
              editable={!submitting}
            />
            <Text style={styles.wateringSuffix}>günde bir gübrelenmeli.</Text>
          </View>

          {/* Repotting Interval */}
          <Text style={styles.label}>Saksı Değişim Aralığı (Gün)</Text>
          <View style={styles.wateringRow}>
            <TextInput
              style={[styles.input, { width: 80, textAlign: 'center', marginBottom: 0 }]}
              keyboardType="number-pad"
              maxLength={4}
              value={repottingInterval}
              onChangeText={setRepottingInterval}
              editable={!submitting}
            />
            <Text style={styles.wateringSuffix}>günde bir saksı değişmeli.</Text>
          </View>

          {/* Description / Notes */}
          <Text style={styles.label}>Özel Bakım Notları / Açıklama</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Bitkinizin konumu, sulama dışındaki bakım tüyoları veya özel durumu..."
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
              <Text style={styles.saveBtnText}>Bitkiyi Bahçeme Kaydet</Text>
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
