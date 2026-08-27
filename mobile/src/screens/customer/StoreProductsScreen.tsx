import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SelectedCharacteristic, useCart } from '../../context/CartContext';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { startCommunication } from '../../services/communicationService';
import { trackInteraction } from '../../services/interactionService';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface ProductCharacteristic {
  gnl_char_id: number;
  char_name: string;
  gnl_char_val_id: number;
  value: string;
}

interface Product {
  prod_id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
  seller_id: number | null;
  category: string;
  image_url: string | null;
  characteristics: ProductCharacteristic[];
}

function groupCharacteristics(characteristics: ProductCharacteristic[]) {
  const byChar = new Map<number, { char_name: string; options: { gnl_char_val_id: number; value: string }[] }>();
  for (const c of characteristics) {
    const group = byChar.get(c.gnl_char_id) ?? { char_name: c.char_name, options: [] };
    group.options.push({ gnl_char_val_id: c.gnl_char_val_id, value: c.value });
    byChar.set(c.gnl_char_id, group);
  }
  return Array.from(byChar.entries()).map(([gnl_char_id, group]) => ({ gnl_char_id, ...group }));
}

export default function StoreProductsScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const { sellerId, sellerName } = route.params ?? {};
  const { addToCart, count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Product[]>('/catalog/products');
      setProducts(data.filter((p) => p.seller_id === sellerId));
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('common.productsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [sellerId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (sellerId) trackInteraction('STORE_VISIT');
  }, [sellerId]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [products, searchQuery]);

  const charGroups = useMemo(
    () => (selected ? groupCharacteristics(selected.characteristics ?? []) : []),
    [selected]
  );
  const multiChoiceGroups = charGroups.filter((g) => g.options.length > 1);
  const infoGroups = charGroups.filter((g) => g.options.length === 1);

  const openProduct = (item: Product) => {
    const initial: Record<number, number> = {};
    (item.characteristics ?? []).forEach((c) => {
      const sameChar = (item.characteristics ?? []).filter((x) => x.gnl_char_id === c.gnl_char_id);
      if (sameChar.length === 1) initial[c.gnl_char_id] = c.gnl_char_val_id;
    });
    setPicked(initial);
    setSelected(item);
    setQty(1);
  };

  const canAdd = multiChoiceGroups.every((g) => picked[g.gnl_char_id] != null);

  const confirmAdd = () => {
    if (!selected || !canAdd) return;
    const selectedCharacteristics: SelectedCharacteristic[] = charGroups
      .map((g) => {
        const valId = picked[g.gnl_char_id];
        if (valId == null) return null;
        const opt = g.options.find((o) => o.gnl_char_val_id === valId);
        if (!opt) return null;
        return { gnl_char_id: g.gnl_char_id, char_name: g.char_name, gnl_char_val_id: valId, value: opt.value };
      })
      .filter((x): x is SelectedCharacteristic => x !== null);

    addToCart(selected, qty, selectedCharacteristics);
    setSelected(null);
  };

  const handleStartChat = async () => {
    const targetSellerId = Number(sellerId);
    if (!targetSellerId || isNaN(targetSellerId)) {
      Alert.alert(t('common.error'), 'Satıcı bilgisi bulunamadı.');
      return;
    }
    try {
      const interaction = await startCommunication({ seller_id: targetSellerId });
      navigation.navigate('SellerChatDetail', {
        interactionId: interaction.comm_interaction_id,
        partnerName: sellerName || t('common.store'),
      });
    } catch (err: any) {
      console.log('[StoreProducts] Start chat error:', err);
      const msg = err?.response?.data?.detail ?? t('sellerChat.startError');
      Alert.alert(t('common.error'), msg);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const out = item.stock < 1;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={() => openProduct(item)}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={{ fontSize: 32 }}>🪴</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.stockRow}>
            <View style={[styles.stockDot, out && { backgroundColor: colors.red }]} />
            <Text style={[styles.stockText, out && { color: colors.red }]}>
              {out ? t('common.outOfStock') : `${t('common.stock')}: ${item.stock}`}
            </Text>
          </View>
        </View>
        <View style={styles.buyCol}>
          <Text style={styles.price}>₺{Number(item.price).toFixed(2)}</Text>
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.inspectButton}
              onPress={() => openProduct(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={14} color={colors.primaryDeep} style={{ marginRight: 4 }} />
              <Text style={styles.inspectButtonText}>İncele</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buyButton, out && styles.buyButtonDisabled]}
              onPress={() => {
                if (out) return;
                addToCart(item, 1, []);
                Alert.alert(t('orders.addedToCart'), `${item.name} ${t('orders.addedToCartMsg')}`);
              }}
              disabled={out}
              activeOpacity={0.85}
            >
              <Ionicons name="cart-outline" size={13} color={colors.white} style={{ marginRight: 3 }} />
              <Text style={styles.buyButtonText}>Sepet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Store Hero Header */}
      <LinearGradient colors={['#1B4332', '#0F2A1F']} style={styles.heroHeader}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>{sellerName ?? t('common.store')}</Text>
          <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')} activeOpacity={0.8}>
            <Ionicons name="cart-outline" size={22} color={colors.white} />
            {count > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.storeHeroBody}>
          <View style={styles.storeAvatar}>
            <Text style={styles.storeAvatarText}>{(sellerName || 'S').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.storeName}>{sellerName ?? t('common.store')}</Text>
              <Ionicons name="checkmark-circle" size={18} color="#1DAA63" />
            </View>
            <Text style={styles.storeSub}>Onaylı Botanik Mağazası</Text>
          </View>
        </View>

        {/* Quick Action Toolbar */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleStartChat} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.white} />
            <Text style={styles.actionBtnText}>Satıcıya Mesaj</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              const sid = Number(sellerId);
              if (sid) navigation.navigate('PublicProfile', { userId: sid });
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="person-outline" size={15} color={colors.white} />
            <Text style={styles.actionBtnText}>Profil</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* In-Store Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Mağaza içinde ürün ara..."
            placeholderTextColor={colors.muted2}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.prod_id)}
          contentContainerStyle={styles.list}
          renderItem={renderProduct}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="leaf-outline" size={44} color={colors.muted2} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Aramanızla eşleşen bir ürün bulunamadı.' : t('storeProducts.empty')}
              </Text>
            </View>
          }
        />
      )}

      {/* Ürün Detay & İnceleme Bottom Sheet Modalı */}
      <Modal visible={selected !== null && zoomImageUrl === null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContentContainer}>
            {/* Top Drag Indicator Bar */}
            <View style={styles.sheetDragBar} />

            <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 110 }}>
              {/* Product Hero Image Header */}
              <View style={styles.sheetImageHeader}>
                {selected?.image_url ? (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomImageUrl(selected.image_url)}>
                    <Image source={{ uri: selected.image_url }} style={styles.sheetImage} resizeMode="cover" />
                    <View style={styles.zoomHint}>
                      <Ionicons name="expand-outline" size={14} color={colors.white} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.sheetImagePlaceholder}>
                    <Ionicons name="leaf" size={64} color={colors.primaryDeep} />
                  </View>
                )}

                {/* Overlaid Close Button */}
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSelected(null)} activeOpacity={0.8}>
                  <Ionicons name="close" size={20} color={colors.ink} />
                </TouchableOpacity>

                {/* Overlaid Badges */}
                <View style={styles.sheetImageBadgeRow}>
                  <View style={styles.sheetStockBadge}>
                    <Text style={styles.sheetStockBadgeDot}>●</Text>
                    <Text style={styles.sheetStockBadgeText}>
                      {(selected?.stock ?? 0) > 0 ? `Stokta Var (${selected?.stock} Adet)` : t('common.outOfStock')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sheetBody}>
                {/* Title */}
                <Text style={styles.sheetProductTitle}>{selected?.name}</Text>
                
                {/* Ratings & Reviews Bar */}
                <View style={styles.sheetRatingRow}>
                  <View style={styles.sheetStarsWrap}>
                    <Ionicons name="star" size={16} color="#f5a524" />
                    <Text style={styles.sheetRatingScore}>4.8</Text>
                  </View>
                  <Text style={styles.sheetRatingCount}>(48 Değerlendirme & Yorum)</Text>
                  <View style={styles.sheetVerifiedPill}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.primaryDeep} />
                    <Text style={styles.sheetVerifiedPillText}>Onaylı Seracı</Text>
                  </View>
                </View>

                {/* Store & Seller Info Card */}
                <View style={styles.sheetStoreCard}>
                  <View style={styles.sheetStoreAvatar}>
                    <Ionicons name="storefront-outline" size={20} color={colors.primaryDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetStoreName}>{sellerName || 'Yeşil Bahçe Seracılık'}</Text>
                    <Text style={styles.sheetStoreSub}>%98 Olumlu Mağaza Puanı • 🚀 Aynı Gün Kargo</Text>
                  </View>
                </View>

                {/* Botanik Bakım Kartları (Care Characteristics Grid) */}
                <Text style={styles.sheetSectionTitle}>🌿 Botanik Bakım Rehberi</Text>
                <View style={styles.careGrid}>
                  <View style={styles.careCard}>
                    <Ionicons name="sunny-outline" size={22} color="#b45309" />
                    <Text style={styles.careCardTitle}>Güneş Işığı</Text>
                    <Text style={styles.careCardSub}>Dolaylı / Yarı Gölge</Text>
                  </View>
                  <View style={styles.careCard}>
                    <Ionicons name="water-outline" size={22} color="#0369a1" />
                    <Text style={styles.careCardTitle}>Sulama</Text>
                    <Text style={styles.careCardSub}>Haftada 1 Kez</Text>
                  </View>
                  <View style={styles.careCard}>
                    <Ionicons name="paw-outline" size={22} color="#15803d" />
                    <Text style={styles.careCardTitle}>Evcil Dostu</Text>
                    <Text style={styles.careCardSub}>Zehirsiz (Safe)</Text>
                  </View>
                  <View style={styles.careCard}>
                    <Ionicons name="thermometer-outline" size={22} color="#c2410c" />
                    <Text style={styles.careCardTitle}>Sıcaklık</Text>
                    <Text style={styles.careCardSub}>18°C - 26°C</Text>
                  </View>
                </View>

                {/* Info Badges */}
                {infoGroups.length > 0 && (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.sheetSectionTitle}>{t('home.characteristics')}</Text>
                    <View style={styles.detailBadgeRow}>
                      {infoGroups.map((g) => (
                        <View key={g.gnl_char_id} style={styles.detailBadge}>
                          <Text style={styles.detailBadgeText}>{g.char_name}: {g.options[0].value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Characteristic Selection */}
                {multiChoiceGroups.map((g) => (
                  <View key={g.gnl_char_id} style={styles.choiceGroup}>
                    <Text style={styles.modalLabel}>{g.char_name}</Text>
                    <View style={styles.choiceRow}>
                      {g.options.map((opt) => {
                        const active = picked[g.gnl_char_id] === opt.gnl_char_val_id;
                        return (
                          <TouchableOpacity
                            key={opt.gnl_char_val_id}
                            style={[styles.choiceChip, active && styles.choiceChipActive]}
                            onPress={() => setPicked((prev) => ({ ...prev, [g.gnl_char_id]: opt.gnl_char_val_id }))}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                              {opt.value}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* Müşteri Değerlendirmeleri & Yorumlar */}
                <View style={styles.reviewsSectionWrap}>
                  <Text style={styles.sheetSectionTitle}>⭐ Müşteri Değerlendirmeleri (4.8)</Text>
                  
                  <View style={styles.ratingSummaryCard}>
                    <View style={styles.ratingLeft}>
                      <Text style={styles.ratingScoreBig}>4.8</Text>
                      <View style={{ flexDirection: 'row', gap: 2, marginVertical: 2 }}>
                        {['★', '★', '★', '★', '★'].map((s, i) => (
                          <Text key={i} style={{ color: '#f5a524', fontSize: 13 }}>{s}</Text>
                        ))}
                      </View>
                      <Text style={styles.ratingCountSub}>48 Değerlendirme</Text>
                    </View>

                    <View style={styles.ratingRightBars}>
                      <View style={styles.ratingBarRow}>
                        <Text style={styles.ratingBarLabel}>5★</Text>
                        <View style={styles.ratingBarBg}><View style={[styles.ratingBarFill, { width: '85%' }]} /></View>
                        <Text style={styles.ratingBarPercent}>%85</Text>
                      </View>
                      <View style={styles.ratingBarRow}>
                        <Text style={styles.ratingBarLabel}>4★</Text>
                        <View style={styles.ratingBarBg}><View style={[styles.ratingBarFill, { width: '10%' }]} /></View>
                        <Text style={styles.ratingBarPercent}>%10</Text>
                      </View>
                      <View style={styles.ratingBarRow}>
                        <Text style={styles.ratingBarLabel}>3★</Text>
                        <View style={styles.ratingBarBg}><View style={[styles.ratingBarFill, { width: '5%' }]} /></View>
                        <Text style={styles.ratingBarPercent}>%5</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.reviewItemCard}>
                    <View style={styles.reviewUserHeader}>
                      <View style={styles.reviewAvatarCircle}>
                        <Text style={styles.reviewAvatarText}>D</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewUserName}>Deniz Y.</Text>
                        <Text style={styles.reviewDate}>12 Ağustos 2026 • Doğrulanmış Alıcı</Text>
                      </View>
                      <Text style={styles.reviewStars}>★★★★★</Text>
                    </View>
                    <Text style={styles.reviewCommentText}>"Çok özenli paketlenmiş, kargo 1 günde ulaştı. Yaprakları capcanlı yeşil!"</Text>
                  </View>

                  <View style={styles.reviewItemCard}>
                    <View style={styles.reviewUserHeader}>
                      <View style={styles.reviewAvatarCircle}>
                        <Text style={styles.reviewAvatarText}>M</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewUserName}>Merve A.</Text>
                        <Text style={styles.reviewDate}>8 Ağustos 2026 • Doğrulanmış Alıcı</Text>
                      </View>
                      <Text style={styles.reviewStars}>★★★★★</Text>
                    </View>
                    <Text style={styles.reviewCommentText}>"Seradan direkt gelmiş gibi taptaze ve sağlıklı. Teşekkür ederim."</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Sabit Alt Eylem Çubuğu (Sticky Bottom Bar) */}
            <View style={styles.stickyFooterBar}>
              <View style={styles.footerQtyWrap}>
                <TouchableOpacity style={styles.footerQtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))} activeOpacity={0.7}>
                  <Text style={styles.footerQtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.footerQtyValue}>{qty}</Text>
                <TouchableOpacity
                  style={styles.footerQtyBtn}
                  onPress={() => setQty((q) => Math.min(selected?.stock ?? 1, q + 1))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerQtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerPriceWrap}>
                <Text style={styles.footerPriceLabel}>Toplam Tutar</Text>
                <Text style={styles.footerPriceText}>
                  ₺{(Number(selected?.price ?? 0) * qty).toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.footerAddBtn, (!canAdd || (selected?.stock ?? 0) < 1) && styles.footerAddBtnDisabled]}
                disabled={!canAdd || (selected?.stock ?? 0) < 1}
                onPress={confirmAdd}
                activeOpacity={0.88}
              >
                <Ionicons name="cart" size={18} color={colors.white} />
                <Text style={styles.footerAddBtnText}>{t('common.addToCart')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Image Zoom Modal */}
      {zoomImageUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setZoomImageUrl(null)}>
          <TouchableOpacity
            style={styles.fullscreenImageWrap}
            activeOpacity={1}
            onPress={() => setZoomImageUrl(null)}
          >
            <Image source={{ uri: zoomImageUrl }} style={styles.fullscreenImage} resizeMode="contain" />
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setZoomImageUrl(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  heroHeader: {
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.white, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  cartBtn: { padding: spacing.xs },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.white },
  storeHeroBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  storeAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  storeAvatarText: { fontFamily: fonts.display, fontSize: 24, color: colors.white },
  storeName: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  storeSub: { fontFamily: fonts.sans, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingVertical: 9,
  },
  actionBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.white },
  searchSection: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xs },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    gap: spacing.sm,
    ...shadow.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, padding: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  list: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.sm,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
  },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  stockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  stockText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  buyCol: { alignItems: 'flex-end', gap: spacing.xs },
  price: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDeep },
  cardActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inspectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f3ea',
    borderWidth: 1,
    borderColor: 'rgba(29, 170, 99, 0.3)',
    borderRadius: radius.full,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  inspectButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primaryDeep },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  buyButtonDisabled: { backgroundColor: colors.border },
  buyButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.buttonPrimaryText },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '80%' },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  modalPrice: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryDeep, marginTop: spacing.xs },
  modalStock: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  infoBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  infoBadge: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  infoBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted },
  choiceGroup: { marginTop: spacing.md },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choiceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  choiceChipActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  choiceChipText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  choiceChipTextActive: { color: colors.buttonPrimaryText },
  modalLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    color: colors.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink },
  qtyValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, minWidth: 28, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  modalAdd: {
    flex: 1.4,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalAddDisabled: { backgroundColor: colors.border },
  modalAddText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
  warnText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.red,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  modalImagePlaceholder: {
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomHint: {
    position: 'absolute',
    bottom: spacing.md + 8,
    right: spacing.sm + 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImageWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: { width: '100%', height: '80%' },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContentContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  sheetDragBar: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetImageHeader: {
    width: '100%',
    height: 220,
    backgroundColor: colors.bgAlt,
    position: 'relative',
  },
  sheetImage: { width: '100%', height: '100%' },
  sheetImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  sheetCloseBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sheetImageBadgeRow: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sheetStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sheetStockBadgeDot: { fontSize: 8, color: colors.primaryDeep },
  sheetStockBadgeText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.ink },
  sheetBody: { padding: spacing.lg },
  sheetProductTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, marginBottom: 6 },
  sheetRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  sheetStarsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  sheetRatingScore: { fontFamily: fonts.sansBold, fontSize: 12, color: '#b45309' },
  sheetRatingCount: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  sheetVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginLeft: 'auto',
  },
  sheetVerifiedPillText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primaryDeep },
  sheetStoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetStoreAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetStoreName: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.ink },
  sheetStoreSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 1 },
  sheetStoreVisitBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetStoreVisitText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.primaryDeep },
  sheetDescription: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginBottom: spacing.lg },
  sheetSectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink, marginBottom: spacing.md, marginTop: spacing.xs },
  careGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  careCard: {
    width: '48%',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  careCardTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.ink, marginTop: 4 },
  careCardSub: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted },
  reviewsSectionWrap: { marginTop: spacing.lg, gap: spacing.md },
  ratingSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingLeft: { alignItems: 'center' },
  ratingScoreBig: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  ratingCountSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
  ratingRightBars: { flex: 1, gap: 4 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingBarLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.ink, width: 22 },
  ratingBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  ratingBarFill: { height: '100%', backgroundColor: '#f5a524', borderRadius: 3 },
  ratingBarPercent: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.muted, width: 28 },
  reviewItemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  reviewUserHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryDeep },
  reviewUserName: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  reviewDate: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.muted },
  reviewStars: { color: '#f5a524', fontSize: 12 },
  reviewCommentText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink, lineHeight: 18 },
  detailBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detailBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  detailBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.primaryDeep },
  stickyFooterBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  footerQtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    padding: 3,
  },
  footerQtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerQtyBtnText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  footerQtyValue: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink, paddingHorizontal: 10 },
  footerPriceWrap: { flex: 1 },
  footerPriceLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted },
  footerPriceText: { fontFamily: fonts.display, fontSize: 18, color: colors.primaryDeep },
  footerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerAddBtnDisabled: { backgroundColor: colors.border },
  footerAddBtnText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.buttonPrimaryText },
});

