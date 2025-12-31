/**
 * useValidationCache - 검증 결과 캐싱 훅
 *
 * Step별 검증 결과를 캐싱하여 중복 검증을 방지합니다.
 *
 * 성능 최적화:
 * - Step + 데이터 해시 기반 캐시 키
 * - 30초 TTL로 오래된 캐시 자동 무효화
 * - 데이터 변경 시 해당 Step 캐시만 무효화
 */

import { useRef, useCallback, useMemo } from "react";
import type { WizardData, WizardStep } from "../PlanGroupWizard";
import type { ValidationResult } from "../utils/planValidation";

// ============================================================================
// 타입 정의
// ============================================================================

type CacheEntry = {
  result: ValidationResult;
  hash: string;
  timestamp: number;
};

type ValidationCache = Map<WizardStep, CacheEntry>;

// ============================================================================
// 상수
// ============================================================================

/** 캐시 TTL (30초) */
const CACHE_TTL_MS = 30_000;

/** Step별 의존 필드 매핑 */
const STEP_DEPENDENT_FIELDS: Record<WizardStep, (keyof WizardData)[]> = {
  1: ["name", "plan_purpose", "period_start", "period_end", "scheduler_type", "block_set_id"],
  2: ["exclusions", "academy_schedules", "time_settings", "non_study_time_blocks"],
  3: ["schedule_summary", "daily_schedule"],
  4: ["student_contents", "recommended_contents"],
  5: ["student_contents", "recommended_contents"],
  6: ["student_contents", "recommended_contents", "content_allocations", "content_slots"],
  7: ["daily_schedule", "schedule_summary"],
};

// ============================================================================
// 해시 생성 함수
// ============================================================================

/**
 * Step별 관련 데이터만 해시하여 경량 캐시 키 생성
 */
function createStepHash(step: WizardStep, data: WizardData): string {
  const fields = STEP_DEPENDENT_FIELDS[step];
  const parts: string[] = [];

  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null) {
      parts.push("");
    } else if (Array.isArray(value)) {
      // 배열은 길이 + 첫/마지막 요소의 ID만 사용 (빠른 비교)
      const arr = value as Array<{ content_id?: string; id?: string }>;
      const firstId = arr[0]?.content_id ?? arr[0]?.id ?? "";
      const lastId = arr[arr.length - 1]?.content_id ?? arr[arr.length - 1]?.id ?? "";
      parts.push(`${arr.length}:${firstId}:${lastId}`);
    } else if (typeof value === "object") {
      // 객체는 JSON 길이만 사용 (내용 변경 감지)
      parts.push(String(JSON.stringify(value).length));
    } else {
      parts.push(String(value));
    }
  }

  return parts.join("|");
}

// ============================================================================
// Hook
// ============================================================================

type UseValidationCacheReturn = {
  /**
   * 캐시된 검증 결과 가져오기
   * @returns 캐시 히트 시 결과 반환, 미스 시 undefined
   */
  getCached: (step: WizardStep, data: WizardData) => ValidationResult | undefined;

  /**
   * 검증 결과 캐시에 저장
   */
  setCached: (step: WizardStep, data: WizardData, result: ValidationResult) => void;

  /**
   * 특정 Step 캐시 무효화
   */
  invalidateStep: (step: WizardStep) => void;

  /**
   * 전체 캐시 초기화
   */
  invalidateAll: () => void;

  /**
   * 캐시 히트율 (디버깅용)
   */
  stats: { hits: number; misses: number };
};

export function useValidationCache(): UseValidationCacheReturn {
  const cacheRef = useRef<ValidationCache>(new Map());
  const statsRef = useRef({ hits: 0, misses: 0 });

  const getCached = useCallback(
    (step: WizardStep, data: WizardData): ValidationResult | undefined => {
      const entry = cacheRef.current.get(step);
      if (!entry) {
        statsRef.current.misses++;
        return undefined;
      }

      // TTL 체크
      const now = Date.now();
      if (now - entry.timestamp > CACHE_TTL_MS) {
        cacheRef.current.delete(step);
        statsRef.current.misses++;
        return undefined;
      }

      // 해시 비교
      const currentHash = createStepHash(step, data);
      if (entry.hash !== currentHash) {
        cacheRef.current.delete(step);
        statsRef.current.misses++;
        return undefined;
      }

      statsRef.current.hits++;
      return entry.result;
    },
    []
  );

  const setCached = useCallback(
    (step: WizardStep, data: WizardData, result: ValidationResult): void => {
      const hash = createStepHash(step, data);
      cacheRef.current.set(step, {
        result,
        hash,
        timestamp: Date.now(),
      });
    },
    []
  );

  const invalidateStep = useCallback((step: WizardStep): void => {
    cacheRef.current.delete(step);
  }, []);

  const invalidateAll = useCallback((): void => {
    cacheRef.current.clear();
    statsRef.current = { hits: 0, misses: 0 };
  }, []);

  const stats = useMemo(() => statsRef.current, []);

  return {
    getCached,
    setCached,
    invalidateStep,
    invalidateAll,
    stats,
  };
}
