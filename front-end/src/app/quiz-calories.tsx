import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Image,
  PanResponder,
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
import { ActivityLevel } from '@/services/api';
import { quizStore } from '@/services/quiz-store';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const MUTED = '#ffb259';
const SANDY = '#efd3a9';

const CALORIE_MIN = 1200;
const CALORIE_MAX = 3000; // midpoint = 2100

const SEX_OPTIONS = ['Male', 'Female', 'Other'] as const;

const ACTIVITY_OPTIONS: { label: string; value: ActivityLevel }[] = [
  { label: 'Sedentary', value: 'sedentary' },
  { label: 'Light', value: 'lightly_active' },
  { label: 'Moderate', value: 'moderately_active' },
  { label: 'Active', value: 'very_active' },
  { label: 'Very High', value: 'extra_active' },
];

function calcTDEE(
  sex: string,
  age: number,
  weight: number,
  height: number,
  activity: ActivityLevel,
) {
  if (!age || !weight || !height) return null;
  const bmr =
    sex === 'female'
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };
  return Math.round(bmr * multipliers[activity]);
}

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressBar}>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={[styles.pill, { backgroundColor: i < step ? ORANGE : SANDY }]} />
      ))}
    </View>
  );
}

export default function QuizCaloriesScreen() {
  const router = useRouter();

  const [sexIdx, setSexIdx] = useState<number | null>(null);
  const [showSexOptions, setShowSexOptions] = useState(false);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderately_active');
  const [manualCalories, setManualCalories] = useState<number | null>(null);

  const sex = sexIdx !== null ? SEX_OPTIONS[sexIdx].toLowerCase() : 'male';
  const tdee = calcTDEE(sex, Number(age), Number(weight), Number(height), activity);
  const displayCalories = manualCalories ?? tdee ?? 2100;
  const calorieProgress = Math.max(0, Math.min(1, (displayCalories - CALORIE_MIN) / (CALORIE_MAX - CALORIE_MIN)));
  const activityIdx = ACTIVITY_OPTIONS.findIndex(o => o.value === activity);

  // Calorie slider drag handling
  const calorieSliderRef = useRef<View>(null);
  const sliderWidth = useRef(0);
  const sliderPageX = useRef(0);

  const caloriePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        calorieSliderRef.current?.measure((_x, _y, width, _height, pageX) => {
          sliderWidth.current = width;
          sliderPageX.current = pageX;
          const fraction = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - pageX) / width));
          setManualCalories(Math.round(CALORIE_MIN + fraction * (CALORIE_MAX - CALORIE_MIN)));
        });
      },
      onPanResponderMove: (evt) => {
        if (sliderWidth.current === 0) return;
        const fraction = Math.max(0, Math.min(1, (evt.nativeEvent.pageX - sliderPageX.current) / sliderWidth.current));
        setManualCalories(Math.round(CALORIE_MIN + fraction * (CALORIE_MAX - CALORIE_MIN)));
      },
    }),
  ).current;

  const onNext = () => {
    quizStore.sex = sex as 'male' | 'female' | 'other';
    quizStore.age = Number(age) || 0;
    quizStore.weight_kg = Number(weight) || 0;
    quizStore.height_cm = Number(height) || 0;
    quizStore.activity_level = activity;
    router.push('/quiz-cuisines');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <ThemedText style={styles.backArrow}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Daily Calorie Goal</ThemedText>
        </View>

        <ProgressBar step={2} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Sex */}
          <ThemedText style={styles.label}>Sex</ThemedText>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowSexOptions(v => !v)}
            activeOpacity={0.8}>
            <ThemedText style={[styles.dropdownText, sexIdx === null && styles.placeholder]}>
              {sexIdx !== null ? SEX_OPTIONS[sexIdx] : 'Placeholder'}
            </ThemedText>
            <ThemedText style={styles.chevron}>⌄</ThemedText>
          </TouchableOpacity>
          {showSexOptions && (
            <View style={styles.dropdownMenu}>
              {SEX_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.dropdownOption}
                  onPress={() => { setSexIdx(i); setShowSexOptions(false); }}>
                  <ThemedText style={styles.dropdownOptionText}>{opt}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Age */}
          <ThemedText style={styles.label}>Age</ThemedText>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            placeholder="Placeholder"
            placeholderTextColor={MUTED}
          />

          {/* Weight */}
          <ThemedText style={styles.label}>Weight</ThemedText>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="Placeholder"
            placeholderTextColor={MUTED}
          />

          {/* Height */}
          <ThemedText style={styles.label}>Height</ThemedText>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholder="Placeholder"
            placeholderTextColor={MUTED}
          />

          {/* Activity Level */}
          <ThemedText style={[styles.label, { marginTop: Spacing.two }]}>Activity Level</ThemedText>
          <View style={styles.sliderWrapper}>
            {/* Track behind dots */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <View style={styles.trackBackground} />
              <View
                style={[
                  styles.trackFilled,
                  { width: `${(activityIdx / (ACTIVITY_OPTIONS.length - 1)) * 100}%` },
                ]}
              />
            </View>
            {/* Dots */}
            <View style={styles.dotsRow}>
              {ACTIVITY_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setActivity(opt.value)}
                  hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}>
                  <View
                    style={[styles.dot, i <= activityIdx ? styles.dotFilled : styles.dotEmpty]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.activityLabels}>
            <ThemedText style={styles.activityLabelText}>Sedentary</ThemedText>
            <ThemedText style={styles.activityLabelText}>Moderate</ThemedText>
            <ThemedText style={styles.activityLabelText}>Very High</ThemedText>
          </View>

          {/* Calories (Recommended) */}
          <ThemedText style={[styles.label]}>
            Calories (Recommended)
          </ThemedText>
          <View
            ref={calorieSliderRef}
            style={styles.calorieSliderWrapper}
            onLayout={() => {
              calorieSliderRef.current?.measure((_x, _y, width, _height, pageX) => {
                sliderWidth.current = width;
                sliderPageX.current = pageX;
              });
            }}
            {...caloriePanResponder.panHandlers}
          >
            <View style={styles.calorieTrackBackground} />
            <View style={[styles.calorieTrackFilled, { width: `${calorieProgress * 100}%` }]} />
            <View style={[styles.calorieDot, { left: `${calorieProgress * 100}%` }]} />
          </View>
          <ThemedText style={styles.calorieValue}>{displayCalories}</ThemedText>
        </ScrollView>

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

const DOT_SIZE = 11;
const TRACK_HEIGHT = 6;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM, paddingTop: '15%' },
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
  content: { paddingHorizontal: Spacing.four, paddingBottom: 100 },
  label: { fontSize: 16, fontWeight: '700', color: ORANGE, marginBottom: Spacing.two },

  /* Sex dropdown */
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
  },
  dropdownText: { flex: 1, fontSize: 16, color: '#1e1e1e' },
  placeholder: { color: MUTED },
  chevron: { fontSize: 20, color: MUTED, lineHeight: 24 },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 10,
    marginTop: -Spacing.three,
    marginBottom: Spacing.four,
    overflow: 'hidden',
  },
  dropdownOption: { paddingVertical: 14, paddingHorizontal: Spacing.three },
  dropdownOptionText: { fontSize: 16, color: '#1e1e1e' },

  /* Text inputs */
  input: {
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    color: '#1e1e1e',
    backgroundColor: '#fff',
    marginBottom: Spacing.four,
  },

  /* Activity slider */
  sliderWrapper: {
    height: DOT_SIZE,
    justifyContent: 'center',
    marginBottom: Spacing.two,
    marginHorizontal: 2,
  },
  trackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -(TRACK_HEIGHT / 2),
    height: TRACK_HEIGHT,
    backgroundColor: SANDY,
    borderRadius: 100,
  },
  trackFilled: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -(TRACK_HEIGHT / 2),
    height: TRACK_HEIGHT,
    backgroundColor: ORANGE,
    borderRadius: 100,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  dotFilled: { backgroundColor: '#1e1e1e' },
  dotEmpty: { backgroundColor: SANDY },

  /* Activity labels */
  activityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  activityLabelText: { fontSize: 13, color: '#1e1e1e' },

  /* Calories */
  calorieLabel: { fontWeight: '400' },
  calorieSliderWrapper: {
    height: 40,
    justifyContent: 'center',
    marginBottom: Spacing.one,
    marginHorizontal: 2,
  },
  calorieTrackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -(TRACK_HEIGHT / 2),
    height: TRACK_HEIGHT,
    backgroundColor: SANDY,
    borderRadius: 100,
  },
  calorieTrackFilled: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -(TRACK_HEIGHT / 2),
    height: TRACK_HEIGHT,
    backgroundColor: ORANGE,
    borderRadius: 100,
  },
  calorieDot: {
    position: 'absolute',
    marginLeft: -8,
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1e1e1e',
  },
  calorieValue: {
    fontSize: 16,
    color: '#1e1e1e',
    textAlign: 'center',
    marginBottom: Spacing.four,
  },

  /* Footer / next button */
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
