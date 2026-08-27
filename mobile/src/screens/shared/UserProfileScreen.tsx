import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import {
  fetchMyProfile,
  fetchUserLikedPosts,
  fetchUserPlants,
  fetchUserPosts,
  GenericPartyProfile,
  updateMyProfile,
  UserPlantSummary,
  UserPostSummary,
} from '../../services/profileService';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

export default function UserProfileScreen({ navigation }: any) {
  const { t } = useI18n();
  const { userId, firstName: authFirstName, lastName: authLastName, firebaseUser, roles, refreshProfile: refreshAuth } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<GenericPartyProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPostSummary[]>([]);
  const [userPlants, setUserPlants] = useState<UserPlantSummary[]>([]);
  const [userLikedPosts, setUserLikedPosts] = useState<UserPostSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'plants' | 'liked'>('posts');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await fetchMyProfile();
      setProfile(data);

      const targetId = data.user_id;

      const [posts, plants, liked] = await Promise.all([
        fetchUserPosts(targetId),
        fetchUserPlants(targetId),
        fetchUserLikedPosts(targetId),
      ]);

      setUserPosts(posts);
      setUserPlants(plants);
      setUserLikedPosts(liked);

      if (data.role === 'seller' && data.seller_profile) {
        const sp = data.seller_profile;
        setFirstName(sp.first_name || '');
        setLastName(sp.last_name || '');
        setStoreName(sp.store_name || '');
        setBio(sp.bio || '');
        setCity(sp.city || '');
        setAvatarUrl(sp.avatar_url || '');
        setCoverImageUrl(sp.cover_image_url || '');
      } else if (data.customer_profile) {
        const cp = data.customer_profile;
        setFirstName(cp.first_name || '');
        setLastName(cp.last_name || '');
        setBio(cp.bio || '');
        setCity(cp.city || '');
        setAvatarUrl(cp.avatar_url || '');
        setCoverImageUrl(cp.cover_image_url || '');
      }
    } catch (err) {
      console.log('[UserProfileScreen] fetch error:', err);
      const targetId = Number(userId) || 0;
      if (targetId) {
        try {
          const [posts, plants, liked] = await Promise.all([
            fetchUserPosts(targetId),
            fetchUserPlants(targetId),
            fetchUserLikedPosts(targetId),
          ]);
          setUserPosts(posts);
          setUserPlants(plants);
          setUserLikedPosts(liked);
        } catch {}
      }

      // Fallback profile if Railway backend endpoint is 404
      const isSellerRole = roles?.includes('seller');
      const fallback: GenericPartyProfile = {
        user_id: targetId,
        role: isSellerRole ? 'seller' : 'customer',
        customer_profile: !isSellerRole
          ? {
              user_id: targetId,
              first_name: authFirstName || 'Müşteri',
              last_name: authLastName || '',
              email: firebaseUser?.email || '',
              points: 0,
              badges: ['PLANT_LOVER'],
              followers_count: 0,
              following_count: 0,
              is_followed_by_me: false,
              plant_count: 0,
              post_count: 0,
              order_count: 0,
              created_at: new Date().toISOString(),
              party_characteristics: [],
            }
          : undefined,
        seller_profile: isSellerRole
          ? {
              user_id: targetId,
              first_name: authFirstName || 'Satıcı',
              last_name: authLastName || '',
              email: firebaseUser?.email || '',
              seller_status: 'verified',
              followers_count: 0,
              following_count: 0,
              is_followed_by_me: false,
              rating_score: 5.0,
              review_count: 0,
              product_count: 0,
              badges: ['VERIFIED_SELLER'],
              created_at: new Date().toISOString(),
              party_characteristics: [],
            }
          : undefined,
      };
      setProfile(fallback);
      setFirstName(authFirstName || '');
      setLastName(authLastName || '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(t('common.error'), 'Ad ve Soyad boş bırakılamaz.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        store_name: storeName.trim() || undefined,
        bio: bio.trim() || undefined,
        city: city.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        cover_image_url: coverImageUrl.trim() || undefined,
      });
      setProfile(updated);
      await refreshAuth();
      setEditModalVisible(false);
      Alert.alert(t('common.ok'), 'Profiliniz başarıyla güncellendi ✨');
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isSeller = profile?.role === 'seller';
  const sp = profile?.seller_profile;
  const cp = profile?.customer_profile;

  const displayName = isSeller
    ? sp?.store_name || `${sp?.first_name} ${sp?.last_name}`
    : `${cp?.first_name} ${cp?.last_name}`;

  const currentAvatar = isSeller ? sp?.avatar_url : cp?.avatar_url;
  const currentCover = isSeller ? sp?.cover_image_url : cp?.cover_image_url;
  const currentBio = isSeller ? sp?.bio : cp?.bio;
  const currentCity = isSeller ? sp?.city : cp?.city;
  const badges = isSeller ? sp?.badges : cp?.badges;
  const followersCount = isSeller ? sp?.followers_count : cp?.followers_count;
  const followingCount = isSeller ? sp?.following_count : cp?.following_count;

  const badgeLabels: Record<string, { label: string; icon: string; color: string }> = {
    VERIFIED_SELLER: { label: 'Doğrulanmış Satıcı', icon: 'checkmark-circle', color: '#16a34a' },
    FAST_SHIPPER: { label: 'Hızlı Kargo', icon: 'flash', color: '#eab308' },
    TOP_RATED_SELLER: { label: 'Yüksek Memnuniyet', icon: 'star', color: '#f59e0b' },
    PREMIUM_STORE: { label: 'Preseptil Mağaza', icon: 'ribbon', color: '#8b5cf6' },
    PLANT_LOVER: { label: 'Bitki Tutkunu', icon: 'leaf', color: '#22c55e' },
    PLANT_DOCTOR: { label: 'Bitki Doktoru', icon: 'medkit', color: '#06b6d4' },
    COMMUNITY_STAR: { label: 'Topluluk Yıldızı', icon: 'sparkles', color: '#ec4899' },
    GOLD_MEMBER: { label: 'Altın Üye', icon: 'trophy', color: '#f59e0b' },
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Cover Banner */}
        <View style={styles.coverWrap}>
          {currentCover ? (
            <Image source={{ uri: currentCover }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}

          {/* Top Floating Buttons */}
          <View style={[styles.coverTopBar, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity style={styles.floatingBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.floatingBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info Header */}
        <View style={styles.headerInfoCard}>
          <View style={styles.avatarOverWrap}>
            {currentAvatar ? (
              <Image source={{ uri: currentAvatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name={isSeller ? 'storefront' : 'person'} size={40} color={colors.primaryDeep} />
              </View>
            )}
            {isSeller && (
              <View style={styles.sellerDot}>
                <Ionicons name="checkmark-sharp" size={12} color={colors.white} />
              </View>
            )}
          </View>

          <Text style={styles.profileName}>{displayName}</Text>

          <View style={styles.roleBadgeRow}>
            <Ionicons name={isSeller ? 'storefront-outline' : 'leaf-outline'} size={14} color={colors.primaryDeep} />
            <Text style={styles.roleBadgeText}>
              {isSeller ? `Satıcı (${sp?.seller_status === 'verified' ? 'Onaylı' : 'Beklemede'})` : 'Bitki Sever'}
            </Text>
          </View>

          {currentCity && (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text style={styles.locText}>{currentCity}</Text>
            </View>
          )}

          {currentBio && <Text style={styles.bioText}>{currentBio}</Text>}

          {/* Social Counter Bar */}
          <View style={styles.socialBar}>
            <View style={styles.socialStat}>
              <Text style={styles.statNum}>{userPosts.length}</Text>
              <Text style={styles.statLabel}>Gönderi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.socialStat}>
              <Text style={styles.statNum}>{followersCount || 0}</Text>
              <Text style={styles.statLabel}>Takipçi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.socialStat}>
              <Text style={styles.statNum}>{followingCount || 0}</Text>
              <Text style={styles.statLabel}>Takip Edilen</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.socialStat}>
              <Text style={styles.statNum}>{userPlants.length}</Text>
              <Text style={styles.statLabel}>Bitki</Text>
            </View>
          </View>

          {/* Badges Chips */}
          {badges && badges.length > 0 && (
            <View style={styles.badgesWrap}>
              {badges.map((bKey) => {
                const bInfo = badgeLabels[bKey] || { label: bKey, icon: 'shield-checkmark', color: colors.primaryDeep };
                return (
                  <View key={bKey} style={[styles.badgeChip, { borderColor: bInfo.color }]}>
                    <Ionicons name={bInfo.icon as any} size={14} color={bInfo.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeChipText, { color: bInfo.color }]}>{bInfo.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Social Feed Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={activeTab === 'posts' ? colors.primaryDeep : colors.muted}
            />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Gönderiler ({userPosts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'plants' && styles.tabBtnActive]}
            onPress={() => setActiveTab('plants')}
          >
            <Ionicons
              name="leaf-outline"
              size={18}
              color={activeTab === 'plants' ? colors.primaryDeep : colors.muted}
            />
            <Text style={[styles.tabText, activeTab === 'plants' && styles.tabTextActive]}>
              Bitkilerim ({userPlants.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'liked' && styles.tabBtnActive]}
            onPress={() => setActiveTab('liked')}
          >
            <Ionicons
              name="heart-outline"
              size={18}
              color={activeTab === 'liked' ? colors.primaryDeep : colors.muted}
            />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>
              Beğendiklerim ({userLikedPosts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        <View style={styles.tabContentWrap}>
          {activeTab === 'posts' && (
            userPosts.length > 0 ? (
              <View style={styles.postsList}>
                {userPosts.map((post) => (
                  <TouchableOpacity
                    key={post.post_id}
                    style={styles.postCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('PostDetail', { postId: post.post_id })}
                  >
                    {post.image_url ? (
                      <Image source={{ uri: post.image_url }} style={styles.postCardImg} />
                    ) : null}
                    <View style={styles.postCardBody}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {post.title}
                      </Text>
                      <Text style={styles.postSnippet} numberOfLines={2}>
                        {post.content}
                      </Text>
                      <View style={styles.postFooter}>
                        <View style={styles.postStatRow}>
                          <Ionicons name="heart" size={14} color={colors.red} />
                          <Text style={styles.postStatText}>{post.like_count}</Text>
                          <Ionicons name="chatbubble-outline" size={14} color={colors.muted} style={{ marginLeft: 12 }} />
                          <Text style={styles.postStatText}>{post.comment_count}</Text>
                        </View>
                        <Text style={styles.postDateText}>
                          {new Date(post.created_at).toLocaleDateString('tr-TR')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="images-outline" size={48} color={colors.muted2} />
                <Text style={styles.emptyText}>Henüz toplulukta paylaşılmış bir gönderi yok.</Text>
                <TouchableOpacity
                  style={styles.actionSmallBtn}
                  onPress={() => navigation.navigate('CreatePost')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionSmallBtnText}>İlk Gönderini Paylaş</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {activeTab === 'plants' && (
            userPlants.length > 0 ? (
              <View style={styles.plantsGrid}>
                {userPlants.map((plant) => (
                  <TouchableOpacity
                    key={plant.cust_prod_id}
                    style={styles.plantGridCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('PlantDetail', { custProdId: plant.cust_prod_id })}
                  >
                    {plant.image_url ? (
                      <Image source={{ uri: plant.image_url }} style={styles.plantImg} />
                    ) : (
                      <View style={styles.plantImgPlaceholder}>
                        <Ionicons name="leaf" size={28} color={colors.primaryDeep} />
                      </View>
                    )}
                    <View style={styles.plantInfo}>
                      <Text style={styles.plantNick} numberOfLines={1}>
                        {plant.nickname}
                      </Text>
                      <Text style={styles.plantSpecies} numberOfLines={1}>
                        {plant.species}
                      </Text>
                      <View style={styles.healthTag}>
                        <Ionicons name="fitness" size={11} color="#16a34a" />
                        <Text style={styles.healthText}>{plant.health_status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="leaf-outline" size={48} color={colors.muted2} />
                <Text style={styles.emptyText}>Bahçenizde henüz kayıtlı bitki yok.</Text>
                <TouchableOpacity
                  style={styles.actionSmallBtn}
                  onPress={() => navigation.navigate('AddPlant')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionSmallBtnText}>Yeni Bitki Ekle</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {activeTab === 'liked' && (
            userLikedPosts.length > 0 ? (
              <View style={styles.postsList}>
                {userLikedPosts.map((post) => (
                  <TouchableOpacity
                    key={post.post_id}
                    style={styles.postCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('PostDetail', { postId: post.post_id })}
                  >
                    {post.image_url ? (
                      <Image source={{ uri: post.image_url }} style={styles.postCardImg} />
                    ) : null}
                    <View style={styles.postCardBody}>
                      <Text style={styles.postAuthorTag}>{post.author_name}</Text>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {post.title}
                      </Text>
                      <Text style={styles.postSnippet} numberOfLines={2}>
                        {post.content}
                      </Text>
                      <View style={styles.postFooter}>
                        <View style={styles.postStatRow}>
                          <Ionicons name="heart" size={14} color={colors.red} />
                          <Text style={styles.postStatText}>{post.like_count}</Text>
                        </View>
                        <Text style={styles.postDateText}>
                          {new Date(post.created_at).toLocaleDateString('tr-TR')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="heart-outline" size={48} color={colors.muted2} />
                <Text style={styles.emptyText}>Henüz beğendiğiniz bir topluluk gönderisi yok.</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sosyal Profili Düzenle</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.fieldLabel}>Ad</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Adınız" />

              <Text style={styles.fieldLabel}>Soyad</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Soyadınız" />

              {isSeller && (
                <>
                  <Text style={styles.fieldLabel}>Mağaza Adı</Text>
                  <TextInput
                    style={styles.input}
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="Mağaza veya Marka Adı"
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>Şehir</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="İstanbul, İzmir vb." />

              <Text style={styles.fieldLabel}>Biyografi / Hakkımda</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Bitkileriniz ve biyografinizden kısaca bahsedin..."
                multiline
              />

              <Text style={styles.fieldLabel}>Profil Fotoğrafı URL (Avatar)</Text>
              <TextInput
                style={styles.input}
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                placeholder="https://..."
              />

              <Text style={styles.fieldLabel}>Kapak Fotoğrafı URL (Banner)</Text>
              <TextInput
                style={styles.input}
                value={coverImageUrl}
                onChangeText={setCoverImageUrl}
                placeholder="https://..."
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverWrap: { width: '100%', height: 160, backgroundColor: colors.secondary, position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.secondaryDeep },
  coverTopBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerInfoCard: {
    backgroundColor: colors.card,
    marginTop: -36,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  avatarOverWrap: { position: 'relative', marginTop: -46, marginBottom: spacing.xs },
  avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: colors.card },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.card,
  },
  sellerDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#16a34a',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  profileName: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  roleBadgeText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.primaryDeep, marginLeft: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  locText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginLeft: 4 },
  bioText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, textAlign: 'center', marginVertical: spacing.xs },

  socialBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  socialStat: { alignItems: 'center' },
  statNum: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  statLabel: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted },
  statDivider: { width: 1, height: 24, backgroundColor: colors.border },

  badgesWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.bg,
  },
  badgeChipText: { fontFamily: fonts.sansMedium, fontSize: 11.5 },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    gap: 6,
  },
  tabBtnActive: { backgroundColor: colors.bg },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  tabTextActive: { fontFamily: fonts.sansBold, color: colors.primaryDeep },

  tabContentWrap: { marginHorizontal: spacing.md, marginTop: spacing.md },
  postsList: { gap: spacing.sm },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  postCardImg: { width: '100%', height: 160, borderRadius: radius.sm, marginBottom: spacing.sm },
  postCardBody: { gap: 4 },
  postAuthorTag: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primaryDeep },
  postTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  postSnippet: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  postStatRow: { flexDirection: 'row', alignItems: 'center' },
  postStatText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, marginLeft: 4 },
  postDateText: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },

  plantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  plantGridCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  plantImg: { width: '100%', height: 120, borderRadius: radius.xs },
  plantImgPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: radius.xs,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantInfo: { padding: spacing.xs },
  plantNick: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink },
  plantSpecies: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted },
  healthTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  healthText: { fontFamily: fonts.sansMedium, fontSize: 11, color: '#16a34a' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', marginVertical: spacing.sm },
  actionSmallBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  actionSmallBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.white },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink },
  fieldLabel: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.white },
});
