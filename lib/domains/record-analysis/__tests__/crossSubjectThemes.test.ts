import { describe, it, expect } from "vitest";
import {
  parseCrossSubjectThemesResponse,
  buildCrossSubjectThemesUserPrompt,
} from "../llm/prompts/crossSubjectThemes";
import type { GradeThemeExtractionInput } from "../llm/types";

// ============================================
// Cross-subject Theme Extractor 파서 테스트 (H1 / L3-A)
// ============================================

describe("parseCrossSubjectThemesResponse", () => {
  it("정상 응답 파싱 — 교차 테마 1건", () => {
    const content = "```json\n" + JSON.stringify({
      themes: [{
        id: "social-minority",
        label: "사회적 약자 이해",
        keywords: ["복지", "불평등"],
        records: [
          { recordId: "r1", recordType: "setek", subjectName: "수학", evidenceSnippet: "통계로 소득 불평등 분석" },
          { recordId: "r2", recordType: "setek", subjectName: "경제", evidenceSnippet: "분배 정책 고찰" },
        ],
        affectedSubjects: ["수학", "경제"],
        subjectCount: 2,
        evolutionSignal: "deepening",
        confidence: 0.85,
      }],
      dominantThemeIds: ["social-minority"],
    }) + "\n```";

    const result = parseCrossSubjectThemesResponse(content);
    expect(result.themes).toHaveLength(1);
    expect(result.themes[0].id).toBe("social-minority");
    expect(result.themes[0].subjectCount).toBe(2);
    expect(result.crossSubjectPatternCount).toBe(1);
    expect(result.dominantThemeIds).toEqual(["social-minority"]);
  });

  it("1개 과목 + 1 레코드만 있는 테마는 제외", () => {
    const content = JSON.stringify({
      themes: [{
        id: "loner-theme",
        label: "단일 주제",
        keywords: ["고립"],
        records: [
          { recordId: "r1", recordType: "setek", subjectName: "수학", evidenceSnippet: "단독 언급" },
        ],
        affectedSubjects: ["수학"],
        subjectCount: 1,
        confidence: 0.8,
      }],
      dominantThemeIds: [],
    });

    const result = parseCrossSubjectThemesResponse(content);
    expect(result.themes).toHaveLength(0);
    expect(result.crossSubjectPatternCount).toBe(0);
  });

  it("잘못된 slug id는 스킵", () => {
    const content = JSON.stringify({
      themes: [
        {
          id: "한글주제", // 잘못된 slug
          label: "한글 테마",
          keywords: [],
          records: [
            { recordId: "r1", recordType: "setek", evidenceSnippet: "a" },
            { recordId: "r2", recordType: "setek", evidenceSnippet: "b" },
          ],
          affectedSubjects: ["수학", "경제"],
          subjectCount: 2,
          confidence: 0.9,
        },
        {
          id: "valid-slug",
          label: "유효",
          keywords: [],
          records: [
            { recordId: "r1", recordType: "setek", evidenceSnippet: "a" },
            { recordId: "r2", recordType: "setek", evidenceSnippet: "b" },
          ],
          affectedSubjects: ["수학", "경제"],
          subjectCount: 2,
          confidence: 0.9,
        },
      ],
      dominantThemeIds: ["valid-slug"],
    });

    const result = parseCrossSubjectThemesResponse(content);
    expect(result.themes).toHaveLength(1);
    expect(result.themes[0].id).toBe("valid-slug");
  });

  it("themes 최대 6개로 제한", () => {
    const makeTheme = (i: number) => ({
      id: `theme-${i}`,
      label: `테마 ${i}`,
      keywords: [],
      records: [
        { recordId: `r${i}-1`, recordType: "setek" as const, evidenceSnippet: "a" },
        { recordId: `r${i}-2`, recordType: "setek" as const, evidenceSnippet: "b" },
      ],
      affectedSubjects: ["수학", "경제"],
      subjectCount: 2,
      confidence: 0.8,
    });
    const content = JSON.stringify({
      themes: Array.from({ length: 10 }, (_, i) => makeTheme(i)),
      dominantThemeIds: [],
    });

    const result = parseCrossSubjectThemesResponse(content);
    expect(result.themes).toHaveLength(6);
  });

  it("dominantThemeIds 누락 시 subjectCount+confidence 기준 fallback", () => {
    const content = JSON.stringify({
      themes: [
        {
          id: "low-priority",
          label: "낮음",
          keywords: [],
          records: [
            { recordId: "r1", recordType: "setek", evidenceSnippet: "a" },
            { recordId: "r2", recordType: "setek", evidenceSnippet: "b" },
          ],
          affectedSubjects: ["수학", "경제"],
          subjectCount: 2,
          confidence: 0.6,
        },
        {
          id: "high-priority",
          label: "높음",
          keywords: [],
          records: [
            { recordId: "r3", recordType: "setek", evidenceSnippet: "a" },
            { recordId: "r4", recordType: "setek", evidenceSnippet: "b" },
            { recordId: "r5", recordType: "setek", evidenceSnippet: "c" },
          ],
          affectedSubjects: ["수학", "경제", "사회"],
          subjectCount: 3,
          confidence: 0.9,
        },
      ],
      dominantThemeIds: [],
    });

    const result = parseCrossSubjectThemesResponse(content);
    expect(result.dominantThemeIds[0]).toBe("high-priority");
  });

  it("JSON 파싱 실패 시 SyntaxError", () => {
    expect(() => parseCrossSubjectThemesResponse("invalid json")).toThrow(SyntaxError);
  });

  it("themes 누락 시 빈 결과", () => {
    const result = parseCrossSubjectThemesResponse(JSON.stringify({ dominantThemeIds: [] }));
    expect(result.themes).toHaveLength(0);
    expect(result.themeCount).toBe(0);
  });
});

describe("buildCrossSubjectThemesUserPrompt", () => {
  const baseInput: GradeThemeExtractionInput = {
    grade: 2,
    targetMajor: "경제학",
    records: [
      { recordId: "r1", recordType: "setek", subjectName: "수학", content: "통계로 소득 불평등을 분석함" },
      { recordId: "r2", recordType: "setek", subjectName: "경제", content: "분배 정책을 고찰함" },
    ],
  };

  it("학년, 목표 전공, 레코드 모두 포함", () => {
    const prompt = buildCrossSubjectThemesUserPrompt(baseInput);
    expect(prompt).toContain("2학년");
    expect(prompt).toContain("경제학");
    expect(prompt).toContain("r1");
    expect(prompt).toContain("수학");
    expect(prompt).toContain("통계로 소득 불평등을 분석함");
  });

  it("profileCard 있을 때 주입", () => {
    const prompt = buildCrossSubjectThemesUserPrompt({
      ...baseInput,
      profileCard: "## 학생 프로필 카드\n- 1학년 수학 A",
    });
    expect(prompt).toContain("## 학생 프로필 카드");
    expect(prompt).toContain("1학년 수학 A");
  });

  it("profileCard 없을 때 '없음' 표시", () => {
    const prompt = buildCrossSubjectThemesUserPrompt(baseInput);
    expect(prompt).toContain("없음");
  });

  it("competencyTags/qualityIssues 메타데이터 포함", () => {
    const prompt = buildCrossSubjectThemesUserPrompt({
      ...baseInput,
      records: [
        {
          ...baseInput.records[0],
          competencyTags: ["academic_attitude", "inquiry_ability"],
          qualityIssues: ["P1_나열식"],
        },
        baseInput.records[1],
      ],
    });
    expect(prompt).toContain("academic_attitude");
    expect(prompt).toContain("P1_나열식");
  });
});
