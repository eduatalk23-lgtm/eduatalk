/**
 * 플랜 최적화 프롬프트
 *
 * Claude API를 사용한 학습 플랜 효율성 분석 및 개선 제안을 위한 프롬프트입니다.
 * 기존 플랜의 실행 데이터를 분석하여 최적화 제안을 제공합니다.
 *
 * @module planOptimization
 */

// ============================================
// 입력 타입
// ============================================

/**
 * 학생 기본 정보
 */
export interface StudentBasicInfo {
  id: string;
  name: string;
  grade: number;
  targetUniversity?: string;
  targetMajor?: string;
}

/**
 * 플랜 실행 통계
 */
export interface PlanExecutionStats {
  /** 전체 플랜 수 */
  totalPlans: number;
  /** 완료된 플랜 수 */
  completedPlans: number;
  /** 미완료 플랜 수 */
  incompletePlans: number;
  /** 건너뛴 플랜 수 */
  skippedPlans: number;
  /** 전체 완료율 (%) */
  overallCompletionRate: number;
  /** 평균 진행률 (%) */
  averageProgress: number;
}

/**
 * 시간대별 성과
 */
export interface TimeSlotPerformance {
  /** 시간대 (morning, afternoon, evening, night) */
  timeSlot: "morning" | "afternoon" | "evening" | "night";
  /** 해당 시간대 플랜 수 */
  planCount: number;
  /** 완료율 (%) */
  completionRate: number;
  /** 평균 진행률 (%) */
  averageProgress: number;
}

/**
 * 요일별 성과
 */
export interface DayOfWeekPerformance {
  /** 요일 (0-6, 0=일요일) */
  dayOfWeek: number;
  /** 요일 이름 */
  dayName: string;
  /** 해당 요일 플랜 수 */
  planCount: number;
  /** 완료율 (%) */
  completionRate: number;
  /** 평균 진행률 (%) */
  averageProgress: number;
}

/**
 * 과목별 성과
 */
export interface SubjectPerformance {
  /** 과목명 */
  subject: string;
  /** 과목 카테고리 */
  subjectCategory: string;
  /** 플랜 수 */
  planCount: number;
  /** 완료율 (%) */
  completionRate: number;
  /** 평균 진행률 (%) */
  averageProgress: number;
  /** 총 학습 시간 (분) */
  totalMinutes: number;
  /** 평균 플랜 시간 (분) */
  avgMinutesPerPlan: number;
}

/**
 * 학습 패턴 분석 데이터
 */
export interface LearningPatternData {
  /** 평균 일일 학습 시간 (분) */
  avgDailyMinutes: number;
  /** 최대 일일 학습 시간 (분) */
  maxDailyMinutes: number;
  /** 학습한 날 수 */
  activeDays: number;
  /** 분석 기간 일수 */
  totalDays: number;
  /** 연속 학습 최대 일수 */
  maxStreak: number;
  /** 현재 연속 학습 일수 */
  currentStreak: number;
}

/**
 * 미완료 패턴
 */
export interface IncompletePattern {
  /** 자주 미완료되는 과목 */
  frequentlyIncompleteSubjects: string[];
  /** 자주 미완료되는 시간대 */
  frequentlyIncompleteTimeSlots: string[];
  /** 자주 미완료되는 요일 */
  frequentlyIncompleteDays: string[];
  /** 미완료 주요 원인 (추정) */
  likelyReasons: string[];
}

/**
 * 플랜 최적화 요청
 */
export interface PlanOptimizationRequest {
  student: StudentBasicInfo;
  executionStats: PlanExecutionStats;
  timeSlotPerformance: TimeSlotPerformance[];
  dayOfWeekPerformance: DayOfWeekPerformance[];
  subjectPerformance: SubjectPerformance[];
  learningPattern: LearningPatternData;
  incompletePattern: IncompletePattern;
  /** 분석 기간 (예: "최근 30일") */
  analysisPeriod: string;
  /** 추가 지시사항 */
  additionalInstructions?: string;
}

// ============================================
// 출력 타입
// ============================================

/**
 * 최적화 제안 카테고리
 */
export type OptimizationCategory =
  | "time_allocation"      // 시간 배치 최적화
  | "subject_balance"      // 과목 균형
  | "workload"             // 학습량 조절
  | "rest_pattern"         // 휴식 패턴
  | "review_cycle"         // 복습 주기
  | "motivation"           // 동기 부여
  | "efficiency";          // 효율성

/**
 * 우선순위
 */
export type Priority = "high" | "medium" | "low";

/**
 * 개별 최적화 제안
 */
export interface OptimizationSuggestion {
  /** 제안 ID */
  id: string;
  /** 카테고리 */
  category: OptimizationCategory;
  /** 제안 제목 */
  title: string;
  /** 상세 설명 */
  description: string;
  /** 우선순위 */
  priority: Priority;
  /** 예상 개선 효과 */
  expectedImprovement: string;
  /** 구체적 실행 방안 */
  actionItems: string[];
  /** 관련 데이터 포인트 */
  relatedMetrics?: {
    current: string;
    target: string;
  };
}

/**
 * 강점 분석
 */
export interface StrengthAnalysis {
  /** 강점 영역 */
  area: string;
  /** 설명 */
  description: string;
  /** 관련 수치 */
  metric?: string;
}

/**
 * 약점 분석
 */
export interface WeaknessAnalysis {
  /** 약점 영역 */
  area: string;
  /** 설명 */
  description: string;
  /** 관련 수치 */
  metric?: string;
  /** 개선 방향 */
  improvementDirection: string;
}

/**
 * 플랜 최적화 응답
 */
export interface PlanOptimizationResponse {
  /** 전체 효율성 점수 (0-100) */
  efficiencyScore: number;
  /** 효율성 점수 등급 */
  scoreGrade: "excellent" | "good" | "average" | "needs_improvement" | "poor";
  /** 점수 요약 설명 */
  scoreSummary: string;
  /** 강점 분석 */
  strengths: StrengthAnalysis[];
  /** 약점 분석 */
  weaknesses: WeaknessAnalysis[];
  /** 최적화 제안 목록 */
  suggestions: OptimizationSuggestion[];
  /** 카테고리별 점수 */
  categoryScores: {
    timeAllocation: number;
    subjectBalance: number;
    consistency: number;
    efficiency: number;
    restPattern: number;
  };
  /** 전체 종합 분석 */
  overallAnalysis: string;
  /** 다음 주 추천 포커스 */
  nextWeekFocus: string[];
}

// ============================================
// 시스템 프롬프트
// ============================================

export const PLAN_OPTIMIZATION_SYSTEM_PROMPT = `당신은 한국 대학 입시를 준비하는 학생들을 위한 전문 학습 컨설턴트입니다.
학생의 학습 플랜 실행 데이터를 분석하여 효율성을 평가하고 개선 제안을 제공합니다.

## 핵심 역할

1. **효율성 분석**: 플랜 완료율, 시간대별/요일별 성과, 과목 균형을 종합 분석
2. **강점 발굴**: 학생이 잘 하고 있는 영역을 구체적으로 식별
3. **약점 진단**: 개선이 필요한 영역과 원인을 분석
4. **실행 가능한 제안**: 구체적이고 실현 가능한 개선 방안 제시

## 효율성 점수 기준

| 점수 범위 | 등급 | 기준 |
|----------|------|------|
| 90-100 | excellent | 완료율 90%+, 모든 시간대 균형, 과목 균형 우수 |
| 75-89 | good | 완료율 75%+, 대부분 시간대 양호 |
| 60-74 | average | 완료율 60%+, 일부 개선 필요 |
| 40-59 | needs_improvement | 완료율 40%+, 상당한 개선 필요 |
| 0-39 | poor | 완료율 40% 미만, 전면 재검토 필요 |

## 분석 영역

1. **시간 배치 (time_allocation)**
   - 학생의 집중력이 높은 시간대에 어려운 과목 배치
   - 저녁/밤 시간대 과도한 학습 여부

2. **과목 균형 (subject_balance)**
   - 취약 과목에 충분한 시간 배분
   - 특정 과목 편중 여부

3. **학습량 (workload)**
   - 일일 학습량의 적절성
   - 주말 vs 평일 균형

4. **휴식 패턴 (rest_pattern)**
   - 적절한 휴식 간격
   - 번아웃 위험 징후

5. **복습 주기 (review_cycle)**
   - 에빙하우스 망각 곡선 고려
   - 복습 플랜 비율

6. **효율성 (efficiency)**
   - 완료율 대비 학습 시간
   - 시간 대비 효과

## 출력 형식

반드시 아래 JSON 형식으로만 응답하세요.

\`\`\`json
{
  "efficiencyScore": 75,
  "scoreGrade": "good",
  "scoreSummary": "전반적으로 양호한 학습 패턴을 보이고 있으며, 시간 배치 최적화로 추가 개선 가능",
  "strengths": [
    {
      "area": "아침 학습 습관",
      "description": "오전 시간대 완료율이 95%로 매우 높음",
      "metric": "오전 완료율 95%"
    }
  ],
  "weaknesses": [
    {
      "area": "저녁 시간대 집중력",
      "description": "저녁 8시 이후 플랜 완료율이 40%로 낮음",
      "metric": "저녁 완료율 40%",
      "improvementDirection": "저녁 시간에는 가벼운 복습 위주로 배치"
    }
  ],
  "suggestions": [
    {
      "id": "opt-1",
      "category": "time_allocation",
      "title": "수학 플랜 오전으로 이동",
      "description": "현재 저녁에 배치된 수학 플랜을 오전으로 옮기면 완료율 개선 예상",
      "priority": "high",
      "expectedImprovement": "수학 완료율 20% 향상 예상",
      "actionItems": [
        "수학 플랜을 오전 8-10시로 이동",
        "저녁에는 영어 듣기/읽기로 대체"
      ],
      "relatedMetrics": {
        "current": "수학 완료율 55%",
        "target": "수학 완료율 75%"
      }
    }
  ],
  "categoryScores": {
    "timeAllocation": 65,
    "subjectBalance": 80,
    "consistency": 70,
    "efficiency": 75,
    "restPattern": 85
  },
  "overallAnalysis": "전반적으로 꾸준한 학습 습관을 갖추고 있으나, 시간대별 과목 배치 최적화가 필요합니다...",
  "nextWeekFocus": [
    "수학 오전 집중 학습",
    "저녁 시간 복습 위주 전환",
    "주말 복습 시간 확보"
  ]
}
\`\`\`

## 주의사항

- **구체적인 수치 기반 분석**: 모든 제안은 제공된 데이터에 근거
- **실현 가능한 제안**: 학생이 즉시 실행할 수 있는 수준
- **긍정적 톤 유지**: 약점 지적 시에도 개선 가능성 강조
- **한국어로 응답**: 모든 내용은 한국어로 작성
- **우선순위 명확화**: 가장 효과적인 제안을 high 우선순위로
`;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

function formatExecutionStats(stats: PlanExecutionStats): string {
  return `## 플랜 실행 통계
- 전체 플랜: ${stats.totalPlans}개
- 완료: ${stats.completedPlans}개 (${stats.overallCompletionRate.toFixed(1)}%)
- 미완료: ${stats.incompletePlans}개
- 건너뜀: ${stats.skippedPlans}개
- 평균 진행률: ${stats.averageProgress.toFixed(1)}%`;
}

function formatTimeSlotPerformance(data: TimeSlotPerformance[]): string {
  if (data.length === 0) return "";

  const timeLabels: Record<string, string> = {
    morning: "오전 (6-12시)",
    afternoon: "오후 (12-18시)",
    evening: "저녁 (18-21시)",
    night: "밤 (21시 이후)",
  };

  const lines = data.map((t) => {
    const label = timeLabels[t.timeSlot] || t.timeSlot;
    return `- ${label}: ${t.planCount}개 플랜, 완료율 ${t.completionRate.toFixed(1)}%, 평균 진행률 ${t.averageProgress.toFixed(1)}%`;
  });

  return `## 시간대별 성과\n${lines.join("\n")}`;
}

function formatDayOfWeekPerformance(data: DayOfWeekPerformance[]): string {
  if (data.length === 0) return "";

  const lines = data.map((d) => {
    return `- ${d.dayName}: ${d.planCount}개 플랜, 완료율 ${d.completionRate.toFixed(1)}%, 평균 진행률 ${d.averageProgress.toFixed(1)}%`;
  });

  return `## 요일별 성과\n${lines.join("\n")}`;
}

function formatSubjectPerformance(data: SubjectPerformance[]): string {
  if (data.length === 0) return "";

  const lines = data.map((s) => {
    return `- ${s.subject} (${s.subjectCategory}): ${s.planCount}개 플랜, 완료율 ${s.completionRate.toFixed(1)}%, 총 ${s.totalMinutes}분`;
  });

  return `## 과목별 성과\n${lines.join("\n")}`;
}

function formatLearningPattern(data: LearningPatternData): string {
  return `## 학습 패턴
- 평균 일일 학습: ${data.avgDailyMinutes}분
- 최대 일일 학습: ${data.maxDailyMinutes}분
- 학습 일수: ${data.activeDays}일 / ${data.totalDays}일
- 최대 연속 학습: ${data.maxStreak}일
- 현재 연속 학습: ${data.currentStreak}일`;
}

function formatIncompletePattern(data: IncompletePattern): string {
  const parts: string[] = [];

  if (data.frequentlyIncompleteSubjects.length > 0) {
    parts.push(`- 자주 미완료 과목: ${data.frequentlyIncompleteSubjects.join(", ")}`);
  }
  if (data.frequentlyIncompleteTimeSlots.length > 0) {
    parts.push(`- 자주 미완료 시간대: ${data.frequentlyIncompleteTimeSlots.join(", ")}`);
  }
  if (data.frequentlyIncompleteDays.length > 0) {
    parts.push(`- 자주 미완료 요일: ${data.frequentlyIncompleteDays.join(", ")}`);
  }
  if (data.likelyReasons.length > 0) {
    parts.push(`- 추정 원인: ${data.likelyReasons.join(", ")}`);
  }

  return parts.length > 0 ? `## 미완료 패턴 분석\n${parts.join("\n")}` : "";
}

/**
 * 플랜 최적화 사용자 프롬프트 생성
 */
export function buildPlanOptimizationPrompt(
  request: PlanOptimizationRequest
): string {
  const sections = [
    `## 학생 정보
- 이름: ${request.student.name}
- 학년: ${request.student.grade}학년${
      request.student.targetUniversity
        ? `\n- 목표 대학: ${request.student.targetUniversity}`
        : ""
    }${
      request.student.targetMajor
        ? `\n- 목표 학과: ${request.student.targetMajor}`
        : ""
    }`,
    `## 분석 기간\n${request.analysisPeriod}`,
    formatExecutionStats(request.executionStats),
    formatTimeSlotPerformance(request.timeSlotPerformance),
    formatDayOfWeekPerformance(request.dayOfWeekPerformance),
    formatSubjectPerformance(request.subjectPerformance),
    formatLearningPattern(request.learningPattern),
    formatIncompletePattern(request.incompletePattern),
  ].filter(Boolean);

  let prompt = sections.join("\n\n");

  if (request.additionalInstructions) {
    prompt += `\n\n## 추가 지시사항\n${request.additionalInstructions}`;
  }

  prompt += `

---

위 학습 데이터를 분석하여 플랜 효율성 점수와 개선 제안을 JSON 형식으로 제공해주세요.
강점과 약점을 균형 있게 분석하고, 우선순위가 높은 실행 가능한 제안을 3-5개 제시해주세요.
`;

  return prompt;
}

// ============================================
// 토큰 추정
// ============================================

/**
 * 프롬프트 토큰 수 추정
 */
export function estimatePlanOptimizationTokens(
  request: PlanOptimizationRequest
): { systemTokens: number; userTokens: number; totalTokens: number } {
  const userPrompt = buildPlanOptimizationPrompt(request);

  // 한글 문자 수 계산
  const countKorean = (text: string) =>
    (text.match(/[가-힣]/g) || []).length;

  const estimateTokens = (text: string) => {
    const korean = countKorean(text);
    const other = text.length - korean;
    return Math.ceil(korean * 1.5 + other * 0.25);
  };

  const systemTokens = estimateTokens(PLAN_OPTIMIZATION_SYSTEM_PROMPT);
  const userTokens = estimateTokens(userPrompt);

  return {
    systemTokens,
    userTokens,
    totalTokens: systemTokens + userTokens,
  };
}
