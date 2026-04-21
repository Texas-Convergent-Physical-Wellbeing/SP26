# NuTradish (Expo client)

React Native / Expo mobile client for **NuTradish** — see the repo root
[`README.md`](../README.md) for the full product overview, architecture,
and end-to-end setup.

## Local development

```bash
npm install

# Configure environment (see root README for the full list)
cat > .env <<'EOF'
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
EOF

npx expo start --dev-client
```

Press `i` to open in the iOS simulator, `a` for Android, or scan the QR
code with your phone's Expo Go client. A dev-client build is required on
a physical iOS device because of the `expo-speech-recognition` native
module.

## Checks

```bash
npx tsc --noEmit    # type-check
npx expo lint       # eslint
```

## Key files

- `src/app/` — Expo Router file-based routes (tabs, onboarding, detail screens)
- `src/services/` — API client + module-level persistent stores
- `src/components/` — shared UI components
- `src/data/recipes.ts` — curated recipe bundle shipped with the app
- `src/utils/synthesize-recipe-facts.ts` — recipe fact / image heuristics
