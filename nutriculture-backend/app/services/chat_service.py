"""Claude API integration for the NuTradish conversational chatbot."""

from __future__ import annotations

import asyncio
import json
import random
import re
import logging
import time
from typing import Optional, Tuple

import anthropic
from fastapi import HTTPException, status

from app.config import get_settings
from app.models.chat import ChatMessage, RecipeMacros, RecipePayload

logger = logging.getLogger(__name__)

MODEL_TEXT = "claude-sonnet-4-6"
MAX_TOKENS_TEXT = 600
MAX_TOKENS_RECIPE = 1400
MAX_TOKENS_MEAL_PLAN = 3200
TEMPERATURE = 0.7
MAX_HISTORY_MESSAGES = 8  # keep last N turns to stay within context limits

_BASE_SYSTEM_PROMPT = """You are NuTradish, a friendly and knowledgeable cultural nutrition assistant. \
You help users eat healthily while honouring their cultural food traditions. \
You offer practical, personalised advice on nutrition, meal planning, ingredients, and cooking techniques \
rooted in diverse culinary heritages. You speak warmly, avoid jargon, and always respect the user's \
cultural identity. If asked about medical conditions, recommend consulting a healthcare professional \
while still providing general nutritional context. \
Focus on giving healthy, actionable meal advice — do not ask the user for information already known from their profile."""

# Kept for contexts where no profile is available
SYSTEM_PROMPT = _BASE_SYSTEM_PROMPT

_CONDITION_RULES: dict[str, str] = {
    "diabetesI": (
        "Type 1 Diabetes: keep carbohydrates ≤ 45% of total calories; "
        "prioritise low-GI foods; dietary fibre ≥ 30g/day; protein 25–30% of calories."
    ),
    "diabetesII": (
        "Type 2 Diabetes: keep carbohydrates ≤ 40% of total calories; "
        "prioritise low-GI foods; dietary fibre ≥ 30g/day; protein 25–30% of calories."
    ),
    "hypertension": (
        "Hypertension: sodium < 1500mg/day; potassium ≥ 3500mg/day; "
        "avoid processed or heavily salted foods."
    ),
    "heart_disease": (
        "Heart Disease: saturated fat < 7% of total calories; total fat ≤ 25% of calories; "
        "dietary fibre ≥ 25g/day; avoid trans fats, coconut oil, palm oil, full-fat dairy."
    ),
    "celiac_disease": (
        "Celiac Disease: ALL ingredients must be strictly gluten-free — "
        "no wheat, barley, rye, spelt, or cross-contaminated oats."
    ),
    "obesity": (
        "Obesity: apply a 10–15% caloric deficit from TDEE; prioritise high-volume, "
        "low-calorie foods; fibre ≥ 30g/day; avoid refined sugar and highly processed foods."
    ),
    "osteoporosis": (
        "Osteoporosis: calcium ≥ 1200mg/day; vitamin D ≥ 800 IU/day; "
        "include dairy, leafy greens, fortified foods; limit sodium and caffeine."
    ),
}

_DIET_RULES: dict[str, str] = {
    "halal": "All meat must be halal-certified. No pork or alcohol-based ingredients.",
    "kosher": "All food must be kosher. No mixing of meat and dairy. No pork or shellfish.",
    "vegan": "Strictly vegan — no meat, poultry, fish, dairy, eggs, honey, or gelatin.",
    "vegetarian": "Vegetarian — no meat, poultry, or fish. Dairy and eggs are permitted.",
}


def _build_personalized_system_prompt(profile: dict) -> str:
    """Build a system prompt that includes the user's onboarding profile context.

    Instructs Claude not to ask for any information already captured during
    onboarding, and to always respect the user's health and dietary constraints.
    """
    sections: list[str] = [_BASE_SYSTEM_PROMPT]

    profile_lines: list[str] = []

    # Health conditions
    conditions: list[str] = [c for c in (profile.get("health_conditions") or []) if c and c != "other"]
    if conditions:
        profile_lines.append("Health conditions and constraints:")
        for cond in conditions:
            rule = _CONDITION_RULES.get(cond)
            label = cond.replace("_", " ").title()
            profile_lines.append(f"  - {label}: {rule}" if rule else f"  - {label}: apply general clinical guidelines.")

    # Allergens
    allergens: list[str] = profile.get("allergens") or []
    if allergens:
        allergen_str = ", ".join(a.replace("_", " ").title() for a in allergens)
        profile_lines.append(
            f"Allergens — NEVER suggest these or any derivatives: {allergen_str}."
        )

    # Dietary preferences
    diet_prefs: list[str] = [p for p in (profile.get("diet_preferences") or []) if p and p != "none"]
    if diet_prefs:
        diet_str = ", ".join(p.title() for p in diet_prefs)
        rules = [_DIET_RULES[p] for p in diet_prefs if p in _DIET_RULES]
        profile_lines.append(f"Dietary preferences: {diet_str}.")
        for rule in rules:
            profile_lines.append(f"  - {rule}")

    # Cuisine preferences
    cuisines: list[str] = profile.get("cuisines") or []
    if cuisines:
        cuisine_str = ", ".join(c.replace("_", " ").title() for c in cuisines)
        profile_lines.append(f"Preferred cuisines: {cuisine_str}. Draw meal suggestions from these traditions.")

    # Macro targets
    macro_targets: dict = profile.get("macro_targets") or {}
    tdee = profile.get("tdee")
    if macro_targets or tdee:
        macro_parts: list[str] = []
        if tdee:
            macro_parts.append(f"{int(tdee)} kcal/day")
        for key in ("protein_g", "carbs_g", "fat_g", "fiber_g"):
            val = macro_targets.get(key)
            if val is not None:
                macro_parts.append(f"{key.replace('_g', '').title()} {val}g")
        if macro_parts:
            profile_lines.append(f"Daily targets: {', '.join(macro_parts)}.")

    if profile_lines:
        context_block = (
            "\n\n## This User's Profile\n"
            "The user completed onboarding. DO NOT ask them for any of the following — it is already known:\n"
            + "\n".join(profile_lines)
            + "\n\nAlways ensure every meal suggestion and recipe respects all of the above constraints."
        )
        sections.append(context_block)

    return "".join(sections)

RECIPE_JSON_INSTRUCTIONS = """The user is asking for ONE dish. Respond in STRICT JSON ONLY.

CRITICAL: Your response MUST start with `{` and end with `}`. Do NOT wrap it in ```json fences. Do NOT write any prose before or after the JSON.

Return an object with exactly these keys:
{
  "response": string,
  "recipe": {
    "title": string,
    "summary": string,
    "ingredients": string[],
    "steps": string[],
    "macros": {
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number
    },
    "health_tags": string[],
    "why_this_works": string
  }
}

Rules:
- Output MUST be valid JSON. No markdown, no backticks, no code fences.
- EXACTLY ONE dish. Ingredients and steps describe a single dish only.
- The "title" is the plain dish name, NOTHING ELSE. Forbidden in the title:
  * Meal-type prefixes like "Breakfast:", "Lunch:", "Dinner:", "Snack:"
  * Multiple dishes separated by "|", "/", "+", "and", or commas
  * Parentheticals like "(Breakfast)" or "(Day 1)"
  Example GOOD title: "Ragi Dosa with Coconut-Coriander Chutney"
  Example BAD titles: "Breakfast: Ragi Dosa", "Ragi Dosa | Tofu Matar | Palak Paneer"
- If the user just asked for a meal-plan earlier in the conversation and is now asking for "another one" or similar, interpret that as: pick ONE NEW dish (not a whole new meal plan).
- Macros must be integer estimates (best-effort) for the single dish.
- health_tags: 3-6 short pills (max 3 words each) describing why this dish fits the user's profile — e.g. "Low Sodium", "Low Glycemic", "Heart Healthy", "High Fiber", "Diabetic-Friendly", "High Potassium", "Plant Protein". Base them on the user's conditions and the dish's nutrition.

VARIETY — NON-NEGOTIABLE (read carefully):

STEP 1 — Internally brainstorm AT LEAST FIVE candidate dishes that fit the user's profile. Do this silently before writing any JSON. Think broadly across cuisines, proteins, cooking methods, and carb bases.

STEP 2 — Rank your candidates from MOST stereotypical/canonical (#1) to MOST surprising and varied (#5). The #1 dish is the one most people would guess — the safe, obvious default for this profile. Do NOT pick #1 or #2. Choose from candidates #3 to #5.

STEP 3 — Sanity-check your pick against these rules:
- It MUST differ from prior suggestions (in the exclusion list and conversation history) on at least TWO axes: (a) primary protein source, (b) cuisine / regional tradition, (c) cooking method (stew vs grill vs stir-fry vs baked vs raw vs fermented), (d) carbohydrate base.
- If the user is Vegan or restricted, use the FULL breadth available: legumes beyond chickpeas/lentils (edamame, tempeh, tofu, black beans, lupini, soy curls, tepary, pigeon peas, adzuki), whole grains beyond rice/roti (millet, sorghum, fonio, teff, amaranth, buckwheat, freekeh), and vegetable-forward preparations (stuffed, roasted, grilled, raw, fermented, pickled).
- Rotate across cuisines liberally: West African, East African, Mediterranean, Levantine, Persian, Caribbean, Mexican, Ethiopian, Indonesian, Japanese, Korean, Andean — provided the user hasn't opted out.
- Never suggest a trivial variant of an already-suggested dish (e.g. "Chana Dal" → "Moong Dal" is NOT enough variation; "Moong Chilla" → "Besan Chilla" is NOT enough either).
- Treat the same dish name with different chutneys / sides / garnishes as the SAME dish. Pick something structurally different.

If you catch yourself about to suggest the first dish that came to mind — stop, throw it out, and pick a different candidate. Be genuinely creative, the way Claude responds in a normal free-form chat.
"""

MEAL_PLAN_JSON_INSTRUCTIONS = """The user is asking for multiple meals (full day / breakfast + lunch + dinner).

Return THREE complete, distinct recipes (breakfast, lunch, dinner) in STRICT JSON ONLY.

CRITICAL: Your response MUST start with `{` and end with `}`. No code fences, no prose, no markdown.

Return an object with exactly this shape:
{
  "response": string,
  "meals": [
    {
      "meal_type": "breakfast",
      "title": string,
      "summary": string,
      "ingredients": string[],
      "steps": string[],
      "macros": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number },
      "health_tags": string[],
      "why_this_works": string
    },
    { "meal_type": "lunch", ...same shape },
    { "meal_type": "dinner", ...same shape }
  ]
}

Rules:
- Exactly 3 meals: one breakfast, one lunch, one dinner — in that order.
- All three meals must differ from each other AND from any dish in the exclusion list on at least TWO axes: (1) primary protein source, (2) cuisine, (3) cooking method, (4) carb base.
- Never repeat a dish (or trivial variant of a dish) from the exclusion list in the system prompt.
- Macros must be integer estimates.
- Keep ingredients and steps concise but complete (8-12 ingredients, 4-7 steps per meal).
- health_tags: 3-6 short pills per meal (e.g. "Low Sodium", "High Fiber", "Diabetic-Friendly").
- The top-level "response" is a single friendly sentence introducing the three meals.

VARIETY — NON-NEGOTIABLE:
- Before writing any JSON, internally brainstorm 5+ candidates for EACH meal slot and reject the two most stereotypical/canonical ones. Pick genuinely surprising options.
- The three meals must span three different cuisines / traditions AND three different primary proteins AND three different cooking methods. No repetition across the day.
- If you catch yourself defaulting to a classic combo like moong dal + roti + stir-fry, stop and pick something more adventurous that still honours the user's constraints.
"""


def _trim_history(history: list[ChatMessage]) -> list[ChatMessage]:
    """Return the most recent MAX_HISTORY_MESSAGES messages."""
    return history[-MAX_HISTORY_MESSAGES:]


def _get_client() -> anthropic.AsyncAnthropic:
    """Return a cached Anthropic client for connection pooling."""
    settings = get_settings()
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def _looks_like_multi_meal_request(message: str) -> bool:
    """True for requests that span multiple meals (full day, breakfast + lunch + dinner)."""
    m = message.lower()
    if "meal plan" in m or "full day" in m or "whole day" in m or "all three meals" in m:
        return True
    meal_keywords = ["breakfast", "lunch", "dinner", "snack"]
    hits = sum(1 for k in meal_keywords if k in m)
    return hits >= 2


# Follow-up phrases the user says when they want a NEW dish instead of the last one.
_FOLLOWUP_PHRASES = [
    "different",
    "another",
    "something else",
    "anything else",
    "try again",
    "new one",
    "new option",
    "other option",
    "swap this",
    "not this",
    "don't like",
    "do not like",
    "change it",
    "change this",
    "alternative",
    "variety",
    "surprise me",
    "more options",
]


def _is_followup_request(message: str, has_prior_recipe: bool) -> bool:
    """True if the user is asking for a *different* recipe than the last one."""
    if not has_prior_recipe:
        return False
    m = message.lower()
    return any(p in m for p in _FOLLOWUP_PHRASES)


def _looks_like_recipe_request(message: str, has_prior_recipe: bool = False) -> bool:
    """True for single-dish recipe requests."""
    if _looks_like_multi_meal_request(message):
        return False
    if _is_followup_request(message, has_prior_recipe):
        return True
    m = message.lower()
    keywords = [
        "suggest",
        "recipe",
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "meal",
        "dish",
        "substitute",
        "swap",
        "adapt",
        "make",
        "cook",
        "give me",
        "generate",
        "show me",
        "idea",
        "what should i eat",
        "what can i eat",
        "hungry",
    ]
    return any(k in m for k in keywords)


def _extract_json_object(raw: str) -> Optional[str]:
    """Extract the first balanced {...} JSON object from ``raw``.

    Tolerates Markdown code fences (```json ... ```), leading/trailing prose,
    and single backticks that Claude occasionally emits even when instructed
    not to.
    """
    if not raw:
        return None
    text = raw.strip()
    # Strip common code-fence wrappers
    if text.startswith("```"):
        text = text.lstrip("`")
        # Optionally drop a leading "json\n" language tag
        if text[:4].lower() == "json":
            text = text[4:]
        text = text.strip()
        if text.endswith("```"):
            text = text[: -3].rstrip()
    # Find the first balanced JSON object
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    return None


def _int_or_none(v):
    if isinstance(v, (int, float)):
        return int(v)
    return None


_MEAL_PREFIX_RE = re.compile(
    r"^\s*(?:breakfast|lunch|dinner|snack|brunch|dessert|appetizer|side)\s*[:\-–—]\s*",
    re.IGNORECASE,
)


def _clean_single_dish_title(title: str) -> str:
    """Strip meal-type prefixes and compound-title artefacts from a single dish title.

    Examples:
      "Breakfast: Ragi Dosa"                       -> "Ragi Dosa"
      "Ragi Dosa | Tofu Matar | Palak Paneer"     -> "Ragi Dosa"
      "Breakfast: Ragi Dosa / Tofu Matar Masala"  -> "Ragi Dosa"
      "(Breakfast) Ragi Dosa"                      -> "Ragi Dosa"
    """
    t = title.strip()
    # Drop leading "(Breakfast)" / "[Day 1]" style parentheticals.
    t = re.sub(r"^[\(\[\{]\s*(?:breakfast|lunch|dinner|snack|day\s*\d+)\s*[\)\]\}]\s*", "", t, flags=re.IGNORECASE)
    # Drop leading "Breakfast:" / "Lunch -" etc.
    t = _MEAL_PREFIX_RE.sub("", t)
    # If Claude crammed multiple dishes with a pipe/slash, keep only the first
    # and drop any trailing meal labels.
    for sep in ("|", " / ", " — ", " – "):
        if sep in t:
            t = t.split(sep, 1)[0].strip()
    # Strip again in case the first segment itself had a prefix.
    t = _MEAL_PREFIX_RE.sub("", t).strip()
    return t or title.strip()


def _build_recipe_payload(recipe: dict, title_prefix: str = "") -> Optional[RecipePayload]:
    """Validate a raw recipe dict and convert it into a RecipePayload."""
    if not isinstance(recipe, dict):
        return None
    title = recipe.get("title")
    summary = recipe.get("summary")
    ingredients = recipe.get("ingredients")
    steps = recipe.get("steps")
    why = recipe.get("why_this_works")
    macros = recipe.get("macros")
    health_tags = recipe.get("health_tags")

    if not isinstance(title, str) or not isinstance(summary, str):
        return None
    if not isinstance(ingredients, list) or not all(isinstance(i, str) for i in ingredients):
        return None
    if not isinstance(steps, list) or not all(isinstance(s, str) for s in steps):
        return None

    # Clean the raw title. Meal-plan calls pass their own prefix (Breakfast:, etc.)
    # — we still want to strip any prefix Claude put on the inner title so we
    # don't end up with "Breakfast: Breakfast: Ragi Dosa".
    title = _clean_single_dish_title(title)

    tags_list: list[str] = []
    if isinstance(health_tags, list):
        tags_list = [str(t) for t in health_tags if isinstance(t, str) and t.strip()]

    macros_obj: Optional[RecipeMacros] = None
    if isinstance(macros, dict):
        macros_obj = RecipeMacros(
            calories=_int_or_none(macros.get("calories")),
            protein_g=_int_or_none(macros.get("protein_g")),
            carbs_g=_int_or_none(macros.get("carbs_g")),
            fat_g=_int_or_none(macros.get("fat_g")),
            fiber_g=_int_or_none(macros.get("fiber_g")),
        )

    display_title = f"{title_prefix}{title}" if title_prefix else title

    return RecipePayload(
        title=display_title,
        summary=summary,
        ingredients=ingredients,
        steps=steps,
        macros=macros_obj,
        health_tags=tags_list,
        why_this_works=why if isinstance(why, str) else None,
    )


def _parse_recipe_json(raw: str) -> Optional[Tuple[str, RecipePayload]]:
    candidate = _extract_json_object(raw) or raw
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None

    response = data.get("response")
    recipe = data.get("recipe")
    if not isinstance(response, str):
        return None
    payload = _build_recipe_payload(recipe)
    if payload is None:
        return None
    return response, payload


_MEAL_LABEL = {"breakfast": "Breakfast: ", "lunch": "Lunch: ", "dinner": "Dinner: "}


def _parse_meal_plan_json(raw: str) -> Optional[Tuple[str, list[RecipePayload]]]:
    candidate = _extract_json_object(raw) or raw
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None

    response = data.get("response")
    meals = data.get("meals")
    if not isinstance(response, str) or not isinstance(meals, list):
        return None

    payloads: list[RecipePayload] = []
    for m in meals:
        if not isinstance(m, dict):
            continue
        meal_type = str(m.get("meal_type", "")).lower().strip()
        prefix = _MEAL_LABEL.get(meal_type, "")
        payload = _build_recipe_payload(m, title_prefix=prefix)
        if payload:
            payloads.append(payload)

    if len(payloads) < 2:
        return None
    return response, payloads


# A rotating palette of stylistic "nudges" that we inject into every recipe
# request. One is picked at random per turn so the LLM is pushed away from
# defaulting to the single most-canonical dish for the user's profile.
_STYLE_NUDGES: list[str] = [
    "Lean into a technique that isn't just simmering or boiling — think grilled, charred, roasted, steamed en papillote, raw/ceviche-style, fermented, pickled, stuffed, or griddled.",
    "Center the dish on a whole grain you haven't suggested recently: millet, sorghum, fonio, teff, buckwheat, freekeh, farro, amaranth, black rice, or quinoa.",
    "Build the meal around a legume that is NOT the obvious one — edamame, black-eyed peas, pigeon peas, lupini beans, tempeh, soy curls, adzuki, mung sprouts, cannellini, or fava — instead of the default moong/toor/chana.",
    "Draw inspiration from a cuisine you haven't visited this session: West African, East African, Levantine, Persian, Caribbean, Oaxacan, Korean, Indonesian, Filipino, or Andean.",
    "Make it hand-held or wrapped — a lettuce cup, a dosa, a flatbread roll, a rice-paper parcel, a stuffed pepper, a lavash wrap, or a bao.",
    "Center a vibrant vegetable (eggplant, okra, bitter melon, plantain, yuca, jackfruit, kabocha, cassava leaf, mustard greens) as the hero instead of a supporting role.",
    "Make it a cold or room-temperature preparation — salad-forward, grain bowls, ceviche-style, chilled soups, or platter-style mezze.",
    "Use a fermented / tangy element (miso, tamarind, sumac, kimchi, sauerkraut, yogurt, pickled mustard greens, fermented beans, preserved lemon) to give the dish depth.",
    "Try a fusion approach that respectfully crosses two of the user's preferred traditions (e.g. an Indo-Nigerian dish, an Ethiopian-Mediterranean mezze, a Japanese-Levantine bowl).",
    "Pick something street-food-inspired (chaat, jollof-style, tacos, banh mi-style, arepas, injera wraps, kebab bowls) rather than a homey stew.",
    "Highlight a seed or nut-adjacent protein (hemp, pumpkin seeds, sunflower seeds, sesame, flax) as a real macronutrient contributor, not a garnish.",
    "Showcase a regional specialty rather than a pan-regional staple (e.g. Hyderabadi vs 'Indian', Yoruba vs 'Nigerian', Sicilian vs 'Italian').",
]


def _pick_style_nudge() -> str:
    """Pick one rotating style nudge to inject into the system prompt."""
    return random.choice(_STYLE_NUDGES)


def _build_exclusion_block(excluded_titles: list[str]) -> str:
    """Render the 'do not repeat' block injected into the system prompt."""
    cleaned = [t.strip() for t in excluded_titles if isinstance(t, str) and t.strip()]
    # Dedupe while preserving order; also strip meal-type prefixes like "Breakfast: "
    seen = set()
    deduped: list[str] = []
    for t in cleaned:
        base = t.split(":", 1)[1].strip() if ":" in t and t.split(":", 1)[0].strip().lower() in {"breakfast", "lunch", "dinner", "snack"} else t
        if base.lower() in seen:
            continue
        seen.add(base.lower())
        deduped.append(base)
    if not deduped:
        return ""
    bullets = "\n".join(f"- {t}" for t in deduped[-25:])
    return (
        "\n\nIMPORTANT — VARIETY RULE:\n"
        "The user has already seen the following dishes in this session. "
        "You MUST NOT suggest any of these again, and you must avoid minor variants "
        "(e.g. if 'Methi Chana Dal' is listed, do not suggest 'Toor Dal' either — "
        "pick a genuinely different protein source, cooking method, or cuisine). "
        "Prioritise NOVELTY over familiarity:\n"
        f"{bullets}"
    )


async def get_chat_response(
    message: str,
    conversation_history: list[ChatMessage],
    user_profile: Optional[dict] = None,
    excluded_titles: Optional[list[str]] = None,
) -> tuple[str, list[ChatMessage], str, Optional[RecipePayload], Optional[list[RecipePayload]]]:
    """Send a user message to Claude and return the reply with updated history.

    Args:
        message: The user's latest message.
        conversation_history: Prior turns (may be empty for a new conversation).
        user_profile: Optional dict of the user's onboarding profile. When
            provided, dietary restrictions, allergens, health conditions, and
            cuisine preferences are injected into the system prompt so Claude
            never re-asks for information the user already supplied.

    Returns:
        Tuple of (assistant_reply, updated_conversation_history, kind, recipe_payload).

    Raises:
        HTTPException: 504 on timeout, 503 on connectivity error, 502 on API error.
    """
    settings = get_settings()
    client = _get_client()

    base_system_prompt = (
        _build_personalized_system_prompt(user_profile)
        if user_profile
        else SYSTEM_PROMPT
    )
    exclusion_block = _build_exclusion_block(excluded_titles or [])
    system_prompt = base_system_prompt + exclusion_block

    trimmed = _trim_history(conversation_history)
    messages = [{"role": m.role, "content": m.content} for m in trimmed]
    messages.append({"role": "user", "content": message})

    has_prior_recipe = bool(excluded_titles)
    # Follow-ups ("different / another / something else") get extra creativity.
    is_followup = _is_followup_request(message, has_prior_recipe)

    recipe_payload: Optional[RecipePayload] = None
    recipes_payload: Optional[list[RecipePayload]] = None
    try:
        t0 = time.perf_counter()
        if _looks_like_multi_meal_request(message):
            style_nudge = _pick_style_nudge()
            multi_system_prompt = (
                f"{system_prompt}\n\n{MEAL_PLAN_JSON_INSTRUCTIONS}"
                f"\n\nTHIS TURN'S STYLE ANGLE (apply to at least one of the three meals): {style_nudge}"
            )
            raw = await asyncio.wait_for(
                _call_claude(
                    client,
                    messages,
                    model=MODEL_TEXT,
                    system_prompt=multi_system_prompt,
                    temperature=1.0 if is_followup else 0.95,
                    max_tokens=MAX_TOKENS_MEAL_PLAN,
                ),
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            parsed = _parse_meal_plan_json(raw)
            if parsed:
                reply, recipes_payload = parsed
                kind = "meal_plan"
            else:
                # Fallback: show what we got so the user isn't left with a blank screen
                reply = raw
                kind = "text"
        elif _looks_like_recipe_request(message, has_prior_recipe=has_prior_recipe):
            style_nudge = _pick_style_nudge()
            recipe_system_prompt = (
                f"{system_prompt}\n\n{RECIPE_JSON_INSTRUCTIONS}"
                f"\n\nTHIS TURN'S STYLE ANGLE (weave it in naturally): {style_nudge}"
                "\n\nKeep responses concise."
            )
            raw = await asyncio.wait_for(
                _call_claude(
                    client,
                    messages,
                    model=MODEL_TEXT,
                    system_prompt=recipe_system_prompt,
                    temperature=1.0 if is_followup else 0.95,
                    max_tokens=MAX_TOKENS_RECIPE,
                ),
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            parsed = _parse_recipe_json(raw)
            if parsed:
                reply, recipe_payload = parsed
                kind = "recipe"
            else:
                reply = raw
                kind = "text"
        else:
            reply = await asyncio.wait_for(
                _call_claude(
                    client,
                    messages,
                    model=MODEL_TEXT,
                    system_prompt=system_prompt,
                    max_tokens=MAX_TOKENS_TEXT,
                ),
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            kind = "text"
        dt_ms = int((time.perf_counter() - t0) * 1000)
        logger.info("chat_service.get_chat_response kind=%s ms=%s history=%s", kind, dt_ms, len(trimmed))
    except asyncio.TimeoutError:
        logger.error(
            "Claude timed out after %s s during chat.", settings.LLM_TIMEOUT_SECONDS
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "error": "AI service timed out",
                "code": "LLM_TIMEOUT",
                "detail": (
                    f"Chat response exceeded {settings.LLM_TIMEOUT_SECONDS} s. "
                    "Please try again."
                ),
            },
        )

    updated_history = list(trimmed) + [
        ChatMessage(role="user", content=message),
        ChatMessage(role="assistant", content=reply),
    ]
    return reply, updated_history, kind, recipe_payload, recipes_payload


async def _call_claude(
    client: anthropic.AsyncAnthropic,
    messages: list[dict],
    model: str,
    system_prompt: str = SYSTEM_PROMPT,
    temperature: float = TEMPERATURE,
    max_tokens: int = MAX_TOKENS_TEXT,
) -> str:
    """Send a multi-turn message list to Claude and return the raw text reply.

    Args:
        client: Initialised AsyncAnthropic client.
        messages: Full message list including the latest user turn.

    Returns:
        Raw text content of Claude's reply.

    Raises:
        HTTPException: 503 on connection error, 502 on other API errors.
    """
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text
    except anthropic.APIConnectionError as exc:
        logger.error("Anthropic API connection error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "AI service unavailable",
                "code": "LLM_CONNECTION_ERROR",
                "detail": str(exc),
            },
        ) from exc
    except anthropic.APIError as exc:
        logger.error("Anthropic API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": "AI service error",
                "code": "LLM_API_ERROR",
                "detail": str(exc),
            },
        ) from exc
