import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface ChatSession {
  ai_chat_id: number;
  created_at: string;
  last_message_at: string | null;
  preview: string | null;
  message_count: number;
}

export default function AIChatHistoryScreen({ navigation }: any) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<ChatSession[]>('/ai/chats');
      setSessions(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Sohbet geçmişi yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (session: ChatSession) => {
    Alert.alert('Sohbeti sil', 'Bu sohbet geçmişi tamamen silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/ai/chats/${session.ai_chat_id}`);
            setSessions((prev) => prev.filter((s) => s.ai_chat_id !== session.ai_chat_id));
          } catch (err: any) {
            Alert.alert('Silinemedi', err?.response?.data?.detail ?? 'Sohbet silinemedi.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ChatSession }) => {
    const date = new Date(item.last_message_at ?? item.created_at);
    const dateText = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ChatScreen', { chatId: item.ai_chat_id })}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.preview} numberOfLines={1}>
            {item.preview ?? 'Sohbet'}
          </Text>
          <Text style={styles.meta}>
            {dateText} · {item.message_count} mesaj
          </Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={colors.red} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Sohbet Geçmişi</Text>
          <Text style={styles.headerSub}>Önceki AI sohbetlerine geri dön</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.ai_chat_id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Henüz bir sohbetin yok. AI Sohbet ekranından başlayabilirsin.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted2, marginTop: 3 },
  deleteBtn: { padding: spacing.xs },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl, lineHeight: 20 },
});
