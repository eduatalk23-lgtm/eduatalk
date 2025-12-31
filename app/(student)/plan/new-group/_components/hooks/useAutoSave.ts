/**
 * useAutoSave - 오토세이브 훅
 *
 * 위저드 데이터 변경 시 자동으로 임시 저장을 수행합니다.
 *
 * - 2초 디바운스
 * - 저장 상태 표시 (idle, saving, saved, error)
 * - 네트워크 오류 처리
 * - 언마운트 시 저장 취소
 *
 * 성능 최적화:
 * - useMemo로 해시 계산 메모이제이션
 * - JSON.stringify 제거 → 문자열 연결 방식
 * - initialHash 캐싱으로 재계산 방지
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import type { WizardData } from "../PlanGroupWizard";
import { autoSaveLogger } from "../utils/wizardLogger";

/** 오토세이브 상태 */
export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

/** 오토세이브 설정 */
export type UseAutoSaveOptions = {
  /** 디바운스 딜레이 (밀리초), 기본값 2000ms */
  debounceMs?: number;
  /** 오토세이브 활성화 여부, 기본값 true */
  enabled?: boolean;
  /** 저장 후 "saved" 상태 표시 시간 (밀리초), 기본값 2000ms */
  savedStatusDurationMs?: number;
};

/** 오토세이브 훅 Props */
type UseAutoSaveProps = {
  /** 저장할 위저드 데이터 */
  data: WizardData;
  /** 초기 데이터 (변경 감지용) */
  initialData?: WizardData | null;
  /** Draft Group ID (신규면 null) */
  draftGroupId: string | null;
  /** 저장 함수 */
  saveFn: (silent?: boolean) => Promise<void>;
  /** 옵션 */
  options?: UseAutoSaveOptions;
};

/** 오토세이브 훅 반환값 */
type UseAutoSaveReturn = {
  /** 현재 저장 상태 */
  status: AutoSaveStatus;
  /** 마지막 저장 시간 */
  lastSavedAt: Date | null;
  /** 수동 저장 트리거 */
  triggerSave: () => Promise<void>;
  /** 저장 중 여부 */
  isSaving: boolean;
};

// ============================================================================
// 경량 해시 생성 (JSON.stringify 없음)
// ============================================================================

/**
 * 데이터 변경 감지를 위한 경량 해시 생성
 *
 * JSON.stringify 대신 문자열 연결을 사용하여 성능 향상
 * - JSON.stringify: O(n) + 메모리 할당 오버헤드
 * - 문자열 연결: O(n) 단순 연결만
 */
function createDataHash(data: WizardData): string {
  // 핵심 스칼라 필드 (변경이 잦은 필드 우선)
  const scalarPart = [
    data.name ?? "",
    data.plan_purpose ?? "",
    data.period_start ?? "",
    data.period_end ?? "",
    data.scheduler_type ?? "",
    data.block_set_id ?? "",
  ].join("|");

  // 배열 길이 (빠른 변경 감지)
  const lengthPart = [
    data.student_contents?.length ?? 0,
    data.recommended_contents?.length ?? 0,
    data.exclusions?.length ?? 0,
    data.academy_schedules?.length ?? 0,
  ].join(",");

  // 콘텐츠 ID (Set 사용으로 순서 무관 비교)
  // 정렬된 ID 목록으로 순서에 관계없이 동일 콘텐츠면 같은 해시
  const studentContentIds = data.student_contents
    ?.map((c) => `${c.content_id}:${c.start_range ?? 0}-${c.end_range ?? 0}`)
    .sort()
    .join(",") ?? "";

  const recommendedContentIds = data.recommended_contents
    ?.map((c) => `${c.content_id}:${c.start_range ?? 0}-${c.end_range ?? 0}`)
    .sort()
    .join(",") ?? "";

  return `${scalarPart}#${lengthPart}#${studentContentIds}#${recommendedContentIds}`;
}

/**
 * useAutoSave 훅
 *
 * 위저드 데이터 변경 시 자동으로 임시 저장을 수행합니다.
 */
export function useAutoSave({
  data,
  initialData,
  draftGroupId,
  saveFn,
  options = {},
}: UseAutoSaveProps): UseAutoSaveReturn {
  const {
    debounceMs = 2000,
    enabled = true,
    savedStatusDurationMs = 2000,
  } = options;

  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // 마지막 저장된 데이터 해시 (중복 저장 방지)
  const lastSavedHashRef = useRef<string | null>(null);
  // 마운트 여부 추적
  const isMountedRef = useRef(true);
  // 저장 중 여부
  const isSavingRef = useRef(false);
  // initialData 해시 캐싱 (한 번만 계산)
  const initialHashRef = useRef<string | null>(null);

  // initialData 해시 캐싱 (첫 렌더링 시에만 계산)
  if (initialData && initialHashRef.current === null) {
    initialHashRef.current = createDataHash(initialData);
  }

  // 현재 데이터 해시 (useMemo로 메모이제이션)
  // 의존성: 핵심 필드만 추적하여 불필요한 재계산 방지
  const currentHash = useMemo(
    () => createDataHash(data),
    [
      data.name,
      data.plan_purpose,
      data.period_start,
      data.period_end,
      data.scheduler_type,
      data.block_set_id,
      data.student_contents,
      data.recommended_contents,
      data.exclusions,
      data.academy_schedules,
    ]
  );

  // 디바운스된 해시
  const debouncedHash = useDebounce(currentHash, debounceMs);

  // 저장 함수
  const performSave = useCallback(async () => {
    // 비활성화 상태거나 이미 저장 중이면 스킵
    if (!enabled || isSavingRef.current) {
      return;
    }

    // 마지막 저장과 동일하면 스킵
    if (lastSavedHashRef.current === currentHash) {
      return;
    }

    isSavingRef.current = true;
    setStatus("saving");

    try {
      await saveFn(true); // silent mode

      if (isMountedRef.current) {
        lastSavedHashRef.current = currentHash;
        setLastSavedAt(new Date());
        setStatus("saved");

        // 일정 시간 후 상태를 idle로 변경
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus("idle");
          }
        }, savedStatusDurationMs);
      }
    } catch (error) {
      autoSaveLogger.error("오토세이브 실패", error, { hook: "useAutoSave" });
      if (isMountedRef.current) {
        setStatus("error");

        // 에러 상태는 일정 시간 후 idle로 변경
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus("idle");
          }
        }, savedStatusDurationMs);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [enabled, currentHash, saveFn, savedStatusDurationMs]);

  // 수동 저장 트리거
  const triggerSave = useCallback(async () => {
    await performSave();
  }, [performSave]);

  // 디바운스된 해시가 변경되면 저장 실행
  useEffect(() => {
    // 비활성화 상태이거나 draftGroupId가 없으면 (신규) 스킵
    // 신규 저장은 명시적인 저장 버튼을 통해 수행
    if (!enabled || !draftGroupId) {
      return;
    }

    // 초기 데이터와 동일하면 스킵 (첫 로드 시)
    // 캐싱된 initialHash 사용 (재계산 방지)
    if (initialHashRef.current && debouncedHash === initialHashRef.current) {
      return;
    }

    // 마지막 저장과 동일하면 스킵
    if (lastSavedHashRef.current === debouncedHash) {
      return;
    }

    performSave();
  }, [debouncedHash, enabled, draftGroupId, performSave]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    status,
    lastSavedAt,
    triggerSave,
    isSaving: status === "saving",
  };
}
