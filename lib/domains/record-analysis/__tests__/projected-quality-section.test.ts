// ============================================
// 격차 4: buildProjectedQualitySection 회귀 테스트
// ============================================

import { describe, it, expect } from "vitest";
import {
  buildProjectedQualitySection,
  type ProjectedQualitySummary,
} from "../llm/projected-quality-section";

const BASE_SUMMARY: ProjectedQualitySummary = {
  byGrade: [
    {
      gradeYear: 2024,
      avgOverall: 55,
      avgSpecificity: 50,
      avgDepth: 48,
      avgCoherence: 60,
      recordCount: 3,
      topIssues: ["나열식 구성", "참고문헌 미제시", "결론 부재"],
    },
    {
      gradeYear: 2025,
      avgOverall: 72,
      avgSpecificity: 70,
      avgDepth: 68,
      avgCoherence: 75,
      recordCount: 2,
      topIssues: ["구체적 수치 부족"],
    },
  ],
  grandAvgOverall: 63,
  totalRecords: 5,
};

describe("buildProjectedQualitySection", () => {
  it("정상 입력이면 헤더와 ai_projected 안내 포함", () => {
    const section = buildProjectedQualitySection(BASE_SUMMARY);
    expect(section).toBeDefined();
    expect(section).toContain("설계 모드 AI 가안 품질");
    expect(section).toContain("ai_projected");
    expect(section).toContain("⚠");
  });

  it("전체 평균 overall 과 총 레코드 수가 표시된다", () => {
    const section = buildProjectedQualitySection(BASE_SUMMARY)!;
    expect(section).toContain("63점");
    expect(section).toContain("5건");
  });

  it("학년별 섹션이 각각 렌더된다", () => {
    const section = buildProjectedQualitySection(BASE_SUMMARY)!;
    expect(section).toContain("2024년도");
    expect(section).toContain("2025년도");
  });

  it("overall < 60 학년에는 경고 힌트(⚠)가 포함된다", () => {
    const section = buildProjectedQualitySection(BASE_SUMMARY)!;
    // 2024년도 avgOverall=55 → 경고 포함 기대
    expect(section).toMatch(/⚠.*55점|55점.*⚠/);
  });

  it("60 <= overall < 75 학년에는 중간 수준 힌트가 포함된다", () => {
    const section = buildProjectedQualitySection(BASE_SUMMARY)!;
    // 2025년도 avgOverall=72 → 중간 수준
    expect(section).toContain("중간 수준");
  });

  it("빈출 이슈가 텍스트에 포함된다", () => {
    const section = buildProjectedQualitySection(BASE_SUMMARY)!;
    expect(section).toContain("나열식 구성");
    expect(section).toContain("참고문헌 미제시");
  });

  it("마지막 지침 문장에 '탐구 깊이 부족' 안내가 포함된다", () => {
    const section = buildProjectedQualitySection(BASE_SUMMARY)!;
    expect(section).toContain("탐구 깊이 부족");
    expect(section).toContain("보강");
  });

  it("null 입력 시 undefined 반환 (no-op)", () => {
    expect(buildProjectedQualitySection(null)).toBeUndefined();
  });

  it("undefined 입력 시 undefined 반환 (no-op)", () => {
    expect(buildProjectedQualitySection(undefined)).toBeUndefined();
  });

  it("byGrade 빈 배열이면 undefined 반환", () => {
    const empty: ProjectedQualitySummary = {
      byGrade: [],
      grandAvgOverall: 0,
      totalRecords: 0,
    };
    expect(buildProjectedQualitySection(empty)).toBeUndefined();
  });

  it("gradeYear -1 (school_year 없는 레코드)은 '학년 미상'으로 표시된다", () => {
    const summary: ProjectedQualitySummary = {
      byGrade: [
        {
          gradeYear: -1,
          avgOverall: 65,
          avgSpecificity: 60,
          avgDepth: 62,
          avgCoherence: 68,
          recordCount: 2,
          topIssues: ["키워드만 나열"],
        },
      ],
      grandAvgOverall: 65,
      totalRecords: 2,
    };
    const section = buildProjectedQualitySection(summary)!;
    expect(section).toContain("학년 미상");
  });

  it("topIssues 빈 배열이면 빈출 이슈 줄이 생략된다", () => {
    const summary: ProjectedQualitySummary = {
      byGrade: [
        {
          gradeYear: 2025,
          avgOverall: 80,
          avgSpecificity: 78,
          avgDepth: 80,
          avgCoherence: 82,
          recordCount: 1,
          topIssues: [],
        },
      ],
      grandAvgOverall: 80,
      totalRecords: 1,
    };
    const section = buildProjectedQualitySection(summary)!;
    expect(section).not.toContain("빈출 이슈");
  });

  it("overall >= 75 학년에는 경고/중간 힌트가 없다", () => {
    const summary: ProjectedQualitySummary = {
      byGrade: [
        {
          gradeYear: 2025,
          avgOverall: 85,
          avgSpecificity: 82,
          avgDepth: 84,
          avgCoherence: 86,
          recordCount: 2,
          topIssues: [],
        },
      ],
      grandAvgOverall: 85,
      totalRecords: 2,
    };
    const section = buildProjectedQualitySection(summary)!;
    expect(section).not.toContain("이 학년 가안의 전반 품질이 낮습니다");
    expect(section).not.toContain("중간 수준");
  });
});
