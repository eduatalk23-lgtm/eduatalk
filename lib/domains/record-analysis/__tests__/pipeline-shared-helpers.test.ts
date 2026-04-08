// ============================================
// pipeline-task-runners-shared.ts 순수 로직 함수 유닛 테스트
//
// 대상 함수:
//   1. collectAnalysisContext()   — Phase 1-3 결과 → ctx.analysisContext 축적
//   2. toGuideAnalysisContext()   — GradeAnalysisContext → GuideAnalysisContext 변환
//   3. buildGuideAnalysisContextFromReport() — ReportData → GuideAnalysisContext 변환
//   4. runWithConcurrency()       — 동시성 제한 병렬 실행
//
// 전략: 순수 함수는 mock 없이 입출력 검증.
//       runWithConcurrency는 실제 async 함수를 인자로 전달하여 동작 확인.
// ============================================

import { describe, it, expect, vi } from "vitest";
import {
  collectAnalysisContext,
  toGuideAnalysisContext,
  buildGuideAnalysisContextFromReport,
  runWithConcurrency,
} from "../pipeline/pipeline-task-runners-shared";
import type { PipelineContext, GradeAnalysisContext } from "../pipeline/pipeline-types";
import type { HighlightAnalysisResult } from "@/lib/domains/student-record/llm/types";
import type { ReportData } from "../actions/report";

// ============================================
// 테스트 픽스처 팩토리
// ============================================

/** 최소한의 PipelineContext mock (순수 함수 테스트용 — supabase 불필요) */
function makeCtx(): PipelineContext {
  return {
    pipelineId: "pipe-1",
    studentId: "student-1",
    tenantId: "tenant-1",
    supabase: {} as PipelineContext["supabase"],
    studentGrade: 3,
    snapshot: null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "grade",
    targetGrade: 1,
  };
}

/** 단순 HighlightAnalysisResult — issues 없음, 모든 역량 A */
function makeEmptyResult(): HighlightAnalysisResult {
  return {
    sections: [],
    competencyGrades: [
      { item: "academic_achievement", grade: "A", reasoning: "우수" },
    ],
    summary: "양호",
    contentQuality: {
      specificity: 4,
      coherence: 4,
      depth: 4,
      grammar: 4,
      scientificValidity: 4,
      overallScore: 80,
      issues: [],
      feedback: "좋습니다",
    },
  };
}

/** issues가 있는 HighlightAnalysisResult */
function makeResultWithIssues(issues: string[] = ["P1_나열식"]): HighlightAnalysisResult {
  return {
    sections: [],
    competencyGrades: [
      { item: "academic_achievement", grade: "A", reasoning: "우수" },
      { item: "critical_thinking", grade: "B-", reasoning: "논리 비약 있음" },
    ],
    summary: "개선 필요",
    contentQuality: {
      specificity: 2,
      coherence: 2,
      depth: 2,
      grammar: 3,
      scientificValidity: 2,
      overallScore: 45,
      issues,
      feedback: "사례가 부족합니다",
    },
  };
}

/** B- / C 등급 포함 HighlightAnalysisResult */
function makeResultWithWeakCompetency(): HighlightAnalysisResult {
  return {
    sections: [],
    competencyGrades: [
      { item: "academic_achievement", grade: "A", reasoning: "우수" },
      {
        item: "critical_thinking",
        grade: "B-",
        reasoning: "논리 비약",
        rubricScores: [
          { questionIndex: 0, grade: "B-", reasoning: "세부 이유" },
          { questionIndex: 1, grade: "A", reasoning: "충족" },
        ],
      },
      { item: "self_directed_learning", grade: "C", reasoning: "자기주도 미흡" },
    ],
    summary: "약점 다수",
    contentQuality: undefined,
  };
}

// ============================================
// 1. collectAnalysisContext()
// ============================================

describe("collectAnalysisContext()", () => {
  it("빈 allResults를 넘기면 ctx.analysisContext가 초기화되고 내용은 빈 배열", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1", subjectName: "수학" }];
    const allResults = new Map<string, HighlightAnalysisResult>();

    collectAnalysisContext(ctx, 1, "setek", records, allResults);

    expect(ctx.analysisContext).toBeDefined();
    expect(ctx.analysisContext![1]).toBeDefined();
    expect(ctx.analysisContext![1].qualityIssues).toHaveLength(0);
    expect(ctx.analysisContext![1].weakCompetencies).toHaveLength(0);
  });

  it("issues 없는 결과는 qualityIssues에 추가되지 않는다", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1", subjectName: "수학" }];
    const allResults = new Map([["r1", makeEmptyResult()]]);

    collectAnalysisContext(ctx, 1, "setek", records, allResults);

    expect(ctx.analysisContext![1].qualityIssues).toHaveLength(0);
  });

  it("issues가 있는 레코드는 qualityIssues에 RecordAnalysisContext로 추가된다", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1", subjectName: "수학" }];
    const allResults = new Map([["r1", makeResultWithIssues(["P1_나열식", "F10_성장부재"])]]);

    collectAnalysisContext(ctx, 1, "setek", records, allResults);

    const issues = ctx.analysisContext![1].qualityIssues;
    expect(issues).toHaveLength(1);
    expect(issues[0].recordId).toBe("r1");
    expect(issues[0].recordType).toBe("setek");
    expect(issues[0].subjectName).toBe("수학");
    expect(issues[0].issues).toContain("P1_나열식");
    expect(issues[0].issues).toContain("F10_성장부재");
    expect(issues[0].feedback).toBe("사례가 부족합니다");
    expect(issues[0].overallScore).toBe(45);
  });

  it("B- 이하 역량은 weakCompetencies에 추가된다", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1", subjectName: "영어" }];
    const allResults = new Map([["r1", makeResultWithWeakCompetency()]]);

    collectAnalysisContext(ctx, 1, "setek", records, allResults);

    const weak = ctx.analysisContext![1].weakCompetencies;
    expect(weak.length).toBeGreaterThanOrEqual(2);
    const itemCodes = weak.map((w) => w.item);
    expect(itemCodes).toContain("critical_thinking");
    expect(itemCodes).toContain("self_directed_learning");
    // A 등급은 포함되지 않아야 한다
    expect(itemCodes).not.toContain("academic_achievement");
  });

  it("B- 역량의 rubricScores가 올바르게 매핑된다", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1" }];
    const allResults = new Map([["r1", makeResultWithWeakCompetency()]]);

    collectAnalysisContext(ctx, 1, "changche", records, allResults);

    const criticalThinking = ctx.analysisContext![1].weakCompetencies.find(
      (w) => w.item === "critical_thinking",
    );
    expect(criticalThinking).toBeDefined();
    expect(criticalThinking!.rubricScores).toBeDefined();
    expect(criticalThinking!.rubricScores![0]).toMatchObject({
      questionIndex: 0,
      grade: "B-",
      reasoning: "세부 이유",
    });
  });

  it("records에 없는 id의 결과는 무시된다 (recordType 필터링)", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1", subjectName: "국어" }];
    const allResults = new Map([
      ["r1", makeResultWithIssues()],
      ["r99", makeResultWithIssues(["P3_키워드만"])], // records에 없음
    ]);

    collectAnalysisContext(ctx, 1, "setek", records, allResults);

    expect(ctx.analysisContext![1].qualityIssues).toHaveLength(1);
    expect(ctx.analysisContext![1].qualityIssues[0].recordId).toBe("r1");
  });

  it("같은 recordId는 중복 추가되지 않는다 (idempotent)", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1", subjectName: "과학" }];
    const allResults = new Map([["r1", makeResultWithIssues()]]);

    collectAnalysisContext(ctx, 1, "setek", records, allResults);
    collectAnalysisContext(ctx, 1, "setek", records, allResults); // 두 번 호출

    expect(ctx.analysisContext![1].qualityIssues).toHaveLength(1);
  });

  it("같은 역량 item + grade 조합은 중복 추가되지 않는다", () => {
    const ctx = makeCtx();
    const records1 = [{ id: "r1" }];
    const records2 = [{ id: "r2" }];
    // r1, r2 모두 critical_thinking B- 포함
    const result1 = makeResultWithWeakCompetency();
    const result2 = makeResultWithWeakCompetency();
    const allResults1 = new Map([["r1", result1]]);
    const allResults2 = new Map([["r2", result2]]);

    collectAnalysisContext(ctx, 1, "setek", records1, allResults1);
    collectAnalysisContext(ctx, 1, "changche", records2, allResults2);

    const criticals = ctx.analysisContext![1].weakCompetencies.filter(
      (w) => w.item === "critical_thinking" && w.grade === "B-",
    );
    expect(criticals).toHaveLength(1);
  });

  it("여러 학년에 걸쳐 각 학년 맥락이 독립적으로 축적된다", () => {
    const ctx = makeCtx();
    const records1 = [{ id: "r1", subjectName: "수학" }];
    const records2 = [{ id: "r2", subjectName: "영어" }];

    collectAnalysisContext(ctx, 1, "setek", records1, new Map([["r1", makeResultWithIssues()]]));
    collectAnalysisContext(ctx, 2, "setek", records2, new Map([["r2", makeResultWithIssues(["F10_성장부재"])]]));

    expect(ctx.analysisContext![1].qualityIssues[0].recordId).toBe("r1");
    expect(ctx.analysisContext![2].qualityIssues[0].recordId).toBe("r2");
    expect(ctx.analysisContext![1].qualityIssues[0].issues).toContain("P1_나열식");
    expect(ctx.analysisContext![2].qualityIssues[0].issues).toContain("F10_성장부재");
  });

  it("contentQuality가 undefined인 결과는 qualityIssues에 추가되지 않는다", () => {
    const ctx = makeCtx();
    const records = [{ id: "r1" }];
    const result: HighlightAnalysisResult = {
      sections: [],
      competencyGrades: [],
      summary: "요약",
      contentQuality: undefined,
    };
    collectAnalysisContext(ctx, 1, "setek", records, new Map([["r1", result]]));

    expect(ctx.analysisContext![1].qualityIssues).toHaveLength(0);
  });

  it("ctx.analysisContext가 이미 있을 때 기존 학년 데이터를 덮어쓰지 않는다", () => {
    const ctx = makeCtx();
    // 먼저 2학년 데이터 세팅
    collectAnalysisContext(
      ctx,
      2,
      "setek",
      [{ id: "r2" }],
      new Map([["r2", makeResultWithIssues(["F10_성장부재"])]]),
    );
    // 이후 1학년 데이터 추가
    collectAnalysisContext(
      ctx,
      1,
      "setek",
      [{ id: "r1" }],
      new Map([["r1", makeResultWithIssues(["P1_나열식"])]]),
    );

    expect(ctx.analysisContext![2].qualityIssues[0].issues).toContain("F10_성장부재");
    expect(ctx.analysisContext![1].qualityIssues[0].issues).toContain("P1_나열식");
  });
});

// ============================================
// 2. toGuideAnalysisContext()
// ============================================

describe("toGuideAnalysisContext()", () => {
  it("undefined를 넘기면 undefined를 반환한다", () => {
    expect(toGuideAnalysisContext(undefined)).toBeUndefined();
  });

  it("qualityIssues와 weakCompetencies가 모두 빈 배열이면 undefined를 반환한다", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 1,
      qualityIssues: [],
      weakCompetencies: [],
    };
    expect(toGuideAnalysisContext(gradeCtx)).toBeUndefined();
  });

  it("issues가 빈 레코드는 qualityIssues에서 제외된다", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 1,
      qualityIssues: [
        {
          recordId: "r1",
          recordType: "setek",
          issues: [],       // 비어 있음 — 제외 대상
          feedback: "없음",
          overallScore: 80,
        },
      ],
      weakCompetencies: [
        { item: "critical_thinking", grade: "B-", reasoning: "이유" },
      ],
    };

    const result = toGuideAnalysisContext(gradeCtx);
    expect(result).toBeDefined();
    // issues가 빈 레코드는 필터됨
    expect(result!.qualityIssues).toHaveLength(0);
    // weakCompetencies는 그대로 전달
    expect(result!.weakCompetencies).toHaveLength(1);
  });

  it("issues가 있는 레코드와 weakCompetencies가 모두 있으면 GuideAnalysisContext를 반환한다", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 1,
      qualityIssues: [
        {
          recordId: "r1",
          recordType: "setek",
          issues: ["P1_나열식"],
          feedback: "사례 부족",
          overallScore: 50,
        },
        {
          recordId: "r2",
          recordType: "changche",
          issues: ["F10_성장부재"],
          feedback: "성장 미흡",
          overallScore: 40,
        },
      ],
      weakCompetencies: [
        { item: "critical_thinking", grade: "B-", reasoning: "논리 비약" },
        { item: "self_directed_learning", grade: "C", reasoning: "자기주도 미흡" },
      ],
    };

    const result = toGuideAnalysisContext(gradeCtx);
    expect(result).toBeDefined();
    expect(result!.qualityIssues).toHaveLength(2);
    expect(result!.qualityIssues[0].recordType).toBe("setek");
    expect(result!.qualityIssues[0].issues).toContain("P1_나열식");
    expect(result!.qualityIssues[0].feedback).toBe("사례 부족");
    expect(result!.weakCompetencies).toHaveLength(2);
  });

  it("qualityIssues만 있고 weakCompetencies가 빈 배열이어도 GuideAnalysisContext를 반환한다", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 2,
      qualityIssues: [
        {
          recordId: "r1",
          recordType: "haengteuk",
          issues: ["P3_키워드만"],
          feedback: "키워드 나열",
          overallScore: 30,
        },
      ],
      weakCompetencies: [],
    };

    const result = toGuideAnalysisContext(gradeCtx);
    expect(result).toBeDefined();
    expect(result!.qualityIssues).toHaveLength(1);
    expect(result!.weakCompetencies).toHaveLength(0);
  });

  it("weakCompetencies만 있고 qualityIssues의 모든 레코드가 빈 issues이면 GuideAnalysisContext를 반환한다", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 3,
      qualityIssues: [
        { recordId: "r1", recordType: "setek", issues: [], feedback: "", overallScore: 90 },
      ],
      weakCompetencies: [
        { item: "academic_achievement", grade: "C", reasoning: "학업 미흡" },
      ],
    };

    const result = toGuideAnalysisContext(gradeCtx);
    expect(result).toBeDefined();
    // 빈 issues는 필터됨
    expect(result!.qualityIssues).toHaveLength(0);
    expect(result!.weakCompetencies).toHaveLength(1);
  });

  it("반환된 GuideAnalysisContext의 qualityIssues 구조가 올바르다 (recordId는 제외)", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 1,
      qualityIssues: [
        {
          recordId: "r-excluded",   // recordId는 GuideAnalysisContext에 노출되지 않음
          recordType: "setek",
          issues: ["P1_나열식"],
          feedback: "피드백",
          overallScore: 55,
        },
      ],
      weakCompetencies: [],
    };

    const result = toGuideAnalysisContext(gradeCtx);
    expect(result).toBeDefined();
    const qi = result!.qualityIssues[0];
    // GuideAnalysisContext의 qualityIssues 항목은 recordType, issues, feedback만 가짐
    expect(qi).toHaveProperty("recordType", "setek");
    expect(qi).toHaveProperty("issues");
    expect(qi).toHaveProperty("feedback", "피드백");
    // recordId, overallScore는 GuideAnalysisContext에 포함되지 않음
    expect(qi).not.toHaveProperty("recordId");
    expect(qi).not.toHaveProperty("overallScore");
  });
});

// ============================================
// 3. buildGuideAnalysisContextFromReport()
// ============================================

/** 테스트용 최소 ReportData 팩토리 */
function makeMinimalReportData(
  contentQuality: import("../warnings/engine").ContentQualityRow[] = [],
  weakCompetencyContexts: import("../pipeline/pipeline-types").CompetencyAnalysisContext[] = [],
): ReportData {
  // ReportData는 큰 인터페이스이므로 타입 캐스팅으로 최소 픽스처 구성
  return {
    contentQuality,
    weakCompetencyContexts,
  } as unknown as ReportData;
}

describe("buildGuideAnalysisContextFromReport()", () => {
  it("contentQuality와 weakCompetencyContexts가 모두 빈 배열이면 undefined를 반환한다", () => {
    const reportData = makeMinimalReportData([], []);
    expect(buildGuideAnalysisContextFromReport(reportData)).toBeUndefined();
  });

  it("contentQuality가 undefined일 때도 안전하게 처리된다", () => {
    const reportData = { contentQuality: undefined, weakCompetencyContexts: [] } as unknown as ReportData;
    expect(buildGuideAnalysisContextFromReport(reportData)).toBeUndefined();
  });

  it("weakCompetencyContexts가 undefined일 때도 안전하게 처리된다", () => {
    const reportData = { contentQuality: [], weakCompetencyContexts: undefined } as unknown as ReportData;
    expect(buildGuideAnalysisContextFromReport(reportData)).toBeUndefined();
  });

  it("issues가 빈 contentQuality 행은 필터된다", () => {
    const reportData = makeMinimalReportData(
      [
        { record_id: "r1", record_type: "setek", overall_score: 80, issues: [], feedback: "좋음" },
      ],
      [],
    );
    expect(buildGuideAnalysisContextFromReport(reportData)).toBeUndefined();
  });

  it("issues가 있는 contentQuality 행은 qualityIssues에 매핑된다", () => {
    const reportData = makeMinimalReportData(
      [
        {
          record_id: "r1",
          record_type: "setek",
          overall_score: 45,
          issues: ["P1_나열식"],
          feedback: "사례 부족",
        },
      ],
      [],
    );

    const result = buildGuideAnalysisContextFromReport(reportData);
    expect(result).toBeDefined();
    expect(result!.qualityIssues).toHaveLength(1);
    expect(result!.qualityIssues[0].recordType).toBe("setek");
    expect(result!.qualityIssues[0].issues).toContain("P1_나열식");
    expect(result!.qualityIssues[0].feedback).toBe("사례 부족");
  });

  it("feedback이 null일 때 빈 문자열로 처리된다", () => {
    const reportData = makeMinimalReportData(
      [
        {
          record_id: "r1",
          record_type: "changche",
          overall_score: 30,
          issues: ["F10_성장부재"],
          feedback: null,
        },
      ],
      [],
    );

    const result = buildGuideAnalysisContextFromReport(reportData);
    expect(result).toBeDefined();
    expect(result!.qualityIssues[0].feedback).toBe("");
  });

  it("weakCompetencyContexts가 있으면 그대로 전달된다", () => {
    const weakItems: import("../pipeline/pipeline-types").CompetencyAnalysisContext[] = [
      { item: "critical_thinking", grade: "B-", reasoning: "논리 비약" },
      { item: "self_directed_learning", grade: "C", reasoning: null },
    ];
    const reportData = makeMinimalReportData([], weakItems);

    const result = buildGuideAnalysisContextFromReport(reportData);
    expect(result).toBeDefined();
    expect(result!.weakCompetencies).toHaveLength(2);
    expect(result!.weakCompetencies[0].item).toBe("critical_thinking");
    expect(result!.weakCompetencies[1].grade).toBe("C");
  });

  it("recordType 필터: setek만 요청하면 changche 행은 제외된다", () => {
    const reportData = makeMinimalReportData(
      [
        { record_id: "r1", record_type: "setek", overall_score: 40, issues: ["P1_나열식"], feedback: "a" },
        { record_id: "r2", record_type: "changche", overall_score: 35, issues: ["F10_성장부재"], feedback: "b" },
      ],
      [],
    );

    const result = buildGuideAnalysisContextFromReport(reportData, undefined, "setek");
    expect(result).toBeDefined();
    expect(result!.qualityIssues).toHaveLength(1);
    expect(result!.qualityIssues[0].recordType).toBe("setek");
  });

  it("recordType 필터 없이 전달하면 모든 record_type이 포함된다", () => {
    const reportData = makeMinimalReportData(
      [
        { record_id: "r1", record_type: "setek", overall_score: 40, issues: ["P1_나열식"], feedback: "a" },
        { record_id: "r2", record_type: "changche", overall_score: 35, issues: ["F10_성장부재"], feedback: "b" },
        { record_id: "r3", record_type: "haengteuk", overall_score: 30, issues: ["P3_키워드만"], feedback: "c" },
      ],
      [],
    );

    const result = buildGuideAnalysisContextFromReport(reportData);
    expect(result).toBeDefined();
    expect(result!.qualityIssues).toHaveLength(3);
  });

  it("haengteuk 필터: haengteuk 행만 반환한다", () => {
    const reportData = makeMinimalReportData(
      [
        { record_id: "r1", record_type: "setek", overall_score: 40, issues: ["P1_나열식"], feedback: "a" },
        { record_id: "r2", record_type: "haengteuk", overall_score: 30, issues: ["P3_키워드만"], feedback: "c" },
      ],
      [{ item: "academic_achievement", grade: "C", reasoning: "미흡" }],
    );

    const result = buildGuideAnalysisContextFromReport(reportData, undefined, "haengteuk");
    expect(result).toBeDefined();
    expect(result!.qualityIssues).toHaveLength(1);
    expect(result!.qualityIssues[0].recordType).toBe("haengteuk");
    // weakCompetencies는 필터 대상이 아니므로 그대로
    expect(result!.weakCompetencies).toHaveLength(1);
  });

  it("targetGrade 인자는 현재 필터링에 사용되지 않는다 (노트: 향후 확장용)", () => {
    // buildGuideAnalysisContextFromReport는 record에 grade 필드가 없으므로
    // targetGrade를 전달해도 결과가 달라지지 않아야 한다
    const reportData = makeMinimalReportData(
      [
        { record_id: "r1", record_type: "setek", overall_score: 40, issues: ["P1_나열식"], feedback: "a" },
      ],
      [],
    );

    const withGrade = buildGuideAnalysisContextFromReport(reportData, 2);
    const withoutGrade = buildGuideAnalysisContextFromReport(reportData);
    expect(withGrade).toEqual(withoutGrade);
  });
});

// ============================================
// 4. runWithConcurrency()
// ============================================

describe("runWithConcurrency()", () => {
  it("빈 배열이면 fn이 한 번도 호출되지 않는다", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await runWithConcurrency([], 3, fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("모든 아이템이 처리된다 (단일 concurrency)", async () => {
    const processed: number[] = [];
    const items = [1, 2, 3, 4, 5];
    await runWithConcurrency(items, 1, async (x) => {
      processed.push(x);
    });
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("모든 아이템이 처리된다 (concurrency > items.length)", async () => {
    const processed: number[] = [];
    const items = [10, 20, 30];
    await runWithConcurrency(items, 10, async (x) => {
      processed.push(x);
    });
    expect(processed.sort((a, b) => a - b)).toEqual([10, 20, 30]);
  });

  it("concurrency 제한이 실제로 동작한다 — 최대 N개 이상 동시에 실행되지 않는다", async () => {
    const concurrency = 2;
    let activeConcurrent = 0;
    let maxObserved = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await runWithConcurrency(items, concurrency, async () => {
      activeConcurrent++;
      maxObserved = Math.max(maxObserved, activeConcurrent);
      // 짧은 비동기 대기로 동시성 관찰
      await new Promise((r) => setTimeout(r, 10));
      activeConcurrent--;
    });

    expect(maxObserved).toBeLessThanOrEqual(concurrency);
  });

  it("에러가 발생해도 나머지 아이템은 계속 처리된다 (Promise.allSettled 내부)", async () => {
    const processed: number[] = [];
    const items = [1, 2, 3, 4];
    // item === 2 에서 에러 발생
    await runWithConcurrency(items, 2, async (x) => {
      if (x === 2) throw new Error("의도적 에러");
      processed.push(x);
    });
    // 에러 아이템을 제외한 나머지는 모두 처리되어야 한다
    expect(processed).toContain(1);
    expect(processed).toContain(3);
    expect(processed).toContain(4);
  });

  it("string 배열도 처리된다", async () => {
    const results: string[] = [];
    await runWithConcurrency(["a", "b", "c"], 2, async (s) => {
      results.push(s.toUpperCase());
    });
    expect(results.sort()).toEqual(["A", "B", "C"]);
  });

  it("concurrency=1이면 순서대로 처리된다", async () => {
    const order: number[] = [];
    const items = [1, 2, 3, 4, 5];
    await runWithConcurrency(items, 1, async (x) => {
      order.push(x);
    });
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });
});
