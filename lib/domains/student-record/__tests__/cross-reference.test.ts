import { describe, it, expect } from "vitest";
import {
  detectCompetencyShared,
  detectStorylineEdges,
  detectCourseSupports,
  detectReadingEdges,
  detectThemeConvergence,
  detectTeacherValidation,
  detectAllCrossReferences,
  buildConnectionGraph,
  type CrossRefInput,
} from "../cross-reference";
import type { ActivityTag, StorylineLink, ReadingLink, CourseAdequacyResult } from "../types";

// ============================================
// 테스트 헬퍼
// ============================================

function makeTag(overrides: Partial<ActivityTag> & { record_id: string; record_type: string; competency_item: string }): ActivityTag {
  return {
    id: `tag-${Math.random().toString(36).slice(2, 8)}`,
    student_id: "student-1",
    tenant_id: "tenant-1",
    evaluation: "positive",
    evidence_summary: null,
    source: "ai",
    status: "suggested",
    created_at: new Date().toISOString(),
    ...overrides,
  } as ActivityTag;
}

function makeStorylineLink(overrides: Partial<StorylineLink> & { record_id: string; record_type: string; grade: number }): StorylineLink {
  return {
    id: `link-${Math.random().toString(36).slice(2, 8)}`,
    storyline_id: "storyline-1",
    connection_note: null,
    sort_order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  } as StorylineLink;
}

const emptyLabelMap = new Map<string, string>();

// ============================================
// 1. detectCompetencyShared
// ============================================

describe("detectCompetencyShared", () => {
  it("같은 역량을 다른 record_type이 공유하면 엣지 생성", () => {
    const tags = [
      makeTag({ record_id: "setek-1", record_type: "setek", competency_item: "academic_inquiry" }),
      makeTag({ record_id: "changche-1", record_type: "changche", competency_item: "academic_inquiry" }),
    ];
    const edges = detectCompetencyShared(new Set(["setek-1"]), "setek", tags, emptyLabelMap);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("COMPETENCY_SHARED");
    expect(edges[0].targetRecordType).toBe("changche");
    expect(edges[0].sharedCompetencies).toContain("academic_inquiry");
  });

  it("같은 record_type 내부 공유는 무시", () => {
    const tags = [
      makeTag({ record_id: "setek-1", record_type: "setek", competency_item: "academic_inquiry" }),
      makeTag({ record_id: "setek-2", record_type: "setek", competency_item: "academic_inquiry" }),
    ];
    const edges = detectCompetencyShared(new Set(["setek-1"]), "setek", tags, emptyLabelMap);
    expect(edges).toHaveLength(0);
  });

  it("현재 영역에 역량이 없으면 빈 배열", () => {
    const tags = [
      makeTag({ record_id: "changche-1", record_type: "changche", competency_item: "community_collaboration" }),
    ];
    const edges = detectCompetencyShared(new Set(["setek-1"]), "setek", tags, emptyLabelMap);
    expect(edges).toHaveLength(0);
  });

  it("여러 역량 공유 시 sharedCompetencies에 모두 포함", () => {
    const tags = [
      makeTag({ record_id: "setek-1", record_type: "setek", competency_item: "academic_inquiry" }),
      makeTag({ record_id: "setek-1", record_type: "setek", competency_item: "career_exploration" }),
      makeTag({ record_id: "changche-1", record_type: "changche", competency_item: "academic_inquiry" }),
      makeTag({ record_id: "changche-1", record_type: "changche", competency_item: "career_exploration" }),
    ];
    const edges = detectCompetencyShared(new Set(["setek-1"]), "setek", tags, emptyLabelMap);
    expect(edges).toHaveLength(1);
    expect(edges[0].sharedCompetencies).toHaveLength(2);
  });
});

// ============================================
// 2. detectStorylineEdges
// ============================================

describe("detectStorylineEdges", () => {
  it("같은 스토리라인 같은 학년 → CONTENT_REFERENCE", () => {
    const links = [
      makeStorylineLink({ record_id: "setek-1", record_type: "setek", grade: 2 }),
      makeStorylineLink({ record_id: "changche-1", record_type: "changche", grade: 2 }),
    ];
    const labelMap = new Map([["changche-1", "2학년 동아리활동"]]);
    const edges = detectStorylineEdges(new Set(["setek-1"]), 2, links, labelMap);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("CONTENT_REFERENCE");
  });

  it("같은 스토리라인 다른 학년 → TEMPORAL_GROWTH", () => {
    const links = [
      makeStorylineLink({ record_id: "setek-1", record_type: "setek", grade: 1 }),
      makeStorylineLink({ record_id: "setek-2", record_type: "setek", grade: 2 }),
    ];
    const edges = detectStorylineEdges(new Set(["setek-1"]), 1, links, emptyLabelMap);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("TEMPORAL_GROWTH");
    expect(edges[0].reason).toContain("1→2");
  });

  it("스토리라인에 속하지 않으면 빈 배열", () => {
    const links = [
      makeStorylineLink({ record_id: "other-1", record_type: "setek", grade: 2 }),
    ];
    const edges = detectStorylineEdges(new Set(["setek-1"]), 2, links, emptyLabelMap);
    expect(edges).toHaveLength(0);
  });
});

// ============================================
// 3. detectCourseSupports
// ============================================

describe("detectCourseSupports", () => {
  const adequacy: CourseAdequacyResult = {
    score: 60,
    majorCategory: "수리·통계",
    totalRecommended: 7,
    totalAvailable: 7,
    taken: ["미적분", "확률과통계"],
    notTaken: ["경제", "정보", "기하"],
    notOffered: [],
    generalRate: 50,
    careerRate: 0,
  };

  it("이수한 추천 과목이면 COURSE_SUPPORTS 엣지", () => {
    const edges = detectCourseSupports("미적분", adequacy);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("COURSE_SUPPORTS");
    expect(edges[0].targetLabel).toBe("수리·통계");
  });

  it("미이수 과목이면 빈 배열", () => {
    const edges = detectCourseSupports("경제", adequacy);
    expect(edges).toHaveLength(0);
  });

  it("subjectName 없으면 빈 배열", () => {
    expect(detectCourseSupports(undefined, adequacy)).toHaveLength(0);
  });

  it("courseAdequacy null이면 빈 배열", () => {
    expect(detectCourseSupports("미적분", null)).toHaveLength(0);
  });
});

// ============================================
// 4. detectReadingEdges
// ============================================

describe("detectReadingEdges", () => {
  it("현재 레코드를 참조하는 독서 링크 → READING_ENRICHES", () => {
    const links: ReadingLink[] = [{
      id: "rl-1",
      reading_id: "reading-1",
      record_id: "setek-1",
      record_type: "setek",
      connection_note: "관련 독서",
      created_at: new Date().toISOString(),
    }];
    const readingMap = new Map([["reading-1", "코스모스"]]);
    const edges = detectReadingEdges(new Set(["setek-1"]), links, readingMap);
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("READING_ENRICHES");
    expect(edges[0].targetLabel).toBe("코스모스");
  });

  it("관련 없는 레코드면 빈 배열", () => {
    const links: ReadingLink[] = [{
      id: "rl-1",
      reading_id: "reading-1",
      record_id: "other-1",
      record_type: "setek",
      connection_note: null,
      created_at: new Date().toISOString(),
    }];
    const edges = detectReadingEdges(new Set(["setek-1"]), links, new Map());
    expect(edges).toHaveLength(0);
  });
});

// ============================================
// 5. detectThemeConvergence (G3-5)
// ============================================

describe("detectThemeConvergence", () => {
  it("3개 이상 키워드 공유 시 THEME_CONVERGENCE 엣지", () => {
    // 키워드가 공백으로 분리되어 추출되도록 명확한 텍스트 사용
    const contentMap = new Map([
      ["setek-1", "미적분 극한값 수렴조건 의료영상 CT촬영 알고리즘 행렬연산 영상처리"],
      ["changche-1", "의료영상 CT촬영 알고리즘 미적분 극한값 행렬연산 프로젝트"],
    ]);
    const labelMap = new Map([
      ["setek-1", "2학년 수학 세특"],
      ["changche-1", "2학년 동아리활동"],
    ]);
    const tags = [
      makeTag({ record_id: "setek-1", record_type: "setek", competency_item: "academic_inquiry" }),
      makeTag({ record_id: "changche-1", record_type: "changche", competency_item: "academic_inquiry" }),
    ];
    const edges = detectThemeConvergence(new Set(["setek-1"]), "setek", contentMap, labelMap, tags);
    expect(edges.length).toBeGreaterThanOrEqual(1);
    expect(edges[0].type).toBe("THEME_CONVERGENCE");
  });

  it("공유 키워드 2개 이하면 빈 배열", () => {
    const contentMap = new Map([
      ["setek-1", "수학 문제를 풀었다"],
      ["changche-1", "영어 토론을 했다"],
    ]);
    const labelMap = new Map([
      ["setek-1", "2학년 수학 세특"],
      ["changche-1", "2학년 동아리활동"],
    ]);
    const edges = detectThemeConvergence(new Set(["setek-1"]), "setek", contentMap, labelMap, []);
    expect(edges).toHaveLength(0);
  });

  it("텍스트 없으면 빈 배열", () => {
    const edges = detectThemeConvergence(new Set(["setek-1"]), "setek", new Map(), new Map(), []);
    expect(edges).toHaveLength(0);
  });
});

// ============================================
// 6. detectTeacherValidation (G3-5)
// ============================================

describe("detectTeacherValidation", () => {
  it("행특에서 세특 키워드가 등장하면 TEACHER_VALIDATION", () => {
    const contentMap = new Map([
      ["setek-1", "미적분에서 극한값 수렴조건을 탐구하며 수학적모델링을 수행하고 의료영상 알고리즘에 적용함"],
      ["haengteuk-1", "미적분 극한값 탐구에서 수학적모델링 능력이 우수하며 의료영상 알고리즘 관련 프로젝트를 주도적으로 수행함"],
    ]);
    const labelMap = new Map([
      ["setek-1", "2학년 수학 세특"],
      ["haengteuk-1", "2학년 행동특성"],
    ]);
    const edges = detectTeacherValidation(new Set(["setek-1"]), "setek", contentMap, labelMap);
    expect(edges.length).toBeGreaterThanOrEqual(1);
    expect(edges[0].type).toBe("TEACHER_VALIDATION");
    expect(edges[0].targetRecordType).toBe("haengteuk");
  });

  it("행특 없으면 빈 배열", () => {
    const contentMap = new Map([["setek-1", "수학 탐구"]]);
    const labelMap = new Map([["setek-1", "2학년 수학 세특"]]);
    const edges = detectTeacherValidation(new Set(["setek-1"]), "setek", contentMap, labelMap);
    expect(edges).toHaveLength(0);
  });
});

// ============================================
// 7. detectAllCrossReferences (통합)
// ============================================

describe("detectAllCrossReferences", () => {
  it("모든 데이터 비어있으면 빈 배열", () => {
    const input: CrossRefInput = {
      currentRecordIds: new Set(["setek-1"]),
      currentRecordType: "setek",
      currentGrade: 2,
      allTags: [],
      storylineLinks: [],
      readingLinks: [],
      courseAdequacy: null,
      recordLabelMap: new Map(),
      readingLabelMap: new Map(),
    };
    expect(detectAllCrossReferences(input)).toHaveLength(0);
  });

  it("recordContentMap 없으면 G3-5 감지 skip", () => {
    const input: CrossRefInput = {
      currentRecordIds: new Set(["setek-1"]),
      currentRecordType: "setek",
      currentGrade: 2,
      allTags: [
        makeTag({ record_id: "setek-1", record_type: "setek", competency_item: "academic_inquiry" }),
        makeTag({ record_id: "changche-1", record_type: "changche", competency_item: "academic_inquiry" }),
      ],
      storylineLinks: [],
      readingLinks: [],
      courseAdequacy: null,
      recordLabelMap: new Map(),
      readingLabelMap: new Map(),
      // recordContentMap 없음 → THEME_CONVERGENCE/TEACHER_VALIDATION skip
    };
    const edges = detectAllCrossReferences(input);
    expect(edges.every((e) => e.type !== "THEME_CONVERGENCE" && e.type !== "TEACHER_VALIDATION")).toBe(true);
  });
});

// ============================================
// 8. buildConnectionGraph
// ============================================

describe("buildConnectionGraph", () => {
  it("엣지 없으면 빈 그래프", () => {
    const graph = buildConnectionGraph({
      allTags: [],
      storylineLinks: [],
      readingLinks: [],
      courseAdequacy: null,
      recordLabelMap: new Map(),
      readingLabelMap: new Map(),
    });
    expect(graph.nodes).toHaveLength(0);
    expect(graph.totalEdges).toBe(0);
  });

  it("역량 공유하는 2개 레코드 → 2개 노드 각각 엣지", () => {
    const tags = [
      makeTag({ record_id: "setek-1", record_type: "setek", competency_item: "academic_inquiry" }),
      makeTag({ record_id: "changche-1", record_type: "changche", competency_item: "academic_inquiry" }),
    ];
    const labelMap = new Map([
      ["setek-1", "2학년 수학 세특"],
      ["changche-1", "2학년 동아리활동"],
    ]);
    const graph = buildConnectionGraph({
      allTags: tags,
      storylineLinks: [],
      readingLinks: [],
      courseAdequacy: null,
      recordLabelMap: labelMap,
      readingLabelMap: new Map(),
    });
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(graph.totalEdges).toBeGreaterThanOrEqual(2);
  });
});
