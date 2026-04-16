import { describe, it, expect } from "vitest";
import {
  buildMainExplorationUserPrompt,
  parseMainExplorationResponse,
  type MainExplorationPromptContext,
} from "../main-exploration-prompt";

function emptyContext(): MainExplorationPromptContext {
  return {
    exemplarId: "exemplar-1",
    schoolName: "테스트고",
    anonymousId: "anon-1",
    careerAspirations: [],
    seteks: [],
    creativeActivities: [],
    haengteuk: [],
    reading: [],
  };
}

// ─── 프롬프트 빌더 ──────────────────────────────────────────────────────────

describe("buildMainExplorationUserPrompt", () => {
  it("빈 컨텍스트에서도 학교/anonymous 헤더 + 마지막 지시문은 포함", () => {
    const out = buildMainExplorationUserPrompt(emptyContext());
    expect(out).toContain("# 학교: 테스트고");
    expect(out).toContain("# anonymous_id: anon-1");
    expect(out).toContain("JSON 으로 추출하세요");
    // 빈 섹션 헤더는 노출되지 않는다
    expect(out).not.toContain("## 세특");
    expect(out).not.toContain("## 진로희망");
  });

  it("진로희망/세특/창체/행특/독서 모두 있을 때 섹션 헤더 노출", () => {
    const ctx: MainExplorationPromptContext = {
      ...emptyContext(),
      careerAspirations: [
        { grade: 1, studentAspiration: "의사", reason: "할머니 영향" },
      ],
      seteks: [
        {
          grade: 1,
          semester: 1,
          subjectName: "생명과학",
          content: "유전체학을 탐구",
        },
      ],
      creativeActivities: [
        {
          grade: 1,
          activityType: "동아리",
          activityName: "바이오반",
          content: "면역 발표",
        },
      ],
      haengteuk: [{ grade: 1, content: "탐구심이 깊다" }],
      reading: [
        {
          grade: 1,
          subjectArea: "생명과학",
          bookDescription: "유전자의 내밀한 역사",
        },
      ],
    };
    const out = buildMainExplorationUserPrompt(ctx);
    expect(out).toContain("## 진로희망");
    expect(out).toContain("## 세특");
    expect(out).toContain("## 창체");
    expect(out).toContain("## 행특");
    expect(out).toContain("## 독서");
    expect(out).toContain("[1학년 1학기 · 생명과학]");
  });

  it("긴 content 는 truncate 되며 말줄임 기호로 끝남", () => {
    const ctx: MainExplorationPromptContext = {
      ...emptyContext(),
      seteks: [
        {
          grade: 1,
          semester: 1,
          subjectName: "수학",
          content: "가".repeat(1000),
        },
      ],
    };
    const out = buildMainExplorationUserPrompt(ctx);
    expect(out).toMatch(/…/);
    // 600자 truncation 정책
    expect(out.split("[1학년 1학기 · 수학]")[1].slice(0, 700)).toContain("가");
  });
});

// ─── 응답 파서 ──────────────────────────────────────────────────────────────

describe("parseMainExplorationResponse", () => {
  it("정상 JSON 통과", () => {
    const raw = {
      theme_label: "유전체학 기반 의학 탐구",
      theme_keywords: ["유전체학", "면역", "신경과학"],
      career_field: "의학/유전체학",
      tier_plan: {
        foundational: {
          theme: "유전 기초 개념",
          key_questions: ["DNA 복제 과정?"],
          suggested_activities: ["교과서 정리"],
        },
        development: {
          theme: "유전 질환 사례 분석",
          key_questions: ["겸상적혈구빈혈증의 유전 패턴?"],
          suggested_activities: ["동아리 발표"],
        },
      },
    };
    const parsed = parseMainExplorationResponse(raw);
    expect(parsed.theme_label).toBe("유전체학 기반 의학 탐구");
    expect(parsed.theme_keywords).toHaveLength(3);
    expect(parsed.tier_plan.foundational?.theme).toBe("유전 기초 개념");
    expect(parsed.tier_plan.advanced).toBeUndefined();
  });

  it("career_field=null 허용", () => {
    const raw = {
      theme_label: "범용 탐구",
      theme_keywords: ["탐구"],
      career_field: null,
      tier_plan: {},
    };
    const parsed = parseMainExplorationResponse(raw);
    expect(parsed.career_field).toBeNull();
  });

  it("필수 필드 누락 시 throw", () => {
    expect(() =>
      parseMainExplorationResponse({
        theme_label: "x",
        // theme_keywords 누락
        career_field: null,
        tier_plan: {},
      }),
    ).toThrow();
  });

  it("theme_keywords 가 비어있으면 throw", () => {
    expect(() =>
      parseMainExplorationResponse({
        theme_label: "x",
        theme_keywords: [],
        career_field: null,
        tier_plan: {},
      }),
    ).toThrow();
  });

  it("theme_keywords 13개 이상이면 throw", () => {
    expect(() =>
      parseMainExplorationResponse({
        theme_label: "x",
        theme_keywords: Array.from({ length: 13 }, (_, i) => `kw-${i}`),
        career_field: null,
        tier_plan: {},
      }),
    ).toThrow();
  });

  it("알 수 없는 tier 키는 strip 후 통과", () => {
    const raw = {
      theme_label: "테마",
      theme_keywords: ["키워드"],
      career_field: "의학",
      tier_plan: {
        foundational: { theme: "기초" },
        unknown_tier: { theme: "should_be_stripped" },
      },
    };
    const parsed = parseMainExplorationResponse(raw);
    expect(parsed.tier_plan.foundational?.theme).toBe("기초");
    expect((parsed.tier_plan as Record<string, unknown>).unknown_tier).toBeUndefined();
  });
});
