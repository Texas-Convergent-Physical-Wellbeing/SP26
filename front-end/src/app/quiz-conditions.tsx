import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { HealthCondition, api } from '@/services/api';
import { buildProfileUpsertFromQuiz, hydrateQuizFromServer, quizStore } from '@/services/quiz-store';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const MUTED = '#ffb259';
const SANDY = '#efd3a9';

const CONDITIONS: { label: string; value: HealthCondition }[] = [
  { label: 'Diabetes I', value: 'diabetesI' },
  { label: 'Heart Disease', value: 'heart_disease' },
  { label: 'Diabetes II', value: 'diabetesII' },
  { label: 'Celiac Disease', value: 'celiac_disease' },
  { label: 'Hypertension', value: 'hypertension' },
  { label: 'Obesity', value: 'obesity' },
  { label: 'Osteoporosis', value: 'osteoporosis'},
  { label: 'Other:____', value: 'other' },
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

export default function QuizConditionsScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditMode = edit === '1';
  const [selected, setSelected] = useState<HealthCondition[]>([]);
  const [otherText, setOtherText] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await hydrateQuizFromServer();
      if (!alive) return;
      const knownValues = CONDITIONS.map(c => c.value as string);
      const normalized: HealthCondition[] = [];
      for (const v of quizStore.health_conditions) {
        if (knownValues.includes(v as string)) {
          normalized.push(v as HealthCondition);
        } else {
          normalized.push('other');
          setOtherText(v as string);
        }
      }
      setSelected(normalized);
      setHydrated(true);
    })();
    return () => { alive = false; };
  }, []);

  const toggle = (cond: HealthCondition) => {
    setSelected(prev =>
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond],
    );
  };

  const onNext = async () => {
    const effectiveSelected = selected.map(v =>
      v === 'other' && otherText.trim() ? (otherText.trim() as HealthCondition) : v,
    );
    quizStore.health_conditions = effectiveSelected;
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
    router.push('/quiz-diet');
  };

  if (!hydrated) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
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
          <ThemedText style={styles.headerTitle}>Health Conditions</ThemedText>
        </View>

        <ProgressBar step={5} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.question}>
            What health conditions are you looking to manage?
          </ThemedText>
          <ThemedText style={styles.subtitle}>You can always change these later</ThemedText>

          <View style={styles.grid}>
            {CONDITIONS.map(c => {
              const isSelected = selected.includes(c.value);
              const isOther = c.value === 'other';

              return (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.tile, isSelected && styles.tileSelected]}
                  onPress={() => toggle(c.value)}
                  activeOpacity={isOther && isSelected ? 1 : 0.8}>
                  {isOther && isSelected ? (
                    <TextInput
                      style={styles.otherInput}
                      value={otherText}
                      onChangeText={setOtherText}
                      placeholder="Type condition..."
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      autoFocus
                      returnKeyType="done"
                    />
                  ) : (
                    <ThemedText style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                      {isOther && otherText ? `Other: ${otherText}` : c.label}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={() => void onNext()} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require('../../assets/images/right-arrow-circle.png')}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM, paddingTop: '15%', },
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
  headerTitle: { fontSize: 21, fontWeight: '600', color: ORANGE, textAlign: 'center', marginBottom: 10, },
  progressBar: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
  },
  pill: { flex: 1, height: 11, borderRadius: 60 },
  content: { paddingHorizontal: Spacing.three, paddingBottom: 100 },
  question: {
    fontSize: 28,
    fontWeight: '700',
    color: ORANGE,
    textAlign: 'center',
    marginBottom: Spacing.two,
    marginTop: '13%',
    lineHeight: 35,
  },
  subtitle: { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: Spacing.four },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, rowGap: 20, marginTop: 10, },
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
  otherInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: Spacing.two,
  },
  footer: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, marginBottom: '13%', },
    nextBtn: {
      backgroundColor: ORANGE,
      borderRadius: 100,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextArrow: { color: '#fff', fontSize: 22, fontWeight: '700' },
});