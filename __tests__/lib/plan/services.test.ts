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
  });
});
