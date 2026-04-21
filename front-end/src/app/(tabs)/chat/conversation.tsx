import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { AnimatedBackground } from '@/components/animated-background';
import { ThemedText } from '@/components/themed-text';
import { ThinkingIndicator } from '@/components/thinking-indicator';
import { RECIPES } from '@/data/recipes';
import { useVoiceDictation } from '@/hooks/use-voice-dictation';
import {
  getChatRecipe,
  getChatRecipeImageUrl,
  hydrateChatRecipes,
  subscribeChatRecipes,
} from '@/services/chat-recipe-store';
import {
  deleteChatSession,
  getActiveSessionId,
  getAllSessions,
  getChatSession,
  hydrateChatSession,
  isSendingChat,
  loadChatSession,
  sendChatMessageFromStore,
  startNewChatSession,
  subscribeChatSession,
  type ChatSession,
} from '@/services/chat-session-store';
import { seedFromId, stockFoodImage } from '@/utils/synthesize-recipe-facts';

const CREAM = '#fff4db';
const TEXT_MUTED = '#434343';

type Role = 'user' | 'assistant';

type Message =
  | { id: string; role: Role; text: string; kind: 'text' }
  | {
      id: string;
      role: 'assistant';
      kind: 'recipe';
      text: string;
      recipe: { id: string; title: string; cta: string };
    };

function formatAssistantText(raw: string): string {
  // The backend may return Markdown (tables, headings, separators). Keep the UI readable.
  let text = raw.replace(/\r/g, '');
  // If the model accidentally returned a JSON-fenced block, try to extract the
  // user-facing "response" field; otherwise strip the fences.
  const fencedJson = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fencedJson) {
    try {
      const parsed = JSON.parse(fencedJson[1]);
      if (parsed && typeof parsed.response === 'string') {
        text = parsed.response;
      } else {
        text = fencedJson[1];
      }
    } catch {
      text = fencedJson[1];
    }
  } else {
    text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  }

  const lines = text.split('\n');
  const cleaned = lines
    .filter((l) => !/^\s*\|.*\|\s*$/.test(l)) // drop markdown table rows
    .filter((l) => !/^\s*\|?-{3,}\|?-{0,}.*$/.test(l)) // drop table separators / --- rules
    .map((l) => l.replace(/^\s{0,3}#{1,6}\s+/g, '')) // headings
    .map((l) => l.replace(/\*\*(.*?)\*\*/g, '$1')) // bold
    .map((l) => l.replace(/`([^`]+)`/g, '$1')) // inline code
    .map((l) => l.trimEnd());
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function MessageBubble({ message, onRecipePress, onPostPress }: { message: Message; onRecipePress: (id: string) => void; onPostPress: (id: string) => void }) {
  const isUser = message.role === 'user';

  if (message.kind === 'recipe') {
    const stored = getChatRecipe(message.recipe.id);
    const imageUrl = getChatRecipeImageUrl(message.recipe.id);
    const macros = stored?.macros ?? null;
    const why = stored?.why_this_works ?? null;

    return (
      <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
        <View style={styles.recipeCard}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.recipeImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={250}
              recyclingKey={imageUrl}
              placeholderContentFit="cover"
              placeholder={{
                uri: stockFoodImage(message.recipe.title || '', seedFromId(message.recipe.id)),
              }}
            />
          ) : (
            <View style={styles.recipeImagePlaceholder}>
              <Ionicons name="restaurant-outline" size={28} color="#9a8a6a" />
            </View>
          )}

          <View style={styles.recipeBody}>
            <ThemedText style={styles.recipeTitle} numberOfLines={2}>
              {message.recipe.title}
            </ThemedText>

            {!!macros && (
              <View style={styles.macroRow}>
                <MacroPill label="Cal" value={macros.calories ?? '—'} />
                <MacroPill label="P" value={`${macros.protein_g ?? '—'}g`} />
                <MacroPill label="C" value={`${macros.carbs_g ?? '—'}g`} />
                <MacroPill label="F" value={`${macros.fat_g ?? '—'}g`} />
              </View>
            )}

            {!!why && (
              <ThemedText style={styles.recipeWhyText} numberOfLines={3}>
                {formatAssistantText(why)}
              </ThemedText>
            )}

            <View style={styles.recipeActionRow}>
              <TouchableOpacity
                style={[styles.recipeActionBtn, styles.recipeActionBtnPrimary]}
                onPress={() => onRecipePress(message.recipe.id)}
                activeOpacity={0.85}>
                <Ionicons name="open-outline" size={15} color="#fff" />
                <ThemedText style={styles.recipeActionBtnTextPrimary}>View recipe</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recipeActionBtn, styles.recipeActionBtnSecondary]}
                onPress={() => onPostPress(message.recipe.id)}
                activeOpacity={0.85}>
                <Ionicons name="share-outline" size={15} color="#111" />
                <ThemedText style={styles.recipeActionBtnTextSecondary}>Post</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <ThemedText style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
          {isUser ? message.text : formatAssistantText(message.text)}
        </ThemedText>
      </View>
    </View>
  );
}

function MacroPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.macroPill}>
      <ThemedText style={styles.macroPillLabel}>{label}</ThemedText>
      <ThemedText style={styles.macroPillValue}>{value}</ThemedText>
    </View>
  );
}

const QUICK_PROMPTS: { id: string; label: string; message: string }[] = [
  { id: 'med-lunch', label: 'Suggest a Mediterranean lunch', message: 'Suggest a Mediterranean lunch.' },
  { id: 'italian-dinner', label: 'Suggest an Italian dinner', message: 'Suggest an Italian dinner.' },
];

function WelcomeState({ onPickSuggestion }: { onPickSuggestion: (message: string) => void }) {
  const a = RECIPES[0];
  const b = RECIPES[1] ?? RECIPES[0];
  const c = RECIPES[2] ?? RECIPES[0];

  return (
    <ScrollView
      contentContainerStyle={styles.welcomeScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(420).delay(0)} style={styles.welcomeHero}>
        <ThemedText style={styles.welcomeHi} allowFontScaling={false}>
          Hi there.
        </ThemedText>
        <ThemedText style={styles.welcomeSubtitle}>
          Tell me what you&rsquo;re craving and I&rsquo;ll tailor a recipe to your profile.
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(480).delay(100)} style={styles.welcomeFeatureRow}>
        <Pressable
          style={styles.welcomeTileSmall}
          onPress={() =>
            onPickSuggestion(`Suggest a culturally-accurate recipe inspired by ${a.name} with macros and why it works.`)
          }>
          <Image source={{ uri: a.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.welcomeTileOverlay} />
          <ThemedText style={styles.welcomeTileEyebrow}>Inspired by</ThemedText>
          <ThemedText style={styles.welcomeTileLabel} numberOfLines={1}>
            {a.name}
          </ThemedText>
        </Pressable>
        <Pressable
          style={styles.welcomeTileSmall}
          onPress={() =>
            onPickSuggestion(`Suggest a culturally-accurate recipe inspired by ${b.name} with macros and why it works.`)
          }>
          <Image source={{ uri: b.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.welcomeTileOverlay} />
          <ThemedText style={styles.welcomeTileEyebrow}>Inspired by</ThemedText>
          <ThemedText style={styles.welcomeTileLabel} numberOfLines={1}>
            {b.name}
          </ThemedText>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(520).delay(180)}>
        <Pressable
          style={styles.welcomeTileLarge}
          onPress={() => onPickSuggestion('Generate Breakfast, Lunch, and Dinner.')}>
          <Image source={{ uri: c.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.welcomeTileOverlay} />
          <ThemedText style={styles.welcomeTileEyebrow}>Plan my day</ThemedText>
          <ThemedText style={styles.welcomeTileLabelLarge} numberOfLines={2}>
            Generate Breakfast, Lunch, and Dinner
          </ThemedText>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(560).delay(260)} style={styles.welcomePromptStack}>
        {QUICK_PROMPTS.map((p, i) => (
          <Animated.View
            key={p.id}
            entering={FadeInDown.duration(420).delay(320 + i * 80)}>
            <TouchableOpacity
              style={styles.welcomePromptPill}
              onPress={() => onPickSuggestion(p.message)}
              activeOpacity={0.85}>
              <Ionicons name="sparkles-outline" size={14} color="#5a3c17" style={{ marginRight: 8 }} />
              <ThemedText style={styles.welcomePromptText}>{p.label}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

export default function MealMateConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ initialMessage?: string }>();
  const listRef = useRef<FlatList<Message>>(null);

  const [draft, setDraft] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const { listening, supported: voiceSupported, toggle: toggleVoice, stop: stopVoice } = useVoiceDictation({
    onInterimTranscript: (text) => setDraft(text),
    onError: (msg) => setVoiceError(msg),
  });

  // Clear any prior voice error once the user starts a new dictation attempt.
  const onMicOrSendPress = () => {
    if (draft.trim().length > 0) {
      if (listening) stopVoice();
      void send(draft);
      return;
    }
    setVoiceError(null);
    toggleVoice();
  };

  // Subscribe to the module-level session store so state survives navigation
  // AND in-flight requests keep running when the user leaves the page.
  const [messages, setMessagesState] = useState<Message[]>(() => getChatSession().messages as Message[]);
  const [sending, setSending] = useState<boolean>(() => isSendingChat());
  const initialSentRef = useRef(false);

  useEffect(() => {
    const syncFromStore = () => {
      setMessagesState([...(getChatSession().messages as Message[])]);
      setSending(isSendingChat());
    };
    const unsubscribeRecipes = subscribeChatRecipes(syncFromStore);
    const unsubscribeSession = subscribeChatSession(syncFromStore);
    // Load persisted exclusion titles so the very first request already knows
    // what the user has seen before (fixes "always the same three meals" issue).
    void hydrateChatSession();
    // Also hydrate recipe payloads so old recipe cards in resumed messages
    // can still open their detail screen (rather than showing "not found").
    void hydrateChatRecipes();
    return () => {
      unsubscribeRecipes();
      unsubscribeSession();
    };
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft('');
    await sendChatMessageFromStore(trimmed);
  };

  const onRecipePress = (id: string) => {
    router.push({ pathname: '/(tabs)/chat/recipe/[id]', params: { id } } as any);
  };

  const onPostPress = (id: string) => {
    const stored = getChatRecipe(id);
    const imageUri = getChatRecipeImageUrl(id);
    router.push({
      pathname: '/create-post',
      params: {
        prefillTitle: stored?.title ?? '',
        prefillDescription: stored?.summary ?? stored?.why_this_works ?? '',
        prefillIngredients: (stored?.ingredients ?? []).join('\n'),
        prefillSteps: (stored?.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n'),
        prefillImage: imageUri ?? '',
        // Flag that this community post was generated by Meal Mate so bookmarking
        // the resulting community card keeps it in the "Saved AI Recipes" section.
        aiOrigin: '1',
        aiRecipeJson: stored ? JSON.stringify(stored) : '',
      },
    } as any);
  };

  useEffect(() => {
    const start = (params.initialMessage ?? '').trim();
    if (!start || initialSentRef.current) return;
    initialSentRef.current = true;
    // Only auto-send the preprogrammed prompt when the conversation is empty —
    // if the user is resuming an existing chat, restore it instead of replaying.
    if (messages.length === 0) {
      void send(start);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.initialMessage]);

  const startNewChat = () => {
    // Archive the current conversation into the last-5 history (if it has
    // any messages) and open a fresh one.
    startNewChatSession();
    setMessagesState([]);
    initialSentRef.current = false;
    const start = (params.initialMessage ?? '').trim();
    if (start) {
      initialSentRef.current = true;
      void send(start);
    }
  };

  // ── Past chats panel ───────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  // `sessions` and `activeId` are derived via cacheVersion so the modal
  // re-renders whenever a session is added / removed / switched.
  const [sessionCacheVersion, setSessionCacheVersion] = useState(0);
  useEffect(() => {
    const unsub = subscribeChatSession(() =>
      setSessionCacheVersion((v) => v + 1),
    );
    return unsub;
  }, []);
  const allSessions = useMemo<ChatSession[]>(
    () => getAllSessions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionCacheVersion, historyOpen],
  );
  const activeSessionId = getActiveSessionId();

  const pickSession = (sessionId: string) => {
    loadChatSession(sessionId);
    setMessagesState([...(getChatSession().messages as Message[])]);
    initialSentRef.current = true;
    setHistoryOpen(false);
  };

  const confirmDeleteSession = (session: ChatSession) => {
    Alert.alert(
      'Delete this chat?',
      session.label === 'New chat'
        ? 'This will remove an empty chat.'
        : `"${session.label}" will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteChatSession(session.id);
            setMessagesState([...(getChatSession().messages as Message[])]);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <AnimatedBackground variant={messages.length === 0 ? 'warm' : 'subtle'} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {messages.length > 0 ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={startNewChat}
            activeOpacity={0.8}
            disabled={sending}
            accessibilityLabel="Start new chat">
            <Ionicons name="add-circle-outline" size={24} color={sending ? '#888' : '#000'} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <ThemedText style={styles.title}>Meal Mate</ThemedText>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setHistoryOpen(true)}
          activeOpacity={0.8}
          accessibilityLabel="Show past chats">
          <Ionicons name="time-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={historyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryOpen(false)}>
        <Pressable
          style={styles.historyBackdrop}
          onPress={() => setHistoryOpen(false)}>
          <Pressable
            style={[styles.historySheet, { paddingTop: insets.top + 16 }]}
            onPress={() => {
              // Intentional no-op — the nested Pressable claims the touch
              // so taps inside the sheet don't bubble to the backdrop.
            }}>
            <View style={styles.historyHeader}>
              <ThemedText style={styles.historyTitle}>Past chats</ThemedText>
              <TouchableOpacity
                onPress={() => setHistoryOpen(false)}
                hitSlop={10}
                activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.historySubtitle}>
              Your last {allSessions.length} conversation{allSessions.length === 1 ? '' : 's'}
            </ThemedText>
            {allSessions.length === 0 ? (
              <ThemedText style={styles.historyEmpty}>
                No chats yet — send Meal Mate a message to get started.
              </ThemedText>
            ) : (
              <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {allSessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const msgCount = s.messages.length;
                  const when = new Date(s.updated_at);
                  const whenLabel = isNaN(when.getTime())
                    ? ''
                    : when.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      }) +
                      ' · ' +
                      when.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      });
                  return (
                    <View
                      key={s.id}
                      style={[
                        styles.historyRow,
                        isActive && styles.historyRowActive,
                      ]}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => pickSession(s.id)}
                        activeOpacity={0.85}>
                        <ThemedText
                          style={[
                            styles.historyRowLabel,
                            isActive && styles.historyRowLabelActive,
                          ]}
                          numberOfLines={2}>
                          {s.label}
                        </ThemedText>
                        <ThemedText style={styles.historyRowMeta}>
                          {msgCount === 0
                            ? 'Empty'
                            : `${msgCount} message${msgCount === 1 ? '' : 's'}`}
                          {whenLabel ? `  ·  ${whenLabel}` : ''}
                          {isActive ? '  ·  Active' : ''}
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDeleteSession(s)}
                        hitSlop={8}
                        activeOpacity={0.7}
                        style={styles.historyRowDelete}>
                        <Ionicons name="trash-outline" size={18} color="#a23a2f" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {messages.length === 0 ? (
        <WelcomeState onPickSuggestion={(msg) => void send(msg)} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} onRecipePress={onRecipePress} onPostPress={onPostPress} />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: 18 }]}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={sending ? <ThinkingIndicator /> : null}
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: true });
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {voiceError ? (
            <View style={styles.voiceErrorPill}>
              <Ionicons name="alert-circle" size={14} color="#a12f2f" />
              <ThemedText style={styles.voiceErrorText} numberOfLines={2}>
                {voiceError}
              </ThemedText>
            </View>
          ) : null}
          <View style={[styles.composer, listening && styles.composerListening]}>
            <TextInput
              style={styles.input}
              placeholder={listening ? 'Listening…' : 'Chat with Meal Mate...'}
              placeholderTextColor={listening ? '#c47d44' : TEXT_MUTED}
              value={draft}
              onChangeText={setDraft}
              returnKeyType="send"
              onSubmitEditing={() => void send(draft)}
              editable={!listening}
            />
            <TouchableOpacity
              style={[styles.micButton, listening && styles.micButtonListening]}
              onPress={onMicOrSendPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                draft.trim() ? 'Send' : listening ? 'Stop dictation' : 'Dictate message'
              }
              disabled={voiceSupported === false && !draft.trim()}>
              <Ionicons
                name={draft.trim() ? 'arrow-up' : listening ? 'stop' : 'mic'}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.3 },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },

  historyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
  },
  historySheet: {
    backgroundColor: CREAM,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    maxHeight: '80%',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  historySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_MUTED,
  },
  historyEmpty: {
    marginTop: 18,
    fontSize: 14,
    color: TEXT_MUTED,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  historyRowActive: {
    borderColor: '#ffb259',
    backgroundColor: '#fff7e8',
  },
  historyRowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  historyRowLabelActive: {
    color: '#b55a0f',
  },
  historyRowMeta: {
    marginTop: 3,
    fontSize: 12,
    color: TEXT_MUTED,
  },
  historyRowDelete: {
    marginLeft: 10,
    padding: 6,
  },

  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(90,60,23,0.08)',
  },
  bubbleUser: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderBottomLeftRadius: 6,
    shadowColor: '#8b5a2b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextUser: { color: '#fff', fontWeight: '500' },
  bubbleTextAssistant: { color: '#1a1a1a' },

  recipeCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#f4ead1',
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: 72,
    backgroundColor: '#faf2dc',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  recipeBody: {
    padding: 14,
    gap: 10,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    lineHeight: 20,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff4db',
    borderRadius: 100,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  macroPillLabel: { fontSize: 11, color: '#7a6a44', fontWeight: '700' },
  macroPillValue: { fontSize: 11, color: '#111', fontWeight: '700' },
  recipeWhyText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#444',
  },
  recipeActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  recipeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 100,
  },
  recipeActionBtnPrimary: {
    backgroundColor: '#ffb259',
  },
  recipeActionBtnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  recipeActionBtnTextPrimary: { fontSize: 13, fontWeight: '700', color: '#fff' },
  recipeActionBtnTextSecondary: { fontSize: 13, fontWeight: '700', color: '#111' },

  composerWrap: { paddingHorizontal: 16, paddingTop: 6, backgroundColor: 'transparent' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(90,60,23,0.12)',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#8b5a2b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  input: { flex: 1, fontSize: 15, color: '#111', paddingVertical: 8 },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerListening: {
    borderColor: '#d96a3f',
    shadowColor: '#d96a3f',
    shadowOpacity: 0.25,
  },
  micButtonListening: {
    backgroundColor: '#d96a3f',
  },
  voiceErrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251,232,224,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(161,47,47,0.25)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    maxWidth: '95%',
  },
  voiceErrorText: {
    fontSize: 12,
    color: '#6a1f1f',
    flexShrink: 1,
  },

  welcomeScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  welcomeHero: {
    marginBottom: 4,
  },
  welcomeHi: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    paddingTop: 4,
    includeFontPadding: false,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2f2f2f',
    marginTop: 6,
    marginBottom: 18,
    opacity: 0.9,
  },
  welcomeFeatureRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  welcomeTileSmall: {
    flex: 1,
    height: 140,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#c7e890',
    shadowColor: '#8b5a2b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  welcomeTileLarge: {
    height: 160,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 12,
    backgroundColor: '#c7e890',
    shadowColor: '#8b5a2b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  welcomeTileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,12,4,0.38)',
  },
  welcomeTileEyebrow: {
    position: 'absolute',
    left: 14,
    top: 12,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  welcomeTileLabel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  welcomeTileLabelLarge: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  welcomePromptStack: { marginTop: 16, gap: 10 },
  welcomePromptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 100,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(90,60,23,0.12)',
    shadowColor: '#8b5a2b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  welcomePromptText: { fontSize: 14, fontWeight: '700', color: '#2a2a2a' },
});

