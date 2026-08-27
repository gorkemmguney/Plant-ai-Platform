import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Dimensions, Image, ImageBackground, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../i18n';
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
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: (navigation: any) => void;
}

const QUICK_TILES: QuickTile[] = [
  { key: 'analyze', labelKey: 'home.tile.analyze', icon: 'camera', onPress: (nav) => nav.navigate('ImageAnalysis') },
  { key: 'garden', labelKey: 'home.tile.garden', icon: 'leaf', onPress: (nav) => nav.navigate('MyGarden') },
  { key: 'chat', labelKey: 'home.tile.chat', icon: 'chatbubble-ellipses', onPress: (nav) => nav.navigate('ChatScreen') },
  { key: 'community', labelKey: 'home.tile.community', icon: 'people', onPress: (nav) => nav.navigate('CommunityFeed') },
];

const FALLBACK_COORDS = { latitude: 41.0082, longitude: 28.9784 };

// GECICI: sunum/ekran goruntusu icin hava durumunu her zaman "gunesli" goster.
// Gercek hava durumuna donmek icin bu satiri null yap.
const DEMO_WEATHER_CODE: number | null = null;

export default function HomeScreen({ navigation }: any) {
  const { firebaseUser, firstName, points, refreshProfile } = useAuth();
  const { t } = useI18n();

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
  const [heroIndex, setHeroIndex] = useState(0);

  // Canlı Geri Sayım Sayacı (Fırsat Ürünü için)
  const [secondsLeft, setSecondsLeft] = useState(15420); // 04:17:00
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 15420));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  const displayName = firstName || firebaseUser?.email?.split('@')[0] || t('home.defaultName');
  const featured = products.slice(0, 6);
  const weatherInfo = weather ? describeWeatherCode(DEMO_WEATHER_CODE ?? weather.weatherCode, true) : null;

  return (
    <LinearGradient colors={gradients.screenBg} locations={[0, 0.45, 1]} style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>{t('home.hello')}, {displayName}</Text>
              <Text style={styles.headerSub}>{t('home.sub')}</Text>
              <TouchableOpacity
                style={styles.pointsPill}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Campaigns')}
              >
                <Ionicons name="sparkles" size={12} color={colors.primaryDeep} />
                <Text style={styles.pointsText}>{points} {t('home.points')}</Text>
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
                  {t(weatherInfo.labelKey)}
                </Text>
                {!!locationName && (
                  <View style={styles.weatherLocRow}>
                    <Ionicons name="location" size={12} color={weatherInfo.onColor} />
                    <Text style={[styles.weatherLoc, { color: weatherInfo.onColor }]} numberOfLines={1}>
                      {locationName}
                    </Text>
                  </View>
                )}
                {!!weatherInfo.tipKey && (
                  <Text style={[styles.weatherTip, { color: weatherInfo.onColor }]} numberOfLines={2}>
                    {t(weatherInfo.tipKey)}
                  </Text>
                )}
              </View>
            </ImageBackground>
          ) : (
            <View style={[styles.weatherCard, styles.weatherLoadingCard]}>
              <Text style={styles.weatherErrorText}>{t('home.weatherUnavailable')}</Text>
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
          <Text style={styles.searchText}>{t('home.searchPlaceholder')}</Text>
        </TouchableOpacity>

        {/* Hızlı erişim — Şık Arka Plan Kartı İçinde Temiz Butonlar */}
        <View style={styles.quickAccessWrapper}>
          <LinearGradient
            colors={['#DCF3E4', '#BBE7C7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickAccessGradient}
          >
            <View style={styles.quickAccessHeader}>
              <Text style={styles.h2}>{t('home.quickAccess')}</Text>
              <View style={styles.quickAccessPill}>
                <Ionicons name="flash-outline" size={12} color={colors.primaryDeep} />
                <Text style={styles.quickAccessPillText}>Hızlı İşlemler</Text>
              </View>
            </View>

            <View style={styles.categories}>
              {QUICK_TILES.map((tile) => (
                <TouchableOpacity
                  key={tile.key}
                  style={styles.circle}
                  activeOpacity={0.88}
                  onPress={() => tile.onPress(navigation)}
                >
                  <View style={styles.circleIconWrap}>
                    <Ionicons name={tile.icon} size={22} color={colors.primaryDeep} />
                  </View>
                  <Text style={styles.circleLabel} numberOfLines={1}>{t(tile.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Öne çıkanlar — Hero Spotlight & Fırsat Vitrini */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.h2}>{t('home.featured')}</Text>
            <View style={styles.spotlightPill}>
              <Ionicons name="sparkles" size={12} color="#f5a524" />
              <Text style={styles.spotlightPillText}>Spotlight</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Tabs', { screen: 'Marketplace' })} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>{t('home.all')} ›</Text>
          </TouchableOpacity>
        </View>

        {loadingProducts ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : featured.length === 0 ? (
          <Text style={styles.emptyText}>{t('home.emptyProducts')}</Text>
        ) : (
          <View style={styles.spotlightSectionWrap}>
            {/* 1. Hero Spotlight BÜYÜK KART (Slider & Canlı Geri Sayım) */}
            {featured.length > 0 && (
              <View style={styles.heroSliderWrap}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    const width = e.nativeEvent.layoutMeasurement.width;
                    const offset = e.nativeEvent.contentOffset.x;
                    if (width > 0) {
                      const idx = Math.round(offset / width);
                      setHeroIndex(idx);
                    }
                  }}
                  scrollEventThrottle={16}
                >
                  {featured.slice(0, 3).map((heroItem, idx) => (
                    <TouchableOpacity
                      key={heroItem.prod_id}
                      style={styles.heroSpotlightCard}
                      activeOpacity={0.92}
                      onPress={() => {
                        setSelectedProduct(heroItem);
                        setQty(1);
                      }}
                    >
                      {heroItem.image_url ? (
                        <Image source={{ uri: heroItem.image_url }} style={styles.heroSpotlightImage} />
                      ) : (
                        <View style={styles.heroSpotlightPlaceholder}>
                          <Ionicons name="leaf" size={64} color={colors.primaryDeep} />
                        </View>
                      )}

                      <LinearGradient
                        colors={['transparent', 'rgba(15, 42, 31, 0.75)', 'rgba(15, 42, 31, 0.96)']}
                        style={styles.heroSpotlightGradient}
                      >
                        {/* Canlı Geri Sayım & Rozetler */}
                        <View style={styles.heroBadgeRow}>
                          <View style={[styles.heroBadge, { backgroundColor: '#e0556b' }]}>
                            <Ionicons name="time-outline" size={12} color={colors.white} />
                            <Text style={styles.heroBadgeText}>⏳ Son {formatCountdown(secondsLeft)}</Text>
                          </View>

                          <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>
                              {idx === 0 ? '🌿 GÜNÜN FIRSATI' : idx === 1 ? '🔥 ÇOK SATAN' : '⭐ ÖZEL SEÇİM'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.heroSpotlightTitle} numberOfLines={1}>{heroItem.name}</Text>

                        {/* Bitki Özellik Rozetleri */}
                        <View style={styles.heroCarePillsRow}>
                          <View style={styles.heroCarePill}>
                            <Text style={styles.heroCarePillText}>☀️ Bol Işık</Text>
                          </View>
                          <View style={styles.heroCarePill}>
                            <Text style={styles.heroCarePillText}>💧 Az Sulama</Text>
                          </View>
                          <View style={styles.heroCarePill}>
                            <Text style={styles.heroCarePillText}>🐾 Evcil Dostu</Text>
                          </View>
                        </View>

                        <View style={styles.heroFooterRow}>
                          <View>
                            <Text style={styles.heroPriceLabel}>Fırsat Fiyatı</Text>
                            <Text style={styles.heroPriceText}>₺{Number(heroItem.price).toFixed(2)}</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.heroCtaBtn}
                            activeOpacity={0.85}
                            onPress={() => {
                              setSelectedProduct(heroItem);
                              setQty(1);
                            }}
                          >
                            <Text style={styles.heroCtaBtnText}>İncele & Al</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.white} />
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Hero Slider Nokta Göstergeleri (•••) */}
                {featured.slice(0, 3).length > 1 && (
                  <View style={styles.heroDotsRow}>
                    {featured.slice(0, 3).map((_, idx) => (
                      <View
                        key={idx}
                        style={[styles.heroDot, heroIndex === idx && styles.heroDotActive]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 2. İkincil Öne Çıkanlar (Yatay Mini Şerit) */}
            {featured.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.miniCarousel}
              >
                {featured.slice(1).map((item) => {
                  const inStock = item.stock > 0;
                  return (
                    <TouchableOpacity
                      key={item.prod_id}
                      style={styles.miniCard}
                      activeOpacity={0.88}
                      onPress={() => {
                        setSelectedProduct(item);
                        setQty(1);
                      }}
                    >
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.miniCardImage} />
                      ) : (
                        <View style={styles.miniCardPlaceholder}>
                          <Ionicons name="leaf" size={24} color={colors.primaryDeep} />
                        </View>
                      )}
                      <View style={styles.miniCardInfo}>
                        <Text style={styles.miniCardTitle} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.miniCardPrice}>₺{Number(item.price).toFixed(2)}</Text>
                      </View>

                      <View style={styles.miniCardActionsRow}>
                        <TouchableOpacity
                          style={styles.miniCardInspectBtn}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedProduct(item);
                            setQty(1);
                          }}
                        >
                          <Text style={styles.miniCardInspectText}>İncele</Text>
                        </TouchableOpacity>

                        {inStock && (
                          <TouchableOpacity
                            style={styles.miniCardAddBtn}
                            activeOpacity={0.8}
                            onPress={(e) => {
                              e.stopPropagation();
                              addToCart(item, 1, []);
                            }}
                          >
                            <Ionicons name="add" size={16} color={colors.white} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </ScrollView>

      {/* Ürün Detay & İnceleme Bottom Sheet Modalı */}
      <Modal
        visible={selectedProduct !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContentContainer}>
            {/* Top Drag Indicator Bar */}
            <View style={styles.sheetDragBar} />

            <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 100 }}>
              {/* Product Hero Image Header */}
              <View style={styles.sheetImageHeader}>
                {selectedProduct?.image_url ? (
                  <Image source={{ uri: selectedProduct.image_url }} style={styles.sheetImage} resizeMode="cover" />
                ) : (
                  <View style={styles.sheetImagePlaceholder}>
                    <Ionicons name="leaf" size={64} color={colors.primaryDeep} />
                  </View>
                )}

                {/* Overlaid Close Button */}
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSelectedProduct(null)} activeOpacity={0.8}>
                  <Ionicons name="close" size={20} color={colors.ink} />
                </TouchableOpacity>

                {/* Overlaid Badges */}
                <View style={styles.sheetImageBadgeRow}>
                  <View style={styles.sheetStockBadge}>
                    <Text style={styles.sheetStockBadgeDot}>●</Text>
                    <Text style={styles.sheetStockBadgeText}>
                      {(selectedProduct?.stock ?? 0) > 0 ? `Stokta Var (${selectedProduct?.stock} Adet)` : t('home.outOfStock')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sheetBody}>
                {/* Title & Price */}
                <Text style={styles.sheetProductTitle}>{selectedProduct?.name}</Text>
                
                {/* Ratings & Reviews Bar */}
                <View style={styles.sheetRatingRow}>
                  <View style={styles.sheetStarsWrap}>
                    <Ionicons name="star" size={16} color="#f5a524" />
                    <Text style={styles.sheetRatingScore}>4.8</Text>
                  </View>
                  <Text style={styles.sheetRatingCount}>(48 Değerlendirme & Yorum)</Text>
                  <View style={styles.sheetVerifiedPill}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.primaryDeep} />
                    <Text style={styles.sheetVerifiedPillText}>Onaylı Mağaza</Text>
                  </View>
                </View>

                {/* Store & Seller Info Card */}
                <View style={styles.sheetStoreCard}>
                  <View style={styles.sheetStoreAvatar}>
                    <Ionicons name="storefront-outline" size={20} color={colors.primaryDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetStoreName}>Yeşil Bahçe Seracılık</Text>
                    <Text style={styles.sheetStoreSub}>%98 Olumlu Mağaza Puanı • 🚀 Hızlı Kargo</Text>
                  </View>
                  <TouchableOpacity style={styles.sheetStoreVisitBtn} onPress={() => {
                    setSelectedProduct(null);
                    navigation.navigate('Tabs', { screen: 'Stores' });
                  }}>
                    <Text style={styles.sheetStoreVisitText}>Mağaza ›</Text>
                  </TouchableOpacity>
                </View>

                {/* Description */}
                {!!selectedProduct?.description && (
                  <Text style={styles.sheetDescription}>{selectedProduct.description}</Text>
                )}

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

                {/* Characteristics Badges */}
                {selectedProduct && selectedProduct.characteristics.length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={styles.sheetSectionTitle}>{t('home.characteristics')}</Text>
                    <View style={styles.detailBadgeRow}>
                      {selectedProduct.characteristics.map((c) => (
                        <View key={`${c.gnl_char_id}-${c.gnl_char_val_id}`} style={styles.detailBadge}>
                          <Text style={styles.detailBadgeText}>{c.char_name}: {c.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Müşteri Değerlendirmeleri ve Yorumlar Bölümü */}
                <View style={styles.reviewsSectionWrap}>
                  <Text style={styles.sheetSectionTitle}>⭐ Müşteri Değerlendirmeleri (4.8)</Text>
                  
                  {/* Rating Score Card */}
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

                  {/* Örnek Müşteri Yorumları */}
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
                    <Text style={styles.reviewCommentText}>"Çok özenli paketlenmiş, kargo 1 günde ulaştı. Yaprakları capcanlı yeşil ve gür!"</Text>
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
                    <Text style={styles.reviewCommentText}>"Seradan direkt gelmiş gibi taptaze ve sağlıklı. Toprağı nemli teslim edildi, teşekkürler."</Text>
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
                  onPress={() => setQty((q) => Math.min(selectedProduct?.stock ?? 1, q + 1))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerQtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerPriceWrap}>
                <Text style={styles.footerPriceLabel}>Toplam Tutar</Text>
                <Text style={styles.footerPriceText}>
                  ₺{(Number(selectedProduct?.price ?? 0) * qty).toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.footerAddBtn, (selectedProduct?.stock ?? 0) < 1 && styles.footerAddBtnDisabled]}
                disabled={(selectedProduct?.stock ?? 0) < 1}
                onPress={() => {
                  if (!selectedProduct) return;
                  addToCart(selectedProduct, qty, []);
                  setSelectedProduct(null);
                }}
                activeOpacity={0.88}
              >
                <Ionicons name="cart" size={18} color={colors.white} />
                <Text style={styles.footerAddBtnText}>{t('home.addToCart')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const HERO_CARD_WIDTH = Dimensions.get('window').width - 50;

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
  quickAccessWrapper: {
    marginHorizontal: 25,
    marginTop: spacing.lg,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(29, 170, 99, 0.28)',
    elevation: 4,
    shadowColor: '#178A50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  quickAccessGradient: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  quickAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  quickAccessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(29, 170, 99, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  quickAccessPillText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primaryDeep },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 25,
  },
  h2: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink },
  sectionLink: { fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.primaryDeep },
  categories: { flexDirection: 'row', gap: 10, paddingVertical: spacing.sm },
  circle: {
    flex: 1,
    minWidth: 0,
    height: 105,
    backgroundColor: colors.white,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  circleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLabel: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.ink, marginTop: 8 },
  spotlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  spotlightPillText: { fontFamily: fonts.sansBold, fontSize: 11, color: '#b45309' },
  spotlightSectionWrap: {
    paddingHorizontal: 25,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  heroSliderWrap: {
    width: '100%',
    alignItems: 'center',
  },
  heroSpotlightCard: {
    width: HERO_CARD_WIDTH,
    height: 250,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  heroSpotlightImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    resizeMode: 'cover',
  },
  heroSpotlightPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  heroSpotlightGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  heroBadgeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(29, 170, 99, 0.88)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.white },
  heroSpotlightTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  heroCarePillsRow: { flexDirection: 'row', gap: spacing.xs, marginVertical: 6 },
  heroCarePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroCarePillText: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.white },
  heroFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  heroPriceLabel: { fontFamily: fonts.sans, fontSize: 10.5, color: 'rgba(255,255,255,0.7)' },
  heroPriceText: { fontFamily: fonts.display, fontSize: 20, color: '#4ade80' },
  heroCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    ...shadow.sm,
  },
  heroCtaBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.white },
  heroDotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.border,
  },
  heroDotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  miniCarousel: { gap: spacing.md, paddingTop: 4, paddingBottom: 8 },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    width: 220,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  miniCardImage: { width: 44, height: 44, borderRadius: radius.sm },
  miniCardPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardInfo: { flex: 1 },
  miniCardTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.ink },
  miniCardPrice: { fontFamily: fonts.display, fontSize: 13.5, color: colors.primaryDeep, marginTop: 1 },
  miniCardActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniCardInspectBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  miniCardInspectText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primaryDeep },
  miniCardAddBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.buttonPrimary,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  footerAddBtnDisabled: { backgroundColor: colors.border },
  footerAddBtnText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.buttonPrimaryText },
});
