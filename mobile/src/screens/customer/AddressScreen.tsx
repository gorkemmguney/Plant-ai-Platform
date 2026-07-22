import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Address {
  address_id: number;
  title: string;
  il_id: number;
  il_name: string;
  ilce_id: number;
  ilce_name: string;
  mahalle_id: number;
  mahalle_name: string;
  address_line: string;
  is_default: boolean;
}

interface Option {
  id: number;
  name: string;
}

interface FormState {
  title: string;
  il: Option | null;
  ilce: Option | null;
  mahalle: Option | null;
  address_line: string;
  is_default: boolean;
}

const EMPTY_FORM: FormState = { title: '', il: null, ilce: null, mahalle: null, address_line: '', is_default: false };

// Modal içindeki görünüm: form ya da üç seviyeden biri (il/ilçe/mahalle listesi).
// Hepsi TEK bir <Modal> içinde, aynı ekranın farklı "sayfaları" gibi çalışır —
// üst üste iki ayrı <Modal> açmıyoruz (bu, dokunuşların rastgele takılmasına
// ve arka planın kararma animasyonunun kaymasına sebep oluyordu).
type ModalView = 'form' | 'il' | 'ilce' | 'mahalle';

export default function AddressScreen({ navigation }: any) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<ModalView>('form');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [ilOptions, setIlOptions] = useState<Option[]>([]);
  const [ilceOptions, setIlceOptions] = useState<Option[]>([]);
  const [mahalleOptions, setMahalleOptions] = useState<Option[]>([]);
  const [loadingIlce, setLoadingIlce] = useState(false);
  const [loadingMahalle, setLoadingMahalle] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<Address[]>('/addresses');
      setAddresses(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Adresler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiClient
      .get<{ il_id: number; name: string }[]>('/locations/il')
      .then(({ data }) => setIlOptions(data.map((i) => ({ id: i.il_id, name: i.name }))))
      .catch(() => {});
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setModalView('form');
    setSearchQuery('');
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIlceOptions([]);
    setMahalleOptions([]);
    setModalView('form');
    setModalOpen(true);
  };

  const openEdit = (addr: Address) => {
    setEditingId(addr.address_id);
    setForm({
      title: addr.title,
      il: { id: addr.il_id, name: addr.il_name },
      ilce: { id: addr.ilce_id, name: addr.ilce_name },
      mahalle: { id: addr.mahalle_id, name: addr.mahalle_name },
      address_line: addr.address_line,
      is_default: addr.is_default,
    });
    setLoadingIlce(true);
    apiClient
      .get<{ ilce_id: number; name: string }[]>('/locations/ilce', { params: { il_id: addr.il_id } })
      .then(({ data }) => setIlceOptions(data.map((i) => ({ id: i.ilce_id, name: i.name }))))
      .finally(() => setLoadingIlce(false));
    setLoadingMahalle(true);
    apiClient
      .get<{ mahalle_id: number; name: string }[]>('/locations/mahalle', { params: { ilce_id: addr.ilce_id } })
      .then(({ data }) => setMahalleOptions(data.map((m) => ({ id: m.mahalle_id, name: m.name }))))
      .finally(() => setLoadingMahalle(false));
    setModalView('form');
    setModalOpen(true);
  };

  const selectIl = (opt: Option) => {
    setForm((f) => ({ ...f, il: opt, ilce: null, mahalle: null }));
    setIlceOptions([]);
    setMahalleOptions([]);
    setSearchQuery('');
    setModalView('form');
    setLoadingIlce(true);
    apiClient
      .get<{ ilce_id: number; name: string }[]>('/locations/ilce', { params: { il_id: opt.id } })
      .then(({ data }) => setIlceOptions(data.map((i) => ({ id: i.ilce_id, name: i.name }))))
      .finally(() => setLoadingIlce(false));
  };

  const selectIlce = (opt: Option) => {
    setForm((f) => ({ ...f, ilce: opt, mahalle: null }));
    setMahalleOptions([]);
    setSearchQuery('');
    setModalView('form');
    setLoadingMahalle(true);
    apiClient
      .get<{ mahalle_id: number; name: string }[]>('/locations/mahalle', { params: { ilce_id: opt.id } })
      .then(({ data }) => setMahalleOptions(data.map((m) => ({ id: m.mahalle_id, name: m.name }))))
      .finally(() => setLoadingMahalle(false));
  };

  const selectMahalle = (opt: Option) => {
    setForm((f) => ({ ...f, mahalle: opt }));
    setSearchQuery('');
    setModalView('form');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Eksik bilgi', 'Adres başlığı gerekli (ör. Ev, İş).');
    if (!form.il || !form.ilce || !form.mahalle) return Alert.alert('Eksik bilgi', 'İl, ilçe ve mahalle seçilmeli.');
    if (!form.address_line.trim()) return Alert.alert('Eksik bilgi', 'Sokak/bina/daire bilgisi gerekli.');

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      il_id: form.il.id,
      ilce_id: form.ilce.id,
      mahalle_id: form.mahalle.id,
      address_line: form.address_line.trim(),
      is_default: form.is_default,
    };
    try {
      if (editingId == null) {
        await apiClient.post('/addresses', payload);
      } else {
        await apiClient.patch(`/addresses/${editingId}`, payload);
      }
      closeModal();
      await load();
    } catch (err: any) {
      Alert.alert('Kaydedilemedi', err?.response?.data?.detail ?? 'Adres kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr: Address) => {
    Alert.alert('Adresi sil', `"${addr.title}" adresi silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/addresses/${addr.address_id}`);
            setAddresses((prev) => prev.filter((a) => a.address_id !== addr.address_id));
          } catch (err: any) {
            Alert.alert('Silinemedi', err?.response?.data?.detail ?? 'Adres silinemedi.');
          }
        },
      },
    ]);
  };

  const renderAddress = ({ item }: { item: Address }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.is_default && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Varsayılan</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardAddress}>
        {item.mahalle_name}, {item.ilce_name} / {item.il_name}
      </Text>
      <Text style={styles.cardLine} numberOfLines={2}>{item.address_line}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)} activeOpacity={0.8}>
          <Text style={styles.editText}>Düzenle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} activeOpacity={0.8}>
          <Text style={styles.deleteText}>Sil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPickerList = (options: Option[], loadingList: boolean, onSelect: (o: Option) => void) => {
    const filtered = options.filter((o) => o.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return (
      <>
        <TextInput
          style={styles.pickerSearch}
          placeholder="Ara..."
          placeholderTextColor={colors.muted2}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        {loadingList ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            style={{ maxHeight: 380 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerRow} onPress={() => onSelect(item)} activeOpacity={0.7}>
                <Text style={styles.pickerRowText}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.pickerEmpty}>Sonuç bulunamadı.</Text>}
          />
        )}
      </>
    );
  };

  const modalTitles: Record<ModalView, string> = {
    form: editingId == null ? 'Yeni Adres' : 'Adresi Düzenle',
    il: 'İl Seç',
    ilce: 'İlçe Seç',
    mahalle: 'Mahalle Seç',
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Adreslerim</Text>
          <Text style={styles.headerSub}>Teslimat adreslerini yönet</Text>
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
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => String(item.address_id)}
          contentContainerStyle={styles.list}
          renderItem={renderAddress}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Henüz kayıtlı adresin yok. "+ Ekle" ile başla.</Text>
          }
        />
      )}

      <Modal visible={modalOpen} animationType="fade" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              {modalView !== 'form' && (
                <TouchableOpacity onPress={() => setModalView('form')} activeOpacity={0.7}>
                  <Text style={styles.modalBack}>‹ Geri</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.modalTitle}>{modalTitles[modalView]}</Text>
              <TouchableOpacity onPress={closeModal} activeOpacity={0.7}>
                <Text style={styles.modalClose}>Kapat</Text>
              </TouchableOpacity>
            </View>

            {modalView === 'il' && renderPickerList(ilOptions, false, selectIl)}
            {modalView === 'ilce' && renderPickerList(ilceOptions, loadingIlce, selectIlce)}
            {modalView === 'mahalle' && renderPickerList(mahalleOptions, loadingMahalle, selectMahalle)}

            {modalView === 'form' && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Adres Başlığı</Text>
                <TextInput
                  style={styles.input}
                  value={form.title}
                  onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                  placeholder="Örn. Ev, İş"
                  placeholderTextColor={colors.muted2}
                />

                <Text style={styles.label}>İl</Text>
                <TouchableOpacity style={styles.selectBox} onPress={() => setModalView('il')} activeOpacity={0.7}>
                  <Text style={form.il ? styles.selectValue : styles.selectPlaceholder}>
                    {form.il?.name ?? 'İl seçin'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted2} />
                </TouchableOpacity>

                <Text style={styles.label}>İlçe</Text>
                <TouchableOpacity
                  style={[styles.selectBox, !form.il && styles.selectBoxDisabled]}
                  onPress={() => form.il && setModalView('ilce')}
                  activeOpacity={0.7}
                  disabled={!form.il}
                >
                  <Text style={form.ilce ? styles.selectValue : styles.selectPlaceholder}>
                    {form.ilce?.name ?? (form.il ? 'İlçe seçin' : 'Önce il seçin')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted2} />
                </TouchableOpacity>

                <Text style={styles.label}>Mahalle</Text>
                <TouchableOpacity
                  style={[styles.selectBox, !form.ilce && styles.selectBoxDisabled]}
                  onPress={() => form.ilce && setModalView('mahalle')}
                  activeOpacity={0.7}
                  disabled={!form.ilce}
                >
                  <Text style={form.mahalle ? styles.selectValue : styles.selectPlaceholder}>
                    {form.mahalle?.name ?? (form.ilce ? 'Mahalle seçin' : 'Önce ilçe seçin')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted2} />
                </TouchableOpacity>

                <Text style={styles.label}>Açık Adres</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={form.address_line}
                  onChangeText={(v) => setForm((f) => ({ ...f, address_line: v }))}
                  placeholder="Sokak, bina no, daire no vb."
                  placeholderTextColor={colors.muted2}
                  multiline
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Varsayılan adresim yap</Text>
                  <Switch
                    value={form.is_default}
                    onValueChange={(v) => setForm((f) => ({ ...f, is_default: v }))}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeModal} activeOpacity={0.85} disabled={saving}>
                    <Text style={styles.cancelText}>Vazgeç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>Kaydet</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
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
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  addButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  addButtonText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  defaultBadge: { backgroundColor: colors.primarySoft, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  defaultBadgeText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.primaryDeep },
  cardAddress: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },
  cardLine: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  editBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md },
  editText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  deleteBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md },
  deleteText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.red },
  errorText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalBack: { fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.ink },
  modalClose: { fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.muted },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, flex: 1, textAlign: 'center' },
  label: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.muted, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  selectBoxDisabled: { backgroundColor: colors.bgAlt, opacity: 0.6 },
  selectValue: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  selectPlaceholder: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted2 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  switchLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
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
  pickerSearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  pickerRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  pickerRowText: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink },
  pickerEmpty: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
});
