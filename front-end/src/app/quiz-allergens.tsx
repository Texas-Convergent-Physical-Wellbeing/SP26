import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Allergen, api } from '@/services/api';
import { buildProfileUpsertFromQuiz, hydrateQuizFromServer, quizStore } from '@/services/quiz-store';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const MUTED = '#ffb259';
const SANDY = '#efd3a9';

const ALLERGENS: { label: string; value: Allergen }[] = [
  { label: 'Gluten', value: 'gluten' },
  { label: 'Peanuts', value: 'peanuts' },
  { label: 'Tree Nuts', value: 'tree_nuts' },
  { label: 'Milk', value: 'milk' },
  { label: 'Eggs', value: 'eggs' },
  { label: 'Fish', value: 'fish' },
  { label: 'Crustaceans', value: 'crustaceans' },
  { label: 'Soybeans', value: 'soybeans' },
  { label: 'Sesame', value: 'sesame' },
  { label: 'Mustard', value: 'mustard' },
  { label: 'Celery', value: 'celery' },
  { label: 'Molluscs', value: 'molluscs' },
];

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressBar}>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={[styles.pill, { backgroundColor: i < step ? ORANGE : SANDY }]} />
      ))}
    </View>
  );
}

export default function QuizAllergensScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditMode = edit === '1';
  const [selected, setSelected] = useState<Allergen[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await hydrateQuizFromServer();
      if (!alive) return;
      setSelected([...quizStore.allergens]);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (allergen: Allergen) => {
    setSelected(prev =>
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen],
    );
  };

  const onNext = async () => {
    quizStore.allergens = selected;
    if (isEditMode) {
      setSaving(true);
      try {
        await api.upsertProfile(buildProfileUpsertFromQuiz(quizStore.diet_preferences, null));
        router.replace('/profile');
      } catch (err) {
        Alert.alert('Could not save', err instanceof Error ? err.message : 'Failed to save profile');
      } finally {
        setSaving(false);
      }
      return;
    }
    router.push('/quiz-conditions');
  };

  if (!hydrated) {
    return (
      <View style={[styles.root, styles.hydrateCenter]}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <ThemedText style={styles.backArrow}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Allergens</ThemedText>
        </View>

        <ProgressBar step={4} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.question}>
            Any food allergens{'\n'}to avoid?
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Select all that apply — skip if none
          </ThemedText>

          <View style={styles.grid}>
            {ALLERGENS.map(a => {
              const isSelected = selected.includes(a.value);
              return (
                <TouchableOpacity
                  key={a.value}
                  style={[styles.tile, isSelected && styles.tileSelected]}
                  onPress={() => toggle(a.value)}
                  activeOpacity={0.8}>
                  <ThemedText style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                    {a.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={() => void onNext()} activeOpacity={0.85} disabled={saving}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/images/right-arrow-circle.png')}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM, paddingTop: '15%' },
  hydrateCenter: { justifyContent: 'center', alignItems: 'center' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  back: { position: 'absolute', left: Spacing.three },
  backArrow: { fontSize: 28, color: ORANGE, fontWeight: '600' },
  headerTitle: { fontSize: 21, fontWeight: '600', color: ORANGE, textAlign: 'center', marginBottom: 10 },
  progressBar: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
  },
  pill: { flex: 1, height: 11, borderRadius: 60 },
  content: { paddingHorizontal: Spacing.three, paddingBottom: 100 },
  question: {
    fontSize: 30,
    fontWeight: '700',
    color: ORANGE,
    textAlign: 'center',
    marginBottom: Spacing.two,
    marginTop: '13%',
    lineHeight: 36,
  },
  subtitle: { fontSize: 15, color: MUTED, textAlign: 'center', marginBottom: Spacing.four },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    rowGap: 20,
    marginTop: 10,
  },
  tile: {
    width: '47.5%',
    height: 79,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.35)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  tileSelected: { backgroundColor: ORANGE, borderColor: 'rgba(161,160,160,0.35)' },
  tileLabel: { fontSize: 20, fontWeight: '600', color: '#434343', textAlign: 'center' },
  tileLabelSelected: { color: '#fff' },
  footer: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, marginBottom: '13%' },
  nextBtn: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
