import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { WELCOME_HREF } from '@/constants/navigation';
import { Spacing } from '@/constants/theme';
import { UserProfileResponse, api, getAuthToken, setAuthToken } from '@/services/api';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { avatarUriFromUser, displayNameFromUser } from '@/utils/display-name';
import { resetQuizStore } from '@/services/quiz-store';

const DEFAULT_AVATAR = require('../../assets/images/profile-default.png');
const PENCIL_ICON = require('../../assets/images/icon-edit-pencil.png');

/** Figma wireframe (node 46:464) — Low-Fi Physical Health */
const CREAM = '#fff4db';
const ORANGE = '#e2652f';
const BLACK = '#000000';
const TAB_MUTED = '#393939';
const TAB_MUTED_ALT = '#383838';
const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 4,
};
const SHADOW_STRONG = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 5,
};

const CUISINE_LABELS: Record<string, string> = {
  south_asian: 'South Asian',
  west_african: 'West African',
  east_asian: 'East Asian',
  latin_american: 'Latin American',
  middle_eastern: 'Middle Eastern',
  mediterranean: 'Mediterranean',
  southeast_asian: 'Southeast Asian',
  caribbean: 'Caribbean',
};

const CONDITION_LABELS: Record<string, string> = {
  type2_diabetes: 'Type 2 Diabetes',
  hypertension: 'Hypertension',
  pcos: 'PCOS',
  high_cholesterol: 'High Cholesterol',
  celiac: 'Celiac',
  kidney_disease: 'Kidney Disease',
  none: 'None',
};

const DIET_LABELS: Record<string, string> = {
  halal: 'Halal',
  kosher: 'Kosher',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  none: 'No restrictions',
};

const ALLERGEN_LABELS: Record<string, string> = {
  celery: 'Celery',
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soybeans: 'Soybeans',
  sulphur_dioxide: 'Sulphur Dioxide',
  tree_nuts: 'Tree Nuts',
};

type Tab = 'cuisines' | 'restrictions' | 'conditions' | 'allergens';

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <ThemedText style={styles.chipLabel}>{label}</ThemedText>
    </View>
  );
}

function PencilIcon() {
  return (
    <Image
      source={PENCIL_ICON}
      style={styles.pencilImage}
      accessibilityLabel="Edit"
      contentFit="contain"
    />
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('cuisines');
  const [displayName, setDisplayName] = useState('Your name');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const applyUserToIdentity = useCallback((user: User | null) => {
    setDisplayName(displayNameFromUser(user));
    setAvatarUri(avatarUriFromUser(user));
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      applyUserToIdentity(user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUserToIdentity(session?.user ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [applyUserToIdentity]);

  const openNameModal = useCallback(() => {
    setNameDraft(displayName === 'Your name' ? '' : displayName);
    setNameModalOpen(true);
  }, [displayName]);

  const saveDisplayName = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setNameSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
      if (error) throw error;
      setDisplayName(trimmed);
      setNameModalOpen(false);
    } catch {
      // keep modal open; optional: toast
    } finally {
      setNameSaving(false);
    }
  }, [nameDraft]);

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      if (!getAuthToken()) {
        setProfile(null);
        setError(
          isSupabaseConfigured()
            ? 'No active session. Sign in with email or use “Continue without an account” on the login screen.'
            : 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in front-end/.env.',
        );
        return;
      }
      const [profileData, macroData] = await Promise.all([
        api.getProfile(),
        api.getMacros().catch(() => null),
      ]);
      setProfile(profileData);
      setTdee(macroData?.tdee ?? profileData.tdee ?? null);
    } catch (err: unknown) {
      setProfile(null);
      const msg = err instanceof Error ? err.message : 'Failed to load profile';
      if (/not found|404|PROFILE_NOT_FOUND|No profile exists/i.test(msg)) {
        setError('No saved profile yet. Complete the onboarding quiz first.');
      } else {
        setError(msg);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchProfile().finally(() => setLoading(false));
    }, [fetchProfile]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  const onSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // ignore
    }
    setAuthToken('');
    router.replace(WELCOME_HREF);
  }, [router]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ThemedText style={styles.errorText}>{error ?? 'No profile found.'}</ThemedText>
        <TouchableOpacity style={[styles.retryBtn, { marginTop: Spacing.two }]} onPress={onSignOut} activeOpacity={0.85}>
          <ThemedText style={styles.retryLabel}>Sign out</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchProfile().finally(() => setLoading(false)); }}>
          <ThemedText style={styles.retryLabel}>Retry</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { resetQuizStore(); router.replace('/quiz-goals'); }} style={{ marginTop: Spacing.three }}>
          <ThemedText style={styles.linkMuted}>Complete onboarding quiz</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  let tabItems: string[] = [];
  let labelMap: Record<string, string> = {};
  if (activeTab === 'cuisines') {
    tabItems = profile.cuisines;
    labelMap = CUISINE_LABELS;
  } else if (activeTab === 'conditions') {
    tabItems = profile.health_conditions;
    labelMap = CONDITION_LABELS;
  } else if (activeTab === 'allergens') {
    tabItems = profile.allergens;
    labelMap = ALLERGEN_LABELS;
  } else {
    // 'restrictions' — diet preferences
    tabItems = profile.diet_preferences.filter(d => d !== 'none');
    labelMap = DIET_LABELS;
  }

  const tabDefs: { key: Tab; label: string }[] = [
    { key: 'cuisines', label: 'Cuisines' },
    { key: 'restrictions', label: 'Restrictions' },
    { key: 'allergens', label: 'Allergens' },
    { key: 'conditions', label: 'Conditions' },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.headerArc} />

      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 8) + 48, paddingBottom: insets.bottom + Spacing.six },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
          showsVerticalScrollIndicator={false}>

          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <Image
                source={avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR}
                style={styles.avatarImage}
                contentFit="cover"
                transition={120}
              />
            </View>
          </View>

          <TouchableOpacity onPress={openNameModal} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Edit display name">
            <ThemedText style={styles.nameTitle}>{displayName}</ThemedText>
            <ThemedText style={styles.nameHint}>Tap to edit</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.goalsPill, SHADOW_STRONG]}
            onPress={() => { resetQuizStore(); router.push('/quiz-goals'); }}
            activeOpacity={0.85}>
            <ThemedText style={styles.goalsPillLabel}>My Goals</ThemedText>
            <View style={styles.goalsPencil}>
              <PencilIcon />
            </View>
            {(profile.health_goals ?? []).length > 0 ? (
              <View style={styles.goalsChipRow}>
                {(profile.health_goals ?? []).map(g => (
                  <Chip key={`goal-${g}`} label={g} />
                ))}
              </View>
            ) : (
              <ThemedText style={styles.goalsEmptyInner}>Tap to choose your goals</ThemedText>
            )}
          </TouchableOpacity>

          <View style={[styles.calorieCard, SHADOW]}>
            <View style={styles.calorieLeft}>
              <ThemedText style={styles.calorieLeftTitle}>{'Daily\nCalories'}</ThemedText>
            </View>
            <View style={styles.calorieDivider} />
            <View style={styles.calorieRight}>
              <ThemedText style={styles.calorieNumber}>{tdee ? Math.round(tdee) : '—'}</ThemedText>
              <TouchableOpacity style={styles.caloriePencil} hitSlop={12} onPress={() => { resetQuizStore(); router.push('/quiz-calories'); }}>
                <PencilIcon />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabShell, SHADOW]}
            contentContainerStyle={styles.tabShellContent}>
            {tabDefs.map(({ key, label }) => {
              const on = activeTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.tabCell, on && styles.tabCellActive]}
                  onPress={() => setActiveTab(key)}
                  activeOpacity={0.85}>
                  <ThemedText style={[styles.tabText, on && styles.tabTextActive]}>
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.chipPanel, SHADOW]}>
            <View style={styles.chipPanelInner}>
              {tabItems.length > 0 ? (
                <View style={styles.chipRow}>
                  {tabItems.map(item => (
                    <Chip key={`${activeTab}-${item}`} label={labelMap[item] ?? item} />
                  ))}
                </View>
              ) : (
                <ThemedText style={styles.emptyText}>None selected</ThemedText>
              )}
            </View>
            <TouchableOpacity style={styles.chipPanelPencil} hitSlop={10} onPress={() => { resetQuizStore(); router.push('/quiz-cuisines'); }}>
              <PencilIcon />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onSignOut} style={styles.signOutWrap} hitSlop={12}>
            <ThemedText style={styles.signOutText}>Sign out</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={nameModalOpen} animationType="fade" transparent onRequestClose={() => setNameModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNameModalOpen(false)} accessibilityLabel="Dismiss" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <View style={styles.modalCard}>
              <ThemedText style={styles.modalTitle}>Your name</ThemedText>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="e.g. Vivaan Moharir"
                placeholderTextColor={`${TAB_MUTED}99`}
                style={styles.modalInput}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!nameSaving}
                onSubmitEditing={() => void saveDisplayName()}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setNameModalOpen(false)} disabled={nameSaving}>
                  <ThemedText style={styles.modalBtnGhostLabel}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnPrimary, (!nameDraft.trim() || nameSaving) && styles.modalBtnDisabled]}
                  onPress={() => void saveDisplayName()}
                  disabled={!nameDraft.trim() || nameSaving}>
                  <ThemedText style={styles.modalBtnPrimaryLabel}>{nameSaving ? 'Saving…' : 'Save'}</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  safe: { flex: 1 },
  headerArc: {
    position: 'absolute',
    top: -184,
    left: -41,
    right: -41,
    height: 328,
    backgroundColor: ORANGE,
    borderRadius: 9999,
  },
  content: {
    paddingHorizontal: 27,
    alignItems: 'center',
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  avatarWrap: {
    marginBottom: Spacing.two,
    alignItems: 'center',
  },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOW,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  nameTitle: {
    fontSize: 25,
    fontWeight: '400',
    color: ORANGE,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  nameHint: {
    fontSize: 13,
    color: TAB_MUTED,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.four,
  },
  goalsPill: {
    backgroundColor: '#fff',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: BLACK,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    paddingBottom: 18,
    width: '100%',
    marginBottom: Spacing.three,
    position: 'relative',
  },
  goalsPillLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: ORANGE,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  goalsPencil: {
    position: 'absolute',
    right: Spacing.three,
    top: 14,
  },
  goalsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    rowGap: 10,
  },
  goalsEmptyInner: {
    fontSize: 14,
    color: TAB_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  pencilImage: {
    width: 22,
    height: 22,
  },
  calorieCard: {
    flexDirection: 'row',
    width: '100%',
    height: 107,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: BLACK,
    overflow: 'hidden',
    marginBottom: Spacing.four,
    backgroundColor: '#fff',
  },
  calorieLeft: {
    flex: 1,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  calorieLeftTitle: {
    fontSize: 25,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
    lineHeight: 28,
    textAlign: 'center',
  },
  calorieDivider: {
    width: 1,
    backgroundColor: BLACK,
    opacity: 0.35,
  },
  calorieRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 6,
  },
  calorieNumber: {
    fontSize: 25,
    fontWeight: '400',
    color: ORANGE,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  caloriePencil: { padding: 4 },
  tabShell: {
    width: '100%',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: BLACK,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    backgroundColor: '#fff',
    flexGrow: 0,
  },
  tabShellContent: {
    flexDirection: 'row',
    minWidth: '100%',
  },
  tabCell: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  tabCellActive: {
    backgroundColor: ORANGE,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: TAB_MUTED,
    letterSpacing: -0.3,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabTextConditions: {
    color: TAB_MUTED_ALT,
  },
  chipPanel: {
    width: '100%',
    minHeight: 106,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: BLACK,
    backgroundColor: '#fff',
    marginBottom: Spacing.five,
    position: 'relative',
  },
  chipPanelInner: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    paddingBottom: 40,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 12,
  },
  chip: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: ORANGE,
    paddingVertical: 8,
    paddingHorizontal: 20,
    minHeight: 35,
    justifyContent: 'center',
  },
  chipLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  chipPanelPencil: {
    position: 'absolute',
    right: 14,
    bottom: 12,
  },
  emptyText: {
    color: TAB_MUTED,
    fontSize: 16,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  signOutWrap: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
  },
  signOutText: {
    fontSize: 15,
    color: TAB_MUTED,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: ORANGE,
    marginBottom: Spacing.three,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: Spacing.five,
  },
  retryLabel: { color: '#fff', fontWeight: '700' },
  linkMuted: { color: ORANGE, textDecorationLine: 'underline' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modalKeyboard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    zIndex: 1,
  },
  modalCard: {
    backgroundColor: CREAM,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BLACK,
    padding: Spacing.four,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ORANGE,
    marginBottom: Spacing.two,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: BLACK,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: BLACK,
    backgroundColor: '#fff',
    marginBottom: Spacing.three,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalBtnGhostLabel: {
    color: TAB_MUTED,
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  modalBtnDisabled: { opacity: 0.45 },
  modalBtnPrimaryLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
