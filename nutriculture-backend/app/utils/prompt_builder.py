"""Builds structured LLM prompts for meal plan generation from user profiles."""

from __future__ import annotations

import json

from app.constants.conditions import HealthCondition

# ---------------------------------------------------------------------------
# Condition-specific constraint descriptions injected into the prompt
# ---------------------------------------------------------------------------

_CONDITION_RULES: dict[str, str] = {
    HealthCondition.Type2Diabetes.value: (
        "Type 2 Diabetes: keep carbohydrates ≤ 40 % of total calories; "
        "prioritise low-GI foods; dietary fibre ≥ 30 g/day; "
        "protein 25–30 % of calories. Include glycemic_notes for every meal."
    ),
    HealthCondition.Hypertension.value: (
        "Hypertension: sodium < 1500 mg/day total across all meals; "
        "potassium ≥ 3500 mg/day; avoid processed / heavily salted foods."
    ),
    HealthCondition.PCOS.value: (
        "PCOS: apply a 10–15 % caloric deficit from TDEE; "
        "prioritise low-GI complex carbohydrates; fibre ≥ 30 g/day; "
        "avoid refined sugar and high-glycaemic ingredients. "
        "Include glycemic_notes for every meal."
    ),
    HealthCondition.HighCholesterol.value: (
        "High Cholesterol: saturated fat < 7 % of total calories; "
        "total fat ≤ 25 % of calories; dietary fibre ≥ 25 g/day; "
        "avoid trans fats, coconut oil, palm oil, full-fat dairy."
    ),
    HealthCondition.Celiac.value: (
        "Celiac Disease: ALL ingredients must be strictly gluten-free. "
        "No wheat, barley, rye, spelt, kamut, triticale, or cross-contaminated oats. "
        "Use certified gluten-free alternatives (e.g. rice flour, buckwheat, quinoa)."
    ),
    HealthCondition.KidneyDisease.value: (
        "Kidney Disease: total protein ≤ 0.8 g per kg of body weight per day; "
        "potassium < 2000 mg/day; phosphorus < 800 mg/day; "
        "avoid high-potassium foods (bananas, tomatoes, potatoes, oranges in large amounts); "
        "avoid processed meats, cola, dairy in excess."
    ),
}

# ---------------------------------------------------------------------------
# JSON schema the LLM must follow — embedded verbatim in the prompt
# ---------------------------------------------------------------------------

_MEAL_SCHEMA = {
    "meal_type": "<breakfast|lunch|dinner>",
    "dish_name": "<culturally authentic adapted dish name>",
    "cuisine_tag": "<one of the user's preferred cuisines>",
    "original_dish": "<name of the traditional unmodified dish>",
    "adapted_dish": "<description of how it was modified>",
    "why_this_works": "<1–2 sentence clinical rationale>",
    "ingredients": [
        {"name": "<ingredient>", "quantity": "<number>", "unit": "<g|ml|tsp|tbsp|cup|piece|…>"}
    ],
    "macros": {
        "calories": "<kcal>",
        "protein_g": "<g>",
        "carbs_g": "<g>",
        "fat_g": "<g>",
        "fiber_g": "<g>",
    },
    "micros": {
        "sodium_mg": "<mg>",
        "potassium_mg": "<mg>",
        "iron_mg": "<mg>",
        "calcium_mg": "<mg>",
        "vitamin_c_mg": "<mg>",
    },
    "glycemic_notes": "<string or null>",
    "portion_size": "<e.g. '1 bowl (~350 g)'>",
}

_RESPONSE_SCHEMA = {"meals": [_MEAL_SCHEMA, _MEAL_SCHEMA, _MEAL_SCHEMA]}


def build_meal_plan_prompt(user_profile: dict, plan_date: str) -> str:
    """Construct the full structured prompt for Claude meal plan generation.

    Args:
        user_profile: Dict representation of the user's stored profile,
            including demographics, conditions, allergens, cuisines, diet
            preferences, TDEE, and macro_targets.
        plan_date: ISO-8601 date string for the plan (e.g. ``"2025-07-15"``).

    Returns:
        A single string prompt ready to send to the Claude API.
    """
    sections = [
        _build_header(user_profile, plan_date),
        _build_conditions_section(user_profile),
        _build_allergen_section(user_profile),
        _build_diet_section(user_profile),
        _build_cuisine_section(user_profile),
        _build_macro_section(user_profile),
        _build_output_instructions(),
    ]
    return "\n\n".join(s for s in sections if s)


# ---------------------------------------------------------------------------
# Private section builders
# ---------------------------------------------------------------------------


def _build_header(profile: dict, plan_date: str) -> str:
    """Render the demographic / TDEE preamble."""
    tdee = profile.get("tdee") or "unknown"
    return (
        f"You are a clinical dietitian and culturally-aware chef. "
        f"Generate a personalised daily meal plan for {plan_date}.\n\n"
        f"## User Demographics\n"
        f"- Sex: {profile.get('sex', 'not specified')}\n"
        f"- Age: {profile.get('age', 'not specified')} years\n"
        f"- Weight: {profile.get('weight_kg', 'not specified')} kg\n"
        f"- Height: {profile.get('height_cm', 'not specified')} cm\n"
        f"- TDEE: {tdee} kcal/day"
    )


def _build_conditions_section(profile: dict) -> str:
    """List all active health conditions with their clinical constraints."""
    conditions: list[str] = profile.get("health_conditions", [])
    active = [
        c for c in conditions
        if c and c != HealthCondition.NoneCondition.value
    ]
    if not active:
        return "## Health Conditions\nNo active health conditions."

    lines = ["## Health Conditions & Dietary Constraints"]
    for cond in active:
        rule = _CONDITION_RULES.get(cond)
        if rule:
            lines.append(f"- **{cond.replace('_', ' ').title()}**: {rule}")
        else:
            lines.append(f"- {cond.replace('_', ' ').title()}: apply general guidelines.")
    return "\n".join(lines)


def _build_allergen_section(profile: dict) -> str:
    """Emit hard 'NEVER include' rules for every listed allergen."""
    allergens: list[str] = profile.get("allergens", [])
    if not allergens:
        return "## Allergens\nNo allergens declared."

    allergen_list = ", ".join(a.replace("_", " ").title() for a in allergens)
    return (
        "## Allergen Restrictions — HARD RULES\n"
        f"The user is allergic to: **{allergen_list}**.\n"
        "NEVER include any of these allergens or derivatives in any ingredient, "
        "sauce, marinade, garnish, or cooking medium. "
        "Cross-contamination warnings must also be avoided."
    )


def _build_diet_section(profile: dict) -> str:
    """State all active dietary preferences."""
    prefs: list[str] = profile.get("diet_preferences", [])
    active = [p for p in prefs if p and p != "none"]
    if not active:
        return ""

    pref_list = ", ".join(p.title() for p in active)
    rules = []
    if "halal" in active:
        rules.append("All meat must be halal-certified. No pork or alcohol-based ingredients.")
    if "kosher" in active:
        rules.append("All food must be kosher. No mixing of meat and dairy. No pork or shellfish.")
    if "vegan" in active:
        rules.append("Strictly vegan — no meat, poultry, fish, dairy, eggs, honey, or gelatin.")
    if "vegetarian" in active and "vegan" not in active:
        rules.append("Vegetarian — no meat, poultry, or fish. Dairy and eggs are permitted.")

    rule_block = "\n".join(f"- {r}" for r in rules)
    return f"## Dietary Preferences\nActive: {pref_list}\n{rule_block}"


def _build_cuisine_section(profile: dict) -> str:
    """Specify cuisine preferences and the cultural adaptation mandate."""
    cuisines: list[str] = profile.get("cuisines", [])
    if not cuisines:
        cuisine_str = "any culturally diverse cuisine"
    else:
        cuisine_str = " and ".join(c.replace("_", " ").title() for c in cuisines)

    return (
        f"## Cultural Cuisine Preferences\n"
        f"Draw dishes from: **{cuisine_str}**.\n\n"
        "IMPORTANT — Cultural authenticity mandate:\n"
        "Adapt dishes to fit all health constraints but PRESERVE their cultural identity. "
        "Name every dish authentically in its original language or common cultural name. "
        "Examples of the expected approach:\n"
        "- Jollof rice → Cauliflower Jollof Rice (low-carb adaptation)\n"
        "- Biryani → Brown Rice Biryani with reduced salt\n"
        "- Tacos → Lettuce-wrap Tacos with lean chicken\n"
        "The adapted name must signal both the cultural origin and the modification."
    )


def _build_macro_section(profile: dict) -> str:
    """Embed numeric macro targets so the LLM can distribute them across meals."""
    targets: dict = profile.get("macro_targets") or {}
    if not targets:
        return "## Daily Macro Targets\nNo macro targets computed — use clinical defaults."

    lines = ["## Daily Macro Targets (distribute across all 3 meals)"]
    for key, val in targets.items():
        label = key.replace("_", " ").title()
        lines.append(f"- {label}: {val}")
    return "\n".join(lines)


def _build_output_instructions() -> str:
    """Emit the strict JSON-only output instructions and schema."""
    schema_str = json.dumps(_RESPONSE_SCHEMA, indent=2)
    return (
        "## Output Instructions\n"
        "Respond with ONLY a valid JSON object — no prose, no markdown fences, "
        "no explanations before or after the JSON.\n\n"
        "The JSON must have exactly this structure:\n"
        f"{schema_str}\n\n"
        "Rules:\n"
        "1. Include exactly 3 meals: breakfast, lunch, dinner.\n"
        "2. All numeric fields (calories, protein_g, etc.) must be numbers, not strings.\n"
        "3. glycemic_notes must be a non-empty string for diabetes or PCOS profiles; "
        "   null otherwise.\n"
        "4. Every ingredient must have name, quantity (number), and unit (string).\n"
        "5. Verify that NO ingredient contains any of the declared allergens.\n"
        "6. Verify that the sum of meal macros approximates the daily macro targets."
    )
