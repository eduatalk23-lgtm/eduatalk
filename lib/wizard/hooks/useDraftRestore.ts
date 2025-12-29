"use client";

/**
 * useDraftRestore - 위저드 드래프트 복원 훅
 *
 * 저장된 드래프트를 감지하고 복원하는 훅
 * 복원 확인 다이얼로그 표시 지원
 *
 * @module lib/wizard/hooks/useDraftRestore
 */

import { useEffect, useState, useCallback } from "react";
import {
  draftStorage,
  DraftStorageService,
  type StoredDraft,
  type DraftMetadata,
} from "../services/draftStorage";
import type { UnifiedWizardData, WizardMode } from "../types";

// ============================================
// 타입 정의
// ============================================

export type DraftRestoreStatus =
  | "idle"
  | "checking"
  | "found"
  | "restoring"
  | "restored"
  | "dismissed";

export interface UseDraftRestoreOptions<T extends UnifiedWizardData> {
  /** 위저드 모드 */
  mode: WizardMode;
  /** 사용자 ID */
  userId?: string;
  /** 자동 복원 여부 (기본: false, true면 확인 없이 복원) */
  autoRestore?: boolean;
  /** 커스텀 저장소 서비스 */
  storageService?: DraftStorageService;
  /** 복원 후 데이터 변환 */
  transformAfterRestore?: (data: T) => T;
  /** 복원 완료 콜백 */
  onRestored?: (data: T, metadata: DraftMetadata) => void;
  /** 복원 거부 콜백 */
  onDismissed?: (metadata: DraftMetadata) => void;
}

export interface UseDraftRestoreResult<T extends UnifiedWizardData> {
  /** 현재 상태 */
  status: DraftRestoreStatus;
  /** 발견된 드래프트 */
  draft: StoredDraft<T> | null;
  /** 드래프트 복원 실행 */
  restore: () => Promise<T | null>;
  /** 드래프트 무시 (삭제하지 않음) */
  dismiss: () => void;
  /** 드래프트 무시 및 삭제 */
  dismissAndDelete: () => Promise<void>;
  /** 사용 가능한 드래프트 목록 */
  availableDrafts: DraftMetadata[];
  /** 특정 드래프트 선택하여 복원 */
  restoreById: (draftId: string) => Promise<T | null>;
}

// ============================================
// 메인 훅
// ============================================

/**
 * useDraftRestore
 *
 * 저장된 드래프트를 감지하고 복원하는 훅
 *
 * @example
 * ```tsx
 * function MyWizard() {
 *   const [wizardData, setWizardData] = useState<FullWizardData | null>(null);
 *
 *   const { status, draft, restore, dismiss } = useDraftRestore<FullWizardData>({
 *     mode: "full",
 *     userId: "user-123",
 *     onRestored: (data) => setWizardData(data),
 *   });
 *
 *   if (status === "found" && draft) {
 *     return (
 *       <DraftRestoreDialog
 *         savedAt={draft.metadata.savedAt}
 *         onRestore={restore}
 *         onDismiss={dismiss}
 *       />
 *     );
 *   }
 *
 *   return <WizardContent data={wizardData} />;
 * }
 * ```
 */
export function useDraftRestore<T extends UnifiedWizardData>(
  options: UseDraftRestoreOptions<T>
): UseDraftRestoreResult<T> {
  const {
    mode,
    userId,
    autoRestore = false,
    storageService = draftStorage,
    transformAfterRestore,
    onRestored,
    onDismissed,
  } = options;

  // 상태
  const [status, setStatus] = useState<DraftRestoreStatus>("idle");
  const [draft, setDraft] = useState<StoredDraft<T> | null>(null);
  const [availableDrafts, setAvailableDrafts] = useState<DraftMetadata[]>([]);

  // 드래프트 확인
  useEffect(() => {
    let isMounted = true;

    async function checkForDraft() {
      setStatus("checking");

      try {
        // 해당 모드의 최신 드래프트 조회
        const found = await storageService.getLatestByMode<T>(mode, userId);

        if (!isMounted) return;

        if (found) {
          setDraft(found);
          setStatus("found");

          // 자동 복원
          if (autoRestore) {
            const restoredData = transformAfterRestore
              ? transformAfterRestore(found.data)
              : found.data;

            setStatus("restored");
            onRestored?.(restoredData, found.metadata);
          }
        } else {
          setStatus("idle");
        }

        // 모든 드래프트 목록도 조회
        const allDrafts = await storageService.list(userId);
        if (isMounted) {
          setAvailableDrafts(
            allDrafts.filter((d) => d.mode === mode)
          );
        }
      } catch (error) {
        console.error("[DraftRestore] 드래프트 확인 실패:", error);
        if (isMounted) {
          setStatus("idle");
        }
      }
    }

    checkForDraft();

    return () => {
      isMounted = false;
    };
  }, [mode, userId, autoRestore, storageService, transformAfterRestore, onRestored]);

  // 드래프트 복원
  const restore = useCallback(async (): Promise<T | null> => {
    if (!draft) return null;

    setStatus("restoring");

    try {
      const restoredData = transformAfterRestore
        ? transformAfterRestore(draft.data)
        : draft.data;

      setStatus("restored");
      onRestored?.(restoredData, draft.metadata);

      return restoredData;
    } catch (error) {
      console.error("[DraftRestore] 드래프트 복원 실패:", error);
      setStatus("idle");
      return null;
    }
  }, [draft, transformAfterRestore, onRestored]);

  // ID로 드래프트 복원
  const restoreById = useCallback(
    async (draftId: string): Promise<T | null> => {
      setStatus("restoring");

      try {
        const found = await storageService.load<T>(draftId);

        if (!found) {
          setStatus("idle");
          return null;
        }

        const restoredData = transformAfterRestore
          ? transformAfterRestore(found.data)
          : found.data;

        setDraft(found);
        setStatus("restored");
        onRestored?.(restoredData, found.metadata);

        return restoredData;
      } catch (error) {
        console.error("[DraftRestore] 드래프트 복원 실패:", error);
        setStatus("idle");
        return null;
      }
    },
    [storageService, transformAfterRestore, onRestored]
  );

  // 드래프트 무시 (삭제하지 않음)
  const dismiss = useCallback(() => {
    if (draft) {
      onDismissed?.(draft.metadata);
    }
    setStatus("dismissed");
    setDraft(null);
  }, [draft, onDismissed]);

  // 드래프트 무시 및 삭제
  const dismissAndDelete = useCallback(async () => {
    if (draft) {
      await storageService.delete(draft.metadata.id);
      onDismissed?.(draft.metadata);

      // 목록 업데이트
      setAvailableDrafts((prev) =>
        prev.filter((d) => d.id !== draft.metadata.id)
      );
    }
    setStatus("dismissed");
    setDraft(null);
  }, [draft, storageService, onDismissed]);

  return {
    status,
    draft,
    restore,
    dismiss,
    dismissAndDelete,
    availableDrafts,
    restoreById,
  };
}
