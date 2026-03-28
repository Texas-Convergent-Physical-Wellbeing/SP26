"""Cuisine preference enum for diaspora-focused meal planning."""

from enum import Enum


class Cuisine(str, Enum):
    """Enumeration of supported cultural cuisine preferences."""

    SouthAsian = "south_asian"
    WestAfrican = "west_african"
    EastAsian = "east_asian"
    LatinAmerican = "latin_american"
    MiddleEastern = "middle_eastern"
    Mediterranean = "mediterranean"
    SoutheastAsian = "southeast_asian"
    Caribbean = "caribbean"
