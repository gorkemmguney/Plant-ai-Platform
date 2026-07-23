import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { Alert } from 'react-native';

interface Comment {
  comment_id: number;
  post_id: number;
  user_id: number | null;
  author_name: string;
  content: string;
  is_ai_reply: boolean;
  created_at: string;
}

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
}

export default function PostDetailScreen({ route, navigation }: any) {
  const { postId } = route.params;
  const { userId, roles } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const handleDeletePost = () => {
    Alert.alert(
      'Gönderiyi Sil',
      'Bu gönderiyi topluluktan tamamen silmek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/community/posts/${postId}`);
              Alert.alert('Silindi', 'Gönderiniz başarıyla silindi.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Hata', 'Gönderi silinirken bir hata oluştu.');
            }
          },
        },
      ]
    );
  };

  const loadData = useCallback(async () => {
    try {
      // Fetch list of posts to find current post (or fetch single post)
      const { data: postsData } = await apiClient.get<Post[]>('/community/posts');
      const found = postsData.find((p) => p.post_id === postId);
      if (found) setPost(found);

      const { data: commentsData } = await apiClient.get<Comment[]>(`/community/posts/${postId}/comments`);
      setComments(commentsData);
    } catch (err) {
      console.log('[PostDetail] Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleLike = async () => {
    if (!post) return;

    setPost((prev) =>
      prev
        ? {
            ...prev,
            is_liked_by_me: !prev.is_liked_by_me,
            like_count: !prev.is_liked_by_me ? prev.like_count + 1 : Math.max(0, prev.like_count - 1),
          }
        : null
    );

    try {
      await apiClient.post(`/community/posts/${postId}/like`);
    } catch (err) {
      console.log('[PostDetail] Like error:', err);
      loadData();
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;

    const textToSend = commentText.trim();
    setCommentText('');
    setSending(true);

    try {
      const { data: newComment } = await apiClient.post<Comment>(`/community/posts/${postId}/comments`, {
        content: textToSend,
      });
      setComments((prev) => [...prev, newComment]);
      if (post) {
        setPost({ ...post, comment_count: post.comment_count + 1 });
      }
    } catch (err) {
      console.log('[PostDetail] Add comment error:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading || !post) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const formattedDate = new Date(post.created_at).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {post.title}
        </Text>
        {!!userId && (post.user_id === userId || roles?.includes('admin')) && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePost} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={20} color={colors.red} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.comment_id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.postCard}>
            {/* Post Author info */}
            <View style={styles.authorRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{post.author_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.authorName}>{post.author_name}</Text>
                <Text style={styles.postDate}>{formattedDate}</Text>
              </View>
            </View>

            {/* Title & Body */}
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postContent}>{post.content}</Text>

            {/* Post Image */}
            {post.image_url ? (
              <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
            ) : null}

            {/* Actions Bar */}
            <View style={styles.actionsBar}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleToggleLike} activeOpacity={0.7}>
                <Ionicons
                  name={post.is_liked_by_me ? 'heart' : 'heart-outline'}
                  size={22}
                  color={post.is_liked_by_me ? colors.red : colors.muted}
                />
                <Text style={[styles.actionText, post.is_liked_by_me && { color: colors.red }]}>
                  {post.like_count} Beğeni
                </Text>
              </TouchableOpacity>

              <View style={styles.actionBtn}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.muted} />
                <Text style={styles.actionText}>{post.comment_count} Yorum</Text>
              </View>
            </View>

            <Text style={styles.commentsSectionTitle}>Yorumlar ({comments.length})</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isAI = item.is_ai_reply;
          const commentDate = new Date(item.created_at).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View style={[styles.commentCard, isAI && styles.aiCommentCard]}>
              <View style={styles.commentHeader}>
                <View style={[styles.commentAvatar, isAI && styles.aiAvatar]}>
                  {isAI ? (
                    <Ionicons name="sparkles" size={16} color="#ffffff" />
                  ) : (
                    <Text style={styles.commentAvatarText}>{item.author_name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.commentAuthor, isAI && styles.aiAuthor]}>{item.author_name}</Text>
                  <Text style={styles.commentDate}>{commentDate}</Text>
                </View>
                {isAI && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI Uzmanı</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.commentBody, isAI && styles.aiCommentBody]}>{item.content}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Text style={styles.emptyCommentsText}>Henüz yorum yapılmamış. İlk yorumu sen yaz!</Text>
          </View>
        }
      />

      {/* Write Comment Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Yorumunuzu yazın..."
          placeholderTextColor={colors.muted2}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
          onPress={handleSendComment}
          disabled={!commentText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="send" size={18} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  headerTitle: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 16, color: colors.ink },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbe4e8',
  },
  listContent: { padding: spacing.lg, paddingBottom: 20 },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.primaryDeep },
  authorName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  postDate: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  postTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink, marginBottom: 8 },
  postContent: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, lineHeight: 22, marginBottom: spacing.md },
  postImage: { width: '100%', height: 220, borderRadius: radius.md, marginBottom: spacing.md },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  commentsSectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, marginTop: spacing.xs },
  commentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  aiCommentCard: {
    backgroundColor: '#f0fdf4',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: spacing.sm },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatar: { backgroundColor: colors.primary },
  commentAvatarText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  commentAuthor: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  aiAuthor: { color: colors.primaryDeep },
  commentDate: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted },
  aiBadge: { backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  aiBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.primaryDeep },
  commentBody: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 18 },
  aiCommentBody: { color: colors.secondaryDeep, fontFamily: fonts.sansMedium },
  emptyComments: { padding: spacing.xl, alignItems: 'center' },
  emptyCommentsText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.muted2 },
});
