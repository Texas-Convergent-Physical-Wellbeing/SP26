import type { ChatRecipePayload } from '@/services/api';

const recipes = new Map<string, ChatRecipePayload>();
const recipeImages = new Map<string, string>();
const listeners = new Set<() => void>();

export function putChatRecipe(id: string, recipe: ChatRecipePayload, imageUrl?: string) {
  recipes.set(id, recipe);
  if (imageUrl) recipeImages.set(id, imageUrl);
  notify();
}

export function setChatRecipeImage(id: string, imageUrl: string | null) {
  if (imageUrl) {
    recipeImages.set(id, imageUrl);
  } else {
    recipeImages.delete(id);
  }
  notify();
}

export function getChatRecipe(id: string): ChatRecipePayload | undefined {
  return recipes.get(id);
}

export function getChatRecipeImageUrl(id: string): string | undefined {
  return recipeImages.get(id);
}

export function subscribeChatRecipes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

