import React, { useRef, useState } from 'react';
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
import { apiClient } from '../../services/apiClient';
import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message: string;
}

export default function AIChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      message: 'Merhaba! Ben senin AI bitki asistanınım. Bitkinle ilgili merak ettiğin her şeyi sorabilirsin.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatIdRef = useRef<number | null>(null);
  const listRef = useRef<FlatList>(null);

  const handleSend = async () => {
    const text = input.trim();
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🤖</Text>
        <View>
          <Text style={styles.headerTitle}>AI Bitki Asistanı</Text>
          <Text style={styles.headerSub}>Sorularını sor, öneriler al</Text>
        </View>
      </View>

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
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>
                {item.message}
              </Text>
            </View>
          </View>
        )}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.muted} />
          <Text style={styles.typingText}>Yazıyor...</Text>
        </View>
      )}

      <View style={styles.inputBar}>
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
          <Text style={styles.sendButtonText}>↑</Text>
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerEmoji: { fontSize: 28 },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  messageList: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.sm },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  bubbleUser: { backgroundColor: colors.buttonPrimary, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.ink },
  bubbleTextUser: { color: colors.buttonPrimaryText },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
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
  sendButtonText: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.buttonPrimaryText },
});
