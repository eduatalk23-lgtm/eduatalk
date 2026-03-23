"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions<T> = {
  data: T;
  onSave: (data: T) => Promise<{ success: boolean; error?: string }>;
  debounceMs?: number;
  enabled?: boolean;
  maxRetries?: number;
};

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
  maxRetries = 3,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef(data);
  const initialDataRef = useRef(data);
  const isFirstRender = useRef(true);
  const retryCountRef = useRef(0);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    latestDataRef.current = data;
    isDirtyRef.current =
      JSON.stringify(data) !== JSON.stringify(initialDataRef.current);
  });

  const save = useCallback(async () => {
    setStatus("saving");
    setError(undefined);
    try {
      const result = await onSave(latestDataRef.current);
      if (result.success) {
        retryCountRef.current = 0;
        isDirtyRef.current = false;
        setStatus("saved");
        setLastSavedAt(new Date());
        savedTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
      } else if (retryCountRef.current < maxRetries) {
        // 지수 백오프 재시도
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        timerRef.current = setTimeout(() => { save(); }, delay);
      } else {
        retryCountRef.current = 0;
        setStatus("error");
        setError(result.error);
      }
    } catch (e) {
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        timerRef.current = setTimeout(() => { save(); }, delay);
      } else {
        retryCountRef.current = 0;
        setStatus("error");
        setError(e instanceof Error ? e.message : "저장 실패");
      }
    }
  }, [onSave, maxRetries]);

  // 자동 저장 debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      initialDataRef.current = data;
      return;
    }

    if (!enabled) return;
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

  // enabled=false 시 pending timer 즉시 취소 (확정 직후 draft 덮어쓰기 방지)
  useEffect(() => {
    if (!enabled && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [enabled]);

  // beforeunload: 미저장 변경사항 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current || status === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // visibilitychange: 탭 전환 시 즉시 저장
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden" && isDirtyRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        save();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [save]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  return { status, error, lastSavedAt, saveNow: save };
}
