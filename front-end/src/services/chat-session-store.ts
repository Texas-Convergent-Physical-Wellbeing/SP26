import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage as ApiChatMessage } from '@/services/api';

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

interface ChatSessionState {
  messages: ChatSessionMessage[];
  history: ApiChatMessage[];
  // Titles surfaced in this session AND across prior sessions (persisted).
  // Sent to the backend so the LLM is forbidden from repeating them.
  suggestedTitles: string[];
}

const STORAGE_KEY = 'nutriculture.chat.suggestedTitles.v1';
const MAX_PERSISTED_TITLES = 60;

const state: ChatSessionState = {
  messages: [],
  history: [],
  suggestedTitles: [],
};

const listeners = new Set<() => void>();
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

async function loadPersistedTitles(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Non-fatal: variety will still work within the current session.
  }
}

/** Hydrate the persisted suggested-titles list from AsyncStorage. Safe to call repeatedly. */
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
    hydrated = true;
    notify();
  })();
  return hydrationPromise;
}

export function getChatSession(): ChatSessionState {
  return state;
}

export function setChatMessages(messages: ChatSessionMessage[]) {
  state.messages = messages;
  notify();
}

export function setChatHistory(history: ApiChatMessage[]) {
  state.history = history;
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

/** Clears the in-memory conversation (keeps the persisted exclusion list). */
export function clearChatConversation() {
  state.messages = [];
  state.history = [];
  notify();
}

/** Nukes the persisted exclusion list too (for a "forget everything" reset). */
export async function resetChatSessionCompletely() {
  state.messages = [];
  state.history = [];
  state.suggestedTitles = [];
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
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
