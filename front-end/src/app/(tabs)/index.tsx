import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { Alert } from 'react-native';

import { ProModal } from '@/components/pro-modal';
import { ShimmerPlaceholder } from '@/components/shimmer-placeholder';
import { ThemedText } from '@/components/themed-text';
import { Recipe, RECIPES } from '@/data/recipes';
import {
  getUserPosts,
  hydrateUserPosts,
  removeUserPost,
  subscribeUserPosts,
  UserPost,
} from '@/services/user-posts-store';
import { resolveDisplayImage, seedFromId, stockFoodImage } from '@/utils/synthesize-recipe-facts';

const CREAM = '#fff4db';
const ORANGE = '#ffb259';
const GREEN_TAG = '#c7e890';
const BROWN = '#7a4720';
const BOOKMARK_ACTIVE = '#e2652f';

const COMMENTS_KEY_PREFIX = 'recipe_comments_';
const LIKES_KEY = 'liked_recipes';
const BOOKMARKS_KEY = 'bookmarked_recipes';

// ─── Comment Modal ─────────────────────────────────────────────────────────────

type StoredComment = { id: string; body: string; created_at: string };

function CommentModal({
  recipeId,
  recipeName,
  onClose,
}: {
  recipeId: string | null;
  recipeName: string | null;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [comments, setComments] = useState<StoredComment[]>([]);

  const loadComments = useCallback(async (id: string) => {
    const key = COMMENTS_KEY_PREFIX + id;
    const raw = await AsyncStorage.getItem(key);
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        // Legacy format migration: array of strings → array of objects.
        const migrated: StoredComment[] = parsed.map((body: string, i: number) => ({
          id: `legacy-${i}`,
          body,
          created_at: new Date().toISOString(),
        }));
        setComments(migrated);
      } else {
        setComments(parsed);
      }
    } catch {
      setComments([]);
    }
  }, []);

  useEffect(() => {
    if (recipeId) {
      setText('');
      void loadComments(recipeId);
    }
  }, [recipeId, loadComments]);

  const handleSubmit = async () => {
    if (!recipeId || !text.trim()) return;
    const entry: StoredComment = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      body: text.trim(),
      created_at: new Date().toISOString(),
    };
    const next = [...comments, entry];
    await AsyncStorage.setItem(COMMENTS_KEY_PREFIX + recipeId, JSON.stringify(next));
    setComments(next);
    setText('');
  };

  if (!recipeId) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.commentOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={styles.commentSheet}>
          <View style={styles.sheetHandle} />
          <ThemedText style={styles.commentTitle}>{recipeName ?? 'Recipe'}</ThemedText>
          <ThemedText style={styles.commentSubtitle}>
            {comments.length === 0
              ? 'Be the first to comment'
              : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`}
          </ThemedText>

          {comments.length > 0 && (
            <ScrollView style={styles.commentList} showsVerticalScrollIndicator={false}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    <Ionicons name="person" size={12} color="#fff" />
                  </View>
                  <View style={styles.commentBodyWrap}>
                    <ThemedText style={styles.commentBody}>{c.body}</ThemedText>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TextInput
            style={styles.commentInput}
            placeholder="Share your thoughts on this recipe…"
            placeholderTextColor="#aaa"
            multiline
            maxLength={280}
            value={text}
            onChangeText={setText}
          />
          <ThemedText style={styles.charCount}>{text.length}/280</ThemedText>
          <TouchableOpacity
            style={[styles.submitBtn, !text.trim() && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={!text.trim()}>
            <ThemedText style={styles.submitBtnText}>Post Comment</ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Recipe Card ───────────────────────────────────────────────────────────────

type FeedItem =
  | { kind: 'recipe'; recipe: Recipe }
  | { kind: 'user'; post: UserPost };

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

function UserPostCard({
  post,
  bookmarked,
  liked,
  onToggleBookmark,
  onToggleLike,
  onPress,
  onChatPress,
  onDelete,
}: {
  post: UserPost;
  bookmarked: boolean;
  liked: boolean;
  onToggleBookmark: (id: string) => void;
  onToggleLike: (id: string) => void;
  onPress: (post: UserPost) => void;
  onChatPress: (post: UserPost) => void;
  onDelete: (id: string) => void;
}) {
  const displayImage = resolveDisplayImage(post.imageUri, post.title, post.id);
  // Use an instant stock photo match as the placeholder so the tile never
  // flashes empty while the accurate AI-generated image keeps decoding.
  const placeholderUri = stockFoodImage(post.title || '', seedFromId(post.id));
  const [loaded, setLoaded] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      'Delete recipe?',
      'This removes your post from the community feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(post.id) },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { height: 220 }]}
      activeOpacity={0.92}
      onPress={() => onPress(post)}
      onLongPress={confirmDelete}
      delayLongPress={350}>
      {!loaded && <ShimmerPlaceholder style={StyleSheet.absoluteFill} />}
      <Image
        source={{ uri: displayImage }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={250}
        recyclingKey={displayImage}
        placeholderContentFit="cover"
        placeholder={{ uri: placeholderUri }}
        onLoad={() => setLoaded(true)}
      />
      <View style={styles.cardOverlay} />

      <View style={styles.userTopActions}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={e => { e.stopPropagation?.(); confirmDelete(); }}
          hitSlop={8}
          activeOpacity={0.75}
          accessibilityLabel="Delete post">
          <Ionicons name="trash-outline" size={15} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bookmarkBtnInline}
          onPress={e => { e.stopPropagation?.(); onToggleBookmark(post.id); }}
          hitSlop={8}
          activeOpacity={0.75}>
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={17}
            color={bookmarked ? BOOKMARK_ACTIVE : 'rgba(255,255,255,0.9)'}
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.tag,
          { backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', gap: 3 },
        ]}>
        {post.ai_origin && (
          <Ionicons name="sparkles" size={11} color="#fff" />
        )}
        <ThemedText style={[styles.tagText, { color: '#fff', fontWeight: '700' }]}>
          {post.ai_origin ? 'AI · Yours' : 'Yours'}
        </ThemedText>
      </View>

      <ThemedText style={styles.cardName} numberOfLines={1}>
        {post.title}
      </ThemedText>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, liked && styles.likedBtn]}
          onPress={e => { e.stopPropagation?.(); onToggleLike(post.id); }}
          hitSlop={6}
          activeOpacity={0.8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.chatBtn]}
          onPress={e => { e.stopPropagation?.(); onChatPress(post); }}
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
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string } | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [userPosts, setUserPosts] = useState<UserPost[]>(() => getUserPosts());
  const proShown = useRef(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (proShown.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const nearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
    if (nearEnd) { proShown.current = true; setShowProModal(true); }
  };

  useEffect(() => {
    const CACHE_KEY = 'recipes_images_cached_v2';
    (async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) {
        await Promise.all(RECIPES.map(r => Image.prefetch(r.imageUrl)));
        await AsyncStorage.setItem(CACHE_KEY, 'true');
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeUserPosts(() => {
      setUserPosts([...getUserPosts()]);
    });
    void hydrateUserPosts();
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [rawLiked, rawBookmarks] = await Promise.all([
          AsyncStorage.getItem(LIKES_KEY),
          AsyncStorage.getItem(BOOKMARKS_KEY),
        ]);
        if (rawLiked) setLiked(new Set(JSON.parse(rawLiked)));
        if (rawBookmarks) setBookmarked(new Set(JSON.parse(rawBookmarks)));
      })();
    }, []),
  );

  const toggleBookmark = async (id: string) => {
    const next = new Set(bookmarked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setBookmarked(next);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...next]));
  };

  const toggleLike = async (id: string) => {
    const next = new Set(liked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setLiked(next);
    await AsyncStorage.setItem(LIKES_KEY, JSON.stringify([...next]));
  };

  const feedItems: FeedItem[] = [
    ...userPosts.map((p) => ({ kind: 'user' as const, post: p })),
    ...RECIPES.map((r) => ({ kind: 'recipe' as const, recipe: r })),
  ];
  const leftCards = feedItems.filter((_, i) => i % 2 === 0);
  const rightCards = feedItems.filter((_, i) => i % 2 !== 0);

  const handleDeletePost = async (id: string) => {
    // Also clear any bookmark / like state for the deleted post.
    const nextBookmarks = new Set(bookmarked);
    const nextLikes = new Set(liked);
    nextBookmarks.delete(id);
    nextLikes.delete(id);
    setBookmarked(nextBookmarks);
    setLiked(nextLikes);
    await Promise.all([
      AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...nextBookmarks])),
      AsyncStorage.setItem(LIKES_KEY, JSON.stringify([...nextLikes])),
      removeUserPost(id),
    ]);
  };

  const renderCard = (item: FeedItem) => {
    if (item.kind === 'user') {
      const p = item.post;
      return (
        <UserPostCard
          key={p.id}
          post={p}
          bookmarked={bookmarked.has(p.id)}
          liked={liked.has(p.id)}
          onToggleBookmark={toggleBookmark}
          onToggleLike={toggleLike}
          onPress={(post) => router.push(`/recipe/${post.id}` as any)}
          onChatPress={(post) => setCommentTarget({ id: post.id, name: post.title })}
          onDelete={handleDeletePost}
        />
      );
    }
    const r = item.recipe;
    return (
      <RecipeCard
        key={r.id}
        recipe={r}
        bookmarked={bookmarked.has(r.id)}
        liked={liked.has(r.id)}
        onToggleBookmark={toggleBookmark}
        onToggleLike={toggleLike}
        onPress={(recipe) => router.push(`/recipe/${recipe.id}` as any)}
        onChatPress={(recipe) => setCommentTarget({ id: recipe.id, name: recipe.name })}
      />
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <ThemedText style={styles.title}>Let&apos;s Get Cooking!</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        <View style={styles.column}>{leftCards.map(renderCard)}</View>
        <View style={styles.column}>{rightCards.map(renderCard)}</View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-post' as any)}
        activeOpacity={0.85}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <CommentModal
        recipeId={commentTarget?.id ?? null}
        recipeName={commentTarget?.name ?? null}
        onClose={() => setCommentTarget(null)}
      />
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
  userTopActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  bookmarkBtnInline: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    padding: 5,
  },
  deleteBtn: {
    backgroundColor: 'rgba(228,68,68,0.9)',
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
  commentList: {
    maxHeight: 200,
    marginTop: 8,
    marginBottom: 4,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  commentBodyWrap: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#f0e4cb',
  },
  commentBody: { fontSize: 13, lineHeight: 18, color: '#333' },
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
