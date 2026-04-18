"""Cuisine preference enum for diaspora-focused meal planning."""

from enum import Enum


class Cuisine(str, Enum):
    """Enumeration of supported cultural cuisine preferences."""

    Italian = "italian"
    Chinese = "chinese"
    Mexican = "mexican"
    Indian = "indian"
    Thai = "thai"
    Greek = "greek"
    French = "french"
    Other = "other"
