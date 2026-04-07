import { describe, it, expect } from "vitest";
import { detectForbiddenExpressions } from "../forbidden-expressions";

describe("detectForbiddenExpressions", () => {
  // ─── 빈 입력 ─────────────────────────────
  it("빈 텍스트는 매치 없음", () => {
    const result = detectForbiddenExpressions("");
    expect(result.matches).toHaveLength(0);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
  });

  it("정상 세특 텍스트는 매치 없음", () => {
    const text = "수학 시간에 미적분의 개념을 활용하여 물리 현상의 변화율을 분석하는 탐구 활동에 적극적으로 참여함.";
    const result = detectForbiddenExpressions(text);
    expect(result.matches).toHaveLength(0);
  });

  // ─── 수상 내역 ────────────────────────────
  describe("award_mention", () => {
    it("상 명칭 감지", () => {
      const result = detectForbiddenExpressions("교내 수학 대회에서 금상을 수상함");
      expect(result.hasErrors).toBe(true);
      expect(result.matches.some((m) => m.category === "award_mention")).toBe(true);
    });

    it("대회 수상 사실 감지", () => {
      const result = detectForbiddenExpressions("전국 경시대회에서 수상하였다");
      expect(result.hasErrors).toBe(true);
    });

    it("수상 경력 언급 경고", () => {
      const result = detectForbiddenExpressions("수상 경력이 우수함");
      expect(result.hasWarnings).toBe(true);
    });
  });

  // ─── 대학명 ──────────────────────────────
  describe("university_name", () => {
    it("대학교명 감지", () => {
      const result = detectForbiddenExpressions("서울대에 진학하기 위해 노력함");
      expect(result.hasErrors).toBe(true);
      expect(result.matches[0].category).toBe("university_name");
    });

    it("영문 약칭 감지", () => {
      const result = detectForbiddenExpressions("KAIST에 합격하고 싶다");
      expect(result.hasErrors).toBe(true);
    });

    it("일반적인 대학 언급이 아닌 경우 매치 없음", () => {
      const result = detectForbiddenExpressions("대학 진학에 관심이 높음");
      expect(result.matches.filter((m) => m.category === "university_name")).toHaveLength(0);
    });
  });

  // ─── 사교육 기관명 ────────────────────────
  describe("private_academy", () => {
    it("학원 감지", () => {
      const result = detectForbiddenExpressions("학원에서 배운 내용을 활용함");
      expect(result.hasErrors).toBe(true);
      expect(result.matches[0].category).toBe("private_academy");
    });

    it("구체적 사교육 명칭 감지", () => {
      const result = detectForbiddenExpressions("메가스터디 강의를 참고함");
      expect(result.hasErrors).toBe(true);
    });
  });

  // ─── 자격증/인증시험 ───────────────────────
  describe("certification_score", () => {
    it("어학 점수 감지", () => {
      const result = detectForbiddenExpressions("TOEIC 900점을 달성함");
      expect(result.hasErrors).toBe(true);
      expect(result.matches[0].category).toBe("certification_score");
    });

    it("한국사 등급 감지", () => {
      const result = detectForbiddenExpressions("한국사 1급을 취득함");
      expect(result.hasErrors).toBe(true);
    });

    it("자격증 등급 감지", () => {
      const result = detectForbiddenExpressions("ITQ 1급 자격을 보유함");
      expect(result.hasErrors).toBe(true);
    });
  });

  // ─── 논문 인용 ────────────────────────────
  describe("paper_citation", () => {
    it("et al. 형식 감지", () => {
      const result = detectForbiddenExpressions("Kim et al. (2024)에 따르면");
      expect(result.hasWarnings).toBe(true);
    });

    it("DOI 형식 감지", () => {
      const result = detectForbiddenExpressions("doi: 10.1234/test");
      expect(result.hasWarnings).toBe(true);
    });
  });

  // ─── 학교폭력 ─────────────────────────────
  describe("school_violence", () => {
    it("학교폭력 감지", () => {
      const result = detectForbiddenExpressions("학교 폭력 사안에 연루됨");
      expect(result.hasErrors).toBe(true);
      expect(result.matches[0].category).toBe("school_violence");
    });
  });

  // ─── 외부 기관 ────────────────────────────
  describe("external_org", () => {
    it("외부 플랫폼 감지", () => {
      const result = detectForbiddenExpressions("유튜브에서 관련 자료를 조사함");
      expect(result.hasWarnings).toBe(true);
    });
  });

  // ─── 옵션 ─────────────────────────────────
  describe("options", () => {
    it("카테고리 스킵", () => {
      const result = detectForbiddenExpressions("서울대 진학을 희망함", {
        skipCategories: ["university_name"],
      });
      expect(result.matches.filter((m) => m.category === "university_name")).toHaveLength(0);
    });

    it("복수 매치 카운트 정확", () => {
      const result = detectForbiddenExpressions("금상을 수상하고 TOEIC 950점도 보유함");
      expect(result.errorCount).toBeGreaterThanOrEqual(2);
    });
  });
});
