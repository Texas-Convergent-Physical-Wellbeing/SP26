"""Builds structured LLM prompts for meal plan generation from user profiles."""

from __future__ import annotations

import json
from typing import Optional

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


def build_meal_plan_prompt(
    user_profile: dict,
    plan_date: str,
    taste_feedback: Optional[list[dict]] = None,
    cookbook_modifications: Optional[list[str]] = None,
) -> str:
    """Construct the full structured prompt for Claude meal plan generation.

    Args:
        user_profile: Dict representation of the user's stored profile,
            including demographics, conditions, allergens, cuisines, diet
            preferences, TDEE, macro_targets, skill_level, shortcut_mode,
            and festive event fields.
        plan_date: ISO-8601 date string for the plan (e.g. ``"2025-07-15"``).
        taste_feedback: Optional list of recent meal feedback dicts used for
            taste learning adaptation.
        cookbook_modifications: Optional list of personal modification notes
            from the user's cookbook, used to carry cooking habits forward.

    Returns:
        A single string prompt ready to send to the Claude API.
    """
    festive_event = user_profile.get("active_festive_event")

    sections = [
        _build_header(user_profile, plan_date),
        _build_conditions_section(user_profile),
        _build_allergen_section(user_profile),
        _build_diet_section(user_profile),
        _build_cuisine_section(user_profile),
        _build_macro_section(user_profile),
        _build_skill_level_section(user_profile),
        _build_festive_section(festive_event, user_profile),
        _build_taste_section(taste_feedback),
        _build_cookbook_habits_section(cookbook_modifications),
        _build_output_instructions(festive_event),
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


def _build_skill_level_section(profile: dict) -> str:
    """Emit cooking complexity constraints based on the user's skill level."""
    skill = profile.get("skill_level") or "intermediate"
    shortcut = profile.get("shortcut_mode", False)

    rules = {
        "beginner": (
            "Cooking Skill: BEGINNER. "
            "Each recipe must have ≤ 8 ingredients, ≤ 30 minutes total prep + cook time, "
            "and use only basic equipment (stovetop, oven, standard pots). "
            "Stick to simple techniques: boiling, pan-frying, baking, steaming."
        ),
        "intermediate": (
            "Cooking Skill: INTERMEDIATE. "
            "Recipes may have up to 15 ingredients and up to 60 minutes prep + cook time. "
            "Basic equipment (blender, food processor) is fine."
        ),
        "advanced": (
            "Cooking Skill: ADVANCED. "
            "No restrictions on ingredient count, prep time, or technique. "
            "Complex methods (overnight marinades, tempering whole spices, slow braises) are welcome."
        ),
    }

    section = f"## Cooking Skill Level\n{rules.get(skill, rules['intermediate'])}"

    if shortcut and skill == "beginner":
        section += (
            "\n\nSHORTCUT MODE ON: For each recipe, flag at least one ingredient or step "
            "where a store-bought alternative is acceptable "
            "(e.g. 'use store-bought curry paste instead of grinding from scratch'). "
            "Add a 'shortcut_tip' field to each meal object with this suggestion."
        )
    return section


def _build_festive_section(festive_event: Optional[str], profile: dict) -> str:
    """Emit festive mode instructions that alter meal structure or dish selection."""
    if not festive_event:
        return ""

    if festive_event == "ramadan":
        tdee = profile.get("tdee") or "unknown"
        return (
            "## Festive Mode — Ramadan\n"
            "The user is observing Ramadan. Replace the standard 3-meal structure with:\n"
            "  1. suhoor — pre-dawn meal (~35 % of daily calories). "
            "Focus on complex carbs, protein, and healthy fats for sustained energy during the fast. "
            "Avoid high-sodium foods that cause thirst.\n"
            "  2. iftar — meal to break the fast (~55 % of daily calories). "
            "Start with dates and water (traditional), then a balanced main meal. "
            "Avoid deep-fried or heavily processed iftar foods.\n"
            "  3. light_snack — optional evening snack (~10 % of daily calories). "
            "Light, nutritious, easy to digest.\n\n"
            f"Total daily calories target: {tdee} kcal (redistribute across suhoor/iftar/light_snack).\n"
            "Use meal_type values: 'suhoor', 'iftar', 'light_snack'."
        )

    festive_rules = {
        "diwali": (
            "The user is celebrating Diwali. Include at least one condition-adapted "
            "traditional Diwali dish (e.g. a lighter kheer, baked mathri, roasted chivda). "
            "Name dishes authentically. Keep standard breakfast/lunch/dinner structure."
        ),
        "eid": (
            "The user is celebrating Eid. Include at least one condition-adapted Eid dish "
            "(e.g. a lean sheer khurma, baked seviyan, low-sodium biryani). "
            "Halal guidelines apply by default during Eid."
        ),
        "lunar_new_year": (
            "The user is celebrating Lunar New Year. Include at least one traditional dish "
            "adapted for their conditions (e.g. reduced-sodium dumplings, brown rice noodle soup, "
            "steamed fish with low-sodium sauce). Keep standard meal structure."
        ),
        "passover": (
            "The user is observing Passover. All recipes must be chametz-free "
            "(no leavened wheat, barley, oat, spelt, rye). "
            "Use matzo, quinoa, or potato-based alternatives where needed."
        ),
        "navratri": (
            "The user is observing Navratri. Use only sattvic/vrat-friendly ingredients: "
            "no onion, no garlic, no regular grains (use kuttu/buckwheat, singhara/water chestnut flour, "
            "sama rice, sabudana/tapioca). Dairy is permitted."
        ),
        "christmas": (
            "The user is celebrating Christmas (Caribbean/West African tradition). "
            "Include at least one condition-adapted festive dish "
            "(e.g. lighter sorrel drink, jerk chicken with reduced sodium, black cake with less sugar, "
            "plantain with controlled portions). Keep standard meal structure."
        ),
    }

    rule = festive_rules.get(festive_event, "")
    return f"## Festive Mode — {festive_event.replace('_', ' ').title()}\n{rule}"


def _build_taste_section(taste_feedback: Optional[list[dict]]) -> str:
    """Inject recent taste feedback history so Claude can adapt to preferences."""
    if not taste_feedback:
        return ""

    lines = ["## User Taste Preferences (from recent meal feedback)"]
    lines.append(
        "Adapt the meal plan based on this history. "
        "Avoid dishes similar to skipped ones; lean toward styles of saved ones.\n"
    )
    for entry in taste_feedback:
        action = entry.get("action", "").upper()
        dish = entry.get("dish_name", "")
        cuisine = entry.get("cuisine_tag", "")
        notes = entry.get("modification_notes", "")
        line = f"- [{action}] {dish} ({cuisine})"
        if notes:
            line += f" | User modified: {notes}"
        lines.append(line)

    return "\n".join(lines)


def _build_cookbook_habits_section(modifications: Optional[list[str]]) -> str:
    """Inject personal cooking habits from the user's saved cookbook modifications."""
    if not modifications:
        return ""

    lines = ["## Personal Cooking Habits (from user's cookbook)"]
    lines.append("Apply these known preferences when generating recipes:\n")
    for note in modifications:
        lines.append(f"- {note}")
    return "\n".join(lines)


def _build_output_instructions(festive_event: Optional[str] = None) -> str:
    """Emit the strict JSON-only output instructions and schema."""
    schema_str = json.dumps(_RESPONSE_SCHEMA, indent=2)

    if festive_event == "ramadan":
        meal_rule = "Include exactly 3 meals with meal_type values: 'suhoor', 'iftar', 'light_snack'."
    else:
        meal_rule = "Include exactly 3 meals: breakfast, lunch, dinner."

    shortcut_rule = (
        "7. If shortcut_mode is active, add a 'shortcut_tip' string field to each meal.\n"
    )

    return (
        "## Output Instructions\n"
        "Respond with ONLY a valid JSON object — no prose, no markdown fences, "
        "no explanations before or after the JSON.\n\n"
        "The JSON must have exactly this structure:\n"
        f"{schema_str}\n\n"
        "Rules:\n"
        f"1. {meal_rule}\n"
        "2. All numeric fields (calories, protein_g, etc.) must be numbers, not strings.\n"
        "3. glycemic_notes must be a non-empty string for diabetes or PCOS profiles; "
        "   null otherwise.\n"
        "4. Every ingredient must have name, quantity (number), and unit (string).\n"
        "5. Verify that NO ingredient contains any of the declared allergens.\n"
        "6. Verify that the sum of meal macros approximates the daily macro targets.\n"
        f"{shortcut_rule}"
    )
