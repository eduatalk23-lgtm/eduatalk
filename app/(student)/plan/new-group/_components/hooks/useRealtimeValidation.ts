/**
 * useRealtimeValidation - 실시간 필드 검증 훅
 *
 * 성능 최적화:
 * - 500ms 디바운스로 과도한 검증 방지
 * - requestIdleCallback으로 메인 스레드 블로킹 방지
 * - 필드별 독립 검증으로 전체 재검증 방지
 *
 * 사용 시 UX 개선:
 * - 입력 중 실시간 피드백 제공
 * - 에러 발견 시간 50% 단축 예상
 */

import { useRef, useCallback, useEffect } from "react";
import type { WizardData } from "@/lib/schemas/planWizardSchema";
import {
  STEP1_MESSAGES,
  STEP4_MESSAGES,
} from "@/lib/validation/wizardErrorMessages";

// ============================================================================
// 타입 정의
// ============================================================================

export type FieldValidationResult = {
  isValid: boolean;
  error?: string;
  warning?: string;
};

export type FieldValidationMap = Map<string, FieldValidationResult>;

export type RealtimeValidationConfig = {
  /** 디바운스 지연 시간 (ms) */
  debounceMs?: number;
  /** 경고만 표시 (에러 메시지 표시 안함) */
  warningsOnly?: boolean;
  /** 검증 필드 목록 (없으면 모든 필드 검증) */
  fields?: string[];
};

// ============================================================================
// 필드별 검증 함수
// ============================================================================

const FIELD_VALIDATORS: Record<
  string,
  (value: unknown, data: WizardData) => FieldValidationResult
> = {
  // Step 1 필드들
  name: (value) => {
    const name = value as string;
    if (!name || name.trim() === "") {
      return { isValid: false, error: STEP1_MESSAGES.NAME_REQUIRED };
    }
    if (name.length > 50) {
      return { isValid: false, error: STEP1_MESSAGES.NAME_TOO_LONG };
    }
    return { isValid: true };
  },

  period_start: (value, data) => {
    const start = value as string;
    if (!start) {
      return { isValid: false, error: STEP1_MESSAGES.PERIOD_REQUIRED };
    }
    if (data.period_end) {
      const startDate = new Date(start);
      const endDate = new Date(data.period_end);
      if (startDate > endDate) {
        return { isValid: false, error: STEP1_MESSAGES.PERIOD_INVALID };
      }
    }
    return { isValid: true };
  },

  period_end: (value, data) => {
    const end = value as string;
    if (!end) {
      return { isValid: false, error: STEP1_MESSAGES.PERIOD_REQUIRED };
    }
    if (data.period_start) {
      const startDate = new Date(data.period_start);
      const endDate = new Date(end);
      if (startDate > endDate) {
        return { isValid: false, error: STEP1_MESSAGES.PERIOD_INVALID };
      }
      // 기간 길이 경고
      const diffDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays > 90) {
        return {
          isValid: true,
          warning: "학습 기간이 90일을 초과합니다. 중간 점검을 권장합니다.",
        };
      }
    }
    return { isValid: true };
  },

  // Step 4 필드들
  student_contents: (value) => {
    const contents = value as unknown[];
    if (!contents || contents.length === 0) {
      return { isValid: false, error: STEP4_MESSAGES.CONTENT_REQUIRED };
    }
    if (contents.length > 9) {
      return { isValid: false, error: STEP4_MESSAGES.CONTENT_LIMIT_EXCEEDED };
    }
    if (contents.length < 2) {
      return {
        isValid: true,
        warning: "콘텐츠가 1개만 선택되었습니다. 더 추가해보세요.",
      };
    }
    return { isValid: true };
  },
};

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * requestIdleCallback 폴리필 (Safari 미지원)
 */
const scheduleIdleCallback = (cb: IdleRequestCallback): number => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    return window.requestIdleCallback(cb);
  }
  return setTimeout(cb, 1) as unknown as number;
};

const cancelIdleCallback = (id: number): void => {
  if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

// ============================================================================
// 메인 훅
// ============================================================================

type UseRealtimeValidationProps = {
  wizardData: WizardData;
  config?: RealtimeValidationConfig;
  onValidationChange?: (results: FieldValidationMap) => void;
};

type UseRealtimeValidationReturn = {
  /** 필드별 검증 결과 */
  fieldResults: FieldValidationMap;
  /** 특정 필드 즉시 검증 */
  validateField: (fieldName: string) => FieldValidationResult | null;
  /** 모든 필드 검증 */
  validateAllFields: () => FieldValidationMap;
  /** 검증 결과 초기화 */
  clearResults: () => void;
  /** 에러가 있는 필드 수 */
  errorCount: number;
  /** 경고가 있는 필드 수 */
  warningCount: number;
};

export function useRealtimeValidation({
  wizardData,
  config = {},
  onValidationChange,
}: UseRealtimeValidationProps): UseRealtimeValidationReturn {
  const { debounceMs = 500, warningsOnly = false, fields } = config;

  // 상태 관리
  const resultsRef = useRef<FieldValidationMap>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCallbackRef = useRef<number | null>(null);
  const prevDataRef = useRef<WizardData | null>(null);

  /**
   * 단일 필드 검증
   */
  const validateField = useCallback(
    (fieldName: string): FieldValidationResult | null => {
      const validator = FIELD_VALIDATORS[fieldName];
      if (!validator) return null;

      const value = (wizardData as Record<string, unknown>)[fieldName];
      const result = validator(value, wizardData);

      // warningsOnly 모드에서는 에러를 경고로 변환
      if (warningsOnly && result.error) {
        return {
          isValid: true,
          warning: result.error,
        };
      }

      return result;
    },
    [wizardData, warningsOnly]
  );

  /**
   * 모든 필드 검증
   */
  const validateAllFields = useCallback((): FieldValidationMap => {
    const results = new Map<string, FieldValidationResult>();
    const fieldsToValidate = fields || Object.keys(FIELD_VALIDATORS);

    for (const fieldName of fieldsToValidate) {
      const result = validateField(fieldName);
      if (result) {
        results.set(fieldName, result);
      }
    }

    resultsRef.current = results;
    onValidationChange?.(results);
    return results;
  }, [fields, validateField, onValidationChange]);

  /**
   * 검증 결과 초기화
   */
  const clearResults = useCallback(() => {
    resultsRef.current = new Map();
    onValidationChange?.(resultsRef.current);
  }, [onValidationChange]);

  /**
   * 데이터 변경 감지 및 디바운스 검증
   */
  useEffect(() => {
    // 초기 렌더링 스킵
    if (!prevDataRef.current) {
      prevDataRef.current = wizardData;
      return;
    }

    // 변경된 필드 감지
    const changedFields: string[] = [];
    const fieldsToCheck = fields || Object.keys(FIELD_VALIDATORS);

    for (const fieldName of fieldsToCheck) {
      const prevValue = (prevDataRef.current as Record<string, unknown>)[
        fieldName
      ];
      const currValue = (wizardData as Record<string, unknown>)[fieldName];

      // 배열은 길이로 간단히 비교 (성능 최적화)
      if (Array.isArray(prevValue) && Array.isArray(currValue)) {
        if (prevValue.length !== currValue.length) {
          changedFields.push(fieldName);
        }
      } else if (prevValue !== currValue) {
        changedFields.push(fieldName);
      }
    }

    prevDataRef.current = wizardData;

    // 변경된 필드가 없으면 스킵
    if (changedFields.length === 0) return;

    // 기존 타이머/콜백 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (idleCallbackRef.current) {
      cancelIdleCallback(idleCallbackRef.current);
    }

    // 디바운스 후 idle 타임에 검증 수행
    debounceTimerRef.current = setTimeout(() => {
      idleCallbackRef.current = scheduleIdleCallback(() => {
        const newResults = new Map(resultsRef.current);

        for (const fieldName of changedFields) {
          const result = validateField(fieldName);
          if (result) {
            newResults.set(fieldName, result);
          }
        }

        resultsRef.current = newResults;
        onValidationChange?.(newResults);
      });
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (idleCallbackRef.current) {
        cancelIdleCallback(idleCallbackRef.current);
      }
    };
  }, [wizardData, fields, debounceMs, validateField, onValidationChange]);

  // 에러/경고 카운트 계산
  let errorCount = 0;
  let warningCount = 0;
  resultsRef.current.forEach((result) => {
    if (result.error) errorCount++;
    if (result.warning) warningCount++;
  });

  return {
    fieldResults: resultsRef.current,
    validateField,
    validateAllFields,
    clearResults,
    errorCount,
    warningCount,
  };
}
