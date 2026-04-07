// ============================================
// stale-detection.ts 유닛 테스트
//
// 대상 함수:
//   markRelatedEdgesStale        — 레코드 저장 후 엣지 stale 마킹
//   markRelatedAssignmentsStale  — 레코드 저장 후 가이드 배정 stale 마킹
//   markStudentAssignmentsStale  — 학생 전체 가이드 배정 stale 마킹
//   autoMatchRoadmapOnSetekSave  — 세특 저장 시 로드맵 자동 매칭
//   autoMatchRoadmapOnConfirm    — 세특 확정 시 로드맵 completed 전환
//   markRelatedGuidesStale       — 가이드 stale 마킹
//
// 전략:
//   모든 함수가 fire-and-forget 패턴 — 에러 시 throw 없이 로그만 남김
//   edge-repository mock + supabase chain mock
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 의존성 mock ──

const mockMarkEdgesStale = vi.fn().mockResolvedValue(undefined);
const mockMarkAllStudentEdgesStale = vi.fn().mockResolvedValue(undefined);

vi.mock("../repository/edge-repository", () => ({
  markEdgesStale: (...args: unknown[]) => mockMarkEdgesStale(...args),
  markAllStudentEdgesStale: (...args: unknown[]) => mockMarkAllStudentEdgesStale(...args),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
  logActionDebug: vi.fn(),
}));

// supabase mock setup
let supabaseMock: ReturnType<typeof makeSupabaseMock>;

function makeSupabaseMock() {
  // Supabase 체이닝 mock
  // 중요: 최상위 객체에 then을 넣으면 await createSupabaseServerClient()에서
  // thenable로 unwrap되어 체인 객체가 아닌 값이 반환됨.
  // → query chain 결과를 별도 thenable로 분리.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: Record<string, any> = {};

  // 쿼리 체인 결과: thenable (Promise.allSettled 등에서 사용)
  function makeQueryChain() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: Record<string, any> = {};
    q.select = vi.fn(() => q);
    q.update = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.is = vi.fn(() => q);
    q.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    q.then = (fn: (v: unknown) => unknown) => Promise.resolve(fn({ data: [], error: null }));
    // client에 프록시: update/eq 호출도 client에 기록
    return q;
  }

  const queryChain = makeQueryChain();
  client.from = vi.fn(() => queryChain);
  client.select = queryChain.select;
  client.update = queryChain.update;
  client.eq = queryChain.eq;
  client.is = queryChain.is;
  client.maybeSingle = queryChain.maybeSingle;
  client._queryChain = queryChain;
  return client;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import {
  markRelatedEdgesStale,
  markRelatedAssignmentsStale,
  markStudentAssignmentsStale,
  autoMatchRoadmapOnSetekSave,
  autoMatchRoadmapOnConfirm,
  markRelatedGuidesStale,
} from "../stale-detection";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionWarn } from "@/lib/logging/actionLogger";

const mockClientFactory = createSupabaseServerClient as ReturnType<typeof vi.fn>;
const mockLogWarn = logActionWarn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock = makeSupabaseMock();
  mockClientFactory.mockResolvedValue(supabaseMock);
});

// ============================================
// markRelatedEdgesStale
// ============================================

describe("markRelatedEdgesStale", () => {
  it("edge-repository의 markEdgesStale을 호출한다", async () => {
    await markRelatedEdgesStale("record-1");
    expect(mockMarkEdgesStale).toHaveBeenCalledWith("record-1", "source_record_updated");
  });

  it("에러 시 throw하지 않고 경고 로그만 남긴다", async () => {
    mockMarkEdgesStale.mockRejectedValueOnce(new Error("DB error"));
    await expect(markRelatedEdgesStale("record-1")).resolves.toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "stale-detection" }),
      expect.stringContaining("markRelatedEdgesStale failed"),
      expect.any(Object),
    );
  });
});

// ============================================
// markRelatedAssignmentsStale
// ============================================

describe("markRelatedAssignmentsStale", () => {
  it("exploration_guide_assignments를 stale로 업데이트한다", async () => {
    await markRelatedAssignmentsStale("record-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("exploration_guide_assignments");
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_stale: true, stale_reason: "linked_record_updated" }),
    );
  });

  it("에러 시 throw하지 않고 경고 로그만 남긴다", async () => {
    supabaseMock.eq.mockImplementationOnce(() => { throw new Error("DB error"); });
    await expect(markRelatedAssignmentsStale("record-1")).resolves.toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalled();
  });
});

// ============================================
// markStudentAssignmentsStale
// ============================================

describe("markStudentAssignmentsStale", () => {
  it("학생 전체 배정을 stale로 업데이트한다", async () => {
    await markStudentAssignmentsStale("student-1", "tenant-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("exploration_guide_assignments");
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_stale: true, stale_reason: "target_major_changed" }),
    );
  });

  it("에러 시 throw하지 않는다", async () => {
    supabaseMock.eq.mockImplementationOnce(() => { throw new Error("DB error"); });
    await expect(markStudentAssignmentsStale("student-1", "tenant-1")).resolves.toBeUndefined();
  });
});

// ============================================
// autoMatchRoadmapOnSetekSave
// ============================================

describe("autoMatchRoadmapOnSetekSave", () => {
  it("content가 MIN_IMPORTED_LENGTH 미만이면 조기 반환", async () => {
    await autoMatchRoadmapOnSetekSave("s1", "sub1", 1, "짧");
    // supabase 호출 없음
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("빈 content에 조기 반환", async () => {
    await autoMatchRoadmapOnSetekSave("s1", "sub1", 1, "");
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("과목명 조회 후 매칭되는 로드맵 항목을 in_progress로 전환", async () => {
    // 과목 조회 결과 설정
    supabaseMock.maybeSingle.mockResolvedValueOnce({
      data: { name: "미적분" },
      error: null,
    });

    // 로드맵 항목 조회 결과 — from().select().eq()...의 thenable 결과
    const roadmapItems = [
      { id: "r1", plan_content: "미적분 심화 탐구", plan_keywords: null, status: "planning" },
      { id: "r2", plan_content: "통계학 기초", plan_keywords: null, status: "planning" },
    ];

    // eq chain의 마지막 then에서 결과 반환
    let eqCallCount = 0;
    supabaseMock.eq.mockImplementation(() => {
      eqCallCount++;
      const result = { ...supabaseMock };
      // roadmap 쿼리 응답 (두 번째 from 호출 후 마지막 eq 체인)
      (result as unknown as { then: (fn: (v: unknown) => unknown) => Promise<unknown> }).then = (fn) =>
        Promise.resolve(fn({ data: eqCallCount > 5 ? roadmapItems : [], error: null }));
      return result;
    });

    const content = "미적분의 역함수 정리를 활용하여 적분 문제를 풀었습니다.";
    await autoMatchRoadmapOnSetekSave("s1", "sub1", 1, content);

    // subjects 테이블 조회
    expect(supabaseMock.from).toHaveBeenCalledWith("subjects");
  });

  it("과목명이 없으면 조기 반환", async () => {
    supabaseMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const content = "충분히 긴 콘텐츠입니다. 스무 자 이상이어야 합니다.";
    await autoMatchRoadmapOnSetekSave("s1", "sub1", 1, content);

    // subjects만 조회하고 roadmap_items는 조회하지 않음
    const fromCalls = supabaseMock.from.mock.calls.map((c: string[]) => c[0]);
    expect(fromCalls).toContain("subjects");
    expect(fromCalls).not.toContain("student_record_roadmap_items");
  });

  it("에러 시 throw하지 않고 경고 로그만 남긴다", async () => {
    mockClientFactory.mockRejectedValueOnce(new Error("connection error"));
    const content = "충분히 긴 콘텐츠입니다. 스무 자 이상이어야 합니다.";
    await expect(
      autoMatchRoadmapOnSetekSave("s1", "sub1", 1, content),
    ).resolves.toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalled();
  });
});

// ============================================
// autoMatchRoadmapOnConfirm
// ============================================

describe("autoMatchRoadmapOnConfirm", () => {
  it("과목명이 없으면 조기 반환", async () => {
    supabaseMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await autoMatchRoadmapOnConfirm("s1", "sub1", 1);
    const fromCalls = supabaseMock.from.mock.calls.map((c: string[]) => c[0]);
    expect(fromCalls).not.toContain("student_record_roadmap_items");
  });

  it("에러 시 throw하지 않는다", async () => {
    mockClientFactory.mockRejectedValueOnce(new Error("DB error"));
    await expect(autoMatchRoadmapOnConfirm("s1", "sub1", 1)).resolves.toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalled();
  });
});

// ============================================
// markRelatedGuidesStale
// ============================================

describe("markRelatedGuidesStale", () => {
  it("3개 가이드 테이블을 stale로 업데이트한다", async () => {
    const guideMock = makeSupabaseMock();
    mockClientFactory.mockReset();
    mockClientFactory.mockResolvedValue(guideMock);

    await markRelatedGuidesStale("student-1", "course_plan_changed");

    const fromCalls = guideMock.from.mock.calls.map((c: string[]) => c[0]);
    expect(fromCalls).toContain("student_record_setek_guides");
    expect(fromCalls).toContain("student_record_changche_guides");
    expect(fromCalls).toContain("student_record_haengteuk_guides");
  });

  it("prospective 모드만 대상으로 한다", async () => {
    const guideMock = makeSupabaseMock();
    mockClientFactory.mockReset();
    mockClientFactory.mockResolvedValue(guideMock);

    await markRelatedGuidesStale("student-1", "test_reason");
    const eqCalls = guideMock.eq.mock.calls;
    const guideModeCall = eqCalls.find((c: string[]) => c[0] === "guide_mode");
    expect(guideModeCall).toBeDefined();
    expect(guideModeCall![1]).toBe("prospective");
  });

  it("에러 시 throw하지 않는다", async () => {
    mockClientFactory.mockReset();
    mockClientFactory.mockRejectedValue(new Error("DB error"));
    await expect(
      markRelatedGuidesStale("student-1", "test"),
    ).resolves.toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalled();
  });
});
