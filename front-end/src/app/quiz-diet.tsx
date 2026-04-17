import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  //Alert, //NOTE THIS
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DietPreference, api } from '@/services/api';
import { buildProfileUpsertFromQuiz, quizStore } from '@/services/quiz-store';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const MUTED = '#ffb259';
const SANDY = '#efd3a9';

const DIETS: { label: string; value: DietPreference }[] = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Halal', value: 'halal' },
  { label: 'Kosher', value: 'kosher' },
  { label: 'Gluten Free', value: 'gluten_free' },
  { label: 'Lactose Intolerant', value: 'lactose_intolerant' },
  { label: 'Keto', value: 'keto' },
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

export default function QuizDietScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<DietPreference[]>([]);
  const [loading, setLoading] = useState(false);
  const [otherText, setOtherText] = useState('');

  const toggle = (diet: DietPreference) => {
    setSelected(prev =>
      prev.includes(diet) ? prev.filter(d => d !== diet) : [...prev, diet],
    );
  };

  const onFinish = async () => {
    quizStore.diet_preferences = selected;
    setLoading(true);
    try {
      await api.upsertProfile(buildProfileUpsertFromQuiz(selected, null));
    } catch (err: unknown) {
      // Profile save failed (e.g. backend not reachable) — log and continue
      console.warn('upsertProfile failed:', err);
    } finally {
      setLoading(false);
      router.replace('/profile');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <ThemedText style={styles.backArrow}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Diet Preferences</ThemedText>
        </View>

        <ProgressBar step={5} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.question}>What diet preferences{'\n'}do you have?</ThemedText>
          <ThemedText style={styles.subtitle}>You can always change these later</ThemedText>

          <View style={styles.grid}>
            {DIETS.map(d => {
              const isSelected = selected.includes(d.value);
              const isOther = d.value === 'other';

              return (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.tile, isSelected && styles.tileSelected]}
                  onPress={() => toggle(d.value)}
                  activeOpacity={isOther && isSelected ? 1 : 0.8}>
                  {isOther && isSelected ? (
                    <TextInput
                      style={styles.otherInput}
                      value={otherText}
                      onChangeText={setOtherText}
                      placeholder="Type preference..."
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      autoFocus
                      returnKeyType="done"
                    />
                  ) : (
                    <ThemedText style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                      {isOther && otherText ? `Other: ${otherText}` : d.label}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
            onPress={onFinish}
            activeOpacity={0.85}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
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
    nextBtnDisabled: { opacity: 0.6 },
});