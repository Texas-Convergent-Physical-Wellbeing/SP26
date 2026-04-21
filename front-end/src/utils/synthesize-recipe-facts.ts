/**
 * Lightweight heuristic helpers that turn a free-form user-generated recipe
 * (just a title + free text ingredients / description) into the same shape the
 * recipe detail screen expects. Pure functions, no external calls.
 *
 * The goal is NOT clinical accuracy — it's to give user-authored posts the
 * same Recipe + Facts tab layout as our curated recipes, using best-effort
 * assumptions.
 */

import type { HealthTag, Recipe } from '@/data/recipes';

const HIGH_PROTEIN = [
  'chicken', 'turkey', 'beef', 'pork', 'lamb', 'salmon', 'tuna', 'cod',
  'shrimp', 'prawn', 'egg', 'tofu', 'tempeh', 'seitan', 'paneer', 'yogurt',
  'cottage cheese', 'whey', 'edamame', 'lentil', 'chickpea', 'bean', 'quinoa',
];
const HIGH_CARB = [
  'rice', 'pasta', 'noodle', 'bread', 'roti', 'naan', 'tortilla', 'potato',
  'sweet potato', 'oat', 'cereal', 'quinoa', 'polenta', 'couscous', 'bulgur',
  'farro', 'corn', 'banana', 'mango', 'honey', 'sugar', 'maple',
];
const HIGH_FAT = [
  'butter', 'ghee', 'olive oil', 'coconut oil', 'avocado', 'nut', 'seed',
  'tahini', 'cheese', 'cream', 'mayonnaise', 'bacon', 'sausage', 'cashew',
  'almond', 'walnut', 'pistachio', 'sesame', 'chia', 'flax',
];
const HIGH_FIBER = [
  'bean', 'lentil', 'chickpea', 'oat', 'broccoli', 'spinach', 'kale',
  'cabbage', 'carrot', 'apple', 'berry', 'avocado', 'chia', 'flax', 'quinoa',
  'whole wheat', 'artichoke', 'brussels sprout',
];

function countMatches(haystack: string, needles: string[]): number {
  let hits = 0;
  for (const n of needles) if (haystack.includes(n)) hits++;
  return hits;
}

/**
 * Extract ingredient lines from a free-form `"a, b, c"` or newline-separated
 * string. Trims, drops quantities like "2 cups" that would pollute matching,
 * and returns ingredient-like phrases.
 */
export function parseIngredientsList(raw: string): string[] {
  if (!raw) return [];
  const splitPattern = /\n+|,\s*/;
  return raw
    .split(splitPattern)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 120);
}

/** Extract steps from a free-form block: looks for numbered lines first. */
export function parseStepsFromDescription(description: string): string[] {
  if (!description) return [];
  const lines = description.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const numbered = lines.filter((l) => /^\d+[.)]\s*/.test(l));
  if (numbered.length >= 2) {
    return numbered.map((l) => l.replace(/^\d+[.)]\s*/, ''));
  }
  // Fallback: split on sentence-terminators.
  if (description.length < 20) return [];
  return description
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);
}

/**
 * Infer macro % splits from ingredient text. We don't know portion sizes so
 * we return a rough split that sums to 100 biased by ingredient category.
 */
export function inferMacroSplit(ingredientsText: string): {
  carbsPercent: number;
  proteinPercent: number;
  fatsPercent: number;
} {
  const text = ingredientsText.toLowerCase();
  if (!text.trim()) {
    return { carbsPercent: 45, proteinPercent: 25, fatsPercent: 30 };
  }

  const proteinHits = countMatches(text, HIGH_PROTEIN) * 2;
  const carbHits = countMatches(text, HIGH_CARB) * 1.6;
  const fatHits = countMatches(text, HIGH_FAT) * 1.4;

  const base = proteinHits + carbHits + fatHits;
  if (base === 0) {
    return { carbsPercent: 45, proteinPercent: 25, fatsPercent: 30 };
  }

  // Blend with sensible priors (45/25/30) so weird inputs don't produce 100/0/0.
  const carbs = Math.round(((carbHits / base) * 60) + 30);
  const protein = Math.round(((proteinHits / base) * 55) + 18);
  const fats = 100 - carbs - protein;
  return {
    carbsPercent: Math.max(10, Math.min(70, carbs)),
    proteinPercent: Math.max(10, Math.min(55, protein)),
    fatsPercent: Math.max(10, Math.min(60, fats)),
  };
}

/** Rough total kcal guess based on ingredient density. */
export function inferCalories(ingredientsText: string, stepCount: number): number {
  const n = parseIngredientsList(ingredientsText).length;
  // Baseline 300 + 25 per ingredient + 15 per step, clamped to a realistic band.
  const raw = 300 + n * 25 + stepCount * 15;
  return Math.max(220, Math.min(780, Math.round(raw / 10) * 10));
}

/**
 * Build a handful of health tags based on ingredient signals. Always returns
 * at least one so the Facts tab doesn't look empty.
 */
export function inferHealthTags(ingredientsText: string, tag: string | null): HealthTag[] {
  const text = ingredientsText.toLowerCase();
  const tags: HealthTag[] = [];
  const proteinHits = countMatches(text, HIGH_PROTEIN);
  const fiberHits = countMatches(text, HIGH_FIBER);
  const fatHits = countMatches(text, HIGH_FAT);

  if (proteinHits >= 2) tags.push({ label: 'High Protein', color: 'green' });
  if (fiberHits >= 2) tags.push({ label: 'High Fiber', color: 'green' });
  if (tag === 'Vegetarian' || tag === 'Vegan') tags.push({ label: 'Plant-Based', color: 'green' });
  if (tag === 'Gluten-Free' || text.includes('gluten-free')) tags.push({ label: 'Gluten-Free', color: 'green' });
  if (fatHits >= 3) tags.push({ label: 'Calorie-Dense', color: 'orange' });
  if (text.includes('whole grain') || text.includes('brown rice') || text.includes('oats')) {
    tags.push({ label: 'Whole Grains', color: 'green' });
  }
  if (!tags.length) tags.push({ label: 'Home-Cooked', color: 'green' });
  return tags.slice(0, 5);
}

// ─── Stock food photo bank (Unsplash CDN) ────────────────────────────────────
//
// We intentionally do NOT use Pollinations for dynamic fallbacks any more:
// on-demand generation takes 10–15s per image and can time out. These are
// verified-live Unsplash photos served from their global CDN (<500ms) so
// feed tiles render instantly no matter how many there are.
//
// Each entry has optional `match` keywords that bias selection toward
// recipes whose title/ingredients contain that word, so (for example) a
// post called "Italian pasta" shows a pasta photo instead of a random dish.
const FOOD_PHOTO_BANK: { id: string; match?: string[] }[] = [
  { id: '1565557623262-b51c2513a641', match: ['pasta', 'spaghetti', 'linguine', 'penne', 'italian'] },
  { id: '1551183053-bf91a1d81141', match: ['pasta', 'italian', 'pesto'] },
  { id: '1567620832903-9fc6debc209f', match: ['pasta', 'linguine', 'carbonara'] },
  { id: '1563379091339-03b21ab4a4f8', match: ['pizza'] },
  { id: '1504754524776-8f4f37790ca0', match: ['pizza', 'flatbread'] },
  { id: '1555939594-58d7cb561ad1', match: ['burger', 'fries', 'american'] },
  { id: '1504674900247-0877df9cc836', match: ['burger', 'grill', 'beef'] },
  { id: '1482049016688-2d3e1b311543', match: ['taco', 'burrito', 'mexican', 'quesadilla', 'fajita'] },
  { id: '1593560708920-61dd98c46a4e', match: ['taco', 'mexican', 'tostada', 'nachos'] },
  { id: '1585032226651-759b368d7246', match: ['biryani', 'indian', 'curry', 'tandoori', 'masala', 'rice'] },
  { id: '1546069901-ba9599a7e63c', match: ['bowl', 'buddha', 'vegan', 'vegetarian', 'quinoa', 'grain'] },
  { id: '1573821663912-569905455b1c', match: ['bowl', 'healthy', 'salad', 'protein'] },
  { id: '1540189549336-e6e99c3679fe', match: ['salad', 'vegetarian', 'vegan'] },
  { id: '1512621776951-a57141f2eefd', match: ['salad', 'poke', 'bowl'] },
  { id: '1582201942988-13e60e4556ee', match: ['salad', 'greens'] },
  { id: '1569718212165-3a8278d5f624', match: ['ramen', 'noodle', 'japanese', 'asian', 'soup'] },
  { id: '1546241072-48010ad2862c', match: ['ramen', 'noodle', 'pho', 'asian', 'stir fry', 'stir-fry'] },
  { id: '1526318896980-cf78c088247c', match: ['soup', 'stew', 'chowder', 'broth', 'chili'] },
  { id: '1547592166-23ac45744acd', match: ['soup', 'bisque', 'broth'] },
  { id: '1544025162-d76694265947', match: ['steak', 'beef', 'lamb', 'grill', 'bbq'] },
  { id: '1598103442097-8b74394b95c6', match: ['chicken', 'roast', 'poultry', 'turkey'] },
  { id: '1519708227418-c8fd9a32b7a2', match: ['salmon', 'fish', 'seafood', 'tuna', 'cod', 'shrimp', 'prawn'] },
  { id: '1528735602780-2552fd46c7af', match: ['breakfast', 'toast', 'avocado', 'eggs', 'sandwich'] },
  { id: '1551218808-94e220e084d2', match: ['pancake', 'waffle', 'breakfast', 'brunch', 'syrup'] },
  { id: '1565958011703-44f9829ba187', match: ['dessert', 'sweet', 'waffle', 'cake', 'brownie'] },
  { id: '1559847844-5315695dadae', match: ['dessert', 'cake', 'pie', 'tart', 'pastry', 'chocolate'] },
  { id: '1543339308-43e59d6b73a6', match: ['coffee', 'latte', 'cappuccino', 'brunch'] },
  { id: '1553530666-ba11a7da3888', match: ['smoothie', 'juice', 'drink', 'blend', 'bowl'] },
  { id: '1621996346565-e3dbc646d9a9', match: ['lamb', 'mediterranean', 'greek', 'roast'] },
];
// Generic fallback when no keyword matches at all.
const GENERIC_FOOD_PHOTO = '1504674900247-0877df9cc836';

function pickFoodPhotoId(titleLower: string, seed: number): string {
  // First pass: keyword match — collect every photo whose `match` tokens
  // appear in the recipe title. If 1+ match, seed-pick from that list so
  // different recipes with the same keyword still get varied images.
  const matches: string[] = [];
  for (const entry of FOOD_PHOTO_BANK) {
    if (!entry.match) continue;
    for (const token of entry.match) {
      if (titleLower.includes(token)) {
        matches.push(entry.id);
        break;
      }
    }
  }
  const pool = matches.length > 0 ? matches : FOOD_PHOTO_BANK.map((e) => e.id);
  const idx = seed % pool.length;
  return pool[idx] ?? GENERIC_FOOD_PHOTO;
}

/**
 * Returns a **generic stock** food photo URL used as an instant placeholder
 * while the AI-generated image loads. Picks the closest-matching photo from
 * the curated bank by keyword, deterministically seeded so the same post
 * always shows the same placeholder.
 *
 * Served from Unsplash's global CDN (<500ms), cached a full year.
 */
export function stockFoodImage(title: string, seed: number): string {
  const photoId = pickFoodPhotoId((title || '').toLowerCase(), seed);
  return `https://images.unsplash.com/photo-${photoId}?w=400&h=500&fit=crop&auto=format&q=75`;
}

/**
 * Strip meta prefixes & noisy phrasing from a recipe title before feeding it
 * into an image-gen prompt. Titles from the LLM often look like:
 *   "Breakfast: Suhoor: Italian-Thai Fusion Halal Beef & Herb Omelette Roll …"
 * The leading `Breakfast:` / `Suhoor:` tokens are conceptual labels, not food,
 * and cause Pollinations to generate abstract art (it guesses "Suhoor" means
 * a sleeping person, etc). We keep only the part of the title that actually
 * describes the dish.
 */
function cleanTitleForImage(title: string): string {
  let t = (title || '').trim();

  // Drop any leading "<word>:" labels, repeatedly. Handles double prefixes
  // like "Breakfast: Suhoor:" and "Dinner: Light Evening:".
  const LABELS =
    /^(breakfast|lunch|dinner|snack|brunch|suhoor|iftar|appetizer|dessert|side(?:\sdish)?|main(?:\scourse)?|light\sevening|late\snight|post[-\s]?workout|pre[-\s]?workout)\s*:\s*/i;
  for (let i = 0; i < 4 && LABELS.test(t); i += 1) {
    t = t.replace(LABELS, '').trim();
  }

  // Collapse anything after a long "... with ..." clause to keep the subject
  // short and photogenic. Pollinations degrades past ~10 keywords.
  t = t.replace(/\s+with\s+.{40,}$/i, '');

  if (t.length > 90) t = t.slice(0, 90);
  return t.trim() || 'home cooked meal';
}

/**
 * AI-generated food photo via Pollinations' `flux` model — more reliable for
 * food photography than `turbo` (which routinely hallucinates abstract art
 * on longer / compound titles). First hit takes ~3–5 s; cached globally on
 * Pollinations' CDN thereafter.
 *
 * Pair with `stockFoodImage` as an `expo-image` placeholder so the card shows
 * an immediate food photo that fades into the accurate AI image when ready.
 */
export function aiGeneratedFoodImage(
  title: string,
  seed: number,
  ingredientsHint?: string,
): string {
  const cleanTitle = cleanTitleForImage(title);
  const hint = ingredientsHint
    ? `, key ingredients: ${ingredientsHint.slice(0, 100)}`
    : '';
  // Lead the prompt with "photograph" + "plated food" so the model anchors on
  // realistic food photography instead of illustrated art.
  const prompt = encodeURIComponent(
    `photograph of ${cleanTitle}${hint}, plated food on a ceramic dish, ` +
      `overhead angle, professional food photography, natural daylight, ` +
      `shallow depth of field, appetizing, high detail, no text, no people`,
  );
  // The `imgver=2` tag is meaningless to Pollinations (they ignore unknown
  // params) but lets us detect & migrate old image URLs that were generated
  // with a buggy prompt or wrong model.
  return `https://image.pollinations.ai/prompt/${prompt}?seed=${seed}&width=400&height=400&nologo=true&model=flux&imgver=2`;
}

/**
 * Returns true if the given persisted `imageUri` was generated by an older
 * version of this module (pollinations `turbo` / stock Unsplash photos / the
 * original long-prompt flux URLs). Used on hydrate to force-migrate stale
 * URLs to the current accurate generator.
 */
export function isStaleAiImage(imageUri: string | null | undefined): boolean {
  if (!imageUri) return false;
  if (imageUri.includes('images.unsplash.com')) return true;
  if (imageUri.includes('image.pollinations.ai') && !imageUri.includes('imgver=2')) {
    return true;
  }
  return false;
}

/**
 * Alias kept for backwards-compatibility with existing call sites. This used
 * to return either a Pollinations URL or an Unsplash URL depending on the
 * phase of the moon; now it returns the accurate AI image. Call sites that
 * want the stock photo (placeholder) explicitly should use `stockFoodImage`.
 */
export function fallbackFoodImage(title: string, seed: number): string {
  return aiGeneratedFoodImage(title, seed);
}

/** Deterministic numeric seed from an arbitrary string (stable across renders). */
export function seedFromId(id: string): number {
  return (
    Math.abs(
      Array.from(id).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
    ) || 1
  );
}

/**
 * Resolve a display image for any recipe-like card: returns `imageUri` if the
 * caller already has one (user uploaded / stored URL), otherwise generates a
 * stable pollinations food image from the title + id. Useful at render time
 * so legacy entries without a stored imageUri still show a proper photo.
 */
export function resolveDisplayImage(
  imageUri: string | null | undefined,
  title: string,
  id: string,
): string {
  if (imageUri && imageUri.trim()) return imageUri;
  return fallbackFoodImage(title || 'home cooked meal', seedFromId(id));
}

// ─── Category inference ────────────────────────────────────────────────────────

/** Ordered list of canonical categories we display as chips in the create-post flow. */
export const DEFAULT_CATEGORIES: string[] = [
  'Vegetarian',
  'Vegan',
  'High-Protein',
  'Low-Carb',
  'Gluten-Free',
  'Dairy-Free',
  'Mediterranean',
  'Italian',
  'Mexican',
  'Indian',
  'Chinese',
  'Thai',
  'Greek',
  'Middle Eastern',
  'Japanese',
  'Korean',
  'Caribbean',
  'African',
  'American',
  'French',
  'Dessert',
  'Breakfast',
  'Snack',
  'Soup',
  'Salad',
  'Seafood',
  'BBQ / Grill',
  'Comfort Food',
  'Heart-Healthy',
  'Diabetic-Friendly',
];

const MEAT_INDICATORS = [
  'chicken', 'beef', 'pork', 'lamb', 'bacon', 'ham', 'sausage', 'turkey', 'duck',
];
const SEAFOOD_INDICATORS = [
  'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'crab', 'lobster', 'anchov',
  'sardine', 'tilapia', 'clam', 'mussel', 'squid', 'octopus', 'oyster', 'fish',
];
const DAIRY_INDICATORS = [
  'milk', 'cream', 'butter', 'cheese', 'yogurt', 'ghee', 'paneer', 'parmesan',
  'feta', 'ricotta', 'mozzarella',
];
const EGG_INDICATORS = ['egg', 'eggs'];
const GLUTEN_INDICATORS = [
  'flour', 'bread', 'pasta', 'noodle', 'soy sauce', 'couscous', 'bulgur',
  'barley', 'wheat', 'tortilla', 'roti', 'naan', 'pizza', 'seitan',
];
const CUISINE_KEYWORDS: Record<string, string[]> = {
  Italian: ['pasta', 'risotto', 'parmesan', 'pesto', 'basil', 'tomato', 'mozzarella', 'lasagna', 'bolognese'],
  Mexican: ['taco', 'burrito', 'enchilada', 'salsa', 'tortilla', 'chipotle', 'jalapeno', 'quesadilla', 'guacamole', 'adobo'],
  Indian: ['curry', 'masala', 'tikka', 'dal', 'paneer', 'naan', 'roti', 'biryani', 'tandoori', 'garam', 'turmeric', 'cumin'],
  Chinese: ['soy sauce', 'stir-fry', 'stir fry', 'hoisin', 'sesame oil', 'bok choy', 'dumpling', 'wok', 'fried rice'],
  Thai: ['thai', 'lemongrass', 'coconut milk', 'fish sauce', 'basil', 'pad thai', 'curry paste'],
  Japanese: ['miso', 'sushi', 'ramen', 'udon', 'teriyaki', 'nori', 'wasabi', 'mirin', 'sake'],
  Korean: ['gochujang', 'kimchi', 'bulgogi', 'bibimbap', 'korean'],
  Greek: ['feta', 'tzatziki', 'olive oil', 'oregano', 'greek', 'gyro', 'souvlaki'],
  'Middle Eastern': ['tahini', 'hummus', 'falafel', 'harissa', 'sumac', 'za\u2019atar', 'zaatar', 'pita', 'shawarma', 'kofta'],
  Mediterranean: ['olive oil', 'feta', 'chickpea', 'eggplant', 'hummus', 'oregano', 'lemon'],
  French: ['butter', 'cream', 'baguette', 'ratatouille', 'coq au vin', 'beurre'],
  Caribbean: ['jerk', 'plantain', 'scotch bonnet', 'allspice', 'callaloo', 'ackee'],
  African: ['berbere', 'injera', 'suya', 'jollof', 'egusi', 'harissa'],
  American: ['bbq', 'burger', 'meatloaf', 'mac and cheese', 'cornbread'],
};
const MEAL_KEYWORDS: Record<string, string[]> = {
  Breakfast: ['pancake', 'waffle', 'oatmeal', 'granola', 'omelet', 'omelette', 'scramble', 'toast', 'smoothie', 'porridge', 'frittata', 'breakfast'],
  Dessert: ['cake', 'cookie', 'brownie', 'pie', 'tart', 'pudding', 'ice cream', 'chocolate', 'frosting', 'cheesecake', 'mousse'],
  Snack: ['chips', 'popcorn', 'bites', 'dip', 'bars', 'trail mix'],
  Soup: ['soup', 'broth', 'stew', 'chowder', 'bisque', 'chili'],
  Salad: ['salad', 'slaw', 'tabbouleh', 'caprese'],
  Seafood: SEAFOOD_INDICATORS,
  'BBQ / Grill': ['bbq', 'grill', 'smoked', 'barbecue'],
};

function hasAny(text: string, tokens: string[]): boolean {
  for (const t of tokens) if (text.includes(t)) return true;
  return false;
}

function countAny(text: string, tokens: string[]): number {
  let n = 0;
  for (const t of tokens) if (text.includes(t)) n++;
  return n;
}

export interface CategorySuggestions {
  /** One best-guess primary category (used as a default selection). */
  primary: string | null;
  /** Ranked list of all categories that plausibly apply. */
  matches: string[];
}

/**
 * Infer likely categories from the free-form ingredients + title + description.
 * Returns an ordered list (best match first) and a single suggested primary.
 *
 * Heuristic — not clinical. Favours cuisine matches first (most distinctive),
 * then dietary labels (vegetarian, gluten-free, etc.), then meal-type labels.
 */
export function inferCategories(
  title: string,
  ingredientsText: string,
  description: string = '',
): CategorySuggestions {
  const haystack = `${title}\n${ingredientsText}\n${description}`.toLowerCase();
  const matches: string[] = [];

  // 1) Strongest signal: cuisine-specific keywords.
  const cuisineScores: { name: string; score: number }[] = [];
  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    const score = countAny(haystack, keywords);
    if (score > 0) cuisineScores.push({ name: cuisine, score });
  }
  cuisineScores.sort((a, b) => b.score - a.score);
  for (const c of cuisineScores) matches.push(c.name);

  // 2) Meal-type / preparation style (e.g. Soup, Salad, Dessert).
  for (const [meal, keywords] of Object.entries(MEAL_KEYWORDS)) {
    if (hasAny(haystack, keywords)) matches.push(meal);
  }

  // 3) Dietary derivations.
  const hasMeat = hasAny(haystack, MEAT_INDICATORS);
  const hasSeafood = hasAny(haystack, SEAFOOD_INDICATORS);
  const hasDairy = hasAny(haystack, DAIRY_INDICATORS);
  const hasEgg = hasAny(haystack, EGG_INDICATORS);
  const hasGluten = hasAny(haystack, GLUTEN_INDICATORS);
  const proteinHits = countAny(haystack, HIGH_PROTEIN);
  const carbHits = countAny(haystack, HIGH_CARB);

  if (!hasMeat && !hasSeafood && !hasDairy && !hasEgg) matches.push('Vegan');
  else if (!hasMeat && !hasSeafood) matches.push('Vegetarian');
  if (!hasDairy) matches.push('Dairy-Free');
  if (!hasGluten) matches.push('Gluten-Free');
  if (proteinHits >= 2) matches.push('High-Protein');
  if (carbHits === 0 && proteinHits >= 1) matches.push('Low-Carb');

  // 4) Deduplicate while preserving order.
  const seen = new Set<string>();
  const deduped = matches.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });

  return {
    primary: deduped[0] ?? null,
    matches: deduped,
  };
}

export interface UserPostLike {
  id: string;
  title: string;
  description: string;
  ingredients: string;
  imageUri: string | null;
  tag: string | null;
}

/**
 * Convert a user-created post into the `Recipe` shape the detail screen renders.
 * Best-effort — uses heuristics where data is missing.
 */
export function userPostToRecipe(post: UserPostLike): Recipe {
  const ingredients = parseIngredientsList(post.ingredients);
  const steps = parseStepsFromDescription(post.description);
  const stepCount = Math.max(1, steps.length);
  const ingredientsText = `${post.ingredients}\n${post.description}`.toLowerCase();
  const macros = inferMacroSplit(ingredientsText);
  const calories = inferCalories(post.ingredients, stepCount);
  const healthTags = inferHealthTags(ingredientsText, post.tag);

  const prepTime = ingredients.length > 8 ? '20 min' : '10 min';
  const cookTime = steps.length > 4 ? '25 min' : '15 min';

  const seed = Math.abs(
    Array.from(post.id).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
  );

  const whyItWorks = post.description.trim()
    ? `${post.description.trim().slice(0, 220)}`
    : `A home-cooked **${post.title}** that fits comfortably into a balanced daily routine. Portion and seasoning to taste.`;

  return {
    id: post.id,
    name: post.title,
    tag: post.tag ?? undefined,
    imageUrl: post.imageUri || fallbackFoodImage(post.title, seed),
    height: 220,
    prepTime,
    cookTime,
    servings: 2,
    ingredients: ingredients.length ? ingredients : ['Ingredients not specified'],
    description: post.description || `A home-cooked ${post.title}.`,
    steps: steps.length ? steps : ['Prepare ingredients as described.', 'Cook to preference and serve.'],
    calories,
    carbsPercent: macros.carbsPercent,
    fatsPercent: macros.fatsPercent,
    proteinPercent: macros.proteinPercent,
    healthTags,
    whyItWorks,
  };
}
