"""Top-14 EU allergen enum as defined by EU Food Information Regulation 1169/2011."""

from enum import Enum


class Allergen(str, Enum):
    """Enumeration of the 14 major allergens recognised by EU regulation."""

    Celery = "celery"
    Gluten = "gluten"
    Crustaceans = "crustaceans"
    Eggs = "eggs"
    Fish = "fish"
    Lupin = "lupin"
    Milk = "milk"
    Molluscs = "molluscs"
    Mustard = "mustard"
    Peanuts = "peanuts"
    Sesame = "sesame"
    Soybeans = "soybeans"
    SulphurDioxide = "sulphur_dioxide"
    TreeNuts = "tree_nuts"
