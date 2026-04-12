import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { UserProfileResponse, api } from '@/services/api';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const SANDY = '#efd3a9';

const CUISINE_LABELS: Record<string, string> = {
  south_asian: 'South Asian',
  west_african: 'West African',
  east_asian: 'East Asian',
  latin_american: 'Latin American',
  middle_eastern: 'Middle Eastern',
  mediterranean: 'Mediterranean',
  southeast_asian: 'Southeast Asian',
  caribbean: 'Caribbean',
};

const CONDITION_LABELS: Record<string, string> = {
  type2_diabetes: 'Type 2 Diabetes',
  hypertension: 'Hypertension',
  pcos: 'PCOS',
  high_cholesterol: 'High Cholesterol',
  celiac: 'Celiac Disease',
  kidney_disease: 'Kidney Disease',
  none: 'None',
};

const DIET_LABELS: Record<string, string> = {
  halal: 'Halal',
  kosher: 'Kosher',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  none: 'None',
};

type Tab = 'cuisines' | 'conditions' | 'allergens';

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <ThemedText style={styles.chipLabel}>{label}</ThemedText>
    </View>
  );
}

function EmptyChips() {
  return <ThemedText style={styles.emptyText}>None selected</ThemedText>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('cuisines');

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const [profileData, macroData] = await Promise.all([
        api.getProfile(),
        api.getMacros().catch(() => null),
      ]);
      setProfile(profileData);
      setTdee(macroData?.tdee ?? profileData.tdee ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
  }, []);

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ThemedText style={styles.errorText}>{error ?? 'No profile found.'}</ThemedText>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchProfile().finally(() => setLoading(false)); }}>
          <ThemedText style={styles.retryLabel}>Retry</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/onboarding')} style={{ marginTop: Spacing.three }}>
          <ThemedText style={{ color: ORANGE, textDecorationLine: 'underline' }}>
            Complete onboarding
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  // Tab content
  let tabItems: string[] = [];
  let labelMap: Record<string, string> = {};
  if (activeTab === 'cuisines') {
    tabItems = profile.cuisines;
    labelMap = CUISINE_LABELS;
  } else if (activeTab === 'conditions') {
    tabItems = profile.health_conditions;
    labelMap = CONDITION_LABELS;
  } else {
    tabItems = profile.diet_preferences;
    labelMap = DIET_LABELS;
  }

  return (
    <View style={styles.root}>
      {/* Orange header arc */}
      <View style={styles.headerArc} />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
          showsVerticalScrollIndicator={false}>

          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarIcon}>👤</ThemedText>
            </View>
          </View>

          {/* Name placeholder */}
          <ThemedText style={styles.name}>Your Profile</ThemedText>

          {/* Goals row */}
          <View style={styles.card}>
            <ThemedText style={styles.cardLabel}>My Goals</ThemedText>
            <View style={styles.editIcon}>
              <ThemedText style={styles.editSymbol}>✏️</ThemedText>
            </View>
          </View>

          {/* Daily Calories */}
          <View style={styles.calorieCard}>
            <View style={styles.calorieLeft}>
              <ThemedText style={styles.calorieTitle}>Daily{'\n'}Calories</ThemedText>
            </View>
            <View style={styles.calorieRight}>
              <ThemedText style={styles.calorieValue}>
                {tdee ? Math.round(tdee) : '—'}
              </ThemedText>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {(['cuisines', 'conditions', 'allergens'] as Tab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}>
                <ThemedText style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          <View style={styles.chipList}>
            {tabItems.length > 0 ? (
              <View style={styles.chipRow}>
                {tabItems.map(item => (
                  <Chip key={item} label={labelMap[item] ?? item} />
                ))}
              </View>
            ) : (
              <EmptyChips />
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Sex</ThemedText>
              <ThemedText style={styles.statValue}>{profile.sex}</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Age</ThemedText>
              <ThemedText style={styles.statValue}>{profile.age}</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Weight</ThemedText>
              <ThemedText style={styles.statValue}>{profile.weight_kg} kg</ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Height</ThemedText>
              <ThemedText style={styles.statValue}>{profile.height_cm} cm</ThemedText>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1 },
  headerArc: {
    position: 'absolute',
    top: -80,
    left: -20,
    right: -20,
    height: 260,
    backgroundColor: ORANGE,
    borderRadius: 9999,
  },
  content: { paddingHorizontal: Spacing.four, paddingBottom: 100, alignItems: 'center' },
  avatarWrapper: { marginTop: 60, marginBottom: Spacing.two },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarIcon: { fontSize: 48 },
  name: { fontSize: 24, fontWeight: '600', color: ORANGE, marginBottom: Spacing.four },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    width: '100%',
    marginBottom: Spacing.three,
  },
  cardLabel: { flex: 1, fontSize: 17, color: ORANGE, textAlign: 'center' },
  editIcon: { position: 'absolute', right: Spacing.three },
  editSymbol: { fontSize: 16 },
  calorieCard: {
    flexDirection: 'row',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    overflow: 'hidden',
    width: '100%',
    height: 107,
    marginBottom: Spacing.four,
  },
  calorieLeft: {
    flex: 1,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  calorieTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  calorieRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  calorieValue: { fontSize: 28, fontWeight: '700', color: ORANGE },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    overflow: 'hidden',
    width: '100%',
    marginBottom: Spacing.three,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  tabActive: { backgroundColor: ORANGE },
  tabLabel: { fontSize: 15, color: '#393939', fontWeight: '500' },
  tabLabelActive: { color: '#fff' },
  chipList: { width: '100%', minHeight: 80, marginBottom: Spacing.four },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
  },
  chipLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: Spacing.three },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: Spacing.three,
    width: '100%',
    gap: Spacing.two,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontSize: 15, color: '#777' },
  statValue: { fontSize: 15, fontWeight: '600', color: '#1e1e1e' },
  errorText: { fontSize: 16, color: '#e2652f', marginBottom: Spacing.three, textAlign: 'center' },
  retryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: Spacing.five,
  },
  retryLabel: { color: '#fff', fontWeight: '700' },
});
