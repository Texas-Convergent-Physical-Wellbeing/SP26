#!/usr/bin/env python3
"""Seed Supabase with Auth users and app rows for local / QA backend testing.

Uses SUPABASE_SERVICE_KEY (bypasses RLS). Safe for dev; do not run against production.

Usage:
  cd nutriculture-backend
  python scripts/seed_supabase.py
  python scripts/seed_supabase.py --clean   # remove prior seed rows for seed users, then re-seed

Requires: pip install -r requirements.txt and a populated .env (see README).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

# ---------------------------------------------------------------------------
# Paths & env
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SEED_USER_A_EMAIL = os.environ.get("SEED_USER_A_EMAIL", "seed.primary@nutriculture.test")
SEED_USER_B_EMAIL = os.environ.get("SEED_USER_B_EMAIL", "seed.author@nutriculture.test")
SEED_PASSWORD = os.environ.get("SEED_PASSWORD", "SeedTest123!")

# Fixed dates so re-runs can target the same plans (upsert).
PLAN_DATE_STANDARD = "2026-04-01"
PLAN_DATE_RAMADAN = "2026-04-02"
FEEDBACK_PLAN_DATE = "2026-03-20"


def _meal(
    meal_type: str,
    dish: str,
    *,
    glycemic_notes: str | None = "Low GI options where possible.",
) -> dict[str, Any]:
    return {
        "meal_type": meal_type,
        "dish_name": dish,
        "cuisine_tag": "south_asian",
        "original_dish": "Traditional preparation",
        "adapted_dish": "Adjusted for conditions and preferences",
        "why_this_works": "Balanced macros with cultural authenticity.",
        "ingredients": [
            {"name": "basmati rice", "quantity": 150, "unit": "g"},
            {"name": "lentils", "quantity": 100, "unit": "g"},
        ],
        "macros": {
            "calories": 600,
            "protein_g": 35,
            "carbs_g": 75,
            "fat_g": 18,
            "fiber_g": 12,
        },
        "micros": {
            "sodium_mg": 450,
            "potassium_mg": 800,
            "iron_mg": 4,
            "calcium_mg": 120,
            "vitamin_c_mg": 15,
        },
        "glycemic_notes": glycemic_notes,
        "portion_size": "1 plate (~400 g)",
    }


MEALS_STANDARD = [
    _meal("breakfast", "Masala Oats Bowl"),
    _meal("lunch", "Chana Masala with Brown Rice"),
    _meal("dinner", "Grilled Fish with Saag"),
]

MEALS_RAMADAN = [
    _meal("suhoor", "Suhoor Protein Paratha Plate", glycemic_notes="Complex carbs for sustained energy."),
    _meal("iftar", "Iftar Lentil Soup and Baked Samosa", glycemic_notes="Moderate portions after dates."),
    _meal("light_snack", "Yogurt with Fruit", glycemic_notes=None),
]


def _require_env() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment (.env).", file=sys.stderr)
        sys.exit(1)
    return url, key


def _get_client() -> Client:
    url, key = _require_env()
    return create_client(url, key)


def get_or_create_user(supabase: Client, email: str, password: str) -> str:
    """Return auth user UUID, creating the user if missing."""
    page = 1
    per_page = 200
    while True:
        users = supabase.auth.admin.list_users(page=page, per_page=per_page) or []
        for u in users:
            if (u.email or "").lower() == email.lower():
                return str(u.id)
        if len(users) < per_page:
            break
        page += 1

    created = supabase.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
        }
    )
    user = getattr(created, "user", None)
    if not user:
        print(f"create_user returned no user for {email}", file=sys.stderr)
        sys.exit(1)
    return str(user.id)


def _clean_seed_data(supabase: Client, user_a: str, user_b: str) -> None:
    """Remove app rows tied to seed users (keeps auth.users). FK order matters."""
    # Posts by B
    posts = (
        supabase.table("community_posts")
        .select("id")
        .eq("author_id", user_b)
        .execute()
    )
    post_ids = [r["id"] for r in (posts.data or [])]

    for pid in post_ids:
        supabase.table("post_comments").delete().eq("post_id", pid).execute()
        supabase.table("post_interactions").delete().eq("post_id", pid).execute()

    supabase.table("community_posts").delete().eq("author_id", user_b).execute()

    supabase.table("cookbook_entries").delete().eq("user_id", user_a).execute()
    supabase.table("meal_feedback").delete().eq("user_id", user_a).execute()
    supabase.table("meal_plans").delete().eq("user_id", user_a).execute()
    supabase.table("meal_plans").delete().eq("user_id", user_b).execute()
    supabase.table("user_profiles").delete().eq("user_id", user_a).execute()
    supabase.table("user_profiles").delete().eq("user_id", user_b).execute()
    print("Cleaned existing seed rows for both users.")


def _remove_prior_seed_content(supabase: Client, user_a: str, user_b: str) -> None:
    """Drop seed-identifiable rows so `seed()` can be re-run without --clean."""
    posts = (
        supabase.table("community_posts")
        .select("id")
        .eq("author_id", user_b)
        .eq("title", "Seed: Chana for Type 2")
        .execute()
    )
    for row in posts.data or []:
        supabase.table("community_posts").delete().eq("id", row["id"]).execute()

    supabase.table("meal_feedback").delete().eq("user_id", user_a).eq(
        "plan_date", FEEDBACK_PLAN_DATE
    ).execute()
    for dish in ("Saved Tandoori Chicken Salad", "Dal with Roti"):
        supabase.table("cookbook_entries").delete().eq("user_id", user_a).eq(
            "dish_name", dish
        ).execute()


def seed(supabase: Client, user_a: str, user_b: str) -> None:
    _remove_prior_seed_content(supabase, user_a, user_b)

    # --- Profiles ---
    profile_a = {
        "user_id": user_a,
        "sex": "female",
        "age": 32,
        "weight_kg": 68.0,
        "height_cm": 165.0,
        "health_conditions": ["type2_diabetes"],
        "allergens": ["gluten"],
        "cuisines": ["south_asian", "mediterranean"],
        "diet_preferences": ["halal"],
        "health_goals": ["Manage a Health Condition", "Improve Overall Nutrition"],
        "tdee": 2100.0,
        "macro_targets": {
            "calories": 2100,
            "protein_g": 130,
            "carbs_g": 220,
            "fat_g": 70,
            "fiber_g": 35,
        },
        "skill_level": "beginner",
        "shortcut_mode": True,
        "active_festive_event": "ramadan",
        "festive_event_start": "2026-03-01",
        "festive_event_end": "2026-03-30",
    }
    profile_b = {
        "user_id": user_b,
        "sex": "male",
        "age": 28,
        "weight_kg": 75.0,
        "height_cm": 178.0,
        "health_conditions": ["type2_diabetes"],
        "allergens": [],
        "cuisines": ["south_asian"],
        "diet_preferences": ["none"],
        "health_goals": [],
        "tdee": 2400.0,
        "macro_targets": {
            "calories": 2400,
            "protein_g": 120,
            "carbs_g": 280,
            "fat_g": 80,
            "fiber_g": 30,
        },
        "skill_level": "intermediate",
        "shortcut_mode": False,
        "active_festive_event": None,
        "festive_event_start": None,
        "festive_event_end": None,
    }

    supabase.table("user_profiles").upsert(profile_a, on_conflict="user_id").execute()
    supabase.table("user_profiles").upsert(profile_b, on_conflict="user_id").execute()
    print("Upserted user_profiles for seed users.")

    # --- Meal plans ---
    supabase.table("meal_plans").upsert(
        {
            "user_id": user_a,
            "plan_date": PLAN_DATE_STANDARD,
            "meals": MEALS_STANDARD,
        },
        on_conflict="user_id,plan_date",
    ).execute()
    supabase.table("meal_plans").upsert(
        {
            "user_id": user_a,
            "plan_date": PLAN_DATE_RAMADAN,
            "meals": MEALS_RAMADAN,
        },
        on_conflict="user_id,plan_date",
    ).execute()
    print(f"Upserted meal_plans ({PLAN_DATE_STANDARD} standard, {PLAN_DATE_RAMADAN} Ramadan).")

    # --- Taste feedback ---
    feedback_rows = [
        {
            "user_id": user_a,
            "plan_date": FEEDBACK_PLAN_DATE,
            "meal_type": "lunch",
            "dish_name": "Biryani Bowl",
            "cuisine_tag": "south_asian",
            "action": "saved",
            "modification_notes": None,
            "modified_macros": None,
        },
        {
            "user_id": user_a,
            "plan_date": FEEDBACK_PLAN_DATE,
            "meal_type": "dinner",
            "dish_name": "Creamy Korma",
            "cuisine_tag": "south_asian",
            "action": "skipped",
            "modification_notes": None,
            "modified_macros": None,
        },
        {
            "user_id": user_a,
            "plan_date": FEEDBACK_PLAN_DATE,
            "meal_type": "breakfast",
            "dish_name": "Sweet Halwa Plate",
            "cuisine_tag": "punjabi",
            "action": "modified",
            "modification_notes": "Reduced sugar by half, swapped ghee for olive oil.",
            "modified_macros": {
                "calories": 380,
                "protein_g": 12,
                "carbs_g": 45,
                "fat_g": 14,
                "fiber_g": 6,
            },
        },
    ]
    supabase.table("meal_feedback").insert(feedback_rows).execute()
    print("Inserted meal_feedback (saved / skipped / modified).")

    # --- Cookbook ---
    entry_plain = {
        "user_id": user_a,
        "dish_name": "Saved Tandoori Chicken Salad",
        "meal_type": "lunch",
        "cuisine_tag": "south_asian",
        "source_plan_date": PLAN_DATE_STANDARD,
        "ingredients": [{"name": "chicken breast", "quantity": 150, "unit": "g"}],
        "macros": {
            "calories": 450,
            "protein_g": 45,
            "carbs_g": 25,
            "fat_g": 18,
            "fiber_g": 8,
        },
        "micros": {"sodium_mg": 500, "potassium_mg": 700, "iron_mg": 3},
        "user_modifications": None,
        "adjusted_macros": None,
    }
    entry_modified = {
        "user_id": user_a,
        "dish_name": "Dal with Roti",
        "meal_type": "dinner",
        "cuisine_tag": "south_asian",
        "source_plan_date": PLAN_DATE_STANDARD,
        "ingredients": [
            {"name": "red lentils", "quantity": 200, "unit": "g"},
            {"name": "whole wheat roti", "quantity": 2, "unit": "piece"},
        ],
        "macros": {
            "calories": 520,
            "protein_g": 22,
            "carbs_g": 85,
            "fat_g": 12,
            "fiber_g": 15,
        },
        "micros": {"sodium_mg": 400, "potassium_mg": 900, "iron_mg": 5},
        "user_modifications": "Always use less oil; double the turmeric.",
        "adjusted_macros": {
            "calories": 480,
            "protein_g": 22,
            "carbs_g": 82,
            "fat_g": 8,
            "fiber_g": 16,
        },
    }
    supabase.table("cookbook_entries").insert([entry_plain, entry_modified]).execute()
    print("Inserted cookbook_entries.")

    # --- Community: post by B; counters match interactions below ---
    adapted = _meal("lunch", "Community Low-Sodium Chana", glycemic_notes="Shared adaptation.")
    post_row = {
        "author_id": user_b,
        "title": "Seed: Chana for Type 2",
        "body": "This is seed data for the community feed. Try it and share your tweaks!",
        "adapted_recipe": adapted,
        "condition_tags": ["type2_diabetes"],
        "cuisine_tag": "south_asian",
        "upvotes": 1,
        "bookmarks": 1,
        "community_verified": False,
    }
    post_ins = supabase.table("community_posts").insert(post_row).execute()
    post_data = post_ins.data
    if not post_data:
        print("Failed to insert community_posts", file=sys.stderr)
        sys.exit(1)
    post_id = post_data[0]["id"]

    interactions = [
        {
            "post_id": post_id,
            "user_id": user_a,
            "interaction_type": "upvote",
            "macro_confirmation": None,
        },
        {
            "post_id": post_id,
            "user_id": user_a,
            "interaction_type": "bookmark",
            "macro_confirmation": None,
        },
        {
            "post_id": post_id,
            "user_id": user_a,
            "interaction_type": "tried_it",
            "macro_confirmation": {
                "calories": 580,
                "protein_g": 28,
                "carbs_g": 72,
                "fat_g": 20,
                "fiber_g": 14,
            },
        },
    ]
    supabase.table("post_interactions").insert(interactions).execute()
    print("Inserted community_posts + post_interactions (counters upvotes=1, bookmarks=1).")

    # --- Comments: A top-level, B reply ---
    c1 = supabase.table("post_comments").insert(
        {
            "post_id": post_id,
            "author_id": user_a,
            "body": "Thanks for posting — worked well with brown rice.",
            "parent_comment_id": None,
        }
    ).execute()
    parent_id = c1.data[0]["id"] if c1.data else None
    if parent_id:
        supabase.table("post_comments").insert(
            {
                "post_id": post_id,
                "author_id": user_b,
                "body": "Glad it helped! I use extra ginger too.",
                "parent_comment_id": parent_id,
            }
        ).execute()
    print("Inserted post_comments (threaded).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Supabase for NutriCulture backend testing.")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete existing seed rows for seed users before inserting (keeps auth accounts).",
    )
    args = parser.parse_args()

    supabase = _get_client()

    print("Ensuring Auth users exist…")
    user_a = get_or_create_user(supabase, SEED_USER_A_EMAIL, SEED_PASSWORD)
    user_b = get_or_create_user(supabase, SEED_USER_B_EMAIL, SEED_PASSWORD)
    print(f"  Primary (A): {user_a}  <{SEED_USER_A_EMAIL}>")
    print(f"  Author (B):  {user_b}  <{SEED_USER_B_EMAIL}>")

    if args.clean:
        _clean_seed_data(supabase, user_a, user_b)

    seed(supabase, user_a, user_b)

    print("\nDone. Sign in with either email + SEED_PASSWORD to obtain JWTs for API calls.")
    print(f"Default password: {SEED_PASSWORD!r} (override with SEED_PASSWORD in .env)")


if __name__ == "__main__":
    main()
