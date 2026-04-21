import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { RECIPES } from '@/data/recipes';

const CREAM = '#fff4db';
// Figma `90:316` uses a greenish blurred panel; approximate with soft palette.
const GREEN_SOFT = '#c7e890';
const TEXT_MUTED = '#434343';

type QuickPrompt = {
  id: string;
  label: string;
  message: string;
};

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'med-lunch',
    label: 'Suggest a Mediterranean lunch',
    message: 'Suggest a Mediterranean lunch.',
  },
  {
    id: 'italian-dinner',
    label: 'Suggest an Italian dinner',
    message: 'Suggest an Italian dinner.',
  },
];

export default function MealMateEntryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [draft, setDraft] = useState('');

  const featured = useMemo(() => {
    const a = RECIPES[0];
    const b = RECIPES[1] ?? RECIPES[0];
    const c = RECIPES[2] ?? RECIPES[0];
    return { a, b, c };
  }, []);

  const goToConversation = (initialMessage?: string) => {
    const message = (initialMessage ?? draft).trim();
    router.push({
      pathname: '/(tabs)/chat/conversation',
      params: message ? { initialMessage: message } : {},
    } as any);
    setDraft('');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <ThemedText style={styles.headerTitle}>Meal Mate</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.hi}>Hi There!</ThemedText>
        <ThemedText style={styles.subtitle}>
          Get personalized recommendations{'\n'}for recipe substitutes
        </ThemedText>

        <View style={styles.featureRow}>
          <Pressable
            style={styles.tileSmall}
            onPress={() =>
              goToConversation(`Suggest a culturally-accurate recipe inspired by ${featured.a.name} with macros and why it works.`)
            }>
            <Image source={{ uri: featured.a.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.tileOverlay} />
            <ThemedText style={styles.tileLabel} numberOfLines={1}>
              {featured.a.name}
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.tileSmall}
            onPress={() =>
              goToConversation(`Suggest a culturally-accurate recipe inspired by ${featured.b.name} with macros and why it works.`)
            }>
            <Image source={{ uri: featured.b.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.tileOverlay} />
            <ThemedText style={styles.tileLabel} numberOfLines={1}>
              {featured.b.name}
            </ThemedText>
          </Pressable>
        </View>

        <Pressable style={styles.tileLarge} onPress={() => goToConversation('Generate Breakfast, Lunch, and Dinner.')}>
          <Image source={{ uri: featured.c.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.tileOverlay} />
          <ThemedText style={styles.tileLabelLarge} numberOfLines={2}>
            Generate Breakfast, Lunch, and Dinner
          </ThemedText>
        </Pressable>

        <View style={styles.promptStack}>
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity key={p.id} style={styles.promptPill} onPress={() => goToConversation(p.message)} activeOpacity={0.85}>
              <ThemedText style={styles.promptText}>{p.label}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Chat with Meal Mate..."
            placeholderTextColor={TEXT_MUTED}
            value={draft}
            onChangeText={setDraft}
            returnKeyType="send"
            onSubmitEditing={() => goToConversation()}
          />
          <TouchableOpacity
            style={styles.micButton}
            onPress={() => goToConversation()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send">
            <Ionicons name="mic" size={18} color="#111" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: { alignItems: 'center', paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#000' },

  scroll: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 14,
  },
  hi: { fontSize: 24, fontWeight: '800', color: '#000', marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#111', marginTop: 6, marginBottom: 10 },

  featureRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  tileSmall: {
    flex: 1,
    height: 132,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: GREEN_SOFT,
  },
  tileLarge: {
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 10,
    backgroundColor: GREEN_SOFT,
  },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  tileLabel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  tileLabelLarge: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 18,
    paddingBottom: 2,
  },

  promptStack: { marginTop: 12, gap: 10 },
  promptPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  promptText: { fontSize: 14, fontWeight: '700', color: '#111' },

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

