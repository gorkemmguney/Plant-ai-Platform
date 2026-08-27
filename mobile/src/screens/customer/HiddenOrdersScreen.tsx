import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Order {
  cust_ord_id: number;
  total_price: string | number;
  order_date: string;
  gnl_st_id: number;
  is_hidden: boolean;
  items: { quantity: number }[];
}

const statusKeys: Record<number, string> = {
  5: 'orderStatus.5',
  6: 'orderStatus.6',
  7: 'orderStatus.7',
  8: 'orderStatus.8',
  9: 'orderStatus.9',
};

export default function HiddenOrdersScreen({ navigation }: any) {
  const { t } = useI18n();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  // Bu ekrandan her çıkışta (geri tuşu, tab değişimi, başka ekrana geçiş)
  // durum tamamen sıfırlanır — ekrana her yeniden girişte şifre TEKRAR sorulur.
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setUnlocked(false);
      setPassword('');
      setOrders([]);
    });
    return unsubscribe;
  }, [navigation]);

  const loadHidden = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const { data } = await apiClient.get<Order[]>('/orders/my');
      setOrders(data.filter((o) => o.is_hidden));
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('orders.loadFailed'));
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const handleUnlock = async () => {
    if (!password) {
      Alert.alert(t('hidden.passwordRequired'), t('hidden.passwordRequiredMsg'));
      return;
    }
    setVerifying(true);
    try {
      await apiClient.post('/auth/verify-password', { password });
      setPassword('');
      setUnlocked(true);
      await loadHidden();
    } catch (err: any) {
      Alert.alert(t('hidden.verifyFailed'), err?.response?.data?.detail ?? t('hidden.wrongPassword'));
    } finally {
      setVerifying(false);
    }
  };

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    try {
      await apiClient.patch(`/orders/${id}/visibility`, { is_hidden: false });
      setOrders((prev) => prev.filter((o) => o.cust_ord_id !== id));
    } catch (err: any) {
      Alert.alert(t('orders.actionFailed'), err?.response?.data?.detail ?? t('hidden.restoreFailed'));
    } finally {
      setRestoringId(null);
    }
  };

  if (!unlocked) {
    return (
      <View style={styles.screen}>
        <View style={styles.lockWrap}>
          <View style={styles.lockIconWrap}>
            <Ionicons name="lock-closed" size={28} color={colors.primaryDeep} />
          </View>
          <Text style={styles.lockTitle}>{t('hidden.authTitle')}</Text>
          <Text style={styles.lockSub}>{t('hidden.authSub')}</Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t('hidden.passwordPlaceholder')}
            placeholderTextColor={colors.muted2}
            secureTextEntry
            autoFocus
            onSubmitEditing={handleUnlock}
          />

          <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock} disabled={verifying} activeOpacity={0.85}>
            {verifying ? (
              <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
            ) : (
              <Text style={styles.unlockBtnText}>{t('hidden.verifyAndView')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('hidden.title')}</Text>
        <Text style={styles.headerSub}>{t('hidden.headerSub')}</Text>
      </View>

      {loadingOrders ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.cust_ord_id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('orders.emptyHidden')}</Text>}
          renderItem={({ item }) => {
            const date = new Date(item.order_date);
            const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR');
            const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.orderId}>{t('orders.orderPrefix')}#{item.cust_ord_id}</Text>
                  <Text style={styles.total}>₺{Number(item.total_price).toFixed(2)}</Text>
                </View>
                <Text style={styles.meta}>
                  {dateText}
                  {dateText ? ' · ' : ''}
                  {itemCount} {t('common.items')} · {statusKeys[item.gnl_st_id] ? t(statusKeys[item.gnl_st_id]) : t('orders.statusUnknown')}
                </Text>
                <TouchableOpacity
                  style={styles.restoreBtn}
                  onPress={() => handleRestore(item.cust_ord_id)}
                  disabled={restoringId === item.cust_ord_id}
                  activeOpacity={0.85}
                >
                  {restoringId === item.cust_ord_id ? (
                    <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
                  ) : (
                    <Text style={styles.restoreBtnText}>{t('orders.restore')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  total: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDeep },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 3, marginBottom: spacing.md },
  restoreBtn: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  restoreBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  lockIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  lockTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  lockSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  unlockBtn: {
    width: '100%',
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
});
