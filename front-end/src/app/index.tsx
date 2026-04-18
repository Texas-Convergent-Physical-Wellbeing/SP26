import type { Href } from 'expo-router';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { WELCOME_HREF } from '@/constants/navigation';
import { setAuthToken } from '@/services/api';
import { getPostAuthHref } from '@/services/post-auth-route';
import { isSupabaseConfigured, supabase } from '@/services/supabase';

type Dest = 'loading' | 'welcome' | Href;

export default function Index() {
  const [dest, setDest] = useState<Dest>('loading');

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setDest('welcome');
      return;
    }

    let cancelled = false;

    async function applySession(accessToken: string | undefined) {
      if (cancelled) return;
      if (!accessToken) {
        setAuthToken('');
        setDest('welcome');
        return;
      }
      const href = await getPostAuthHref(accessToken);
      if (!cancelled) setDest(href);
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      void applySession(data.session?.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        setAuthToken('');
        setDest('welcome');
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void applySession(session?.access_token);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (dest === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff4db' }}>
        <ActivityIndicator size="large" color="#e2652f" />
      </View>
    );
  }

  if (dest === 'welcome') {
    return <Redirect href={WELCOME_HREF} />;
  }

  return <Redirect href={dest} />;
}
