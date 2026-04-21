/**
 * Persisted store for AI-generated recipes the user has bookmarked from the
 * Meal Mate chat recipe detail screen.
 *
 * Unlike the static RECIPES bundle, these are generated on-the-fly, so we snapshot
 * the full payload here and surface them in the Bookmarks tab's "Saved" section.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';

import type { ChatRecipePayload } from '@/services/api';
import { aiGeneratedFoodImage, isStaleAiImage } from '@/utils/synthesize-recipe-facts';

export interface ChatBookmark {
  id: string;
  recipe: ChatRecipePayload;
  imageUri: string | null;
  created_at: string;
}

const STORAGE_KEY = 'nutriculture.chatBookmarks.v1';

let bookmarks: ChatBookmark[] = [];
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // non-fatal
  }
}

export function hydrateChatBookmarks(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          bookmarks = parsed.filter((b) => b && typeof b.id === 'string' && b.recipe);
        }
      }
    } catch {
      bookmarks = [];
    }
    // Backfill / migrate images on legacy bookmarks. Two cases:
    //   1. `imageUri` is null  → legacy sparkles placeholder saves
    //   2. `imageUri` points at images.unsplash.com → the old "stock photo"
    //      strategy that turned out to be inaccurate to the recipe
    // In both cases we generate an AI image from the recipe title + top
    // ingredients. User-uploaded photos (file://, http(s) pointing anywhere
    // else) are left untouched.
    let didBackfill = false;
    bookmarks = bookmarks.map((b) => {
      if (b.imageUri && !isStaleAiImage(b.imageUri)) return b;
      const seed = Math.abs(
        Array.from(b.id).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
      ) || 1;
      didBackfill = true;
      const ingHint = (b.recipe?.ingredients ?? []).slice(0, 6).join(', ');
      return {
        ...b,
        imageUri: aiGeneratedFoodImage(
          b.recipe?.title || 'home cooked meal',
          seed,
          ingHint,
        ),
      };
    });
    if (didBackfill) await persist();
    // Warm the image cache for every bookmark so the Saved AI Recipes strip
    // renders decoded images right away when the user opens Bookmarks.
    const urls = bookmarks.map((b) => b.imageUri).filter((u): u is string => !!u);
    if (urls.length > 0) void ExpoImage.prefetch(urls, 'memory-disk');
    hydrated = true;
    notify();
  })();
  return hydrationPromise;
}

export function getChatBookmarks(): ChatBookmark[] {
  return bookmarks;
}

export function isChatRecipeBookmarked(id: string): boolean {
  return bookmarks.some((b) => b.id === id);
}

export async function addChatBookmark(
  id: string,
  recipe: ChatRecipePayload,
  imageUri: string | null,
): Promise<void> {
  if (bookmarks.some((b) => b.id === id)) return;
  // If the user didn't pick their own image, generate a stable pollinations
  // image from the recipe title so AI bookmarks render with the same look as
  // prebaked / user-posted recipe cards (not just a sparkles placeholder).
  let resolvedImageUri = imageUri;
  if (!resolvedImageUri) {
    const seed = Math.abs(
      Array.from(id).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
    ) || 1;
    const ingHint = (recipe.ingredients ?? []).slice(0, 6).join(', ');
    resolvedImageUri = aiGeneratedFoodImage(
      recipe.title || 'home cooked meal',
      seed,
      ingHint,
    );
  }
  bookmarks = [
    { id, recipe, imageUri: resolvedImageUri, created_at: new Date().toISOString() },
    ...bookmarks,
  ];
  if (resolvedImageUri) void ExpoImage.prefetch(resolvedImageUri, 'memory-disk');
  await persist();
  notify();
}

export async function removeChatBookmark(id: string): Promise<void> {
  const next = bookmarks.filter((b) => b.id !== id);
  if (next.length === bookmarks.length) return;
  bookmarks = next;
  await persist();
  notify();
}

export function subscribeChatBookmarks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
