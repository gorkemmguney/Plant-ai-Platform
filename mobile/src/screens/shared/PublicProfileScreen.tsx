import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { startCommunication } from '../../services/communicationService';
import {
  fetchPublicProfile,
  fetchUserPlants,
  fetchUserPosts,
  GenericPartyProfile,
  toggleFollowUser,
  UserPlantSummary,
  UserPostSummary,
} from '../../services/profileService';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface SellerProduct {
  prod_id: number;
  name: string;
  price: number;
  image_url?: string;
  category_name?: string;
}

export default function PublicProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { userId: currentUserId } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const isMe = currentUserId === userId;

  const [profile, setProfile] = useState<GenericPartyProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPostSummary[]>([]);
  const [userPlants, setUserPlants] = useState<UserPlantSummary[]>([]);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'plants' | 'products'>('posts');
  const [startingChat, setStartingChat] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchPublicProfile(userId);
      setProfile(data);

      const [posts, plants] = await Promise.all([
        fetchUserPosts(userId),
        fetchUserPlants(userId),
      ]);
      setUserPosts(posts);
      setUserPlants(plants);

      if (data.role === 'seller') {
        try {
          const prodRes = await apiClient.get<SellerProduct[]>(`/catalog/sellers/${userId}/products`);
          setSellerProducts(prodRes.data);
        } catch {}
      }
    } catch (err) {
      console.log('[PublicProfileScreen] fetch error:', err);
      const targetId = Number(userId);
      let fetchedPosts: UserPostSummary[] = [];
      let fetchedPlants: UserPlantSummary[] = [];
      if (targetId) {
        try {
          const [posts, plants] = await Promise.all([
            fetchUserPosts(targetId),
            fetchUserPlants(targetId),
          ]);
          fetchedPosts = posts;
          fetchedPlants = plants;
          setUserPosts(posts);
          setUserPlants(plants);
        } catch {}
      }

      // Determine real user name from route params or fetched posts
      const paramName = route.params?.authorName;
      const postName = fetchedPosts.length > 0 ? fetchedPosts[0].author_name : undefined;
      const realName = paramName || postName || 'Topluluk Üyesi';

      const parts = realName.trim().split(' ');
      const firstName = parts[0] || 'Topluluk';
      const lastName = parts.slice(1).join(' ') || '';

      // Fallback profile if Railway backend endpoint is 404
      const fallback: GenericPartyProfile = {
        user_id: targetId,
        role: 'customer',
        customer_profile: {
          user_id: targetId,
          first_name: firstName,
          last_name: lastName,
          email: '',
          points: 0,
          badges: ['PLANT_LOVER'],
          followers_count: 0,
          following_count: 0,
          is_followed_by_me: false,
          plant_count: fetchedPlants.length,
          post_count: fetchedPosts.length,
          order_count: 0,
          created_at: new Date().toISOString(),
          party_characteristics: [],
        },
      };
      setProfile(fallback);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleFollow = async () => {
    if (followingBusy || isMe) return;
    setFollowingBusy(true);

    try {
      const res = await toggleFollowUser(userId);
      setProfile((prev) => {
        if (!prev) return prev;
        if (prev.role === 'seller' && prev.seller_profile) {
          const sp = prev.seller_profile;
          const newCnt = res.is_following ? sp.followers_count + 1 : Math.max(0, sp.followers_count - 1);
          return {
            ...prev,
            seller_profile: { ...sp, is_followed_by_me: res.is_following, followers_count: newCnt },
          };
        } else if (prev.customer_profile) {
          const cp = prev.customer_profile;
          const newCnt = res.is_following ? cp.followers_count + 1 : Math.max(0, cp.followers_count - 1);
          return {
            ...prev,
            customer_profile: { ...cp, is_followed_by_me: res.is_following, followers_count: newCnt },
          };
        }
        return prev;
      });
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? 'Takip işlemi başarısız.');
    } finally {
      setFollowingBusy(false);
    }
  };

  const handleStartChat = async () => {
    if (startingChat) return;
    setStartingChat(true);
    try {
      const interaction = await startCommunication({
        seller_id: userId,
        subject: `Satıcı İletişim - ${profile?.seller_profile?.store_name || 'Satıcı'}`,
      });
      navigation.navigate('SellerChatDetail', {
        interactionId: interaction.comm_interaction_id,
        partnerName: interaction.partner_name || 'Satıcı',
      });
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? 'Mesajlaşma başlatılamadı.');
    } finally {
      setStartingChat(false);
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
  const isFollowedByMe = isSeller ? sp?.is_followed_by_me : cp?.is_followed_by_me;

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

          <View style={[styles.coverTopBar, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity style={styles.floatingBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Card Header */}
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

          {isSeller && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={15} color="#f59e0b" />
              <Text style={styles.ratingScore}>{sp?.rating_score.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({sp?.review_count} Değerlendirme)</Text>
            </View>
          )}

          {currentCity && (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text style={styles.locText}>{currentCity}</Text>
            </View>
          )}

          {currentBio && <Text style={styles.bioText}>{currentBio}</Text>}

          {/* Social Stats */}
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

          {/* Action Buttons: Follow & Message */}
          {!isMe && (
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.followBtn, isFollowedByMe && styles.followBtnActive]}
                activeOpacity={0.85}
                onPress={handleToggleFollow}
                disabled={followingBusy}
              >
                {followingBusy ? (
                  <ActivityIndicator size="small" color={isFollowedByMe ? colors.ink : colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name={isFollowedByMe ? 'checkmark-outline' : 'person-add-outline'}
                      size={16}
                      color={isFollowedByMe ? colors.ink : colors.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.followBtnText, isFollowedByMe && styles.followBtnTextActive]}>
                      {isFollowedByMe ? 'Takip Ediliyorsun' : 'Takip Et'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.messageBtn} activeOpacity={0.85} onPress={handleStartChat} disabled={startingChat}>
                {startingChat ? (
                  <ActivityIndicator size="small" color={colors.primaryDeep} />
                ) : (
                  <>
                    <Ionicons name="chatbubbles-outline" size={16} color={colors.primaryDeep} style={{ marginRight: 6 }} />
                    <Text style={styles.messageBtnText}>Mesaj Gönder</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

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
            <Ionicons name="grid-outline" size={18} color={activeTab === 'posts' ? colors.primaryDeep : colors.muted} />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Gönderileri ({userPosts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'plants' && styles.tabBtnActive]}
            onPress={() => setActiveTab('plants')}
          >
            <Ionicons name="leaf-outline" size={18} color={activeTab === 'plants' ? colors.primaryDeep : colors.muted} />
            <Text style={[styles.tabText, activeTab === 'plants' && styles.tabTextActive]}>
              Bitkileri ({userPlants.length})
            </Text>
          </TouchableOpacity>

          {isSeller && (
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'products' && styles.tabBtnActive]}
              onPress={() => setActiveTab('products')}
            >
              <Ionicons name="pricetags-outline" size={18} color={activeTab === 'products' ? colors.primaryDeep : colors.muted} />
              <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
                Ürünleri ({sellerProducts.length})
              </Text>
            </TouchableOpacity>
          )}
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
                <Text style={styles.emptyText}>Bu kullanıcının henüz paylaşılmış bir gönderisi yok.</Text>
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
                <Text style={styles.emptyText}>Bu kullanıcının henüz kamuya açık bitkisi yok.</Text>
              </View>
            )
          )}

          {activeTab === 'products' && (
            sellerProducts.length > 0 ? (
              <View style={styles.plantsGrid}>
                {sellerProducts.map((prod) => (
                  <TouchableOpacity
                    key={prod.prod_id}
                    style={styles.plantGridCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('PlantDetail', { plantId: prod.prod_id })}
                  >
                    {prod.image_url ? (
                      <Image source={{ uri: prod.image_url }} style={styles.plantImg} />
                    ) : (
                      <View style={styles.plantImgPlaceholder}>
                        <Ionicons name="leaf" size={28} color={colors.primaryDeep} />
                      </View>
                    )}
                    <View style={styles.plantInfo}>
                      <Text style={styles.plantNick} numberOfLines={1}>
                        {prod.name}
                      </Text>
                      <Text style={styles.prodPriceText}>{prod.price} ₺</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="pricetags-outline" size={48} color={colors.muted2} />
                <Text style={styles.emptyText}>Henüz sergilenen ürün bulunmuyor.</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
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
    top: 0,
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
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  ratingScore: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  reviewCount: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
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

  actionBtnRow: { flexDirection: 'row', gap: spacing.sm, width: '100%', marginBottom: spacing.md },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  followBtnActive: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  followBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white },
  followBtnTextActive: { color: colors.ink },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  messageBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryDeep },

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
  prodPriceText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primaryDeep, marginTop: 2 },
  healthTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  healthText: { fontFamily: fonts.sansMedium, fontSize: 11, color: '#16a34a' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', marginVertical: spacing.sm },
});
