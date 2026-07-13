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
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface AppUser {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

const ALL_ROLES = ['admin', 'seller', 'customer'] as const;
const roleLabels: Record<string, string> = { admin: 'Admin', seller: 'Satıcı', customer: 'Müşteri' };

export default function UserManagementScreen() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<AppUser[]>('/admin/users');
      setUsers(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Kullanıcılar yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleRole = async (user: AppUser, role: string) => {
    const hasRole = user.roles.includes(role);
    const key = `${user.user_id}-${role}`;
    setBusyKey(key);
    try {
      const endpoint = hasRole ? '/admin/remove-role' : '/admin/assign-role';
      await apiClient.post(endpoint, { user_id: user.user_id, role_name: role });
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === user.user_id
            ? { ...u, roles: hasRole ? u.roles.filter((r) => r !== role) : [...u.roles, role] }
            : u
        )
      );
    } catch (err: any) {
      Alert.alert('İşlem başarısız', err?.response?.data?.detail ?? 'Rol güncellenemedi.');
    } finally {
      setBusyKey(null);
    }
  };

  const renderUser = ({ item }: { item: AppUser }) => {
    const fullName = `${item.first_name} ${item.last_name}`.trim() || 'İsimsiz kullanıcı';
    return (
      <View style={styles.card}>
        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <View style={styles.chipRow}>
          {ALL_ROLES.map((role) => {
            const active = item.roles.includes(role);
            const key = `${item.user_id}-${role}`;
            return (
              <TouchableOpacity
                key={role}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                onPress={() => toggleRole(item, role)}
                disabled={busyKey === key}
                activeOpacity={0.7}
              >
                {busyKey === key ? (
                  <ActivityIndicator size="small" color={active ? colors.white : colors.muted} />
                ) : (
                  <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                    {active ? '✓ ' : '+ '}
                    {roleLabels[role]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kullanıcı Yönetimi</Text>
        <Text style={styles.headerSub}>Rol atamak/kaldırmak için etikete dokun</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUsers} activeOpacity={0.85}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.user_id)}
          contentContainerStyle={styles.list}
          renderItem={renderUser}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadUsers();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz kullanıcı yok.</Text>}
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
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  email: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.buttonPrimary },
  chipInactive: { backgroundColor: badgeColors.primary.bg },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11.5 },
  chipTextActive: { color: colors.white },
  chipTextInactive: { color: badgeColors.primary.text },
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
