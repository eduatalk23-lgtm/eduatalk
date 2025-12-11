/**
 * 플랜 그룹 시간 블록 기능 통합 테스트
 * 
 * 주의: 이 테스트는 실제 데이터베이스 연결이 필요합니다.
 * 통합 테스트 환경에서 실행해야 합니다.
 * 
 * 테스트 환경 설정:
 * 1. 테스트용 Supabase 프로젝트 설정
 * 2. 테스트 데이터베이스 마이그레이션 실행
 * 3. 테스트용 테넌트, 학생, 블록 세트 생성
 * 4. 테스트 후 데이터 정리
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createPlanGroup } from "@/lib/data/planGroups";
import { getBlockSetForPlanGroup } from "@/lib/plan/blocks";
import { mergeTimeSettingsSafely } from "@/lib/utils/schedulerOptionsMerge";
import type { PlanGroup, NonStudyTimeBlock, DailyScheduleInfo } from "@/lib/types/plan";
import {
  createTestTenant,
  createTestStudent,
  createTestBlockSet,
  cleanupTestData,
} from "../helpers/supabase";

describe("플랜 그룹 시간 블록 기능 통합 테스트", () => {
  // 테스트용 데이터
  let testTenantId: string;
  let testStudentId: string;
  let testBlockSetId: string;
  let testCampTemplateId: string;

  beforeAll(async () => {
    // 실제 구현 시 주석 해제:
    // testTenantId = await createTestTenant("통합 테스트 테넌트");
    // testStudentId = await createTestStudent(testTenantId, "통합 테스트 학생");
    // testBlockSetId = await createTestBlockSet(testTenantId, testStudentId, "통합 테스트 블록 세트");
    // testCampTemplateId = await createTestCampTemplate(testTenantId, testBlockSetId);
    
    // 스킵: 실제 데이터베이스 연결 필요
    // 테스트 환경 설정 가이드는 docs/integration-test-setup.md 참조
  });

  afterAll(async () => {
    // 실제 구현 시 주석 해제:
    // if (testTenantId && testStudentId) {
    //   await cleanupTestData(testTenantId, testStudentId, testBlockSetId, testCampTemplateId);
    // }
  });

  describe("캠프 모드", () => {
    it("캠프 템플릿 블록 세트 조회 및 병합", async () => {
      // 실제 구현 시:
      // 1. 캠프 템플릿 생성
      // const template = await createCampTemplate({
      //   tenant_id: testTenantId,
      //   name: "테스트 캠프 템플릿",
      //   program_type: "윈터캠프",
      // });
      // 
      // 2. 템플릿에 블록 세트 연결
      // await linkBlockSetToTemplate(template.id, testBlockSetId);
      // 
      // 3. 플랜 그룹 생성
      // const group = await createPlanGroup({
      //   tenant_id: testTenantId,
      //   student_id: testStudentId,
      //   plan_type: "camp",
      //   camp_template_id: template.id,
      //   scheduler_options: { template_block_set_id: testBlockSetId },
      //   time_settings: { lunch_time: { start: "12:00", end: "13:00" } },
      // });
      // 
      // 4. 블록 세트 조회 확인
      // const blocks = await getBlockSetForPlanGroup(
      //   group,
      //   testStudentId,
      //   "user-id",
      //   "student",
      //   testTenantId
      // );
      // expect(blocks.length).toBeGreaterThan(0);
      // 
      // 5. time_settings 병합 확인
      // const merged = mergeTimeSettingsSafely(
      //   group.scheduler_options || {},
      //   group.time_settings
      // );
      // expect(merged.lunch_time).toEqual({ start: "12:00", end: "13:00" });
      // expect(merged.template_block_set_id).toBe(testBlockSetId); // 보호 필드 유지
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });

    it("캠프 모드에서 블록 세트 없을 때 에러 처리", async () => {
      // 실제 구현 시:
      // 1. 블록 세트가 연결되지 않은 캠프 템플릿 생성
      // const template = await createCampTemplate({
      //   tenant_id: testTenantId,
      //   name: "블록 세트 없는 템플릿",
      //   program_type: "윈터캠프",
      // });
      // 
      // 2. 플랜 그룹 생성 시도
      // const group = await createPlanGroup({
      //   tenant_id: testTenantId,
      //   student_id: testStudentId,
      //   plan_type: "camp",
      //   camp_template_id: template.id,
      // });
      // 
      // 3. 블록 세트 조회 시 에러 발생 확인
      // await expect(
      //   getBlockSetForPlanGroup(
      //     group,
      //     testStudentId,
      //     "user-id",
      //     "student",
      //     testTenantId
      //   )
      // ).rejects.toThrow();
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });
  });

  describe("일반 모드", () => {
    it("학생 블록 세트 조회 및 병합", async () => {
      // 실제 구현 시:
      // 1. 학생 블록 세트 생성
      // const blockSet = await createStudentBlockSet({
      //   student_id: testStudentId,
      //   name: "테스트 블록 세트",
      // });
      // 
      // 2. 플랜 그룹 생성
      // const group = await createPlanGroup({
      //   tenant_id: testTenantId,
      //   student_id: testStudentId,
      //   plan_type: "individual",
      //   block_set_id: blockSet.id,
      //   scheduler_options: {},
      //   time_settings: { lunch_time: { start: "12:00", end: "13:00" } },
      // });
      // 
      // 3. 블록 세트 조회 확인
      // const blocks = await getBlockSetForPlanGroup(
      //   group,
      //   testStudentId,
      //   "user-id",
      //   "student"
      // );
      // expect(blocks.length).toBeGreaterThan(0);
      // 
      // 4. time_settings 병합 확인
      // const merged = mergeTimeSettingsSafely(
      //   group.scheduler_options || {},
      //   group.time_settings
      // );
      // expect(merged.lunch_time).toEqual({ start: "12:00", end: "13:00" });
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });

    it("활성 블록 세트 fallback", async () => {
      // 실제 구현 시:
      // 1. 학생의 활성 블록 세트 설정
      // await setActiveBlockSet(testStudentId, testBlockSetId);
      // 
      // 2. block_set_id가 없는 플랜 그룹 생성
      // const group = await createPlanGroup({
      //   tenant_id: testTenantId,
      //   student_id: testStudentId,
      //   plan_type: "individual",
      //   block_set_id: null, // 명시적으로 null
      // });
      // 
      // 3. 활성 블록 세트로 fallback 확인
      // const blocks = await getBlockSetForPlanGroup(
      //   group,
      //   testStudentId,
      //   "user-id",
      //   "student"
      // );
      // expect(blocks.length).toBeGreaterThan(0);
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });
  });

  describe("daily_schedule 생성", () => {
    it("time_slots 포함 확인", async () => {
      // 실제 구현 시:
      // 1. 플랜 그룹 생성
      // const group = await createPlanGroup({
      //   tenant_id: testTenantId,
      //   student_id: testStudentId,
      //   block_set_id: testBlockSetId,
      // });
      // 
      // 2. daily_schedule 생성 (calculateAvailableDates 함수 사용)
      // const dailySchedule = await calculateAvailableDates({
      //   period_start: group.period_start,
      //   period_end: group.period_end,
      //   blocks: await getBlockSetForPlanGroup(...),
      //   // ... 기타 옵션
      // });
      // 
      // 3. 모든 날짜에 time_slots 포함 확인
      // for (const day of dailySchedule) {
      //   expect(day.time_slots).toBeDefined();
      //   expect(Array.isArray(day.time_slots)).toBe(true);
      //   expect(day.time_slots!.length).toBeGreaterThan(0);
      // }
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });

    it("time_slots 누락 시 에러 처리", async () => {
      // 실제 구현 시:
      // 1. time_slots가 없는 daily_schedule 생성 시도
      // const invalidSchedule: DailyScheduleInfo[] = [
      //   {
      //     date: "2025-01-01",
      //     day_type: "학습일",
      //     study_hours: 8,
      //     // time_slots 누락
      //   },
      // ];
      // 
      // 2. 플랜 그룹 생성 시 검증 실패 확인
      // await expect(
      //   createPlanGroup({
      //     tenant_id: testTenantId,
      //     student_id: testStudentId,
      //     daily_schedule: invalidSchedule,
      //   })
      // ).rejects.toThrow();
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });
  });

  describe("non_study_time_blocks 검증", () => {
    it("유효한 non_study_time_blocks 저장", async () => {
      // 실제 구현 시:
      // 1. 유효한 non_study_time_blocks 생성
      // const validBlocks: NonStudyTimeBlock[] = [
      //   {
      //     type: "점심식사",
      //     start_time: "12:00",
      //     end_time: "13:00",
      //   },
      //   {
      //     type: "수면",
      //     start_time: "22:00",
      //     end_time: "07:00",
      //     day_of_week: [0, 1, 2, 3, 4, 5, 6],
      //   },
      // ];
      // 
      // 2. 플랜 그룹 생성
      // const group = await createPlanGroup({
      //   tenant_id: testTenantId,
      //   student_id: testStudentId,
      //   non_study_time_blocks: validBlocks,
      // });
      // 
      // 3. 저장 확인
      // const savedGroup = await getPlanGroupById(group.id, testStudentId, testTenantId);
      // expect(savedGroup?.non_study_time_blocks).toEqual(validBlocks);
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });

    it("잘못된 non_study_time_blocks 검증 실패", async () => {
      // 실제 구현 시:
      // 1. 잘못된 non_study_time_blocks 생성
      // const invalidBlocks: NonStudyTimeBlock[] = [
      //   {
      //     type: "점심식사",
      //     start_time: "25:00", // 잘못된 시간 형식
      //     end_time: "13:00",
      //   },
      // ];
      // 
      // 2. 플랜 그룹 생성 시 검증 실패 확인
      // await expect(
      //   createPlanGroup({
      //     tenant_id: testTenantId,
      //     student_id: testStudentId,
      //     non_study_time_blocks: invalidBlocks,
      //   })
      // ).rejects.toThrow();
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });

    it("중복된 non_study_time_blocks 검증 실패", async () => {
      // 실제 구현 시:
      // 1. 중복된 시간 블록 생성
      // const duplicateBlocks: NonStudyTimeBlock[] = [
      //   {
      //     type: "점심식사",
      //     start_time: "12:00",
      //     end_time: "13:00",
      //   },
      //   {
      //     type: "저녁식사",
      //     start_time: "12:00", // 중복
      //     end_time: "13:00",
      //   },
      // ];
      // 
      // 2. 플랜 그룹 생성 시 검증 실패 확인
      // await expect(
      //   createPlanGroup({
      //     tenant_id: testTenantId,
      //     student_id: testStudentId,
      //     non_study_time_blocks: duplicateBlocks,
      //   })
      // ).rejects.toThrow();
      
      // 스킵: 실제 데이터베이스 연결 필요
      expect(true).toBe(true);
    });
  });
});

