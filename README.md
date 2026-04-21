# NuTradish

Culturally-aware nutrition coach for people managing chronic conditions like
type-2 diabetes, hypertension, or high cholesterol — without giving up the
foods that actually belong to their table.

The app pairs a React Native / Expo mobile client ("NuTradish") with a
FastAPI backend ("NutriCulture") that talks to Anthropic Claude for meal
planning, recipe generation, and real-time nutrition Q&A.

---

## What it does

| Area | What the user gets |
|---|---|
| **Onboarding quiz** | Age, weight/height, activity level, health conditions, allergens (with free-text "other"), cuisines, diet preferences, goals. Used to compute TDEE + macro targets and to personalize every Claude prompt. |
| **Meal Mate (chat)** | Conversational AI that generates single recipes or full daily meal plans respecting the user's profile. Full recipe cards with ingredients, steps, macros, "why this works", and AI-generated food photos. |
| **Chat history** | Last 5 conversations are persisted. You can resume any of them or delete individually from a history sheet. |
| **Bookmarks** | Save curated recipes, user-posted recipes, or AI-generated recipes. The "Saved AI Recipes" strip preserves the AI identity even when you post an AI recipe to the community first. |
| **Community feed** | Browse, post, comment on, and delete culturally-tagged recipes. Multi-select smart category chips that auto-suggest tags inferred from the recipe's title + ingredients. |
| **Recipe detail** | Unified detail screen with hero image, macros donut, ingredients / steps tabs, comments, bookmark + share + delete (for your own posts). |
| **Voice input** | On-device speech dictation when asking Meal Mate for a recipe (requires mic permission). |

---

## Architecture

```
┌───────────────────────────┐        ┌──────────────────────────┐
│  front-end/  (Expo)       │        │  nutriculture-backend/   │
│                           │        │  (FastAPI + Supabase)    │
│   React Native 0.83       │        │                          │
│   Expo Router 55          │──────▶ │   Anthropic Claude       │
│   Module-level stores     │  HTTPS │   Supabase Postgres      │
│   (AsyncStorage persist)  │  JWT   │   JWT auth middleware    │
│                           │◀──────┤                          │
└───────────────────────────┘        └──────────────────────────┘
```

- **Frontend state**: No Redux / Zustand — each persistent concern is a
  module-level singleton store that uses `AsyncStorage` and a subscribe /
  notify pattern. See `front-end/src/services/*-store.ts`.
- **Dynamic food photos**: Pollinations `flux` model, prompted with the
  cleaned recipe title + top ingredients, cached on their global CDN. Paired
  with Unsplash stock photos as an immediate placeholder so tiles never flash
  blank. See `front-end/src/utils/synthesize-recipe-facts.ts`.
- **Recipe persistence**: Chat recipes and bookmarks are both persisted.
  Opening a saved AI recipe falls back to the bookmark's payload if the
  in-memory chat cache has evicted the entry.

---

## Repo layout

```
SP26/
├── front-end/                   # Expo app (the mobile client)
│   ├── src/app/                 # Expo Router file-based routes
│   │   ├── (tabs)/              # Tab navigator: Home, Bookmarks, Chat, Settings
│   │   ├── onboarding.tsx
│   │   ├── quiz-*.tsx           # Onboarding quiz screens
│   │   ├── recipe/[id].tsx      # User-post / curated recipe detail
│   │   ├── login.tsx
│   │   ├── create-post.tsx
│   │   └── ...
│   ├── src/services/            # API clients + module-level stores
│   ├── src/components/          # Shared UI components
│   ├── src/data/recipes.ts      # Curated recipe bundle
│   ├── src/utils/               # Heuristics (fact synthesis, image resolution)
│   └── app.json
├── nutriculture-backend/        # FastAPI server
│   ├── app/routers/             # users, chat, meal_plans, community
│   ├── app/services/            # chat_service, user_service, meal_plan_service
│   ├── app/models/              # Pydantic request/response models
│   ├── app/db/migrations/       # Ordered Supabase SQL migrations
│   ├── tests/                   # 49 pytest cases (all mocked — no live deps)
│   └── requirements.txt
└── README.md                    # You are here
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 20+ | For the Expo app |
| npm | 10+ | Ships with Node |
| Xcode | 15+ | Only required for iOS simulator |
| Android Studio | Giraffe+ | Only required for Android emulator |
| Python | 3.11 or 3.12 | For the backend |
| Supabase project | free tier is fine | Used for auth + Postgres |
| Anthropic API key | any plan | For Claude |

---

## Quick start

### 1. Clone

```bash
git clone <this-repo>
cd SP26
```

### 2. Start the backend

```bash
cd nutriculture-backend
python -m venv .venv
source .venv/bin/activate             # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Open .env and fill in:
#   SUPABASE_URL, SUPABASE_SERVICE_KEY
#   ANTHROPIC_API_KEY
#   SECRET_KEY (any strong random string)

# Apply SQL migrations in order in the Supabase SQL editor:
#   app/db/migrations/001_*.sql … 011_*.sql

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --timeout-keep-alive 90
```

Sanity check: visit `http://localhost:8000/health` — should return
`{"status":"ok", ...}`. See `nutriculture-backend/README.md` for the full API
reference.

### 3. Start the Expo app

Open a new terminal:

```bash
cd front-end
npm install

# Point the app at your backend. If running on a physical device via Expo Go,
# use your machine's LAN IP instead of localhost.
cat > .env <<'EOF'
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
EOF

npx expo start --dev-client
```

Press `i` to open in the iOS simulator, `a` for Android, or scan the QR code
with your phone's Expo Go app. (iOS physical device needs a dev client build
because of the speech-recognition module.)

### 4. First-run walkthrough

1. Sign up / sign in on the login screen.
2. Complete the onboarding quiz — every field feeds the LLM's system prompt.
3. Open the **Meal Mate** tab and send a prompt like *"Give me a Halal dinner
   that keeps my blood sugar stable."*
4. Tap the recipe card → bookmark it → optionally post it to the community
   from the detail screen.
5. On the chat header, tap the clock icon to see past chats, resume one, or
   delete it.

---

## Running the tests

```bash
# Backend (49 tests, ~1 second, no external calls)
cd nutriculture-backend
python -m pytest tests/ -q

# Frontend type-check + lint
cd front-end
npx tsc --noEmit
npx expo lint
```

---

## Environment variables

### Backend (`nutriculture-backend/.env`)

| Key | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | yes | Service-role key — never ship in frontend |
| `ANTHROPIC_API_KEY` | yes | `sk-ant-…` |
| `SECRET_KEY` | yes | Any strong random string |
| `LLM_TIMEOUT_SECONDS` | no | Default 60. Bump if your network to Anthropic is slow. |
| `ENVIRONMENT` | no | `dev` (default) enables `/docs`; set `prod` to disable |
| `CORS_ORIGINS` | no | Comma-separated list. Only matters for Expo Web. |

### Frontend (`front-end/.env`)

| Key | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | yes | Point at the running backend |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Same Supabase project as the backend |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key only (never the service key) |

Neither `.env` file is committed — both are covered by the root `.gitignore`.

---

## Demo checklist

Before recording, verify in order:

1. **Backend up** — `curl http://localhost:8000/health` returns `ok`.
2. **Fresh onboarding** — sign up with a throwaway email, fill the quiz (try
   an "Other" allergen so the free-text flow is demoed), confirm macros land
   on the profile screen.
3. **Recipe generation** — ask Meal Mate for a meal plan and a single recipe
   in a specific cuisine. Open the recipe card, verify:
   - The image actually depicts the described dish (no abstract art).
   - Macros donut + "why this works" tab both render.
   - Bookmark toggles on and off.
4. **Chat history** — tap `+` to start a fresh chat, then tap the clock icon
   on the chat header. Resume the prior chat and delete an old one.
5. **Persistence** — force-quit the app and reopen. The bookmarked AI recipe
   should still open to the full detail screen (no "Recipe not found").
6. **Community flow** — post an AI recipe to the community, bookmark it, open
   Bookmarks, verify it appears in the "Saved AI Recipes" strip with the
   sparkles badge. Navigate back with the back button — should return to
   Bookmarks, not the chat screen.
7. **Comments** — open any community post, add a comment from a second
   account, and confirm it's visible to the original poster too.

---

## Known caveats

- Pollinations image generation takes ~3 s on first hit per unique recipe;
  after that the image is served from their global CDN. The Unsplash
  placeholder appears in <500 ms so the user sees a food photo immediately.
- Chat recipe payloads are capped at 200 persisted entries; older ones are
  evicted but bookmarks still keep the full snapshot.
- Claude meal-plan generation takes 15–30 s. The backend returns HTTP 504
  if it exceeds `LLM_TIMEOUT_SECONDS`; the client surfaces this as a retry
  prompt.

---

## Further reading

- Backend API reference + deployment: [`nutriculture-backend/README.md`](nutriculture-backend/README.md)
- Row-level-security policies: [`nutriculture-backend/app/db/migrations/RLS_POLICY_NOTES.md`](nutriculture-backend/app/db/migrations/RLS_POLICY_NOTES.md)
