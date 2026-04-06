// ============================================
// service.ts 유닛 테스트
//
// 핵심 시나리오:
//   - saveSetek: NEIS 바이트 초과/정상/공통과목 합산/충돌감지
//   - saveChangche / saveHaengteuk: 정상저장 + 충돌감지
//   - getRecordTabData: repository 6개 함수 병렬 호출
//   - 에러 케이스: repository throw 시 { success: false }
//
// 전략: repository를 vi.mock으로 교체, validation은 실제 사용
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
}));

vi.mock("../repository", () => ({
  upsertSetek: vi.fn(),
  findSubjectPair: vi.fn(),
  findSeteksByStudentYear: vi.fn(),
  insertPersonalSetek: vi.fn(),
  deleteSetekById: vi.fn(),
  deletePersonalSetekById: vi.fn(),
  upsertChangche: vi.fn(),
  updateChangcheById: vi.fn(),
  upsertHaengteuk: vi.fn(),
  updateHaengteukById: vi.fn(),
  findPersonalSeteksByStudentYear: vi.fn(),
  findChangcheByStudentYear: vi.fn(),
  findHaengteukByStudentYear: vi.fn(),
  findReadingsByStudentYear: vi.fn(),
  findAttendanceByStudentYear: vi.fn(),
  insertReading: vi.fn(),
  deleteReadingById: vi.fn(),
  upsertAttendance: vi.fn(),
  findStorylinesByStudent: vi.fn(),
  findAllRoadmapItemsByStudent: vi.fn(),
  insertStoryline: vi.fn(),
  updateStorylineById: vi.fn(),
  deleteStorylineById: vi.fn(),
  insertStorylineLink: vi.fn(),
  deleteStorylineLinkById: vi.fn(),
  insertRoadmapItem: vi.fn(),
  updateRoadmapItemById: vi.fn(),
  deleteRoadmapItemById: vi.fn(),
  findApplicationsByStudentYear: vi.fn(),
  findAwardsByStudentYear: vi.fn(),
  findVolunteerByStudentYear: vi.fn(),
  findDisciplinaryByStudentYear: vi.fn(),
  insertApplication: vi.fn(),
  updateApplicationById: vi.fn(),
  deleteApplicationById: vi.fn(),
  insertAward: vi.fn(),
  deleteAwardById: vi.fn(),
  insertVolunteer: vi.fn(),
  deleteVolunteerById: vi.fn(),
  insertDisciplinary: vi.fn(),
  deleteDisciplinaryById: vi.fn(),
  findMinScoreTargetsByStudent: vi.fn(),
  insertMinScoreTarget: vi.fn(),
  updateMinScoreTargetById: vi.fn(),
  deleteMinScoreTargetById: vi.fn(),
  findMinScoreSimulationsByStudent: vi.fn(),
  insertMinScoreSimulation: vi.fn(),
  deleteMinScoreSimulationById: vi.fn(),
}));

import * as repository from "../repository";
const mockRepository = repository as Record<string, ReturnType<typeof vi.fn>>;

// ---- SUT ----

import {
  saveSetek,
  savePersonalSetek,
  removeSetek,
  saveChangche,
  saveHaengteuk,
  getRecordTabData,
  getStorylineTabData,
  addReading,
  removeReading,
  saveAttendance,
  saveStoryline,
  updateStoryline,
  removeStoryline,
  addStorylineLink,
  removeStorylineLink,
  saveRoadmapItem,
  updateRoadmapItem,
  removeRoadmapItem,
  addApplication,
  getSupplementaryTabData,
  addAward,
  addVolunteer,
  addDisciplinary,
} from "../service";

// ---- Helpers ----

const BASE_SETEK = {
  student_id: "s1",
  tenant_id: "t1",
  school_year: 2025,
  subject_id: "sub1",
  content: "수업 시간에 적극적으로 참여함.",
  grade: 2,
  char_limit: 500,
};

const BASE_CHANGCHE = {
  student_id: "s1",
  tenant_id: "t1",
  school_year: 2025,
  activity_type: "autonomy" as const,
  content: "자율 활동에 참여하여 리더십을 발휘함.",
  grade: 2,
};

const BASE_HAENGTEUK = {
  student_id: "s1",
  tenant_id: "t1",
  school_year: 2025,
  content: "성실하고 책임감이 강하며 학급 일에 적극적으로 참여하는 학생임.",
  grade: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// 1. saveSetek
// ============================================

describe("saveSetek", () => {
  it("정상 저장 — success + id 반환", async () => {
    mockRepository.upsertSetek.mockResolvedValue("rec-1");
    const result = await saveSetek(BASE_SETEK);
    expect(result).toEqual({ success: true, data: { id: "rec-1" } });
    expect(mockRepository.upsertSetek).toHaveBeenCalledOnce();
  });

  it("NEIS 바이트 초과 → 에러", async () => {
    const oversized = { ...BASE_SETEK, content: "가".repeat(501), char_limit: 500 };
    const result = await saveSetek(oversized);
    expect(result.success).toBe(false);
    expect(result.error).toContain("NEIS 바이트 초과");
    expect(mockRepository.upsertSetek).not.toHaveBeenCalled();
  });

  it("NEIS 바이트 경계값 정확히 500자 한글 → 성공", async () => {
    mockRepository.upsertSetek.mockResolvedValue("rec-2");
    const exact = { ...BASE_SETEK, content: "가".repeat(500), char_limit: 500 };
    const result = await saveSetek(exact);
    expect(result.success).toBe(true);
  });

  it("영문 다수 → 500자 넘어도 NEIS 통과", async () => {
    mockRepository.upsertSetek.mockResolvedValue("rec-3");
    // 600 ASCII chars = 600B, well under 1500B
    const result = await saveSetek({ ...BASE_SETEK, content: "A".repeat(600) });
    expect(result.success).toBe(true);
  });

  it("공통과목 쌍 합산 바이트 초과 → 에러", async () => {
    mockRepository.findSubjectPair.mockResolvedValue({
      subject_id_1: "sub1",
      subject_id_2: "sub2",
      shared_char_limit: 500,
    });
    mockRepository.findSeteksByStudentYear.mockResolvedValue([
      { subject_id: "sub2", content: "가".repeat(400) },
    ]);

    // sub1: 400자 한글(1200B) + sub2: 400자 한글(1200B) = 2400B > 1500B limit
    const input = { ...BASE_SETEK, content: "가".repeat(400) };
    const result = await saveSetek(input, { curriculumRevisionId: "rev1" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("공통과목 쌍 합산 바이트 초과");
  });

  it("공통과목 쌍이지만 합산 이내 → 성공", async () => {
    mockRepository.findSubjectPair.mockResolvedValue({
      subject_id_1: "sub1",
      subject_id_2: "sub2",
      shared_char_limit: 500,
    });
    mockRepository.findSeteksByStudentYear.mockResolvedValue([
      { subject_id: "sub2", content: "A".repeat(50) },
    ]);
    mockRepository.upsertSetek.mockResolvedValue("rec-4");

    // sub1: 50B + sub2: 50B = 100B < 1500B
    const input = { ...BASE_SETEK, content: "A".repeat(50) };
    const result = await saveSetek(input, { curriculumRevisionId: "rev1" });
    expect(result.success).toBe(true);
  });

  it("repository 에러 → success: false", async () => {
    mockRepository.upsertSetek.mockRejectedValue(new Error("DB error"));
    const result = await saveSetek(BASE_SETEK);
    expect(result.success).toBe(false);
    expect(result.error).toContain("오류");
  });
});

// ============================================
// 2. savePersonalSetek
// ============================================

describe("savePersonalSetek", () => {
  it("정상 저장", async () => {
    mockRepository.insertPersonalSetek.mockResolvedValue("ps-1");
    const result = await savePersonalSetek({
      ...BASE_SETEK,
      content: "개인 세특 내용입니다.",
    });
    expect(result).toEqual({ success: true, data: { id: "ps-1" } });
  });

  it("바이트 초과 → 에러", async () => {
    const result = await savePersonalSetek({
      ...BASE_SETEK,
      content: "가".repeat(501),
      char_limit: 500,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// 3. saveChangche
// ============================================

describe("saveChangche", () => {
  it("정상 저장 (upsert)", async () => {
    mockRepository.upsertChangche.mockResolvedValue("ch-1");
    const result = await saveChangche(BASE_CHANGCHE, 2025);
    expect(result).toEqual({ success: true, data: { id: "ch-1" } });
  });

  it("충돌 감지 (expectedUpdatedAt) → CONFLICT 에러 전파", async () => {
    mockRepository.updateChangcheById.mockRejectedValue(
      new Error("CONFLICT: 다른 사용자가 수정함"),
    );
    const result = await saveChangche(
      { ...BASE_CHANGCHE, id: "ch-exist" },
      2025,
      { expectedUpdatedAt: "2025-01-01T00:00:00Z" },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("CONFLICT");
  });

  it("바이트 초과 → 에러", async () => {
    const result = await saveChangche(
      { ...BASE_CHANGCHE, content: "가".repeat(501) },
      2025,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("NEIS 바이트 초과");
  });
});

// ============================================
// 4. saveHaengteuk
// ============================================

describe("saveHaengteuk", () => {
  it("정상 저장 (upsert)", async () => {
    mockRepository.upsertHaengteuk.mockResolvedValue("ht-1");
    const result = await saveHaengteuk(BASE_HAENGTEUK, 2025);
    expect(result).toEqual({ success: true, data: { id: "ht-1" } });
  });

  it("충돌 감지 → CONFLICT", async () => {
    mockRepository.updateHaengteukById.mockRejectedValue(
      new Error("CONFLICT: 버전 불일치"),
    );
    const result = await saveHaengteuk(
      { ...BASE_HAENGTEUK, id: "ht-exist" },
      2025,
      { expectedUpdatedAt: "2025-01-01T00:00:00Z" },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("CONFLICT");
  });
});

// ============================================
// 5. getRecordTabData — 6개 repository 병렬 호출
// ============================================

describe("getRecordTabData", () => {
  it("6개 함수 병렬 호출 + 결과 조합", async () => {
    const seteks = [{ id: "s1" }];
    const personalSeteks = [{ id: "ps1" }];
    const changche = [{ id: "c1" }];
    const haengteuk = { id: "h1" };
    const readings = [{ id: "r1" }];
    const attendance = { id: "a1" };

    mockRepository.findSeteksByStudentYear.mockResolvedValue(seteks);
    mockRepository.findPersonalSeteksByStudentYear.mockResolvedValue(personalSeteks);
    mockRepository.findChangcheByStudentYear.mockResolvedValue(changche);
    mockRepository.findHaengteukByStudentYear.mockResolvedValue(haengteuk);
    mockRepository.findReadingsByStudentYear.mockResolvedValue(readings);
    mockRepository.findAttendanceByStudentYear.mockResolvedValue(attendance);

    const result = await getRecordTabData("s1", 2025, "t1");
    expect(result.seteks).toBe(seteks);
    expect(result.personalSeteks).toBe(personalSeteks);
    expect(result.changche).toBe(changche);
    expect(result.haengteuk).toBe(haengteuk);
    expect(result.readings).toBe(readings);
    expect(result.schoolAttendance).toBe(attendance);
  });

  it("repository 에러 → 빈 기본값 반환", async () => {
    mockRepository.findSeteksByStudentYear.mockRejectedValue(new Error("fail"));
    const result = await getRecordTabData("s1", 2025, "t1");
    expect(result.seteks).toEqual([]);
    expect(result.haengteuk).toBeNull();
  });
});

// ============================================
// 6. getStorylineTabData
// ============================================

describe("getStorylineTabData", () => {
  it("정상 조회", async () => {
    mockRepository.findStorylinesByStudent.mockResolvedValue([{ id: "sl-1" }]);
    mockRepository.findAllRoadmapItemsByStudent.mockResolvedValue([{ id: "rm-1" }]);
    const result = await getStorylineTabData("s1", 2025, "t1");
    expect(result.storylines).toHaveLength(1);
    expect(result.roadmapItems).toHaveLength(1);
  });
});

// ============================================
// 7. 독서/출결 CRUD
// ============================================

describe("addReading / removeReading / saveAttendance", () => {
  it("addReading — 성공", async () => {
    mockRepository.insertReading.mockResolvedValue("rd-1");
    const r = await addReading({ student_id: "s1", tenant_id: "t1", school_year: 2025, book_title: "책" });
    expect(r).toEqual({ success: true, data: { id: "rd-1" } });
  });

  it("removeReading — 성공", async () => {
    mockRepository.deleteReadingById.mockResolvedValue(undefined);
    const r = await removeReading("rd-1");
    expect(r.success).toBe(true);
  });

  it("saveAttendance — 성공", async () => {
    mockRepository.upsertAttendance.mockResolvedValue("att-1");
    const r = await saveAttendance({ student_id: "s1", tenant_id: "t1", school_year: 2025 });
    expect(r).toEqual({ success: true, data: { id: "att-1" } });
  });
});

// ============================================
// 8. 스토리라인 CRUD
// ============================================

describe("storyline CRUD", () => {
  it("saveStoryline — 빈 제목 → 에러", async () => {
    const r = await saveStoryline({ student_id: "s1", tenant_id: "t1", title: "" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("제목");
  });

  it("saveStoryline — 정상", async () => {
    mockRepository.insertStoryline.mockResolvedValue("sl-1");
    const r = await saveStoryline({ student_id: "s1", tenant_id: "t1", title: "스토리" });
    expect(r.success).toBe(true);
  });

  it("updateStoryline — 성공", async () => {
    mockRepository.updateStorylineById.mockResolvedValue(undefined);
    const r = await updateStoryline("sl-1", { title: "수정" });
    expect(r).toEqual({ success: true, data: { id: "sl-1" } });
  });

  it("removeStoryline — 성공", async () => {
    mockRepository.deleteStorylineById.mockResolvedValue(undefined);
    const r = await removeStoryline("sl-1");
    expect(r.success).toBe(true);
  });
});

// ============================================
// 9. 스토리라인 링크 CRUD
// ============================================

describe("storyline link CRUD", () => {
  it("addStorylineLink", async () => {
    mockRepository.insertStorylineLink.mockResolvedValue("link-1");
    const r = await addStorylineLink({ storyline_id: "sl-1", record_id: "r-1", record_type: "setek", tenant_id: "t1" });
    expect(r).toEqual({ success: true, data: { id: "link-1" } });
  });

  it("removeStorylineLink", async () => {
    mockRepository.deleteStorylineLinkById.mockResolvedValue(undefined);
    const r = await removeStorylineLink("link-1");
    expect(r.success).toBe(true);
  });
});

// ============================================
// 10. 로드맵 CRUD
// ============================================

describe("roadmap CRUD", () => {
  it("saveRoadmapItem — 빈 계획 → 에러", async () => {
    const r = await saveRoadmapItem({ student_id: "s1", tenant_id: "t1", plan_content: "" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("계획 내용");
  });

  it("saveRoadmapItem — 정상", async () => {
    mockRepository.insertRoadmapItem.mockResolvedValue("rm-1");
    const r = await saveRoadmapItem({ student_id: "s1", tenant_id: "t1", plan_content: "수학 심화" });
    expect(r.success).toBe(true);
  });

  it("updateRoadmapItem", async () => {
    mockRepository.updateRoadmapItemById.mockResolvedValue(undefined);
    const r = await updateRoadmapItem("rm-1", { plan_content: "변경" });
    expect(r).toEqual({ success: true, data: { id: "rm-1" } });
  });

  it("removeRoadmapItem", async () => {
    mockRepository.deleteRoadmapItemById.mockResolvedValue(undefined);
    const r = await removeRoadmapItem("rm-1");
    expect(r.success).toBe(true);
  });
});

// ============================================
// 11. 지원현황 (수시 6장 제한)
// ============================================

describe("addApplication — 수시 6장 제한", () => {
  it("수시 6장 미만 → 성공", async () => {
    mockRepository.findApplicationsByStudentYear.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ round: `early_${i + 1}` })),
    );
    mockRepository.insertApplication.mockResolvedValue("app-1");
    const r = await addApplication({
      student_id: "s1", tenant_id: "t1", school_year: 2025, round: "early_6",
      university_name: "대학", department: "학과",
    });
    expect(r.success).toBe(true);
  });

  it("수시 6장 이상 → 에러", async () => {
    mockRepository.findApplicationsByStudentYear.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({ round: `early_${i + 1}` })),
    );
    const r = await addApplication({
      student_id: "s1", tenant_id: "t1", school_year: 2025, round: "early_7",
      university_name: "대학", department: "학과",
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("6장");
  });

  it("정시 → 6장 제한 무관", async () => {
    mockRepository.insertApplication.mockResolvedValue("app-2");
    const r = await addApplication({
      student_id: "s1", tenant_id: "t1", school_year: 2025, round: "regular_1",
      university_name: "대학", department: "학과",
    });
    expect(r.success).toBe(true);
    expect(mockRepository.findApplicationsByStudentYear).not.toHaveBeenCalled();
  });
});

// ============================================
// 12. getSupplementaryTabData
// ============================================

describe("getSupplementaryTabData", () => {
  it("정상 조회 + interviewConflicts 계산", async () => {
    mockRepository.findApplicationsByStudentYear.mockResolvedValue([]);
    mockRepository.findAwardsByStudentYear.mockResolvedValue([]);
    mockRepository.findVolunteerByStudentYear.mockResolvedValue([]);
    mockRepository.findDisciplinaryByStudentYear.mockResolvedValue([]);
    const result = await getSupplementaryTabData("s1", 2025, "t1");
    expect(result.applications).toEqual([]);
    expect(result.interviewConflicts).toEqual([]);
  });
});

// ============================================
// 13. 수상/봉사/징계 입력 검증
// ============================================

describe("validation guards", () => {
  it("addAward — 빈 수상명 → 에러", async () => {
    const r = await addAward({ student_id: "s1", tenant_id: "t1", school_year: 2025, award_name: "" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("수상명");
  });

  it("addVolunteer — 0시간 → 에러", async () => {
    const r = await addVolunteer({ student_id: "s1", tenant_id: "t1", school_year: 2025, hours: 0 });
    expect(r.success).toBe(false);
    expect(r.error).toContain("봉사 시간");
  });

  it("addDisciplinary — 빈 조치 유형 → 에러", async () => {
    const r = await addDisciplinary({ student_id: "s1", tenant_id: "t1", school_year: 2025, action_type: "" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("조치 유형");
  });
});

// ============================================
// 14. removeSetek
// ============================================

describe("removeSetek", () => {
  it("성공", async () => {
    mockRepository.deleteSetekById.mockResolvedValue(undefined);
    const r = await removeSetek("rec-1");
    expect(r.success).toBe(true);
  });

  it("에러 → success: false", async () => {
    mockRepository.deleteSetekById.mockRejectedValue(new Error("not found"));
    const r = await removeSetek("rec-1");
    expect(r.success).toBe(false);
  });
});
