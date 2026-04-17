import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ONBOARDING_HREF } from '@/constants/navigation';
import { setAuthToken } from '@/services/api';
import { getPostAuthHref } from '@/services/post-auth-route';
import { supabase, isSupabaseConfigured } from '@/services/supabase';

const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const MUTED = '#ffb259';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [loading, setLoading] = useState(false);

  const trimmedEmail = email.trim();

  const onSubmit = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Configuration',
        'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to front-end/.env.',
      );
      return;
    }
    if (!trimmedEmail || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signIn') {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          Alert.alert('Sign in failed', error.message);
          return;
        }
        const token = signInData.session?.access_token;
        if (token) {
          const href = await getPostAuthHref(token);
          router.replace(href);
        }
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }
      if (data.session?.access_token) {
        setAuthToken(data.session.access_token);
        router.replace(ONBOARDING_HREF);
        return;
      }
      Alert.alert(
        'Confirm your email',
        'We sent you a confirmation link. After you confirm, sign in here.',
      );
    } finally {
      setLoading(false);
    }
  };

  const onAnonymous = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Configuration',
        'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to front-end/.env.',
      );
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        Alert.alert('Could not continue as guest', error.message);
        return;
      }
      const token = data.session?.access_token;
      if (token) {
        const href = await getPostAuthHref(token);
        router.replace(href);
      }
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Island sits in the upper center; centered wide titles still draw under it unless
  // we add enough top offset (insets.top alone is not always enough in Expo Go).
  const topPad =
    Math.max(insets.top, Platform.OS === 'ios' ? 52 : 28) + (Platform.OS === 'ios' ? 28 : 12);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scroll, { paddingTop: topPad }]}
            showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.title} accessibilityRole="header">
              NuTradish
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {mode === 'signIn' ? 'Sign in with your email' : 'Create your account'}
            </ThemedText>

            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={MUTED}
              editable={!loading}
            />

            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={MUTED}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryBtnText}>
                  {mode === 'signIn' ? 'Sign in' : 'Create account'}
                </ThemedText>
              )}
            </TouchableOpacity>

            <Pressable
              style={styles.switchMode}
              onPress={() => setMode(m => (m === 'signIn' ? 'signUp' : 'signIn'))}
              disabled={loading}>
              <ThemedText style={styles.switchModeText}>
                {mode === 'signIn' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </ThemedText>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <ThemedText style={styles.dividerLabel}>or</ThemedText>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onAnonymous}
              disabled={loading}
              activeOpacity={0.85}>
              <ThemedText style={styles.secondaryBtnText}>Continue without an account</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  safe: { flex: 1, marginTop: 25, },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: ORANGE,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  subtitle: {
    fontSize: 17,
    color: '#601d00',
    textAlign: 'center',
    marginBottom: Spacing.five,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: ORANGE,
    marginBottom: Spacing.two,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    color: '#1e1e1e',
    marginBottom: Spacing.four,
  },
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  switchMode: { marginTop: Spacing.four, alignSelf: 'center', padding: Spacing.two },
  switchModeText: { color: ORANGE, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.five,
    gap: Spacing.three,
  },
  divider: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
  dividerLabel: { fontSize: 14, color: '#888' },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { color: ORANGE, fontSize: 16, fontWeight: '700', },
});
