"use client";

/**
 * useAutoSave - 위저드 자동 저장 훅
 *
 * 위저드 데이터 변경 시 자동으로 드래프트를 저장
 * 디바운싱, 저장 상태 표시, 에러 처리 포함
 *
 * @module lib/wizard/hooks/useAutoSave
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { draftStorage, DraftStorageService } from "../services/draftStorage";
import type { UnifiedWizardData } from "../types";

// ============================================
// 타입 정의
// ============================================

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseAutoSaveOptions<T extends UnifiedWizardData> {
  /** 자동 저장 활성화 여부 (기본: true) */
  enabled?: boolean;
  /** 디바운스 시간 (밀리초, 기본: 2000) */
  debounceMs?: number;
  /** 드래프트 ID (기존 드래프트 업데이트 시) */
  draftId?: string;
  /** 사용자 ID */
  userId?: string;
  /** 드래프트 만료 시간 (밀리초) */
  ttl?: number;
  /** 추가 메타데이터 */
  extra?: Record<string, unknown>;
  /** 커스텀 저장소 서비스 */
  storageService?: DraftStorageService;
  /** 저장 전 데이터 변환 */
  transformBeforeSave?: (data: T) => T;
  /** 저장 완료 콜백 */
  onSaved?: (draftId: string) => void;
  /** 에러 콜백 */
  onError?: (error: Error) => void;
  /** 최소 저장 간격 (밀리초, 기본: 5000) */
  minSaveInterval?: number;
}

export interface UseAutoSaveResult {
  /** 현재 저장 상태 */
  status: AutoSaveStatus;
  /** 마지막 저장 시간 */
  lastSavedAt: Date | null;
  /** 현재 드래프트 ID */
  draftId: string | null;
  /** 수동 저장 트리거 */
  saveNow: () => Promise<void>;
  /** 드래프트 삭제 */
  clearDraft: () => Promise<void>;
  /** 저장 대기 중 여부 */
  isPending: boolean;
}

// ============================================
// 메인 훅
// ============================================

/**
 * useAutoSave
 *
 * 위저드 데이터를 자동으로 저장하는 훅
 *
 * @example
 * ```tsx
 * function MyWizard() {
 *   const { data, updateData } = useWizard();
 *   const { status, lastSavedAt, saveNow } = useAutoSave(data, {
 *     debounceMs: 3000,
 *     userId: "user-123",
 *     onSaved: (id) => console.log("Saved:", id),
 *   });
 *
 *   return (
 *     <div>
 *       {status === "saving" && <span>저장 중...</span>}
 *       {status === "saved" && <span>저장됨</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAutoSave<T extends UnifiedWizardData>(
  data: T,
  options: UseAutoSaveOptions<T> = {}
): UseAutoSaveResult {
  const {
    enabled = true,
    debounceMs = 2000,
    draftId: initialDraftId,
    userId,
    ttl,
    extra,
    storageService = draftStorage,
    transformBeforeSave,
    onSaved,
    onError,
    minSaveInterval = 5000,
  } = options;

  // 상태
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(
    initialDraftId || null
  );
  const [isPending, setIsPending] = useState(false);

  // Refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const dataRef = useRef<T>(data);
  const isMountedRef = useRef(true);

  // 최신 데이터 유지
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // 언마운트 처리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 저장 함수
  const performSave = useCallback(async () => {
    if (!isMountedRef.current) return;

    // 최소 저장 간격 확인
    const now = Date.now();
    if (now - lastSaveTimeRef.current < minSaveInterval) {
      return;
    }

    try {
      setStatus("saving");
      setIsPending(false);

      const dataToSave = transformBeforeSave
        ? transformBeforeSave(dataRef.current)
        : dataRef.current;

      const savedId = await storageService.save(dataToSave, {
        draftId: currentDraftId || undefined,
        userId,
        ttl,
        extra,
      });

      if (!isMountedRef.current) return;

      lastSaveTimeRef.current = now;
      setCurrentDraftId(savedId);
      setLastSavedAt(new Date());
      setStatus("saved");

      onSaved?.(savedId);

      // 3초 후 idle로 변경
      setTimeout(() => {
        if (isMountedRef.current) {
          setStatus("idle");
        }
      }, 3000);
    } catch (error) {
      if (!isMountedRef.current) return;

      setStatus("error");
      onError?.(error instanceof Error ? error : new Error(String(error)));

      // 5초 후 idle로 변경
      setTimeout(() => {
        if (isMountedRef.current) {
          setStatus("idle");
        }
      }, 5000);
    }
  }, [
    currentDraftId,
    userId,
    ttl,
    extra,
    storageService,
    transformBeforeSave,
    onSaved,
    onError,
    minSaveInterval,
  ]);

  // 디바운스 저장
  const debouncedSave = useCallback(() => {
    if (!enabled) return;

    setIsPending(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [enabled, debounceMs, performSave]);

  // 데이터 변경 감지
  useEffect(() => {
    if (!enabled) return;
    if (!data.meta.isDirty) return;

    debouncedSave();
  }, [data, enabled, debouncedSave]);

  // 수동 저장
  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await performSave();
  }, [performSave]);

  // 드래프트 삭제
  const clearDraft = useCallback(async () => {
    if (currentDraftId) {
      await storageService.delete(currentDraftId);
      setCurrentDraftId(null);
      setLastSavedAt(null);
      setStatus("idle");
    }
  }, [currentDraftId, storageService]);

  return {
    status,
    lastSavedAt,
    draftId: currentDraftId,
    saveNow,
    clearDraft,
    isPending,
  };
}
