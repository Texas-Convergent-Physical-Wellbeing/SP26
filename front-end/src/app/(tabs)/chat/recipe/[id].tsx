import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
const BROWN = '#7a4720';
const PROTEIN_COLOR = '#ffb259';
const CARBS_COLOR = '#c7e890';
const FAT_COLOR = '#f08a50';
// Height of the hero image block, matches the community recipe detail so
// both screens feel visually identical at the top.
const HERO_HEIGHT = 300;

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

  // Heuristic prep/cook/serves info so the chat recipe card matches the
  // curated recipe detail's stat-pill row visually. The backend chat payload
  // doesn't carry these explicitly yet, so derive them from the structure.
  const prepTime = recipe.ingredients.length > 8 ? '20 min' : '10 min';
  const cookTime = recipe.steps.length > 4 ? '25 min' : '15 min';
  const servings = 2;

  // The hero image always renders something — either the user-supplied /
  // AI-generated image, or a stock fallback — so the layout stays stable
  // and matches the community recipe detail exactly.
  const heroImage = imageUri ?? stockFoodImage(recipe.title || '', seedFromId(recipeId));

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* ── Hero block — mirrors /recipe/[id] exactly so generated and */}
        {/* community recipes feel like the same screen. ──────────────── */}
        <View style={{ height: HERO_HEIGHT }}>
          <Image
            source={{ uri: heroImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
            placeholderContentFit="cover"
            placeholder={{
              uri: stockFoodImage(recipe.title || '', seedFromId(recipeId)),
            }}
          />
          <View style={[styles.heroOverlay, { paddingTop: insets.top }]}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.circleBtn} onPress={goBack} activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={22} color="#000" />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {imageUri ? (
                  <>
                    <TouchableOpacity
                      style={styles.circleBtn}
                      onPress={pickImage}
                      activeOpacity={0.8}
                      accessibilityLabel="Replace photo">
                      <Ionicons name="image-outline" size={18} color="#111" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.circleBtn}
                      onPress={removeImage}
                      activeOpacity={0.8}
                      accessibilityLabel="Remove photo">
                      <Ionicons name="trash-outline" size={18} color="#111" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={pickImage}
                    activeOpacity={0.8}
                    accessibilityLabel="Add photo">
                    <Ionicons name="camera-outline" size={18} color="#111" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: ORANGE }]}
                  onPress={() => void toggleBookmark()}
                  activeOpacity={0.8}
                  disabled={bookmarkBusy}
                  accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Add bookmark'}>
                  <Ionicons
                    name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={bookmarked ? BROWN : '#333'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroTitleRow}>
              <ThemedText style={styles.heroTitle} numberOfLines={3}>
                {recipe.title}
              </ThemedText>
              <View style={styles.heroTag}>
                <ThemedText style={styles.heroTagText}>AI-generated</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'recipe' && styles.tabBtnActive]}
            onPress={() => setTab('recipe')}
            activeOpacity={0.85}>
            <ThemedText style={[styles.tabLabel, tab === 'recipe' && styles.tabLabelActive]}>Recipe</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'facts' && styles.tabBtnActive]}
            onPress={() => setTab('facts')}
            activeOpacity={0.85}>
            <ThemedText style={[styles.tabLabel, tab === 'facts' && styles.tabLabelActive]}>Facts</ThemedText>
          </TouchableOpacity>
        </View>

        {tab === 'recipe' ? (
          <View style={styles.tabContent}>
            {/* Stats row — matches the curated recipe detail screen. */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Ionicons name="time-outline" size={16} color={BROWN} />
                <ThemedText style={styles.statLabel}>Prep</ThemedText>
                <ThemedText style={styles.statValue}>{prepTime}</ThemedText>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="flame-outline" size={16} color={BROWN} />
                <ThemedText style={styles.statLabel}>Cook</ThemedText>
                <ThemedText style={styles.statValue}>{cookTime}</ThemedText>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="people-outline" size={16} color={BROWN} />
                <ThemedText style={styles.statLabel}>Serves</ThemedText>
                <ThemedText style={styles.statValue}>{servings}</ThemedText>
              </View>
            </View>

            {/* Summary paragraph under the stats row (mirrors community) */}
            {recipe.summary ? (
              <ThemedText style={styles.description}>{recipe.summary}</ThemedText>
            ) : null}

            {/* Primary CTA — post this AI recipe to the community feed */}
            <TouchableOpacity style={styles.postBtn} onPress={postToCommunity} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={16} color="#fff" />
              <ThemedText style={styles.postBtnText}>Post to Community</ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.sectionTitle}>Ingredients</ThemedText>
            <View style={styles.listCard}>
              {recipe.ingredients.map((item, idx) => (
                <View
                  key={`${item}-${idx}`}
                  style={[styles.ingredientRow, idx === recipe.ingredients.length - 1 && styles.lastRow]}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                  <ThemedText style={styles.ingredientText}>{item}</ThemedText>
                </View>
              ))}
            </View>

            <ThemedText style={[styles.sectionTitle, { marginTop: 20 }]}>Steps</ThemedText>
            <View style={styles.listCard}>
              {recipe.steps.map((step, i) => (
                <View
                  key={`${step}-${i}`}
                  style={[styles.stepRow, i === recipe.steps.length - 1 && styles.lastRow]}>
                  <View style={[styles.stepCircle, { backgroundColor: i % 2 === 0 ? ORANGE : GREEN_SOFT }]}>
                    <ThemedText style={styles.stepNumber}>{i + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.stepText}>{step}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.tabContent}>
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
            <ThemedText style={[styles.sectionTitle, { marginTop: 20 }]}>Health Condition Alignment</ThemedText>
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
            <ThemedText style={[styles.sectionTitle, { marginTop: 20 }]}>Calorie Budget</ThemedText>
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
            <ThemedText style={[styles.sectionTitle, { marginTop: 20 }]}>Why This Works?</ThemedText>
            <View style={styles.card}>
              <ThemedText style={styles.whyText}>{recipe.why_this_works ?? '—'}</ThemedText>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },

  /* ── Hero (mirrors /recipe/[id]) ───────────────────────────────────── */
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleRow: {
    gap: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 32,
  },
  heroTag: {
    alignSelf: 'flex-start',
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  /* ── Tabs (mirrors /recipe/[id]) ───────────────────────────────────── */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: CREAM,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    backgroundColor: '#e8dcc8',
  },
  tabBtnActive: { backgroundColor: ORANGE },
  tabLabel: { fontSize: 15, fontWeight: '600', color: '#888' },
  tabLabelActive: { color: '#fff' },

  /* Shared content container */
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  /* Description / summary paragraph */
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#444',
    marginBottom: 16,
  },

  /* Post to Community CTA */
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 13,
    marginBottom: 20,
  },
  postBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 12 },
  card: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    gap: 8,
  },

  /* Stats row (matches curated recipe detail) */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#fff4db',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e8dcc8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '500' },
  statValue: { fontSize: 13, fontWeight: '700', color: BROWN },

  /* Lists wrapped in a soft white card */
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  lastRow: { marginBottom: 0 },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  ingredientText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
    flex: 1,
    lineHeight: 22,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumber: { fontSize: 13, fontWeight: '800', color: '#000' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 22, color: '#333' },

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

