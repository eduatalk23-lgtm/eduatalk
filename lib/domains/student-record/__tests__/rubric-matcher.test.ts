// ============================================
// rubric-matcher.ts 유닛 테스트
//
// 대상 함수:
//   extractRubricQuestion      — evidence_summary에서 루브릭 질문 추출
//   findRubricQuestionIndex    — 질문 텍스트 → 인덱스 매핑
//   aggregateTagsByQuestion    — 태그를 질문별로 집계
//   deriveItemGradeFromRubrics — 루브릭 점수 → 항목 등급 산출
//   gradeToNum                 — 등급 → 수치 변환
//   aggregateCompetencyGrades  — 다중 레코드 루브릭 집계
//
// 전략:
//   순수 함수 테스트 — mock 없이 실제 로직 검증
// ============================================

import { describe, it, expect } from "vitest";
import {
  extractRubricQuestion,
  findRubricQuestionIndex,
  aggregateTagsByQuestion,
  deriveItemGradeFromRubrics,
  gradeToNum,
  aggregateCompetencyGrades,
} from "../rubric-matcher";
import type { CompetencyGrade } from "../types";

// ============================================
// extractRubricQuestion
// ============================================

describe("extractRubricQuestion", () => {
  it("루브릭: 접두사로 시작하는 질문을 추출한다", () => {
    const text = "[AI] 학생은 수업에 적극적으로 참여함.\n루브릭: 수업 중 발표·질문·토론 등 적극적 참여 행동이 구체적으로 관찰되는가?";
    expect(extractRubricQuestion(text)).toBe(
      "수업 중 발표·질문·토론 등 적극적 참여 행동이 구체적으로 관찰되는가?",
    );
  });

  it("루브릭 접두사가 없으면 null 반환", () => {
    expect(extractRubricQuestion("일반 텍스트")).toBeNull();
  });

  it("null/빈 문자열에 null 반환", () => {
    expect(extractRubricQuestion(null)).toBeNull();
    expect(extractRubricQuestion("")).toBeNull();
  });

  it("루브릭: 뒤 공백을 trim한다", () => {
    expect(extractRubricQuestion("루브릭:   질문 텍스트  ")).toBe("질문 텍스트");
  });
});

// ============================================
// findRubricQuestionIndex
// ============================================

describe("findRubricQuestionIndex", () => {
  it("정확 매칭 시 올바른 인덱스 반환", () => {
    const idx = findRubricQuestionIndex(
      "academic_achievement",
      "대학 수학에 필요한 기본 교과목의 교과성적은 적절한가?",
    );
    expect(idx).toBe(0);
  });

  it("두 번째 질문 정확 매칭", () => {
    const idx = findRubricQuestionIndex(
      "academic_achievement",
      "학기별/학년별 성적의 추이는 어떠한가?",
    );
    expect(idx).toBe(3);
  });

  it("접두사 매칭으로 찾는다", () => {
    // 처음 15자가 일치하면 접두사 매칭
    const idx = findRubricQuestionIndex(
      "academic_attitude",
      "성취동기와 목표의식을 가지고", // 원본의 앞부분
    );
    expect(idx).toBe(0);
  });

  it("존재하지 않는 역량 항목에 -1 반환", () => {
    expect(findRubricQuestionIndex("nonexistent_item", "아무 질문")).toBe(-1);
  });

  it("매칭되지 않는 질문에 -1 반환", () => {
    expect(findRubricQuestionIndex("academic_achievement", "완전히 다른 질문")).toBe(-1);
  });
});

// ============================================
// aggregateTagsByQuestion
// ============================================

describe("aggregateTagsByQuestion", () => {
  const ITEM = "academic_achievement";

  it("빈 태그 배열에 빈 통계 반환 (질문 수만큼)", () => {
    const stats = aggregateTagsByQuestion(ITEM, []);
    expect(stats).toHaveLength(4); // academic_achievement는 4개 질문
    stats.forEach((s) => {
      expect(s.positive).toBe(0);
      expect(s.negative).toBe(0);
      expect(s.needsReview).toBe(0);
    });
  });

  it("존재하지 않는 역량 항목에 빈 배열 반환", () => {
    expect(aggregateTagsByQuestion("nonexistent", [])).toEqual([]);
  });

  it("positive/negative 태그를 올바른 질문에 집계한다", () => {
    const tags = [
      {
        competency_item: ITEM,
        evaluation: "positive",
        evidence_summary: "[AI] 좋은 성적\n루브릭: 대학 수학에 필요한 기본 교과목의 교과성적은 적절한가?",
      },
      {
        competency_item: ITEM,
        evaluation: "negative",
        evidence_summary: "[AI] 추이 하락\n루브릭: 학기별/학년별 성적의 추이는 어떠한가?",
      },
      {
        competency_item: ITEM,
        evaluation: "needs_review",
        evidence_summary: "[AI] 검토필요\n루브릭: 대학 수학에 필요한 기본 교과목의 교과성적은 적절한가?",
      },
    ];
    const stats = aggregateTagsByQuestion(ITEM, tags);

    expect(stats[0].positive).toBe(1);
    expect(stats[0].needsReview).toBe(1);
    expect(stats[3].negative).toBe(1);
  });

  it("다른 역량 항목의 태그는 무시한다", () => {
    const tags = [
      { competency_item: "academic_attitude", evaluation: "positive", evidence_summary: null },
    ];
    const stats = aggregateTagsByQuestion(ITEM, tags);
    stats.forEach((s) => {
      expect(s.positive + s.negative + s.needsReview).toBe(0);
    });
  });

  it("루브릭 매칭 안 되는 태그는 미집계 (unmatchedTags)", () => {
    const tags = [
      { competency_item: ITEM, evaluation: "positive", evidence_summary: "루브릭이 없는 태그" },
    ];
    const stats = aggregateTagsByQuestion(ITEM, tags);
    const total = stats.reduce((s, q) => s + q.positive + q.negative + q.needsReview, 0);
    expect(total).toBe(0); // 미매칭 태그는 어디에도 배정되지 않음
  });

  it("evidence에서 [AI]와 루브릭 부분을 제거한 텍스트를 evidences에 저장", () => {
    const tags = [
      {
        competency_item: ITEM,
        evaluation: "positive",
        evidence_summary: "[AI] 학생의 성적이 우수함\n루브릭: 대학 수학에 필요한 기본 교과목의 교과성적은 적절한가?",
      },
    ];
    const stats = aggregateTagsByQuestion(ITEM, tags);
    expect(stats[0].evidences).toEqual(["학생의 성적이 우수함"]);
  });
});

// ============================================
// deriveItemGradeFromRubrics
// ============================================

describe("deriveItemGradeFromRubrics", () => {
  it("빈 배열에 null 반환", () => {
    expect(deriveItemGradeFromRubrics([])).toBeNull();
  });

  it("단일 A+ 점수에 A+ 반환", () => {
    expect(deriveItemGradeFromRubrics([{ grade: "A+" as CompetencyGrade }])).toBe("A+");
  });

  it("A+ + C → B+ (평균 2.5 → 반올림 3)", () => {
    const result = deriveItemGradeFromRubrics([
      { grade: "A+" as CompetencyGrade },
      { grade: "C" as CompetencyGrade },
    ]);
    expect(result).toBe("B+");
  });

  it("B + B- → B (평균 1.5 → 반올림 2)", () => {
    const result = deriveItemGradeFromRubrics([
      { grade: "B" as CompetencyGrade },
      { grade: "B-" as CompetencyGrade },
    ]);
    expect(result).toBe("B");
  });

  it("모두 C → C", () => {
    const result = deriveItemGradeFromRubrics([
      { grade: "C" as CompetencyGrade },
      { grade: "C" as CompetencyGrade },
    ]);
    expect(result).toBe("C");
  });
});

// ============================================
// gradeToNum
// ============================================

describe("gradeToNum", () => {
  it("A+=5, A-=4, B+=3, B=2, B-=1, C=0", () => {
    expect(gradeToNum("A+")).toBe(5);
    expect(gradeToNum("A-")).toBe(4);
    expect(gradeToNum("B+")).toBe(3);
    expect(gradeToNum("B")).toBe(2);
    expect(gradeToNum("B-")).toBe(1);
    expect(gradeToNum("C")).toBe(0);
  });

  it("알 수 없는 등급에 기본값 2 반환", () => {
    expect(gradeToNum("X")).toBe(2);
    expect(gradeToNum("")).toBe(2);
  });
});

// ============================================
// aggregateCompetencyGrades
// ============================================

describe("aggregateCompetencyGrades", () => {
  it("빈 배열에 빈 결과 반환", () => {
    expect(aggregateCompetencyGrades([])).toEqual([]);
  });

  it("rubricScores 없는 단일 입력에 vote 방식으로 등급 결정", () => {
    const result = aggregateCompetencyGrades([
      { item: "academic_achievement", grade: "A+" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].finalGrade).toBe("A+");
    expect(result[0].method).toBe("vote");
    expect(result[0].rubricScores).toBeNull();
    expect(result[0].area).toBe("academic");
  });

  it("동일 항목 다수 입력 시 최빈값으로 등급 결정 (vote)", () => {
    const result = aggregateCompetencyGrades([
      { item: "academic_achievement", grade: "B+" },
      { item: "academic_achievement", grade: "A-" },
      { item: "academic_achievement", grade: "B+" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].finalGrade).toBe("B+");
    expect(result[0].method).toBe("vote");
  });

  it("동일 투표 수일 때 높은 등급 선택", () => {
    const result = aggregateCompetencyGrades([
      { item: "academic_achievement", grade: "B+" },
      { item: "academic_achievement", grade: "A-" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].finalGrade).toBe("A-");
  });

  it("rubricScores 있는 입력에 rubric 방식으로 등급 산출", () => {
    const result = aggregateCompetencyGrades([
      {
        item: "academic_achievement",
        grade: "B+",
        rubricScores: [
          { questionIndex: 0, grade: "A+", reasoning: "우수" },
          { questionIndex: 1, grade: "B", reasoning: "보통" },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe("rubric");
    expect(result[0].rubricScores).toHaveLength(2);
    // A+(5) + B(2) = 7 / 2 = 3.5 → 반올림 4 → A-
    expect(result[0].finalGrade).toBe("A-");
  });

  it("다중 레코드의 같은 질문에서 최고 등급 선택", () => {
    const result = aggregateCompetencyGrades([
      {
        item: "academic_achievement",
        grade: "B",
        rubricScores: [{ questionIndex: 0, grade: "B", reasoning: "보통" }],
      },
      {
        item: "academic_achievement",
        grade: "A-",
        rubricScores: [{ questionIndex: 0, grade: "A+", reasoning: "우수" }],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe("rubric");
    // 질문0에서 최고: A+(5) → 단일 질문이므로 A+
    expect(result[0].finalGrade).toBe("A+");
  });

  it("여러 역량 항목을 독립적으로 집계", () => {
    const result = aggregateCompetencyGrades([
      { item: "academic_achievement", grade: "A+" },
      { item: "academic_attitude", grade: "B" },
    ]);
    expect(result).toHaveLength(2);
    const achievement = result.find((r) => r.item === "academic_achievement");
    const attitude = result.find((r) => r.item === "academic_attitude");
    expect(achievement?.finalGrade).toBe("A+");
    expect(attitude?.finalGrade).toBe("B");
  });

  it("COMPETENCY_ITEMS에 없는 항목은 결과에서 제외", () => {
    const result = aggregateCompetencyGrades([
      { item: "nonexistent_item", grade: "A+" },
    ]);
    expect(result).toHaveLength(0);
  });
});
