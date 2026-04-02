"""Feedback action enum for taste learning interactions on generated meals."""

from enum import Enum


class FeedbackAction(str, Enum):
    """Actions a user can take on a generated meal to signal preferences."""

    Saved = "saved"
    # User explicitly saved the meal — strong positive signal

    Skipped = "skipped"
    # User skipped / dismissed the meal — negative signal

    Modified = "modified"
    # User made their own changes — partial signal with modification notes
