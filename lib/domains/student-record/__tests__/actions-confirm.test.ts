// ============================================
// actions/confirm.ts 유닛 테스트
//
// 대상 함수:
//   acceptAiDraftAction    — AI 초안 → 컨설턴트 가안 수용
//   confirmDraftAction     — 컨설턴트 가안 → 확정본
//   revertConfirmAction    — 확정 → 검토 중 되돌리기
//   confirmTagsAction      — 분석 태그 일괄 confirmed
//   confirmDirectionAction — 방향 가이드 확정
//   confirmAssignmentAction — 가이드 배정 확정
//
// 전략:
//   - requireAdminOrConsultant: userId/tenantId mock / throw 두 가지
//   - createSupabaseServerClient: 체이닝 mock (from→select/update→eq→single)
//   - stale-detection: dynamic import mock (confirm 내부에서 dynamic import 사용)
//   - count 응답으로 낙관적 잠금(CONFLICT) 시나리오 검증
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

// stale-detection — acceptAiDraftAction / confirmDraftAction 내부에서
// dynamic import("../stale-detection")를 사용하므로 모듈 자체를 mock
vi.mock("../stale-detection", () => ({
  markRelatedEdgesStale: vi.fn().mockResolvedValue(undefined),
  markRelatedAssignmentsStale: vi.fn().mockResolvedValue(undefined),
  autoMatchRoadmapOnConfirm: vi.fn().mockResolvedValue(undefined),
}));

// ── Supabase client factory mock ─────────────────────────────────────────────

// 각 테스트에서 supabase 체인을 커스터마이즈할 수 있도록 팩토리 패턴 사용
let supabaseMock: ReturnType<typeof makeSupabaseMock>;

function makeSupabaseMock() {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    // update().eq().eq().select() 결과 — count 포함
    _updateResult: { error: null, count: 1 },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// ── 대상 import ──────────────────────────────────────────────────────────────

import {
  acceptAiDraftAction,
  confirmDraftAction,
  revertConfirmAction,
  confirmTagsAction,
  confirmDirectionAction,
  confirmAssignmentAction,
} from "../actions/confirm";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const mockGuard = requireAdminOrConsultant as ReturnType<typeof vi.fn>;
const mockClientFactory = createSupabaseServerClient as ReturnType<typeof vi.fn>;

// ============================================
// acceptAiDraftAction
// ============================================

describe("acceptAiDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공: AI 초안이 있을 때 content 복사 후 success 반환", async () => {
    // from(table).select(...).eq(id).single() — fetch 경로
    supabaseMock.single.mockResolvedValueOnce({
      data: { ai_draft_content: "AI가 생성한 세특", content: null, updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });

    // update().eq().eq().select() 체인 끝에서 { error, count } 반환
    // select()가 체인 최종 await 대상이므로 Promise를 직접 반환
    const finalSelectMock = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const eqForUpdatedAt = vi.fn().mockReturnValue({ select: finalSelectMock });
    const eqForId = vi.fn().mockReturnValue({ eq: eqForUpdatedAt });
    supabaseMock.update = vi.fn().mockReturnValue({ eq: eqForId });

    const result = await acceptAiDraftAction("setek-1", "setek");

    expect(result.success).toBe(true);
    // AI 원본은 보존 — 가안 레이어 AI 관점에서 계속 참조 가능해야 함
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ content: "AI가 생성한 세특", status: "review" }),
    );
    const updateArg = supabaseMock.update.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty("ai_draft_content");
    expect(updateArg).not.toHaveProperty("ai_draft_at");
  });

  it("AI 초안 없을 때 에러 반환", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { ai_draft_content: null, content: "기존 내용", updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });

    const result = await acceptAiDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("AI 초안이 없습니다.");
  });

  it("기존 content가 있고 force=false 이면 CONTENT_EXISTS 에러 반환", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { ai_draft_content: "AI 내용", content: "기존 컨설턴트 내용", updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });

    const result = await acceptAiDraftAction("setek-1", "setek", false);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("CONTENT_EXISTS");
  });

  it("기존 content가 있어도 force=true 이면 덮어쓰기 성공", async () => {
    supabaseMock.single.mockResolvedValueOnce({
      data: { ai_draft_content: "AI 내용", content: "기존 컨설턴트 내용", updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });
    // update().eq().eq().select() 체인
    const finalSelectMock = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const eqForUpdatedAt = vi.fn().mockReturnValue({ select: finalSelectMock });
    const eqForId = vi.fn().mockReturnValue({ eq: eqForUpdatedAt });
    supabaseMock.update = vi.fn().mockReturnValue({ eq: eqForId });

    const result = await acceptAiDraftAction("setek-1", "setek", true);

    expect(result.success).toBe(true);
  });

  it("낙관적 잠금: count=0 이면 CONFLICT 반환", async () => {
    supabaseMock.single.mockResolvedValueOnce({
      data: { ai_draft_content: "AI 내용", content: null, updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });
    // update().eq().eq().select() → count=0
    const finalSelectMock = vi.fn().mockResolvedValue({ error: null, count: 0 });
    const eqForUpdatedAt = vi.fn().mockReturnValue({ select: finalSelectMock });
    const eqForId = vi.fn().mockReturnValue({ eq: eqForUpdatedAt });
    supabaseMock.update = vi.fn().mockReturnValue({ eq: eqForId });

    const result = await acceptAiDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("CONFLICT");
  });

  it("DB fetch 에러 시 에러 응답", async () => {
    supabaseMock.single.mockResolvedValue({
      data: null,
      error: { message: "DB 연결 오류", code: "500" },
    });

    const result = await acceptAiDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("AI 초안 수용에 실패");
  });

  it("인증 실패 시 에러 응답", async () => {
    mockGuard.mockRejectedValue(new Error("로그인 필요"));

    const result = await acceptAiDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("AI 초안 수용에 실패");
  });

  it("changche 타입에서도 올바른 테이블로 조회", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { ai_draft_content: null, content: null, updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    });

    await acceptAiDraftAction("changche-1", "changche");

    // from("student_record_changche") 호출 확인
    expect(supabaseMock.from).toHaveBeenCalledWith("student_record_changche");
  });
});

// ============================================
// confirmDraftAction
// ============================================

describe("confirmDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "consultant" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공: content → confirmed_content 복사 + status=final (낙관적 잠금)", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { content: "컨설턴트 가안", updated_at: "2026-04-06T00:00:00Z", student_id: "student-1", subject_id: "subject-1", grade: 2 },
      error: null,
    });

    // update().eq(id).eq(updated_at).select(id) 체인 → { error: null, count: 1 }
    const selectMock = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const eq2Mock = vi.fn().mockReturnValue({ select: selectMock });
    const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock });
    supabaseMock.update = vi.fn().mockReturnValue({ eq: eq1Mock });

    const result = await confirmDraftAction("setek-1", "setek");

    expect(result.success).toBe(true);
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmed_content: "컨설턴트 가안",
        status: "final",
        confirmed_by: "user-1",
      }),
    );
  });

  it("content 없을 때 에러 반환", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { content: null, student_id: "s1", subject_id: "sub1", grade: 2 },
      error: null,
    });

    const result = await confirmDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("확정할 가안이 없습니다.");
  });

  it("content가 빈 문자열이면 에러 반환", async () => {
    // confirmDraftAction은 !data?.content 로 체크 — 빈 문자열은 falsy
    supabaseMock.single.mockResolvedValue({
      data: { content: "", student_id: "s1", subject_id: "sub1", grade: 2 },
      error: null,
    });

    const result = await confirmDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("확정할 가안이 없습니다.");
  });

  it("fetch 에러 시 에러 응답", async () => {
    supabaseMock.single.mockResolvedValue({
      data: null,
      error: { message: "not found", code: "PGRST116" },
    });

    const result = await confirmDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("가안 확정에 실패");
  });

  it("인증 실패 시 에러 응답", async () => {
    mockGuard.mockRejectedValue(new Error("권한 없음"));

    const result = await confirmDraftAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("가안 확정에 실패");
  });
});

// ============================================
// revertConfirmAction
// ============================================

describe("revertConfirmAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공: confirmed_content가 있으면 review로 되돌리기", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { confirmed_content: "확정된 세특 내용" },
      error: null,
    });
    const chainMock = { eq: vi.fn().mockResolvedValue({ error: null }) };
    supabaseMock.update = vi.fn().mockReturnValue(chainMock);

    const result = await revertConfirmAction("setek-1", "setek");

    expect(result.success).toBe(true);
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed_content: null, status: "review" }),
    );
  });

  it("confirmed_content 없으면 에러 반환", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { confirmed_content: null },
      error: null,
    });

    const result = await revertConfirmAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("확정된 내용이 없습니다.");
  });

  it("confirmed_content가 공백만 있으면 에러 반환", async () => {
    supabaseMock.single.mockResolvedValue({
      data: { confirmed_content: "   " },
      error: null,
    });

    const result = await revertConfirmAction("setek-1", "setek");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("확정된 내용이 없습니다.");
  });
});

// ============================================
// confirmTagsAction
// ============================================

describe("confirmTagsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공: tag ids로 일괄 confirmed 업데이트", async () => {
    const chainMock = { in: vi.fn().mockResolvedValue({ error: null }) };
    supabaseMock.update = vi.fn().mockReturnValue(chainMock);

    const result = await confirmTagsAction(["tag-1", "tag-2", "tag-3"]);

    expect(result.success).toBe(true);
    expect(supabaseMock.update).toHaveBeenCalledWith({ status: "confirmed" });
    expect(chainMock.in).toHaveBeenCalledWith("id", ["tag-1", "tag-2", "tag-3"]);
  });

  it("DB 에러 시 에러 응답", async () => {
    const chainMock = { in: vi.fn().mockResolvedValue({ error: { message: "DB 오류" } }) };
    supabaseMock.update = vi.fn().mockReturnValue(chainMock);

    const result = await confirmTagsAction(["tag-1"]);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("태그 확정에 실패");
  });
});

// ============================================
// confirmDirectionAction
// ============================================

describe("confirmDirectionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공: status=confirmed + confirmed_at/by 설정", async () => {
    const chainMock = { eq: vi.fn().mockResolvedValue({ error: null }) };
    supabaseMock.update = vi.fn().mockReturnValue(chainMock);

    const result = await confirmDirectionAction("guide-1");

    expect(result.success).toBe(true);
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed", confirmed_by: "user-1" }),
    );
    expect(supabaseMock.from).toHaveBeenCalledWith("student_record_setek_guides");
  });

  it("DB 에러 시 에러 응답", async () => {
    const chainMock = { eq: vi.fn().mockResolvedValue({ error: { message: "에러" } }) };
    supabaseMock.update = vi.fn().mockReturnValue(chainMock);

    const result = await confirmDirectionAction("guide-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("방향 가이드 확정에 실패");
  });
});

// ============================================
// confirmAssignmentAction
// ============================================

describe("confirmAssignmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
    supabaseMock = makeSupabaseMock();
    mockClientFactory.mockResolvedValue(supabaseMock);
  });

  it("성공: status=completed + confirmed_at/by 설정", async () => {
    const chainMock = { eq: vi.fn().mockResolvedValue({ error: null }) };
    supabaseMock.update = vi.fn().mockReturnValue(chainMock);

    const result = await confirmAssignmentAction("assignment-1");

    expect(result.success).toBe(true);
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", confirmed_by: "user-1" }),
    );
    expect(supabaseMock.from).toHaveBeenCalledWith("exploration_guide_assignments");
  });

  it("DB 에러 시 에러 응답", async () => {
    const chainMock = { eq: vi.fn().mockResolvedValue({ error: { message: "에러" } }) };
    supabaseMock.update = vi.fn().mockReturnValue(chainMock);

    const result = await confirmAssignmentAction("assignment-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("배정 확정에 실패");
  });

  it("인증 실패 시 에러 응답", async () => {
    mockGuard.mockRejectedValue(new Error("권한 없음"));

    const result = await confirmAssignmentAction("assignment-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("배정 확정에 실패");
  });
});
