"""Diet preference enum for religious and lifestyle dietary requirements."""

from enum import Enum


class DietPreference(str, Enum):
    """Enumeration of supported dietary preference classifications."""

    Halal = "halal"
    Kosher = "kosher"
    Vegetarian = "vegetarian"
    Vegan = "vegan"
    NonePreference = "none"
