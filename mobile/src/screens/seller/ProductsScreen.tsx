import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Product {
  prod_id: number;
  name: string;
  description: string | null;
  price: string | number;
  stock: number;
  gnl_st_id: number;
}

interface FormState {
  name: string;
  description: string;
  price: string;
  stock: string;
  gnl_st_id: string;
}

const EMPTY_FORM: FormState = { name: '', description: '', price: '', stock: '0', gnl_st_id: '1' };

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Product[]>('/catalog/products');
      setProducts(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ürünler yüklenemedi. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.prod_id);
    setForm({
      name: product.name,
      description: product.description ?? '',
      price: String(product.price),
      stock: String(product.stock),
      gnl_st_id: String(product.gnl_st_id),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Eksik bilgi', 'Ürün adı gerekli.');
      return;
    }
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) {
      Alert.alert('Geçersiz fiyat', 'Fiyat geçerli bir sayı olmalı.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      stock: Number(form.stock) || 0,
      gnl_st_id: Number(form.gnl_st_id) || 1,
    };
    try {
      if (editingId == null) {
        await apiClient.post('/catalog/products', payload);
      } else {
        await apiClient.patch(`/catalog/products/${editingId}`, payload);
      }
      setModalOpen(false);
      await loadProducts();
    } catch (err: any) {
      Alert.alert('Kaydedilemedi', err?.response?.data?.detail ?? 'Ürün kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert('Ürünü sil', `"${product.name}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/catalog/products/${product.prod_id}`);
            setProducts((prev) => prev.filter((p) => p.prod_id !== product.prod_id));
          } catch (err: any) {
            Alert.alert('Silinemedi', err?.response?.data?.detail ?? 'Ürün silinemedi.');
          }
        },
      },
    ]);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          {!!item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        <Text style={styles.price}>₺{Number(item.price).toFixed(2)}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.stock}>Stok: {item.stock}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)} activeOpacity={0.8}>
            <Text style={styles.editText}>Düzenle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} activeOpacity={0.8}>
            <Text style={styles.deleteText}>Sil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Ürünlerim</Text>
          <Text style={styles.headerSub}>Sattığın ürünleri yönet</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openCreate} activeOpacity={0.85}>
          <Text style={styles.addButtonText}>+ Ekle</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
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
          data={products}
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
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz ürün yok. "+ Ekle" ile başla.</Text>}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingId == null ? 'Yeni Ürün' : 'Ürünü Düzenle'}</Text>

              <Text style={styles.label}>Ürün adı</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Örn. Barış Çiçeği"
                placeholderTextColor={colors.muted2}
              />

              <Text style={styles.label}>Açıklama</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Kısa açıklama"
                placeholderTextColor={colors.muted2}
                multiline
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Fiyat (₺)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                    placeholder="0.00"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Stok</Text>
                  <TextInput
                    style={styles.input}
                    value={form.stock}
                    onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))}
                    placeholder="0"
                    placeholderTextColor={colors.muted2}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalOpen(false)}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.saveText}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  addButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
  },
  addButtonText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  description: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 3 },
  price: { fontFamily: fonts.display, fontSize: 16, color: colors.primaryDeep },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  stock: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.sm },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  editText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.ink },
  deleteBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  deleteText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.red },
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
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  modalTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: spacing.lg },
  label: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, marginBottom: spacing.xs },
  input: {
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
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', gap: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  saveButton: {
    flex: 1,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
});
