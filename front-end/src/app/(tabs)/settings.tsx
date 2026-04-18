import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <ThemedText style={styles.title}>Settings</ThemedText>
      </View>

      <View style={styles.body}>
        <ThemedText style={styles.comingSoon}>More settings coming soon.</ThemedText>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/' as any)}
          activeOpacity={0.85}>
          <ThemedText style={styles.backLabel}>Back to Home</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  comingSoon: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: Spacing.five,
  },
  backLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
