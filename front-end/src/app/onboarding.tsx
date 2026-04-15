import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Image, ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const PHRASES = [
  'Welcome!',
  '歡迎光臨!',
  'स्वागत!',
  'Bienvenido!',
  '!أهلاً و سهلاً',
  'Bienvenue!',
  'স্বাগতম!',
  'Добро пожаловать!',
  '!خوش آمديد',
];

const PHRASE_HEIGHT = 50;
const FADE_DURATION = 500;
const HOLD_DURATION = 1400;
const CYCLE_MS = FADE_DURATION * 2 + HOLD_DURATION;

function PhraseItem({ phrase, isActive }: { phrase: string; isActive: boolean }) {
  const opacity = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    if (isActive) {
      opacity.value = withSequence(
        withTiming(1, { duration: FADE_DURATION }),
        withDelay(HOLD_DURATION, withTiming(0, { duration: FADE_DURATION }))
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[cyclerStyles.phraseWrapper, animatedStyle]}>
      <ThemedText style={cyclerStyles.phrase}>{phrase}</ThemedText>
    </Animated.View>
  );
}

function WelcomeCycler() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex(i => (i + 1) % PHRASES.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={cyclerStyles.window}>
      {PHRASES.map((phrase, i) => (
        <PhraseItem key={i} phrase={phrase} isActive={i === activeIndex} />
      ))}
    </View>
  );
}

const cyclerStyles = StyleSheet.create({
  window: {
    height: PHRASE_HEIGHT,
    width: '100%',
  },
  phraseWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PHRASE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phrase: {
    fontSize: 34,
    fontWeight: '800',
    color: '#E2652F',
    textAlign: 'center',
    lineHeight: PHRASE_HEIGHT,
  },
});

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ImageBackground
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../assets/images/onboarding_cover.png')}
        style={styles.hero}
      />
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../assets/images/onboarding_top.png')}
        style={styles.header}
        resizeMode="stretch"
      />

      <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
        <SafeAreaView edges={['bottom']} style={styles.cardInner}>
          <WelcomeCycler />
          <ThemedText style={styles.subtitle}>
            Personalized meal planning that respects your culture and health goals.
          </ThemedText>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/login')}
            activeOpacity={0.85}>
            <ThemedText style={styles.primaryButtonText}>Get Started</ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
}

const BRAND_BROWN = '#601d00';
const BRAND_WHITE = '#ffffff';
const BRAND_ORANGE = '#E2652F';
const CARD_BG = '#FFF4DB';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.45;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8ecd0',
  },
  hero: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 164,
    zIndex: 1,
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    zIndex: 2,
  },
  cardInner: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: BRAND_ORANGE,
    textAlign: 'center',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: BRAND_BROWN,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  primaryButton: {
    backgroundColor: BRAND_ORANGE,
    borderRadius: 100,
    paddingVertical: Spacing.three,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND_WHITE,
  },
});
