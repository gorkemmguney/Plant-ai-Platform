import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { badgeColors, colors, fonts, radius, shadow, spacing, gradients } from '../../theme/theme';

interface AppUser {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

interface AdminStats {
  total_users: number;
  total_sellers: number;
  total_analyses: number;
  total_products: number;
}

const ALL_ROLES = ['admin', 'seller', 'customer'] as const;
const roleLabelKeys: Record<string, string> = { admin: 'role.admin', seller: 'role.seller', customer: 'role.customer' };
const roleDescKeys: Record<string, string> = { admin: 'userMgmt.adminDesc', seller: 'userMgmt.sellerDesc', customer: 'userMgmt.customerDesc' };

const roleIcons: Record<string, any> = {
  admin: 'shield-checkmark',
  seller: 'storefront',
  customer: 'person',
};

const roleBadgeColors: Record<string, typeof badgeColors.primary> = {
  admin: badgeColors.amber,
  seller: badgeColors.secondary,
  customer: badgeColors.green,
};

const roleGradients: Record<string, readonly [string, string]> = {
  admin: ['#f5a524', '#dd8f24'] as const,
  seller: ['#4a4a65', '#2c2c3e'] as const,
  customer: ['#5fb88a', '#3e9c6d'] as const,
};

export default function UserManagementScreen() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Broadcast Notification States
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [aiDraftTopic, setAiDraftTopic] = useState('');
  const [draftingAi, setDraftingAi] = useState(false);

  // AI Insights States
  const [insightsVisible, setInsightsVisible] = useState(false);
  const [insightsReport, setInsightsReport] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadStats = async () => {
    try {
      const { data } = await apiClient.get<AdminStats>('/admin/stats');
      setStats(data);
    } catch (err) {
      console.log('Failed to fetch admin stats:', err);
    }
  };

  const loadUsers = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<AppUser[]>('/admin/users');
      setUsers(data);
      await loadStats();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('userMgmt.loadFailed'));
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
      
      const updatedRoles = hasRole ? user.roles.filter((r) => r !== role) : [...user.roles, role];
      
      // Update locally
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, roles: updatedRoles } : u))
      );
      
      // Update selected user state to refresh modal
      if (selectedUser && selectedUser.user_id === user.user_id) {
        setSelectedUser({ ...selectedUser, roles: updatedRoles });
      }
      
      // Reload stats
      await loadStats();
    } catch (err: any) {
      Alert.alert(t('orders.actionFailed'), err?.response?.data?.detail ?? t('userMgmt.roleUpdateFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      Alert.alert(t('common.error'), t('userMgmt.fillAll'));
      return;
    }
    setSendingBroadcast(true);
    try {
      await apiClient.post('/admin/broadcast-notification', {
        title: broadcastTitle,
        message: broadcastMessage,
      });
      Alert.alert(t('createPost.success'), t('userMgmt.broadcastSent'));
      setBroadcastVisible(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('userMgmt.broadcastFailed'));
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleAiDraft = async () => {
    if (!aiDraftTopic.trim()) {
      Alert.alert(t('common.error'), t('userMgmt.enterTopic'));
      return;
    }
    setDraftingAi(true);
    try {
      const { data } = await apiClient.post<{ title: string; message: string }>(
        '/admin/ai/draft-announcement',
        { topic: aiDraftTopic }
      );
      setBroadcastTitle(data.title);
      setBroadcastMessage(data.message);
      setAiDraftTopic('');
    } catch (err: any) {
      Alert.alert(t('userMgmt.aiError'), err?.response?.data?.detail ?? t('userMgmt.draftFailed'));
    } finally {
      setDraftingAi(false);
    }
  };

  const handleShowInsights = async () => {
    setInsightsVisible(true);
    if (insightsReport) return; // cached
    setLoadingInsights(true);
    try {
      const { data } = await apiClient.get<{ report: string }>('/admin/ai/insights');
      setInsightsReport(data.report);
    } catch (err: any) {
      setInsightsReport(t('userMgmt.insightsFailed'));
    } finally {
      setLoadingInsights(false);
    }
  };

  const getInitials = (first: string, last: string) => {
    const f = first ? first.charAt(0).toUpperCase() : '';
    const l = last ? last.charAt(0).toUpperCase() : '';
    return `${f}${l}` || '?';
  };

  const getUserGradient = (rolesList: string[]) => {
    if (rolesList.includes('admin')) return roleGradients.admin;
    if (rolesList.includes('seller')) return roleGradients.seller;
    return roleGradients.customer;
  };

  const filteredUsers = users.filter((u) => {
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    const email = u.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const renderUser = ({ item }: { item: AppUser }) => {
    const fullName = `${item.first_name} ${item.last_name}`.trim() || t('approvals.unnamedUser');
    const initials = getInitials(item.first_name, item.last_name);
    const grad = getUserGradient(item.roles);

    return (
      <TouchableOpacity
        style={styles.userCard}
        activeOpacity={0.85}
        onPress={() => setSelectedUser(item)}
      >
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>

          <View style={styles.userInfo}>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
          </View>

          <View style={styles.rightArrowBox}>
            <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterLabel}>{t('userMgmt.activeRoles')}</Text>
          <View style={styles.miniBadgeRow}>
            {item.roles.map((role) => {
              const badgeStyle = roleBadgeColors[role] || badgeColors.primary;
              return (
                <View key={role} style={[styles.miniBadge, { backgroundColor: badgeStyle.bg }]}>
                  <Ionicons name={roleIcons[role]} size={11} color={badgeStyle.text} style={{ marginRight: 3 }} />
                  <Text style={[styles.miniBadgeText, { color: badgeStyle.text }]}>{roleLabelKeys[role] ? t(roleLabelKeys[role]) : role}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('userMgmt.title')}</Text>
            <Text style={styles.headerSub}>{t('userMgmt.sub')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity 
              style={styles.megaphoneButton}
              onPress={handleShowInsights}
              activeOpacity={0.8}
            >
              <Ionicons name="bar-chart-outline" size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.megaphoneButton}
              onPress={() => setBroadcastVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="megaphone-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: spacing.sm }} />
          <TextInput
            placeholder={t('userMgmt.searchPlaceholder')}
            placeholderTextColor={colors.muted2}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats Horizontal Shelf */}
      {stats && (
        <View style={styles.statsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
          >
            <View style={[styles.statCard, { backgroundColor: '#e3f3ea' }]}>
              <View style={[styles.statIconBox, { backgroundColor: '#3d8f6620' }]}>
                <Ionicons name="people" size={16} color="#3d8f66" />
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[styles.statNumber, { color: '#3d8f66' }]}>{stats.total_users}</Text>
                <Text style={[styles.statLabel, { color: '#3d8f6680' }]}>{t('userMgmt.totalUsers')}</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#f5efff' }]}>
              <View style={[styles.statIconBox, { backgroundColor: '#7c4dff20' }]}>
                <Ionicons name="storefront" size={16} color="#7c4dff" />
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[styles.statNumber, { color: '#7c4dff' }]}>{stats.total_sellers}</Text>
                <Text style={[styles.statLabel, { color: '#7c4dff80' }]}>{t('userMgmt.stores')}</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#eef6fc' }]}>
              <View style={[styles.statIconBox, { backgroundColor: '#0288d120' }]}>
                <Ionicons name="analytics" size={16} color="#0288d1" />
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[styles.statNumber, { color: '#0288d1' }]}>{stats.total_analyses}</Text>
                <Text style={[styles.statLabel, { color: '#0288d180' }]}>{t('userMgmt.analyses')}</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#fdf7e7' }]}>
              <View style={[styles.statIconBox, { backgroundColor: '#b3711a20' }]}>
                <Ionicons name="leaf" size={16} color="#b3711a" />
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[styles.statNumber, { color: '#b3711a' }]}>{stats.total_products}</Text>
                <Text style={[styles.statLabel, { color: '#b3711a80' }]}>{t('userMgmt.products')}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUsers} activeOpacity={0.85}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>{t('userMgmt.noUsers')}</Text>
            </View>
          }
        />
      )}

      {/* Broadcast Announcement Modal */}
      <Modal
        visible={broadcastVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBroadcastVisible(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="megaphone" size={22} color={colors.primaryDeep} style={{ marginRight: spacing.sm }} />
                <Text style={styles.alertTitle}>{t('userMgmt.broadcastTitle')}</Text>
              </View>
              <TouchableOpacity 
                style={styles.alertCloseButton}
                onPress={() => {
                  setBroadcastVisible(false);
                  setBroadcastTitle('');
                  setBroadcastMessage('');
                }}
                disabled={sendingBroadcast}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <Text style={styles.alertSub}>{t('userMgmt.broadcastSub')}</Text>

            {/* AI Wizard Section */}
            <View style={styles.aiWizardBox}>
              <View style={styles.aiWizardHeader}>
                <Ionicons name="sparkles" size={15} color="#7c4dff" />
                <Text style={styles.aiWizardTitle}>{t('userMgmt.aiAutoWrite')}</Text>
              </View>
              <View style={styles.aiWizardRow}>
                <TextInput
                  placeholder={t('userMgmt.topicPlaceholder')}
                  placeholderTextColor={colors.muted2}
                  value={aiDraftTopic}
                  onChangeText={setAiDraftTopic}
                  style={styles.aiWizardInput}
                  editable={!draftingAi}
                />
                <TouchableOpacity
                  style={[styles.aiWizardButton, draftingAi && { opacity: 0.6 }]}
                  onPress={handleAiDraft}
                  disabled={draftingAi}
                  activeOpacity={0.8}
                >
                  {draftingAi ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name="sparkles" size={16} color={colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              placeholder={t('userMgmt.announcementTitle')}
              placeholderTextColor={colors.muted2}
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              style={styles.alertInput}
            />

            <TextInput
              placeholder={t('userMgmt.announcementMsg')}
              placeholderTextColor={colors.muted2}
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              style={[styles.alertInput, { height: 100, textAlignVertical: 'top', paddingTop: 10 }]}
              multiline
            />

            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={styles.alertCancel}
                onPress={() => {
                  setBroadcastVisible(false);
                  setBroadcastTitle('');
                  setBroadcastMessage('');
                }}
                disabled={sendingBroadcast}
              >
                <Text style={styles.alertCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertConfirm}
                onPress={handleSendBroadcast}
                disabled={sendingBroadcast}
              >
                {sendingBroadcast ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.alertConfirmText}>{t('common.submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Insights Modal */}
      <Modal
        visible={insightsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInsightsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setInsightsVisible(false)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalDragHandle} />
            <View style={[styles.alertHeader, { marginBottom: spacing.md }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <LinearGradient colors={['#7c4dff', '#5c35cc']} style={styles.insightsIconBox}>
                  <Ionicons name="bar-chart" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[styles.alertTitle, { marginLeft: spacing.sm }]}>{t('userMgmt.aiPlatformAnalysis')}</Text>
              </View>
              <TouchableOpacity style={styles.alertCloseButton} onPress={() => setInsightsVisible(false)} activeOpacity={0.8}>
                <Ionicons name="close" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {loadingInsights ? (
              <View style={{ paddingVertical: 40, alignItems: 'center', gap: spacing.md }}>
                <ActivityIndicator size="large" color="#7c4dff" />
                <Text style={styles.alertSub}>{t('aiDiagnosis.analyzing')}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <View style={styles.insightsCard}>
                  <Text style={styles.insightsText}>{insightsReport}</Text>
                </View>
                <TouchableOpacity
                  style={styles.insightsRefreshButton}
                  onPress={() => { setInsightsReport(null); handleShowInsights(); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={14} color="#7c4dff" style={{ marginRight: 6 }} />
                  <Text style={styles.insightsRefreshText}>{t('userMgmt.refreshReport')}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>


      <Modal
        visible={selectedUser !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setSelectedUser(null)}
          />
          
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalDragHandle} />
              {selectedUser && (
                <View style={styles.modalUserRow}>
                  <LinearGradient
                    colors={getUserGradient(selectedUser.roles)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalAvatar}
                  >
                    <Text style={styles.modalAvatarText}>
                      {getInitials(selectedUser.first_name, selectedUser.last_name)}
                    </Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalName}>{`${selectedUser.first_name} ${selectedUser.last_name}`}</Text>
                    <Text style={styles.modalEmail}>{selectedUser.email}</Text>
                  </View>
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedUser(null)}>
                    <Ionicons name="close" size={20} color={colors.ink} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={styles.modalSectionTitle}>{t('userMgmt.roleLevels')}</Text>

            <View style={styles.rolesContainer}>
              {selectedUser &&
                ALL_ROLES.map((role) => {
                  const active = selectedUser.roles.includes(role);
                  const key = `${selectedUser.user_id}-${role}`;
                  const badgeStyle = roleBadgeColors[role] || badgeColors.primary;
                  const isBusy = busyKey === key;

                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleSelectCard,
                        active ? { borderColor: badgeStyle.text, backgroundColor: badgeStyle.bg + '15' } : null,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => toggleRole(selectedUser, role)}
                      disabled={isBusy}
                    >
                      <View style={[styles.roleIconBox, active ? { backgroundColor: badgeStyle.bg } : null]}>
                        <Ionicons
                          name={roleIcons[role]}
                          size={18}
                          color={active ? badgeStyle.text : colors.muted}
                        />
                      </View>
                      
                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <Text style={[styles.roleNameText, active ? { color: badgeStyle.text } : null]}>
                          {roleLabelKeys[role] ? t(roleLabelKeys[role]) : role} {t('userMgmt.permission')}
                        </Text>
                        <Text style={styles.roleDescText}>
                          {roleDescKeys[role] ? t(roleDescKeys[role]) : ''}
                        </Text>
                      </View>

                      {isBusy ? (
                        <ActivityIndicator size="small" color={badgeStyle.text} />
                      ) : (
                        <View
                          style={[
                            styles.checkbox,
                            active
                              ? { backgroundColor: badgeStyle.text, borderColor: badgeStyle.text }
                              : null,
                          ]}
                        >
                          {active && <Ionicons name="checkmark" size={12} color={colors.white} />}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: 38,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  headerSub: { fontFamily: fonts.sans, fontSize: 11.5, color: '#c9c9d6', marginTop: 2 },
  megaphoneButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: -20,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
  },
  statsContainer: {
    marginTop: spacing.md,
  },
  statsScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    ...shadow.sm,
    minWidth: 130,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
  },
  statLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.white,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 2,
  },
  name: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink },
  email: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  rightArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgAlt + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardFooterLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.muted2,
  },
  miniBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  miniBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 9.5,
  },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  retryText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  emptyEmoji: {
    fontSize: 40,
    textAlign: 'center',
  },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center' },

  // Broadcast Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,17,20,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  alertBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    width: '100%',
    ...shadow.md,
    gap: spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  alertCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    color: colors.ink,
  },
  alertSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  alertInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.bgAlt + '40',
  },
  alertButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  alertCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  alertCancelText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.muted,
  },
  alertConfirm: {
    flex: 1,
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  alertConfirmText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.white,
  },

  // Bottom Sheet Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,17,20,0.4)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    ...shadow.md,
  },
  modalHeader: {
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 16,
  },
  modalUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: {
    fontFamily: fonts.sansBold,
    fontSize: 14.5,
    color: colors.white,
  },
  modalName: {
    fontFamily: fonts.sansBold,
    fontSize: 15.5,
    color: colors.ink,
  },
  modalEmail: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.muted,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  rolesContainer: {
    gap: spacing.md,
  },
  roleSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleNameText: {
    fontFamily: fonts.sansBold,
    fontSize: 13.5,
    color: colors.ink,
  },
  roleDescText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // AI Wizard Styles
  aiWizardBox: {
    backgroundColor: '#f5efff',
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#d8c8ff',
    gap: spacing.sm,
  },
  aiWizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiWizardTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: '#7c4dff',
  },
  aiWizardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  aiWizardInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d8c8ff',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 38,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  aiWizardButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: '#7c4dff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // AI Insights Modal Styles
  insightsIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsCard: {
    backgroundColor: '#f5efff',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#d8c8ff',
    marginBottom: spacing.md,
  },
  insightsText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.ink,
    lineHeight: 22,
  },
  insightsRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d8c8ff',
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  insightsRefreshText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: '#7c4dff',
  },
});

