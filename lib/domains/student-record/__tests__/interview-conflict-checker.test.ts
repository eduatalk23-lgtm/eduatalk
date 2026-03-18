import { describe, it, expect } from "vitest";
import { checkInterviewConflicts } from "../interview-conflict-checker";

// ============================================
// 면접일 겹침 체크 테스트
// ============================================

const makeApp = (
  id: string,
  university: string,
  date: string | null,
  round: string = "early_comprehensive",
) => ({
  id,
  university_name: university,
  interview_date: date,
  round,
});

describe("checkInterviewConflicts", () => {
  // ── 기본 동작 ──

  it("면접일이 같은 수시 지원 → critical", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15"),
      makeApp("2", "연세대", "2026-11-15"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("critical");
    expect(conflicts[0].university1).toBe("서울대");
    expect(conflicts[0].university2).toBe("연세대");
    expect(conflicts[0].conflictDate).toBe("2026-11-15");
  });

  it("면접일이 연일(1일 차이) → warning", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15"),
      makeApp("2", "고려대", "2026-11-16"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("warning");
    // conflictDate는 더 이른 날짜
    expect(conflicts[0].conflictDate).toBe("2026-11-15");
  });

  it("면접일이 2일 이상 차이 → 충돌 없음", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15"),
      makeApp("2", "고려대", "2026-11-17"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    expect(conflicts).toHaveLength(0);
  });

  // ── 수시 필터링 ──

  it("정시(regular) 지원은 면접 겹침 체크 대상 아님", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15", "regular_ga"),
      makeApp("2", "연세대", "2026-11-15", "regular_na"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    expect(conflicts).toHaveLength(0);
  });

  it("수시(early_*) + 정시(regular) 혼합 → 수시끼리만 비교", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15", "early_comprehensive"),
      makeApp("2", "연세대", "2026-11-15", "regular_ga"),
      makeApp("3", "고려대", "2026-11-15", "early_subject"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].applicationId1).toBe("1");
    expect(conflicts[0].applicationId2).toBe("3");
  });

  // ── 면접일 없는 경우 ──

  it("면접일이 null인 지원은 무시", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15"),
      makeApp("2", "연세대", null),
    ];
    const conflicts = checkInterviewConflicts(apps);
    expect(conflicts).toHaveLength(0);
  });

  // ── 다중 겹침 ──

  it("3개 지원이 같은 날 → 3쌍 critical", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15"),
      makeApp("2", "연세대", "2026-11-15"),
      makeApp("3", "고려대", "2026-11-15"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    // C(3,2) = 3쌍
    expect(conflicts).toHaveLength(3);
    expect(conflicts.every((c) => c.severity === "critical")).toBe(true);
  });

  it("연속 3일 (15,16,17) → 2쌍 warning", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-15"),
      makeApp("2", "연세대", "2026-11-16"),
      makeApp("3", "고려대", "2026-11-17"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    // 15-16, 16-17 = 2쌍 warning, 15-17 = 2일 차이 → 무시
    expect(conflicts).toHaveLength(2);
    expect(conflicts.every((c) => c.severity === "warning")).toBe(true);
  });

  // ── 엣지 케이스 ──

  it("빈 배열 → 빈 결과", () => {
    expect(checkInterviewConflicts([])).toEqual([]);
  });

  it("지원 1개만 → 비교 대상 없으므로 빈 결과", () => {
    const apps = [makeApp("1", "서울대", "2026-11-15")];
    expect(checkInterviewConflicts(apps)).toEqual([]);
  });

  it("모든 수시 라운드에서 동작 (early_ prefix)", () => {
    const rounds = [
      "early_comprehensive", "early_subject", "early_essay",
      "early_practical", "early_special", "early_other",
    ];
    const apps = rounds.map((r, i) =>
      makeApp(String(i), `대학${i}`, "2026-11-15", r),
    );
    const conflicts = checkInterviewConflicts(apps);
    // C(6,2) = 15 쌍 모두 critical
    expect(conflicts).toHaveLength(15);
  });

  it("warning에서 conflictDate는 더 이른 날짜", () => {
    const apps = [
      makeApp("1", "서울대", "2026-11-16"),
      makeApp("2", "연세대", "2026-11-15"),
    ];
    const conflicts = checkInterviewConflicts(apps);
    expect(conflicts[0].conflictDate).toBe("2026-11-15");
  });
});
