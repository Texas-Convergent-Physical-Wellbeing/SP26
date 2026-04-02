"""Cooking skill level enum controlling recipe complexity in generated plans."""

from enum import Enum


class SkillLevel(str, Enum):
    """Cooking skill levels that affect recipe complexity, prep time, and technique."""

    Beginner = "beginner"
    # Max 8 ingredients, ≤30 min prep, no special equipment,
    # store-bought shortcuts flagged when shortcut_mode=True

    Intermediate = "intermediate"
    # Up to 15 ingredients, ≤60 min prep, basic equipment (blender, etc.)

    Advanced = "advanced"
    # No limits — complex techniques, overnight marinades, spice grinding welcome
