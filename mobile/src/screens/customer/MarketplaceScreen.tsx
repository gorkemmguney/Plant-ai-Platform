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
import { apiClient } from '../../services/apiClient';
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
}

interface Bundle {
  bundle_id: number;
  title: string;
  description: string | null;
  total_price: number;
  items: BundleItem[];
}

// Ürünler ekranı sekmeleri
type Segment = 'plant' | 'supply' | 'bundles';
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'plant', label: 'Çiçekler' },
  { key: 'supply', label: 'Malzemeler' },
  { key: 'bundles', label: 'Paketler' },
];

interface CharacteristicOption {
  gnl_char_id: number;
  name: string;
  values: { gnl_char_val_id: number; value: string }[];
}

type SortMode = 'default' | 'price_asc' | 'price_desc';

const SORT_LABELS: Record<SortMode, string> = {
  default: 'Sırala',
  price_asc: 'Fiyat ↑',
  price_desc: 'Fiyat ↓',
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
      .catch(() => {});
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
      setError(err?.response?.data?.detail ?? 'Ürünler yüklenemedi.');
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
      Alert.alert('Eklenemedi', 'Bu paketteki ürünler şu an stokta yok.');
    } else {
      Alert.alert(
        'Sepete eklendi 🛒',
        skipped > 0 ? `${added} ürün eklendi, ${skipped} ürün stokta yok.` : `${bundle.title} sepete eklendi.`,
        [
          { text: 'Sepete git', onPress: () => navigation.navigate('Cart') },
          { text: 'Tamam' },
        ]
      );
    }
  };

  useEffect(() => {
    apiClient
      .get<CharacteristicOption[]>('/catalog/characteristics')
      .then(({ data }) => setAllCharacteristics(data))
      .catch(() => {});
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
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openAddModal(item)}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} />
        ) : (
          <View style={styles.thumb}>
            <Text style={styles.thumbEmoji}>🪴</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {cheapest && (
              <View style={styles.cheapBadge}>
                <Text style={styles.cheapBadgeText}>En ucuz</Text>
              </View>
            )}
          </View>
          {!!item.seller_name && (
            <Text style={styles.seller} numberOfLines={1}>Satıcı: {item.seller_name}</Text>
          )}
          <Text style={[styles.stock, out && styles.stockOut]}>
            {out ? 'Stokta yok' : `Stok: ${item.stock}`}
          </Text>
        </View>
        <View style={styles.buyCol}>
          <Text style={styles.price}>₺{Number(item.price).toFixed(2)}</Text>
          <TouchableOpacity
            style={[styles.buyButton, out && styles.buyButtonDisabled]}
            onPress={() => openAddModal(item)}
            disabled={out}
            activeOpacity={0.85}
          >
            <Text style={styles.buyButtonText}>Sepete Ekle</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderBundle = ({ item }: { item: Bundle }) => (
    <View style={styles.bundleCard}>
      <Text style={styles.bundleTitle}>{item.title}</Text>
      {!!item.description && <Text style={styles.bundleDesc}>{item.description}</Text>}
      <View style={styles.bundleItems}>
        {item.items.map((it) => (
          <View key={it.prod_id} style={styles.bundleItemRow}>
            <Text style={styles.bundleItemName} numberOfLines={1}>
              🌿 {it.name}
              {it.quantity > 1 ? ` × ${it.quantity}` : ''}
            </Text>
            <Text style={styles.bundleItemPrice}>₺{Number(it.price).toFixed(2)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.bundleFooter}>
        <View>
          <Text style={styles.bundleTotalLabel}>Paket toplamı</Text>
          <Text style={styles.bundleTotal}>₺{Number(item.total_price).toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.bundleAddBtn} onPress={() => addBundleToCart(item)} activeOpacity={0.85}>
          <Text style={styles.bundleAddText}>Sepete Ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Ürünler</Text>
            <Text style={styles.headerSub}>Bitkileri keşfet ve satın al</Text>
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
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{s.label}</Text>
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
                  Filtrele{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn} onPress={() => setSortModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="swap-vertical-outline" size={15} color={colors.ink} />
                <Text style={styles.toolbarBtnText}>{SORT_LABELS[sortMode]}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ürün ara"
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
            ListEmptyComponent={<Text style={styles.emptyText}>Şu an hazır paket yok.</Text>}
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
            <Text style={styles.retryText}>Tekrar dene</Text>
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
                ? 'Bu kriterlere uyan ürün bulunamadı.'
                : segment === 'supply'
                ? 'Henüz malzeme ürünü yok.'
                : 'Henüz ürün yok. Satıcılar ekledikçe burada görünür.'}
            </Text>
          }
        />
      )}

      {/* Sepete ekle modalı */}
      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
              {selected?.image_url ? (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomImageUrl(selected.image_url)}>
                  <Image source={{ uri: selected.image_url }} style={styles.modalImage} />
                  <View style={styles.zoomHint}>
                    <Ionicons name="expand-outline" size={14} color={colors.white} />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.modalImage, styles.modalImagePlaceholder]}>
                  <Text style={{ fontSize: 40 }}>🪴</Text>
                </View>
              )}

              <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
              <Text style={styles.modalPrice}>₺{Number(selected?.price ?? 0).toFixed(2)}</Text>
              <Text style={styles.modalStock}>Stok: {selected?.stock ?? 0}</Text>

              {prodReviews.count > 0 && (
                <View style={styles.reviewBox}>
                  <View style={styles.reviewSummary}>
                    <Text style={styles.reviewAvg}>⭐ {prodReviews.average.toFixed(1)}</Text>
                    <Text style={styles.reviewCount}>{prodReviews.count} değerlendirme</Text>
                  </View>
                  {prodReviews.reviews.slice(0, 3).map((r: any) => (
                    <View key={r.review_id} style={styles.reviewItem}>
                      <Text style={styles.reviewStars}>
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </Text>
                      {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {infoGroups.length > 0 && (
                <View style={styles.infoBadgeRow}>
                  {infoGroups.map((g) => (
                    <View key={g.gnl_char_id} style={styles.infoBadge}>
                      <Text style={styles.infoBadgeText}>
                        {g.char_name}: {g.options[0].value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

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

              <Text style={styles.modalLabel}>Adet</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))} activeOpacity={0.7}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{qty}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQty((q) => Math.min(selected?.stock ?? 1, q + 1))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setSelected(null)} activeOpacity={0.85}>
                  <Text style={styles.modalCancelText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAdd, !canAdd && styles.modalAddDisabled]}
                  onPress={confirmAdd}
                  disabled={!canAdd}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalAddText}>Sepete Ekle ({qty})</Text>
                </TouchableOpacity>
              </View>
              {!canAdd && (
                <Text style={styles.warnText}>Devam etmeden önce yukarıdaki seçenekleri belirleyin.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Filtre modalı: 1. seviye karakteristik listesi, 2. seviye deger secimi */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable style={styles.filterModalWrap} onPress={() => setFilterModalVisible(false)}>
          <Pressable style={styles.filterModalCard} onPress={() => {}}>
            <View style={styles.filterModalHeader}>
              {filterDrillChar !== null ? (
                <TouchableOpacity onPress={() => setFilterDrillChar(null)} style={styles.filterBackBtn} activeOpacity={0.7}>
                  <Text style={styles.filterBackText}>‹ Geri</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.filterBackBtn} />
              )}
              <Text style={styles.filterModalTitle} numberOfLines={1}>
                {filterDrillChar === null
                  ? 'Filtrele'
                  : allCharacteristics.find((c) => c.gnl_char_id === filterDrillChar)?.name ?? ''}
              </Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.filterCloseText}>Kapat</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll} bounces={false} overScrollMode="never">
              {filterDrillChar === null ? (
                allCharacteristics.length === 0 ? (
                  <Text style={styles.filterEmptyText}>Henüz tanımlı karakteristik yok.</Text>
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
                <Text style={styles.filterClearText}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.filterApplyText}>
                  Uygula{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
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
            <Text style={styles.filterModalTitle}>Sırala</Text>
            {(
              [
                { key: 'default', label: 'Varsayılan' },
                { key: 'price_asc', label: 'Fiyat: Düşükten Yükseğe' },
                { key: 'price_desc', label: 'Fiyat: Yüksekten Düşüğe' },
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

      {/* Tam ekran görsel büyütme */}
      <Modal
        visible={zoomImageUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.fullscreenImageWrap}
          activeOpacity={1}
          onPress={() => setZoomImageUrl(null)}
        >
          {zoomImageUrl && (
            <Image source={{ uri: zoomImageUrl }} style={styles.fullscreenImage} resizeMode="contain" />
          )}
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setZoomImageUrl(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
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
  thumbEmoji: { fontSize: 28 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, flexShrink: 1 },
  cheapBadge: { backgroundColor: badgeColors.green.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  cheapBadgeText: { fontFamily: fonts.sansBold, fontSize: 9.5, color: badgeColors.green.text },
  seller: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted2, marginTop: 2 },
  description: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  stock: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted2, marginTop: 4 },
  stockOut: { color: colors.red },
  buyCol: { alignItems: 'flex-end', gap: spacing.sm },
  price: { fontFamily: fonts.display, fontSize: 15, color: colors.primaryDeep },
  buyButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    minWidth: 78,
    alignItems: 'center',
  },
  buyButtonDisabled: { backgroundColor: colors.border },
  buyButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.buttonPrimaryText },
  // Paket kartı
  bundleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
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
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  bundleAddText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
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
  reviewStars: { fontSize: 13, color: '#f5a524' },
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
    flex: 1,
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
});
