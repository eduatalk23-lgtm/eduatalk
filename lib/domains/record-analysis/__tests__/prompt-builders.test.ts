import { describe, it, expect } from "vitest";
import { buildInterviewUserPrompt, parseInterviewResponse } from "../llm/prompts/interviewQuestions";
import { buildUserPrompt as buildStrategyPrompt, parseResponse as parseStrategyResponse } from "../llm/prompts/strategyRecommend";
import { buildUserPrompt as buildActivityPrompt } from "../llm/prompts/activitySummary";
import { buildUserPrompt as buildSetekGuidePrompt } from "../llm/prompts/setekGuide";

describe("buildInterviewUserPrompt", () => {
  it("기본 필드 포함", () => {
    const prompt = buildInterviewUserPrompt({
      content: "수학적 모델링을 활용한 전염병 확산 예측 탐구를 진행함.",
      recordType: "setek",
      subjectName: "수학",
      grade: 2,
    });
    expect(prompt).toContain("교과 세특");
    expect(prompt).toContain("수학");
    expect(prompt).toContain("2학년");
    expect(prompt).toContain("수학적 모델링");
    expect(prompt).toContain("면접 예상 질문 10개");
  });

  it("과목명 없으면 과목 라인 생략", () => {
    const prompt = buildInterviewUserPrompt({
      content: "자율활동에서 리더십을 발휘함.",
      recordType: "changche",
    });
    expect(prompt).toContain("창의적 체험활동");
    expect(prompt).not.toContain("과목:");
  });

  it("recordType 매핑 안 되면 원본 사용", () => {
    const prompt = buildInterviewUserPrompt({
      content: "독서 기록",
      recordType: "unknown_type",
    });
    expect(prompt).toContain("unknown_type");
  });
});

describe("parseInterviewResponse", () => {
  it("유효한 JSON 파싱", () => {
    const json = JSON.stringify({
      questions: [
        { questionType: "factual", question: "CT 원리?", suggestedAnswer: "연립방정식 활용", difficulty: "medium" },
        { questionType: "reasoning", question: "왜 이 주제?", suggestedAnswer: "관심 분야", difficulty: "easy" },
      ],
      summary: "의료 탐구 질문",
    });
    const result = parseInterviewResponse(json);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].questionType).toBe("factual");
    expect(result.summary).toBe("의료 탐구 질문");
  });

  it("잘못된 questionType은 필터링", () => {
    const json = JSON.stringify({
      questions: [
        { questionType: "invalid_type", question: "test?", suggestedAnswer: "ans", difficulty: "easy" },
        { questionType: "factual", question: "valid?", suggestedAnswer: "ans", difficulty: "easy" },
      ],
      summary: "test",
    });
    const result = parseInterviewResponse(json);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].questionType).toBe("factual");
  });

  it("빈 질문 배열 → 빈 결과", () => {
    const result = parseInterviewResponse(JSON.stringify({ questions: [], summary: "" }));
    expect(result.questions).toHaveLength(0);
  });
});

describe("buildStrategyPrompt", () => {
  it("약점 + 부족 역량 포함", () => {
    const prompt = buildStrategyPrompt({
      weaknesses: ["탐구 깊이 부족", "교과 연계 미흡"],
      weakCompetencies: [{ item: "academic_inquiry", grade: "B-", label: "탐구력" }],
      grade: 2,
      targetMajor: "컴퓨터공학",
    });
    expect(prompt).toContain("탐구 깊이 부족");
    expect(prompt).toContain("탐구력");
    expect(prompt).toContain("컴퓨터공학");
  });

  it("미이수 과목 있으면 프롬프트에 포함", () => {
    const prompt = buildStrategyPrompt({
      weaknesses: ["미이수"],
      weakCompetencies: [],
      grade: 3,
      notTakenSubjects: ["미적분", "물리학II"],
    });
    expect(prompt).toContain("미적분");
    expect(prompt).toContain("물리학II");
  });
});

describe("parseStrategyResponse", () => {
  it("유효한 전략 파싱 + 소스 URL 매핑", () => {
    const json = JSON.stringify({
      suggestions: [
        { targetArea: "setek", strategyContent: "심화 보고서 작성", priority: "high", reasoning: "탐구 깊이" },
      ],
    });
    const result = parseStrategyResponse(json, ["https://example.com"]);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].targetArea).toBe("setek");
    expect(result.suggestions[0].sourceUrls).toContain("https://example.com");
  });

  it("유효하지 않은 targetArea 필터링", () => {
    const json = JSON.stringify({
      suggestions: [
        { targetArea: "invalid_area", strategyContent: "test", priority: "high" },
        { targetArea: "reading", strategyContent: "독서 추천", priority: "medium" },
      ],
    });
    const result = parseStrategyResponse(json);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].targetArea).toBe("reading");
  });

  it("빈 suggestions → 빈 결과", () => {
    const result = parseStrategyResponse(JSON.stringify({ suggestions: [] }));
    expect(result.suggestions).toHaveLength(0);
  });
});

describe("buildActivitySummaryPrompt", () => {
  it("학년별 기록 포함", () => {
    const prompt = buildActivityPrompt({
      studentName: "홍길동",
      grade: 2,
      targetMajor: "생명과학",
      targetGrades: [1, 2],
      recordDataByGrade: {
        1: {
          seteks: [{ subject_name: "생명과학I", content: "세포 분열 탐구" }],
          personalSeteks: [],
          changche: [],
          readings: [],
          haengteuk: null,
        },
      },
    });
    expect(prompt).toContain("홍길동");
    expect(prompt).toContain("생명과학");
    expect(prompt).toContain("세포 분열");
  });

  it("스토리라인 있으면 포함", () => {
    const prompt = buildActivityPrompt({
      studentName: "김학생",
      grade: 1,
      targetMajor: null,
      targetGrades: [1],
      recordDataByGrade: {},
      storylines: [{ title: "데이터 과학 여정", keywords: ["통계", "AI"] }],
    });
    expect(prompt).toContain("데이터 과학 여정");
    expect(prompt).toContain("통계");
  });
});

// ============================================
// Phase R2: setekGuide prospective 프롬프트 테스트
// ============================================

describe("buildSetekGuidePrompt (prospective)", () => {
  it("prospective 모드에서 계획 과목 포함", () => {
    const prompt = buildSetekGuidePrompt({
      mode: "prospective",
      studentName: "김학생",
      grade: 1,
      targetMajor: "컴퓨터·정보",
      targetGrades: [1, 2],
      recordDataByGrade: {},
      plannedSubjects: [
        { subjectName: "통합과학", grade: 1, semester: 1, subjectType: "공통" },
        { subjectName: "정보", grade: 1, semester: 2, subjectType: "일반선택" },
      ],
    });
    expect(prompt).toContain("prospective");
    expect(prompt).toContain("## 계획 과목");
    expect(prompt).toContain("통합과학 (공통)");
    expect(prompt).toContain("정보 (일반선택)");
    expect(prompt).toContain("미래 세특 작성 방향");
    // retrospective 전용 텍스트는 미포함
    expect(prompt).not.toContain("위 기록과 진단 결과를 바탕으로");
  });

  it("retrospective 모드에서 기존 기록 포함", () => {
    const prompt = buildSetekGuidePrompt({
      mode: "retrospective",
      studentName: "박학생",
      grade: 2,
      targetGrades: [1],
      recordDataByGrade: {
        1: {
          seteks: [{ subject_name: "수학I", content: "확률과 통계 심화 탐구를 진행함" }],
          changche: [],
        },
      },
    });
    expect(prompt).toContain("retrospective");
    expect(prompt).toContain("## 1학년 기록");
    expect(prompt).toContain("수학I");
    expect(prompt).toContain("위 기록과 진단 결과를 바탕으로");
    // prospective 전용 텍스트는 미포함
    expect(prompt).not.toContain("## 계획 과목");
  });

  it("mode 미지정 시 retrospective 기본값", () => {
    const prompt = buildSetekGuidePrompt({
      studentName: "학생",
      grade: 1,
      targetGrades: [1],
      recordDataByGrade: {
        1: { seteks: [{ subject_name: "국어", content: "독서 토론 활동에 참여함" }], changche: [] },
      },
    });
    expect(prompt).toContain("retrospective");
    expect(prompt).toContain("위 기록과 진단 결과를 바탕으로");
  });

  it("prospective 모드에서 가이드 배정 컨텍스트 포함", () => {
    const prompt = buildSetekGuidePrompt({
      mode: "prospective",
      studentName: "학생",
      grade: 1,
      targetGrades: [1],
      recordDataByGrade: {},
      plannedSubjects: [{ subjectName: "물리학I", grade: 1, semester: 1 }],
      guideAssignments: "## 배정된 탐구 가이드\n- [assigned] 빛의 이중성 탐구",
    });
    expect(prompt).toContain("## 배정된 탐구 가이드");
    expect(prompt).toContain("빛의 이중성 탐구");
  });
});
