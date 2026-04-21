/**
 * Chat session store with support for up to `MAX_SESSIONS` saved conversations.
 *
 * There is always exactly one **active** session (the one the user is typing
 * into). Previous sessions are archived and surfaced in the "past chats"
 * panel so the user can resume or delete them.
 *
 * In addition to the sessions, we persist a flat list of recipe titles that
 * have already been suggested — the backend uses this to avoid repeating the
 * same meals every time the user asks for a new plan.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  api,
  getAuthToken,
  type ChatMessage as ApiChatMessage,
  type ChatResponse as ApiChatResponse,
} from '@/services/api';
import { putChatRecipe } from '@/services/chat-recipe-store';

type Role = 'user' | 'assistant';

export type ChatSessionMessage =
  | { id: string; role: Role; text: string; kind: 'text' }
  | {
      id: string;
      role: 'assistant';
      kind: 'recipe';
      text: string;
      recipe: { id: string; title: string; cta: string };
    };

export interface ChatSession {
  id: string;
  /** Short label derived from the first user message — shown in the history panel. */
  label: string;
  messages: ChatSessionMessage[];
  history: ApiChatMessage[];
  created_at: string;
  updated_at: string;
}

interface ChatSessionState {
  sessions: ChatSession[];
  /** Index of the active session in `sessions` (always valid). */
  activeIndex: number;
  suggestedTitles: string[];
  sending: boolean;
}

const TITLES_KEY = 'nutriculture.chat.suggestedTitles.v1';
const SESSIONS_KEY = 'nutriculture.chat.sessions.v1';
const MAX_PERSISTED_TITLES = 60;
const MAX_SESSIONS = 5;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newEmptySession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    label: 'New chat',
    messages: [],
    history: [],
    created_at: now,
    updated_at: now,
  };
}

const state: ChatSessionState = {
  sessions: [newEmptySession()],
  activeIndex: 0,
  suggestedTitles: [],
  sending: false,
};

const listeners = new Set<() => void>();
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function getActive(): ChatSession {
  return state.sessions[state.activeIndex];
}

function bumpActiveUpdatedAt() {
  const active = getActive();
  active.updated_at = new Date().toISOString();
}

/** Derive a short label from the first user message (or keep "New chat"). */
function deriveLabel(session: ChatSession): string {
  const firstUser = session.messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const txt = firstUser.kind === 'text' ? firstUser.text : '';
  const trimmed = txt.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'New chat';
  return trimmed.length > 44 ? trimmed.slice(0, 44).trim() + '…' : trimmed;
}

// ── Persistence ───────────────────────────────────────────────────────────────

async function loadPersistedTitles(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(TITLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

async function savePersistedTitles(titles: string[]): Promise<void> {
  try {
    const capped = titles.slice(-MAX_PERSISTED_TITLES);
    await AsyncStorage.setItem(TITLES_KEY, JSON.stringify(capped));
  } catch {
    // non-fatal
  }
}

async function persistSessions(): Promise<void> {
  try {
    // Cap to MAX_SESSIONS; oldest (by updated_at) trimmed.
    const sorted = [...state.sessions].sort(
      (a, b) => (a.updated_at < b.updated_at ? 1 : -1),
    );
    const kept = sorted.slice(0, MAX_SESSIONS);
    // Ensure the active session is still in the kept list.
    const active = getActive();
    if (!kept.some((s) => s.id === active.id)) {
      kept.unshift(active);
      kept.splice(MAX_SESSIONS); // trim if we pushed over cap
    }
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(kept));
  } catch {
    // non-fatal
  }
}

export function hydrateChatSession(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    const persisted = await loadPersistedTitles();
    if (persisted.length > 0) {
      const existing = new Set(state.suggestedTitles.map((t) => t.toLowerCase()));
      for (const t of persisted) {
        if (!existing.has(t.toLowerCase())) {
          state.suggestedTitles.push(t);
          existing.add(t.toLowerCase());
        }
      }
    }
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(
            (s): s is ChatSession =>
              !!s && typeof s.id === 'string' && Array.isArray(s.messages),
          );
          if (cleaned.length > 0) {
            // Sort newest-first; activate the most recent.
            cleaned.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
            state.sessions = cleaned.slice(0, MAX_SESSIONS);
            state.activeIndex = 0;
          }
        }
      }
    } catch {
      // start fresh
    }
    hydrated = true;
    notify();
  })();
  return hydrationPromise;
}

// ── Active session API ────────────────────────────────────────────────────────

export function getChatSession() {
  const active = getActive();
  return {
    messages: active.messages,
    history: active.history,
    suggestedTitles: state.suggestedTitles,
    sending: state.sending,
  };
}

export function getAllSessions(): ChatSession[] {
  // Newest-first.
  return [...state.sessions].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export function getActiveSessionId(): string {
  return getActive().id;
}

export function setChatMessages(messages: ChatSessionMessage[]) {
  const active = getActive();
  active.messages = messages;
  active.label = deriveLabel(active);
  bumpActiveUpdatedAt();
  void persistSessions();
  notify();
}

export function setChatHistory(history: ApiChatMessage[]) {
  getActive().history = history;
  bumpActiveUpdatedAt();
  void persistSessions();
  notify();
}

export function getSuggestedTitles(): string[] {
  return state.suggestedTitles;
}

export function addSuggestedTitles(titles: string[]) {
  if (!titles || titles.length === 0) return;
  const existing = new Set(state.suggestedTitles.map((t) => t.toLowerCase()));
  const deduped = titles.filter((t) => t && !existing.has(t.toLowerCase()));
  if (deduped.length === 0) return;
  state.suggestedTitles = [...state.suggestedTitles, ...deduped];
  void savePersistedTitles(state.suggestedTitles);
  notify();
}

/**
 * Clears the CURRENT conversation in place without rotating to a new session.
 * Kept for backwards-compatibility — callers that want the "new chat" flow
 * should prefer `startNewChatSession()`.
 */
export function clearChatConversation() {
  const active = getActive();
  active.messages = [];
  active.history = [];
  active.label = 'New chat';
  bumpActiveUpdatedAt();
  void persistSessions();
  notify();
}

/**
 * Archives the current session (if it has any messages) and creates a fresh
 * active session. The oldest session is evicted when the list exceeds
 * `MAX_SESSIONS`.
 */
export function startNewChatSession(): void {
  const active = getActive();
  // If the current session is empty, just keep it as the fresh one.
  if (active.messages.length === 0) {
    notify();
    return;
  }
  // Finalize the current session's label + timestamp.
  active.label = deriveLabel(active);
  active.updated_at = new Date().toISOString();
  // Create a new active session and prepend.
  const fresh = newEmptySession();
  state.sessions = [fresh, ...state.sessions];
  state.activeIndex = 0;
  // Enforce cap (drop oldest).
  if (state.sessions.length > MAX_SESSIONS) {
    state.sessions = state.sessions.slice(0, MAX_SESSIONS);
  }
  void persistSessions();
  notify();
}

/** Switch the active session to the one with the given id. */
export function loadChatSession(sessionId: string): void {
  const idx = state.sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return;
  state.activeIndex = idx;
  notify();
}

/** Delete a session by id. If the deleted one was active, activate the next newest. */
export function deleteChatSession(sessionId: string): void {
  const idx = state.sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return;
  const wasActive = idx === state.activeIndex;
  state.sessions.splice(idx, 1);
  if (state.sessions.length === 0) {
    state.sessions = [newEmptySession()];
    state.activeIndex = 0;
  } else if (wasActive) {
    state.activeIndex = 0;
  } else if (idx < state.activeIndex) {
    state.activeIndex -= 1;
  }
  void persistSessions();
  notify();
}

/** Nukes every session and the persisted exclusion list ("forget everything"). */
export async function resetChatSessionCompletely() {
  state.sessions = [newEmptySession()];
  state.activeIndex = 0;
  state.suggestedTitles = [];
  try {
    await AsyncStorage.removeItem(TITLES_KEY);
    await AsyncStorage.removeItem(SESSIONS_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function subscribeChatSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Background-safe send ─────────────────────────────────────────────────────

function formatAssistantText(raw: string): string {
  let text = (raw ?? '').replace(/\r/g, '');
  const fencedJson = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fencedJson) {
    try {
      const parsed = JSON.parse(fencedJson[1]);
      if (parsed && typeof parsed.response === 'string') {
        text = parsed.response;
      } else {
        text = fencedJson[1];
      }
    } catch {
      text = fencedJson[1];
    }
  } else {
    text = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  }
  const lines = text.split('\n');
  return lines
    .filter((l) => !/^\s*\|.*\|\s*$/.test(l))
    .filter((l) => !/^\s*\|?-{3,}\|?-{0,}.*$/.test(l))
    .map((l) => l.replace(/^\s{0,3}#{1,6}\s+/g, ''))
    .map((l) => l.replace(/\*\*(.*?)\*\*/g, '$1'))
    .map((l) => l.replace(/`([^`]+)`/g, '$1'))
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isSendingChat(): boolean {
  return state.sending;
}

export async function sendChatMessageFromStore(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (state.sending) return;

  const active = getActive();
  active.messages = [
    ...active.messages,
    { id: makeId(), role: 'user', kind: 'text', text: trimmed },
  ];
  active.label = deriveLabel(active);
  active.updated_at = new Date().toISOString();
  state.sending = true;
  notify();

  const historySnapshot = active.history;

  try {
    const token = getAuthToken();
    if (!token) {
      const recipeId = makeId();
      putChatRecipe(recipeId, {
        title: 'Super Cool Personalized Recipe Here',
        summary: 'Sign in to enable live AI generation. This is a local demo card.',
        ingredients: ['Example ingredient 1', 'Example ingredient 2'],
        steps: ['Example step 1', 'Example step 2'],
        macros: { calories: 480, protein_g: 30, carbs_g: 50, fat_g: 18, fiber_g: 8 },
        why_this_works: 'Once authenticated, Meal Mate will tailor this to your profile.',
      });
      active.messages = [
        ...active.messages,
        {
          id: makeId(),
          role: 'assistant',
          kind: 'recipe',
          text: 'Sign in to enable live Meal Mate responses.',
          recipe: { id: recipeId, title: 'Super Cool Personalized Recipe Here', cta: 'Click to learn more' },
        },
      ];
      return;
    }

    const res: ApiChatResponse = await api.sendChatMessage(
      trimmed,
      historySnapshot,
      state.suggestedTitles,
    );

    active.history = res.conversation_history;

    const recipePayload = res.recipe ?? null;
    const recipesPayload = res.recipes ?? null;

    const newTitles: string[] = [];
    if (recipePayload?.title) newTitles.push(recipePayload.title);
    if (recipesPayload) {
      for (const r of recipesPayload) {
        if (r?.title) newTitles.push(r.title);
      }
    }
    if (newTitles.length > 0) {
      const existing = new Set(state.suggestedTitles.map((t) => t.toLowerCase()));
      const deduped = newTitles.filter((t) => !existing.has(t.toLowerCase()));
      if (deduped.length > 0) {
        state.suggestedTitles = [...state.suggestedTitles, ...deduped];
        void savePersistedTitles(state.suggestedTitles);
      }
    }

    if (res.kind === 'meal_plan' && recipesPayload && recipesPayload.length > 0) {
      const introMessage: ChatSessionMessage = {
        id: makeId(),
        role: 'assistant',
        kind: 'text',
        text: formatAssistantText(res.response),
      };
      const cardMessages: ChatSessionMessage[] = recipesPayload.map((r) => {
        const rid = makeId();
        putChatRecipe(rid, r);
        return {
          id: makeId(),
          role: 'assistant',
          kind: 'recipe',
          text: '',
          recipe: { id: rid, title: r.title, cta: 'Click to learn more' },
        };
      });
      active.messages = [...active.messages, introMessage, ...cardMessages];
    } else if (res.kind === 'recipe' && recipePayload) {
      const recipeId = makeId();
      putChatRecipe(recipeId, recipePayload);
      active.messages = [
        ...active.messages,
        {
          id: makeId(),
          role: 'assistant',
          kind: 'recipe',
          text: formatAssistantText(res.response),
          recipe: { id: recipeId, title: recipePayload.title, cta: 'Click to learn more' },
        },
      ];
    } else {
      active.messages = [
        ...active.messages,
        { id: makeId(), role: 'assistant', kind: 'text', text: formatAssistantText(res.response) },
      ];
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to send message';
    active.messages = [
      ...active.messages,
      { id: makeId(), role: 'assistant', kind: 'text', text: msg },
    ];
  } finally {
    state.sending = false;
    active.label = deriveLabel(active);
    active.updated_at = new Date().toISOString();
    void persistSessions();
    notify();
  }
}
