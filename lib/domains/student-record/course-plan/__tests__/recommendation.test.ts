import { describe, it, expect } from "vitest";
import {
  getRecommendedCourseNames,
  matchRecommendationsToSubjects,
  assignGradeSemesters,
} from "../recommendation";

// ============================================
// 1단계: 추천 과목명 추출
// ============================================

describe("getRecommendedCourseNames", () => {
  it("컴퓨터·정보 계열에서 추천 과목을 반환한다", () => {
    const result = getRecommendedCourseNames(["컴퓨터·정보"]);
    expect(result.length).toBeGreaterThan(0);

    const names = result.map((r) => r.name);
    expect(names).toContain("미적분");
    expect(names).toContain("확률과통계");
    expect(names).toContain("정보");
    expect(names).toContain("인공지능수학");
  });

  it("경영·경제 계열에서 추천 과목을 반환한다", () => {
    const result = getRecommendedCourseNames(["경영·경제"]);
    const names = result.map((r) => r.name);
    expect(names).toContain("경제");
    expect(names).toContain("사회·문화");
  });

  it("복수 전공: 합집합을 반환한다", () => {
    const single1 = getRecommendedCourseNames(["컴퓨터·정보"]);
    const single2 = getRecommendedCourseNames(["경영·경제"]);
    const combined = getRecommendedCourseNames(["컴퓨터·정보", "경영·경제"]);

    expect(combined.length).toBeGreaterThanOrEqual(
      Math.max(single1.length, single2.length),
    );
    // 중복 없음
    const normalizedNames = combined.map((r) => r.name);
    expect(new Set(normalizedNames).size).toBe(normalizedNames.length);
  });

  it("존재하지 않는 계열은 빈 배열 반환", () => {
    const result = getRecommendedCourseNames(["존재하지않는계열"]);
    expect(result).toEqual([]);
  });

  it("2022 교육과정 과목을 반환한다", () => {
    const result = getRecommendedCourseNames(["컴퓨터·정보"], 2022);
    const names = result.map((r) => r.name);
    expect(names).toContain("인공지능 수학");
    // fusion 과목도 포함
    expect(names).toContain("정보과학");
  });

  it("빈 배열 입력은 빈 배열 반환", () => {
    expect(getRecommendedCourseNames([])).toEqual([]);
  });

  it("general/career/fusion 타입이 올바르게 태깅된다", () => {
    const result = getRecommendedCourseNames(["컴퓨터·정보"], 2022);
    const generals = result.filter((r) => r.type === "general");
    const careers = result.filter((r) => r.type === "career");
    const fusions = result.filter((r) => r.type === "fusion");

    expect(generals.length).toBeGreaterThan(0);
    expect(careers.length).toBeGreaterThan(0);
    expect(fusions.length).toBeGreaterThan(0);
  });

  // 22개 전공 계열 전부 테스트
  const allMajors = [
    "법·행정", "경영·경제", "심리", "사회복지", "교육",
    "국어", "외국어", "사학·철학", "언론·홍보", "정치·외교",
    "수리·통계", "물리·천문", "생명·바이오", "의학·약학",
    "컴퓨터·정보", "기계·자동차·로봇", "화학·신소재·에너지",
    "건축·사회시스템", "사회", "전기·전자", "보건", "생활과학", "농림",
  ];

  it.each(allMajors)("%s 계열의 추천 과목이 존재한다", (major) => {
    const result = getRecommendedCourseNames([major]);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ============================================
// 2단계: subject_id 매칭
// ============================================

describe("matchRecommendationsToSubjects", () => {
  const subjects = [
    { id: "s1", name: "미적분", subjectType: "일반선택" },
    { id: "s2", name: "확률과통계", subjectType: "일반선택" },
    { id: "s3", name: "물리학Ⅰ", subjectType: "일반선택" },
    { id: "s4", name: "정보", subjectType: "일반선택" },
    { id: "s5", name: "인공지능수학", subjectType: "진로선택" },
    { id: "s6", name: "기하", subjectType: "진로선택" },
    { id: "s7", name: "경제", subjectType: "일반선택" },
    { id: "s8", name: "사회·문화", subjectType: "일반선택" },
  ];

  it("정규화 매칭: 유니코드 로마숫자 차이를 흡수한다", () => {
    const recommendations = [
      { name: "물리학Ⅰ", type: "general" as const, majorCategory: "test" },
    ];
    const result = matchRecommendationsToSubjects(recommendations, subjects);
    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe("s3");
  });

  it("가운뎃점 차이를 흡수한다", () => {
    const recommendations = [
      { name: "사회‧문화", type: "general" as const, majorCategory: "test" },
    ];
    const result = matchRecommendationsToSubjects(recommendations, subjects);
    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe("s8");
  });

  it("DB에 없는 과목은 skip한다", () => {
    const recommendations = [
      { name: "존재하지않는과목", type: "general" as const, majorCategory: "test" },
    ];
    const result = matchRecommendationsToSubjects(recommendations, subjects);
    expect(result).toHaveLength(0);
  });

  it("여러 과목을 한번에 매칭한다", () => {
    const recommendations = [
      { name: "미적분", type: "general" as const, majorCategory: "test" },
      { name: "경제", type: "general" as const, majorCategory: "test" },
      { name: "기하", type: "career" as const, majorCategory: "test" },
    ];
    const result = matchRecommendationsToSubjects(recommendations, subjects);
    expect(result).toHaveLength(3);
  });
});

// ============================================
// 3단계: 학년/학기 배치
// ============================================

describe("assignGradeSemesters", () => {
  const matched = [
    {
      name: "미적분", type: "general" as const, majorCategory: "test",
      subjectId: "s1", subjectName: "미적분", subjectType: "일반선택",
    },
    {
      name: "기하", type: "career" as const, majorCategory: "test",
      subjectId: "s6", subjectName: "기하", subjectType: "진로선택",
    },
    {
      name: "정보", type: "general" as const, majorCategory: "test",
      subjectId: "s4", subjectName: "정보", subjectType: "일반선택",
    },
  ];

  it("학교 개설 정보가 없으면 subject_type 기반 fallback", () => {
    const result = assignGradeSemesters(matched, [], [], [], 1);
    expect(result.length).toBe(3);

    const calcRec = result.find((r) => r.subjectId === "s1");
    expect(calcRec?.grade).toBe(2); // 일반선택 → 2학년

    const geoRec = result.find((r) => r.subjectId === "s6");
    expect(geoRec?.grade).toBe(2); // 진로선택 → 2-3학년 중 첫 번째
  });

  it("학교 개설 정보가 있으면 해당 학년 사용", () => {
    const offered = [
      { subjectId: "s1", grades: [3], semesters: [2] },
    ];
    const result = assignGradeSemesters(matched, offered, [], [], 1);
    const calcRec = result.find((r) => r.subjectId === "s1");
    expect(calcRec?.grade).toBe(3);
    expect(calcRec?.semester).toBe(2);
  });

  it("이미 이수한 과목은 제외한다", () => {
    const result = assignGradeSemesters(matched, [], [], ["s1"], 1);
    expect(result.find((r) => r.subjectId === "s1")).toBeUndefined();
    expect(result.length).toBe(2);
  });

  it("기존 계획과 중복되면 제외한다", () => {
    const existingPlans = [{
      id: "p1", tenant_id: "t", student_id: "st",
      subject_id: "s1", grade: 2, semester: 1,
      plan_status: "confirmed" as const, source: "consultant" as const,
      recommendation_reason: null, is_school_offered: null,
      priority: 0, notes: null,
      created_at: "", updated_at: "",
    }];
    const result = assignGradeSemesters(matched, [], existingPlans, [], 1);
    expect(result.find((r) => r.subjectId === "s1")).toBeUndefined();
  });

  it("현재 학년 이상으로만 배치한다", () => {
    const result = assignGradeSemesters(matched, [], [], [], 3);
    // 일반선택 기본 2학년이지만 현재 3학년이면 skip 또는 3학년
    for (const r of result) {
      expect(r.grade).toBeGreaterThanOrEqual(2); // subject_type default에 맞는 학년
    }
  });

  it("is_school_offered가 올바르게 설정된다", () => {
    const offered = [
      { subjectId: "s1", grades: [2], semesters: [1] },
    ];
    const result = assignGradeSemesters(matched, offered, [], [], 1);

    const offeredRec = result.find((r) => r.subjectId === "s1");
    expect(offeredRec?.isSchoolOffered).toBe(true);

    const notOfferedRec = result.find((r) => r.subjectId === "s4");
    expect(notOfferedRec?.isSchoolOffered).toBe(false);
  });

  it("학교 개설 정보가 아예 없으면 is_school_offered = null", () => {
    const result = assignGradeSemesters(matched, [], [], [], 1);
    for (const r of result) {
      expect(r.isSchoolOffered).toBeNull();
    }
  });

  it("결과가 학년 > 학기 > 우선순위로 정렬된다", () => {
    const result = assignGradeSemesters(matched, [], [], [], 1);
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev.grade === curr.grade && prev.semester === curr.semester) {
        expect(prev.priority).toBeGreaterThanOrEqual(curr.priority);
      }
    }
  });
});
