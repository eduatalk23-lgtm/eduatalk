/**
 * Async Validation Service
 *
 * 위저드 비동기 검증을 관리하는 서비스
 * 서버 검증, 디바운싱, 캐싱 지원
 *
 * @module lib/wizard/services/asyncValidation
 */

import type { ValidationResult, FieldError } from "../types";

// ============================================
// 타입 정의
// ============================================

export type AsyncValidationStatus =
  | "idle"
  | "pending"
  | "validating"
  | "valid"
  | "invalid"
  | "error";

export interface AsyncValidationResult {
  /** 유효 여부 */
  isValid: boolean;
  /** 에러 목록 */
  errors: FieldError[];
  /** 경고 목록 */
  warnings: FieldError[];
  /** 검증 상태 */
  status: AsyncValidationStatus;
  /** 검증 시작 시간 */
  startedAt?: number;
  /** 검증 완료 시간 */
  completedAt?: number;
  /** 검증 소요 시간 (ms) */
  duration?: number;
}

export interface AsyncValidator<TData = unknown, TContext = unknown> {
  /** 검증기 ID */
  id: string;
  /** 검증 대상 필드 경로 (예: "basicInfo.name") */
  fieldPath: string;
  /** 비동기 검증 함수 */
  validate: (
    value: unknown,
    data: TData,
    context?: TContext
  ) => Promise<ValidationResult>;
  /** 디바운스 시간 (ms) */
  debounceMs?: number;
  /** 캐시 TTL (ms, 0이면 캐시 비활성화) */
  cacheTtl?: number;
  /** 검증 우선순위 (낮을수록 먼저 실행) */
  priority?: number;
  /** 의존 필드들 (이 필드들이 변경되면 캐시 무효화) */
  dependsOn?: string[];
}

export interface AsyncValidationConfig {
  /** 기본 디바운스 시간 (ms) */
  defaultDebounceMs?: number;
  /** 기본 캐시 TTL (ms) */
  defaultCacheTtl?: number;
  /** 최대 동시 검증 수 */
  maxConcurrent?: number;
  /** 검증 타임아웃 (ms) */
  timeout?: number;
  /** 에러 재시도 횟수 */
  retryCount?: number;
  /** 재시도 지연 시간 (ms) */
  retryDelay?: number;
}

interface CacheEntry {
  result: ValidationResult;
  expiresAt: number;
  dataHash: string;
}

interface PendingValidation {
  promise: Promise<ValidationResult>;
  abortController: AbortController;
  startedAt: number;
}

// ============================================
// 상수
// ============================================

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_CACHE_TTL = 60000; // 1분
const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_TIMEOUT = 10000; // 10초
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY = 1000;

// ============================================
// 유틸리티 함수
// ============================================

function hashData(data: unknown): string {
  return JSON.stringify(data);
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ============================================
// 클래스 정의
// ============================================

/**
 * AsyncValidationService
 *
 * 비동기 검증을 관리하는 서비스
 */
export class AsyncValidationService<TData = unknown, TContext = unknown> {
  private validators: Map<string, AsyncValidator<TData, TContext>> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private pending: Map<string, PendingValidation> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private config: Required<AsyncValidationConfig>;
  private activeCount = 0;
  private queue: Array<{
    validatorId: string;
    value: unknown;
    data: TData;
    context?: TContext;
    resolve: (result: ValidationResult) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(config: AsyncValidationConfig = {}) {
    this.config = {
      defaultDebounceMs: config.defaultDebounceMs ?? DEFAULT_DEBOUNCE_MS,
      defaultCacheTtl: config.defaultCacheTtl ?? DEFAULT_CACHE_TTL,
      maxConcurrent: config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      retryCount: config.retryCount ?? DEFAULT_RETRY_COUNT,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
    };
  }

  /**
   * 비동기 검증기 등록
   */
  register(validator: AsyncValidator<TData, TContext>): void {
    this.validators.set(validator.id, validator);
  }

  /**
   * 검증기 제거
   */
  unregister(validatorId: string): void {
    this.validators.delete(validatorId);
    this.invalidateCache(validatorId);
    this.cancelPending(validatorId);
  }

  /**
   * 비동기 검증 실행 (디바운싱 적용)
   */
  validate(
    validatorId: string,
    value: unknown,
    data: TData,
    context?: TContext
  ): Promise<AsyncValidationResult> {
    const validator = this.validators.get(validatorId);

    if (!validator) {
      return Promise.resolve({
        isValid: false,
        errors: [
          {
            field: validatorId,
            message: `검증기를 찾을 수 없습니다: ${validatorId}`,
            severity: "error" as const,
          },
        ],
        warnings: [],
        status: "error",
      });
    }

    const debounceMs =
      validator.debounceMs ?? this.config.defaultDebounceMs;

    // 기존 디바운스 타이머 취소
    const existingTimer = this.debounceTimers.get(validatorId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(validatorId);
        const result = await this.executeValidation(
          validatorId,
          value,
          data,
          context
        );
        resolve(result);
      }, debounceMs);

      this.debounceTimers.set(validatorId, timer);
    });
  }

  /**
   * 즉시 검증 실행 (디바운싱 없음)
   */
  async validateImmediate(
    validatorId: string,
    value: unknown,
    data: TData,
    context?: TContext
  ): Promise<AsyncValidationResult> {
    // 디바운스 타이머 취소
    const existingTimer = this.debounceTimers.get(validatorId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimers.delete(validatorId);
    }

    return this.executeValidation(validatorId, value, data, context);
  }

  /**
   * 여러 검증기 동시 실행
   */
  async validateAll(
    validatorIds: string[],
    data: TData,
    context?: TContext
  ): Promise<Map<string, AsyncValidationResult>> {
    const results = new Map<string, AsyncValidationResult>();

    // 우선순위로 정렬
    const sortedIds = [...validatorIds].sort((a, b) => {
      const validatorA = this.validators.get(a);
      const validatorB = this.validators.get(b);
      return (validatorA?.priority ?? 0) - (validatorB?.priority ?? 0);
    });

    await Promise.all(
      sortedIds.map(async (id) => {
        const validator = this.validators.get(id);
        if (!validator) return;

        const value = getNestedValue(data, validator.fieldPath);
        const result = await this.validateImmediate(id, value, data, context);
        results.set(id, result);
      })
    );

    return results;
  }

  /**
   * 필드 경로로 검증 실행
   */
  async validateByField(
    fieldPath: string,
    value: unknown,
    data: TData,
    context?: TContext
  ): Promise<AsyncValidationResult[]> {
    const matchingValidators = Array.from(this.validators.values()).filter(
      (v) => v.fieldPath === fieldPath
    );

    const results = await Promise.all(
      matchingValidators.map((v) =>
        this.validateImmediate(v.id, value, data, context)
      )
    );

    return results;
  }

  /**
   * 검증 상태 조회
   */
  getStatus(validatorId: string): AsyncValidationStatus {
    if (this.debounceTimers.has(validatorId)) {
      return "pending";
    }
    if (this.pending.has(validatorId)) {
      return "validating";
    }
    const cached = this.getCachedResult(validatorId);
    if (cached) {
      return cached.isValid ? "valid" : "invalid";
    }
    return "idle";
  }

  /**
   * 진행 중인 검증 취소
   */
  cancelPending(validatorId: string): void {
    // 디바운스 타이머 취소
    const timer = this.debounceTimers.get(validatorId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(validatorId);
    }

    // 진행 중인 요청 취소
    const pending = this.pending.get(validatorId);
    if (pending) {
      pending.abortController.abort();
      this.pending.delete(validatorId);
      this.activeCount--;
    }
  }

  /**
   * 모든 검증 취소
   */
  cancelAll(): void {
    for (const validatorId of this.validators.keys()) {
      this.cancelPending(validatorId);
    }
    this.queue = [];
  }

  /**
   * 캐시 무효화
   */
  invalidateCache(validatorId?: string): void {
    if (validatorId) {
      this.cache.delete(validatorId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 의존 필드 변경 시 관련 캐시 무효화
   */
  invalidateDependentCaches(fieldPath: string): void {
    for (const [validatorId, validator] of this.validators) {
      if (validator.dependsOn?.includes(fieldPath)) {
        this.invalidateCache(validatorId);
      }
    }
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.cancelAll();
    this.cache.clear();
    this.validators.clear();
  }

  // ============================================
  // Private 메서드
  // ============================================

  private async executeValidation(
    validatorId: string,
    value: unknown,
    data: TData,
    context?: TContext
  ): Promise<AsyncValidationResult> {
    const validator = this.validators.get(validatorId);
    if (!validator) {
      return {
        isValid: false,
        errors: [
          {
            field: validatorId,
            message: `검증기를 찾을 수 없습니다: ${validatorId}`,
            severity: "error" as const,
          },
        ],
        warnings: [],
        status: "error",
      };
    }

    // 캐시 확인
    const cached = this.getCachedResult(validatorId, data);
    if (cached) {
      return {
        isValid: cached.isValid,
        errors: cached.errors,
        warnings: cached.warnings,
        status: cached.isValid ? "valid" : "invalid",
      };
    }

    // 동시 실행 제한 확인
    if (this.activeCount >= this.config.maxConcurrent) {
      return new Promise<AsyncValidationResult>((resolve, reject) => {
        this.queue.push({
          validatorId,
          value,
          data,
          context,
          resolve: (result) => resolve({
            isValid: result.isValid,
            errors: result.errors,
            warnings: result.warnings,
            status: result.isValid ? "valid" : "invalid",
          }),
          reject,
        });
      });
    }

    return this.runValidation(validatorId, validator, value, data, context);
  }

  private async runValidation(
    validatorId: string,
    validator: AsyncValidator<TData, TContext>,
    value: unknown,
    data: TData,
    context?: TContext,
    retryCount = 0
  ): Promise<AsyncValidationResult> {
    const startedAt = Date.now();
    const abortController = new AbortController();

    this.activeCount++;

    // 타임아웃 설정
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.timeout);

    this.pending.set(validatorId, {
      promise: Promise.resolve({ isValid: true, errors: [], warnings: [] }),
      abortController,
      startedAt,
    });

    try {
      const result = await validator.validate(value, data, context);
      const completedAt = Date.now();

      // 캐시 저장
      this.setCacheResult(validatorId, result, data, validator);

      return {
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        status: result.isValid ? "valid" : "invalid",
        startedAt,
        completedAt,
        duration: completedAt - startedAt,
      };
    } catch (error) {
      // 재시도
      if (retryCount < this.config.retryCount) {
        await new Promise((r) => setTimeout(r, this.config.retryDelay));
        return this.runValidation(
          validatorId,
          validator,
          value,
          data,
          context,
          retryCount + 1
        );
      }

      return {
        isValid: false,
        errors: [
          {
            field: validator.fieldPath,
            message:
              error instanceof Error ? error.message : "검증 중 오류가 발생했습니다.",
            severity: "error" as const,
          },
        ],
        warnings: [],
        status: "error",
        startedAt,
        completedAt: Date.now(),
        duration: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeoutId);
      this.pending.delete(validatorId);
      this.activeCount--;

      // 대기열 처리
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;
    if (this.activeCount >= this.config.maxConcurrent) return;

    const next = this.queue.shift();
    if (!next) return;

    const validator = this.validators.get(next.validatorId);
    if (!validator) {
      next.reject(
        new Error(`검증기를 찾을 수 없습니다: ${next.validatorId}`)
      );
      return;
    }

    this.runValidation(
      next.validatorId,
      validator,
      next.value,
      next.data,
      next.context
    )
      .then(next.resolve)
      .catch(next.reject);
  }

  private getCachedResult(
    validatorId: string,
    data?: TData
  ): ValidationResult | null {
    const entry = this.cache.get(validatorId);
    if (!entry) return null;

    // 만료 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(validatorId);
      return null;
    }

    // 데이터 해시 확인 (의존 필드 변경 감지)
    if (data) {
      const validator = this.validators.get(validatorId);
      if (validator?.dependsOn) {
        const relevantData = validator.dependsOn.reduce((acc, path) => {
          acc[path] = getNestedValue(data, path);
          return acc;
        }, {} as Record<string, unknown>);
        const currentHash = hashData(relevantData);
        if (currentHash !== entry.dataHash) {
          this.cache.delete(validatorId);
          return null;
        }
      }
    }

    return entry.result;
  }

  private setCacheResult(
    validatorId: string,
    result: ValidationResult,
    data: TData,
    validator: AsyncValidator<TData, TContext>
  ): void {
    const cacheTtl = validator.cacheTtl ?? this.config.defaultCacheTtl;
    if (cacheTtl <= 0) return;

    let dataHash = "";
    if (validator.dependsOn) {
      const relevantData = validator.dependsOn.reduce((acc, path) => {
        acc[path] = getNestedValue(data, path);
        return acc;
      }, {} as Record<string, unknown>);
      dataHash = hashData(relevantData);
    }

    this.cache.set(validatorId, {
      result,
      expiresAt: Date.now() + cacheTtl,
      dataHash,
    });
  }
}

// ============================================
// 사전 정의된 비동기 검증기 팩토리
// ============================================

/**
 * 서버 API 검증기 생성
 */
export function createApiValidator<TData = unknown>(options: {
  id: string;
  fieldPath: string;
  endpoint: string;
  method?: "GET" | "POST";
  transformRequest?: (value: unknown, data: TData) => unknown;
  transformResponse?: (response: unknown) => ValidationResult;
  debounceMs?: number;
  cacheTtl?: number;
}): AsyncValidator<TData> {
  return {
    id: options.id,
    fieldPath: options.fieldPath,
    debounceMs: options.debounceMs ?? 500,
    cacheTtl: options.cacheTtl ?? 60000,
    validate: async (value, data) => {
      const requestBody = options.transformRequest
        ? options.transformRequest(value, data)
        : { value, fieldPath: options.fieldPath };

      const response = await fetch(options.endpoint, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        return {
          isValid: false,
          errors: [
            { field: options.fieldPath, message: "서버 검증에 실패했습니다.", severity: "error" as const },
          ],
          warnings: [],
        };
      }

      const result = await response.json();

      return options.transformResponse
        ? options.transformResponse(result)
        : { isValid: true, errors: [], warnings: [], ...result };
    },
  };
}

/**
 * 중복 확인 검증기 생성
 */
export function createUniquenessValidator<TData = unknown>(options: {
  id: string;
  fieldPath: string;
  checkUnique: (value: unknown, data: TData) => Promise<boolean>;
  errorMessage?: string;
  debounceMs?: number;
  cacheTtl?: number;
}): AsyncValidator<TData> {
  return {
    id: options.id,
    fieldPath: options.fieldPath,
    debounceMs: options.debounceMs ?? 500,
    cacheTtl: options.cacheTtl ?? 30000,
    validate: async (value, data) => {
      if (!value) {
        return { isValid: true, errors: [], warnings: [] };
      }

      const isUnique = await options.checkUnique(value, data);

      if (!isUnique) {
        return {
          isValid: false,
          errors: [
            {
              field: options.fieldPath,
              message: options.errorMessage ?? "이미 사용 중인 값입니다.",
              severity: "error" as const,
            },
          ],
          warnings: [],
        };
      }

      return { isValid: true, errors: [], warnings: [] };
    },
  };
}

/**
 * 조건부 비동기 검증기 생성
 */
export function createConditionalAsyncValidator<TData = unknown>(options: {
  id: string;
  fieldPath: string;
  condition: (value: unknown, data: TData) => boolean;
  validator: AsyncValidator<TData>["validate"];
  debounceMs?: number;
  cacheTtl?: number;
}): AsyncValidator<TData> {
  return {
    id: options.id,
    fieldPath: options.fieldPath,
    debounceMs: options.debounceMs ?? 300,
    cacheTtl: options.cacheTtl ?? 60000,
    validate: async (value, data, context) => {
      if (!options.condition(value, data)) {
        return { isValid: true, errors: [], warnings: [] };
      }
      return options.validator(value, data, context);
    },
  };
}

// ============================================
// 기본 인스턴스
// ============================================

/**
 * 기본 비동기 검증 서비스 인스턴스
 */
export const asyncValidation = new AsyncValidationService();
