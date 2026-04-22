import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { setAuthToken } from '@/services/api';
import { setCurrentUserId, setCurrentUserName } from '@/services/current-user-store';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { displayNameFromUser } from '@/utils/display-name';

// Old unscoped AsyncStorage keys that used to contain per-user data but
// lived in a shared global bucket. When a second account signed in on the
// same device, they inherited the first account's chats / recipes /
// bookmarks / likes. We now write to per-user buckets
// (`<base>:<userId>`) and nuke these legacy keys once so stale shared data
// doesn't leak into the new scoped system.
//
// Two keys are intentionally kept unscoped (and therefore NOT listed here):
//   - `nutriculture.userPosts.v1` — community posts must be visible across
//     every account on the device.
//   - `recipe_comments_*`         — comments on community posts are a public
//     conversation, so account B must see comments account A wrote on the
//     same post.
const LEGACY_UNSCOPED_KEYS = [
  'nutriculture.chat.sessions.v1',
  'nutriculture.chat.suggestedTitles.v1',
  'nutriculture.chatBookmarks.v1',
  'nutriculture.chatRecipes.v1',
  'liked_recipes',
  'bookmarked_recipes',
];
// v3: stop nuking comment keys (they're cross-account by design). The
// flag is bumped so devices that already ran v2 (and thus had their
// scoped likes/bookmarks already cleared) don't re-purge — only devices
// freshly upgraded from a pre-scoping build run this.
const LEGACY_PURGE_FLAG = 'nutriculture.scopeMigration.v3';

async function purgeLegacyUnscopedStorage(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(LEGACY_PURGE_FLAG);
    if (done === '1') return;
    await AsyncStorage.multiRemove(LEGACY_UNSCOPED_KEYS);
    await AsyncStorage.setItem(LEGACY_PURGE_FLAG, '1');
  } catch {
    // non-fatal — next boot will retry
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.warn(
        '[Nutradish] Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to front-end/.env so the API can authenticate.',
      );
      // Even in unconfigured / demo mode we still want to clear the
      // legacy shared storage so the first user of this build doesn't
      // inherit whatever was persisted previously.
      void purgeLegacyUnscopedStorage();
      setCurrentUserId(null);
      setCurrentUserName(null);
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      await purgeLegacyUnscopedStorage();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';
      const supabaseUser = sessionData.session?.user ?? null;
      const uid = supabaseUser?.id ?? null;
      const name = supabaseUser ? displayNameFromUser(supabaseUser) : null;

      if (!cancelled) {
        setAuthToken(token);
        // Setting the user id BEFORE marking auth ready guarantees every
        // downstream store.hydrate*() call reads from the correct bucket.
        // The display name follows immediately after so any UI that
        // attributes content (comments, post bylines) has a name to show.
        setCurrentUserId(uid);
        setCurrentUserName(name);
        setAuthReady(true);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? '');
      setCurrentUserId(session?.user?.id ?? null);
      setCurrentUserName(session?.user ? displayNameFromUser(session.user) : null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {!authReady ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
