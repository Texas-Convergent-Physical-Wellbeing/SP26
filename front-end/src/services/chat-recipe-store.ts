import type { ChatRecipePayload } from '@/services/api';

const recipes = new Map<string, ChatRecipePayload>();
const recipeImages = new Map<string, string>();

export function putChatRecipe(id: string, recipe: ChatRecipePayload, imageUrl?: string) {
  recipes.set(id, recipe);
  if (imageUrl) recipeImages.set(id, imageUrl);
}

export function getChatRecipe(id: string): ChatRecipePayload | undefined {
  return recipes.get(id);
}

export function getChatRecipeImageUrl(id: string): string | undefined {
  return recipeImages.get(id);
}

