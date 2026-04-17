import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Cuisine } from '@/services/api';
import { quizStore } from '@/services/quiz-store';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const MUTED = '#ffb259';
const SANDY = '#efd3a9';

const CUISINES: { label: string; value: Cuisine }[] = [
  { label: 'Italian', value: 'italian' },
  { label: 'Chinese', value: 'chinese' },
  { label: 'Mexican', value: 'mexican' },
  { label: 'Indian', value: 'indian' },
  { label: 'Thai', value: 'thai' },
  { label: 'Greek', value: 'greek' },
  { label: 'French', value: 'french' },
  { label: 'Other:____', value: 'other' },
];

const MAX_CUISINES = 3;

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressBar}>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={[styles.pill, { backgroundColor: i < step ? ORANGE : SANDY }]} />
      ))}
    </View>
  );
}

export default function QuizCuisinesScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Cuisine[]>([]);
  const [otherText, setOtherText] = useState('');

  const toggle = (cuisine: Cuisine) => {
    setSelected(prev => {
      if (prev.includes(cuisine)) return prev.filter(c => c !== cuisine);
      if (prev.length >= MAX_CUISINES) {
        Alert.alert('Max 3', 'You can select up to 3 cuisine preferences.');
        return prev;
      }
      return [...prev, cuisine];
    });
  };

  const onNext = () => {
    quizStore.cuisines = selected;
    router.push('/quiz-conditions');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <ThemedText style={styles.backArrow}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Cultural Cuisines</ThemedText>
        </View>

        <ProgressBar step={3} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.question}>
            What cultural cuisines{'\n'}are you interested in?
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            You can always change these later
          </ThemedText>

          <View style={styles.grid}>
            {CUISINES.map(c => {
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
                      placeholder="Type cuisine..."
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
  backArrow: { fontSize: 28, color: ORANGE, fontWeight: '600',},
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
  tileLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#434343',
    textAlign: 'center',
  },
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