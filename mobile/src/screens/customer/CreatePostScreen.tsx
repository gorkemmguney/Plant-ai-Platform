import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

const TAG_OPTIONS = [
  { key: 'general', labelKey: 'community.filterGeneral' },
  { key: 'care', labelKey: 'community.filterCare' },
  { key: 'disease', labelKey: 'community.filterDisease' },
  { key: 'swap', labelKey: 'community.filterSwap' },
];

export default function CreatePostScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const { prefilledTitle, prefilledContent, prefilledImageUrl, prefilledTag } = route.params || {};

  const [title, setTitle] = useState(prefilledTitle || '');
  const [content, setContent] = useState(prefilledContent || '');
  const [selectedTag, setSelectedTag] = useState(prefilledTag || 'general');
  const [askAi, setAskAi] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(prefilledImageUrl || null);
  const [submitting, setSubmitting] = useState(false);

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
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.log('[CreatePost] Image pick error:', err);
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
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.log('[CreatePost] Camera error:', err);
    }
  };

  const handleCreatePost = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert(t('createPost.missingInfo'), t('createPost.missingInfoMsg'));
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('tag', selectedTag);
      formData.append('ask_ai', askAi ? 'true' : 'false');

      if (imageUri) {
        if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
          formData.append('image_url', imageUri);
        } else {
          const filename = imageUri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('file', {
            uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
            name: filename,
            type,
          } as any);
        }
      }

      await apiClient.post('/community/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(t('createPost.success'), t('createPost.successMsg'));
      navigation.goBack();
    } catch (err: any) {
      console.log('[CreatePost] Post error:', err);
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('createPost.createFailed'));
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
          <Ionicons name="close" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('createPost.title')}</Text>
        <TouchableOpacity
          style={[styles.publishBtn, (!title.trim() || !content.trim() || submitting) && styles.publishBtnDisabled]}
          onPress={handleCreatePost}
          disabled={!title.trim() || !content.trim() || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.publishBtnText}>{t('createPost.publish')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Title Input */}
        <Text style={styles.label}>{t('createPost.titleLabel')}</Text>
        <TextInput
          style={styles.inputTitle}
          placeholder={t('createPost.titlePlaceholder')}
          placeholderTextColor={colors.muted2}
          value={title}
          onChangeText={setTitle}
        />

        {/* Category Tag Selection */}
        <Text style={styles.label}>{t('createPost.categoryLabel')}</Text>
        <View style={styles.tagsRow}>
          {TAG_OPTIONS.map((tag) => {
            const isSelected = selectedTag === tag.key;
            return (
              <TouchableOpacity
                key={tag.key}
                style={[styles.tagOption, isSelected && styles.tagOptionActive]}
                onPress={() => {
                  setSelectedTag(tag.key);
                  if (tag.key === 'disease') setAskAi(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tagOptionText, isSelected && styles.tagOptionTextActive]}>
                  {t(tag.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content Input */}
        <Text style={styles.label}>{t('createPost.contentLabel')}</Text>
        <TextInput
          style={styles.inputContent}
          placeholder={t('createPost.contentPlaceholder')}
          placeholderTextColor={colors.muted2}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        {/* Photo Attachment Section */}
        <Text style={styles.label}>{t('createPost.imageLabel')}</Text>
        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
              <Ionicons name="trash-outline" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActionRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickImage} activeOpacity={0.8}>
              <Ionicons name="images-outline" size={22} color={colors.primaryDeep} />
              <Text style={styles.photoBtnText}>{t('createPost.pickGallery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={handleTakeImage} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={22} color={colors.primaryDeep} />
              <Text style={styles.photoBtnText}>{t('createPost.takePhoto')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Specialist Toggle Switch */}
        <View style={styles.aiToggleBox}>
          <View style={styles.aiToggleTextWrap}>
            <View style={styles.aiTitleRow}>
              <Ionicons name="sparkles" size={18} color={colors.primaryDeep} />
              <Text style={styles.aiToggleTitle}>{t('createPost.askAiTitle')}</Text>
            </View>
            <Text style={styles.aiToggleSub}>{t('createPost.askAiSub')}</Text>
          </View>
          <Switch
            value={askAi}
            onValueChange={setAskAi}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
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
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.ink },
  publishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  publishBtnDisabled: { backgroundColor: colors.muted2 },
  publishBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#ffffff' },
  content: { padding: spacing.lg, paddingBottom: 60 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink, marginTop: spacing.md, marginBottom: 6 },
  inputTitle: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.sansSemi,
    fontSize: 15,
    color: colors.ink,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  tagOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  tagOptionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tagOptionText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },
  tagOptionTextActive: { color: colors.primaryDeep, fontFamily: fonts.sansBold },
  inputContent: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    minHeight: 120,
  },
  photoActionRow: { flexDirection: 'row', gap: spacing.md },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    gap: 8,
  },
  photoBtnText: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.primaryDeep },
  imagePreviewWrap: { position: 'relative', borderRadius: radius.md, overflow: 'hidden' },
  imagePreview: { width: '100%', height: 200, borderRadius: radius.md },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: radius.full,
  },
  aiToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  aiToggleTextWrap: { flex: 1 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiToggleTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryDeep },
  aiToggleSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, lineHeight: 16 },
});
