/**
 * Inline comments list + composer. Persists to AsyncStorage under the same
 * `recipe_comments_<id>` key that the home tab's CommentModal uses, so the
 * two views stay in sync (comments posted from either place show up in both).
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const COMMENTS_KEY_PREFIX = 'recipe_comments_';
const ORANGE = '#ffb259';
const BROWN = '#7a4720';

interface StoredComment {
  id: string;
  body: string;
  created_at: string;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CommentsSection({
  recipeId,
  recipeName,
}: {
  recipeId: string;
  recipeName?: string;
}) {
  const [comments, setComments] = useState<StoredComment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!recipeId) return;
    try {
      const raw = await AsyncStorage.getItem(COMMENTS_KEY_PREFIX + recipeId);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
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
  }, [recipeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const entry: StoredComment = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      body: text.trim(),
      created_at: new Date().toISOString(),
    };
    const next = [...comments, entry];
    try {
      await AsyncStorage.setItem(COMMENTS_KEY_PREFIX + recipeId, JSON.stringify(next));
      setComments(next);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="chatbubbles-outline" size={16} color={BROWN} />
        <ThemedText style={styles.header}>
          Comments{recipeName ? ` · ${recipeName}` : ''}
        </ThemedText>
        <View style={styles.pill}>
          <ThemedText style={styles.pillText}>{comments.length}</ThemedText>
        </View>
      </View>

      {comments.length === 0 ? (
        <ThemedText style={styles.empty}>Be the first to share your thoughts.</ThemedText>
      ) : (
        <View style={{ gap: 8, marginTop: 6 }}>
          {comments.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={12} color="#fff" />
              </View>
              <View style={styles.bubble}>
                <ThemedText style={styles.body}>{c.body}</ThemedText>
                <ThemedText style={styles.time}>{formatRelative(c.created_at)}</ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment…"
          placeholderTextColor="#aaa"
          style={styles.input}
          maxLength={280}
          multiline
        />
        <TouchableOpacity
          onPress={submit}
          disabled={!text.trim() || busy}
          style={[styles.sendBtn, (!text.trim() || busy) && styles.sendBtnDisabled]}
          activeOpacity={0.85}
          accessibilityLabel="Post comment">
          <Ionicons name="arrow-up" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  header: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  pill: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  empty: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    flex: 1,
    backgroundColor: '#faf2dc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f0e4cb',
  },
  body: { fontSize: 13, lineHeight: 18, color: '#333' },
  time: { fontSize: 10, color: '#9a8260', marginTop: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  input: {
    flex: 1,
    backgroundColor: '#faf2dc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#f0e4cb',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#bbb',
  },
});
