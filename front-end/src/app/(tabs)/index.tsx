import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProModal } from '@/components/pro-modal';
import { ShimmerPlaceholder } from '@/components/shimmer-placeholder';
import { ThemedText } from '@/components/themed-text';
import { Recipe, RECIPES } from '@/data/recipes';

const CREAM = '#fff4db';
const ORANGE = '#ffb259';
const GREEN_TAG = '#c7e890';
const BROWN = '#7a4720';
const BOOKMARK_ACTIVE = '#e2652f';

const COMMENTS_KEY_PREFIX = 'recipe_comments_';
const LIKES_KEY = 'liked_recipes';

// ─── Comment Modal ─────────────────────────────────────────────────────────────

function CommentModal({
  recipe,
  onClose,
}: {
  recipe: Recipe | null;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (recipe) { setText(''); setSubmitted(false); }
  }, [recipe?.id]);

  const handleSubmit = async () => {
    if (!recipe || !text.trim()) return;
    const key = COMMENTS_KEY_PREFIX + recipe.id;
    const raw = await AsyncStorage.getItem(key);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(key, JSON.stringify([...existing, text.trim()]));
    setSubmitted(true);
  };

  if (!recipe) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.commentOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={styles.commentSheet}>
          <View style={styles.sheetHandle} />
          <ThemedText style={styles.commentTitle}>{recipe.name}</ThemedText>
          <ThemedText style={styles.commentSubtitle}>Leave a comment</ThemedText>
          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={36} color={ORANGE} />
              <ThemedText style={styles.successText}>Comment posted!</ThemedText>
              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
                <ThemedText style={styles.doneBtnText}>Done</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.commentInput}
                placeholder="Share your thoughts on this recipe…"
                placeholderTextColor="#aaa"
                multiline
                maxLength={280}
                value={text}
                onChangeText={setText}
                autoFocus
              />
              <ThemedText style={styles.charCount}>{text.length}/280</ThemedText>
              <TouchableOpacity
                style={[styles.submitBtn, !text.trim() && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={!text.trim()}>
                <ThemedText style={styles.submitBtnText}>Post Comment</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Recipe Card ───────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  bookmarked,
  liked,
  onToggleBookmark,
  onToggleLike,
  onPress,
  onChatPress,
}: {
  recipe: Recipe;
  bookmarked: boolean;
  liked: boolean;
  onToggleBookmark: (id: string) => void;
  onToggleLike: (id: string) => void;
  onPress: (recipe: Recipe) => void;
  onChatPress: (recipe: Recipe) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.card, { height: recipe.height }]}
      activeOpacity={0.92}
      onPress={() => onPress(recipe)}>
      {!loaded && <ShimmerPlaceholder style={StyleSheet.absoluteFill} />}
      <Image
        source={{ uri: recipe.imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="disk"
        transition={400}
        onLoad={() => setLoaded(true)}
      />
      <View style={styles.cardOverlay} />

      <TouchableOpacity
        style={styles.bookmarkBtn}
        onPress={e => { e.stopPropagation?.(); onToggleBookmark(recipe.id); }}
        hitSlop={8}
        activeOpacity={0.75}>
        <Ionicons
          name={bookmarked ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color={bookmarked ? BOOKMARK_ACTIVE : 'rgba(255,255,255,0.9)'}
        />
      </TouchableOpacity>

      {recipe.tag && (
        <View style={styles.tag}>
          <ThemedText style={styles.tagText}>{recipe.tag}</ThemedText>
        </View>
      )}

      <ThemedText style={styles.cardName} numberOfLines={1}>
        {recipe.name}
      </ThemedText>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, liked && styles.likedBtn]}
          onPress={e => { e.stopPropagation?.(); onToggleLike(recipe.id); }}
          hitSlop={6}
          activeOpacity={0.8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.chatBtn]}
          onPress={e => { e.stopPropagation?.(); onChatPress(recipe); }}
          hitSlop={6}
          activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses" size={13} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [commentRecipe, setCommentRecipe] = useState<Recipe | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const proShown = useRef(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (proShown.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const nearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
    if (nearEnd) { proShown.current = true; setShowProModal(true); }
  };

  useEffect(() => {
    const CACHE_KEY = 'recipes_images_cached_v1';
    (async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) {
        await Promise.all(RECIPES.map(r => Image.prefetch(r.imageUrl)));
        await AsyncStorage.setItem(CACHE_KEY, 'true');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(LIKES_KEY);
      if (raw) setLiked(new Set(JSON.parse(raw)));
    })();
  }, []);

  const toggleBookmark = (id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleLike = async (id: string) => {
    const next = new Set(liked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setLiked(next);
    await AsyncStorage.setItem(LIKES_KEY, JSON.stringify([...next]));
  };

  const leftCards = RECIPES.filter((_, i) => i % 2 === 0);
  const rightCards = RECIPES.filter((_, i) => i % 2 !== 0);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <ThemedText style={styles.title}>Let's Get Cooking!</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        <View style={styles.column}>
          {leftCards.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              bookmarked={bookmarked.has(recipe.id)}
              liked={liked.has(recipe.id)}
              onToggleBookmark={toggleBookmark}
              onToggleLike={toggleLike}
              onPress={r => router.push(`/recipe/${r.id}` as any)}
              onChatPress={setCommentRecipe}
            />
          ))}
        </View>
        <View style={styles.column}>
          {rightCards.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              bookmarked={bookmarked.has(recipe.id)}
              liked={liked.has(recipe.id)}
              onToggleBookmark={toggleBookmark}
              onToggleLike={toggleLike}
              onPress={r => router.push(`/recipe/${r.id}` as any)}
              onChatPress={setCommentRecipe}
            />
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-post' as any)}
        activeOpacity={0.85}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <CommentModal recipe={commentRecipe} onClose={() => setCommentRecipe(null)} />
      <ProModal visible={showProModal} onDismiss={() => setShowProModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  topBar: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#000',
    lineHeight: 36,
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 9,
    paddingBottom: 16,
  },
  column: { flex: 1, gap: 9 },
  card: {
    borderRadius: 15,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: '#e8dcc8',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: GREEN_TAG,
    borderRadius: 35,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontSize: 13, color: '#000', fontWeight: '400' },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    padding: 5,
  },
  cardActions: { flexDirection: 'row', gap: 5, marginTop: 5 },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,140,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedBtn: { backgroundColor: 'rgba(220,50,80,0.85)' },
  chatBtn: { backgroundColor: 'rgba(80,180,80,0.85)' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  // Comment sheet
  commentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  commentSheet: {
    backgroundColor: CREAM,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'center', marginBottom: 4,
  },
  commentTitle: { fontSize: 18, fontWeight: '700', color: BROWN },
  commentSubtitle: { fontSize: 13, color: '#777', marginTop: -6 },
  commentInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    minHeight: 100,
    fontSize: 15,
    color: '#111',
    textAlignVertical: 'top',
    borderWidth: 1.5,
    borderColor: '#e8dcc8',
  },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: -6 },
  submitBtn: {
    backgroundColor: ORANGE, borderRadius: 25,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  successBox: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  successText: { fontSize: 16, fontWeight: '600', color: '#333' },
  doneBtn: {
    backgroundColor: ORANGE, borderRadius: 25,
    paddingVertical: 12, paddingHorizontal: 40, marginTop: 8,
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
