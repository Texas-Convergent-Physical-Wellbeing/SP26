import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { api, getAuthToken, type ChatMessage as ApiChatMessage, type ChatResponse as ApiChatResponse } from '@/services/api';
import { getChatRecipe, getChatRecipeImageUrl, putChatRecipe } from '@/services/chat-recipe-store';
import { RECIPES } from '@/data/recipes';

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

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatAssistantText(raw: string): string {
  // The backend may return Markdown (tables, headings, separators). Keep the UI readable.
  const lines = raw.replace(/\r/g, '').split('\n');
  const cleaned = lines
    .filter((l) => !/^\s*\|.*\|\s*$/.test(l)) // drop markdown table rows
    .filter((l) => !/^\s*\|?-{3,}\|?-{0,}.*$/.test(l)) // drop table separators / --- rules
    .map((l) => l.replace(/^\s{0,3}#{1,6}\s+/g, '')) // headings
    .map((l) => l.replace(/\*\*(.*?)\*\*/g, '$1')) // bold
    .map((l) => l.replace(/`([^`]+)`/g, '$1')) // inline code
    .map((l) => l.trimEnd());
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function MessageBubble({ message, onRecipePress }: { message: Message; onRecipePress: (id: string) => void }) {
  const isUser = message.role === 'user';

  if (message.kind === 'recipe') {
    const stored = getChatRecipe(message.recipe.id);
    const imageUrl = getChatRecipeImageUrl(message.recipe.id) ?? RECIPES[0]?.imageUrl;
    const macros = stored?.macros ?? null;
    const why = stored?.why_this_works ?? null;
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <View style={styles.recipeCard}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={styles.recipeCardImageMock} />}
          <View style={styles.recipeCardOverlay} />
          <View style={styles.recipeCardTitleBar}>
            <ThemedText style={styles.recipeCardTitle} numberOfLines={1}>
              {message.recipe.title}
            </ThemedText>
          </View>
          <ThemedText style={styles.recipeCardCta}>{message.recipe.cta}</ThemedText>
          {!!macros && (
            <View style={styles.recipeFactsRow} pointerEvents="none">
              <ThemedText style={styles.recipeFact}>Cal {macros.calories ?? '—'}</ThemedText>
              <ThemedText style={styles.recipeFact}>P {macros.protein_g ?? '—'}g</ThemedText>
              <ThemedText style={styles.recipeFact}>C {macros.carbs_g ?? '—'}g</ThemedText>
              <ThemedText style={styles.recipeFact}>F {macros.fat_g ?? '—'}g</ThemedText>
            </View>
          )}
          {!!why && (
            <ThemedText style={styles.recipeWhy} numberOfLines={2} pointerEvents="none">
              {formatAssistantText(why)}
            </ThemedText>
          )}
          <Pressable style={styles.recipeCardHit} onPress={() => onRecipePress(message.recipe.id)} />
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

export default function MealMateConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ initialMessage?: string }>();
  const listRef = useRef<FlatList<Message>>(null);

  const [draft, setDraft] = useState('');

  const initial = useMemo<Message[]>(() => {
    const start = (params.initialMessage ?? '').trim();
    if (!start) return [];
    return [{ id: makeId(), role: 'user', kind: 'text', text: start }];
  }, [params.initialMessage]);

  const [messages, setMessages] = useState<Message[]>(() => initial);
  const [history, setHistory] = useState<ApiChatMessage[]>(() =>
    initial.length
      ? [{ role: 'user', content: initial[0].text }]
      : [],
  );
  const [sending, setSending] = useState(false);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft('');
    if (sending) return;

    // optimistic user message
    setMessages((prev) => [...prev, { id: makeId(), role: 'user', kind: 'text', text: trimmed }]);

    setSending(true);
    try {
      const token = getAuthToken();

      // If not authenticated yet, show a local demo response so the UI is usable.
      if (!token) {
        const recipeId = makeId();
        putChatRecipe(recipeId, {
          title: 'Super Cool Personalized Recipe Here',
          summary: 'Sign in to enable live AI generation. This is a local demo card.',
          ingredients: ['Example ingredient 1', 'Example ingredient 2'],
          steps: ['Example step 1', 'Example step 2'],
          macros: { calories: 480, protein_g: 30, carbs_g: 50, fat_g: 18, fiber_g: 8 },
          why_this_works: 'Once authenticated, Meal Mate will tailor this to your profile.',
        }, RECIPES[0]?.imageUrl);
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            kind: 'recipe',
            text: 'Sign in to enable live Meal Mate responses.',
            recipe: { id: recipeId, title: 'Super Cool Personalized Recipe Here', cta: 'Click to learn more' },
          },
        ]);
        return;
      }

      const res: ApiChatResponse = await api.sendChatMessage(trimmed, history);
      setHistory(res.conversation_history);

      const recipePayload = res.recipe ?? null;

      if (res.kind === 'recipe' && recipePayload) {
        const recipeId = makeId();
        putChatRecipe(recipeId, recipePayload, RECIPES[0]?.imageUrl);
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'assistant',
            kind: 'recipe',
            text: formatAssistantText(res.response),
            recipe: { id: recipeId, title: recipePayload.title, cta: 'Click to learn more' },
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', kind: 'text', text: formatAssistantText(res.response) },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send message';
      setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', kind: 'text', text: msg }]);
    } finally {
      setSending(false);
    }
  };

  const onRecipePress = (id: string) => {
    router.push({ pathname: '/(tabs)/chat/recipe/[id]', params: { id } } as any);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#f6d0cf', '#fff4db', '#b9e59a', '#f8a06a']}
        locations={[0, 0.38, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#000" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Meal Mate</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} onRecipePress={onRecipePress} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 18 }]}
        showsVerticalScrollIndicator={false}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Chat with Meal Mate..."
              placeholderTextColor={TEXT_MUTED}
              value={draft}
              onChangeText={setDraft}
              returnKeyType="send"
              onSubmitEditing={() => void send(draft)}
            />
            <TouchableOpacity
              style={styles.micButton}
              onPress={() => void send(draft)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Send">
              <Ionicons name="mic" size={18} color="#111" />
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
  title: { fontSize: 20, fontWeight: '800', color: '#000' },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  bubbleUser: { backgroundColor: '#fff' },
  bubbleAssistant: { backgroundColor: '#fff' },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextUser: { color: '#111', fontWeight: '500' },
  bubbleTextAssistant: { color: '#111' },

  recipeCard: {
    width: 345,
    height: 168,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1.2,
    borderColor: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 0,
  },
  recipeCardImageMock: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },
  recipeCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  recipeCardTitleBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
    height: 42,
    backgroundColor: 'rgba(61,61,61,0.45)',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  recipeCardTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  recipeCardCta: { color: '#111', fontSize: 14, padding: 14, paddingTop: 10 },
  recipeFactsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  recipeFact: { fontSize: 12, color: '#111', fontWeight: '700' },
  recipeWhy: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    fontSize: 12,
    lineHeight: 16,
    color: '#111',
    fontWeight: '600',
  },
  recipeCardHit: { ...StyleSheet.absoluteFillObject },

  composerWrap: { paddingHorizontal: 16, paddingTop: 6, backgroundColor: 'transparent' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 15, color: '#111', paddingVertical: 6 },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

