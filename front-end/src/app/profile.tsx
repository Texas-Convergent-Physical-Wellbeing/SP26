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

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { DateRangeCalendar } from '@/components/date-range-calendar';
import { ThemedText } from '@/components/themed-text';
import { WELCOME_HREF } from '@/constants/navigation';
import { Spacing } from '@/constants/theme';
import { FestiveEvent, UserProfileResponse, api, getAuthToken, setAuthToken } from '@/services/api';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { avatarUriFromUser, displayNameFromUser } from '@/utils/display-name';
import { resetQuizStore } from '@/services/quiz-store';

const DEFAULT_AVATAR = require('../../assets/images/profile-default.png');
const PENCIL_ICON = require('../../assets/images/icon-edit-pencil.png');

// Design tokens harmonised with the rest of the app (recipe detail, community,
// chat). The profile screen previously used a much more saturated red-orange
// (#e2652f) and hard black 1px card borders which made it feel like a
// different app — we now use the same soft peach `#ffb259`, brown text, and
// hairline borders with a subtle shadow.
const CREAM = '#fff4db';
const ORANGE = '#ffb259';
const BROWN = '#7a4720';
const HAIRLINE = 'rgba(0,0,0,0.08)';
const TAB_MUTED = '#6b6b6b';
const TAB_MUTED_ALT = '#6b6b6b';
const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};
const SHADOW_STRONG = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 3,
};

const CUISINE_LABELS: Record<string, string> = {
  italian: 'Italian',
  chinese: 'Chinese',
  mexican: 'Mexican',
  indian: 'Indian',
  thai: 'Thai',
  greek: 'Greek',
  french: 'French',
  other: 'Other',
};

const CONDITION_LABELS: Record<string, string> = {
  diabetesI: 'Diabetes Type I',
  diabetesII: 'Diabetes Type II',
  heart_disease: 'Heart Disease',
  celiac_disease: 'Celiac Disease',
  hypertension: 'Hypertension',
  obesity: 'Obesity',
  osteoporosis: 'Osteoporosis',
  other: 'Other',
};

const DIET_LABELS: Record<string, string> = {
  halal: 'Halal',
  kosher: 'Kosher',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  gluten_free: 'Gluten Free',
  lactose_intolerant: 'Lactose Intolerant',
  keto: 'Keto',
  other: 'Other',
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

const FESTIVE_EVENT_OPTIONS: { value: FestiveEvent; label: string }[] = [
  { value: 'ramadan', label: 'Ramadan' },
  { value: 'eid', label: 'Eid' },
  { value: 'diwali', label: 'Diwali' },
  { value: 'navratri', label: 'Navratri' },
  { value: 'lunar_new_year', label: 'Lunar New Year' },
  { value: 'passover', label: 'Passover' },
  { value: 'christmas', label: 'Christmas' },
];

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

  const [festiveModalOpen, setFestiveModalOpen] = useState(false);
  const [festiveDraft, setFestiveDraft] = useState<FestiveEvent | null>(null);
  const [festiveStartDraft, setFestiveStartDraft] = useState('');
  const [festiveEndDraft, setFestiveEndDraft] = useState('');
  const [festiveSaving, setFestiveSaving] = useState(false);

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

  const openFestiveModal = useCallback(() => {
    setFestiveDraft((profile?.active_festive_event as FestiveEvent | null) ?? null);
    setFestiveStartDraft(profile?.festive_event_start ?? '');
    setFestiveEndDraft(profile?.festive_event_end ?? '');
    setFestiveModalOpen(true);
  }, [profile]);

  const saveFestiveEvent = useCallback(async () => {
    if (!festiveDraft) return;
    setFestiveSaving(true);
    try {
      const updated = await api.setFestiveEvent(festiveDraft, festiveStartDraft, festiveEndDraft);
      setProfile(updated);
      setFestiveModalOpen(false);
    } catch {
      // keep modal open
    } finally {
      setFestiveSaving(false);
    }
  }, [festiveDraft, festiveStartDraft, festiveEndDraft]);

  const clearFestiveEvent = useCallback(async () => {
    setFestiveSaving(true);
    try {
      const updated = await api.clearFestiveEvent();
      setProfile(updated);
      setFestiveModalOpen(false);
    } catch {
      // keep modal open
    } finally {
      setFestiveSaving(false);
    }
  }, []);

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
    { key: 'allergens', label: 'Allergens' },
    { key: 'conditions', label: 'Conditions' },
    { key: 'restrictions', label: 'Restrictions' },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.headerArc} />

      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 8) + 48, paddingBottom: Spacing.six },
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
            onPress={() => { router.push('/quiz-goals?edit=1'); }}
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
              <TouchableOpacity style={styles.caloriePencil} hitSlop={12} onPress={() => { router.push('/quiz-calories?edit=1'); }}>
                <PencilIcon />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.festiveCard, SHADOW]}
            onPress={openFestiveModal}
            activeOpacity={0.85}>
            <ThemedText style={styles.festiveCardTitle}>Festive Mode</ThemedText>
            <View style={styles.festiveCardPencil}>
              <PencilIcon />
            </View>
            {profile.active_festive_event ? (
              <View style={styles.chip}>
                <ThemedText style={styles.chipLabel}>
                  {FESTIVE_EVENT_OPTIONS.find(o => o.value === profile.active_festive_event)?.label ?? profile.active_festive_event}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.festiveNone}>None active — tap to set</ThemedText>
            )}
          </TouchableOpacity>

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
                  <ThemedText
                    style={[styles.tabText, on && styles.tabTextActive]}
                    numberOfLines={1}
                    allowFontScaling={false}>
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
            <TouchableOpacity style={styles.chipPanelPencil} hitSlop={10} onPress={() => {
              const tabRoutes: Record<Tab, string> = {
                cuisines: '/quiz-cuisines?edit=1',
                restrictions: '/quiz-diet?edit=1',
                allergens: '/quiz-allergens?edit=1',
                conditions: '/quiz-conditions?edit=1',
              };
              router.push(tabRoutes[activeTab] as Parameters<typeof router.push>[0]);
            }}>
              <PencilIcon />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onSignOut} style={styles.signOutWrap} hitSlop={12}>
            <ThemedText style={styles.signOutText}>Sign out</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <BottomTabBar
        activeTab="profile"
        onHomePress={() => router.replace('/(tabs)' as any)}
        onChatPress={() => router.replace('/(tabs)/chat' as any)}
        onBookmarksPress={() => router.replace('/(tabs)/bookmarks' as any)}
        onProfilePress={() => {}}
      />

      <Modal visible={festiveModalOpen} animationType="fade" transparent onRequestClose={() => setFestiveModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFestiveModalOpen(false)} accessibilityLabel="Dismiss" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <View style={styles.modalCard}>
              <ThemedText style={styles.modalTitle}>Festive Mode</ThemedText>

              <ScrollView style={styles.festiveOptionList} showsVerticalScrollIndicator={false}>
                {FESTIVE_EVENT_OPTIONS.map(opt => {
                  const selected = festiveDraft === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.festiveOptionRow, selected && styles.festiveOptionRowSelected]}
                      onPress={() => setFestiveDraft(opt.value)}
                      activeOpacity={0.75}>
                      <ThemedText style={[styles.festiveOptionLabel, selected && styles.festiveOptionLabelSelected]}>
                        {opt.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {festiveDraft && (
                <View style={styles.festiveDateGroup}>
                  <ThemedText style={styles.festiveDateLabel}>Pick start & end dates</ThemedText>
                  <DateRangeCalendar
                    startDate={festiveStartDraft}
                    endDate={festiveEndDraft}
                    onChange={(start, end) => {
                      setFestiveStartDraft(start);
                      setFestiveEndDraft(end);
                    }}
                    accentColor={ORANGE}
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                {profile?.active_festive_event && (
                  <TouchableOpacity
                    style={[styles.modalBtnGhost, festiveSaving && styles.modalBtnDisabled]}
                    onPress={() => void clearFestiveEvent()}
                    disabled={festiveSaving}>
                    <ThemedText style={styles.festiveClearLabel}>Turn Off</ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setFestiveModalOpen(false)} disabled={festiveSaving}>
                  <ThemedText style={styles.modalBtnGhostLabel}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnPrimary, (!festiveDraft || festiveSaving) && styles.modalBtnDisabled]}
                  onPress={() => void saveFestiveEvent()}
                  disabled={!festiveDraft || festiveSaving}>
                  <ThemedText style={styles.modalBtnPrimaryLabel}>{festiveSaving ? 'Saving…' : 'Save'}</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
    borderWidth: 3,
    borderColor: '#fff',
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
    fontSize: 24,
    fontWeight: '700',
    color: BROWN,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 16,
    paddingHorizontal: Spacing.four,
    paddingBottom: 18,
    width: '100%',
    marginBottom: Spacing.three,
    position: 'relative',
  },
  goalsPillLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: BROWN,
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 12,
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
    opacity: 0.55,
  },
  calorieCard: {
    flexDirection: 'row',
    width: '100%',
    height: 104,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    overflow: 'hidden',
    marginBottom: Spacing.three,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    lineHeight: 26,
    textAlign: 'center',
  },
  calorieDivider: {
    width: 1,
    backgroundColor: HAIRLINE,
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
    fontSize: 26,
    fontWeight: '700',
    color: BROWN,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  caloriePencil: { padding: 4 },
  tabShell: {
    width: '100%',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: HAIRLINE,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    backgroundColor: '#fff',
    flexGrow: 0,
  },
  tabShellContent: {
    flexDirection: 'row',
    // `flexGrow: 1` lets the 4 cells fill the pill on wide screens (so the
    // Cuisines / Allergens / Conditions / Restrictions tabs are spread
    // evenly) while each cell's natural min-width (below) prevents the
    // longest label from wrapping onto two lines on narrower devices.
    flexGrow: 1,
  },
  tabCell: {
    flexGrow: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  tabCellActive: {
    backgroundColor: ORANGE,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: TAB_MUTED,
    letterSpacing: -0.2,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabTextConditions: {
    color: TAB_MUTED_ALT,
  },
  chipPanel: {
    width: '100%',
    minHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
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
    gap: 10,
    rowGap: 10,
  },
  chip: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 18,
    minHeight: 32,
    justifyContent: 'center',
  },
  chipLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    borderColor: HAIRLINE,
    padding: Spacing.four,
    width: '100%',
    ...SHADOW_STRONG,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BROWN,
    marginBottom: Spacing.two,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
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
  festiveCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 16,
    paddingHorizontal: Spacing.four,
    paddingBottom: 18,
    width: '100%',
    marginBottom: Spacing.three,
    position: 'relative',
  },
  festiveCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BROWN,
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  festiveCardPencil: {
    position: 'absolute',
    right: Spacing.three,
    top: 14,
  },
  festiveNone: {
    fontSize: 14,
    color: TAB_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  festiveOptionList: {
    maxHeight: 220,
    marginBottom: Spacing.two,
  },
  festiveOptionRow: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#f5f5f5',
  },
  festiveOptionRowSelected: {
    backgroundColor: ORANGE,
  },
  festiveOptionLabel: {
    fontSize: 15,
    color: TAB_MUTED,
    fontWeight: '500',
  },
  festiveOptionLabelSelected: {
    color: '#fff',
  },
  festiveDateGroup: {
    marginBottom: Spacing.two,
  },
  festiveDateLabel: {
    fontSize: 13,
    color: TAB_MUTED,
    marginBottom: 4,
    marginLeft: 2,
  },
  festiveClearLabel: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '600',
  },
});
