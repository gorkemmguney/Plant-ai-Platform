import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  message: 'Merhaba! Ben senin AI bitki asistanınım. Bitkinle ilgili merak ettiğin her şeyi sorabilirsin.',
};

const SUGGESTIONS = [
  'Bitkim neden sarardı?',
  'Ne sıklıkla sulamalıyım?',
  'Zararlı böcek var mı?',
  'İç mekan için hangi bitki uygun?',
];

export default function AIChatScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const resumeChatId: number | undefined = route?.params?.chatId;

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(!!resumeChatId);
  const chatIdRef = useRef<number | null>(resumeChatId ?? null);
  const listRef = useRef<FlatList>(null);

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
          }))
        );
      } catch {
        Alert.alert('Sohbet yüklenemedi', 'Bu sohbet geçmişi açılamadı, yeni bir sohbet başlatabilirsin.');
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [resumeChatId]);

  const startNewChat = () => {
    chatIdRef.current = null;
    setMessages([WELCOME_MESSAGE]);
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
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Bağlantı hatası oluştu, tekrar deneyin.';
      Alert.alert('AI Asistan', detail);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSend = () => sendMessage(input.trim());
  const showSuggestions = messages.length === 1 && !sending;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <LinearGradient colors={[colors.secondary, colors.secondaryDeep]} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Ionicons name="sparkles" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Bitki Asistanı</Text>
          <Text style={styles.headerSub}>Sorularını sor, öneriler al</Text>
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
                  {item.message}
                </Text>
              </View>
            </View>
        )}
        ListFooterComponent={
          showSuggestions ? (
            <View style={styles.suggestionsWrap}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestionChip}
                  activeOpacity={0.8}
                  onPress={() => sendMessage(s)}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
      />
      )}

      {sending && (
        <View style={styles.typingRow}>
          <View style={styles.typingDots}>
            <ActivityIndicator size="small" color={colors.muted} />
          </View>
          <Text style={styles.typingText}>Yazıyor...</Text>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TextInput
          style={styles.input}
          placeholder="Bir mesaj yaz..."
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
    </KeyboardAvoidingView>
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
});
