import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, gradients, radius, shadow, spacing, badgeColors } from '../../theme/theme';

interface RecProduct {
  prod_id: number;
  name: string;
  price: string | number;
  stock: number;
  image_url: string | null;
  seller_id: number | null;
  seller_name: string | null;
}

interface CustProd {
  cust_prod_id: number;
  cust_id: number;
  prod_spec_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  health_status: string;
  location: string | null;
  watering_interval_days: number;
  last_watered_at: string;
  created_at: string;
  updated_at: string;
  species_name: string;
}

const LOCATIONS = [
  { key: 'all', label: '📍 Tüm Bahçe' },
  { key: 'Salon', label: '🛋️ Salon' },
  { key: 'Mutfak', label: '🍳 Mutfak' },
  { key: 'Yatak Odası', label: '🛏️ Yatak Odası' },
  { key: 'Balkon', label: '🌸 Balkon' },
  { key: 'Ofis', label: '💼 Ofis' },
  { key: 'Bahçe', label: '🌳 Dış Bahçe' },
];

export default function MyGardenScreen({ navigation }: any) {
  const { addToCart } = useCart();
  const [plants, setPlants] = useState<CustProd[]>([]);
  const [recs, setRecs] = useState<RecProduct[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wateringId, setWateringId] = useState<number | null>(null);
  const [bulkGroup, setBulkGroup] = useState<string | null>(null);

  const loadPlants = useCallback(async () => {
    try {
      const { data } = await apiClient.get<CustProd[]>('/customer-products');
      setPlants(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Bitkiler yüklenirken bir sorun oluştu.';
      Alert.alert('Hata', detail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Bahçedeki bitki türlerine göre kişisel öneriler
    apiClient
      .get<RecProduct[]>('/catalog/products/recommended?limit=6')
      .then(({ data }) => setRecs(data))
      .catch(() => setRecs([]));
  }, []);

  const handleAddRec = (p: RecProduct) => {
    addToCart(
      { prod_id: p.prod_id, name: p.name, price: p.price, stock: p.stock, seller_id: p.seller_id, seller_name: p.seller_name },
      1,
      []
    );
    Alert.alert('Sepete eklendi 🛒', `${p.name} sepete eklendi.`);
  };

  useFocusEffect(
    useCallback(() => {
      loadPlants();
    }, [loadPlants])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlants();
  };

  const handleWaterPlant = async (id: number) => {
    setWateringId(id);
    try {
      const { data } = await apiClient.post<CustProd>(`/customer-products/${id}/water`);
      setPlants((prev) => prev.map((p) => (p.cust_prod_id === id ? data : p)));
      Alert.alert('Harika!', `${data.name} sulandı! 💧`);
    } catch (err: any) {
      Alert.alert('Hata', 'Sulama işlemi kaydedilemedi.');
    } finally {
      setWateringId(null);
    }
  };

  const calculateWateringPercentage = (lastWateredStr: string, intervalDays: number) => {
    const lastWatered = new Date(lastWateredStr);
    const msPassed = Date.now() - lastWatered.getTime();
    const daysPassed = msPassed / (1000 * 60 * 60 * 24);
    const pct = Math.max(0, Math.min(100, 100 - (daysPassed / intervalDays) * 100));
    return Math.round(pct);
  };

  const calculateWateringStatus = (lastWateredStr: string, intervalDays: number) => {
    const lastWatered = new Date(lastWateredStr);
    const nextWateredTime = lastWatered.getTime() + intervalDays * 24 * 60 * 60 * 1000;
    const diffTime = nextWateredTime - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { label: 'Sulanmalı ⚠️', color: colors.red, bg: '#fbe4e8' };
    } else if (diffDays === 1) {
      return { label: 'Yarın', color: colors.amber, bg: '#fdf0dc' };
    } else {
      return { label: `${diffDays} gün`, color: colors.primaryDeep, bg: colors.primarySoft };
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return { label: 'Sağlıklı', ...badgeColors.green };
      case 'diseased':
        return { label: 'Hasta', ...badgeColors.red };
      case 'pest_damage':
        return { label: 'Zararlı', ...badgeColors.amber };
      default:
        return { label: 'Bilinmiyor', bg: colors.bgAlt, text: colors.muted };
    }
  };

  const filteredPlants = plants.filter(
    (p) => selectedLocation === 'all' || p.location === selectedLocation
  );

  // Bitkileri türe (species_name) göre grupla — SectionList için
  const sections = useMemo(() => {
    const map = new Map<string, CustProd[]>();
    filteredPlants.forEach((p) => {
      const key = p.species_name || 'Diğer';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredPlants]);

  // Bir gruptaki tüm bitkileri toplu sula
  const handleWaterGroup = async (title: string, groupPlants: CustProd[]) => {
    setBulkGroup(title);
    try {
      const results = await Promise.all(
        groupPlants.map((p) =>
          apiClient
            .post<CustProd>(`/customer-products/${p.cust_prod_id}/water`)
            .then((r) => r.data)
            .catch(() => null)
        )
      );
      const updated = results.filter((r): r is CustProd => r !== null);
      setPlants((prev) => prev.map((p) => updated.find((u) => u.cust_prod_id === p.cust_prod_id) ?? p));
      Alert.alert('Sulandı 💧', `${title} grubundaki ${updated.length} bitki sulandı.`);
    } finally {
      setBulkGroup(null);
    }
  };

  const renderItem = ({ item }: { item: CustProd }) => {
    const moisturePct = calculateWateringPercentage(item.last_watered_at, item.watering_interval_days);
    const waterStatus = calculateWateringStatus(item.last_watered_at, item.watering_interval_days);
    const health = getHealthBadge(item.health_status);
    const isWatering = wateringId === item.cust_prod_id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.95}
        onPress={() => navigation.navigate('PlantDetail', { custProdId: item.cust_prod_id })}
      >
        <View style={styles.cardMain}>
          <View style={styles.imageContainer}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.plantImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="leaf" size={32} color={colors.primaryDeep} />
              </View>
            )}
            {item.location && (
              <View style={styles.cardLocationTag}>
                <Text style={styles.cardLocationText}>📍 {item.location}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.plantName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.miniBadge, { backgroundColor: health.bg }]}>
                <Text style={[styles.miniBadgeText, { color: health.text }]}>{health.label}</Text>
              </View>
            </View>
            
            <Text style={styles.speciesName} numberOfLines={1}>{item.species_name}</Text>

            {/* Moisture Progress Bar */}
            <View style={styles.moistureSection}>
              <View style={styles.moistureHeader}>
                <Text style={styles.moistureTitle}>Toprak Nemi</Text>
                <Text style={[styles.moistureValue, { color: moisturePct < 25 ? colors.red : moisturePct < 50 ? colors.amber : colors.primaryDeep }]}>
                  %{moisturePct}
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${moisturePct}%`,
                      backgroundColor: moisturePct < 25 ? colors.red : moisturePct < 50 ? colors.amber : colors.primary,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Care details */}
            <View style={styles.bottomMetaRow}>
              <View style={styles.metaLabelWrap}>
                <Ionicons name="time-outline" size={14} color={colors.muted} />
                <Text style={styles.metaLabel}>Sulama: {waterStatus.label}</Text>
              </View>
              
              <TouchableOpacity
                style={[styles.quickWaterBtn, isWatering && styles.waterButtonDisabled]}
                disabled={isWatering}
                onPress={() => handleWaterPlant(item.cust_prod_id)}
                activeOpacity={0.8}
              >
                {isWatering ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="water" size={13} color={colors.white} style={{ marginRight: 4 }} />
                    <Text style={styles.quickWaterBtnText}>Sula</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>Bitki Bahçem</Text>
            <Text style={styles.headerSub}>Bitkilerinizin sağlık ve nem seviyeleri</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddPlant')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Location Filter Scroll */}
      {!loading && plants.length > 0 && (
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {LOCATIONS.map((loc) => {
              const active = selectedLocation === loc.key;
              return (
                <TouchableOpacity
                  key={loc.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedLocation(loc.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {loc.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.cust_prod_id)}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {section.title} · {section.data.length}
              </Text>
              <TouchableOpacity
                style={[styles.groupWaterBtn, bulkGroup === section.title && styles.waterButtonDisabled]}
                onPress={() => handleWaterGroup(section.title, section.data)}
                disabled={bulkGroup === section.title}
                activeOpacity={0.8}
              >
                {bulkGroup === section.title ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.groupWaterText}>💧 Hepsini Sula</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListFooterComponent={
            plants.length > 0 && recs.length > 0 ? (
              <View style={styles.recSection}>
                <Text style={styles.recTitle}>🌱 Bahçene Göre Öneriler</Text>
                <Text style={styles.recSub}>Bitkilerine uygun ürünler ve bahçe malzemeleri</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recRow}>
                  {recs.map((p) => (
                    <View key={p.prod_id} style={styles.recCard}>
                      {p.image_url ? (
                        <Image source={{ uri: p.image_url }} style={styles.recImage} />
                      ) : (
                        <View style={styles.recImagePlaceholder}>
                          <Ionicons name="leaf" size={28} color={colors.primaryDeep} />
                        </View>
                      )}
                      <Text style={styles.recName} numberOfLines={1}>{p.name}</Text>
                      {!!p.seller_name && <Text style={styles.recSeller} numberOfLines={1}>{p.seller_name}</Text>}
                      <Text style={styles.recPrice}>₺{Number(p.price).toFixed(2)}</Text>
                      <TouchableOpacity style={styles.recAddBtn} onPress={() => handleAddRec(p)} activeOpacity={0.85}>
                        <Text style={styles.recAddText}>+ Sepete Ekle</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="leaf-outline" size={48} color={colors.primaryDeep} />
              </View>
              <Text style={styles.emptyTitle}>Bahçeniz Henüz Boş</Text>
              <Text style={styles.emptyText}>
                Bahçenize henüz bir bitki eklemediniz. Sağ üstteki artı (+) butonuyla yeni bir bitki kaydedebilir veya AI analizinden sonra bitkilerinizi buraya yönlendirebilirsiniz.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('AddPlant')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>İlk Bitkimi Ekle</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...shadow.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, marginLeft: spacing.sm },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 22, color: colors.white, letterSpacing: -0.5 },
  headerSub: { fontFamily: fonts.sansMedium, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.sm,
  },
  cardMain: { flexDirection: 'row', gap: spacing.md },
  imageContainer: {
    width: 100,
    height: 120,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bgAlt,
    position: 'relative',
  },
  plantImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardLocationTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  cardLocationText: { fontFamily: fonts.sansBold, fontSize: 8.5, color: colors.ink },
  infoContainer: { flex: 1, justifyContent: 'space-between' },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plantName: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink, flex: 1, marginRight: 8 },
  speciesName: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, fontStyle: 'italic', marginBottom: 4 },
  
  // Moisture meter
  moistureSection: { marginVertical: spacing.xs },
  moistureHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  moistureTitle: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.muted },
  moistureValue: { fontFamily: fonts.sansBold, fontSize: 11 },
  progressBarBg: { height: 6, width: '100%', backgroundColor: colors.borderSoft, borderRadius: radius.full, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: radius.full },

  // Bottom care meta
  bottomMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  metaLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaLabel: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted },
  quickWaterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  waterButtonDisabled: { opacity: 0.6 },
  quickWaterBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.white },

  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  miniBadgeText: { fontFamily: fonts.sansBold, fontSize: 9 },

  filterWrapper: {
    backgroundColor: colors.bg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
    ...shadow.sm,
  },
  filterChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.muted,
  },
  filterChipTextActive: {
    color: colors.white,
    fontFamily: fonts.sansBold,
  },

  // Tür grubu başlığı + toplu sula
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  groupWaterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  groupWaterText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.white },

  // Bahçene göre öneriler
  recSection: { marginTop: spacing.xl, gap: 2 },
  recTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  recSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
  recRow: { gap: spacing.md, paddingVertical: 2, paddingRight: spacing.lg },
  recCard: {
    width: 150,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4,
    ...shadow.sm,
  },
  recImage: { width: '100%', height: 90, borderRadius: radius.sm, resizeMode: 'cover' },
  recImagePlaceholder: {
    width: '100%',
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recName: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink, marginTop: 4 },
  recSeller: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted2 },
  recPrice: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primaryDeep },
  recAddBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingVertical: 7,
    alignItems: 'center',
    marginTop: 4,
  },
  recAddText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.primaryDeep },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink, marginBottom: spacing.xs },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  emptyBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white },
});
