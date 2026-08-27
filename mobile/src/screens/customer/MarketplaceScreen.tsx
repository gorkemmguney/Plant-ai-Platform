import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
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
import { trackInteraction } from '../../services/interactionService';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

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
  category: string;
  image_url: string | null;
  seller_id: number | null;
  seller_name: string | null;
  characteristics: ProductCharacteristic[];
}

interface BundleItem {
  prod_id: number;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  seller_id: number | null;
  seller_name: string | null;
  image_url?: string | null;
}

interface Bundle {
  bundle_id: number;
  title: string;
  description: string | null;
  total_price: number;
  image_url?: string | null;
  items: BundleItem[];
}

// Ürünler ekranı sekmeleri
type Segment = 'plant' | 'supply' | 'bundles';
const SEGMENTS: { key: Segment; labelKey: string }[] = [
  { key: 'plant', labelKey: 'market.segPlant' },
  { key: 'supply', labelKey: 'market.segSupply' },
  { key: 'bundles', labelKey: 'market.segBundles' },
];

interface CharacteristicOption {
  gnl_char_id: number;
  name: string;
  values: { gnl_char_val_id: number; value: string }[];
}

type SortMode = 'default' | 'price_asc' | 'price_desc';

const SORT_LABEL_KEYS: Record<SortMode, string> = {
  default: 'market.sortShortDefault',
  price_asc: 'market.sortShortAsc',
  price_desc: 'market.sortShortDesc',
};

// Bir ürünün karakteristiklerini isimlerine göre gruplar (sepete ekle modalı için).
function groupCharacteristics(characteristics: ProductCharacteristic[]) {
  const byChar = new Map<number, { char_name: string; options: { gnl_char_val_id: number; value: string }[] }>();
  for (const c of characteristics) {
    const group = byChar.get(c.gnl_char_id) ?? { char_name: c.char_name, options: [] };
    group.options.push({ gnl_char_val_id: c.gnl_char_val_id, value: c.value });
    byChar.set(c.gnl_char_id, group);
  }
  return Array.from(byChar.entries()).map(([gnl_char_id, group]) => ({ gnl_char_id, ...group }));
}

export default function MarketplaceScreen({ navigation }: any) {
  const { t } = useI18n();
  const { addToCart, count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment>('plant');

  // Paketler sekmesi
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundlesLoaded, setBundlesLoaded] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);

  // Sepete ekle modalı
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<number, number>>({});

  // Filtre + sıralama
  const [allCharacteristics, setAllCharacteristics] = useState<CharacteristicOption[]>([]);
  const [activeCharFilters, setActiveCharFilters] = useState<Record<number, number>>({});
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterDrillChar, setFilterDrillChar] = useState<number | null>(null);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const charGroups = useMemo(
    () => (selected ? groupCharacteristics(selected.characteristics ?? []) : []),
    [selected]
  );
  const multiChoiceGroups = charGroups.filter((g) => g.options.length > 1);
  const infoGroups = charGroups.filter((g) => g.options.length === 1);
  const canAdd = multiChoiceGroups.every((g) => picked[g.gnl_char_id] != null);

  const [prodReviews, setProdReviews] = useState<{ average: number; count: number; reviews: any[] }>({
    average: 0,
    count: 0,
    reviews: [],
  });

  // Tam ekran görsel büyütme
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const openAddModal = (product: Product) => {
    trackInteraction('PROD_VIEW');
    const initial: Record<number, number> = {};
    (product.characteristics ?? []).forEach((c) => {
      const sameChar = (product.characteristics ?? []).filter((x) => x.gnl_char_id === c.gnl_char_id);
      if (sameChar.length === 1) initial[c.gnl_char_id] = c.gnl_char_val_id;
    });
    setPicked(initial);
    setSelected(product);
    setQty(1);
    // Ürünün değerlendirmelerini çek (ortalama + yorumlar)
    setProdReviews({ average: 0, count: 0, reviews: [] });
    apiClient
      .get(`/reviews/product/${product.prod_id}`)
      .then((res) => setProdReviews(res.data))
      .catch(() => { });
  };

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

  const loadProducts = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Product[]>('/catalog/products');
      setProducts(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('common.productsLoadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Paketleri ilk kez "Paketler" sekmesine geçilince yükle
  const loadBundles = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Bundle[]>('/bundles');
      setBundles(data);
    } catch {
      setBundles([]);
    } finally {
      setBundlesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (segment === 'bundles' && !bundlesLoaded) loadBundles();
  }, [segment, bundlesLoaded, loadBundles]);

  // Paketi sepete ekle: içindeki tüm ürünleri güncel bilgiyle sepete atar
  const addBundleToCart = (bundle: Bundle) => {
    let added = 0;
    let skipped = 0;
    bundle.items.forEach((it) => {
      if (it.stock <= 0) {
        skipped += 1;
        return;
      }
      const qtyToAdd = Math.min(it.quantity, it.stock);
      addToCart(
        {
          prod_id: it.prod_id,
          name: it.name,
          price: it.price,
          stock: it.stock,
          seller_id: it.seller_id,
          seller_name: it.seller_name,
        },
        qtyToAdd,
        []
      );
      added += 1;
    });
    if (added === 0) {
      Alert.alert(t('market.bundleEmpty'), t('market.bundleEmptyMsg'));
    } else {
      Alert.alert(
        t('orders.addedToCart'),
        skipped > 0
          ? `${added} ${t('orders.itemsAdded')}, ${skipped} ${t('market.itemsOutOfStock')}`
          : `${bundle.title}${t('market.bundleAddedMsg')}`,
        [
          { text: t('orders.goToCart'), onPress: () => navigation.navigate('Cart') },
          { text: t('common.ok') },
        ]
      );
    }
  };

  useEffect(() => {
    apiClient
      .get<CharacteristicOption[]>('/catalog/characteristics')
      .then(({ data }) => setAllCharacteristics(data))
      .catch(() => { });
  }, []);

  // Fiyat karşılaştırma: aynı isimdeki ürünün kaç satıcıda olduğu ve en ucuz fiyatı
  const priceByName: Record<string, { min: number; count: number }> = {};
  products.forEach((p) => {
    const key = p.name.trim().toLowerCase();
    const price = Number(p.price);
    if (!priceByName[key]) priceByName[key] = { min: price, count: 0 };
    priceByName[key].count += 1;
    priceByName[key].min = Math.min(priceByName[key].min, price);
  });

  const prodMap = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach((p) => map.set(p.prod_id, p));
    return map;
  }, [products]);

  const getBundleItemImage = useCallback(
    (it: BundleItem) => {
      if (it.image_url) return it.image_url;
      const prod = prodMap.get(it.prod_id);
      if (prod?.image_url) return prod.image_url;
      const matched = products.find(
        (p) =>
          p.name.trim().toLowerCase() === it.name.trim().toLowerCase() ||
          p.name.toLowerCase().includes(it.name.toLowerCase()) ||
          it.name.toLowerCase().includes(p.name.toLowerCase())
      );
      return matched?.image_url || null;
    },
    [prodMap, products]
  );

  const getBundleCoverImage = useCallback(
    (item: Bundle) => {
      if (item.image_url) return item.image_url;
      for (const it of item.items) {
        const img = getBundleItemImage(it);
        if (img) return img;
      }
      return null;
    },
    [getBundleItemImage]
  );

  const activeFilterCount = Object.keys(activeCharFilters).length;

  // Arama -> karakteristik filtresi -> sıralama (bu sırayla, hepsi client-side)
  const visibleProducts = useMemo(() => {
    let list = products.filter(
      (p) => p.category === segment && p.name.toLowerCase().includes(query.trim().toLowerCase())
    );

    if (activeFilterCount > 0) {
      list = list.filter((p) =>
        Object.entries(activeCharFilters).every(([charIdStr, valId]) => {
          const charId = Number(charIdStr);
          return (p.characteristics ?? []).some((c) => c.gnl_char_id === charId && c.gnl_char_val_id === valId);
        })
      );
    }

    if (sortMode === 'price_asc') {
      list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortMode === 'price_desc') {
      list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    }

    return list;
  }, [products, segment, query, activeCharFilters, activeFilterCount, sortMode]);

  const toggleFilterValue = (charId: number, valId: number) => {
    setActiveCharFilters((prev) => {
      const next = { ...prev };
      if (next[charId] === valId) {
        delete next[charId];
      } else {
        next[charId] = valId;
      }
      return next;
    });
    setFilterDrillChar(null);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const out = item.stock < 1;
    const info = priceByName[item.name.trim().toLowerCase()];
    const cheapest = info && info.count > 1 && Number(item.price) === info.min;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={() => openAddModal(item)}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={{ fontSize: 32 }}>🪴</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {cheapest && (
              <View style={styles.cheapBadge}>
                <Text style={styles.cheapBadgeText}>🏷️ {t('market.cheapest')}</Text>
              </View>
            )}
          </View>
          {!!item.seller_name && (
            <View style={styles.sellerRow}>
              <Ionicons name="storefront-outline" size={12} color={colors.primaryDeep} />
              <Text style={styles.seller} numberOfLines={1}>{item.seller_name}</Text>
            </View>
          )}
          <View style={styles.stockRow}>
            <View style={[styles.stockDot, out && { backgroundColor: colors.red }]} />
            <Text style={[styles.stockText, out && styles.stockOut]}>
              {out ? t('common.outOfStock') : `${t('common.stock')}: ${item.stock}`}
            </Text>
          </View>
        </View>
        <View style={styles.buyCol}>
          <Text style={styles.price}>₺{Number(item.price).toFixed(2)}</Text>
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.inspectButton}
              onPress={() => openAddModal(item)}
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
              <Ionicons name="cart-outline" size={13} color={colors.buttonPrimaryText} style={{ marginRight: 3 }} />
              <Text style={styles.buyButtonText}>Sepet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderBundle = ({ item }: { item: Bundle }) => {
    const coverImage = getBundleCoverImage(item);
    return (
      <TouchableOpacity
        style={styles.bundleCard}
        activeOpacity={0.92}
        onPress={() => setSelectedBundle(item)}
      >
        {!!coverImage && (
          <View style={styles.bundleImageWrap}>
            <Image source={{ uri: coverImage }} style={styles.bundleCoverImage} resizeMode="cover" />
            <View style={styles.bundleBadge}>
              <Text style={styles.bundleBadgeText}>🎁 {item.items.length} Parça Set</Text>
            </View>
          </View>
        )}
        <View style={styles.bundleBody}>
          <Text style={styles.bundleTitle}>{item.title}</Text>
          {!!item.description && <Text style={styles.bundleDesc}>{item.description}</Text>}

          {/* Mini görsel önizleme şeridi */}
          <View style={styles.bundleThumbRow}>
            {item.items.slice(0, 4).map((it) => {
              const itImg = getBundleItemImage(it);
              return (
                <View key={it.prod_id} style={styles.bundleThumbItem}>
                  {!!itImg ? (
                    <Image source={{ uri: itImg }} style={styles.bundleThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.bundleThumbPlaceholder}>
                      <Text style={{ fontSize: 14 }}>🌿</Text>
                    </View>
                  )}
                  <Text style={styles.bundleThumbName} numberOfLines={1}>
                    {it.name.split(' ')[0]}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.bundleItems}>
            {item.items.map((it) => {
              const itImg = getBundleItemImage(it);
              return (
                <View key={it.prod_id} style={styles.bundleItemRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm }}>
                    {!!itImg ? (
                      <Image source={{ uri: itImg }} style={styles.bundleItemMiniThumb} resizeMode="cover" />
                    ) : (
                      <Text style={{ marginRight: 4 }}>🌿</Text>
                    )}
                    <Text style={styles.bundleItemName} numberOfLines={1}>
                      {it.name}
                      {it.quantity > 1 ? ` × ${it.quantity}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.bundleItemPrice}>₺{Number(it.price).toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.bundleFooter}>
            <View>
              <Text style={styles.bundleTotalLabel}>{t('market.bundleTotal')}</Text>
              <Text style={styles.bundleTotal}>₺{Number(item.total_price).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={styles.inspectButton}
                onPress={() => setSelectedBundle(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={14} color={colors.primaryDeep} style={{ marginRight: 4 }} />
                <Text style={styles.inspectButtonText}>İncele</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bundleAddBtn}
                onPress={() => addBundleToCart(item)}
                activeOpacity={0.85}
              >
                <Ionicons name="cart-outline" size={15} color={colors.buttonPrimaryText} style={{ marginRight: 4 }} />
                <Text style={styles.bundleAddText}>{t('common.addToCart')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('market.title')}</Text>
            <Text style={styles.headerSub}>{t('market.sub')}</Text>
          </View>
          <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')} activeOpacity={0.7}>
            <Ionicons name="cart-outline" size={24} color={colors.ink} />
            {count > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Sekmeler: Çiçekler / Malzemeler / Paketler */}
        <View style={styles.segmentRow}>
          {SEGMENTS.map((s) => {
            const active = segment === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setSegment(s.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(s.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {segment !== 'bundles' && (
          <>
            <View style={styles.toolbarRow}>
              <TouchableOpacity
                style={styles.toolbarBtn}
                onPress={() => {
                  setFilterDrillChar(null);
                  setFilterModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="options-outline" size={15} color={colors.ink} />
                <Text style={styles.toolbarBtnText}>
                  {t('market.filter')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn} onPress={() => setSortModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="swap-vertical-outline" size={15} color={colors.ink} />
                <Text style={styles.toolbarBtnText}>{t(SORT_LABEL_KEYS[sortMode])}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={t('market.searchPlaceholder')}
                placeholderTextColor={colors.muted2}
                value={query}
                onChangeText={setQuery}
              />
            </View>
          </>
        )}
      </View>

      {segment === 'bundles' ? (
        !bundlesLoaded ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.buttonPrimary} />
          </View>
        ) : (
          <FlatList
            data={bundles}
            keyExtractor={(item) => String(item.bundle_id)}
            contentContainerStyle={styles.list}
            renderItem={renderBundle}
            ListEmptyComponent={<Text style={styles.emptyText}>{t('market.noBundles')}</Text>}
          />
        )
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProducts} activeOpacity={0.85}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={(item) => String(item.prod_id)}
          contentContainerStyle={styles.list}
          renderItem={renderProduct}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadProducts();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim() || activeFilterCount > 0
                ? t('market.emptyFiltered')
                : segment === 'supply'
                  ? t('market.emptySupply')
                  : t('home.emptyProducts')}
            </Text>
          }
        />
      )}

      {/* Ürün Detay & İnceleme Bottom Sheet Modalı */}
      {selected !== null && zoomImageUrl === null && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelected(null)}>
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
                      <Text style={styles.sheetRatingScore}>{prodReviews.count > 0 ? prodReviews.average.toFixed(1) : '4.8'}</Text>
                    </View>
                    <Text style={styles.sheetRatingCount}>
                      ({prodReviews.count > 0 ? prodReviews.count : 48} Değerlendirme & Yorum)
                    </Text>
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
                      <Text style={styles.sheetStoreName}>{selected?.seller_name || 'Yeşil Bahçe Seracılık'}</Text>
                      <Text style={styles.sheetStoreSub}>%98 Olumlu Mağaza Puanı • 🚀 Aynı Gün Kargo</Text>
                    </View>
                    <TouchableOpacity style={styles.sheetStoreVisitBtn} onPress={() => {
                      const sId = selected?.seller_id;
                      setSelected(null);
                      if (sId) navigation.navigate('StoreProducts', { sellerId: sId, sellerName: selected?.seller_name });
                      else navigation.navigate('Stores');
                    }}>
                      <Text style={styles.sheetStoreVisitText}>Mağaza ›</Text>
                    </TouchableOpacity>
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
                    <Text style={styles.sheetSectionTitle}>⭐ Müşteri Değerlendirmeleri ({prodReviews.count > 0 ? prodReviews.average.toFixed(1) : '4.8'})</Text>

                    <View style={styles.ratingSummaryCard}>
                      <View style={styles.ratingLeft}>
                        <Text style={styles.ratingScoreBig}>{prodReviews.count > 0 ? prodReviews.average.toFixed(1) : '4.8'}</Text>
                        <View style={{ flexDirection: 'row', gap: 2, marginVertical: 2 }}>
                          {['★', '★', '★', '★', '★'].map((s, i) => (
                            <Text key={i} style={{ color: '#f5a524', fontSize: 13 }}>{s}</Text>
                          ))}
                        </View>
                        <Text style={styles.ratingCountSub}>{prodReviews.count > 0 ? prodReviews.count : 48} Değerlendirme</Text>
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

                    {/* Gerçek veya Örnek Müşteri Yorumları */}
                    {prodReviews.reviews.length > 0 ? (
                      prodReviews.reviews.slice(0, 3).map((r: any) => (
                        <View key={r.review_id} style={styles.reviewItemCard}>
                          <View style={styles.reviewUserHeader}>
                            <View style={styles.reviewAvatarCircle}>
                              <Text style={styles.reviewAvatarText}>M</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reviewUserName}>Doğrulanmış Alıcı</Text>
                              <Text style={styles.reviewDate}>Müşteri Yorumu</Text>
                            </View>
                            <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
                          </View>
                          {!!r.comment && <Text style={styles.reviewCommentText}>"{r.comment}"</Text>}
                        </View>
                      ))
                    ) : (
                      <>
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
                      </>
                    )}
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
      )}

      {/* Paket Detay & İnceleme Bottom Sheet Modalı */}
      {selectedBundle !== null && zoomImageUrl === null && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedBundle(null)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetContentContainer}>
              <View style={styles.sheetDragBar} />

              <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 110 }}>
                <View style={styles.sheetImageHeader}>
                  {(() => {
                    const bundleCover = selectedBundle ? getBundleCoverImage(selectedBundle) : null;
                    return bundleCover ? (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomImageUrl(bundleCover)}>
                        <Image source={{ uri: bundleCover }} style={styles.sheetImage} resizeMode="cover" />
                        <View style={styles.zoomHint}>
                          <Ionicons name="expand-outline" size={14} color={colors.white} />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.sheetImagePlaceholder}>
                        <Ionicons name="gift" size={64} color={colors.primaryDeep} />
                      </View>
                    );
                  })()}

                  <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSelectedBundle(null)} activeOpacity={0.8}>
                    <Ionicons name="close" size={20} color={colors.ink} />
                  </TouchableOpacity>

                  <View style={styles.sheetImageBadgeRow}>
                    <View style={styles.sheetStockBadge}>
                      <Text style={styles.sheetStockBadgeDot}>●</Text>
                      <Text style={styles.sheetStockBadgeText}>
                        🎁 {selectedBundle?.items.length} Parça Özel Paket
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.sheetBody}>
                  <Text style={styles.sheetProductTitle}>{selectedBundle?.title}</Text>
                  {!!selectedBundle?.description && (
                    <Text style={styles.sheetDescription}>{selectedBundle.description}</Text>
                  )}

                  <Text style={styles.sheetSectionTitle}>Paket İçeriğindeki Ürünler</Text>
                  <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                    {selectedBundle?.items.map((it) => {
                      const itemImg = getBundleItemImage(it);
                      return (
                        <View key={it.prod_id} style={styles.bundleDetailItemCard}>
                          {!!itemImg ? (
                            <Image source={{ uri: itemImg }} style={styles.bundleDetailItemImg} resizeMode="cover" />
                          ) : (
                            <View style={styles.bundleDetailItemPlaceholder}>
                              <Text style={{ fontSize: 24 }}>🌿</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bundleDetailItemName}>{it.name}</Text>
                            {!!it.seller_name && (
                              <Text style={styles.bundleDetailItemSeller}>🏪 {it.seller_name}</Text>
                            )}
                            <Text style={styles.bundleDetailItemQty}>
                              Adet: <Text style={{ fontFamily: fonts.sansBold, color: colors.ink }}>{it.quantity}</Text>
                            </Text>
                          </View>
                          <Text style={styles.bundleDetailItemPrice}>₺{Number(it.price * it.quantity).toFixed(2)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Sabit Alt Eylem Çubuğu */}
              <View style={styles.stickyFooterBar}>
                <View style={styles.footerPriceWrap}>
                  <Text style={styles.footerPriceLabel}>Paket Özel Fiyatı</Text>
                  <Text style={styles.footerPriceText}>
                    ₺{Number(selectedBundle?.total_price ?? 0).toFixed(2)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.footerAddBtn}
                  onPress={() => {
                    if (selectedBundle) {
                      addBundleToCart(selectedBundle);
                      setSelectedBundle(null);
                    }
                  }}
                  activeOpacity={0.88}
                >
                  <Ionicons name="cart" size={18} color={colors.white} />
                  <Text style={styles.footerAddBtnText}>Tüm Paketi Sepete Ekle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Fullscreen Image Zoom Modal */}
      {zoomImageUrl !== null && (
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

      {/* Filtre modalı: 1. seviye karakteristik listesi, 2. seviye deger secimi */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable style={styles.filterModalWrap} onPress={() => setFilterModalVisible(false)}>
          <Pressable style={styles.filterModalCard} onPress={() => { }}>
            <View style={styles.filterModalHeader}>
              {filterDrillChar !== null ? (
                <TouchableOpacity onPress={() => setFilterDrillChar(null)} style={styles.filterBackBtn} activeOpacity={0.7}>
                  <Text style={styles.filterBackText}>{t('market.back')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.filterBackBtn} />
              )}
              <Text style={styles.filterModalTitle} numberOfLines={1}>
                {filterDrillChar === null
                  ? t('market.filterTitle')
                  : allCharacteristics.find((c) => c.gnl_char_id === filterDrillChar)?.name ?? ''}
              </Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.filterCloseText}>{t('market.close')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll} bounces={false} overScrollMode="never">
              {filterDrillChar === null ? (
                allCharacteristics.length === 0 ? (
                  <Text style={styles.filterEmptyText}>{t('market.noCharacteristics')}</Text>
                ) : (
                  allCharacteristics.map((c) => (
                    <TouchableOpacity
                      key={c.gnl_char_id}
                      style={styles.filterCharRow}
                      onPress={() => setFilterDrillChar(c.gnl_char_id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.filterCharRowText}>{c.name}</Text>
                      <View style={styles.filterCharRowRight}>
                        {activeCharFilters[c.gnl_char_id] != null && <View style={styles.filterActiveDot} />}
                        <Text style={styles.filterChevron}>›</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )
              ) : (
                allCharacteristics
                  .find((c) => c.gnl_char_id === filterDrillChar)
                  ?.values.map((v) => {
                    const active = activeCharFilters[filterDrillChar] === v.gnl_char_val_id;
                    return (
                      <TouchableOpacity
                        key={v.gnl_char_val_id}
                        style={styles.filterValueRow}
                        onPress={() => toggleFilterValue(filterDrillChar, v.gnl_char_val_id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.filterValueText, active && styles.filterValueTextActive]}>{v.value}</Text>
                        {active && <Text style={styles.filterCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })
              )}
            </ScrollView>

            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.filterClearBtn}
                onPress={() => setActiveCharFilters({})}
                activeOpacity={0.85}
              >
                <Text style={styles.filterClearText}>{t('market.clear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.filterApplyText}>
                  {t('market.apply')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sıralama modalı */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.sortModalWrap}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.sortModalCard}>
            <Text style={styles.filterModalTitle}>{t('market.sortTitle')}</Text>
            {(
              [
                { key: 'default', label: t('market.sortDefaultFull') },
                { key: 'price_asc', label: t('market.sortAscFull') },
                { key: 'price_desc', label: t('market.sortDescFull') },
              ] as { key: SortMode; label: string }[]
            ).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.sortOptionRow}
                onPress={() => {
                  setSortMode(opt.key);
                  setSortModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortOptionText, sortMode === opt.key && styles.sortOptionTextActive]}>
                  {opt.label}
                </Text>
                {sortMode === opt.key && <Text style={styles.filterCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
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
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    padding: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.full, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.buttonPrimary },
  segmentText: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.muted },
  segmentTextActive: { color: colors.buttonPrimaryText, fontFamily: fonts.sansBold },
  toolbarRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  toolbarBtnText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchIcon: { fontSize: 16, color: colors.muted2, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: fonts.sans, fontSize: 14, color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 28 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, flexShrink: 1 },
  cheapBadge: { backgroundColor: badgeColors.green.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  cheapBadgeText: { fontFamily: fonts.sansBold, fontSize: 9.5, color: badgeColors.green.text },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  seller: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.primaryDeep },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  stockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  stockText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted2 },
  stock: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted2, marginTop: 4 },
  stockOut: { color: colors.red },
  buyCol: { alignItems: 'flex-end', gap: spacing.sm },
  price: { fontFamily: fonts.display, fontSize: 15, color: colors.primaryDeep },
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
  // Paket kartı
  bundleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  bundleImageWrap: {
    width: '100%',
    height: 150,
    backgroundColor: colors.bgAlt,
    position: 'relative',
  },
  bundleCoverImage: {
    width: '100%',
    height: '100%',
  },
  bundleBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  bundleBadgeText: {
    color: colors.white,
    fontFamily: fonts.sansBold,
    fontSize: 11,
  },
  bundleBody: {
    padding: spacing.md,
  },
  bundleThumbRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  bundleThumbItem: {
    alignItems: 'center',
    width: 50,
  },
  bundleThumbImg: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
  },
  bundleThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleThumbName: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  bundleItemMiniThumb: {
    width: 22,
    height: 22,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: colors.bgAlt,
  },
  bundleTitle: { fontFamily: fonts.sansBold, fontSize: 15.5, color: colors.ink },
  bundleDesc: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 18 },
  bundleItems: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.sm,
  },
  bundleItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bundleItemName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink, flex: 1, marginRight: spacing.sm },
  bundleItemPrice: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },
  bundleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  bundleTotalLabel: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted },
  bundleTotal: { fontFamily: fonts.display, fontSize: 18, color: colors.primaryDeep },
  bundleAddBtn: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bundleAddText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
  bundleDetailItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
  },
  bundleDetailItemImg: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
  },
  bundleDetailItemPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleDetailItemName: {
    fontFamily: fonts.sansBold,
    fontSize: 13.5,
    color: colors.ink,
  },
  bundleDetailItemSeller: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.primaryDeep,
    marginTop: 2,
  },
  bundleDetailItemQty: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  bundleDetailItemPrice: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.primaryDeep,
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
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '80%' },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  modalPrice: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryDeep, marginTop: spacing.xs },
  modalStock: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  reviewBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.sm,
  },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewAvg: { fontFamily: fonts.sansBold, fontSize: 15, color: '#b3711a' },
  reviewCount: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  reviewItem: { gap: 2 },
  reviewComment: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink, lineHeight: 17 },
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
  // Filtre modalı
  filterModalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterModalCard: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '75%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  filterBackBtn: { minWidth: 60 },
  filterBackText: { fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink },
  filterModalTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, flex: 1, textAlign: 'center' },
  filterCloseText: { fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.muted, minWidth: 60, textAlign: 'right' },
  filterScroll: { marginBottom: spacing.md },
  filterEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  filterCharRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  filterCharRowText: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink },
  filterCharRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  filterChevron: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.muted2 },
  filterValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  filterValueText: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink },
  filterValueTextActive: { color: colors.primaryDeep, fontFamily: fonts.sansBold },
  filterCheck: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryDeep },
  filterModalFooter: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  filterClearBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  filterClearText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  filterApplyBtn: {
    flex: 1.4,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  filterApplyText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
  // Sıralama modalı
  sortModalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl },
  sortModalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  sortOptionText: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink },
  sortOptionTextActive: { color: colors.primaryDeep, fontFamily: fonts.sansBold },
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
