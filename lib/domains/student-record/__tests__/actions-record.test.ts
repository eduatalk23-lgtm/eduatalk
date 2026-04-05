// ============================================
// actions/record.ts 유닛 테스트
//
// 대상 함수:
//   saveSetekAction        — 세특 저장 + stale marking + 로드맵 매칭
//   savePersonalSetekAction — 개인 세특 저장 + stale marking
//   removeSetekAction      — 세특 소프트 삭제
//   removePersonalSetekAction — 개인 세특 소프트 삭제
//   saveChangcheAction     — 창체 저장 + stale marking
//   saveHaengteukAction    — 행특 저장 + stale marking
//   addReadingAction       — 독서 추가
//   removeReadingAction    — 독서 삭제
//   saveAttendanceAction   — 출결 저장
//
// 전략:
//   - requireAdminOrConsultant: 성공(userId/tenantId 반환) / 실패(throw) 두 가지 시나리오
//   - service.*: 모든 CRUD 함수 mock — success/error 두 가지 반환
//   - stale-detection: fire-and-forget 함수 mock (호출 확인만)
//   - 각 테스트는 beforeEach에서 vi.clearAllMocks()로 독립성 보장
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 의존성 mock ──────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("../service", () => ({
  saveSetek: vi.fn(),
  savePersonalSetek: vi.fn(),
  removeSetek: vi.fn(),
  removePersonalSetek: vi.fn(),
  saveChangche: vi.fn(),
  saveHaengteuk: vi.fn(),
  addReading: vi.fn(),
  removeReading: vi.fn(),
  saveAttendance: vi.fn(),
  getRecordTabData: vi.fn(),
}));

vi.mock("../stale-detection", () => ({
  markRelatedEdgesStale: vi.fn().mockResolvedValue(undefined),
  markRelatedAssignmentsStale: vi.fn().mockResolvedValue(undefined),
  autoMatchRoadmapOnSetekSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
  logActionDebug: vi.fn(),
}));

// ── 대상 import ──────────────────────────────────────────────────────────────

import {
  saveSetekAction,
  savePersonalSetekAction,
  removeSetekAction,
  removePersonalSetekAction,
  saveChangcheAction,
  saveHaengteukAction,
  addReadingAction,
  removeReadingAction,
  saveAttendanceAction,
} from "../actions/record";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import * as service from "../service";
import {
  markRelatedEdgesStale,
  markRelatedAssignmentsStale,
  autoMatchRoadmapOnSetekSave,
} from "../stale-detection";

// ── 타입 캐스팅 헬퍼 ─────────────────────────────────────────────────────────

const mockGuard = requireAdminOrConsultant as ReturnType<typeof vi.fn>;
const mockSaveSetek = service.saveSetek as ReturnType<typeof vi.fn>;
const mockSavePersonalSetek = service.savePersonalSetek as ReturnType<typeof vi.fn>;
const mockRemoveSetek = service.removeSetek as ReturnType<typeof vi.fn>;
const mockRemovePersonalSetek = service.removePersonalSetek as ReturnType<typeof vi.fn>;
const mockSaveChangche = service.saveChangche as ReturnType<typeof vi.fn>;
const mockSaveHaengteuk = service.saveHaengteuk as ReturnType<typeof vi.fn>;
const mockAddReading = service.addReading as ReturnType<typeof vi.fn>;
const mockRemoveReading = service.removeReading as ReturnType<typeof vi.fn>;
const mockSaveAttendance = service.saveAttendance as ReturnType<typeof vi.fn>;
const mockEdgesStale = markRelatedEdgesStale as ReturnType<typeof vi.fn>;
const mockAssignStale = markRelatedAssignmentsStale as ReturnType<typeof vi.fn>;
const mockRoadmapMatch = autoMatchRoadmapOnSetekSave as ReturnType<typeof vi.fn>;

// ── 픽스처 팩토리 ────────────────────────────────────────────────────────────

function makeSetekInput(overrides: Record<string, unknown> = {}) {
  return {
    student_id: "student-1",
    subject_id: "subject-1",
    grade: 2,
    semester: 1,
    school_year: 2026,
    char_limit: 500,
    content: "탐구 활동을 통해 미적분의 응용 가능성을 탐색하였다.",
    ...overrides,
  };
}

function makeChangcheInput(overrides: Record<string, unknown> = {}) {
  return {
    student_id: "student-1",
    activity_type: "career" as const,
    content: "진로 탐색 활동에 적극 참여하였다.",
    school_year: 2026,
    grade: 2,
    semester: 1,
    ...overrides,
  };
}

function makeHaengteukInput(overrides: Record<string, unknown> = {}) {
  return {
    student_id: "student-1",
    content: "모든 활동에 성실히 임하였다.",
    school_year: 2026,
    grade: 2,
    semester: 1,
    ...overrides,
  };
}

// ============================================
// saveSetekAction
// ============================================

describe("saveSetekAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: id 반환 + stale marking + 로드맵 매칭 호출", async () => {
    mockSaveSetek.mockResolvedValue({ success: true, id: "setek-123" });

    const result = await saveSetekAction(makeSetekInput());

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "setek-123" });

    // fire-and-forget 이므로 마이크로태스크 플러시
    await Promise.resolve();
    expect(mockEdgesStale).toHaveBeenCalledWith("setek-123");
    expect(mockAssignStale).toHaveBeenCalledWith("setek-123");
    expect(mockRoadmapMatch).toHaveBeenCalledWith(
      "student-1",
      "subject-1",
      2,
      expect.any(String),
    );
  });

  it("service 실패 시 에러 응답 반환", async () => {
    mockSaveSetek.mockResolvedValue({ success: false, error: "NEIS 바이트 초과" });

    const result = await saveSetekAction(makeSetekInput());

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("NEIS 바이트 초과");
    // stale marking은 호출되지 않아야 함
    await Promise.resolve();
    expect(mockEdgesStale).not.toHaveBeenCalled();
  });

  it("service가 error 없이 실패 시 기본 에러 메시지 반환", async () => {
    mockSaveSetek.mockResolvedValue({ success: false });

    const result = await saveSetekAction(makeSetekInput());

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("세특 저장 실패");
  });

  it("인증 실패(throw) 시 에러 응답 반환", async () => {
    mockGuard.mockRejectedValue(new Error("로그인이 필요합니다."));

    const result = await saveSetekAction(makeSetekInput());

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("세특 저장 중 오류");
  });

  it("student_id/subject_id/grade 중 하나가 없으면 로드맵 매칭 미호출", async () => {
    mockSaveSetek.mockResolvedValue({ success: true, id: "setek-456" });
    const input = makeSetekInput({ subject_id: undefined });

    await saveSetekAction(input);
    await Promise.resolve();

    expect(mockRoadmapMatch).not.toHaveBeenCalled();
  });
});

// ============================================
// savePersonalSetekAction
// ============================================

describe("savePersonalSetekAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: id 반환 + stale marking 호출", async () => {
    mockSavePersonalSetek.mockResolvedValue({ success: true, id: "psetek-999" });

    const result = await savePersonalSetekAction({
      student_id: "student-1",
      content: "개인 세특 내용",
      school_year: 2026,
      grade: 2,
    } as never);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "psetek-999" });
    await Promise.resolve();
    expect(mockEdgesStale).toHaveBeenCalledWith("psetek-999");
    expect(mockAssignStale).toHaveBeenCalledWith("psetek-999");
  });

  it("service 실패 시 에러 응답 반환", async () => {
    mockSavePersonalSetek.mockResolvedValue({ success: false, error: "저장 오류" });

    const result = await savePersonalSetekAction({ student_id: "s1" } as never);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("저장 오류");
  });
});

// ============================================
// removeSetekAction
// ============================================

describe("removeSetekAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: success true 반환", async () => {
    mockRemoveSetek.mockResolvedValue({ success: true });

    const result = await removeSetekAction("setek-1");

    expect(result.success).toBe(true);
    expect(mockRemoveSetek).toHaveBeenCalledWith("setek-1");
  });

  it("service 실패 시 에러 응답", async () => {
    mockRemoveSetek.mockResolvedValue({ success: false, error: "삭제 실패" });

    const result = await removeSetekAction("setek-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("삭제 실패");
  });

  it("인증 실패 시 에러 응답", async () => {
    mockGuard.mockRejectedValue(new Error("권한 없음"));

    const result = await removeSetekAction("setek-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("삭제 중 오류");
  });
});

// ============================================
// removePersonalSetekAction
// ============================================

describe("removePersonalSetekAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: success true", async () => {
    mockRemovePersonalSetek.mockResolvedValue({ success: true });

    const result = await removePersonalSetekAction("psetek-1");

    expect(result.success).toBe(true);
  });

  it("service 실패 시 기본 에러 메시지", async () => {
    mockRemovePersonalSetek.mockResolvedValue({ success: false });

    const result = await removePersonalSetekAction("psetek-1");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("개인 세특 삭제 실패");
  });
});

// ============================================
// saveChangcheAction
// ============================================

describe("saveChangcheAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "consultant" });
  });

  it("성공: id 반환 + stale marking 호출", async () => {
    mockSaveChangche.mockResolvedValue({ success: true, id: "changche-1" });

    const result = await saveChangcheAction(makeChangcheInput() as never, 2026);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "changche-1" });
    await Promise.resolve();
    expect(mockEdgesStale).toHaveBeenCalledWith("changche-1");
    expect(mockAssignStale).toHaveBeenCalledWith("changche-1");
  });

  it("service 실패 시 에러 응답", async () => {
    mockSaveChangche.mockResolvedValue({ success: false, error: "창체 저장 오류" });

    const result = await saveChangcheAction(makeChangcheInput() as never, 2026);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("창체 저장 오류");
  });

  it("인증 실패 시 에러 응답", async () => {
    mockGuard.mockRejectedValue(new Error("권한 없음"));

    const result = await saveChangcheAction(makeChangcheInput() as never, 2026);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("창체 저장 중 오류");
  });
});

// ============================================
// saveHaengteukAction
// ============================================

describe("saveHaengteukAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: id 반환 + stale marking 호출", async () => {
    mockSaveHaengteuk.mockResolvedValue({ success: true, id: "haengteuk-1" });

    const result = await saveHaengteukAction(makeHaengteukInput() as never, 2026);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "haengteuk-1" });
    await Promise.resolve();
    expect(mockEdgesStale).toHaveBeenCalledWith("haengteuk-1");
    expect(mockAssignStale).toHaveBeenCalledWith("haengteuk-1");
  });

  it("service 실패 시 기본 에러 메시지", async () => {
    mockSaveHaengteuk.mockResolvedValue({ success: false });

    const result = await saveHaengteukAction(makeHaengteukInput() as never, 2026);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("행특 저장 실패");
  });
});

// ============================================
// addReadingAction
// ============================================

describe("addReadingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: id 반환", async () => {
    mockAddReading.mockResolvedValue({ success: true, id: "reading-1" });

    const result = await addReadingAction({
      student_id: "student-1",
      title: "코스모스",
      author: "칼 세이건",
      school_year: 2026,
      grade: 2,
    } as never);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "reading-1" });
  });

  it("service 실패 시 에러 응답", async () => {
    mockAddReading.mockResolvedValue({ success: false, error: "독서 추가 실패" });

    const result = await addReadingAction({ student_id: "s1" } as never);

    expect(result.success).toBe(false);
  });
});

// ============================================
// removeReadingAction
// ============================================

describe("removeReadingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: success true", async () => {
    mockRemoveReading.mockResolvedValue({ success: true });

    const result = await removeReadingAction("reading-1");

    expect(result.success).toBe(true);
    expect(mockRemoveReading).toHaveBeenCalledWith("reading-1");
  });
});

// ============================================
// saveAttendanceAction
// ============================================

describe("saveAttendanceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "admin" });
  });

  it("성공: id 반환", async () => {
    mockSaveAttendance.mockResolvedValue({ success: true, id: "attend-1" });

    const result = await saveAttendanceAction({
      student_id: "student-1",
      school_year: 2026,
      grade: 2,
    } as never);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "attend-1" });
  });

  it("service 실패 시 에러 응답", async () => {
    mockSaveAttendance.mockResolvedValue({ success: false, error: "출결 저장 실패" });

    const result = await saveAttendanceAction({ student_id: "s1" } as never);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("출결 저장 실패");
  });
});
