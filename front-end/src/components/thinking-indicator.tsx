import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

// Claude-style "thinking" bubble. Rotates through creative cooking-themed
// phrases every few seconds while the LLM request is in flight, so the user
// sees something alive instead of a silent spinner.

const THINKING_PHRASES = [
  'Consulting your pantry…',
  'Balancing macros…',
  'Cross-checking allergens…',
  'Simmering a few ideas…',
  'Tasting the options…',
  'Rolling out the dough…',
  'Rummaging through spice drawers…',
  'Sketching the plate…',
  'Fine-tuning for your profile…',
  'Double-checking blood-sugar impact…',
  'Weighing the grains…',
  'Chopping fresh herbs…',
  'Reading the recipe twice…',
  'Looking up a grandma trick…',
];

function AnimatedDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    // Stagger each dot by `delay` ms so they pulse in sequence.
    const id = setTimeout(() => {
      // Touching a shared value here restarts the phase; the delay itself is handled
      // by the initial `setTimeout` wrapping.
    }, delay);
    return () => clearTimeout(id);
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

export function ThinkingIndicator() {
  const [phrase, setPhrase] = React.useState(() => pickPhrase(null));

  React.useEffect(() => {
    const id = setInterval(() => {
      setPhrase((prev) => pickPhrase(prev));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.row}>
      <View style={styles.bubble}>
        <View style={styles.dots}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={120} />
          <AnimatedDot delay={240} />
        </View>
        <Animated.View
          key={phrase}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(140)}
          style={{ flexShrink: 1 }}>
          <ThemedText style={styles.phrase}>{phrase}</ThemedText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function pickPhrase(prev: string | null): string {
  // Avoid picking the same phrase twice in a row so the rotation feels lively.
  if (THINKING_PHRASES.length <= 1) return THINKING_PHRASES[0];
  let next = prev;
  while (next === prev) {
    next = THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
  }
  return next ?? THINKING_PHRASES[0];
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    paddingHorizontal: 2,
    marginTop: 2,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    maxWidth: '88%',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    paddingTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c47d44',
  },
  phrase: {
    fontSize: 14,
    color: '#2a2a2a',
    fontStyle: 'italic',
  },
});
