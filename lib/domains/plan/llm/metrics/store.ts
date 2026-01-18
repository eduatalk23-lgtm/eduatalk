/**
 * LLM 메트릭스 저장소
 *
 * 메트릭스를 인메모리 링 버퍼에 저장하여 집계 및 분석에 활용합니다.
 * 프로덕션에서는 로그 수집기(CloudWatch, Datadog 등)와 연동할 수 있습니다.
 *
 * @module lib/domains/plan/llm/metrics/store
 */

import type { LLMRecommendationMetrics, MetricsSource } from "./types";

/**
 * 메트릭스 저장소 설정
 */
interface MetricsStoreConfig {
  /** 저장할 최대 메트릭스 수 (기본: 1000) */
  maxSize: number;
  /** 저장 활성화 여부 (기본: true in development) */
  enabled: boolean;
}

/**
 * 메트릭스 필터 옵션
 */
export interface MetricsFilterOptions {
  /** 시작 시간 (ISO string) */
  startTime?: string;
  /** 종료 시간 (ISO string) */
  endTime?: string;
  /** 소스 필터 */
  source?: MetricsSource | MetricsSource[];
  /** 테넌트 ID 필터 */
  tenantId?: string;
  /** 학생 ID 필터 */
  studentId?: string;
  /** 에러만 필터 */
  errorsOnly?: boolean;
  /** 최대 결과 수 */
  limit?: number;
}

/**
 * 링 버퍼 기반 메트릭스 저장소
 *
 * 고정 크기의 버퍼를 사용하여 메모리 사용량을 제한합니다.
 * 버퍼가 가득 차면 가장 오래된 메트릭스가 덮어씌워집니다.
 */
class MetricsStore {
  private buffer: LLMRecommendationMetrics[] = [];
  private writeIndex = 0;
  private config: MetricsStoreConfig;

  constructor(config?: Partial<MetricsStoreConfig>) {
    this.config = {
      maxSize: config?.maxSize ?? 1000,
      enabled: config?.enabled ?? process.env.NODE_ENV === "development",
    };
  }

  /**
   * 메트릭스 추가
   */
  add(metrics: LLMRecommendationMetrics): void {
    if (!this.config.enabled) return;

    if (this.buffer.length < this.config.maxSize) {
      this.buffer.push(metrics);
    } else {
      this.buffer[this.writeIndex] = metrics;
    }

    this.writeIndex = (this.writeIndex + 1) % this.config.maxSize;
  }

  /**
   * 모든 메트릭스 조회 (시간순 정렬)
   */
  getAll(): LLMRecommendationMetrics[] {
    return [...this.buffer].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * 필터링된 메트릭스 조회
   */
  query(options: MetricsFilterOptions = {}): LLMRecommendationMetrics[] {
    let result = this.getAll();

    // 시간 범위 필터
    if (options.startTime) {
      const startTs = new Date(options.startTime).getTime();
      result = result.filter((m) => new Date(m.timestamp).getTime() >= startTs);
    }

    if (options.endTime) {
      const endTs = new Date(options.endTime).getTime();
      result = result.filter((m) => new Date(m.timestamp).getTime() <= endTs);
    }

    // 소스 필터
    if (options.source) {
      const sources = Array.isArray(options.source) ? options.source : [options.source];
      result = result.filter((m) => sources.includes(m.source));
    }

    // 테넌트 필터
    if (options.tenantId) {
      result = result.filter((m) => m.tenantId === options.tenantId);
    }

    // 학생 필터
    if (options.studentId) {
      result = result.filter((m) => m.studentId === options.studentId);
    }

    // 에러만 필터
    if (options.errorsOnly) {
      result = result.filter((m) => m.error?.occurred);
    }

    // 결과 수 제한
    if (options.limit && options.limit > 0) {
      result = result.slice(-options.limit);
    }

    return result;
  }

  /**
   * 최근 N개 메트릭스 조회
   */
  getRecent(count: number): LLMRecommendationMetrics[] {
    const all = this.getAll();
    return all.slice(-count);
  }

  /**
   * 저장소 크기
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * 저장소 초기화
   */
  clear(): void {
    this.buffer = [];
    this.writeIndex = 0;
  }

  /**
   * 설정 업데이트
   */
  configure(config: Partial<MetricsStoreConfig>): void {
    if (config.maxSize !== undefined) {
      this.config.maxSize = config.maxSize;
      // 버퍼 크기가 줄어들면 오래된 항목 제거
      if (this.buffer.length > this.config.maxSize) {
        const sorted = this.getAll();
        this.buffer = sorted.slice(-this.config.maxSize);
        this.writeIndex = 0;
      }
    }

    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): Readonly<MetricsStoreConfig> {
    return { ...this.config };
  }
}

// 싱글톤 인스턴스
let storeInstance: MetricsStore | null = null;

/**
 * 메트릭스 저장소 인스턴스 조회
 */
export function getMetricsStore(): MetricsStore {
  if (!storeInstance) {
    storeInstance = new MetricsStore();
  }
  return storeInstance;
}

/**
 * 메트릭스 저장소 초기화 (테스트용)
 */
export function resetMetricsStore(): void {
  storeInstance = null;
}

/**
 * 메트릭스 저장소 설정 (테스트/개발용)
 */
export function configureMetricsStore(config: Partial<MetricsStoreConfig>): void {
  getMetricsStore().configure(config);
}
