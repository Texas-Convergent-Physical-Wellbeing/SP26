import { useRouter } from 'expo-router';
import { Dimensions, Image, ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

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
          <ThemedText style={styles.title}>NuTradish</ThemedText>
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
