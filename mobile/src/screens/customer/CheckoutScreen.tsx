import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

const SALE_CHANNEL_ID = 1;

interface Address {
  address_id: number;
  title: string;
  il_name: string;
  ilce_name: string;
  mahalle_name: string;
  address_line: string;
  is_default: boolean;
}

// Kart numarasını 4'lü gruplar halinde biçimlendirir (görsel formalite)
function formatCardNumber(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function CheckoutScreen({ navigation, route }: any) {
  const { items, total, clearCart } = useCart();
  const couponId: number | null = route?.params?.couponId ?? null;
  const discount: number = route?.params?.discount ?? 0;
  const finalTotal = Math.max(0, total - discount);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  const [invoiceEnabled, setInvoiceEnabled] = useState(false);
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceIdNo, setInvoiceIdNo] = useState('');

  const [placing, setPlacing] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Address[]>('/addresses');
      setAddresses(data);
      setSelectedAddressId((prev) => {
        if (prev && data.some((a) => a.address_id === prev)) return prev;
        const def = data.find((a) => a.is_default);
        return def ? def.address_id : data[0]?.address_id ?? null;
      });
    } catch {
      setAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  // Adres ekle ekranından dönünce listeyi tazele
  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  const ensureCustomerProfile = async () => {
    try {
      await apiClient.get('/customers/me');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        await apiClient.post('/customers/me', { customer_type: 'IND', individual: {} });
      } else {
        throw err;
      }
    }
  };

  const handleConfirm = async () => {
    if (!selectedAddressId) {
      Alert.alert('Adres gerekli', 'Lütfen bir teslimat adresi seç ya da yeni adres ekle.');
      return;
    }
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 16) {
      Alert.alert('Kart bilgisi eksik', 'Lütfen geçerli bir kart numarası gir.');
      return;
    }
    if (cardExpiry.replace(/\D/g, '').length < 4) {
      Alert.alert('Kart bilgisi eksik', 'Son kullanma tarihini AA/YY formatında gir.');
      return;
    }
    if (cardCvv.length < 3) {
      Alert.alert('Kart bilgisi eksik', 'CVV en az 3 haneli olmalı.');
      return;
    }
    if (!cardName.trim()) {
      Alert.alert('Kart bilgisi eksik', 'Kart üzerindeki ismi gir.');
      return;
    }
    if (invoiceEnabled && !invoiceTitle.trim()) {
      Alert.alert('Fatura bilgisi eksik', 'Fatura için ad/unvan gerekli, ya da fatura seçeneğini kapat.');
      return;
    }

    setPlacing(true);
    try {
      await ensureCustomerProfile();
      // NOT: Kart bilgileri SADECE formalite amaçlı — hiçbir kart verisi backend'e
      // gönderilmiyor/saklanmıyor. Gerçek bir ödeme altyapısı bağlanmadı.
      await apiClient.post('/orders', {
        sale_cnl_id: SALE_CHANNEL_ID,
        address_id: selectedAddressId,
        coupon_id: couponId,
        items: items.map((i) => ({
          prod_id: i.product.prod_id,
          quantity: i.quantity,
          selected_char_value_ids: i.selectedCharacteristics.map((c) => c.gnl_char_val_id),
        })),
      });
      clearCart();
      Alert.alert('Sipariş alındı 🎉', 'Siparişin oluşturuldu.', [
        {
          text: 'Siparişlerim',
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }, { name: 'Orders' }] }),
        },
        { text: 'Tamam', onPress: () => navigation.navigate('Tabs') },
      ]);
    } catch (err: any) {
      Alert.alert('Sipariş verilemedi', err?.response?.data?.detail ?? 'Sipariş oluşturulamadı.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ödeme</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Teslimat adresi */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Teslimat Adresi</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddressScreen')} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>+ Yeni Adres</Text>
          </TouchableOpacity>
        </View>

        {loadingAddresses ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
        ) : addresses.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyAddressBox}
            onPress={() => navigation.navigate('AddressScreen')}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={20} color={colors.muted} />
            <Text style={styles.emptyAddressText}>Kayıtlı adresin yok, eklemek için dokun</Text>
          </TouchableOpacity>
        ) : (
          addresses.map((addr) => {
            const active = selectedAddressId === addr.address_id;
            return (
              <TouchableOpacity
                key={addr.address_id}
                style={[styles.addressCard, active && styles.addressCardActive]}
                onPress={() => setSelectedAddressId(addr.address_id)}
                activeOpacity={0.85}
              >
                <View style={styles.addressRadio}>
                  {active && <View style={styles.addressRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressTitle}>{addr.title}</Text>
                  <Text style={styles.addressDetail} numberOfLines={2}>
                    {addr.address_line}, {addr.mahalle_name}, {addr.ilce_name}/{addr.il_name}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Kart bilgileri (formalite) */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Kart Bilgileri</Text>
        <Text style={styles.helperText}>
          Bu adım demo amaçlıdır — gerçek bir ödeme altyapısı bağlı değildir, kart bilgilerin saklanmaz.
        </Text>

        <Text style={styles.label}>Kart Numarası</Text>
        <TextInput
          style={styles.input}
          value={cardNumber}
          onChangeText={(v) => setCardNumber(formatCardNumber(v))}
          placeholder="0000 0000 0000 0000"
          placeholderTextColor={colors.muted2}
          keyboardType="number-pad"
          maxLength={19}
        />

        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Son Kullanma</Text>
            <TextInput
              style={styles.input}
              value={cardExpiry}
              onChangeText={(v) => setCardExpiry(formatExpiry(v))}
              placeholder="AA/YY"
              placeholderTextColor={colors.muted2}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>CVV</Text>
            <TextInput
              style={styles.input}
              value={cardCvv}
              onChangeText={(v) => setCardCvv(v.replace(/\D/g, '').slice(0, 4))}
              placeholder="123"
              placeholderTextColor={colors.muted2}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </View>
        </View>

        <Text style={styles.label}>Kart Üzerindeki İsim</Text>
        <TextInput
          style={styles.input}
          value={cardName}
          onChangeText={setCardName}
          placeholder="Ad Soyad"
          placeholderTextColor={colors.muted2}
          autoCapitalize="words"
        />

        {/* Fatura (opsiyonel) */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Fatura bilgisi ekle (opsiyonel)</Text>
          <Switch
            value={invoiceEnabled}
            onValueChange={setInvoiceEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {invoiceEnabled && (
          <>
            <Text style={styles.label}>Ad Soyad / Ünvan</Text>
            <TextInput
              style={styles.input}
              value={invoiceTitle}
              onChangeText={setInvoiceTitle}
              placeholder="Fatura üzerindeki isim"
              placeholderTextColor={colors.muted2}
            />
            <Text style={styles.label}>TC Kimlik No / Vergi No (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              value={invoiceIdNo}
              onChangeText={(v) => setInvoiceIdNo(v.replace(/\D/g, ''))}
              placeholder="11111111111"
              placeholderTextColor={colors.muted2}
              keyboardType="number-pad"
            />
          </>
        )}

        {/* Toplam */}
        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Ara Toplam</Text>
            <Text style={styles.totalValue}>₺{total.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelDiscount}>Kupon İndirimi</Text>
              <Text style={styles.totalValueDiscount}>-₺{discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>Toplam</Text>
            <Text style={styles.totalValueFinal}>₺{finalTotal.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, placing && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={placing}
          activeOpacity={0.85}
        >
          {placing ? (
            <ActivityIndicator size="small" color={colors.buttonPrimaryText} />
          ) : (
            <Text style={styles.confirmButtonText}>Siparişi Onayla</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  sectionLink: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.primaryDeep },
  helperText: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginBottom: spacing.md, lineHeight: 16 },
  emptyAddressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  emptyAddressText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, flex: 1 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  addressCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  addressRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addressRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  addressTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  addressDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
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
  inputRow: { flexDirection: 'row', gap: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  switchLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink, flex: 1, marginRight: spacing.sm },
  totalBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  totalLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  totalValue: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  totalLabelDiscount: { fontFamily: fonts.sans, fontSize: 13, color: colors.primaryDeep },
  totalValueDiscount: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primaryDeep },
  totalRowFinal: { marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, marginBottom: 0 },
  totalLabelFinal: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  totalValueFinal: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  confirmButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: { opacity: 0.6 },
  confirmButtonText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.buttonPrimaryText },
});
