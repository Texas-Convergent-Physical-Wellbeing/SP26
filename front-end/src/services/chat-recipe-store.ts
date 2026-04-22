/**
 * In-memory + AsyncStorage cache for recipes returned by Meal Mate on the
 * chat screen. Persisted so saved recipes keep working when the user:
 *   - starts a new chat (which used to wipe them)
 *   - reloads the app
 *   - navigates to a bookmarked AI recipe while the original conversation is
 *     no longer in memory
 *
 * Bookmark records (`chat-bookmark-store`) also snapshot the full payload, so
 * the recipe detail screen can fall back to those if this cache ever misses.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';

import type { ChatRecipePayload } from '@/services/api';
import { scopedKey, subscribeCurrentUser } from '@/services/current-user-store';
import {
  aiGeneratedFoodImage,
  isStaleAiImage,
  seedFromId,
} from '@/utils/synthesize-recipe-facts';

const BASE_STORAGE_KEY = 'nutriculture.chatRecipes.v1';
function storageKey(): string {
  return scopedKey(BASE_STORAGE_KEY);
}
const MAX_PERSISTED = 200; // cap to avoid unbounded growth

interface PersistedEntry {
  id: string;
  recipe: ChatRecipePayload;
  imageUrl: string | null;
  created_at: string;
}

const recipes = new Map<string, ChatRecipePayload>();
const recipeImages = new Map<string, string>();
const recipeCreatedAt = new Map<string, string>();
const listeners = new Set<() => void>();

let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

// Reset in-memory caches whenever the signed-in user changes so cards from
// the previous account don't leak into the new session.
subscribeCurrentUser(() => {
  recipes.clear();
  recipeImages.clear();
  recipeCreatedAt.clear();
  hydrated = false;
  hydrationPromise = null;
  notify();
});

function snapshot(): PersistedEntry[] {
  const out: PersistedEntry[] = [];
  for (const [id, recipe] of recipes) {
    out.push({
      id,
      recipe,
      imageUrl: recipeImages.get(id) ?? null,
      created_at: recipeCreatedAt.get(id) ?? new Date().toISOString(),
    });
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out.slice(0, MAX_PERSISTED);
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(), JSON.stringify(snapshot()));
  } catch {
    // non-fatal
  }
}

export function hydrateChatRecipes(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const entry of parsed as PersistedEntry[]) {
            if (!entry?.id || !entry.recipe) continue;
            recipes.set(entry.id, entry.recipe);
            recipeCreatedAt.set(
              entry.id,
              entry.created_at || new Date().toISOString(),
            );
            // Migrate stale / abstract-art URLs on the way in.
            const storedUrl = entry.imageUrl;
            if (storedUrl && !isStaleAiImage(storedUrl)) {
              recipeImages.set(entry.id, storedUrl);
            } else {
              const ingHint = (entry.recipe.ingredients ?? [])
                .slice(0, 6)
                .join(', ');
              const fresh = aiGeneratedFoodImage(
                entry.recipe.title || 'home cooked meal',
                seedFromId(entry.id),
                ingHint,
              );
              recipeImages.set(entry.id, fresh);
            }
          }
        }
      }
    } catch {
      // start empty on parse failure
    }
    // Warm the cache for every recipe so the chat scrolls back to old cards
    // without re-downloading the pollinations image.
    const urls = Array.from(recipeImages.values());
    if (urls.length > 0) void ExpoImage.prefetch(urls, 'memory-disk');
    // Save migrated URLs.
    void persist();
    hydrated = true;
    notify();
  })();
  return hydrationPromise;
}

export function putChatRecipe(
  id: string,
  recipe: ChatRecipePayload,
  imageUrl?: string,
) {
  recipes.set(id, recipe);
  if (!recipeCreatedAt.has(id)) {
    recipeCreatedAt.set(id, new Date().toISOString());
  }
  let resolvedUrl: string | null = null;
  if (imageUrl) {
    recipeImages.set(id, imageUrl);
    resolvedUrl = imageUrl;
  } else if (!recipeImages.has(id)) {
    // Generate a flux-model food photo using the recipe title + top
    // ingredients. Served from Pollinations' CDN; pair with `stockFoodImage`
    // as the placeholder so the card never blinks.
    const ingHint = (recipe.ingredients ?? []).slice(0, 6).join(', ');
    resolvedUrl = aiGeneratedFoodImage(
      recipe.title || 'home cooked meal',
      seedFromId(id),
      ingHint,
    );
    recipeImages.set(id, resolvedUrl);
  }
  if (resolvedUrl) void ExpoImage.prefetch(resolvedUrl, 'memory-disk');
  void persist();
  notify();
}

export function setChatRecipeImage(id: string, imageUrl: string | null) {
  if (imageUrl) {
    recipeImages.set(id, imageUrl);
  } else {
    recipeImages.delete(id);
  }
  void persist();
  notify();
}

export function getChatRecipe(id: string): ChatRecipePayload | undefined {
  return recipes.get(id);
}

export function getChatRecipeImageUrl(id: string): string | undefined {
  return recipeImages.get(id);
}

/**
 * Seed the in-memory cache from an external source (e.g. a `ChatBookmark`
 * payload) for recipes that were never in this store — happens when the
 * user taps into a bookmarked AI recipe and the originating chat message
 * has already been archived.
 */
export function ensureChatRecipe(
  id: string,
  recipe: ChatRecipePayload,
  imageUrl?: string | null,
): void {
  if (recipes.has(id)) return;
  recipes.set(id, recipe);
  recipeCreatedAt.set(id, new Date().toISOString());
  if (imageUrl) {
    recipeImages.set(id, imageUrl);
    void ExpoImage.prefetch(imageUrl, 'memory-disk');
  } else if (!recipeImages.has(id)) {
    const ingHint = (recipe.ingredients ?? []).slice(0, 6).join(', ');
    const fresh = aiGeneratedFoodImage(
      recipe.title || 'home cooked meal',
      seedFromId(id),
      ingHint,
    );
    recipeImages.set(id, fresh);
    void ExpoImage.prefetch(fresh, 'memory-disk');
  }
  void persist();
  notify();
}

export function subscribeChatRecipes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
