"""Health condition enum used for condition-specific dietary adaptations."""

from enum import Enum


class HealthCondition(str, Enum):
    """Enumeration of supported chronic health conditions for meal planning."""

    Type2Diabetes = "type2_diabetes"
    Hypertension = "hypertension"
    PCOS = "pcos"
    HighCholesterol = "high_cholesterol"
    Celiac = "celiac"
    KidneyDisease = "kidney_disease"
    NoneCondition = "none"
