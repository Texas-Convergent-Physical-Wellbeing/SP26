import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { hydrateQuizFromServer, quizStore } from '@/services/quiz-store';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const MUTED = '#ffb259';
const SANDY = '#efd3a9';

const GOALS = [
  'Lose Weight',
  'Build/Maintain Muscle',
  'Improve Overall Nutrition',
  'Manage a Health Condition',
] as const;

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressBar}>
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={i}
          style={[styles.progressPill, { backgroundColor: i < step ? ORANGE : SANDY }]}
        />
      ))}
    </View>
  );
}

export default function QuizGoalsScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await hydrateQuizFromServer();
      if (!alive) return;
      setSelected([...quizStore.goals]);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (goal: string) => {
    setSelected(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal],
    );
  };

  const onNext = () => {
    quizStore.goals = selected;
    router.push('/quiz-calories');
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <ThemedText style={styles.backArrow}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Health Goals</ThemedText>
        </View>

        <ProgressBar step={1} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.question}>What are you{'\n'}hoping to achieve?</ThemedText>
          <ThemedText style={styles.subtitle}>You can always change these later</ThemedText>

          <View style={styles.options}>
            {GOALS.map(goal => {
              const isSelected = selected.includes(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => toggle(goal)}
                  activeOpacity={0.8}>
                  <ThemedText style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {goal}
                  </ThemedText>
                  <View style={[styles.circle, isSelected && styles.circleSelected]}>
                    {isSelected && <ThemedText style={styles.check}>✓</ThemedText>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Next button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.85}>
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
  root: { flex: 1, backgroundColor: CREAM, paddingTop: '15%', },
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
  headerTitle: { fontSize: 21, fontWeight: '600', color: ORANGE, textAlign: 'center', marginBottom: 10, },
  progressBar: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
  },
  progressPill: { flex: 1, height: 11, borderRadius: 60 },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
  question: {
    fontSize: 30,
    fontWeight: '700',
    color: ORANGE,
    textAlign: 'center',
    marginTop: '15%',
    marginBottom: Spacing.two,
    lineHeight: 35,
  },
  subtitle: { fontSize: 15, color: MUTED, textAlign: 'center', marginBottom: Spacing.four,  },
  options: { gap: 25, marginTop: '10%'},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.25,
    borderColor: ORANGE,
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
  },
  optionSelected: { backgroundColor: '#fff' },
  optionLabel: { flex: 1, fontSize: 17, color: ORANGE },
  optionLabelSelected: { color: ORANGE },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: { backgroundColor: ORANGE, borderColor: ORANGE },
  check: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
