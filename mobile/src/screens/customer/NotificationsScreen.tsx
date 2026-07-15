import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Notification {
  notification_id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Notification[]>('/notifications');
      setItems(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Bildirimler yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (item: Notification) => {
    if (item.is_read) return;
    // Önce ekranda okundu yap (hızlı geri bildirim)
    setItems((prev) =>
      prev.map((n) => (n.notification_id === item.notification_id ? { ...n, is_read: true } : n))
    );
    try {
      await apiClient.post(`/notifications/${item.notification_id}/read`);
    } catch {
      // Hata olursa geri al
      setItems((prev) =>
        prev.map((n) => (n.notification_id === item.notification_id ? { ...n, is_read: false } : n))
      );
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const date = new Date(item.created_at);
    const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR');
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.cardUnread]}
        onPress={() => markRead(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <Text style={styles.title}>{item.title}</Text>
          {!item.is_read && <View style={styles.dot} />}
        </View>
        <Text style={styles.message}>{item.message}</Text>
        {!!dateText && <Text style={styles.date}>{dateText}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        <Text style={styles.headerSub}>Okumak için dokun</Text>
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
          data={items}
          keyExtractor={(item) => String(item.notification_id)}
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
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz bildirimin yok.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginLeft: spacing.sm },
  message: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 },
  date: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted2, marginTop: spacing.sm },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
});
