// ============================================
// actions/coursePlan.ts 유닛 테스트
//
// 대상 함수:
//   fetchCoursePlanTabData        — 수강 계획 탭 데이터 조회
//   generateRecommendationsAction — 추천 생성 + pipeline sync
//   saveCoursePlanAction          — 단건 저장 (수동 추가)
//   updateCoursePlanStatusAction  — 상태 변경 (confirmed 시 세특 자동 생성)
//   removeCoursePlanAction        — 단건 삭제
//   bulkConfirmAction             — 학기 일괄 확정 + 세특 자동 생성
//   swapCoursePlanPriorityAction  — 우선순위 스왑
//
// 전략:
//   - requireAdminOrConsultant: mock
//   - course-plan/service: generateAndSaveRecommendations, fetchCoursePlanData,
//                          syncConfirmedToSeteks mock
//   - course-plan/repository: bulkUpsert, updateStatus, findById, remove,
//                             bulkConfirm, updatePriority mock
//   - pipeline (syncPipelineTaskStatus): fire-and-forget mock
//   - createSupabaseServerClient: students 조회 mock
//   - @/lib/domains/guide/repository: dynamic import mock
//   - @/lib/utils/schoolYear: calculateSchoolYear mock
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 의존성 mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
  logActionDebug: vi.fn(),
}));

vi.mock("../course-plan/service", () => ({
  fetchCoursePlanData: vi.fn(),
  generateAndSaveRecommendations: vi.fn(),
  syncConfirmedToSeteks: vi.fn(),
}));

vi.mock("../course-plan/repository", () => ({
  bulkUpsert: vi.fn(),
  updateStatus: vi.fn(),
  findById: vi.fn(),
  remove: vi.fn(),
  bulkConfirm: vi.fn(),
  updatePriority: vi.fn(),
}));

// pipeline syncPipelineTaskStatus — fire-and-forget이므로 resolved mock
// coursePlan.ts는 "./pipeline"으로 import하므로 동일 경로 mock 등록
vi.mock("../actions/pipeline", () => ({
  syncPipelineTaskStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: vi.fn().mockReturnValue(2026),
  getCurriculumYear: vi.fn().mockReturnValue(2022),
  gradeToSchoolYear: vi.fn().mockReturnValue(2026),
}));

// guide/repository — dynamic import("@/lib/domains/guide/repository") mock
vi.mock("@/lib/domains/guide/repository", () => ({
  linkAssignmentsToSeteks: vi.fn().mockResolvedValue(undefined),
}));

// ── Supabase client factory mock ─────────────────────────────────────────────

let supabaseMock: ReturnType<typeof makeSupabaseMock>;

function makeSupabaseMock() {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// ── 대상 import ──────────────────────────────────────────────────────────────

import {
  fetchCoursePlanTabData,
  generateRecommendationsAction,
  saveCoursePlanAction,
  updateCoursePlanStatusAction,
  removeCoursePlanAction,
  bulkConfirmAction,
  swapCoursePlanPriorityAction,
} from "../actions/coursePlan";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import * as coursePlanService from "../course-plan/service";
import * as coursePlanRepo from "../course-plan/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as pipelineActions from "../actions/pipeline";

const mockGuard = requireAdminOrConsultant as ReturnType<typeof vi.fn>;
const mockClientFactory = createSupabaseServerClient as ReturnType<typeof vi.fn>;
const mockFetchData = coursePlanService.fetchCoursePlanData as ReturnType<typeof vi.fn>;
const mockGenerateRec = coursePlanService.generateAndSaveRecommendations as ReturnType<typeof vi.fn>;
const mockSyncSeteks = coursePlanService.syncConfirmedToSeteks as ReturnType<typeof vi.fn>;
const mockSyncPipeline = pipelineActions.syncPipelineTaskStatus as ReturnType<typeof vi.fn>;
const mockBulkUpsert = coursePlanRepo.bulkUpsert as ReturnType<typeof vi.fn>;
const mockUpdateStatus = coursePlanRepo.updateStatus as ReturnType<typeof vi.fn>;
const mockFindById = coursePlanRepo.findById as ReturnType<typeof vi.fn>;
const mockRemove = coursePlanRepo.remove as ReturnType<typeof vi.fn>;
const mockBulkConfirm = coursePlanRepo.bulkConfirm as ReturnType<typeof vi.fn>;
const mockUpdatePriority = coursePlanRepo.updatePriority as ReturnType<typeof vi.fn>;

// ── 픽스처 ──────────────────────────────────────────────────────────────────

function makeCoursePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    student_id: "student-1",
    subject_id: "subject-1",
    tenant_id: "tenant-1",
    grade: 2,
    semester: 1,
    plan_status: "recommended" as const,
    source: "auto" as const,
    priority: 0,
    ...overrides,
  };
}

// ============================================
// fetchCoursePlanTabData
// ============================================

describe("fetchCoursePlanTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: service에서 받은 데이터 그대로 반환", async () => {
    const mockData = { plans: [], targetMajor: "컴퓨터공학", studentGrade: 2 };
    mockFetchData.mockResolvedValue(mockData);

    const result = await fetchCoursePlanTabData("student-1");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(mockData);
    expect(mockFetchData).toHaveBeenCalledWith("student-1");
  });

  it("service throw 시 에러 응답", async () => {
    mockFetchData.mockRejectedValue(new Error("DB 오류"));

    const result = await fetchCoursePlanTabData("student-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("수강 계획 조회 중 오류");
  });

  it("인증 실패 시 에러 응답", async () => {
    mockGuard.mockRejectedValue(new Error("권한 없음"));

    const result = await fetchCoursePlanTabData("student-1");

    expect(result.success).toBe(false);
  });
});

// ============================================
// generateRecommendationsAction
// ============================================

describe("generateRecommendationsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: 추천 데이터 반환 + pipeline sync 호출 (fire-and-forget)", async () => {
    const mockPlans = [makeCoursePlan(), makeCoursePlan({ id: "plan-2" })];
    mockGenerateRec.mockResolvedValue(mockPlans);

    const result = await generateRecommendationsAction("student-1", "tenant-1");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(mockPlans);
    expect(mockGenerateRec).toHaveBeenCalledWith("student-1", "tenant-1");

    // fire-and-forget 플러시 후 syncPipelineTaskStatus 호출 확인
    await Promise.resolve();
    expect(mockSyncPipeline).toHaveBeenCalledWith("student-1", "course_recommendation");
  });

  it("service throw 시 에러 메시지를 그대로 반환", async () => {
    mockGenerateRec.mockRejectedValue(new Error("전공 데이터 없음"));

    const result = await generateRecommendationsAction("student-1", "tenant-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("전공 데이터 없음");
  });

  it("Error가 아닌 throw 시 기본 에러 메시지", async () => {
    mockGenerateRec.mockRejectedValue("unknown error");

    const result = await generateRecommendationsAction("student-1", "tenant-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("추천 생성 중 오류");
  });
});

// ============================================
// saveCoursePlanAction
// ============================================

describe("saveCoursePlanAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: bulkUpsert 결과에서 첫 번째 id 반환", async () => {
    mockBulkUpsert.mockResolvedValue([makeCoursePlan({ id: "plan-99" })]);

    const result = await saveCoursePlanAction({
      tenantId: "tenant-1",
      studentId: "student-1",
      subjectId: "subject-1",
      grade: 2,
      semester: 1,
      notes: "수학 I 선택",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "plan-99" });
    expect(mockBulkUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        tenantId: "tenant-1",
        studentId: "student-1",
        subjectId: "subject-1",
        grade: 2,
        semester: 1,
        planStatus: "confirmed",
        source: "consultant",
        notes: "수학 I 선택",
      }),
    ]);
  });

  it("bulkUpsert throw 시 에러 응답", async () => {
    mockBulkUpsert.mockRejectedValue(new Error("중복 오류"));

    const result = await saveCoursePlanAction({
      tenantId: "t1",
      studentId: "s1",
      subjectId: "sub1",
      grade: 1,
      semester: 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("수강 계획 저장 중 오류");
  });
});

// ============================================
// updateCoursePlanStatusAction
// ============================================

describe("updateCoursePlanStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공 (비confirmed 상태): updateStatus 호출만", async () => {
    mockUpdateStatus.mockResolvedValue(undefined);

    const result = await updateCoursePlanStatusAction("plan-1", "reviewing");

    expect(result.success).toBe(true);
    expect(mockUpdateStatus).toHaveBeenCalledWith("plan-1", "reviewing");
    // syncConfirmedToSeteks는 호출되지 않아야 함
    expect(mockSyncSeteks).not.toHaveBeenCalled();
  });

  it("confirmed 전환 시 세특 자동 생성 (세특 없음 → 생성)", async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockFindById.mockResolvedValue(makeCoursePlan({ id: "plan-1" }));
    supabaseMock.single.mockResolvedValue({
      data: { grade: 2, tenant_id: "tenant-1" },
      error: null,
    });
    mockSyncSeteks.mockResolvedValue({ createdSeteks: ["setek-new-1"] });

    const result = await updateCoursePlanStatusAction("plan-1", "confirmed");

    expect(result.success).toBe(true);
    expect(mockSyncSeteks).toHaveBeenCalledWith(
      "student-1",
      "tenant-1",
      2,
      expect.any(Number), // calculateSchoolYear() = 2026
      2,
      1,
    );
  });

  it("confirmed 전환 + 세특 생성 없으면 linkAssignmentsToSeteks 미호출", async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockFindById.mockResolvedValue(makeCoursePlan());
    supabaseMock.single.mockResolvedValue({
      data: { grade: 2, tenant_id: "tenant-1" },
      error: null,
    });
    mockSyncSeteks.mockResolvedValue({ createdSeteks: [] });

    const { linkAssignmentsToSeteks } = await import("@/lib/domains/guide/repository");
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    mockUpdateStatus.mockResolvedValue(undefined);
    mockFindById.mockResolvedValue(makeCoursePlan());
    supabaseMock.single.mockResolvedValue({ data: { grade: 2, tenant_id: "t1" }, error: null });
    mockSyncSeteks.mockResolvedValue({ createdSeteks: [] });
    mockClientFactory.mockResolvedValue(supabaseMock);

    await updateCoursePlanStatusAction("plan-1", "confirmed");

    expect(linkAssignmentsToSeteks).not.toHaveBeenCalled();
  });

  it("updateStatus throw 시 에러 응답", async () => {
    mockUpdateStatus.mockRejectedValue(new Error("DB 오류"));

    const result = await updateCoursePlanStatusAction("plan-1", "confirmed");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("상태 변경 중 오류");
  });

  it("student 조회 실패해도 주요 상태 변경 성공 유지", async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockFindById.mockResolvedValue(makeCoursePlan());
    // students 조회 실패 → student = null
    supabaseMock.single.mockResolvedValue({ data: null, error: null });

    const result = await updateCoursePlanStatusAction("plan-1", "confirmed");

    // 세특 sync는 실행되지 않았지만 주요 응답은 성공
    expect(result.success).toBe(true);
    expect(mockSyncSeteks).not.toHaveBeenCalled();
  });
});

// ============================================
// removeCoursePlanAction
// ============================================

describe("removeCoursePlanAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: repo.remove 호출 후 success true", async () => {
    mockRemove.mockResolvedValue(undefined);

    const result = await removeCoursePlanAction("plan-1");

    expect(result.success).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith("plan-1");
  });

  it("repo.remove throw 시 에러 응답", async () => {
    mockRemove.mockRejectedValue(new Error("삭제 실패"));

    const result = await removeCoursePlanAction("plan-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("삭제 중 오류");
  });
});

// ============================================
// bulkConfirmAction
// ============================================

describe("bulkConfirmAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공: count 반환 + 세특 자동 생성 포함", async () => {
    mockBulkConfirm.mockResolvedValue(5);
    supabaseMock.single.mockResolvedValue({
      data: { grade: 2, tenant_id: "tenant-1" },
      error: null,
    });
    mockSyncSeteks.mockResolvedValue({ createdSeteks: ["setek-a", "setek-b"] });

    const result = await bulkConfirmAction("student-1", 2, 1);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ count: 5 });
    expect(mockBulkConfirm).toHaveBeenCalledWith("student-1", 2, 1);
    expect(mockSyncSeteks).toHaveBeenCalledWith(
      "student-1",
      "tenant-1",
      2,
      2026,
      2,
      1,
    );
  });

  it("세특 생성 오류 발생해도 bulkConfirm 결과는 성공 유지", async () => {
    mockBulkConfirm.mockResolvedValue(3);
    supabaseMock.single.mockResolvedValue({
      data: { grade: 2, tenant_id: "tenant-1" },
      error: null,
    });
    mockSyncSeteks.mockRejectedValue(new Error("세특 동기화 오류"));

    const result = await bulkConfirmAction("student-1", 2, 1);

    // sync 오류는 catch 내부에서 logActionError만 호출, 응답은 성공
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ count: 3 });
  });

  it("student 조회 실패해도 count 성공 반환", async () => {
    mockBulkConfirm.mockResolvedValue(2);
    supabaseMock.single.mockResolvedValue({ data: null, error: null });

    const result = await bulkConfirmAction("student-1", 1, 2);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ count: 2 });
    expect(mockSyncSeteks).not.toHaveBeenCalled();
  });

  it("bulkConfirm throw 시 에러 응답", async () => {
    mockBulkConfirm.mockRejectedValue(new Error("일괄 확정 실패"));

    const result = await bulkConfirmAction("student-1", 2, 1);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("일괄 확정 중 오류");
  });

  it("인증 실패 시 에러 응답", async () => {
    mockGuard.mockRejectedValue(new Error("권한 없음"));

    const result = await bulkConfirmAction("student-1", 2, 1);

    expect(result.success).toBe(false);
  });
});

// ============================================
// swapCoursePlanPriorityAction
// ============================================

describe("swapCoursePlanPriorityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: 두 플랜의 우선순위 교환", async () => {
    mockUpdatePriority.mockResolvedValue(undefined);

    const result = await swapCoursePlanPriorityAction("plan-A", 10, "plan-B", 20);

    expect(result.success).toBe(true);
    expect(mockUpdatePriority).toHaveBeenCalledTimes(2);
    expect(mockUpdatePriority).toHaveBeenCalledWith("plan-A", 20);
    expect(mockUpdatePriority).toHaveBeenCalledWith("plan-B", 10);
  });

  it("updatePriority throw 시 에러 응답", async () => {
    mockUpdatePriority.mockRejectedValue(new Error("우선순위 변경 실패"));

    const result = await swapCoursePlanPriorityAction("plan-A", 10, "plan-B", 20);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("순서 변경 중 오류");
  });
});
