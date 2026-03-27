import { describe, it, expect } from "vitest";
import { buildUserPrompt, parseResponse } from "../llm/prompts/roadmapGeneration";
import type { RoadmapGenerationInput } from "../llm/types";

// ============================================
// buildUserPrompt 테스트
// ============================================

describe("buildUserPrompt", () => {
  const minimalInput: RoadmapGenerationInput = {
    mode: "planning",
    studentName: "김학생",
    grade: 1,
    curriculumYear: 2022,
  };

  it("planning 모드 최소 입력 — 학생 정보 포함", () => {
    const prompt = buildUserPrompt(minimalInput);
    expect(prompt).toContain("1학년");
    expect(prompt).toContain("planning");
    expect(prompt).toContain("2022 개정");
  });

  it("수강 계획이 있으면 학기별 그룹으로 표시", () => {
    const prompt = buildUserPrompt({
      ...minimalInput,
      coursePlans: [
        { subjectName: "통합과학", grade: 1, semester: 1, status: "confirmed", subjectType: "공통" },
        { subjectName: "미적분", grade: 2, semester: 1, status: "recommended", subjectType: "일반선택" },
      ],
    });
    expect(prompt).toContain("## 수강 계획");
    expect(prompt).toContain("1학년 1학기");
    expect(prompt).toContain("[confirmed] 통합과학 (공통)");
    expect(prompt).toContain("2학년 1학기");
    expect(prompt).toContain("[recommended] 미적분 (일반선택)");
  });

  it("스토리라인이 있으면 테마 포함", () => {
    const prompt = buildUserPrompt({
      ...minimalInput,
      storylines: [{
        id: "sl-1",
        title: "AI 윤리 연구",
        career_field: "컴퓨터공학",
        keywords: ["AI", "윤리", "알고리즘"],
        grade_1_theme: "AI 기초 탐색",
        grade_2_theme: "윤리적 AI 설계",
        grade_3_theme: "AI 정책 제안",
      }],
    });
    expect(prompt).toContain("AI 윤리 연구");
    expect(prompt).toContain("AI 기초 탐색");
    expect(prompt).toContain("윤리적 AI 설계");
  });

  it("추천 과목이 있으면 타입별 분류", () => {
    const prompt = buildUserPrompt({
      ...minimalInput,
      targetMajor: "컴퓨터·정보",
      recommendedCourses: [
        { name: "미적분", type: "general" },
        { name: "인공지능 기초", type: "career" },
        { name: "데이터 과학", type: "fusion" },
      ],
    });
    expect(prompt).toContain("## 전공 추천 과목");
    expect(prompt).toContain("일반선택: 미적분");
    expect(prompt).toContain("진로선택: 인공지능 기초");
    expect(prompt).toContain("융합선택: 데이터 과학");
  });

  it("analysis 모드에서 진단 데이터 포함", () => {
    const prompt = buildUserPrompt({
      ...minimalInput,
      mode: "analysis",
      diagnosisStrengths: ["진로 탐색 활동이 풍부"],
      diagnosisWeaknesses: ["교과 심화 탐구 부족"],
      diagnosisImprovements: [{ priority: "높음", area: "탐구력", action: "심화 보고서 작성" }],
    });
    expect(prompt).toContain("## 진단 강점");
    expect(prompt).toContain("진로 탐색 활동이 풍부");
    expect(prompt).toContain("## 진단 약점");
    expect(prompt).toContain("교과 심화 탐구 부족");
    expect(prompt).toContain("## 개선 전략");
    expect(prompt).toContain("[높음] 탐구력: 심화 보고서 작성");
  });

  it("planning 모드에서 진단 데이터 미포함", () => {
    const prompt = buildUserPrompt({
      ...minimalInput,
      mode: "planning",
      diagnosisStrengths: ["이건 포함되면 안됨"],
    });
    expect(prompt).not.toContain("## 진단 강점");
    expect(prompt).not.toContain("이건 포함되면 안됨");
  });

  it("가이드 배정 문자열 있으면 그대로 삽입", () => {
    const prompt = buildUserPrompt({
      ...minimalInput,
      guideAssignments: "## 배정된 탐구 가이드\n- [assigned] CT 촬영 원리 탐구",
    });
    expect(prompt).toContain("## 배정된 탐구 가이드");
    expect(prompt).toContain("CT 촬영 원리 탐구");
  });
});

// ============================================
// parseResponse 테스트
// ============================================

describe("parseResponse", () => {
  it("유효한 JSON 파싱", () => {
    const json = JSON.stringify({
      items: [
        { area: "setek", grade: 1, semester: 1, plan_content: "통합과학 탐구", plan_keywords: ["CT", "의료"], storyline_title: "의공학", rationale: "기초 탐구" },
        { area: "reading", grade: 1, semester: 2, plan_content: "독서 활동", plan_keywords: ["의학사"], rationale: "배경 지식" },
      ],
      overallStrategy: "3년 성장 전략",
    });
    const result = parseResponse(json);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].area).toBe("setek");
    expect(result.items[0].plan_content).toBe("통합과학 탐구");
    expect(result.items[0].storyline_title).toBe("의공학");
    expect(result.overallStrategy).toBe("3년 성장 전략");
  });

  it("잘못된 area 필터링", () => {
    const json = JSON.stringify({
      items: [
        { area: "invalid_area", grade: 1, semester: 1, plan_content: "test", rationale: "" },
        { area: "setek", grade: 1, semester: 1, plan_content: "valid", rationale: "" },
      ],
      overallStrategy: "",
    });
    const result = parseResponse(json);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].area).toBe("setek");
  });

  it("잘못된 grade 필터링 (0, 4 등)", () => {
    const json = JSON.stringify({
      items: [
        { area: "setek", grade: 0, semester: 1, plan_content: "invalid grade", rationale: "" },
        { area: "setek", grade: 4, semester: 1, plan_content: "invalid grade", rationale: "" },
        { area: "setek", grade: 2, semester: 1, plan_content: "valid", rationale: "" },
      ],
      overallStrategy: "",
    });
    const result = parseResponse(json);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].grade).toBe(2);
  });

  it("plan_keywords 누락 시 빈 배열 기본값", () => {
    const json = JSON.stringify({
      items: [
        { area: "club", grade: 1, semester: 1, plan_content: "동아리 활동", rationale: "test" },
      ],
      overallStrategy: "",
    });
    const result = parseResponse(json);
    expect(result.items[0].plan_keywords).toEqual([]);
  });

  it("semester null 허용", () => {
    const json = JSON.stringify({
      items: [
        { area: "general", grade: 2, semester: null, plan_content: "연간 계획", plan_keywords: [], rationale: "" },
      ],
      overallStrategy: "",
    });
    const result = parseResponse(json);
    expect(result.items[0].semester).toBeNull();
  });

  it("빈 items 배열", () => {
    const result = parseResponse(JSON.stringify({ items: [], overallStrategy: "없음" }));
    expect(result.items).toHaveLength(0);
    expect(result.overallStrategy).toBe("없음");
  });

  it("plan_content 빈 문자열 필터링", () => {
    const json = JSON.stringify({
      items: [
        { area: "setek", grade: 1, semester: 1, plan_content: "", rationale: "" },
        { area: "setek", grade: 1, semester: 1, plan_content: "valid content", rationale: "" },
      ],
      overallStrategy: "",
    });
    const result = parseResponse(json);
    expect(result.items).toHaveLength(1);
  });

  it("storyline_title 미제공 시 undefined", () => {
    const json = JSON.stringify({
      items: [
        { area: "career", grade: 1, semester: 1, plan_content: "진로 탐색", plan_keywords: ["진로"], rationale: "test" },
      ],
      overallStrategy: "",
    });
    const result = parseResponse(json);
    expect(result.items[0].storyline_title).toBeUndefined();
  });
});
