import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { describeWeatherCode, fetchWeather, WeatherData } from '../../services/weather';
import { colors, fonts, gradients, radius, shadow, spacing } from '../../theme/theme';

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
  image_url: string | null;
  characteristics: ProductCharacteristic[];
}

interface QuickTile {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: (navigation: any) => void;
}

const QUICK_TILES: QuickTile[] = [
  { key: 'analyze', label: 'AI Teşhis', icon: 'camera', onPress: (nav) => nav.navigate('ImageAnalysis') },
  { key: 'garden', label: 'Bahçem', icon: 'leaf', onPress: (nav) => nav.navigate('MyGarden') },
  { key: 'chat', label: 'AI Sohbet', icon: 'chatbubble-ellipses', onPress: (nav) => nav.navigate('ChatScreen') },
  { key: 'community', label: 'Topluluk', icon: 'people', onPress: (nav) => nav.navigate('CommunityFeed') },
];

const FALLBACK_COORDS = { latitude: 41.0082, longitude: 28.9784 };

export default function HomeScreen({ navigation }: any) {
  const { firebaseUser, firstName, points, refreshProfile } = useAuth();

  // Ekrana her dönüşte profili (puan dahil) yenile — sipariş sonrası puan güncellensin
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [])
  );
  const { count, addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [locationName, setLocationName] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      let coords = FALLBACK_COORDS;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          coords = pos.coords;
        }
      } catch {
        // sessizce varsayılan konuma düş
      }
      const data = await fetchWeather(coords.latitude, coords.longitude);
      setWeather(data);

      // Koordinati sehir/ilce adina cevir (expo-location ters cografi kodlama)
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        const place = places?.[0];
        const name = place?.district || place?.subregion || place?.city || place?.region || null;
        setLocationName(name);
      } catch {
        setLocationName(null);
      }
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await apiClient.get<Product[]>('/catalog/products');
        if (active) setProducts(data);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoadingProducts(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName = firstName || firebaseUser?.email?.split('@')[0] || 'Bitki Sever';
  const featured = products.slice(0, 6);
  const weatherInfo = weather ? describeWeatherCode(weather.weatherCode, weather.isDay) : null;

  return (
    <LinearGradient colors={gradients.screenBg} locations={[0, 0.45, 1]} style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>Merhaba, {displayName}</Text>
              <Text style={styles.headerSub}>Bugün bitkilerine göz atalım 🌿</Text>
              <TouchableOpacity
                style={styles.pointsPill}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Campaigns')}
              >
                <Ionicons name="sparkles" size={12} color={colors.primaryDeep} />
                <Text style={styles.pointsText}>{points} puan</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.primaryDeep} />
              </TouchableOpacity>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Orders')} activeOpacity={0.7}>
                <Ionicons name="receipt-outline" size={18} color={colors.ink} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Cart')} activeOpacity={0.7}>
                <Ionicons name="cart-outline" size={18} color={colors.ink} />
                {count > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
                <Ionicons name="notifications-outline" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>
          </View>

        </View>

        {/* Hava durumu — koşula göre değişen gökyüzü sahnesi */}
        <View style={styles.weatherRow}>
          {weatherLoading ? (
            <View style={[styles.weatherCard, styles.weatherLoadingCard]}>
              <ActivityIndicator color={colors.primaryDeep} />
            </View>
          ) : weather && weatherInfo ? (
            <ImageBackground
              source={weatherInfo.image}
              style={styles.weatherCard}
              imageStyle={styles.weatherCardImage}
              resizeMode="cover"
            >
              <View style={styles.weatherScrim} />
              <View style={styles.weatherLeft}>
                <Text style={[styles.weatherTemp, { color: weatherInfo.onColor }]}>
                  {weather.temperature}°C
                </Text>
                <Text style={[styles.weatherLabel, { color: weatherInfo.onColor }]}>
                  {weatherInfo.label}
                </Text>
                {!!locationName && (
                  <View style={styles.weatherLocRow}>
                    <Ionicons name="location" size={12} color={weatherInfo.onColor} />
                    <Text style={[styles.weatherLoc, { color: weatherInfo.onColor }]} numberOfLines={1}>
                      {locationName}
                    </Text>
                  </View>
                )}
                {!!weatherInfo.tip && (
                  <Text style={[styles.weatherTip, { color: weatherInfo.onColor }]} numberOfLines={2}>
                    {weatherInfo.tip}
                  </Text>
                )}
              </View>
            </ImageBackground>
          ) : (
            <View style={[styles.weatherCard, styles.weatherLoadingCard]}>
              <Text style={styles.weatherErrorText}>Hava durumu şu an alınamıyor</Text>
            </View>
          )}
        </View>

        {/* Arama çubuğu — Mağaza'ya götürür */}
        <TouchableOpacity
          style={styles.searchStandalone}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Tabs', { screen: 'Marketplace' })}
        >
          <Ionicons name="search" size={17} color={colors.muted2} />
          <Text style={styles.searchText}>Bitki ara...</Text>
        </TouchableOpacity>

        {/* Hızlı erişim — cam daireler */}
        <View style={styles.sectionHeader}>
          <Text style={styles.h2}>Hızlı Erişim</Text>
        </View>
        <View style={styles.categories}>
          {QUICK_TILES.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={styles.circle}
              activeOpacity={0.85}
              onPress={() => tile.onPress(navigation)}
            >
              <View style={styles.circleIconWrap}>
                <Ionicons name={tile.icon} size={24} color={colors.primaryDeep} />
              </View>
              <Text style={styles.circleLabel}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Öne çıkan ilanlar */}
        <View style={styles.sectionHeader}>
          <Text style={styles.h2}>Öne Çıkan İlanlar</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Tabs', { screen: 'Marketplace' })}>
            <Text style={styles.sectionLink}>Tümü</Text>
          </TouchableOpacity>
        </View>

        {loadingProducts ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : featured.length === 0 ? (
          <Text style={styles.emptyText}>Henüz ürün yok. Satıcılar ekledikçe burada görünür.</Text>
        ) : (
          <View style={styles.cards}>
            {featured.map((item) => {
              const inStock = item.stock > 0;
              return (
                <TouchableOpacity
                  key={item.prod_id}
                  style={styles.card}
                  activeOpacity={0.88}
                  onPress={() => {
                    setSelectedProduct(item);
                    setQty(1);
                  }}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                  ) : (
                    <View style={styles.cardImage}>
                      <Ionicons name="leaf" size={34} color={colors.primaryDeep} />
                    </View>
                  )}
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.statusPill, !inStock && styles.statusPillOut]}>
                      <Text style={[styles.statusDot, !inStock && styles.statusDotOut]}>●</Text>
                      <Text style={[styles.statusText, !inStock && styles.statusTextOut]}>
                        {inStock ? `₺${Number(item.price).toFixed(2)}` : 'Stokta yok'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Ürün detay modalı — dokununca özellikler burada görünür */}
      <Modal
        visible={selectedProduct !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.detailModalWrap}>
          <View style={styles.detailModalCard}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
              <Text style={styles.detailTitle} numberOfLines={2}>{selectedProduct?.name}</Text>
              {!!selectedProduct?.description && (
                <Text style={styles.detailDescription}>{selectedProduct.description}</Text>
              )}
              <Text style={styles.detailPrice}>₺{Number(selectedProduct?.price ?? 0).toFixed(2)}</Text>
              <Text style={styles.detailStock}>Stok: {selectedProduct?.stock ?? 0}</Text>

              {selectedProduct && selectedProduct.characteristics.length > 0 && (
                <>
                  <Text style={styles.detailLabel}>Özellikler</Text>
                  <View style={styles.detailBadgeRow}>
                    {selectedProduct.characteristics.map((c) => (
                      <View key={`${c.gnl_char_id}-${c.gnl_char_val_id}`} style={styles.detailBadge}>
                        <Text style={styles.detailBadgeText}>{c.char_name}: {c.value}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.detailLabel}>Adet</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))} activeOpacity={0.7}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{qty}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQty((q) => Math.min(selectedProduct?.stock ?? 1, q + 1))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={styles.detailCancel}
                  onPress={() => setSelectedProduct(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.detailCancelText}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailAdd, (selectedProduct?.stock ?? 0) < 1 && styles.detailAddDisabled]}
                  disabled={(selectedProduct?.stock ?? 0) < 1}
                  onPress={() => {
                    if (!selectedProduct) return;
                    addToCart(selectedProduct, qty, []);
                    setSelectedProduct(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.detailAddText}>Sepete Ekle ({qty})</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 25, paddingBottom: 20 },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  h1: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginTop: 5 },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  pointsText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primaryDeep },
  headerIcons: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.white },
  search: {
    marginTop: 25,
    height: 58,
    backgroundColor: colors.white,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 25,
    elevation: 3,
  },
  searchText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted2 },
  weatherRow: { paddingHorizontal: 25, marginTop: spacing.md },
  searchStandalone: {
    marginTop: spacing.md,
    marginHorizontal: 25,
    height: 54,
    backgroundColor: colors.white,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 25,
    padding: spacing.lg,
    minHeight: 118,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  weatherLoadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  weatherCardImage: { borderRadius: 25 },
  weatherScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  weatherLeft: { flex: 1 },
  weatherLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  weatherLoc: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  weatherTemp: { fontFamily: fonts.display, fontSize: 32, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  weatherLabel: { fontFamily: fonts.sansBold, fontSize: 14, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  weatherTip: { fontFamily: fonts.sans, fontSize: 11.5, marginTop: 6, opacity: 0.85, lineHeight: 16 },
  weatherErrorText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 25,
  },
  h2: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink },
  sectionLink: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.muted },
  categories: { flexDirection: 'row', gap: 10, paddingHorizontal: 25, paddingVertical: 20 },
  circle: {
    flex: 1,
    minWidth: 0,
    height: 120,
    backgroundColor: colors.glass,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  circleIconWrap: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLabel: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink, marginTop: 12 },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 18,
  },
  card: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 145,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { padding: 16 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15.5, color: colors.ink, marginBottom: 10 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 25,
    backgroundColor: colors.primarySoft,
  },
  statusPillOut: { backgroundColor: '#fbe4e8' },
  statusDot: { fontSize: 8, color: colors.primaryDeep },
  statusDotOut: { color: colors.red },
  statusText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.primaryDeep },
  statusTextOut: { color: colors.red },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: 25,
    lineHeight: 20,
  },
  detailModalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  detailModalCard: {
    backgroundColor: colors.white,
    borderRadius: 25,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  detailTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  detailDescription: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  detailPrice: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.primaryDeep, marginTop: spacing.md },
  detailStock: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  detailLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    color: colors.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  detailBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detailBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  detailBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.primaryDeep },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink },
  qtyValue: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink, minWidth: 26, textAlign: 'center' },
  detailActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  detailCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailCancelText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  detailAdd: {
    flex: 1.4,
    backgroundColor: colors.buttonPrimary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailAddDisabled: { backgroundColor: colors.border },
  detailAddText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
});
