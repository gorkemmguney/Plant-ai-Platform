import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useI18n } from '../../i18n';
import { apiClient } from '../../services/apiClient';
import { trackInteraction } from '../../services/interactionService';
import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';

interface Complaint {
  complaint_id: number; complaint_type: string; source_panel: string;
  title: string; description: string; status: string;
  admin_note: string | null; user_reply: string | null; created_at: string;
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'support.statusPending', in_progress: 'support.statusInProgress',
  resolved: 'support.statusResolved', rejected: 'support.statusRejected',
};
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending: badgeColors.amber, in_progress: badgeColors.secondary,
  resolved: badgeColors.green, rejected: badgeColors.red,
};
const TYPES = [
  { key: 'general', labelKey: 'support.typeGeneral' }, { key: 'order', labelKey: 'support.typeOrder' },
  { key: 'product', labelKey: 'support.typeProduct' }, { key: 'seller', labelKey: 'support.typeSeller' },
  { key: 'suggestion', labelKey: 'support.typeSuggestion' },
];

export default function SupportScreen({ navigation, route }: any) {
  const { t } = useI18n();
  const sourcePanel: 'customer' | 'seller' = route?.params?.sourcePanel ?? 'customer';
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [type, setType] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Complaint | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Complaint[]>('/complaints');
      setItems(data.filter((c) => c.source_panel === sourcePanel));
    } catch { setItems([]); } finally { setLoading(false); }
  }, [sourcePanel]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!title.trim()) return Alert.alert(t('settings.missingInfo'), t('support.titleReq'));
    if (!description.trim()) return Alert.alert(t('settings.missingInfo'), t('support.descReq'));
    setSaving(true);
    try {
      await apiClient.post('/complaints', {
        complaint_type: type, source_panel: sourcePanel,
        title: title.trim(), description: description.trim(),
      });
      trackInteraction('SUPPORT_TICKET');
      setCreateOpen(false); setTitle(''); setDescription(''); setType('general');
      await load();
      Alert.alert(t('support.received'), t('support.receivedMsg'));
    } catch (err: any) {
      Alert.alert(t('support.sendFailed'), err?.response?.data?.detail ?? t('support.createFailed'));
    } finally { setSaving(false); }
  };

  const sendReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const { data } = await apiClient.patch(`/complaints/${detail.complaint_id}/reply`, {
        user_reply: replyText.trim(),
      });
      setDetail(data); setReplyText(''); await load();
    } catch (err: any) {
      Alert.alert(t('support.sendFailed'), err?.response?.data?.detail ?? t('support.replyFailed'));
    } finally { setSendingReply(false); }
  };

  const renderItem = ({ item }: { item: Complaint }) => {
    const st = STATUS_STYLE[item.status] ?? badgeColors.secondary;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => { setDetail(item); setReplyText(''); }}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.text }]}>{STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}</Text>
          </View>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        {!!item.admin_note && (
          <View style={styles.answeredRow}>
            <Ionicons name="chatbubble-ellipses" size={13} color={colors.primaryDeep} />
            <Text style={styles.answeredText}>{t('support.answered')}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('settings.support')}</Text>
          <Text style={styles.headerSub}>
            {sourcePanel === 'seller' ? t('support.sellerTickets') : t('support.customerTickets')}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setCreateOpen(true)} activeOpacity={0.85}>
          <Text style={styles.addButtonText}>{t('support.new')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.buttonPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.complaint_id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('support.empty')}</Text>}
        />
      )}

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              <Text style={styles.modalTitle}>{t('support.newTicket')}</Text>
              <Text style={styles.label}>{t('support.topicType')}</Text>
              <View style={styles.chipRow}>
                {TYPES.map((ty) => {
                  const active = type === ty.key;
                  return (
                    <TouchableOpacity key={ty.key} style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setType(ty.key)} activeOpacity={0.8}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(ty.labelKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>{t('support.titleLabel')}</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle}
                placeholder={t('support.titlePlaceholder')} placeholderTextColor={colors.muted2} />
              <Text style={styles.label}>{t('support.descLabel')}</Text>
              <TextInput style={[styles.input, styles.inputMultiline]} value={description}
                onChangeText={setDescription} placeholder={t('support.descPlaceholder')}
                placeholderTextColor={colors.muted2} multiline />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateOpen(false)} disabled={saving}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>{t('common.submit')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={detail !== null} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              <Text style={styles.modalTitle}>{detail?.title}</Text>
              <Text style={styles.detailBody}>{detail?.description}</Text>

              {!!detail?.user_reply && (
                <View style={styles.bubbleUser}>
                  <Text style={styles.bubbleLabel}>{t('support.yourReply')}</Text>
                  <Text style={styles.bubbleText}>{detail.user_reply}</Text>
                </View>
              )}

              {detail?.admin_note ? (
                <View style={styles.bubbleAdmin}>
                  <Text style={styles.bubbleLabelAdmin}>{t('support.teamReply')}</Text>
                  <Text style={styles.bubbleTextAdmin}>{detail.admin_note}</Text>
                </View>
              ) : null}

              {detail?.admin_note ? (
                <View style={styles.lockedBox}>
                  <Ionicons name="lock-closed" size={14} color={colors.muted} />
                  <Text style={styles.lockedText}>{t('support.locked')}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>{t('support.addReply')}</Text>
                  <TextInput style={[styles.input, styles.inputMultiline]} value={replyText}
                    onChangeText={setReplyText} placeholder={t('support.replyPlaceholder')}
                    placeholderTextColor={colors.muted2} multiline />
                  <TouchableOpacity style={[styles.saveBtn, { marginTop: spacing.sm }]}
                    onPress={sendReply} disabled={sendingReply || !replyText.trim()}>
                    {sendingReply ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>{t('common.submit')}</Text>}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={[styles.cancelBtn, { marginTop: spacing.md }]} onPress={() => setDetail(null)}>
                <Text style={styles.cancelText}>{t('market.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  addButton: { backgroundColor: colors.buttonPrimary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 9 },
  addButtonText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.buttonPrimaryText },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10.5 },
  cardDesc: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18 },
  answeredRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  answeredText: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: colors.primaryDeep },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xl, lineHeight: 20 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '85%' },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  detailBody: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
  label: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  chipText: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.ink },
  chipTextActive: { color: colors.buttonPrimaryText },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: spacing.md, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, backgroundColor: colors.card },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  bubbleUser: { backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  bubbleLabel: { fontFamily: fonts.sansSemi, fontSize: 11, color: colors.muted2, marginBottom: 4 },
  bubbleText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 19 },
  bubbleAdmin: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.primary },
  bubbleLabelAdmin: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primaryDeep, marginBottom: 4 },
  bubbleTextAdmin: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 19 },
  lockedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.bgAlt, borderRadius: radius.sm },
  lockedText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, flex: 1 },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  saveBtn: { flex: 1, backgroundColor: colors.buttonPrimary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.buttonPrimaryText },
});
