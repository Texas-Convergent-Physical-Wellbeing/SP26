import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getChatRecipe } from '@/services/chat-recipe-store';

const CREAM = '#fff4db';
const ORANGE = '#ffb259';

type Tab = 'recipe' | 'facts';

export default function ChatRecipeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('recipe');
  const [bookmarked, setBookmarked] = useState(false);

  const recipe = useMemo(() => {
    const stored = id ? getChatRecipe(String(id)) : undefined;
    return (
      stored ?? {
        title: 'Recipe not found',
        summary: 'Return to chat and generate a recipe card.',
        ingredients: [],
        steps: [],
        macros: null,
        why_this_works: null,
      }
    );
  }, [id]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#f6d0cf', '#fff4db', '#b9e59a', '#f8a06a']}
        locations={[0, 0.38, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.topRow, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#000" />
          </TouchableOpacity>
          <ThemedText style={styles.title} numberOfLines={2}>
            {recipe.title}
          </ThemedText>
          <TouchableOpacity
            style={[styles.circleBtn, bookmarked && { backgroundColor: ORANGE }]}
            onPress={() => setBookmarked((b) => !b)}
            activeOpacity={0.8}>
            <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color="#111" />
          </TouchableOpacity>
        </View>

        <ThemedText style={styles.summary}>{recipe.summary}</ThemedText>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'recipe' && styles.tabBtnActive]} onPress={() => setTab('recipe')} activeOpacity={0.85}>
            <ThemedText style={[styles.tabLabel, tab === 'recipe' && styles.tabLabelActive]}>Recipe</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'facts' && styles.tabBtnActive]} onPress={() => setTab('facts')} activeOpacity={0.85}>
            <ThemedText style={[styles.tabLabel, tab === 'facts' && styles.tabLabelActive]}>Facts</ThemedText>
          </TouchableOpacity>
        </View>

        {tab === 'recipe' ? (
          <>
            <ThemedText style={styles.sectionTitle}>Ingredients:</ThemedText>
            <View style={styles.card}>
              {recipe.ingredients.map((item, idx) => (
                <View key={`${item}-${idx}`} style={styles.listRow}>
                  <Ionicons name="checkmark-circle" size={18} color={ORANGE} />
                  <ThemedText style={styles.listText}>{item}</ThemedText>
                </View>
              ))}
            </View>

            <ThemedText style={styles.sectionTitle}>Steps:</ThemedText>
            <View style={styles.card}>
              {recipe.steps.map((step, i) => (
                <View key={`${step}-${i}`} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <ThemedText style={styles.stepNumText}>{i + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.stepText}>{step}</ThemedText>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <ThemedText style={styles.sectionTitle}>Macronutrients</ThemedText>
            <View style={styles.card}>
              <ThemedText style={styles.factLine}>Calories: {recipe.macros?.calories ?? '—'} kcal</ThemedText>
              <ThemedText style={styles.factLine}>Protein: {recipe.macros?.protein_g ?? '—'} g</ThemedText>
              <ThemedText style={styles.factLine}>Carbs: {recipe.macros?.carbs_g ?? '—'} g</ThemedText>
              <ThemedText style={styles.factLine}>Fat: {recipe.macros?.fat_g ?? '—'} g</ThemedText>
              <ThemedText style={styles.factLine}>Fiber: {recipe.macros?.fiber_g ?? '—'} g</ThemedText>
            </View>

            <ThemedText style={styles.sectionTitle}>Why This Works?</ThemedText>
            <View style={styles.card}>
              <ThemedText style={styles.whyText}>{recipe.why_this_works ?? '—'}</ThemedText>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  scroll: { paddingHorizontal: 16, paddingTop: 2 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: '#000', textAlign: 'center' },
  summary: { marginTop: 10, fontSize: 13, lineHeight: 20, color: '#222' },

  tabRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tabBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 100,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  tabBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  tabLabel: { fontSize: 14, fontWeight: '800', color: '#333' },
  tabLabelActive: { color: '#fff' },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#000' },
  card: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    gap: 8,
  },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  listText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#111' },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#111' },

  factLine: { fontSize: 13, color: '#111' },
  whyText: { fontSize: 13, lineHeight: 20, color: '#111' },
});

