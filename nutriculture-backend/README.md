# NutriCulture Backend

FastAPI + Supabase + Claude backend for the NutriCulture mobile app (React Native / Expo).

---

## Stack

| Layer | Technology |
|---|---|
| API framework | FastAPI 0.115 |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| AI | Anthropic Claude `claude-sonnet-4-6` |
| Runtime | Python 3.12+, uvicorn |
| Frontend | React Native (Expo) — separate repo |

---

## Local Development Setup

### 1. Prerequisites

- Python 3.12+
- A Supabase project (free tier works)
- An Anthropic API key

### 2. Install dependencies

```bash
cd nutriculture-backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, SECRET_KEY
```

### 4. Run Supabase migrations

Open the Supabase SQL editor and run the files in `app/db/migrations/` in order:

```
001_user_profiles.sql
002_meal_plans.sql
003_community_posts.sql
004_post_interactions.sql
005_post_comments.sql
```

The RLS policy details are documented in `app/db/migrations/RLS_POLICY_NOTES.md`.

### 5. Start the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
  --timeout-keep-alive 90
```

> **`--timeout-keep-alive 90`** — Claude meal-plan generation takes 15–30 s.
> This keeps the connection alive long enough; the app-level timeout
> (`LLM_TIMEOUT_SECONDS=60`) fires first and returns a clean 504 if Claude is slow.

> **`--host 0.0.0.0`** — Required so Expo Go on a physical device can reach the
> server by your machine's LAN IP (e.g. `http://192.168.1.42:8000`).

Interactive docs (dev only): `http://localhost:8000/docs`

---

## Connecting from React Native (Expo)

### Authentication flow

This API validates Supabase JWTs. The React Native app must:

1. Sign in via the Supabase client:
   ```ts
   const { data, error } = await supabase.auth.signInWithPassword({
     email, password,
   });
   const accessToken = data.session?.access_token;
   ```

2. Pass the token on every request:
   ```ts
   const response = await fetch(`${API_BASE_URL}/api/v1/users/profile`, {
     headers: {
       Authorization: `Bearer ${accessToken}`,
       'Content-Type': 'application/json',
     },
   });
   ```

3. Handle token expiry (HTTP 401 with `code: "AUTH_TOKEN_INVALID"`):
   ```ts
   if (response.status === 401) {
     const { data } = await supabase.auth.refreshSession();
     // retry with data.session.access_token
   }
   ```

### API base URL

| Environment | URL |
|---|---|
| Local (simulator) | `http://localhost:8000` |
| Local (physical device via Expo Go) | `http://<your-LAN-IP>:8000` |
| Production | `https://api.nutriculture.com` (deploy to Railway / Fly.io / Render) |

> **Important:** iOS blocks plain `http://` connections to arbitrary IPs by
> default (App Transport Security).  For local dev, either:
> - Use `localhost` in the simulator (no ATS restriction), or
> - Add an ATS exception in `ios/NutriCulture/Info.plist` for your LAN IP, or
> - Use a tunnel like [ngrok](https://ngrok.com): `ngrok http 8000` and use the
>   `https://` URL it provides.

### CORS

CORS is a **browser-only** enforcement mechanism. React Native native builds
(iOS/Android) do **not** enforce CORS — the `CORS_ORIGINS` setting is irrelevant
for native builds.

If you use **Expo Web** or a **web admin panel**, set `CORS_ORIGINS` to the
exact origin (e.g. `http://localhost:19006,https://admin.nutriculture.com`).

---

## API Reference

All endpoints require `Authorization: Bearer <supabase_jwt>` except `/health`.

### Exact paths (no trailing-slash redirects)

`redirect_slashes=False` is set on the app — use paths exactly as listed.
If a `307 Moved` appears, you have a trailing-slash mismatch.

### Users — `/api/v1/users`

| Method | Path | Description |
|---|---|---|
| `PUT` | `/api/v1/users/profile` | Create or update health profile |
| `GET` | `/api/v1/users/profile` | Get current user's profile |
| `GET` | `/api/v1/users/profile/macros` | Get computed macro targets |

**Profile upsert body:**
```json
{
  "sex": "female",
  "age": 30,
  "weight_kg": 65.0,
  "height_cm": 163.0,
  "activity_level": "moderately_active",
  "health_conditions": ["type2_diabetes"],
  "allergens": ["gluten", "milk"],
  "cuisines": ["south_asian", "west_african"],
  "diet_preferences": ["halal"]
}
```

### Meal Plans — `/api/v1/meal-plans`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/meal-plans/generate` | Generate a new AI meal plan |
| `GET` | `/api/v1/meal-plans/{plan_date}` | Get plan for a date (`YYYY-MM-DD`) |
| `GET` | `/api/v1/meal-plans` | List plans (`?limit=10&offset=0`) |

> **Latency note:** `POST /generate` calls Claude and typically takes **15–30 seconds**.
> Show a loading spinner in the UI.  The endpoint returns HTTP 504 if Claude
> exceeds `LLM_TIMEOUT_SECONDS` (default 60 s) — surface this to the user as
> "Generation timed out, please try again."

### Community — `/api/v1/community`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/community/posts` | Create a post |
| `GET` | `/api/v1/community/posts` | List posts (`?condition=&cuisine=&verified_only=&sort=recent\|upvotes`) |
| `GET` | `/api/v1/community/posts/{id}` | Get a single post |
| `POST` | `/api/v1/community/posts/{id}/interact` | Upvote / bookmark / tried_it |
| `DELETE` | `/api/v1/community/posts/{id}/interact` | Remove upvote or bookmark |
| `POST` | `/api/v1/community/posts/{id}/comments` | Add a comment |
| `GET` | `/api/v1/community/posts/{id}/comments` | List threaded comments |

### Health check

```
GET /health
```
Returns `{"status":"ok","db":"ok","version":"1.0.0","environment":"dev"}`.
Use this as your Expo app's connectivity check on startup.

---

## Error responses

All errors follow a consistent shape so the React Native app can handle them generically:

```json
{
  "detail": {
    "error": "Human-readable message",
    "code": "MACHINE_READABLE_CODE",
    "detail": "Extended explanation"
  }
}
```

**Common codes:**

| Code | HTTP | When |
|---|---|---|
| `AUTH_TOKEN_INVALID` | 401 | Token expired or invalid — refresh and retry |
| `AUTH_TOKEN_MISSING` | 401 | No Authorization header sent |
| `PROFILE_NOT_FOUND` | 404 | User hasn't created a profile yet |
| `PLAN_NOT_FOUND` | 404 | No meal plan exists for that date |
| `LLM_TIMEOUT` | 504 | Claude took > `LLM_TIMEOUT_SECONDS` — retry |
| `LLM_INVALID_JSON` | 502 | Claude returned malformed output after retry |
| `TRIED_IT_DUPLICATE` | 409 | User already submitted `tried_it` for this post |
| `CUISINE_LIMIT_EXCEEDED` | 422 | More than 3 cuisines in profile update |

---

## Running Tests

```bash
pytest tests/ -v
```

All 22 tests run without a live Supabase or Anthropic connection — Supabase and
Claude calls are fully mocked.

---

## Deployment

The app is a standard ASGI application. Recommended platforms for a mobile backend:

- **Railway** — zero-config, add env vars in dashboard
- **Fly.io** — global edge, good for latency-sensitive LLM calls
- **Render** — free tier available for prototyping

Example `Procfile` (Railway / Heroku-style):
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT --timeout-keep-alive 90 --workers 2
```

Set `ENVIRONMENT=prod` in production to disable `/docs` and `/redoc`.
