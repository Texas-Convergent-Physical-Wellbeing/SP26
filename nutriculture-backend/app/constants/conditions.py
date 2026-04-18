"""Health condition enum used for condition-specific dietary adaptations."""

from enum import Enum


class HealthCondition(str, Enum):
    """Enumeration of supported chronic health conditions for meal planning."""

    DiabetesI = "diabetesI"
    HeartDisease = "heart_disease"
    DiabetesII = "diabetesII"
    CeliacDisease = "celiac_disease"
    Hypertension = "hypertension"
    Obesity = "obesity"
    Osteoporosis = "osteoporosis"
    Other = "other"
