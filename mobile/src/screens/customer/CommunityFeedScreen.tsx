import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Post {
  post_id: number;
  user_id: number;
  author_name: str;
  title: string;
  content: string;
  image_url: string | null;
  tag: string;
  ask_ai: bool;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
  created_at: string;
  updated_at: string;
}

const TAG_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'general', label: '🌿 Genel' },
  { key: 'care', label: '💧 Bakım Önerisi' },
  { key: 'disease', label: '🩺 AI Teşhis / Hastalık' },
  { key: 'swap', label: '🔄 Bitki Takası' },
];

const TAG_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  general: { label: 'Genel', bg: colors.primarySoft, text: colors.primaryDeep },
  care: { label: 'Bakım', bg: '#e0f2fe', text: '#0369a1' },
  disease: { label: 'Hastalık', bg: '#fee2e2', text: '#b91c1c' },
  swap: { label: 'Takas', bg: '#fef3c7', text: '#b45309' },
};

export default function CommunityFeedScreen({ navigation }: any) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState('all');

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
    // Optimistic update
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
      loadPosts(); // Rollback if failed
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
        {/* Post Header */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{item.author_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.authorName}>{item.author_name}</Text>
            <Text style={styles.postDate}>{formattedDate}</Text>
          </View>
          <View style={[styles.tagBadge, { backgroundColor: tagInfo.bg }]}>
            <Text style={[styles.tagText, { color: tagInfo.text }]}>{tagInfo.label}</Text>
          </View>
        </View>

        {/* Post Title & Content */}
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postContent} numberOfLines={4}>
          {item.content}
        </Text>

        {/* Optional Image */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
        ) : null}

        {/* AI Specialist Badge if Ask AI is active */}
        {(item.ask_ai || item.tag === 'disease') && (
          <View style={styles.aiBadgeBanner}>
            <Ionicons name="sparkles" size={14} color={colors.primaryDeep} />
            <Text style={styles.aiBadgeText}>AI Uzmanı Danışmanlığı İstendi</Text>
          </View>
        )}

        {/* Post Footer Actions */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleToggleLike(item.post_id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.is_liked_by_me ? 'heart' : 'heart-outline'}
              size={20}
              color={item.is_liked_by_me ? colors.red : colors.muted}
            />
            <Text style={[styles.actionText, item.is_liked_by_me && { color: colors.red }]}>
              {item.like_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('PostDetail', { postId: item.post_id })}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={19} color={colors.muted} />
            <Text style={styles.actionText}>{item.comment_count}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
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
        <View>
          <Text style={styles.headerTitle}>Topluluk & Forum 🌿</Text>
          <Text style={styles.headerSub}>Bitki severlerle paylaş, AI Uzmanına sor</Text>
        </View>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TAG_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          renderItem={({ item }) => {
            const isSelected = selectedTag === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => handleTagSelect(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Main Content */}
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
              <Text style={styles.emptyTitle}>Henüz gönderi yok</Text>
              <Text style={styles.emptySub}>
                Bu kategoride henüz gönderi oluşturulmamış. İlk paylaşımı sen yap!
              </Text>
            </View>
          }
        />
      )}

      {/* FAB: Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CreatePost')}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
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
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  filterBar: { paddingVertical: spacing.md, backgroundColor: colors.bg },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  filterTextActive: { color: '#ffffff', fontFamily: fonts.sansBold },
  listContent: { padding: spacing.lg, paddingBottom: 100, gap: spacing.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryDeep },
  headerTextWrap: { flex: 1 },
  authorName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  postDate: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  tagBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  tagText: { fontFamily: fonts.sansBold, fontSize: 11 },
  postTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.ink, marginBottom: 6 },
  postContent: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginBottom: spacing.md },
  postImage: { width: '100%', height: 180, borderRadius: radius.sm, marginBottom: spacing.md },
  aiBadgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    gap: 6,
  },
  aiBadgeText: { fontFamily: fonts.sansSemi, fontSize: 12, color: colors.primaryDeep },
  cardFooter: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSoft, gap: spacing.xl },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink, marginTop: spacing.md },
  emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glow,
  },
});
