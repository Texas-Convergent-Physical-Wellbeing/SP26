"""Festive event enum for culturally-aware seasonal meal planning."""

from enum import Enum


class FestiveEvent(str, Enum):
    """Supported festive modes that alter meal structure or dish selection."""

    Ramadan = "ramadan"
    # Ramadan: replaces breakfast/lunch/dinner with suhoor/iftar/light_snack
    # Caloric redistribution: suhoor ~35%, iftar ~55%, snack ~10%

    Diwali = "diwali"
    Eid = "eid"
    LunarNewYear = "lunar_new_year"
    Passover = "passover"
    Navratri = "navratri"
    Christmas = "christmas"
    # Christmas here refers to Caribbean/West African Christmas traditions
