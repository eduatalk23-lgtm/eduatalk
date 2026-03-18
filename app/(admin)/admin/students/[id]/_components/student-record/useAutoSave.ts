"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions<T> = {
  data: T;
  onSave: (data: T) => Promise<{ success: boolean; error?: string }>;
  debounceMs?: number;
  enabled?: boolean;
};

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef(data);
  const initialDataRef = useRef(data);
  const isFirstRender = useRef(true);

  useEffect(() => {
    latestDataRef.current = data;
  });

  const save = useCallback(async () => {
    setStatus("saving");
    setError(undefined);
    try {
      const result = await onSave(latestDataRef.current);
      if (result.success) {
        setStatus("saved");
        // Reset to idle after 2s
        savedTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        setError(result.error);
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }, [onSave]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      initialDataRef.current = data;
      return;
    }

    if (!enabled) return;

    // Don't auto-save if data hasn't changed from initial
    if (JSON.stringify(data) === JSON.stringify(initialDataRef.current)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    timerRef.current = setTimeout(() => {
      save();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, debounceMs, enabled, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  return { status, error, saveNow: save };
}
