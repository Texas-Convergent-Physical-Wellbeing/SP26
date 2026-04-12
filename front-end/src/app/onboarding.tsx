import { useRouter } from 'expo-router';
import { Dimensions, Image, ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ImageBackground source={ require('../../assets/images/onboarding_cover.png') } style={styles.hero}/>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../assets/images/onboarding_top.png')}
        style={styles.header}
        resizeMode="stretch"
      />

      <View style={styles.card}>
        <SafeAreaView edges={['bottom']} style={styles.cardInner}>
          <ThemedText style={styles.title}>Welcome!</ThemedText>
          <ThemedText style={styles.subtitle}>
            Help us make more personalized recommendations by taking a short quiz!
          </ThemedText>

          <TouchableOpacity style={styles.button} onPress={() => router.push('/quiz-goals')} activeOpacity={0.85}>
            <ThemedText style={styles.buttonText}>Get Started</ThemedText>
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
const CARD_HEIGHT = SCREEN_HEIGHT * 0.4;

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
    justifyContent: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
    paddingTop: '40%',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: BRAND_BROWN,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    color: BRAND_BROWN,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 10,
  },
  button: {
    backgroundColor: BRAND_ORANGE,
    borderRadius: 100,
    paddingVertical: Spacing.three,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND_WHITE,
  },
});
