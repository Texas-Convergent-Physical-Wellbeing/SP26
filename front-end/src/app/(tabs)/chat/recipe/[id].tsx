import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { DonutChart } from '@/components/donut-chart';
import { api } from '@/services/api';
import {
  addChatBookmark,
  getChatBookmarks,
  hydrateChatBookmarks,
  isChatRecipeBookmarked,
  removeChatBookmark,
  subscribeChatBookmarks,
} from '@/services/chat-bookmark-store';
import {
  ensureChatRecipe,
  getChatRecipe,
  getChatRecipeImageUrl,
  hydrateChatRecipes,
  setChatRecipeImage,
  subscribeChatRecipes,
} from '@/services/chat-recipe-store';
import { seedFromId, stockFoodImage } from '@/utils/synthesize-recipe-facts';

const CREAM = '#fff4db';
const ORANGE = '#ffb259';
const GREEN_SOFT = '#c7e890';
const PROTEIN_COLOR = '#ffb259';
const CARBS_COLOR = '#c7e890';
const FAT_COLOR = '#f08a50';

type Tab = 'recipe' | 'facts';
type MacroKey = 'protein' | 'carbs' | 'fat';

const RECIPE_NOT_FOUND = {
  title: 'Recipe not found',
  summary: 'Return to chat and generate a recipe card.',
  ingredients: [] as string[],
  steps: [] as string[],
  macros: null,
  why_this_works: null,
} as const;

export default function ChatRecipeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const [tab, setTab] = useState<Tab>('recipe');
  const recipeId = id ? String(id) : '';

  // When opened from the Bookmarks tab, `router.back()` resolves to the chat
  // conversation route (since this screen lives under `(tabs)/chat/...`).
  // Route back to bookmarks explicitly in that case so the user isn't yanked
  // into the LLM conversation.
  const goBack = () => {
    if (from === 'bookmarks') {
      router.replace('/(tabs)/bookmarks' as any);
      return;
    }
    router.back();
  };
  const [bookmarked, setBookmarked] = useState(() => isChatRecipeBookmarked(recipeId));
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Re-render trigger for the in-memory chat-recipe store (it's populated
  // asynchronously on hydrate, so we need to refresh when it lands).
  const [cacheVersion, setCacheVersion] = useState(0);

  useEffect(() => {
    void hydrateChatRecipes();
    const unsub = subscribeChatRecipes(() => setCacheVersion((v) => v + 1));
    return unsub;
  }, []);

  // Hydrate bookmarks so we can fall back to the bookmark's snapshot payload
  // if the recipe has dropped out of the live chat cache (e.g. user started
  // a new chat, which clears messages — the bookmark still has the payload).
  useEffect(() => {
    void hydrateChatBookmarks().then(() => {
      if (recipeId) setBookmarked(isChatRecipeBookmarked(recipeId));
      setCacheVersion((v) => v + 1);
    });
    const unsubscribe = subscribeChatBookmarks(() => {
      if (recipeId) setBookmarked(isChatRecipeBookmarked(recipeId));
      setCacheVersion((v) => v + 1);
    });
    return unsubscribe;
  }, [recipeId]);

  const recipe = useMemo(() => {
    if (!recipeId) return RECIPE_NOT_FOUND;
    const stored = getChatRecipe(recipeId);
    if (stored) return stored;
    // Fallback: look in persisted bookmarks (the user saved it there, so the
    // full payload survives even if the original chat session is long gone).
    const fromBookmark = getChatBookmarks().find((b) => b.id === recipeId);
    if (fromBookmark?.recipe) {
      // Seed the chat-recipe store so images/tabs behave normally.
      ensureChatRecipe(recipeId, fromBookmark.recipe, fromBookmark.imageUri);
      return fromBookmark.recipe;
    }
    return RECIPE_NOT_FOUND;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, cacheVersion]);

  const [imageUri, setImageUri] = useState<string | null>(() =>
    recipeId ? getChatRecipeImageUrl(recipeId) ?? null : null,
  );

  useEffect(() => {
    if (!recipeId) return;
    const url = getChatRecipeImageUrl(recipeId);
    if (url) {
      setImageUri(url);
      return;
    }
    // If we didn't find it in the live store, check the saved bookmark.
    const bm = getChatBookmarks().find((b) => b.id === recipeId);
    if (bm?.imageUri) setImageUri(bm.imageUri);
  }, [recipeId, cacheVersion]);

  const toggleBookmark = async () => {
    if (!recipeId || bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (bookmarked) {
        await removeChatBookmark(recipeId);
      } else {
        await addChatBookmark(recipeId, recipe, imageUri);
      }
    } finally {
      setBookmarkBusy(false);
    }
  };

  const [activeMacro, setActiveMacro] = useState<MacroKey | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getMacros();
        if (!cancelled) setTdee(res.tdee || null);
      } catch {
        // User may not have a profile yet; Facts tab degrades gracefully.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to upload an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      if (recipeId) setChatRecipeImage(recipeId, uri);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    if (recipeId) setChatRecipeImage(recipeId, null);
  };

  const postToCommunity = () => {
    router.push({
      pathname: '/create-post',
      params: {
        prefillTitle: recipe.title,
        prefillDescription: recipe.summary || recipe.why_this_works || '',
        prefillIngredients: recipe.ingredients.join('\n'),
        prefillSteps: recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        prefillImage: imageUri ?? '',
        // Flag this post as AI-authored so it stays in the "Saved AI Recipes"
        // strip when the user bookmarks it from the community feed.
        aiOrigin: '1',
        aiRecipeJson: JSON.stringify(recipe),
      },
    } as any);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#f6d0cf', '#fff4db', '#b9e59a', '#f8a06a']}
        locations={[0, 0.38, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.topRow, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.circleBtn} onPress={goBack} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#000" />
          </TouchableOpacity>
          <ThemedText style={styles.title} numberOfLines={2}>
            {recipe.title}
          </ThemedText>
          <TouchableOpacity
            style={[styles.circleBtn, bookmarked && { backgroundColor: ORANGE }]}
            onPress={() => void toggleBookmark()}
            activeOpacity={0.8}
            disabled={bookmarkBusy}>
            <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Image / upload area */}
        {imageUri ? (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={250}
              placeholderContentFit="cover"
              placeholder={{
                uri: stockFoodImage(recipe.title || '', seedFromId(recipeId)),
              }}
            />
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageActionPill} onPress={pickImage} activeOpacity={0.85}>
                <Ionicons name="image-outline" size={14} color="#111" />
                <ThemedText style={styles.imageActionText}>Replace</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageActionPill} onPress={removeImage} activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={14} color="#111" />
                <ThemedText style={styles.imageActionText}>Remove</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadCard} onPress={pickImage} activeOpacity={0.85}>
            <View style={styles.uploadIcon}>
              <Ionicons name="cloud-upload-outline" size={22} color="#111" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.uploadTitle}>Add a photo</ThemedText>
              <ThemedText style={styles.uploadSub}>Optional — upload an image of your dish</ThemedText>
            </View>
          </TouchableOpacity>
        )}

        <ThemedText style={styles.summary}>{recipe.summary}</ThemedText>

        <TouchableOpacity style={styles.postBtn} onPress={postToCommunity} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={16} color="#fff" />
          <ThemedText style={styles.postBtnText}>Post to Community</ThemedText>
        </TouchableOpacity>

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
            {/* ── Macronutrients ─────────────────────────────────────────── */}
            <ThemedText style={styles.sectionTitle}>Macronutrients</ThemedText>
            <View style={styles.card}>
              {(() => {
                const protein = recipe.macros?.protein_g ?? 0;
                const carbs = recipe.macros?.carbs_g ?? 0;
                const fat = recipe.macros?.fat_g ?? 0;
                const totalGrams = protein + carbs + fat;
                const pct = (n: number) =>
                  totalGrams > 0 ? Math.round((n / totalGrams) * 100) : 0;

                const macroItems: { key: MacroKey; label: string; value: number; color: string; pctVal: number }[] = [
                  { key: 'carbs', label: 'Carbs', value: carbs, color: CARBS_COLOR, pctVal: pct(carbs) },
                  { key: 'fat', label: 'Fats', value: fat, color: FAT_COLOR, pctVal: pct(fat) },
                  { key: 'protein', label: 'Protein', value: protein, color: PROTEIN_COLOR, pctVal: pct(protein) },
                ];

                const active = macroItems.find((m) => m.key === activeMacro) ?? null;

                return (
                  <View style={styles.macroChartRow}>
                    <DonutChart
                      segments={macroItems.map((m) => ({ key: m.key, value: m.value, color: m.color }))}
                      size={150}
                      strokeWidth={22}
                      activeKey={active?.key ?? null}>
                      {active ? (
                        <>
                          <ThemedText style={styles.donutCenterValue}>{active.value}g</ThemedText>
                          <ThemedText style={styles.donutCenterLabel}>{active.label}</ThemedText>
                        </>
                      ) : (
                        <>
                          <ThemedText style={styles.donutCenterValue}>{recipe.macros?.calories ?? '—'}</ThemedText>
                          <ThemedText style={styles.donutCenterLabel}>kcal</ThemedText>
                        </>
                      )}
                    </DonutChart>

                    <View style={styles.legendCol}>
                      {macroItems.map((m) => {
                        const isActive = activeMacro === m.key;
                        return (
                          <TouchableOpacity
                            key={m.key}
                            style={[styles.legendRow, isActive && styles.legendRowActive]}
                            onPress={() => setActiveMacro((prev) => (prev === m.key ? null : m.key))}
                            activeOpacity={0.75}>
                            <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                            <ThemedText style={styles.legendLabel}>{m.label}</ThemedText>
                            <ThemedText style={styles.legendPct}>
                              {isActive ? `${m.value}g` : `${m.pctVal}%`}
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
              <ThemedText style={styles.tapHint}>Tap a macro to see grams · Fiber {recipe.macros?.fiber_g ?? 0}g</ThemedText>
            </View>

            {/* ── Health Condition Alignment ─────────────────────────────── */}
            <ThemedText style={styles.sectionTitle}>Health Condition Alignment</ThemedText>
            <View style={styles.card}>
              {(() => {
                const tags = (recipe as any).health_tags as string[] | undefined;
                if (!tags || tags.length === 0) {
                  return (
                    <ThemedText style={styles.factLine}>
                      No specific alignment tags for this dish.
                    </ThemedText>
                  );
                }
                return (
                  <View style={styles.pillRow}>
                    {tags.map((t, i) => (
                      <View
                        key={`${t}-${i}`}
                        style={[styles.conditionPill, i % 2 === 0 ? styles.conditionPillGreen : styles.conditionPillOrange]}>
                        <ThemedText style={styles.conditionPillText}>{t}</ThemedText>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>

            {/* ── Calorie Budget ─────────────────────────────────────────── */}
            <ThemedText style={styles.sectionTitle}>Calorie Budget</ThemedText>
            <View style={styles.card}>
              {(() => {
                const mealKcal = recipe.macros?.calories ?? 0;
                const daily = tdee ?? 2000;
                const used = Math.min(mealKcal, daily);
                const remaining = Math.max(0, daily - used);

                return (
                  <View style={styles.macroChartRow}>
                    <DonutChart
                      segments={[
                        { key: 'used', value: used, color: ORANGE },
                        { key: 'remaining', value: remaining, color: GREEN_SOFT },
                      ]}
                      size={150}
                      strokeWidth={22}>
                      <ThemedText style={styles.donutCenterValue}>{remaining}</ThemedText>
                      <ThemedText style={styles.donutCenterLabel}>kcal left</ThemedText>
                    </DonutChart>

                    <View style={styles.legendCol}>
                      <ThemedText style={styles.budgetBig}>{remaining.toLocaleString()}</ThemedText>
                      <ThemedText style={styles.budgetCaption}>kcal remaining today</ThemedText>
                      <View style={[styles.legendRow, { paddingVertical: 4 }]}>
                        <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
                        <ThemedText style={styles.legendLabel}>Used</ThemedText>
                        <ThemedText style={styles.legendPct}>{used}</ThemedText>
                      </View>
                      <View style={[styles.legendRow, { paddingVertical: 4 }]}>
                        <View style={[styles.legendDot, { backgroundColor: GREEN_SOFT }]} />
                        <ThemedText style={styles.legendLabel}>Remaining</ThemedText>
                        <ThemedText style={styles.legendPct}>{remaining}</ThemedText>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* ── Why This Works ─────────────────────────────────────────── */}
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
  summary: { marginTop: 12, fontSize: 13, lineHeight: 20, color: '#222' },

  imageWrap: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  image: { width: '100%', height: 200, backgroundColor: '#fff' },
  imageActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  imageActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  imageActionText: { fontSize: 12, fontWeight: '700', color: '#111' },

  uploadCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.18)',
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff4db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
  uploadSub: { fontSize: 12, color: '#555', marginTop: 2 },

  postBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 13,
  },
  postBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

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

  macroChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutCenterValue: { fontSize: 20, fontWeight: '800', color: '#111' },
  donutCenterLabel: { fontSize: 12, color: '#555', marginTop: 2 },
  legendCol: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  legendRowActive: {
    backgroundColor: '#fff4db',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: { flex: 1, fontSize: 13, color: '#111', fontWeight: '600' },
  legendPct: { fontSize: 13, color: '#111', fontWeight: '700' },
  tapHint: {
    marginTop: 10,
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionPill: {
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  conditionPillGreen: { backgroundColor: '#c7e890' },
  conditionPillOrange: { backgroundColor: '#ffb259' },
  conditionPillText: { fontSize: 12, fontWeight: '700', color: '#111' },

  budgetBig: { fontSize: 20, fontWeight: '800', color: ORANGE },
  budgetCaption: { fontSize: 12, color: '#555', marginTop: 2, marginBottom: 6 },
});

