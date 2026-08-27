import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../i18n';
import {
  CommMessage,
  fetchInteractions,
  fetchMessages,
  sendCommunicationMessage,
} from '../../services/communicationService';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

export default function SellerChatDetailScreen({ route, navigation }: any) {
  const { interactionId, partnerName, prodName, prodImage, prodId, ordId } = route.params;
  const { userId, roles } = useAuth();
  const { t } = useI18n();
  const { addToCart } = useCart();
  const insets = useSafeAreaInsets();

  const isSellerUser = roles?.includes('seller');

  const [messages, setMessages] = useState<CommMessage[]>([]);
  const [activeOrdId, setActiveOrdId] = useState<number | undefined>(ordId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);

  const customerChips = [
    t('sellerChat.chip1'),
    t('sellerChat.chip2'),
    t('sellerChat.chip3'),
  ];

  const sellerChips = [
    'Siparişiniz kargoya verilmiştir 🚚',
    'Haftada 1 kez bol su vermenizi tavsiye ederiz 🪴',
    'Stoklarımız önümüzdeki hafta yenilenecektir 📦',
    'Merhaba, size nasıl yardımcı olabilirim? 👋',
  ];

  const quickChips = isSellerUser ? sellerChips : customerChips;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchMessages(interactionId);
      setMessages(data);
      if (!activeOrdId) {
        const interactions = await fetchInteractions();
        const found = interactions.find((i) => i.comm_interaction_id === interactionId);
        if (found?.related_ord_id) {
          setActiveOrdId(found.related_ord_id);
        }
      }
    } catch (err) {
      console.log('[SellerChatDetail] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [interactionId]);

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('common.error'), 'Fotoğraf seçmek için galeri izni gereklidir.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });

      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        if (asset.base64) {
          const base64Uri = `data:image/jpeg;base64,${asset.base64}`;
          setSelectedImage(base64Uri);
        } else if (asset.uri) {
          setSelectedImage(asset.uri);
        }
      }
    } catch (err) {
      console.log('[SellerChatDetail] pick image error:', err);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if ((!messageContent && !selectedImage) || sending) return;

    if (!textToSend) setInput('');
    const imageToSend = selectedImage;
    setSelectedImage(null);
    setSending(true);

    try {
      const newMsg = await sendCommunicationMessage(interactionId, {
        content: messageContent || 'Fotoğraf paylaşıldı',
        attachment_url: imageToSend || undefined,
      });
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.detail ?? t('sellerChat.sendError'));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: CommMessage }) => {
    const isMe = item.sender_id === userId;
    const timeStr = new Date(item.created_at).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={styles.senderAvatar}>
            <Ionicons name={isSellerUser ? 'person-outline' : 'storefront'} size={13} color={colors.primaryDeep} />
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentWrap}>
              {item.attachments.map((att) => (
                <TouchableOpacity
                  key={att.comm_attachment_id}
                  activeOpacity={0.9}
                  onPress={() => setPreviewModalUrl(att.url)}
                >
                  <Image source={{ uri: att.url }} style={styles.attachedImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>

          <View style={styles.timeRow}>
            <Text style={[styles.timeText, isMe && styles.timeTextMe]}>{timeStr}</Text>
            {isMe && (
              <Ionicons
                name={item.message_state === 'READ' ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.message_state === 'READ' ? '#93c5fd' : 'rgba(255,255,255,0.7)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {partnerName || t('common.store')}
          </Text>
          {prodName && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {prodName}
            </Text>
          )}
        </View>
      </View>

      {/* Related Product Banner */}
      {prodName && (
        <View style={styles.prodBanner}>
          {prodImage ? (
            <Image source={{ uri: prodImage }} style={styles.prodImage} />
          ) : (
            <View style={[styles.prodImage, styles.prodPlaceholder]}>
              <Ionicons name="leaf" size={16} color={colors.primaryDeep} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerLabel}>{t('common.product')}</Text>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {prodName}
            </Text>
          </View>
          {prodId && !isSellerUser && (
            <TouchableOpacity
              style={styles.addCartBtn}
              activeOpacity={0.8}
              onPress={() => {
                addToCart({
                  prod_id: prodId,
                  name: prodName,
                  price: 0,
                  stock: 10,
                });
                Alert.alert(t('common.ok'), `${prodName} sepete eklendi 🎉`);
              }}
            >
              <Ionicons name="cart" size={13} color={colors.white} style={{ marginRight: 4 }} />
              <Text style={styles.addCartText}>{t('common.addToCart')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Order Banner */}
      {activeOrdId && (
        <View style={styles.orderBanner}>
          <Ionicons name="receipt-outline" size={16} color={colors.primaryDeep} />
          <Text style={styles.orderBannerText}>İlişkili Sipariş No: #{activeOrdId}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.comm_message_id)}
          renderItem={renderMessage}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Quick Chips */}
      <View style={styles.chipsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {quickChips.map((chip, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.chipBtn}
              activeOpacity={0.8}
              onPress={() => handleSend(chip)}
              disabled={sending}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selected Image Preview */}
      {selectedImage && (
        <View style={styles.imagePreviewBar}>
          <Image source={{ uri: selectedImage }} style={styles.previewThumb} />
          <Text style={styles.previewText}>1 Fotoğraf Seçildi</Text>
          <TouchableOpacity onPress={() => setSelectedImage(null)} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={colors.red} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View
        style={[
          styles.inputBar,
          { paddingBottom: keyboardHeight > 0 ? spacing.sm : Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage} activeOpacity={0.7} disabled={sending}>
          <Ionicons name="camera-outline" size={22} color={colors.primaryDeep} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder={t('sellerChat.inputPlaceholder')}
          placeholderTextColor={colors.muted2}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() && !selectedImage || sending) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          activeOpacity={0.85}
          disabled={(!input.trim() && !selectedImage) || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={18} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {keyboardHeight > 0 && <View style={{ height: keyboardHeight }} />}

      {/* Fullscreen Photo View Modal */}
      <Modal visible={!!previewModalUrl} transparent animationType="fade" onRequestClose={() => setPreviewModalUrl(null)}>
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.closeModalBtn} onPress={() => setPreviewModalUrl(null)} activeOpacity={0.7}>
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          {previewModalUrl && <Image source={{ uri: previewModalUrl }} style={styles.modalImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.secondary,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.white },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: '#c9c9d6' },
  prodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  prodImage: { width: 36, height: 36, borderRadius: radius.xs },
  prodPlaceholder: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  bannerLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted },
  bannerTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.ink },
  addCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDeep,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xs,
  },
  addCartText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.white },
  orderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 6,
  },
  orderBannerText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.primaryDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.md, gap: spacing.sm },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, gap: 6 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  senderAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    ...shadow.xs,
  },
  bubbleMe: { backgroundColor: colors.primaryDeep, borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 2 },
  attachmentWrap: { marginBottom: 6 },
  attachedImage: { width: 200, height: 140, borderRadius: radius.xs, backgroundColor: '#000' },
  msgText: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, lineHeight: 20 },
  msgTextMe: { color: colors.white },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted },
  timeTextMe: { color: 'rgba(255,255,255,0.7)' },
  chipsBar: { backgroundColor: colors.bg, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  chipsScroll: { paddingHorizontal: spacing.md, gap: 8 },
  chipBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.ink },
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  previewThumb: { width: 34, height: 34, borderRadius: radius.xs },
  previewText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink, flex: 1 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.muted2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModalBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  modalImage: { width: '95%', height: '80%' },
});
