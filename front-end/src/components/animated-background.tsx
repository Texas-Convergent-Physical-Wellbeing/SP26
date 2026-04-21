import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Soft drifting orbs behind the chat UI — low opacity so they feel like mood,
// never like a competing visual. Reanimated drives them on the UI thread so it
// never stutters during chat interactions.

interface OrbConfig {
  size: number;
  colors: [string, string];
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  delay: number;
  opacity: number;
}

function Orb({ config, width, height }: { config: OrbConfig; width: number; height: number }) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    t.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [config.delay, config.duration, t]);

  const animatedStyle = useAnimatedStyle(() => {
    const x = config.startX + (config.endX - config.startX) * t.value;
    const y = config.startY + (config.endY - config.startY) * t.value;
    const scale = 0.85 + 0.3 * t.value;
    return {
      transform: [
        { translateX: x * width - config.size / 2 },
        { translateY: y * height - config.size / 2 },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          opacity: config.opacity,
        },
        animatedStyle,
      ]}
      pointerEvents="none">
      <LinearGradient
        colors={config.colors}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export function AnimatedBackground({ variant = 'warm' }: { variant?: 'warm' | 'subtle' }) {
  const { width, height } = useWindowDimensions();

  // Base gradient: same warm palette already used on the chat screen, just tuned
  // for mood. `subtle` dials everything down for when content is on top.
  const baseColors =
    variant === 'warm'
      ? (['#fff1dc', '#fde1c8', '#f5e6b8', '#d7eab1'] as const)
      : (['#fff7e6', '#fef1de', '#f6ecd2', '#e3f0c8'] as const);

  const orbs: OrbConfig[] = [
    {
      size: Math.max(width, 380) * 0.75,
      colors: ['#f8b58a', '#f6d0cf'],
      startX: 0.1,
      startY: 0.12,
      endX: 0.35,
      endY: 0.25,
      duration: 14000,
      delay: 0,
      opacity: variant === 'warm' ? 0.55 : 0.35,
    },
    {
      size: Math.max(width, 380) * 0.65,
      colors: ['#c7e890', '#f5e6b8'],
      startX: 0.75,
      startY: 0.2,
      endX: 0.55,
      endY: 0.4,
      duration: 17000,
      delay: 1200,
      opacity: variant === 'warm' ? 0.5 : 0.3,
    },
    {
      size: Math.max(width, 380) * 0.9,
      colors: ['#ffe9c1', '#f8a06a'],
      startX: 0.2,
      startY: 0.75,
      endX: 0.45,
      endY: 0.6,
      duration: 21000,
      delay: 600,
      opacity: variant === 'warm' ? 0.45 : 0.28,
    },
    {
      size: Math.max(width, 380) * 0.55,
      colors: ['#b9e59a', '#fde1c8'],
      startX: 0.85,
      startY: 0.85,
      endX: 0.65,
      endY: 0.7,
      duration: 19000,
      delay: 2200,
      opacity: variant === 'warm' ? 0.45 : 0.3,
    },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[...baseColors]}
        locations={[0, 0.38, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {orbs.map((cfg, i) => (
        <Orb key={i} config={cfg} width={width} height={height} />
      ))}
      {/* Soft cream veil so content on top has enough contrast without washing the animation out */}
      <View style={styles.veil} />
    </View>
  );
}

const styles = StyleSheet.create({
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 244, 219, 0.28)',
  },
});
