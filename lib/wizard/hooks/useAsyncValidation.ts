"use client";

/**
 * useAsyncValidation - 위저드 비동기 검증 훅
 *
 * 비동기 검증 상태 관리 및 실행을 위한 훅
 * 필드별 검증 상태 추적, 전체 검증 상태 집계 지원
 *
 * @module lib/wizard/hooks/useAsyncValidation
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  AsyncValidationService,
  asyncValidation as defaultService,
  type AsyncValidator,
  type AsyncValidationStatus,
  type AsyncValidationResult,
  type AsyncValidationConfig,
} from "../services/asyncValidation";
import type { UnifiedWizardData, FieldError } from "../types";

// ============================================
// 타입 정의
// ============================================

export interface UseAsyncValidationOptions<T extends UnifiedWizardData> {
  /** 사용할 비동기 검증 서비스 */
  service?: AsyncValidationService<T>;
  /** 초기 검증기 목록 */
  validators?: AsyncValidator<T>[];
  /** 서비스 설정 */
  config?: AsyncValidationConfig;
  /** 자동 검증 활성화 (데이터 변경 시) */
  autoValidate?: boolean;
  /** 자동 검증할 필드 경로들 */
  autoValidateFields?: string[];
  /** 검증 완료 콜백 */
  onValidationComplete?: (
    validatorId: string,
    result: AsyncValidationResult
  ) => void;
  /** 에러 콜백 */
  onError?: (validatorId: string, error: Error) => void;
}

export interface FieldValidationState {
  /** 필드 경로 */
  fieldPath: string;
  /** 검증 상태 */
  status: AsyncValidationStatus;
  /** 에러 목록 */
  errors: FieldError[];
  /** 마지막 검증 시간 */
  lastValidatedAt?: Date;
  /** 검증 소요 시간 (ms) */
  duration?: number;
}

export interface UseAsyncValidationResult<T extends UnifiedWizardData> {
  /** 필드별 검증 상태 */
  fieldStates: Map<string, FieldValidationState>;
  /** 전체 검증 상태 */
  overallStatus: AsyncValidationStatus;
  /** 전체 에러 목록 */
  allErrors: FieldError[];
  /** 검증 진행 중 여부 */
  isValidating: boolean;
  /** 모든 검증 통과 여부 */
  isAllValid: boolean;
  /** 특정 필드 검증 */
  validateField: (
    fieldPath: string,
    value: unknown,
    data: T
  ) => Promise<AsyncValidationResult[]>;
  /** 특정 검증기 실행 */
  validateById: (
    validatorId: string,
    value: unknown,
    data: T
  ) => Promise<AsyncValidationResult>;
  /** 모든 검증기 실행 */
  validateAll: (
    data: T,
    validatorIds?: string[]
  ) => Promise<Map<string, AsyncValidationResult>>;
  /** 검증 취소 */
  cancel: (validatorId?: string) => void;
  /** 캐시 무효화 */
  invalidate: (validatorIdOrFieldPath?: string) => void;
  /** 검증기 등록 */
  register: (validator: AsyncValidator<T>) => void;
  /** 검증기 제거 */
  unregister: (validatorId: string) => void;
  /** 필드 에러 조회 */
  getFieldErrors: (fieldPath: string) => FieldError[];
  /** 필드 상태 조회 */
  getFieldStatus: (fieldPath: string) => AsyncValidationStatus;
  /** 상태 리셋 */
  reset: () => void;
}

// ============================================
// 유틸리티 함수
// ============================================

function getOverallStatus(
  states: Map<string, FieldValidationState>
): AsyncValidationStatus {
  const statuses = Array.from(states.values()).map((s) => s.status);

  if (statuses.length === 0) return "idle";
  if (statuses.some((s) => s === "error")) return "error";
  if (statuses.some((s) => s === "validating")) return "validating";
  if (statuses.some((s) => s === "pending")) return "pending";
  if (statuses.some((s) => s === "invalid")) return "invalid";
  if (statuses.every((s) => s === "valid")) return "valid";

  return "idle";
}

function collectAllErrors(states: Map<string, FieldValidationState>): FieldError[] {
  const errors: FieldError[] = [];

  for (const state of states.values()) {
    errors.push(...state.errors);
  }

  return errors;
}

// ============================================
// 메인 훅
// ============================================

/**
 * useAsyncValidation
 *
 * 비동기 검증을 관리하는 훅
 *
 * @example
 * ```tsx
 * function MyWizard() {
 *   const { data, updateData } = useWizard<FullWizardData>();
 *
 *   const {
 *     fieldStates,
 *     isValidating,
 *     validateField,
 *     getFieldErrors,
 *   } = useAsyncValidation({
 *     validators: [
 *       createUniquenessValidator({
 *         id: "name-unique",
 *         fieldPath: "basicInfo.name",
 *         checkUnique: async (value) => {
 *           const res = await fetch(`/api/check-name?name=${value}`);
 *           return (await res.json()).isUnique;
 *         },
 *       }),
 *     ],
 *     onValidationComplete: (id, result) => {
 *       console.log(`Validation ${id}:`, result);
 *     },
 *   });
 *
 *   const handleNameChange = async (name: string) => {
 *     updateData({ basicInfo: { name } });
 *     await validateField("basicInfo.name", name, data);
 *   };
 *
 *   return (
 *     <input
 *       value={data.basicInfo.name}
 *       onChange={(e) => handleNameChange(e.target.value)}
 *     />
 *     {getFieldErrors("basicInfo.name").map((err, i) => (
 *       <span key={i} className="text-red-500">{err.message}</span>
 *     ))}
 *   );
 * }
 * ```
 */
export function useAsyncValidation<T extends UnifiedWizardData>(
  options: UseAsyncValidationOptions<T> = {}
): UseAsyncValidationResult<T> {
  const {
    service: providedService,
    validators = [],
    config,
    autoValidate = false,
    autoValidateFields = [],
    onValidationComplete,
    onError,
  } = options;

  // 서비스 인스턴스 관리
  const serviceRef = useRef<AsyncValidationService<T> | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = providedService
      ? providedService
      : config
      ? new AsyncValidationService<T>(config)
      : (defaultService as AsyncValidationService<T>);
  }
  const service = serviceRef.current;

  // 상태
  const [fieldStates, setFieldStates] = useState<
    Map<string, FieldValidationState>
  >(new Map());
  const [registeredValidators, setRegisteredValidators] = useState<Set<string>>(
    new Set()
  );

  // 마운트 추적
  const isMountedRef = useRef(true);

  // 초기 검증기 등록
  useEffect(() => {
    for (const validator of validators) {
      if (!registeredValidators.has(validator.id)) {
        service.register(validator);
        setRegisteredValidators((prev) => new Set([...prev, validator.id]));
      }
    }
  }, [validators, registeredValidators, service]);

  // 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      service.cancelAll();
    };
  }, [service]);

  // 필드 상태 업데이트
  const updateFieldState = useCallback(
    (fieldPath: string, update: Partial<FieldValidationState>) => {
      if (!isMountedRef.current) return;

      setFieldStates((prev) => {
        const newStates = new Map(prev);
        const existing = newStates.get(fieldPath) || {
          fieldPath,
          status: "idle" as AsyncValidationStatus,
          errors: [],
        };
        newStates.set(fieldPath, { ...existing, ...update });
        return newStates;
      });
    },
    []
  );

  // 검증기 실행
  const validateById = useCallback(
    async (
      validatorId: string,
      value: unknown,
      data: T
    ): Promise<AsyncValidationResult> => {
      // 검증기에서 필드 경로 찾기
      const validatorFieldPath = validators.find(
        (v) => v.id === validatorId
      )?.fieldPath;

      if (validatorFieldPath) {
        updateFieldState(validatorFieldPath, { status: "pending" });
      }

      try {
        const result = await service.validateImmediate(validatorId, value, data);

        if (isMountedRef.current && validatorFieldPath) {
          updateFieldState(validatorFieldPath, {
            status: result.status,
            errors: result.errors || [],
            lastValidatedAt: new Date(),
            duration: result.duration,
          });
        }

        onValidationComplete?.(validatorId, result);

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(validatorId, err);

        if (isMountedRef.current && validatorFieldPath) {
          updateFieldState(validatorFieldPath, {
            status: "error",
            errors: [{ field: validatorFieldPath, message: err.message, severity: "error" as const }],
          });
        }

        return {
          isValid: false,
          errors: [
            {
              field: validatorFieldPath || validatorId,
              message: err.message,
              severity: "error" as const,
            },
          ],
          warnings: [],
          status: "error",
        };
      }
    },
    [service, validators, updateFieldState, onValidationComplete, onError]
  );

  // 필드 검증
  const validateField = useCallback(
    async (
      fieldPath: string,
      value: unknown,
      data: T
    ): Promise<AsyncValidationResult[]> => {
      updateFieldState(fieldPath, { status: "pending" });

      const results = await service.validateByField(fieldPath, value, data);

      if (isMountedRef.current) {
        const errors = results.flatMap((r) => r.errors || []);
        const hasError = results.some((r) => r.status === "error");
        const hasInvalid = results.some((r) => r.status === "invalid");

        let status: AsyncValidationStatus = "valid";
        if (hasError) status = "error";
        else if (hasInvalid) status = "invalid";

        updateFieldState(fieldPath, {
          status,
          errors,
          lastValidatedAt: new Date(),
          duration: Math.max(...results.map((r) => r.duration || 0)),
        });
      }

      return results;
    },
    [service, updateFieldState]
  );

  // 전체 검증
  const validateAll = useCallback(
    async (
      data: T,
      validatorIds?: string[]
    ): Promise<Map<string, AsyncValidationResult>> => {
      const ids = validatorIds || Array.from(registeredValidators);

      // 모든 필드 pending 설정
      for (const id of ids) {
        const validator = validators.find((v) => v.id === id);
        if (validator) {
          updateFieldState(validator.fieldPath, { status: "pending" });
        }
      }

      const results = await service.validateAll(ids, data);

      // 결과 적용
      for (const [id, result] of results) {
        const validator = validators.find((v) => v.id === id);
        if (validator && isMountedRef.current) {
          updateFieldState(validator.fieldPath, {
            status: result.status,
            errors: result.errors || [],
            lastValidatedAt: new Date(),
            duration: result.duration,
          });
        }
      }

      return results;
    },
    [service, registeredValidators, validators, updateFieldState]
  );

  // 취소
  const cancel = useCallback(
    (validatorId?: string) => {
      if (validatorId) {
        service.cancelPending(validatorId);
        const validator = validators.find((v) => v.id === validatorId);
        if (validator) {
          updateFieldState(validator.fieldPath, { status: "idle" });
        }
      } else {
        service.cancelAll();
        setFieldStates(new Map());
      }
    },
    [service, validators, updateFieldState]
  );

  // 캐시 무효화
  const invalidate = useCallback(
    (validatorIdOrFieldPath?: string) => {
      if (!validatorIdOrFieldPath) {
        service.invalidateCache();
        return;
      }

      // 먼저 검증기 ID로 시도
      if (registeredValidators.has(validatorIdOrFieldPath)) {
        service.invalidateCache(validatorIdOrFieldPath);
      } else {
        // 필드 경로로 의존 캐시 무효화
        service.invalidateDependentCaches(validatorIdOrFieldPath);
      }
    },
    [service, registeredValidators]
  );

  // 검증기 등록
  const register = useCallback(
    (validator: AsyncValidator<T>) => {
      service.register(validator);
      setRegisteredValidators((prev) => new Set([...prev, validator.id]));
    },
    [service]
  );

  // 검증기 제거
  const unregister = useCallback(
    (validatorId: string) => {
      service.unregister(validatorId);
      setRegisteredValidators((prev) => {
        const next = new Set(prev);
        next.delete(validatorId);
        return next;
      });

      const validator = validators.find((v) => v.id === validatorId);
      if (validator) {
        setFieldStates((prev) => {
          const next = new Map(prev);
          next.delete(validator.fieldPath);
          return next;
        });
      }
    },
    [service, validators]
  );

  // 필드 에러 조회
  const getFieldErrors = useCallback(
    (fieldPath: string): FieldError[] => {
      return fieldStates.get(fieldPath)?.errors || [];
    },
    [fieldStates]
  );

  // 필드 상태 조회
  const getFieldStatus = useCallback(
    (fieldPath: string): AsyncValidationStatus => {
      return fieldStates.get(fieldPath)?.status || "idle";
    },
    [fieldStates]
  );

  // 상태 리셋
  const reset = useCallback(() => {
    service.cancelAll();
    service.invalidateCache();
    setFieldStates(new Map());
  }, [service]);

  // 계산된 값
  const overallStatus = useMemo(
    () => getOverallStatus(fieldStates),
    [fieldStates]
  );

  const allErrors = useMemo(
    () => collectAllErrors(fieldStates),
    [fieldStates]
  );

  const isValidating = useMemo(
    () => overallStatus === "validating" || overallStatus === "pending",
    [overallStatus]
  );

  const isAllValid = useMemo(
    () => overallStatus === "valid" && fieldStates.size > 0,
    [overallStatus, fieldStates]
  );

  return {
    fieldStates,
    overallStatus,
    allErrors,
    isValidating,
    isAllValid,
    validateField,
    validateById,
    validateAll,
    cancel,
    invalidate,
    register,
    unregister,
    getFieldErrors,
    getFieldStatus,
    reset,
  };
}

// ============================================
// 단일 필드용 간편 훅
// ============================================

export interface UseFieldAsyncValidationOptions<T extends UnifiedWizardData> {
  /** 검증기 */
  validator: AsyncValidator<T>;
  /** 검증 완료 콜백 */
  onValidationComplete?: (result: AsyncValidationResult) => void;
  /** 에러 콜백 */
  onError?: (error: Error) => void;
}

export interface UseFieldAsyncValidationResult {
  /** 검증 상태 */
  status: AsyncValidationStatus;
  /** 에러 목록 */
  errors: FieldError[];
  /** 검증 진행 중 여부 */
  isValidating: boolean;
  /** 유효 여부 */
  isValid: boolean;
  /** 검증 실행 */
  validate: (value: unknown, data: unknown) => Promise<AsyncValidationResult>;
  /** 검증 취소 */
  cancel: () => void;
  /** 리셋 */
  reset: () => void;
}

/**
 * useFieldAsyncValidation
 *
 * 단일 필드에 대한 비동기 검증 훅
 *
 * @example
 * ```tsx
 * function EmailInput({ data, onUpdate }) {
 *   const { status, errors, validate } = useFieldAsyncValidation({
 *     validator: createUniquenessValidator({
 *       id: "email-unique",
 *       fieldPath: "email",
 *       checkUnique: async (email) => checkEmailAvailable(email),
 *     }),
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         onChange={async (e) => {
 *           onUpdate(e.target.value);
 *           await validate(e.target.value, data);
 *         }}
 *       />
 *       {status === "validating" && <Spinner />}
 *       {errors.map((e, i) => <span key={i}>{e.message}</span>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFieldAsyncValidation<T extends UnifiedWizardData>(
  options: UseFieldAsyncValidationOptions<T>
): UseFieldAsyncValidationResult {
  const { validator, onValidationComplete, onError } = options;

  const [status, setStatus] = useState<AsyncValidationStatus>("idle");
  const [errors, setErrors] = useState<FieldError[]>([]);

  const serviceRef = useRef<AsyncValidationService<T> | null>(null);
  const isMountedRef = useRef(true);

  // 서비스 초기화 및 검증기 등록
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new AsyncValidationService<T>();
    }
    serviceRef.current.register(validator);

    return () => {
      serviceRef.current?.unregister(validator.id);
    };
  }, [validator]);

  // 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const validate = useCallback(
    async (value: unknown, data: unknown): Promise<AsyncValidationResult> => {
      if (!serviceRef.current) {
        return { isValid: false, errors: [], warnings: [], status: "error" };
      }

      setStatus("pending");

      try {
        const result = await serviceRef.current.validateImmediate(
          validator.id,
          value,
          data as T
        );

        if (isMountedRef.current) {
          setStatus(result.status);
          setErrors(result.errors || []);
        }

        onValidationComplete?.(result);

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);

        if (isMountedRef.current) {
          setStatus("error");
          setErrors([{ field: validator.fieldPath, message: err.message, severity: "error" as const }]);
        }

        return {
          isValid: false,
          errors: [{ field: validator.fieldPath, message: err.message, severity: "error" as const }],
          warnings: [],
          status: "error",
        };
      }
    },
    [validator, onValidationComplete, onError]
  );

  const cancel = useCallback(() => {
    serviceRef.current?.cancelPending(validator.id);
    setStatus("idle");
  }, [validator.id]);

  const reset = useCallback(() => {
    serviceRef.current?.cancelPending(validator.id);
    serviceRef.current?.invalidateCache(validator.id);
    setStatus("idle");
    setErrors([]);
  }, [validator.id]);

  const isValidating = status === "pending" || status === "validating";
  const isValid = status === "valid";

  return {
    status,
    errors,
    isValidating,
    isValid,
    validate,
    cancel,
    reset,
  };
}
