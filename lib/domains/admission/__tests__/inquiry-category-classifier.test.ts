import { describe, it, expect } from "vitest";
import {
  classifyInquiryCategories,
  type InquiryCategoryClassifierInput,
} from "../prediction/inquiry-category-classifier";

// ─── 단일 careerField 시나리오 ──────────────────────────────────────────────

describe("classifyInquiryCategories — careerField 매핑", () => {
  it("의학 careerField 만 있을 때 life_medical 주, natural_science 보조", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: [],
      careerField: "의학",
    };
    const { scores, reasons } = classifyInquiryCategories(input);

    expect(scores.life_medical).toBe(0.6);
    expect(scores.natural_science).toBe(0.3);
    expect(scores.engineering).toBe(0);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toMatchObject({ category: "life_medical", source: "career_primary" });
  });

  it("careerField=null 이면 themeKeywords 만으로 분류", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["인공지능", "딥러닝"],
      careerField: null,
    };
    const { scores } = classifyInquiryCategories(input);

    expect(scores.it_software).toBeGreaterThan(0);
    expect(scores.life_medical).toBe(0);
  });

  it("careerField 빈 문자열도 null 처럼 처리", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: [],
      careerField: "   ",
    };
    const { scores, reasons } = classifyInquiryCategories(input);

    expect(reasons).toHaveLength(0);
    expect(Object.values(scores).every((s) => s === 0)).toBe(true);
  });

  it("복합 careerField — '의료 AI' 는 life_medical + it_software 모두 매칭", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: [],
      careerField: "의료 AI",
    };
    const { scores } = classifyInquiryCategories(input);

    expect(scores.life_medical).toBe(0.6);
    expect(scores.natural_science).toBe(0.3);
    expect(scores.it_software).toBe(0.6);
    expect(scores.engineering).toBe(0.3);
  });
});

// ─── themeKeywords 매핑 ────────────────────────────────────────────────────

describe("classifyInquiryCategories — themeKeywords 매핑", () => {
  it("동일 카테고리 keyword 여러 개는 누적되어 1.0 cap 도달", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["프로그래밍", "알고리즘", "머신러닝", "데이터", "코딩"],
      careerField: null,
    };
    const { scores } = classifyInquiryCategories(input);

    // 5 keyword × 0.3 = 1.5 → cap 1.0
    expect(scores.it_software).toBe(1.0);
  });

  it("1글자 keyword 는 noise 방지로 스킵", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["의", "법", "의학"],
      careerField: null,
    };
    const { scores } = classifyInquiryCategories(input);

    // "의" "법" 스킵, "의학" 만 life_medical 매칭
    expect(scores.life_medical).toBe(0.3);
    expect(scores.law_policy).toBe(0);
  });

  it("부분 매칭 — '유전체학' keyword 가 사전 '유전체' 와 매칭", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["유전체학"],
      careerField: null,
    };
    const { scores } = classifyInquiryCategories(input);

    expect(scores.life_medical).toBe(0.3);
  });

  it("빈 keyword/공백은 무시", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["", "  ", "물리학"],
      careerField: null,
    };
    const { scores, reasons } = classifyInquiryCategories(input);

    // 빈 것 스킵, 물리학만 매칭
    expect(reasons).toHaveLength(1);
    expect(scores.natural_science).toBe(0.3);
  });
});

// ─── 통합 시나리오 ─────────────────────────────────────────────────────────

describe("classifyInquiryCategories — 통합 fixture", () => {
  it("인제고 1학년 의학·약학 진로 — life_medical 강세 + natural_science 보조", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["유전체학", "면역", "신경과학"],
      careerField: "의학",
    };
    const { scores } = classifyInquiryCategories(input);

    // career: life_medical +0.6, natural_science +0.3
    // theme: life_medical +0.9 (3 keyword × 0.3) → cap 1.0
    //        natural_science +0.3 ("유전체학" 이 "유전" 매칭 — 유전학은 자연과학 하위)
    expect(scores.life_medical).toBe(1.0);
    expect(scores.natural_science).toBe(0.6);
  });

  it("AI 공학자 진로 — it_software + engineering", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["딥러닝", "회로", "반도체"],
      careerField: "AI 개발자",
    };
    const { scores } = classifyInquiryCategories(input);

    // career: it_software +0.6, engineering +0.3
    // theme: it_software +0.3 (딥러닝), engineering +0.3 (회로) +0.3 (반도체)
    expect(scores.it_software).toBe(0.9);
    expect(scores.engineering).toBe(0.9);
  });

  it("법조인 진로 — law_policy 주, social_science 보조", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["헌법", "인권", "국제법"],
      careerField: "변호사",
    };
    const { scores } = classifyInquiryCategories(input);

    // career: law_policy +0.6, social_science +0.3
    // theme: law_policy +0.9
    expect(scores.law_policy).toBe(1.0);
    expect(scores.social_science).toBe(0.3);
  });

  it("일치 카테고리 0개 — 모든 점수 0 + reasons 비어있음", () => {
    const input: InquiryCategoryClassifierInput = {
      themeKeywords: ["존재하지않는테마"],
      careerField: "미정",
    };
    const { scores, reasons } = classifyInquiryCategories(input);

    expect(Object.values(scores).every((s) => s === 0)).toBe(true);
    expect(reasons).toHaveLength(0);
  });
});

// ─── 출력 정합성 ────────────────────────────────────────────────────────────

describe("classifyInquiryCategories — 출력 형식", () => {
  it("scores 는 항상 10 카테고리 모두 포함", () => {
    const { scores } = classifyInquiryCategories({
      themeKeywords: [],
      careerField: null,
    });

    expect(Object.keys(scores).sort()).toEqual(
      [
        "arts_sports",
        "business_economy",
        "education",
        "engineering",
        "humanities",
        "it_software",
        "law_policy",
        "life_medical",
        "natural_science",
        "social_science",
      ],
    );
  });

  it("모든 점수는 0~1 범위 안에 있다", () => {
    const { scores } = classifyInquiryCategories({
      themeKeywords: ["프로그래밍", "알고리즘", "머신러닝", "데이터", "코딩", "AI", "보안", "IoT", "메타버스", "블록체인"],
      careerField: "AI 개발자",
    });

    for (const score of Object.values(scores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1.0);
    }
  });
});
