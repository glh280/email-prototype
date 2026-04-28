"use client";

/**
 * SOURCE: new (no PROD source — L1 prototype-only AI settings store)
 * CREATED: 2026-04-28
 * STATUS: new
 *
 * Module-level subscribe-store for AI settings. Used by both the
 * Settings > AI panel (writer) and inbox2-shell openCompose (reader)
 * so toggling the master switch or `prependFileNoToSubject` updates
 * compose behaviour live without a route reload.
 *
 * Persisted via localStorage so a refresh keeps the operator's
 * choices. SSR-safe — initial read short-circuits to DEFAULT_AI_SETTINGS
 * when window is undefined.
 *
 * REINTEGRATION: replace at L2 with a per-workspace settings query
 * (`workspace_settings.ai` row) hydrated through a TanStack Query
 * provider. Admin role gate enforced server-side (this prototype gates
 * the Settings UI client-side via hasMultiInboxPrivilege()).
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_AI_SETTINGS, type AiSettings } from "@/mock/settings";

const STORAGE_KEY = "npr-ai-settings";

let current: AiSettings = readInitial();
const listeners = new Set<() => void>();

function readInitial(): AiSettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return { ...DEFAULT_AI_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function persist(next: AiSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded / blocked storage — non-fatal in L1.
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function getAiSettings(): AiSettings {
  return current;
}

export function setAiSetting<K extends keyof AiSettings>(
  key: K,
  value: AiSettings[K],
): void {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  persist(current);
  emit();
}

export function resetAiSettings(): void {
  current = { ...DEFAULT_AI_SETTINGS };
  persist(current);
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * React hook — subscribe to AI settings. Re-renders the calling
 * component whenever any setting changes (master or sub-toggle).
 */
export function useAiSettings(): AiSettings {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_AI_SETTINGS,
  );
}
