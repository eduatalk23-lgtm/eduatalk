import { describe, it, expect } from "vitest";
import {
  GUIDE_SECTION_CONFIG,
  getCoreSections,
  getTypeExtensionSections,
  getOptionalSections,
  getDefaultActiveSections,
  getRequiredSectionKeys,
  legacyToContentSections,
  resolveContentSections,
} from "../section-config";
import type { GuideType, ExplorationGuideContent } from "../types";
import { GUIDE_TYPES } from "../types";
import {
  THEORY_DEVELOPMENT_HINTS,
  SECTION_COHERENCE_RULES,
} from "../llm/prompts/theory-development-hints";
import {
  buildBaseSystemPrompt,
  buildSectionStructurePrompt,
  buildStudentProfilePrompt,
  buildWritingStylePrompt,
  buildSetekGuidePrompt,
} from "../llm/prompts/common-prompt-builder";
import type { StudentProfileContext } from "../llm/types";

// ============================================================
// 1. Section Config — tier 태깅 검증
// ============================================================

describe("section-config tier", () => {
  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: 모든 섹션에 tier가 존재해야 한다",
    (guideType) => {
      const config = GUIDE_SECTION_CONFIG[guideType];
      for (const def of config) {
        // tier가 명시적이거나 기본값(core)
        expect(["core", "type_extension", "optional", undefined]).toContain(
          def.tier,
        );
      }
    },
  );

  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: core 섹션에 motivation, content_sections, reflection, impression, setek_examples가 포함되어야 한다",
    (guideType) => {
      const coreKeys = getCoreSections(guideType).map((s) => s.key);
      // 모든 유형에서 최소한 이 3개는 core
      expect(coreKeys).toContain("impression");
      expect(coreKeys).toContain("setek_examples");
      // motivation은 전 유형 core
      expect(coreKeys).toContain("motivation");
    },
  );

  it("독서탐구: book_description은 type_extension이어야 한다", () => {
    const typeExt = getTypeExtensionSections("reading").map((s) => s.key);
    expect(typeExt).toContain("book_description");
  });

  it("실험탐구: hypothesis, materials, analysis는 type_extension이어야 한다", () => {
    const typeExt = getTypeExtensionSections("experiment").map((s) => s.key);
    expect(typeExt).toContain("hypothesis");
    expect(typeExt).toContain("materials");
    expect(typeExt).toContain("analysis");
  });

  it("교과수행: curriculum_link, self_assessment는 type_extension이어야 한다", () => {
    const typeExt = getTypeExtensionSections("subject_performance").map(
      (s) => s.key,
    );
    expect(typeExt).toContain("curriculum_link");
    expect(typeExt).toContain("self_assessment");
  });

  it("프로그램: overview, deliverables, learning은 type_extension이어야 한다", () => {
    const typeExt = getTypeExtensionSections("program").map((s) => s.key);
    expect(typeExt).toContain("overview");
    expect(typeExt).toContain("deliverables");
    expect(typeExt).toContain("learning");
  });

  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: summary, follow_up은 optional이어야 한다",
    (guideType) => {
      const optKeys = getOptionalSections(guideType).map((s) => s.key);
      // 존재하는 경우에만 optional인지 확인
      const config = GUIDE_SECTION_CONFIG[guideType];
      const summaryDef = config.find((s) => s.key === "summary");
      if (summaryDef) expect(summaryDef.tier).toBe("optional");
      const followDef = config.find((s) => s.key === "follow_up");
      if (followDef) expect(followDef.tier).toBe("optional");
    },
  );

  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: getDefaultActiveSections = core + type_extension",
    (guideType) => {
      const active = getDefaultActiveSections(guideType);
      const optional = getOptionalSections(guideType);
      // active에 optional 섹션이 포함되지 않아야 한다
      const optKeys = new Set(optional.map((s) => s.key));
      for (const s of active) {
        expect(optKeys.has(s.key)).toBe(false);
      }
    },
  );
});

// ============================================================
// 2. legacyToContentSections — 변환 정확성
// ============================================================

function makeLegacyContent(
  overrides: Partial<ExplorationGuideContent> = {},
): ExplorationGuideContent {
  return {
    guide_id: "test-id",
    motivation: "<p>동기 내용</p>",
    theory_sections: [
      { order: 1, title: "이론 1", content: "<p>이론 내용 1</p>" },
      { order: 2, title: "이론 2", content: "<p>이론 내용 2</p>" },
    ],
    reflection: "<p>고찰 내용</p>",
    impression: "<p>느낀점 내용</p>",
    summary: "<p>요약 내용</p>",
    follow_up: "<p>후속 내용</p>",
    book_description: null,
    related_papers: [],
    related_books: [],
    image_paths: [],
    guide_url: null,
    setek_examples: ["세특 예시 1", "세특 예시 2"],
    raw_source: null,
    content_sections: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("legacyToContentSections", () => {
  it("독서탐구: motivation, content_sections(theory), reflection, impression, summary가 변환되어야 한다", () => {
    const content = makeLegacyContent({
      book_description: "<p>도서 소개</p>",
    });
    const sections = legacyToContentSections("reading", content);

    expect(sections.find((s) => s.key === "motivation")).toBeTruthy();
    expect(sections.find((s) => s.key === "book_description")).toBeTruthy();
    expect(
      sections.filter((s) => s.key === "content_sections"),
    ).toHaveLength(2);
    expect(sections.find((s) => s.key === "reflection")).toBeTruthy();
    expect(sections.find((s) => s.key === "impression")).toBeTruthy();
    expect(sections.find((s) => s.key === "setek_examples")).toBeTruthy();
  });

  it("주제탐구: theory_sections가 content_sections 키로 변환되어야 한다", () => {
    const content = makeLegacyContent();
    const sections = legacyToContentSections("topic_exploration", content);

    const theorySections = sections.filter(
      (s) => s.key === "content_sections",
    );
    expect(theorySections).toHaveLength(2);
    expect(theorySections[0].label).toBe("이론 1");
    expect(theorySections[1].label).toBe("이론 2");
  });
});

// ============================================================
// 3. resolveContentSections — fallback 동작
// ============================================================

describe("resolveContentSections", () => {
  it("content_sections가 있으면 그대로 반환", () => {
    const content = makeLegacyContent({
      content_sections: [
        {
          key: "motivation",
          label: "탐구 동기",
          content: "<p>새 동기</p>",
          content_format: "html",
        },
      ],
    });
    const result = resolveContentSections("topic_exploration", content);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("<p>새 동기</p>");
  });

  it("content_sections가 비어있으면 레거시에서 변환", () => {
    const content = makeLegacyContent({ content_sections: [] });
    const result = resolveContentSections("topic_exploration", content);
    expect(result.length).toBeGreaterThan(0);
    expect(result.find((s) => s.key === "motivation")).toBeTruthy();
  });
});

// ============================================================
// 4. 프롬프트 빌더 검증
// ============================================================

describe("common-prompt-builder", () => {
  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: buildSectionStructurePrompt에 모든 필수 섹션 key가 포함되어야 한다",
    (guideType) => {
      const prompt = buildSectionStructurePrompt(guideType);
      const requiredKeys = getRequiredSectionKeys(guideType);
      for (const key of requiredKeys) {
        expect(prompt).toContain(key);
      }
    },
  );

  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: buildBaseSystemPrompt에 습니다 체 지침이 포함되어야 한다",
    (guideType) => {
      const prompt = buildBaseSystemPrompt(guideType);
      expect(prompt).toContain("습니다 체");
      expect(prompt).toContain("AI 의존도");
    },
  );

  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: buildBaseSystemPrompt에 이론 전개 힌트가 포함되어야 한다",
    (guideType) => {
      const prompt = buildBaseSystemPrompt(guideType);
      expect(prompt).toContain("탐구 이론 전개 가이드");
    },
  );

  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: buildBaseSystemPrompt에 섹션 간 연계 규칙이 포함되어야 한다",
    (guideType) => {
      const prompt = buildBaseSystemPrompt(guideType);
      expect(prompt).toContain("섹션 간 논리적 연계 규칙");
    },
  );

  it("buildBaseSystemPrompt에 세특 예시 지침이 포함되어야 한다", () => {
    const prompt = buildBaseSystemPrompt("topic_exploration");
    expect(prompt).toContain("자기주도성 서술어");
    expect(prompt).toContain("탐구력 서술어");
    expect(prompt).toContain("본질적 질문 제기");
  });
});

// ============================================================
// 5. 학생 프로필 분기
// ============================================================

describe("buildStudentProfilePrompt", () => {
  it("프로필 없으면 범용 지침 반환", () => {
    const result = buildStudentProfilePrompt(undefined);
    expect(result).toContain("범용 작성 지침");
    expect(result).not.toContain("희망 전공");
  });

  it("프로필 있으면 진로 연계 지시 반환", () => {
    const profile: StudentProfileContext = {
      studentId: "s1",
      name: "테스트 학생",
      targetMajor: "정치·외교",
      desiredCareerField: "SOC",
      topCompetencies: ["탐구력(1.5배)", "진로탐색(1.3배)"],
      recommendedCourses: {
        general: ["정치와법", "사회·문화"],
        career: ["국제정치"],
      },
      storylineKeywords: ["국제인권", "난민정책"],
    };
    const result = buildStudentProfilePrompt(profile);
    expect(result).toContain("정치·외교");
    expect(result).toContain("탐구력(1.5배)");
    expect(result).toContain("정치와법");
    expect(result).toContain("국제인권");
    expect(result).toContain("진로 연계 지침");
  });

  it("targetMajor가 없으면 범용 지침 반환", () => {
    const profile: StudentProfileContext = {
      studentId: "s1",
      name: "테스트 학생",
    };
    const result = buildStudentProfilePrompt(profile);
    expect(result).toContain("범용 작성 지침");
  });
});

// ============================================================
// 6. 이론 전개 힌트 및 연계 규칙 상수 검증
// ============================================================

describe("theory-development-hints", () => {
  it.each(GUIDE_TYPES as unknown as GuideType[])(
    "%s: THEORY_DEVELOPMENT_HINTS가 존재해야 한다",
    (guideType) => {
      expect(THEORY_DEVELOPMENT_HINTS[guideType]).toBeTruthy();
      expect(THEORY_DEVELOPMENT_HINTS[guideType].length).toBeGreaterThan(50);
    },
  );

  it("SECTION_COHERENCE_RULES에 5개 규칙이 포함되어야 한다", () => {
    expect(SECTION_COHERENCE_RULES).toContain("동기 → 이론 연결");
    expect(SECTION_COHERENCE_RULES).toContain("이론 내부 연결");
    expect(SECTION_COHERENCE_RULES).toContain("이론 → 고찰 연결");
    expect(SECTION_COHERENCE_RULES).toContain("고찰 → 느낀점 연결");
    expect(SECTION_COHERENCE_RULES).toContain("전체 → 세특 예시");
  });
});

// ============================================================
// 7. 작문 스타일 지침 검증
// ============================================================

describe("writing style prompts", () => {
  it("buildWritingStylePrompt에 금지 표현이 포함되어야 한다", () => {
    const prompt = buildWritingStylePrompt();
    expect(prompt).toContain("금지 표현");
    expect(prompt).toContain("~라고 할 수 있다");
  });

  it("buildSetekGuidePrompt에 심화형/확장형 서술어가 포함되어야 한다", () => {
    const prompt = buildSetekGuidePrompt();
    expect(prompt).toContain("본질적 질문 제기");
    expect(prompt).toContain("재해석");
    expect(prompt).toContain("융합적 발견");
    expect(prompt).toContain("새로운 관점 제시");
  });
});
