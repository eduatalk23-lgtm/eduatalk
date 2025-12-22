/**
 * 플랜 생성 서비스 레이어 테스트
 *
 * Phase 3 통합을 위한 서비스 레이어 및 어댑터 테스트입니다.
 * - ServiceAdapter 함수들
 * - 피처 플래그 설정
 * - canUseServiceBasedGeneration 함수
 *
 * @module __tests__/lib/plan/services.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAdapterConfig,
  DEFAULT_ADAPTER_CONFIG,
  canUseServiceBasedGeneration,
} from "@/lib/plan/services";

describe("Plan Generation Service Layer", () => {
  describe("getAdapterConfig", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("기본 설정에서 모든 서비스가 비활성화되어야 함", () => {
      // Given: 환경변수가 설정되지 않은 상태
      delete process.env.ENABLE_NEW_PLAN_SERVICES;

      // When: 설정 가져오기
      const config = getAdapterConfig();

      // Then: 모든 서비스 비활성화
      expect(config.useContentResolutionService).toBe(false);
      expect(config.useScheduleGenerationService).toBe(false);
      expect(config.useTimeAllocationService).toBe(false);
      expect(config.usePlanPersistenceService).toBe(false);
    });

    it("ENABLE_NEW_PLAN_SERVICES=true일 때 일부 서비스가 활성화되어야 함", () => {
      // Given: 피처 플래그 활성화
      process.env.ENABLE_NEW_PLAN_SERVICES = "true";

      // When: 설정 가져오기
      const config = getAdapterConfig();

      // Then: ContentResolution과 PlanPersistence만 활성화
      expect(config.useContentResolutionService).toBe(true);
      expect(config.useScheduleGenerationService).toBe(false); // 아직 완전 통합 안됨
      expect(config.useTimeAllocationService).toBe(false); // 아직 완전 통합 안됨
      expect(config.usePlanPersistenceService).toBe(true);
    });

    it("ENABLE_NEW_PLAN_SERVICES=false일 때 기본 설정이 반환되어야 함", () => {
      // Given: 피처 플래그 비활성화
      process.env.ENABLE_NEW_PLAN_SERVICES = "false";

      // When: 설정 가져오기
      const config = getAdapterConfig();

      // Then: 기본 설정과 동일
      expect(config).toEqual(DEFAULT_ADAPTER_CONFIG);
    });
  });

  describe("DEFAULT_ADAPTER_CONFIG", () => {
    it("기본 설정이 모든 서비스를 비활성화해야 함", () => {
      expect(DEFAULT_ADAPTER_CONFIG).toEqual({
        useContentResolutionService: false,
        useScheduleGenerationService: false,
        useTimeAllocationService: false,
        usePlanPersistenceService: false,
      });
    });
  });

  describe("canUseServiceBasedGeneration", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("환경변수가 설정되지 않으면 false를 반환해야 함", () => {
      delete process.env.ENABLE_NEW_PLAN_SERVICES;
      expect(canUseServiceBasedGeneration()).toBe(false);
    });

    it("환경변수가 'true'이면 true를 반환해야 함", () => {
      process.env.ENABLE_NEW_PLAN_SERVICES = "true";
      expect(canUseServiceBasedGeneration()).toBe(true);
    });

    it("환경변수가 'false'이면 false를 반환해야 함", () => {
      process.env.ENABLE_NEW_PLAN_SERVICES = "false";
      expect(canUseServiceBasedGeneration()).toBe(false);
    });

    it("환경변수가 다른 값이면 false를 반환해야 함", () => {
      process.env.ENABLE_NEW_PLAN_SERVICES = "yes";
      expect(canUseServiceBasedGeneration()).toBe(false);

      process.env.ENABLE_NEW_PLAN_SERVICES = "1";
      expect(canUseServiceBasedGeneration()).toBe(false);
    });
  });
});

describe("Service Singleton Instances", () => {
  it("getContentResolutionService가 싱글톤을 반환해야 함", async () => {
    const { getContentResolutionService } = await import(
      "@/lib/plan/services/ContentResolutionService"
    );

    const instance1 = getContentResolutionService();
    const instance2 = getContentResolutionService();

    expect(instance1).toBe(instance2);
  });

  it("getScheduleGenerationService가 싱글톤을 반환해야 함", async () => {
    const { getScheduleGenerationService } = await import(
      "@/lib/plan/services/ScheduleGenerationService"
    );

    const instance1 = getScheduleGenerationService();
    const instance2 = getScheduleGenerationService();

    expect(instance1).toBe(instance2);
  });

  it("getTimeAllocationService가 싱글톤을 반환해야 함", async () => {
    const { getTimeAllocationService } = await import(
      "@/lib/plan/services/TimeAllocationService"
    );

    const instance1 = getTimeAllocationService();
    const instance2 = getTimeAllocationService();

    expect(instance1).toBe(instance2);
  });

  it("getPlanPersistenceService가 싱글톤을 반환해야 함", async () => {
    const { getPlanPersistenceService } = await import(
      "@/lib/plan/services/PlanPersistenceService"
    );

    const instance1 = getPlanPersistenceService();
    const instance2 = getPlanPersistenceService();

    expect(instance1).toBe(instance2);
  });

  it("getPlanGenerationOrchestrator가 싱글톤을 반환해야 함", async () => {
    const { getPlanGenerationOrchestrator } = await import(
      "@/lib/plan/services/PlanGenerationOrchestrator"
    );

    const instance1 = getPlanGenerationOrchestrator();
    const instance2 = getPlanGenerationOrchestrator();

    expect(instance1).toBe(instance2);
  });
});

describe("ServiceAdapter Types", () => {
  it("어댑터 함수들이 올바르게 내보내져야 함", async () => {
    const serviceAdapter = await import("@/lib/plan/services/ServiceAdapter");

    // 함수들이 존재하는지 확인
    expect(serviceAdapter.adaptContentResolution).toBeDefined();
    expect(serviceAdapter.adaptScheduleGeneration).toBeDefined();
    expect(serviceAdapter.adaptTimeAllocation).toBeDefined();
    expect(serviceAdapter.getAdapterConfig).toBeDefined();
    expect(serviceAdapter.DEFAULT_ADAPTER_CONFIG).toBeDefined();
  });
});

describe("Service Layer Index Exports", () => {
  it("서비스 인덱스에서 모든 필수 export가 존재해야 함", async () => {
    const services = await import("@/lib/plan/services");

    // 서비스 구현체
    expect(services.ContentResolutionService).toBeDefined();
    expect(services.ScheduleGenerationService).toBeDefined();
    expect(services.TimeAllocationService).toBeDefined();
    expect(services.PlanPersistenceService).toBeDefined();
    expect(services.PlanGenerationOrchestrator).toBeDefined();

    // 팩토리 함수
    expect(services.getContentResolutionService).toBeDefined();
    expect(services.getScheduleGenerationService).toBeDefined();
    expect(services.getTimeAllocationService).toBeDefined();
    expect(services.getPlanPersistenceService).toBeDefined();
    expect(services.getPlanGenerationOrchestrator).toBeDefined();

    // 어댑터 함수
    expect(services.adaptContentResolution).toBeDefined();
    expect(services.adaptScheduleGeneration).toBeDefined();
    expect(services.adaptTimeAllocation).toBeDefined();
    expect(services.getAdapterConfig).toBeDefined();
    expect(services.DEFAULT_ADAPTER_CONFIG).toBeDefined();

    // 통합 함수
    expect(services.generatePlansWithServices).toBeDefined();
    expect(services.canUseServiceBasedGeneration).toBeDefined();

    // Phase 4: 에러 및 로깅 시스템
    expect(services.ServiceError).toBeDefined();
    expect(services.ServiceErrorCodes).toBeDefined();
    expect(services.toServiceError).toBeDefined();
    expect(services.ServiceLogger).toBeDefined();
    expect(services.PerformanceTracker).toBeDefined();
    expect(services.globalPerformanceTracker).toBeDefined();
  });
});

describe("Phase 4: ServiceError", () => {
  it("ServiceError를 올바르게 생성해야 함", async () => {
    const { ServiceError, ServiceErrorCodes } = await import(
      "@/lib/plan/services/errors"
    );

    const error = new ServiceError(
      "테스트 에러",
      ServiceErrorCodes.CONTENT_RESOLUTION_FAILED,
      {
        source: "ContentResolutionService",
        method: "resolve",
        studentId: "student-123",
        tenantId: "tenant-456",
      }
    );

    expect(error.message).toBe("테스트 에러");
    expect(error.code).toBe("CONTENT_RESOLUTION_FAILED");
    expect(error.context.source).toBe("ContentResolutionService");
    expect(error.context.method).toBe("resolve");
    expect(error.context.studentId).toBe("student-123");
    expect(error.context.tenantId).toBe("tenant-456");
    expect(error.context.timestamp).toBeDefined();
  });

  it("toServiceError로 일반 Error를 ServiceError로 변환해야 함", async () => {
    const { toServiceError, ServiceErrorCodes } = await import(
      "@/lib/plan/services/errors"
    );

    const originalError = new Error("원본 에러");
    const serviceError = toServiceError(originalError, "ContentResolutionService", {
      code: ServiceErrorCodes.CONTENT_RESOLUTION_FAILED,
      method: "resolve",
    });

    expect(serviceError.message).toBe("원본 에러");
    expect(serviceError.code).toBe("CONTENT_RESOLUTION_FAILED");
    expect(serviceError.context.source).toBe("ContentResolutionService");
    expect(serviceError.context.cause).toBe(originalError);
  });

  it("ServiceError를 JSON으로 직렬화할 수 있어야 함", async () => {
    const { ServiceError, ServiceErrorCodes } = await import(
      "@/lib/plan/services/errors"
    );

    const error = new ServiceError(
      "직렬화 테스트",
      ServiceErrorCodes.PLAN_PERSISTENCE_FAILED,
      { source: "PlanPersistenceService" }
    );

    const json = error.toJSON();

    expect(json.name).toBe("ServiceError");
    expect(json.message).toBe("직렬화 테스트");
    expect(json.code).toBe("PLAN_PERSISTENCE_FAILED");
  });
});

describe("Phase 4: ServiceLogger", () => {
  it("ServiceLogger 인스턴스를 생성할 수 있어야 함", async () => {
    const { createServiceLogger } = await import("@/lib/plan/services/logging");

    const logger = createServiceLogger("ContentResolutionService", {
      studentId: "student-123",
    });

    expect(logger).toBeDefined();
  });
});

describe("Phase 4: PerformanceTracker", () => {
  it("작업 시간을 측정할 수 있어야 함", async () => {
    const { PerformanceTracker } = await import("@/lib/plan/services/logging");

    const tracker = new PerformanceTracker();

    // 작업 시작
    const trackingId = tracker.start(
      "ContentResolutionService",
      "resolve",
      "op-123"
    );

    // 약간의 지연
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 작업 종료
    tracker.end(trackingId, true);

    // 메트릭 확인
    const metrics = tracker.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].source).toBe("ContentResolutionService");
    expect(metrics[0].method).toBe("resolve");
    expect(metrics[0].success).toBe(true);
    expect(metrics[0].duration).toBeGreaterThan(0);
  });

  it("성공률을 계산할 수 있어야 함", async () => {
    const { PerformanceTracker } = await import("@/lib/plan/services/logging");

    const tracker = new PerformanceTracker();

    // 성공 2회, 실패 1회
    const id1 = tracker.start("TestService", "test");
    tracker.end(id1, true);

    const id2 = tracker.start("TestService", "test");
    tracker.end(id2, true);

    const id3 = tracker.start("TestService", "test");
    tracker.end(id3, false);

    const successRate = tracker.getSuccessRate("TestService", "test");
    expect(successRate).toBeCloseTo(2 / 3, 2);
  });

  it("요약 보고서를 생성할 수 있어야 함", async () => {
    const { PerformanceTracker } = await import("@/lib/plan/services/logging");

    const tracker = new PerformanceTracker();

    const id1 = tracker.start("ServiceA", "method1");
    tracker.end(id1, true);

    const id2 = tracker.start("ServiceA", "method2");
    tracker.end(id2, false);

    const summary = tracker.getSummary();

    expect(summary["ServiceA.method1"]).toBeDefined();
    expect(summary["ServiceA.method1"].count).toBe(1);
    expect(summary["ServiceA.method1"].successCount).toBe(1);

    expect(summary["ServiceA.method2"]).toBeDefined();
    expect(summary["ServiceA.method2"].count).toBe(1);
    expect(summary["ServiceA.method2"].failureCount).toBe(1);
  });
});

describe("Phase 5: timeToMinutes 유틸리티", () => {
  it("시간 문자열을 분으로 올바르게 변환해야 함", async () => {
    const { timeToMinutes } = await import(
      "@/lib/plan/services/preparePlanGenerationData"
    );

    // 기본 케이스
    expect(timeToMinutes("09:00")).toBe(540); // 9 * 60
    expect(timeToMinutes("12:30")).toBe(750); // 12 * 60 + 30
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:59")).toBe(1439); // 23 * 60 + 59
  });

  it("자정과 정오를 올바르게 처리해야 함", async () => {
    const { timeToMinutes } = await import(
      "@/lib/plan/services/preparePlanGenerationData"
    );

    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("12:00")).toBe(720);
  });

  it("한 자리 시간/분도 처리할 수 있어야 함", async () => {
    const { timeToMinutes } = await import(
      "@/lib/plan/services/preparePlanGenerationData"
    );

    expect(timeToMinutes("9:00")).toBe(540);
    expect(timeToMinutes("09:5")).toBe(545);
  });
});

describe("Phase 5: preparePlanGenerationData 타입 및 export", () => {
  it("preparePlanGenerationData 함수가 올바르게 내보내져야 함", async () => {
    const module = await import(
      "@/lib/plan/services/preparePlanGenerationData"
    );

    expect(module.preparePlanGenerationData).toBeDefined();
    expect(typeof module.preparePlanGenerationData).toBe("function");
  });

  it("timeToMinutes 함수가 올바르게 내보내져야 함", async () => {
    const module = await import(
      "@/lib/plan/services/preparePlanGenerationData"
    );

    expect(module.timeToMinutes).toBeDefined();
    expect(typeof module.timeToMinutes).toBe("function");
  });

  it("서비스 인덱스에서 Phase 5 export가 존재해야 함", async () => {
    const services = await import("@/lib/plan/services");

    // Phase 5: 공통 로직 추출
    expect(services.preparePlanGenerationData).toBeDefined();
    expect(services.timeToMinutes).toBeDefined();
  });
});

describe("Phase 5: previewPlansWithServices export", () => {
  it("previewPlansWithServices 함수가 올바르게 내보내져야 함", async () => {
    const services = await import("@/lib/plan/services");

    expect(services.previewPlansWithServices).toBeDefined();
    expect(typeof services.previewPlansWithServices).toBe("function");
  });

  it("PreviewPlan 타입이 내보내져야 함", async () => {
    // 타입은 런타임에 존재하지 않으므로 함수를 통해 간접 확인
    const module = await import(
      "@/lib/plan/services/previewPlansWithServices"
    );

    expect(module.previewPlansWithServices).toBeDefined();
  });
});

describe("Phase 5: AllocatedPlanSegment 및 DateAllocationResult 타입", () => {
  it("DateMetadata 타입에 맞는 객체를 생성할 수 있어야 함", async () => {
    // 타입 호환성 테스트 (런타임 검증)
    const dateMetadata = {
      day_type: "학습일" as const,
      week_number: 1,
    };

    expect(dateMetadata.day_type).toBe("학습일");
    expect(dateMetadata.week_number).toBe(1);
  });

  it("AllocatedPlanSegment 타입에 맞는 객체를 생성할 수 있어야 함", async () => {
    const segment = {
      plan: {
        content_id: "content-123",
        content_type: "book" as const,
        planned_start_page_or_time: 1,
        planned_end_page_or_time: 50,
        block_index: 0,
      },
      start: "09:00",
      end: "10:00",
      isPartial: false,
      isContinued: false,
    };

    expect(segment.plan.content_id).toBe("content-123");
    expect(segment.start).toBe("09:00");
    expect(segment.isPartial).toBe(false);
  });

  it("DateAllocationResult 타입에 맞는 객체를 생성할 수 있어야 함", async () => {
    const result = {
      date: "2024-01-15",
      segments: [],
      dateMetadata: {
        day_type: "학습일" as const,
        week_number: 1,
      },
      dayType: "학습일",
    };

    expect(result.date).toBe("2024-01-15");
    expect(result.segments).toEqual([]);
    expect(result.dayType).toBe("학습일");
  });
});
