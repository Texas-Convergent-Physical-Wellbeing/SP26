import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShimmerPlaceholder } from '@/components/shimmer-placeholder';
import { ThemedText } from '@/components/themed-text';
import { Recipe, RECIPES } from '@/data/recipes';

const CREAM = '#fff4db';
const ORANGE = '#ffb259';
const ORANGE_ACCENT = '#e46d3a';
const GREEN = '#c7e890';
const BROWN = '#7a4720';

const BOOKMARKS_KEY = 'bookmarked_recipes';
const LIKES_KEY = 'liked_recipes';

type Section = 'liked' | 'saved';

// ─── Filter data (mirrors onboarding quiz options) ────────────────────────────

const FILTER_SECTIONS = [
  {
    title: 'Diet',
    icon: 'leaf-outline' as const,
    options: ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten Free', 'Lactose Intolerant', 'Keto'],
  },
  {
    title: 'Health Conditions',
    icon: 'heart-outline' as const,
    options: ['Diabetes I', 'Diabetes II', 'Heart Disease', 'Celiac Disease', 'Hypertension', 'Obesity', 'Osteoporosis'],
  },
  {
    title: 'Allergens',
    icon: 'warning-outline' as const,
    options: ['Gluten', 'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Fish', 'Crustaceans', 'Soybeans', 'Sesame', 'Mustard', 'Celery', 'Molluscs'],
  },
  {
    title: 'Cuisine',
    icon: 'restaurant-outline' as const,
    options: ['Italian', 'Chinese', 'Mexican', 'Indian', 'Thai', 'Greek', 'French'],
  },
  {
    title: 'Goals',
    icon: 'trophy-outline' as const,
    options: ['Lose Weight', 'Build/Maintain Muscle', 'Improve Overall Nutrition', 'Manage a Health Condition'],
  },
];

function recipeMatchesFilter(recipe: Recipe, filter: string): boolean {
  const f = filter.toLowerCase();
  const tag = (recipe.tag ?? '').toLowerCase();
  const healthLabels = recipe.healthTags.map(t => t.label.toLowerCase());
  const nameLower = recipe.name.toLowerCase();
  const ingredients = recipe.ingredients.map(i => i.toLowerCase()).join(' ');

  // Diet
  if (f === 'vegetarian') return tag === 'vegetarian';
  if (f === 'vegan') return tag === 'vegan';
  if (f === 'gluten free') return tag === 'gluten-free' || healthLabels.some(h => h.includes('gluten'));
  if (f === 'keto') return tag === 'low-carb' || recipe.carbsPercent < 20;
  if (f === 'lactose intolerant') return !ingredients.match(/milk|cheese|cream|butter|yogurt|parmesan|feta/);
  if (f === 'halal') return !ingredients.match(/pork|bacon|ham|lard|wine|beer|alcohol/);
  if (f === 'kosher') return !ingredients.match(/shellfish|shrimp|prawn|crab|lobster|pork|bacon/);

  // Health Conditions
  if (f === 'diabetes i' || f === 'diabetes ii') return healthLabels.some(h => h.includes('diabetic') || h.includes('glycemic'));
  if (f === 'heart disease') return healthLabels.some(h => h.includes('heart'));
  if (f === 'hypertension') return healthLabels.some(h => h.includes('sodium'));
  if (f === 'celiac disease') return tag === 'gluten-free';
  if (f === 'obesity') return recipe.calories <= 380;
  if (f === 'osteoporosis') return healthLabels.some(h => h.includes('calcium') || h.includes('vitamin k') || h.includes('bone'));

  // Allergens — show recipes SAFE for the allergen
  if (f === 'gluten') return tag === 'gluten-free' || !ingredients.match(/flour|bread|soy sauce|noodle|pasta|wheat/);
  if (f === 'peanuts') return !ingredients.match(/peanut/);
  if (f === 'tree nuts') return !ingredients.match(/almond|walnut|cashew|pecan|pistachio|hazelnut/);
  if (f === 'milk') return !ingredients.match(/milk|cream|cheese|butter|yogurt|parmesan|feta/);
  if (f === 'eggs') return !ingredients.match(/\begg(s)?\b/);
  if (f === 'fish') return !ingredients.match(/\bfish\b|salmon|tuna|cod|tilapia|anchov/);
  if (f === 'crustaceans') return !ingredients.match(/shrimp|prawn|crab|lobster/);
  if (f === 'soybeans') return !ingredients.match(/soy|tofu|miso|edamame/);
  if (f === 'sesame') return !ingredients.match(/sesame/);
  if (f === 'mustard') return !ingredients.match(/mustard/);
  if (f === 'celery') return !ingredients.match(/celery/);
  if (f === 'molluscs') return !ingredients.match(/squid|octopus|clam|mussel|oyster|scallop/);

  // Cuisine
  if (f === 'mexican') return tag === 'mexican';
  if (f === 'thai') return nameLower.includes('thai');
  if (f === 'greek') return nameLower.includes('greek');
  if (f === 'italian') return nameLower.includes('risotto');
  if (f === 'chinese') return nameLower.includes('stir-fry') || nameLower.includes('stir fry');
  if (f === 'indian') return nameLower.includes('indian') || nameLower.includes('curry');
  if (f === 'french') return nameLower.includes('french');

  // Goals
  if (f === 'lose weight') return recipe.calories <= 380;
  if (f === 'build/maintain muscle') return tag === 'high-protein' || recipe.proteinPercent >= 35;
  if (f === 'improve overall nutrition') return healthLabels.some(h => h.includes('anti') || h.includes('immune') || h.includes('vitamin') || h.includes('antioxidant'));
  if (f === 'manage a health condition') return healthLabels.some(h => h.includes('diabetic') || h.includes('heart') || h.includes('sodium') || h.includes('glycemic'));

  return false;
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

function FilterSheet({
  visible,
  activeFilters,
  onApply,
  onClose,
}: {
  visible: boolean;
  activeFilters: Set<string>;
  onApply: (filters: Set<string>) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Set<string>>(new Set(activeFilters));

  useEffect(() => {
    if (visible) setDraft(new Set(activeFilters));
  }, [visible]);

  const toggle = (option: string) => {
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fs.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[fs.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={fs.handle} />
          <View style={fs.headerRow}>
            <ThemedText style={fs.sheetTitle}>Filter Recipes</ThemedText>
            <TouchableOpacity onPress={() => setDraft(new Set())} hitSlop={10}>
              <ThemedText style={fs.clearAll}>Clear all</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {FILTER_SECTIONS.map(section => (
              <View key={section.title} style={fs.section}>
                <View style={fs.sectionHeader}>
                  <Ionicons name={section.icon} size={15} color={BROWN} />
                  <ThemedText style={fs.sectionTitle}>{section.title}</ThemedText>
                  {section.title === 'Allergens' && (
                    <ThemedText style={fs.sectionHint}> · shows allergen-safe recipes</ThemedText>
                  )}
                </View>
                <View style={fs.chipRow}>
                  {section.options.map(opt => {
                    const active = draft.has(opt);
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[fs.chip, active && fs.chipActive]}
                        onPress={() => toggle(opt)}
                        activeOpacity={0.8}>
                        {active && (
                          <Ionicons name="checkmark" size={12} color="#fff" style={{ marginRight: 3 }} />
                        )}
                        <ThemedText style={[fs.chipText, active && fs.chipTextActive]}>
                          {opt}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={fs.applyBtn}
            onPress={() => { onApply(draft); onClose(); }}
            activeOpacity={0.85}>
            <ThemedText style={fs.applyText}>
              Apply{draft.size > 0 ? ` (${draft.size})` : ''}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Recipe Card ───────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  onPress,
  onRemove,
  removeIcon,
}: {
  recipe: Recipe;
  onPress: (r: Recipe) => void;
  onRemove: (id: string) => void;
  removeIcon: 'bookmark' | 'heart';
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => onPress(recipe)}>
      {!loaded && <ShimmerPlaceholder style={StyleSheet.absoluteFill} />}
      <Image
        source={{ uri: recipe.imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="disk"
        transition={400}
        onLoad={() => setLoaded(true)}
      />
      <View style={styles.cardOverlay} />
      {recipe.tag && (
        <View style={styles.tag}>
          <ThemedText style={styles.tagText}>{recipe.tag}</ThemedText>
        </View>
      )}
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={e => { e.stopPropagation?.(); onRemove(recipe.id); }}
        hitSlop={8}
        activeOpacity={0.75}>
        <Ionicons
          name={removeIcon}
          size={16}
          color={removeIcon === 'heart' ? '#ff4d6d' : ORANGE_ACCENT}
        />
      </TouchableOpacity>
      <ThemedText style={styles.cardName} numberOfLines={2}>
        {recipe.name}
      </ThemedText>
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function BookmarksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [section, setSection] = useState<Section>('liked');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [rawSaved, rawLiked] = await Promise.all([
          AsyncStorage.getItem(BOOKMARKS_KEY),
          AsyncStorage.getItem(LIKES_KEY),
        ]);
        setSavedIds(rawSaved ? JSON.parse(rawSaved) : []);
        setLikedIds(rawLiked ? JSON.parse(rawLiked) : []);
      })();
    }, []),
  );

  const handleRemoveSaved = async (id: string) => {
    const next = savedIds.filter(x => x !== id);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    setSavedIds(next);
  };

  const handleRemoveLiked = async (id: string) => {
    const next = likedIds.filter(x => x !== id);
    await AsyncStorage.setItem(LIKES_KEY, JSON.stringify(next));
    setLikedIds(next);
  };

  const removeFilter = (f: string) => {
    setActiveFilters(prev => { const n = new Set(prev); n.delete(f); return n; });
  };

  const displayedRecipes = useMemo(() => {
    const ids = section === 'saved' ? savedIds : likedIds;
    let list = RECIPES.filter(r => ids.includes(r.id));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q));
    }
    if (activeFilters.size > 0) {
      list = list.filter(r => [...activeFilters].some(f => recipeMatchesFilter(r, f)));
    }
    return list;
  }, [section, savedIds, likedIds, searchQuery, activeFilters]);

  const leftCol = displayedRecipes.filter((_, i) => i % 2 === 0);
  const rightCol = displayedRecipes.filter((_, i) => i % 2 !== 0);

  const baseCount = section === 'saved' ? savedIds.length : likedIds.length;
  const hasFiltersOrSearch = activeFilters.size > 0 || searchQuery.trim().length > 0;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <ThemedText style={styles.headerTitle}>My Collection</ThemedText>
      </View>

      {/* ── Search bar + filter button ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#aaa" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search saved recipes…"
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilters.size > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilterSheet(true)}
          activeOpacity={0.8}>
          <Ionicons name="options-outline" size={20} color={activeFilters.size > 0 ? '#fff' : BROWN} />
          {activeFilters.size > 0 && (
            <View style={styles.filterBadge}>
              <ThemedText style={styles.filterBadgeText}>{activeFilters.size}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Active filter chips ── */}
      {activeFilters.size > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeFilterRow}
          style={styles.activeFilterScroll}>
          {[...activeFilters].map(f => (
            <TouchableOpacity
              key={f}
              style={styles.activeChip}
              onPress={() => removeFilter(f)}
              activeOpacity={0.8}>
              <ThemedText style={styles.activeChipText}>{f}</ThemedText>
              <Ionicons name="close" size={12} color="#fff" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setActiveFilters(new Set())} style={styles.clearAllChip}>
            <ThemedText style={styles.clearAllText}>Clear all</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Liked / Saved switcher ── */}
      <View style={styles.switcherRow}>
        <TouchableOpacity
          style={[styles.switcherBtn, section === 'liked' && styles.switcherBtnLiked]}
          onPress={() => setSection('liked')}
          activeOpacity={0.85}>
          <Ionicons name="heart" size={15} color={section === 'liked' ? '#fff' : '#999'} />
          <ThemedText style={[styles.switcherLabel, section === 'liked' && styles.switcherLabelActive]}>
            Liked
          </ThemedText>
          {likedIds.length > 0 && (
            <View style={[styles.badge, section === 'liked' ? styles.badgeActive : styles.badgeInactive]}>
              <ThemedText style={styles.badgeText}>{likedIds.length}</ThemedText>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switcherBtn, section === 'saved' && styles.switcherBtnSaved]}
          onPress={() => setSection('saved')}
          activeOpacity={0.85}>
          <Ionicons name="bookmark" size={15} color={section === 'saved' ? '#fff' : '#999'} />
          <ThemedText style={[styles.switcherLabel, section === 'saved' && styles.switcherLabelActive]}>
            Saved
          </ThemedText>
          {savedIds.length > 0 && (
            <View style={[styles.badge, section === 'saved' ? styles.badgeActive : styles.badgeInactive]}>
              <ThemedText style={styles.badgeText}>{savedIds.length}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {displayedRecipes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={section === 'liked' ? 'heart-outline' : 'bookmark-outline'}
            size={64}
            color="rgba(0,0,0,0.15)"
          />
          <ThemedText style={styles.emptyTitle}>
            {baseCount === 0
              ? section === 'liked' ? 'No liked recipes yet' : 'No saved recipes yet'
              : 'No results match your filters'}
          </ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            {baseCount === 0
              ? section === 'liked'
                ? 'Tap the heart on any recipe card to like it.'
                : 'Tap the bookmark icon on a recipe to save it here.'
              : 'Try adjusting your search or filters.'}
          </ThemedText>
          {hasFiltersOrSearch && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => { setActiveFilters(new Set()); setSearchQuery(''); }}>
              <ThemedText style={styles.clearFiltersBtnText}>Clear filters</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          <View style={styles.column}>
            {leftCol.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={r => router.push(`/recipe/${r.id}` as any)}
                onRemove={section === 'saved' ? handleRemoveSaved : handleRemoveLiked}
                removeIcon={section === 'saved' ? 'bookmark' : 'heart'}
              />
            ))}
          </View>
          <View style={styles.column}>
            {rightCol.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={r => router.push(`/recipe/${r.id}` as any)}
                onRemove={section === 'saved' ? handleRemoveSaved : handleRemoveLiked}
                removeIcon={section === 'saved' ? 'bookmark' : 'heart'}
              />
            ))}
          </View>
        </ScrollView>
      )}

      <FilterSheet
        visible={showFilterSheet}
        activeFilters={activeFilters}
        onApply={setActiveFilters}
        onClose={() => setShowFilterSheet(false)}
      />
    </View>
  );
}

const CARD_HEIGHT = 178;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },

  header: { paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#000', lineHeight: 36 },

  // Search + filter button row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#e8dcc8',
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: { flex: 1, fontSize: 15, color: '#222' },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterBtnActive: { backgroundColor: BROWN },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: ORANGE,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // Active filter chips
  activeFilterScroll: { flexGrow: 0, marginBottom: 8 },
  activeFilterRow: {
    paddingHorizontal: 16,
    gap: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BROWN,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeChipText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  clearAllChip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: BROWN,
  },
  clearAllText: { fontSize: 12, fontWeight: '600', color: BROWN },

  // Switcher
  switcherRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#e8dcc8',
    borderRadius: 30,
    padding: 4,
  },
  switcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 26,
    gap: 5,
  },
  switcherBtnLiked: { backgroundColor: ORANGE_ACCENT },
  switcherBtnSaved: { backgroundColor: ORANGE },
  switcherLabel: { fontSize: 15, fontWeight: '600', color: '#999' },
  switcherLabelActive: { color: '#fff' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeInactive: { backgroundColor: 'rgba(0,0,0,0.1)' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Grid
  grid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 24,
  },
  column: { flex: 1, gap: 10 },

  // Card
  card: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#e8dcc8',
    justifyContent: 'flex-end',
    padding: 10,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 20,
  },
  tag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: GREEN,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 11, color: '#000', fontWeight: '500' },
  removeBtn: {
    position: 'absolute',
    top: 9,
    right: 9,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 16,
    padding: 5,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#000', textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  clearFiltersBtn: {
    backgroundColor: ORANGE,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  clearFiltersBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ─── Filter Sheet styles ───────────────────────────────────────────────────────

const fs = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sheet: {
    backgroundColor: CREAM,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'center', marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  clearAll: { fontSize: 14, fontWeight: '600', color: BROWN },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#222' },
  sectionHint: { fontSize: 11, color: '#999', fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8dcc8',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: BROWN },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  applyBtn: {
    backgroundColor: ORANGE,
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  applyText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
