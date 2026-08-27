import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Post {
  post_id: number;
  user_id: number;
  author_name: string;
  title: string;
  content: string;
  image_url: string | null;
  tag: string;
  ask_ai: boolean;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
  created_at: string;
  updated_at: string;
}

const TAG_FILTERS = [
  { key: 'all', labelKey: 'community.filterAll', icon: 'sparkles' },
  { key: 'general', labelKey: 'community.filterGeneral', icon: 'leaf' },
  { key: 'care', labelKey: 'community.filterCare', icon: 'water' },
  { key: 'disease', labelKey: 'community.filterDisease', icon: 'medkit' },
  { key: 'swap', labelKey: 'community.filterSwap', icon: 'repeat' },
];

const TAG_LABELS: Record<string, { labelKey: string; bg: string; text: string; icon: string }> = {
  general: { labelKey: 'community.tagGeneral', bg: colors.primarySoft, text: colors.primaryDeep, icon: 'leaf-outline' },
  care: { labelKey: 'community.tagCare', bg: '#e0f2fe', text: '#0369a1', icon: 'water-outline' },
  disease: { labelKey: 'community.tagDisease', bg: '#fee2e2', text: '#b91c1c', icon: 'medkit-outline' },
  swap: { labelKey: 'community.tagSwap', bg: '#fef3c7', text: '#b45309', icon: 'repeat-outline' },
};

export default function CommunityFeedScreen({ navigation }: any) {
  const { userId, roles } = useAuth();
  const { t } = useI18n();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState('all');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const handleDeletePost = (postId: number) => {
    Alert.alert(
      t('postDetail.deleteTitle'),
      t('postDetail.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/community/posts/${postId}`);
              setPosts((prev) => prev.filter((p) => p.post_id !== postId));
              Alert.alert(t('postDetail.deleted'), t('postDetail.deletedMsg'));
            } catch (err) {
              Alert.alert(t('common.error'), t('postDetail.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  const loadPosts = useCallback(async (tag = selectedTag) => {
    try {
      const url = tag === 'all' ? '/community/posts' : `/community/posts?tag=${tag}`;
      const { data } = await apiClient.get<Post[]>(url);
      setPosts(data);
    } catch (err) {
      console.log('[CommunityFeed] Load posts error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTag]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const handleTagSelect = (tagKey: string) => {
    setSelectedTag(tagKey);
    setLoading(true);
    loadPosts(tagKey);
  };

  const handleToggleLike = async (postId: number) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.post_id === postId) {
          const nextLiked = !p.is_liked_by_me;
          return {
            ...p,
            is_liked_by_me: nextLiked,
            like_count: nextLiked ? p.like_count + 1 : Math.max(0, p.like_count - 1),
          };
        }
        return p;
      })
    );

    try {
      await apiClient.post(`/community/posts/${postId}/like`);
    } catch (err) {
      console.log('[CommunityFeed] Like toggle error:', err);
      loadPosts();
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    const tagInfo = TAG_LABELS[item.tag] || TAG_LABELS.general;
    const formattedDate = new Date(item.created_at).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={() => navigation.navigate('PostDetail', { postId: item.post_id })}
      >
        {/* Post Author Header */}
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            activeOpacity={0.7}
            onPress={() => {
              if (item.user_id) {
                navigation.navigate('PublicProfile', { userId: item.user_id, authorName: item.author_name });
              }
            }}
          >
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{(item.author_name || 'B').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerTextWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.authorName}>{item.author_name}</Text>
                <Ionicons name="checkmark-circle" size={14} color={colors.primaryDeep} />
              </View>
              <Text style={styles.postDate}>{formattedDate}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.tagBadge, { backgroundColor: tagInfo.bg }]}>
            <Ionicons name={tagInfo.icon as any} size={12} color={tagInfo.text} style={{ marginRight: 4 }} />
            <Text style={[styles.tagText, { color: tagInfo.text }]}>{t(tagInfo.labelKey)}</Text>
          </View>
        </View>

        {/* Post Title & Text Content */}
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>

        {/* Post Image Showcase */}
        {item.image_url ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setZoomImageUrl(item.image_url)}
            style={styles.imageWrap}
          >
            <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
            <View style={styles.zoomIconBadge}>
              <Ionicons name="expand-outline" size={14} color={colors.white} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* AI Specialist Badge */}
        {(item.ask_ai || item.tag === 'disease') && (
          <View style={styles.aiBadgeBanner}>
            <Ionicons name="sparkles" size={15} color={colors.primaryDeep} />
            <Text style={styles.aiBadgeText}>{t('community.aiRequested')}</Text>
          </View>
        )}

        {/* Social Card Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.actionBtn, item.is_liked_by_me && styles.actionBtnLiked]}
            onPress={() => handleToggleLike(item.post_id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.is_liked_by_me ? 'heart' : 'heart-outline'}
              size={18}
              color={item.is_liked_by_me ? colors.red : colors.muted}
            />
            <Text style={[styles.actionText, item.is_liked_by_me && { color: colors.red, fontFamily: fonts.sansBold }]}>
              {item.like_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('PostDetail', { postId: item.post_id })}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={17} color={colors.muted} />
            <Text style={styles.actionText}>{item.comment_count}</Text>
          </TouchableOpacity>

          {!!userId && (item.user_id === userId || roles?.includes('admin')) && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDeletePost(item.post_id)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={17} color={colors.red} />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />
          <View style={styles.readMorePill}>
            <Text style={styles.readMoreText}>Oku</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primaryDeep} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* App Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('community.title')}</Text>
          <Text style={styles.headerSub}>{t('community.sub')}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerCreateBtn}
          onPress={() => navigation.navigate('CreatePost')}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={18} color={colors.primaryDeep} />
          <Text style={styles.headerCreateBtnText}>Paylaş</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TAG_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.xs }}
          renderItem={({ item }) => {
            const isSelected = selectedTag === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => handleTagSelect(item.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={isSelected ? colors.white : colors.muted}
                />
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Main Social Content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.post_id.toString()}
          renderItem={renderPostItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="leaf-outline" size={48} color={colors.muted2} />
              <Text style={styles.emptyTitle}>{t('community.emptyTitle')}</Text>
              <Text style={styles.emptySub}>{t('community.emptySub')}</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fabWrap}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('CreatePost')}
      >
        <LinearGradient colors={['#1DAA63', '#178A50']} style={styles.fab}>
          <Ionicons name="add" size={26} color="#ffffff" />
          <Text style={styles.fabText}>Gönderi Paylaş</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Full-Screen Image Zoom Modal */}
      <Modal visible={zoomImageUrl !== null} transparent animationType="fade" onRequestClose={() => setZoomImageUrl(null)}>
        <View style={styles.zoomModalWrap}>
          {zoomImageUrl && (
            <TouchableOpacity style={styles.zoomModalWrap} activeOpacity={1} onPress={() => setZoomImageUrl(null)}>
              <Image source={{ uri: zoomImageUrl }} style={styles.zoomImage} resizeMode="contain" />
              <TouchableOpacity style={styles.zoomCloseBtn} onPress={() => setZoomImageUrl(null)}>
                <Ionicons name="close" size={22} color={colors.white} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 1 },
  headerCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  headerCreateBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.primaryDeep },
  filterBar: { paddingVertical: spacing.sm, backgroundColor: colors.bg },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  filterPillActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  filterText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink },
  filterTextActive: { color: '#ffffff', fontFamily: fonts.sansBold },
  listContent: { padding: spacing.lg, paddingBottom: 110, gap: spacing.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 18, color: colors.primaryDeep },
  headerTextWrap: { flex: 1, marginLeft: spacing.xs },
  authorName: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink },
  postDate: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 1 },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  tagText: { fontFamily: fonts.sansBold, fontSize: 11 },
  postTitle: { fontFamily: fonts.display, fontSize: 16.5, color: colors.ink, marginBottom: 6, marginTop: spacing.xs },
  postContent: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginBottom: spacing.md },
  imageWrap: { position: 'relative', marginBottom: spacing.md, borderRadius: radius.md, overflow: 'hidden' },
  postImage: { width: '100%', height: 200, borderRadius: radius.md },
  zoomIconBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBadgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  aiBadgeText: { fontFamily: fonts.sansSemi, fontSize: 12, color: colors.primaryDeep },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  actionBtnLiked: { backgroundColor: '#fbe4e8' },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink },
  readMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  readMoreText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.primaryDeep },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 },
  fabWrap: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    borderRadius: radius.full,
    ...shadow.glow,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  fabText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white },
  zoomModalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: { width: '100%', height: '80%' },
  zoomCloseBtn: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

