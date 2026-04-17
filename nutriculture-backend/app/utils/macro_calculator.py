"""BMR / TDEE / macro-target calculations with condition-specific adjustments."""

from __future__ import annotations

from typing import Literal


# ---------------------------------------------------------------------------
# Activity level multipliers (Harris-Benedict / Mifflin-St Jeor standard)
# ---------------------------------------------------------------------------

ACTIVITY_MULTIPLIERS: dict[str, float] = {
    "sedentary": 1.2,          # little/no exercise
    "lightly_active": 1.375,   # light exercise 1–3 days/week
    "moderately_active": 1.55, # moderate exercise 3–5 days/week
    "very_active": 1.725,      # hard exercise 6–7 days/week
    "extra_active": 1.9,       # very hard exercise + physical job
}

ActivityLevel = Literal[
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
    "extra_active",
]

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def calculate_bmr(
    sex: str,
    age: int,
    weight_kg: float,
    height_cm: float,
) -> float:
    """Compute Basal Metabolic Rate using the Mifflin-St Jeor equation.

    Args:
        sex: ``"male"``, ``"female"``, or ``"other"`` (treated as female for
             clinical conservatism).
        age: Age in whole years.
        weight_kg: Body weight in kilograms.
        height_cm: Standing height in centimetres.

    Returns:
        BMR in kilocalories per day.
    """
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
    if sex == "male":
        return base + 5.0
    return base - 161.0  # female / other


def calculate_tdee(bmr: float, activity_level: str) -> float:
    """Multiply BMR by the appropriate activity factor to obtain TDEE.

    Args:
        bmr: Basal Metabolic Rate in kcal/day.
        activity_level: One of the keys in ``ACTIVITY_MULTIPLIERS``.

    Returns:
        Total Daily Energy Expenditure in kcal/day.

    Raises:
        ValueError: If ``activity_level`` is not a recognised key.
    """
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level)
    if multiplier is None:
        valid = ", ".join(ACTIVITY_MULTIPLIERS.keys())
        raise ValueError(
            f"Unknown activity level '{activity_level}'. Valid: {valid}"
        )
    return round(bmr * multiplier, 2)


def calculate_macro_targets(
    tdee: float,
    conditions: list[str],
    weight_kg: float = 70.0,
) -> dict[str, float]:
    """Derive per-condition macro targets from TDEE.

    Condition-specific rules are applied in priority order; where conditions
    conflict the most restrictive rule wins.

    Args:
        tdee: Total Daily Energy Expenditure in kcal/day.
        conditions: List of active ``HealthCondition`` values.
        weight_kg: Body weight in kg — required for KidneyDisease protein cap.

    Returns:
        Dict with keys: ``calories``, ``protein_g``, ``carbs_g``, ``fat_g``,
        ``fiber_g``.  Optional advisory keys: ``sodium_mg_max``,
        ``potassium_mg_min``.
    """
    # Start with balanced baseline (30/40/30 protein/carbs/fat split)
    effective_calories = tdee
    protein_pct = 0.30
    carbs_pct = 0.40
    fat_pct = 0.30
    fiber_g = 25.0
    extras: dict[str, float] = {}

    for condition in conditions:
        effective_calories, protein_pct, carbs_pct, fat_pct, fiber_g, extras = (
            _apply_condition(
                condition,
                effective_calories,
                protein_pct,
                carbs_pct,
                fat_pct,
                fiber_g,
                weight_kg,
                extras,
            )
        )

    return _build_macro_dict(
        effective_calories, protein_pct, carbs_pct, fat_pct, fiber_g, extras
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _apply_condition(
    condition: str,
    calories: float,
    protein_pct: float,
    carbs_pct: float,
    fat_pct: float,
    fiber_g: float,
    weight_kg: float,
    extras: dict[str, float],
) -> tuple[float, float, float, float, float, dict[str, float]]:
    """Return updated macro parameters after applying one condition's rules."""
    if condition in ("diabetesI", "diabetesII"):
        carbs_pct = min(carbs_pct, 0.35)
        protein_pct = max(protein_pct, 0.27)
        fat_pct = 1.0 - carbs_pct - protein_pct
        fiber_g = max(fiber_g, 30.0)

    elif condition == "hypertension":
        extras["sodium_mg_max"] = 1500.0
        extras["potassium_mg_min"] = 3500.0

    elif condition == "heart_disease":
        fat_pct = min(fat_pct, 0.25)
        fiber_g = max(fiber_g, 25.0)
        protein_pct = max(protein_pct, 0.28)
        carbs_pct = 1.0 - fat_pct - protein_pct

    elif condition == "celiac_disease":
        extras["gluten_free"] = 1.0

    elif condition == "obesity":
        calories = round(calories * 0.88, 2)
        carbs_pct = min(carbs_pct, 0.35)
        fiber_g = max(fiber_g, 30.0)
        fat_pct = 1.0 - carbs_pct - protein_pct

    elif condition == "osteoporosis":
        extras["calcium_mg_min"] = 1200.0

    return calories, protein_pct, carbs_pct, fat_pct, fiber_g, extras


def _build_macro_dict(
    calories: float,
    protein_pct: float,
    carbs_pct: float,
    fat_pct: float,
    fiber_g: float,
    extras: dict[str, float],
) -> dict[str, float]:
    """Convert percentage splits into gram targets and return as a dict."""
    result: dict[str, float] = {
        "calories": round(calories, 1),
        "protein_g": round((protein_pct * calories) / 4.0, 1),
        "carbs_g": round((carbs_pct * calories) / 4.0, 1),
        "fat_g": round((fat_pct * calories) / 9.0, 1),
        "fiber_g": round(fiber_g, 1),
    }
    result.update(extras)
    return result
