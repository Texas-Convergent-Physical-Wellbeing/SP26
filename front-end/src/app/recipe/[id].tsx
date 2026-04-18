import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { RECIPES } from '@/data/recipes';

const BOOKMARKS_KEY = 'bookmarked_recipes';

const CREAM = '#fff4db';
const ORANGE = '#ffb259';
const GREEN = '#c7e890';
const BROWN = '#7a4720';
const HERO_HEIGHT = 300;

// ─── Pie Chart ────────────────────────────────────────────────────────────────

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle - 90));
  const y1 = cy + r * Math.sin(toRad(startAngle - 90));
  const x2 = cx + r * Math.cos(toRad(endAngle - 90));
  const y2 = cy + r * Math.sin(toRad(endAngle - 90));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function MacroPieChart({
  carbs,
  fats,
  protein,
}: {
  carbs: number;
  fats: number;
  protein: number;
}) {
  const size = 130;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  const carbDeg = (carbs / 100) * 360;
  const fatDeg = (fats / 100) * 360;
  const protDeg = (protein / 100) * 360;

  const carbStart = 0;
  const fatStart = carbDeg;
  const protStart = carbDeg + fatDeg;

  return (
    <Svg width={size} height={size}>
      <Path d={describeArc(cx, cy, r, carbStart, carbStart + carbDeg)} fill="#ffb259" />
      <Path d={describeArc(cx, cy, r, fatStart, fatStart + fatDeg)} fill="#7a4720" />
      <Path d={describeArc(cx, cy, r, protStart, protStart + protDeg)} fill="#c7e890" />
      {/* inner hole for donut look */}
      <Circle cx={cx} cy={cy} r={r * 0.5} fill={CREAM} />
    </Svg>
  );
}

// ─── Calorie Donut ────────────────────────────────────────────────────────────

function CalorieDonut({ used, goal }: { used: number; goal: number }) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const remaining = Math.max(0, goal - used);
  const usedPct = Math.min(used / goal, 1);

  const circumference = 2 * Math.PI * r;
  const usedStroke = usedPct * circumference;
  const gapStroke = circumference - usedStroke;

  // start from top (-90 deg rotation applied via SVG transform)
  return (
    <Svg width={size} height={size}>
      {/* background track */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#e8dcc8"
        strokeWidth={18}
      />
      {/* used portion — offset by circumference/4 to start at 12 o'clock */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={ORANGE}
        strokeWidth={18}
        strokeDasharray={`${usedStroke} ${gapStroke}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={r - 10}
        fill={CREAM}
      />
    </Svg>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Tab = 'recipe' | 'facts';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookmarked, setBookmarked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('recipe');

  // Load saved bookmark state on mount
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setBookmarked(ids.includes(id ?? ''));
    })();
  }, [id]);

  const toggleBookmark = async () => {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = bookmarked
      ? ids.filter(x => x !== id)
      : [...ids, id ?? ''];
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    setBookmarked(!bookmarked);
  };

  const recipe = RECIPES.find(r => r.id === id);

  if (!recipe) {
    return (
      <View style={styles.notFound}>
        <ThemedText>Recipe not found.</ThemedText>
      </View>
    );
  }

  const CALORIE_GOAL = 2000;
  const remaining = CALORIE_GOAL - recipe.calories;

  // Bold segments in "Why This Works?" text
  const renderWhyText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <ThemedText style={styles.whyBody}>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <ThemedText key={i} style={[styles.whyBody, styles.whyBold]}>
              {part}
            </ThemedText>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          ),
        )}
      </ThemedText>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} bounces stickyHeaderIndices={[0]}>

        {/* ── Sticky Hero Block (index 0 → sticky) ── */}
        <View style={{ height: HERO_HEIGHT }}>
          <Image
            source={{ uri: recipe.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="disk"
          />

          {/* gradient overlay at top for legibility */}
          <View style={[styles.heroOverlay, { paddingTop: insets.top }]}>
            {/* Back + Bookmark row */}
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => router.back()}
                activeOpacity={0.8}>
                <Ionicons name="chevron-back" size={22} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.circleBtn, { backgroundColor: ORANGE }]}
                onPress={toggleBookmark}
                activeOpacity={0.8}>
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={bookmarked ? BROWN : '#333'}
                />
              </TouchableOpacity>
            </View>

            {/* Title at bottom of hero */}
            <View style={styles.heroTitleRow}>
              <ThemedText style={styles.heroTitle} numberOfLines={2}>
                {recipe.name}
              </ThemedText>
              {recipe.tag && (
                <View style={styles.heroTag}>
                  <ThemedText style={styles.heroTagText}>{recipe.tag}</ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Tab Switcher ── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'recipe' && styles.tabBtnActive]}
            onPress={() => setActiveTab('recipe')}
            activeOpacity={0.8}>
            <ThemedText style={[styles.tabLabel, activeTab === 'recipe' && styles.tabLabelActive]}>
              Recipe
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'facts' && styles.tabBtnActive]}
            onPress={() => setActiveTab('facts')}
            activeOpacity={0.8}>
            <ThemedText style={[styles.tabLabel, activeTab === 'facts' && styles.tabLabelActive]}>
              Facts
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* ── Recipe Tab ── */}
        {activeTab === 'recipe' && (
          <View style={styles.tabContent}>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Ionicons name="time-outline" size={16} color={BROWN} />
                <ThemedText style={styles.statLabel}>Prep</ThemedText>
                <ThemedText style={styles.statValue}>{recipe.prepTime}</ThemedText>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="flame-outline" size={16} color={BROWN} />
                <ThemedText style={styles.statLabel}>Cook</ThemedText>
                <ThemedText style={styles.statValue}>{recipe.cookTime}</ThemedText>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="people-outline" size={16} color={BROWN} />
                <ThemedText style={styles.statLabel}>Serves</ThemedText>
                <ThemedText style={styles.statValue}>{recipe.servings}</ThemedText>
              </View>
            </View>

            {/* Description */}
            <ThemedText style={styles.description}>{recipe.description}</ThemedText>

            {/* Ingredients */}
            <ThemedText style={styles.sectionHeader}>Ingredients</ThemedText>
            {recipe.ingredients.map((item, i) => (
              <View key={i} style={styles.ingredientRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
                <ThemedText style={styles.ingredientText}>{item}</ThemedText>
              </View>
            ))}

            {/* Steps */}
            <ThemedText style={[styles.sectionHeader, { marginTop: 20 }]}>Steps</ThemedText>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepCircle, { backgroundColor: i % 2 === 0 ? ORANGE : GREEN }]}>
                  <ThemedText style={styles.stepNumber}>{i + 1}</ThemedText>
                </View>
                <ThemedText style={styles.stepText}>{step}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* ── Facts Tab ── */}
        {activeTab === 'facts' && (
          <View style={styles.tabContent}>

            {/* Macronutrients */}
            <ThemedText style={styles.sectionHeader}>Macronutrients</ThemedText>
            <View style={styles.macroCard}>
              <MacroPieChart
                carbs={recipe.carbsPercent}
                fats={recipe.fatsPercent}
                protein={recipe.proteinPercent}
              />
              <View style={styles.macroLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
                  <ThemedText style={styles.legendLabel}>Carbs</ThemedText>
                  <ThemedText style={styles.legendPct}>{recipe.carbsPercent}%</ThemedText>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: BROWN }]} />
                  <ThemedText style={styles.legendLabel}>Fats</ThemedText>
                  <ThemedText style={styles.legendPct}>{recipe.fatsPercent}%</ThemedText>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
                  <ThemedText style={styles.legendLabel}>Protein</ThemedText>
                  <ThemedText style={styles.legendPct}>{recipe.proteinPercent}%</ThemedText>
                </View>
                <ThemedText style={styles.calorieSmall}>{recipe.calories} kcal / serving</ThemedText>
              </View>
            </View>

            {/* Health Condition Alignment */}
            <ThemedText style={[styles.sectionHeader, { marginTop: 20 }]}>
              Health Condition Alignment
            </ThemedText>
            <View style={styles.tagWrap}>
              {recipe.healthTags.map((tag, i) => (
                <View
                  key={i}
                  style={[
                    styles.healthTag,
                    { backgroundColor: tag.color === 'green' ? GREEN : ORANGE },
                  ]}>
                  <ThemedText style={styles.healthTagText}>{tag.label}</ThemedText>
                </View>
              ))}
            </View>

            {/* Calorie Budget */}
            <ThemedText style={[styles.sectionHeader, { marginTop: 20 }]}>
              Calorie Budget
            </ThemedText>
            <View style={styles.calorieCard}>
              <View style={styles.donutWrapper}>
                <CalorieDonut used={recipe.calories} goal={CALORIE_GOAL} />
                <View style={styles.donutCenter} pointerEvents="none">
                  <ThemedText style={styles.donutKcal}>{remaining.toLocaleString()}</ThemedText>
                  <ThemedText style={styles.donutSub}>kcal left</ThemedText>
                </View>
              </View>
              <View style={styles.calorieLegend}>
                <ThemedText style={styles.calorieGoalText}>Daily goal: {CALORIE_GOAL} kcal</ThemedText>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
                  <ThemedText style={styles.legendLabel}>Used</ThemedText>
                  <ThemedText style={styles.legendPct}>{recipe.calories} kcal</ThemedText>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#e8dcc8' }]} />
                  <ThemedText style={styles.legendLabel}>Remaining</ThemedText>
                  <ThemedText style={styles.legendPct}>{remaining} kcal</ThemedText>
                </View>
              </View>
            </View>

            {/* Why This Works? */}
            <ThemedText style={[styles.sectionHeader, { marginTop: 20 }]}>
              Why This Works?
            </ThemedText>
            <View style={styles.whyCard}>
              {renderWhyText(recipe.whyItWorks)}
            </View>
          </View>
        )}

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* ── Hero ── */
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

  /* ── Tabs ── */
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
  tabBtnActive: {
    backgroundColor: ORANGE,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  tabLabelActive: {
    color: '#fff',
  },

  /* ── Shared Content ── */
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  /* Stats row */
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
  statLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: BROWN,
  },

  /* Description */
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#444',
    marginBottom: 20,
  },

  /* Section headers */
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },

  /* Ingredients */
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

  /* Steps */
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
  stepNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
  stepText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    flex: 1,
  },

  /* ── Facts Tab ── */

  /* Macro card */
  macroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  macroLegend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 13,
    color: '#555',
    flex: 1,
  },
  legendPct: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  calorieSmall: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },

  /* Health tags */
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthTag: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  healthTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },

  /* Calorie budget card */
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  donutWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutKcal: {
    fontSize: 18,
    fontWeight: '800',
    color: BROWN,
  },
  donutSub: {
    fontSize: 11,
    color: '#888',
  },
  calorieLegend: {
    flex: 1,
    gap: 8,
  },
  calorieGoalText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },

  /* Why This Works card */
  whyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  whyBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  whyBold: {
    fontWeight: '700',
    color: BROWN,
  },
});
