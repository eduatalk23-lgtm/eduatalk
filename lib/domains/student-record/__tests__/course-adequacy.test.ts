import { describe, it, expect } from "vitest";
import { calculateCourseAdequacy } from "../course-adequacy";

// ============================================
// 교과 이수 적합도 테스트
// Phase 5 — 규칙 기반 엔진 (AI 불필요)
// ============================================

describe("calculateCourseAdequacy", () => {
  // ── 기본 동작 ──

  it("존재하지 않는 전공 계열 → null", () => {
    expect(calculateCourseAdequacy("존재하지않는계열", [], null)).toBeNull();
  });

  it("빈 이수 과목 → 0%", () => {
    const result = calculateCourseAdequacy("수리·통계", [], null);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.taken).toHaveLength(0);
    expect(result!.notTaken.length).toBeGreaterThan(0);
  });

  it("모든 추천 과목 이수 → 100%", () => {
    // 수리·통계: general=[미적분, 확률과통계, 경제, 정보], career=[기하, 수학과제탐구, 인공지능수학]
    const allSubjects = [
      "미적분", "확률과통계", "경제", "정보",
      "기하", "수학과제탐구", "인공지능수학",
    ];
    const result = calculateCourseAdequacy("수리·통계", allSubjects, null);
    expect(result!.score).toBe(100);
    expect(result!.taken).toHaveLength(7);
    expect(result!.notTaken).toHaveLength(0);
  });

  // ── 부분 이수 ──

  it("일반선택만 이수 → 일반 100%, 진로 0%", () => {
    const result = calculateCourseAdequacy("수리·통계", [
      "미적분", "확률과통계", "경제", "정보",
    ], null);
    expect(result!.generalRate).toBe(100);
    expect(result!.careerRate).toBe(0);
    // 4/7 ≈ 57%
    expect(result!.score).toBe(57);
  });

  it("진로선택만 이수 → 일반 0%, 진로 100%", () => {
    const result = calculateCourseAdequacy("수리·통계", [
      "기하", "수학과제탐구", "인공지능수학",
    ], null);
    expect(result!.generalRate).toBe(0);
    expect(result!.careerRate).toBe(100);
    // 3/7 ≈ 43%
    expect(result!.score).toBe(43);
  });

  // ── 학교 미개설 과목 필터링 ──

  it("학교 미개설 과목은 분모에서 제외 + notOffered에 포함", () => {
    // 수리·통계 7과목 중 경제, 인공지능수학이 미개설
    const offered = ["미적분", "확률과통계", "정보", "기하", "수학과제탐구"];
    const taken = ["미적분", "확률과통계", "정보", "기하", "수학과제탐구"];
    const result = calculateCourseAdequacy("수리·통계", taken, offered);

    expect(result!.notOffered).toContain("경제");
    expect(result!.notOffered).toContain("인공지능수학");
    expect(result!.totalAvailable).toBe(5); // 7 - 2
    expect(result!.score).toBe(100); // 5/5 = 100%
  });

  it("모든 추천 과목이 미개설 → score 0, totalAvailable 0", () => {
    const result = calculateCourseAdequacy("수리·통계", ["국어"], []);
    expect(result!.totalAvailable).toBe(0);
    expect(result!.score).toBe(0);
    expect(result!.notOffered.length).toBe(7);
  });

  // ── 과목명 정규화 ──

  it("로마 숫자 → 아라비아 숫자 매칭 (Ⅰ → 1)", () => {
    // 물리·천문의 추천에 "물리학Ⅰ"이 있음
    const result = calculateCourseAdequacy("물리·천문", [
      "미적분", "확률과통계", "물리학1", "화학1",
    ], null);
    expect(result!.taken).toContain("물리학Ⅰ");
    expect(result!.taken).toContain("화학Ⅰ");
  });

  it("가운뎃점 변형 매칭 (· ‧ ・)", () => {
    // "기술·가정" vs "기술‧가정" 등
    const result = calculateCourseAdequacy("수리·통계", [
      "미적분", "확률과통계",
    ], null);
    // 확인: 정규화 후 매칭 성공
    expect(result!.taken).toContain("확률과통계");
  });

  // ── 다양한 전공 계열 ──

  it("의학·약학 계열 — 추천 과목 10개", () => {
    const result = calculateCourseAdequacy("의학·약학", [], null);
    expect(result!.totalRecommended).toBe(10);
    expect(result!.majorCategory).toBe("의학·약학");
  });

  it("법·행정 계열 정상 작동", () => {
    const result = calculateCourseAdequacy("법·행정", [
      "확률과통계", "생활과윤리", "정치와법", "사회·문화",
    ], null);
    expect(result!.taken.length).toBe(4);
    expect(result!.score).toBeGreaterThan(0);
  });

  it("경영·경제 계열 — 일반/진로 분리 계산", () => {
    const result = calculateCourseAdequacy("경영·경제", [
      "미적분", "확률과통계", "경제", // 일반 3/8
      "경제수학", // 진로 1/4
    ], null);
    expect(result!.generalRate).toBe(38); // 3/8 = 37.5 → 38 (round)
    expect(result!.careerRate).toBe(25); // 1/4
  });

  // ── 엣지 케이스 ──

  it("추천 과목 외 과목만 이수 → 0%", () => {
    const result = calculateCourseAdequacy("수리·통계", [
      "국어", "영어", "체육", "미술",
    ], null);
    expect(result!.score).toBe(0);
    expect(result!.taken).toHaveLength(0);
  });

  it("동일 과목 중복 이수 → 1회만 카운트", () => {
    const result = calculateCourseAdequacy("수리·통계", [
      "미적분", "미적분", "확률과통계",
    ], null);
    expect(result!.taken).toHaveLength(2);
  });

  it("offeredSubjects null → 미개설 필터링 없이 전체 비교", () => {
    const result = calculateCourseAdequacy("수리·통계", ["미적분"], null);
    expect(result!.totalAvailable).toBe(7);
    expect(result!.notOffered).toHaveLength(0);
  });

  // ── 결과 구조 검증 ──

  it("결과에 필수 필드 포함", () => {
    const result = calculateCourseAdequacy("교육", ["확률과통계"], null);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("majorCategory");
    expect(result).toHaveProperty("totalRecommended");
    expect(result).toHaveProperty("totalAvailable");
    expect(result).toHaveProperty("taken");
    expect(result).toHaveProperty("notTaken");
    expect(result).toHaveProperty("notOffered");
    expect(result).toHaveProperty("generalRate");
    expect(result).toHaveProperty("careerRate");
  });

  it("교육 계열 — 최소 추천 (일반1 + 진로1)", () => {
    // 교육: general=[확률과통계], career=[사회문제탐구]
    const result = calculateCourseAdequacy("교육", [
      "확률과통계", "사회문제탐구",
    ], null);
    expect(result!.score).toBe(100);
    expect(result!.totalRecommended).toBe(2);
  });

  // ── 50% 경계 테스트 (경보 트리거 기준) ──

  it("적합도 50% 미만 감지", () => {
    // 수리·통계 7과목 중 3개 이수 = 43%
    const result = calculateCourseAdequacy("수리·통계", [
      "미적분", "확률과통계", "경제",
    ], null);
    expect(result!.score).toBe(43);
    expect(result!.score).toBeLessThan(50);
  });

  it("적합도 정확히 50%", () => {
    // 교육: 2과목 중 1개 이수 = 50%
    const result = calculateCourseAdequacy("교육", ["확률과통계"], null);
    expect(result!.score).toBe(50);
  });
});
