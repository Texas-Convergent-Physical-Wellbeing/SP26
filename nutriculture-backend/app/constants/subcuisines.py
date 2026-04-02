"""Sub-cuisine enum for inferred regional preference weighting."""

from enum import Enum


class SubCuisine(str, Enum):
    """Regional sub-cuisines inferred from meal feedback patterns."""

    # South Asian
    Punjabi = "punjabi"
    Tamil = "tamil"
    Bengali = "bengali"
    Gujarati = "gujarati"
    Hyderabadi = "hyderabadi"

    # West African
    Yoruba = "yoruba"
    Igbo = "igbo"
    Ghanaian = "ghanaian"
    Senegalese = "senegalese"

    # East Asian
    Cantonese = "cantonese"
    Szechuan = "szechuan"
    Japanese = "japanese"
    Korean = "korean"

    # Latin American
    Mexican = "mexican"
    Cuban = "cuban"
    Colombian = "colombian"
    Peruvian = "peruvian"

    # Middle Eastern
    Lebanese = "lebanese"
    Moroccan = "moroccan"
    Turkish = "turkish"
    Persian = "persian"

    # Southeast Asian
    Filipino = "filipino"
    Thai = "thai"
    Vietnamese = "vietnamese"
    Indonesian = "indonesian"

    # Caribbean
    Jamaican = "jamaican"
    Trinidadian = "trinidadian"
    Haitian = "haitian"
