import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  recommended_products?: any[];
  action_performed?: {
    type: string;
    plant_name: string;
    care_label: string;
    success: boolean;
  } | null;
}

const cleanMarkdownText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/###?\s?/g, '')
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
    .trim();
};

export default function AIChatScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { addToCart } = useCart();
  const resumeChatId: number | undefined = route?.params?.chatId;

  const welcomeMessage: ChatMessage = { id: 'welcome', role: 'assistant', message: t('aiChat.welcome') };
  const quickChips = [
    { label: t('aiChat.chip1Label'), prompt: t('aiChat.chip1Prompt') },
    { label: t('aiChat.chip2Label'), prompt: t('aiChat.chip2Prompt') },
    { label: t('aiChat.chip3Label'), prompt: t('aiChat.chip3Prompt') },
    { label: t('aiChat.chip4Label'), prompt: t('aiChat.chip4Prompt') },
    { label: t('aiChat.chip5Label'), prompt: t('aiChat.chip5Prompt') },
    { label: t('aiChat.chip6Label'), prompt: t('aiChat.chip6Prompt') },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(!!resumeChatId);
  const chatIdRef = useRef<number | null>(resumeChatId ?? null);
  const listRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Klavye yüksekliğini manuel olarak takip ediyoruz; Android'de edge-to-edge
    // mod nedeniyle KeyboardAvoidingView'in native davranışı güvenilir çalışmıyor.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!resumeChatId) return;
    (async () => {
      try {
        const { data } = await apiClient.get(`/ai/chats/${resumeChatId}/messages`);
        setMessages(
          data.map((m: any) => ({
            id: `${m.role[0]}-${m.ai_message_id}`,
            role: m.role === 'user' ? 'user' : 'assistant',
            message: m.message,
            recommended_products: m.recommended_products,
            action_performed: m.action_performed,
          }))
        );
      } catch {
        Alert.alert(t('aiChat.loadFailed'), t('aiChat.loadFailedMsg'));
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [resumeChatId]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    );
    return () => showSub.remove();
  }, []);

  const startNewChat = () => {
    chatIdRef.current = null;
    setMessages([welcomeMessage]);
  };

  const sendMessage = async (text: string) => {
    if (!text || sending) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', message: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const { data } = await apiClient.post('/ai/chat', {
        ai_chat_id: chatIdRef.current,
        message: text,
      });

      chatIdRef.current = data.ai_chat_id;

      const assistantMessage: ChatMessage = {
        id: `a-${data.ai_message_id}`,
        role: 'assistant',
        message: data.message,
        recommended_products: data.recommended_products,
        action_performed: data.action_performed,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? t('aiChat.connError');
      Alert.alert(t('aiChat.assistant'), detail);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSend = () => sendMessage(input.trim());

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[colors.secondary, colors.secondaryDeep]} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Ionicons name="sparkles" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('aiChat.headerTitle')}</Text>
          <Text style={styles.headerSub}>{t('aiChat.headerSub')}</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={startNewChat} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('AIChatHistory')}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={19} color={colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      {loadingHistory ? (
        <View style={styles.historyLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubbleRow,
                item.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant,
              ]}
            >
              {item.role === 'assistant' && (
                <View style={styles.bubbleAvatar}>
                  <Ionicons name="leaf" size={13} color={colors.primaryDeep} />
                </View>
              )}
              <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                

                <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>
                  {cleanMarkdownText(item.message)}
                </Text>

                {item.recommended_products && item.recommended_products.length > 0 && (
                  <View style={styles.productsContainer}>
                    <Text style={styles.productsTitle}>{t('aiChat.recommendedProducts')}</Text>
                    <View style={styles.productsRow}>
                      {item.recommended_products.map((prod: any) => (
                        <View key={prod.prod_id} style={styles.productCard}>
                          {prod.image_url ? (
                            <Image source={{ uri: prod.image_url }} style={styles.productImage} />
                          ) : (
                            <View style={[styles.productImage, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="leaf-outline" size={24} color={colors.primaryDeep} />
                            </View>
                          )}
                          <Text style={styles.productName} numberOfLines={1}>{prod.name}</Text>
                          <Text style={styles.productPrice}>₺{prod.price}</Text>
                          <TouchableOpacity
                            style={styles.addToCartBtn}
                            onPress={() => {
                              addToCart({
                                prod_id: prod.prod_id,
                                name: prod.name,
                                price: prod.price,
                                stock: prod.stock ?? 10,
                              });
                              Alert.alert(t('aiChat.addedToCart'), `${prod.name}${t('aiChat.addedToCartMsg')}`);
                            }}
                          >
                            <Ionicons name="cart" size={13} color={colors.white} style={{ marginRight: 4 }} />
                            <Text style={styles.addToCartText}>{t('common.addToCart')}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
        )}
      />
      )}

      {sending && (
        <View style={styles.typingRow}>
          <View style={styles.typingDots}>
            <ActivityIndicator size="small" color={colors.muted} />
          </View>
          <Text style={styles.typingText}>{t('aiChat.typing')}</Text>
        </View>
      )}

      <View style={styles.chipsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {quickChips.map((chip) => (
            <TouchableOpacity
              key={chip.label}
              style={styles.chipBtn}
              activeOpacity={0.8}
              onPress={() => sendMessage(chip.prompt)}
              disabled={sending}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View
        style={[
          styles.inputBar,
          { paddingBottom: keyboardHeight > 0 ? spacing.md : Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder={t('aiChat.inputPlaceholder')}
          placeholderTextColor={colors.muted2}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          activeOpacity={0.85}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="arrow-up" size={19} color={colors.buttonPrimaryText} />
        </TouchableOpacity>
      </View>

      {/* Klavye açıkken alt kısmı yukarı iten boşluk (adjustResize'i manuel taklit eder) */}
      {keyboardHeight > 0 && <View style={{ height: keyboardHeight }} />}
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
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(237,169,114,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.white },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: '#c9c9d6' },
  historyLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginBottom: spacing.sm },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubbleAvatar: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  bubbleUser: { backgroundColor: colors.buttonPrimary, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.ink },
  bubbleTextUser: { color: colors.buttonPrimaryText },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  suggestionText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  typingDots: { transform: [{ scale: 0.8 }] },
  typingText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.border },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    gap: 6,
  },
  actionBadgeText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: '#15803d', flex: 1 },
  productsContainer: { marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  productsTitle: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.ink, marginBottom: 6 },
  productsRow: { flexDirection: 'row', gap: 8 },
  productCard: {
    width: 110,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productImage: { width: '100%', height: 65, borderRadius: radius.xs, marginBottom: 4 },
  productName: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.ink },
  productPrice: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primaryDeep, marginBottom: 4 },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDeep,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },
  addToCartText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.white },
  chipsBar: { backgroundColor: colors.bg, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  chipsScroll: { paddingHorizontal: spacing.md, gap: 8 },
  chipBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...shadow.xs,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink },
});
