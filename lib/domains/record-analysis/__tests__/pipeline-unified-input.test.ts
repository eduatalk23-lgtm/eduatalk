// ============================================
// pipeline-unified-input.ts — 순수 함수 유닛 테스트
//
// 대상 (DB 호출 없는 순수 함수):
//   - buildVirtualRecordsFromGuides()
//   - buildVirtualTagsFromGuides()
//   - checkCoverageForTask()
//   - collectAnalysisRecords()
//   - collectDesignRecords()
//   - collectAllTags()
//
// 스킵: buildUnifiedGradeInput() — DB 호출 있음
// ============================================

import { describe, it, expect } from "vitest";
import type {
  DirectionGuideSummary,
  UnifiedGradeInput,
  AnalysisGradeOutput,
  DesignGradeOutput,
  UnifiedActivityTag,
} from "../pipeline/pipeline-unified-input";
import {
  buildVirtualRecordsFromGuides,
  buildVirtualTagsFromGuides,
  checkCoverageForTask,
  collectAnalysisRecords,
  collectDesignRecords,
  collectAllTags,
} from "../pipeline/pipeline-unified-input";

// ─── 픽스처 팩토리 ──────────────────────────────────────────────────────────

function makeGuide(overrides: Partial<DirectionGuideSummary> = {}): DirectionGuideSummary {
  return {
    id: "guide-1",
    type: "setek",
    grade: 1,
    schoolYear: 2025,
    subjectName: "수학I",
    direction: "확률과 통계 심화 탐구를 통해 수리적 모델링 역량을 함양한다.",
    keywords: ["확률분포", "통계적추론"],
    competencyFocus: ["mathematical_thinking", "academic_inquiry"],
    teacherPoints: ["수업 중 질문 적극적", "모둠 토론 주도"],
    ...overrides,
  };
}

function makeAnalysisGrade(grade: number, overrides: Partial<AnalysisGradeOutput> = {}): AnalysisGradeOutput {
  return {
    mode: "analysis",
    grade,
    competencyScores: [],
    activityTags: [],
    contentQuality: [],
    directionGuides: [],
    records: [],
    ...overrides,
  };
}

function makeDesignGrade(grade: number, overrides: Partial<DesignGradeOutput> = {}): DesignGradeOutput {
  return {
    mode: "design",
    grade,
    competencyScores: [],
    activityTags: [],
    contentQuality: [],
    directionGuides: [],
    records: [],
    coursePlans: [],
    ...overrides,
  };
}

function makeUnifiedInput(overrides: Partial<UnifiedGradeInput> = {}): UnifiedGradeInput {
  return {
    grades: {},
    analysisGrades: [],
    designGrades: [],
    hasAnyAnalysis: false,
    hasAnyDesign: false,
    isHybrid: false,
    ...overrides,
  };
}

// ============================================
// buildVirtualRecordsFromGuides
// ============================================

describe("buildVirtualRecordsFromGuides()", () => {
  it("direction이 있는 가이드를 RecordSummary로 변환한다", () => {
    const guides = [makeGuide()];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      index: 0,
      id: "guide-1",
      grade: 1,
      subject: "수학I",
      type: "setek",
    });
    // content에 direction이 포함
    expect(records[0].content).toContain("확률과 통계 심화 탐구를 통해 수리적 모델링 역량을 함양한다.");
  });

  it("content에 키워드와 교사 관찰 포인트가 포함된다", () => {
    const guides = [makeGuide()];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records[0].content).toContain("핵심 키워드: 확률분포, 통계적추론");
    expect(records[0].content).toContain("교사 관찰 포인트: 수업 중 질문 적극적; 모둠 토론 주도");
  });

  it("direction이 빈 문자열이면 결과에서 제외한다", () => {
    const guides = [makeGuide({ direction: "" })];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records).toHaveLength(0);
  });

  it("빈 배열 입력 시 빈 배열 반환", () => {
    expect(buildVirtualRecordsFromGuides([])).toEqual([]);
  });

  it("subject 이름이 없으면 activityType을 fallback으로 사용한다", () => {
    const guides = [makeGuide({ subjectName: undefined, activityType: "자율활동", type: "changche" })];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records[0].subject).toBe("자율활동");
  });

  it("subjectName도 activityType도 없으면 type 문자열을 사용한다", () => {
    const guides = [makeGuide({ subjectName: undefined, activityType: undefined, type: "haengteuk" })];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records[0].subject).toBe("행동특성");
  });

  it("haengteuk이면 subject fallback이 '행동특성'이다", () => {
    const guides = [makeGuide({ subjectName: undefined, activityType: undefined, type: "haengteuk" })];
    const records = buildVirtualRecordsFromGuides(guides);
    expect(records[0].subject).toBe("행동특성");
  });

  it("setek/changche에서 subjectName/activityType 없으면 type 문자열 그대로 사용", () => {
    const setekGuide = makeGuide({ subjectName: undefined, activityType: undefined, type: "setek" });
    const changcheGuide = makeGuide({ subjectName: undefined, activityType: undefined, type: "changche" });
    expect(buildVirtualRecordsFromGuides([setekGuide])[0].subject).toBe("setek");
    expect(buildVirtualRecordsFromGuides([changcheGuide])[0].subject).toBe("changche");
  });

  it("여러 가이드는 index가 순서대로 부여된다", () => {
    const guides = [
      makeGuide({ id: "g1", direction: "방향 A" }),
      makeGuide({ id: "g2", direction: "방향 B" }),
      makeGuide({ id: "g3", direction: "방향 C" }),
    ];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records[0].index).toBe(0);
    expect(records[1].index).toBe(1);
    expect(records[2].index).toBe(2);
  });

  it("키워드가 없으면 content에 '핵심 키워드' 섹션이 없다", () => {
    const guides = [makeGuide({ keywords: [], teacherPoints: [] })];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records[0].content).not.toContain("핵심 키워드");
    expect(records[0].content).not.toContain("교사 관찰 포인트");
    expect(records[0].content).toBe(guides[0].direction);
  });

  it("교사 관찰 포인트만 없으면 해당 섹션만 생략된다", () => {
    const guides = [makeGuide({ teacherPoints: [] })];
    const records = buildVirtualRecordsFromGuides(guides);

    expect(records[0].content).toContain("핵심 키워드");
    expect(records[0].content).not.toContain("교사 관찰 포인트");
  });
});

// ============================================
// buildVirtualTagsFromGuides
// ============================================

describe("buildVirtualTagsFromGuides()", () => {
  it("competencyFocus 각 항목마다 UnifiedActivityTag를 생성한다", () => {
    const guides = [makeGuide({ competencyFocus: ["mathematical_thinking", "academic_inquiry"] })];
    const tags = buildVirtualTagsFromGuides(guides);

    expect(tags).toHaveLength(2);
    expect(tags[0].competencyItem).toBe("mathematical_thinking");
    expect(tags[1].competencyItem).toBe("academic_inquiry");
  });

  it("모든 태그의 evaluation은 'expected'이다", () => {
    const guides = [makeGuide({ competencyFocus: ["leadership", "communication"] })];
    const tags = buildVirtualTagsFromGuides(guides);

    for (const tag of tags) {
      expect(tag.evaluation).toBe("expected");
    }
  });

  it("모든 태그의 isVirtual은 true이다", () => {
    const guides = [makeGuide({ competencyFocus: ["academic_inquiry"] })];
    const tags = buildVirtualTagsFromGuides(guides);

    expect(tags[0].isVirtual).toBe(true);
  });

  it("recordId와 recordType이 가이드에서 올바르게 매핑된다", () => {
    const guides = [makeGuide({ id: "guide-99", type: "changche", competencyFocus: ["leadership"] })];
    const tags = buildVirtualTagsFromGuides(guides);

    expect(tags[0].recordId).toBe("guide-99");
    expect(tags[0].recordType).toBe("changche");
  });

  it("competencyFocus가 빈 배열이면 태그가 생성되지 않는다", () => {
    const guides = [makeGuide({ competencyFocus: [] })];
    expect(buildVirtualTagsFromGuides(guides)).toHaveLength(0);
  });

  it("빈 배열 입력 시 빈 배열 반환", () => {
    expect(buildVirtualTagsFromGuides([])).toEqual([]);
  });

  it("여러 가이드의 태그가 flat하게 합쳐진다", () => {
    const guides = [
      makeGuide({ id: "g1", competencyFocus: ["A", "B"] }),
      makeGuide({ id: "g2", competencyFocus: ["C"] }),
    ];
    const tags = buildVirtualTagsFromGuides(guides);

    expect(tags).toHaveLength(3);
    expect(tags.map((t) => t.competencyItem)).toEqual(["A", "B", "C"]);
  });

  it("태그 구조: 필수 필드가 모두 있다", () => {
    const guide = makeGuide({ competencyFocus: ["academic_inquiry"] });
    const tags = buildVirtualTagsFromGuides([guide]);
    const tag = tags[0];

    const requiredFields: (keyof UnifiedActivityTag)[] = ["recordId", "recordType", "competencyItem", "evaluation"];
    for (const field of requiredFields) {
      expect(tag).toHaveProperty(field);
    }
  });
});

// ============================================
// checkCoverageForTask
// ============================================

describe("checkCoverageForTask()", () => {
  it("분석 학년만 있으면 경고 없음", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1, 2, 3],
      designGrades: [],
      hasAnyAnalysis: true,
      hasAnyDesign: false,
      isHybrid: false,
    });

    const warnings = checkCoverageForTask(input, "ai_diagnosis");
    expect(warnings).toHaveLength(0);
  });

  it("모든 학년이 설계 모드이면 no_analysis 경고를 반환한다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [],
      designGrades: [1, 2, 3],
      hasAnyAnalysis: false,
      hasAnyDesign: true,
      isHybrid: false,
    });

    const warnings = checkCoverageForTask(input, "ai_strategy");

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("no_analysis");
    expect(warnings[0].severity).toBe("warning");
    expect(warnings[0].taskKey).toBe("ai_strategy");
    expect(warnings[0].affectedGrades).toEqual([1, 2, 3]);
  });

  it("no_analysis 경고 메시지에 NEIS 분석 관련 안내가 포함된다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [],
      designGrades: [1],
      hasAnyAnalysis: false,
      hasAnyDesign: true,
      isHybrid: false,
    });

    const warnings = checkCoverageForTask(input, "storyline");
    expect(warnings[0].message).toContain("NEIS 분석 결과 없이");
  });

  it("하이브리드(분석+설계 혼합)이면 partial_analysis 경고를 반환한다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1, 2],
      designGrades: [3],
      hasAnyAnalysis: true,
      hasAnyDesign: true,
      isHybrid: true,
    });

    const warnings = checkCoverageForTask(input, "ai_diagnosis");

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("partial_analysis");
    expect(warnings[0].severity).toBe("info");
    expect(warnings[0].affectedGrades).toEqual([3]);
  });

  it("partial_analysis 경고 메시지에 설계 학년이 명시된다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1],
      designGrades: [2, 3],
      hasAnyAnalysis: true,
      hasAnyDesign: true,
      isHybrid: true,
    });

    const warnings = checkCoverageForTask(input, "ai_strategy");
    expect(warnings[0].message).toContain("2학년");
    expect(warnings[0].message).toContain("3학년");
  });

  it("taskKey가 반환된 경고에 그대로 포함된다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [],
      designGrades: [1],
      hasAnyAnalysis: false,
      hasAnyDesign: true,
      isHybrid: false,
    });

    const taskKey = "roadmap_generation";
    const warnings = checkCoverageForTask(input, taskKey);
    expect(warnings[0].taskKey).toBe(taskKey);
  });
});

// ============================================
// collectAnalysisRecords
// ============================================

describe("collectAnalysisRecords()", () => {
  it("분석 학년의 레코드를 RecordSummary 형태로 수집한다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1],
      grades: {
        1: makeAnalysisGrade(1, {
          records: [
            {
              id: "rec-1",
              recordType: "setek",
              grade: 1,
              subjectName: "수학I",
              content: "확률분포와 통계적 추정을 활용하여 실생활 데이터를 분석하는 탐구 활동을 수행하였습니다.",
              hasNeis: true,
            },
          ],
        }),
      },
    });

    const records = collectAnalysisRecords(input);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "rec-1",
      grade: 1,
      subject: "수학I",
      type: "setek",
    });
    expect(records[0].index).toBe(0);
  });

  it("content가 20자 미만인 레코드는 제외한다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1],
      grades: {
        1: makeAnalysisGrade(1, {
          records: [
            { id: "rec-short", recordType: "setek", grade: 1, content: "짧은 내용", hasNeis: false },
            {
              id: "rec-long",
              recordType: "setek",
              grade: 1,
              content: "충분히 긴 내용입니다. 탐구 활동을 수행하였습니다.",
              hasNeis: false,
            },
          ],
        }),
      },
    });

    const records = collectAnalysisRecords(input);

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("rec-long");
  });

  it("subjectName이 없으면 activityType을 사용한다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1],
      grades: {
        1: makeAnalysisGrade(1, {
          records: [
            {
              id: "rec-1",
              recordType: "changche",
              grade: 1,
              activityType: "자율활동",
              content: "학급 회장으로서 리더십을 발휘하여 다양한 학교 행사를 기획하고 진행하였습니다.",
              hasNeis: false,
            },
          ],
        }),
      },
    });

    const records = collectAnalysisRecords(input);
    expect(records[0].subject).toBe("자율활동");
  });

  it("subjectName도 activityType도 없으면 recordType 문자열을 사용한다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1],
      grades: {
        1: makeAnalysisGrade(1, {
          records: [
            {
              id: "rec-1",
              recordType: "haengteuk",
              grade: 1,
              content: "학교생활 전반에 걸쳐 성실하고 책임감 있는 모습을 꾸준히 보여주었습니다.",
              hasNeis: true,
            },
          ],
        }),
      },
    });

    const records = collectAnalysisRecords(input);
    expect(records[0].subject).toBe("haengteuk");
  });

  it("여러 학년의 레코드가 분석 학년 순서대로 합쳐진다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [1, 2],
      grades: {
        1: makeAnalysisGrade(1, {
          records: [
            { id: "r1", recordType: "setek", grade: 1, content: "1학년 수학 세특 내용이 충분히 길어야 합니다.", hasNeis: true },
          ],
        }),
        2: makeAnalysisGrade(2, {
          records: [
            { id: "r2", recordType: "setek", grade: 2, content: "2학년 물리 세특 내용이 충분히 길어야 합니다.", hasNeis: true },
          ],
        }),
      },
    });

    const records = collectAnalysisRecords(input);

    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("r1");
    expect(records[1].id).toBe("r2");
    expect(records[0].index).toBe(0);
    expect(records[1].index).toBe(1);
  });

  it("분석 학년이 없으면 빈 배열 반환", () => {
    const input = makeUnifiedInput({ analysisGrades: [] });
    expect(collectAnalysisRecords(input)).toEqual([]);
  });

  it("설계 학년의 레코드는 포함되지 않는다", () => {
    const input = makeUnifiedInput({
      analysisGrades: [],
      designGrades: [1],
      grades: {
        1: makeDesignGrade(1, {
          records: [
            {
              id: "design-rec",
              recordType: "setek",
              grade: 1,
              content: "설계 학년 가안 내용입니다. 탐구 방향을 제시합니다.",
              hasNeis: false,
            },
          ],
        }),
      },
    });

    expect(collectAnalysisRecords(input)).toHaveLength(0);
  });
});

// ============================================
// collectDesignRecords
// ============================================

describe("collectDesignRecords()", () => {
  it("설계 학년의 방향 가이드를 RecordSummary 형태로 수집한다", () => {
    const guide = makeGuide({ id: "g1", type: "setek", grade: 3, direction: "물리 세특 방향 가이드 내용 여기에 작성합니다." });

    const input = makeUnifiedInput({
      designGrades: [3],
      grades: {
        3: makeDesignGrade(3, { directionGuides: [guide] }),
      },
    });

    const records = collectDesignRecords(input);

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("g1");
    expect(records[0].grade).toBe(3);
  });

  it("direction이 빈 가이드는 제외한다", () => {
    const emptyGuide = makeGuide({ direction: "" });
    const validGuide = makeGuide({ id: "g2", direction: "유효한 방향 가이드 내용이 여기에 있습니다." });

    const input = makeUnifiedInput({
      designGrades: [2],
      grades: {
        2: makeDesignGrade(2, { directionGuides: [emptyGuide, validGuide] }),
      },
    });

    const records = collectDesignRecords(input);

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("g2");
  });

  it("설계 학년이 없으면 빈 배열 반환", () => {
    const input = makeUnifiedInput({ designGrades: [] });
    expect(collectDesignRecords(input)).toEqual([]);
  });

  it("분석 학년의 가이드는 포함되지 않는다", () => {
    const guide = makeGuide({ direction: "분석 학년 가이드 내용입니다." });

    const input = makeUnifiedInput({
      analysisGrades: [1],
      designGrades: [],
      grades: {
        1: makeAnalysisGrade(1, { directionGuides: [guide] }),
      },
    });

    expect(collectDesignRecords(input)).toHaveLength(0);
  });
});

// ============================================
// collectAllTags
// ============================================

describe("collectAllTags()", () => {
  it("분석 학년의 실 태그를 수집한다", () => {
    const realTag: UnifiedActivityTag = {
      recordId: "rec-1",
      recordType: "setek",
      competencyItem: "academic_inquiry",
      evaluation: "positive",
      evidenceSummary: "심화 탐구 근거",
      isVirtual: false,
    };

    const input = makeUnifiedInput({
      analysisGrades: [1],
      grades: {
        1: makeAnalysisGrade(1, { activityTags: [realTag] }),
      },
    });

    const tags = collectAllTags(input);

    expect(tags).toHaveLength(1);
    expect(tags[0]).toEqual(realTag);
  });

  it("설계 학년에서는 가이드의 competencyFocus로 가상 태그를 생성한다", () => {
    const guide = makeGuide({ id: "g1", type: "changche", competencyFocus: ["leadership", "communication"] });

    const input = makeUnifiedInput({
      designGrades: [3],
      grades: {
        3: makeDesignGrade(3, { directionGuides: [guide] }),
      },
    });

    const tags = collectAllTags(input);

    expect(tags).toHaveLength(2);
    expect(tags.every((t) => t.isVirtual === true)).toBe(true);
    expect(tags.map((t) => t.competencyItem)).toEqual(["leadership", "communication"]);
  });

  it("분석+설계 학년 혼합 시 실 태그와 가상 태그가 모두 포함된다", () => {
    const realTag: UnifiedActivityTag = {
      recordId: "rec-1",
      recordType: "setek",
      competencyItem: "mathematical_thinking",
      evaluation: "positive",
    };
    const guide = makeGuide({ id: "g1", competencyFocus: ["leadership"] });

    const input = makeUnifiedInput({
      analysisGrades: [1],
      designGrades: [3],
      grades: {
        1: makeAnalysisGrade(1, { activityTags: [realTag] }),
        3: makeDesignGrade(3, { directionGuides: [guide] }),
      },
    });

    const tags = collectAllTags(input);

    expect(tags).toHaveLength(2);
    // 분석 학년 태그가 먼저 나온다
    expect(tags[0].competencyItem).toBe("mathematical_thinking");
    expect(tags[0].isVirtual).toBeFalsy();
    expect(tags[1].competencyItem).toBe("leadership");
    expect(tags[1].isVirtual).toBe(true);
  });

  it("분석/설계 학년 모두 없으면 빈 배열 반환", () => {
    expect(collectAllTags(makeUnifiedInput())).toEqual([]);
  });

  it("설계 학년 가이드에 competencyFocus가 없으면 가상 태그가 생성되지 않는다", () => {
    const guide = makeGuide({ competencyFocus: [] });

    const input = makeUnifiedInput({
      designGrades: [2],
      grades: {
        2: makeDesignGrade(2, { directionGuides: [guide] }),
      },
    });

    expect(collectAllTags(input)).toHaveLength(0);
  });
});
