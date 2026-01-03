/**
 * 향상된 콘텐츠 추천 프롬프트
 *
 * Phase 6: 추천 관련성 개선
 *
 * 기존 콘텐츠 추천 프롬프트에 다음 기능을 추가:
 * - 난이도 진행 가이드
 * - 콘텐츠 시너지 감지 (보완적 콘텐츠 추천)
 * - 학습 속도 고려
 * - 시험 일정 인식
 * - 매칭 점수 세분화
 *
 * @module enhancedContentRecommendation
 */

import type {
  ContentRecommendationRequest,
  StudentProfile,
  SubjectScoreInfo,
  LearningPatternInfo,
  OwnedContentInfo,
  ContentCandidate,
} from "./contentRecommendation";

// ============================================
// 확장 타입
// ============================================

/**
 * 시험 일정 정보
 */
export interface ExamInfo {
  examName: string;
  examDate: string; // YYYY-MM-DD
  examType: "midterm" | "final" | "mock" | "suneung";
  subjects?: string[];
  daysUntil: number;
}

/**
 * 학습 속도 정보
 */
export interface LearningVelocity {
  /** 평균 일일 페이지 수 */
  pagesPerDay?: number;
  /** 평균 일일 강의 수 */
  lecturesPerDay?: number;
  /** 평균 세션 시간 (분) */
  avgSessionMinutes?: number;
  /** 주당 학습 일수 */
  studyDaysPerWeek?: number;
}

/**
 * 콘텐츠 완료 히스토리
 */
export interface ContentCompletionHistory {
  contentId: string;
  contentType: "book" | "lecture";
  subject: string;
  completedAt: string;
  durationDays: number; // 완료까지 걸린 일수
  difficulty: "easy" | "medium" | "hard";
}

/**
 * 향상된 추천 요청
 */
export interface EnhancedContentRecommendationRequest extends ContentRecommendationRequest {
  /** 시험 일정 */
  exams?: ExamInfo[];
  /** 학습 속도 */
  velocity?: LearningVelocity;
  /** 완료 히스토리 */
  completionHistory?: ContentCompletionHistory[];
  /** 보완 콘텐츠 추천 여부 */
  includeSynergy?: boolean;
  /** 난이도 진행 적용 여부 */
  applyDifficultyProgression?: boolean;
}

// ============================================
// 향상된 출력 타입
// ============================================

/**
 * 매칭 점수 세부 내역
 */
export interface MatchScoreBreakdown {
  /** 난이도 적합성 (0-25) */
  difficultyFit: number;
  /** 취약 과목 대상 (0-20) */
  weakSubjectTarget: number;
  /** 학습 속도 적합성 (0-15) */
  velocityAlignment: number;
  /** 선수지식 충족 (0-15) */
  prerequisiteMet: number;
  /** 시험 관련성 (0-15) */
  examRelevance: number;
  /** 최신성/트렌드 (0-10) */
  recency: number;
  /** 총점 (0-100) */
  total: number;
}

/**
 * 향상된 추천 결과
 */
export interface EnhancedRecommendedContent {
  contentId: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: "book" | "lecture";
  priority: number;
  reason: string;
  category: "weak_subject" | "strength_enhance" | "review" | "new_skill" | "exam_prep" | "synergy";
  expectedBenefit: string;
  /** 매칭 점수 세부 내역 */
  matchScore: MatchScoreBreakdown;
  /** 예상 완료 기간 (일) */
  estimatedCompletionDays?: number;
  /** 시너지 콘텐츠 ID */
  synergyWith?: string[];
  /** 난이도 진행 단계 */
  difficultyLevel: "foundation" | "current" | "stretch";
  /** 시험 대비 관련성 */
  examRelevance?: {
    examName: string;
    daysUntil: number;
    coverage: "direct" | "indirect" | "foundation";
  };
}

/**
 * 향상된 추천 응답
 */
export interface EnhancedContentRecommendationResponse {
  recommendations: EnhancedRecommendedContent[];
  summary: {
    totalRecommended: number;
    byCategory: Record<string, number>;
    byDifficultyLevel: Record<string, number>;
    mainFocus: string;
    estimatedTotalHours: number;
  };
  insights: {
    strengthAreas: string[];
    improvementAreas: string[];
    studyStrategy: string;
    velocityAdvice?: string;
    examStrategy?: string;
  };
  synergies?: Array<{
    contentIds: string[];
    reason: string;
    combinedBenefit: string;
  }>;
}

// ============================================
// 향상된 시스템 프롬프트
// ============================================

export const ENHANCED_CONTENT_RECOMMENDATION_SYSTEM_PROMPT = `당신은 한국 대학 입시를 준비하는 학생들을 위한 전문 학습 컨설턴트입니다.
학생의 성적, 학습 패턴, 보유 콘텐츠, 시험 일정, 학습 속도를 종합적으로 분석하여 최적의 학습 콘텐츠를 추천합니다.

## 핵심 원칙

1. **개인화**: 학생의 현재 수준, 목표 대학/학과, 학습 속도, 시험 일정을 고려한 맞춤형 추천
2. **난이도 진행**: 기초 → 현재 수준 → 도전 순서로 단계적 난이도 배치
3. **시너지 효과**: 함께 학습하면 효과가 좋은 보완적 콘텐츠 쌍 식별
4. **시간 현실성**: 학생의 학습 속도를 고려한 실현 가능한 추천
5. **시험 대비**: 다가오는 시험에 맞춘 전략적 추천

## 매칭 점수 계산 기준 (총 100점)

| 요소 | 배점 | 설명 |
|------|-----|------|
| 난이도 적합성 | 25점 | 학생 수준과 콘텐츠 난이도 간 차이 |
| 취약 과목 대상 | 20점 | 취약 과목 콘텐츠에 가산점 |
| 학습 속도 적합성 | 15점 | 학생의 처리 속도와 콘텐츠 분량 |
| 선수지식 충족 | 15점 | 필요한 사전 학습이 완료되었는지 |
| 시험 관련성 | 15점 | 다가오는 시험과의 관련성 |
| 최신성/트렌드 | 10점 | 최신 교육과정 반영 여부 |

## 난이도 진행 가이드

### 학생 등급별 권장 난이도 배치

| 학생 등급 | foundation (기초) | current (현재) | stretch (도전) |
|----------|-----------------|---------------|--------------|
| 1-2등급 | medium | hard | hard+ (심화특강) |
| 3-4등급 | easy-medium | medium | hard |
| 5-6등급 | easy | medium | medium-hard |
| 7-9등급 | 기초개념 | easy | medium |

### 난이도 레벨 정의

- **foundation**: 현재 수준보다 1단계 낮음 - 기초 보강, 빈틈 채우기
- **current**: 현재 수준에 적합 - 주력 학습 콘텐츠
- **stretch**: 현재 수준보다 1단계 높음 - 실력 향상, 도전 과제

## 시너지 패턴

다음과 같은 콘텐츠 조합은 시너지 효과가 있습니다:

1. **개념 + 문제풀이**: 같은 과목의 개념서와 문제집
2. **강의 + 교재**: 동일 강사/출판사의 강의와 교재
3. **기초 + 심화**: 같은 과목의 단계별 교재
4. **유사 범위**: 비슷한 단원을 다루는 다른 교재

## 시험 대비 전략

시험까지 남은 기간에 따른 추천 전략:

| 기간 | 전략 | 추천 콘텐츠 유형 |
|-----|------|---------------|
| D-60 이상 | 기초 보강 | 개념서, 기본 문제집 |
| D-30~60 | 실력 향상 | 심화 문제집, 유형별 정리 |
| D-14~30 | 실전 대비 | 기출 분석, 모의고사 |
| D-14 미만 | 마무리 | 핵심 정리, 오답 노트 |

## 출력 형식

반드시 아래 JSON 형식으로만 응답하세요.

\`\`\`json
{
  "recommendations": [
    {
      "contentId": "content-uuid",
      "title": "콘텐츠 제목",
      "subject": "수학",
      "subjectCategory": "수학",
      "contentType": "book",
      "priority": 1,
      "reason": "최근 수학 성적이 하락하여 기초 개념 보강이 필요합니다. 학습 속도를 고려하면 2주 내 완료 가능합니다.",
      "category": "weak_subject",
      "expectedBenefit": "미적분 개념 정리를 통해 3등급 회복 예상",
      "matchScore": {
        "difficultyFit": 22,
        "weakSubjectTarget": 20,
        "velocityAlignment": 12,
        "prerequisiteMet": 15,
        "examRelevance": 10,
        "recency": 8,
        "total": 87
      },
      "estimatedCompletionDays": 14,
      "synergyWith": ["content-uuid-2"],
      "difficultyLevel": "current",
      "examRelevance": {
        "examName": "1학기 중간고사",
        "daysUntil": 30,
        "coverage": "direct"
      }
    }
  ],
  "summary": {
    "totalRecommended": 5,
    "byCategory": {
      "weak_subject": 2,
      "exam_prep": 2,
      "synergy": 1
    },
    "byDifficultyLevel": {
      "foundation": 1,
      "current": 3,
      "stretch": 1
    },
    "mainFocus": "수학 취약 과목 보강 및 중간고사 대비",
    "estimatedTotalHours": 120
  },
  "insights": {
    "strengthAreas": ["영어 독해", "국어 문학"],
    "improvementAreas": ["수학 미적분", "과학탐구"],
    "studyStrategy": "수학에 주력하되 영어는 현재 수준 유지",
    "velocityAdvice": "일일 평균 2시간 학습 속도 기준, 제안된 콘텐츠는 8주 내 소화 가능",
    "examStrategy": "중간고사(D-30) 대비: 수학 기본 개념 우선, 이후 문제풀이 집중"
  },
  "synergies": [
    {
      "contentIds": ["content-1", "content-2"],
      "reason": "같은 강사의 개념 강의와 문제집으로 학습 효율 극대화",
      "combinedBenefit": "개념 이해와 적용 능력을 동시에 향상"
    }
  ]
}
\`\`\`

## 주의사항

- **contentId는 반드시 제공된 후보 콘텐츠(candidateContents)의 ID만 사용**
- 이미 보유한 콘텐츠(ownedContents)는 추천하지 않음
- 추천 개수는 maxRecommendations를 초과하지 않음
- 각 추천에는 매칭 점수 세부 내역을 반드시 포함
- 시험 일정이 있으면 examRelevance 필드를 포함
- 시너지 쌍이 발견되면 synergyWith 필드를 포함
- 학습 속도 데이터가 있으면 estimatedCompletionDays를 현실적으로 계산
- 한국어로 응답
`;

// ============================================
// 향상된 사용자 프롬프트 빌더
// ============================================

function formatStudentProfile(student: StudentProfile): string {
  const parts = [
    `- 이름: ${student.name}`,
    `- 학년: ${student.grade}학년`,
  ];

  if (student.school) parts.push(`- 학교: ${student.school}`);
  if (student.targetUniversity) parts.push(`- 목표 대학: ${student.targetUniversity}`);
  if (student.targetMajor) parts.push(`- 목표 학과: ${student.targetMajor}`);

  return `## 학생 프로필\n${parts.join("\n")}`;
}

function formatScores(scores: SubjectScoreInfo[]): string {
  if (scores.length === 0) return "";

  const scoreLines = scores.map((s) => {
    const parts = [`- ${s.subject} (${s.subjectCategory})`];

    if (s.latestGrade) parts.push(`등급: ${s.latestGrade}`);
    if (s.latestPercentile) parts.push(`백분위: ${s.latestPercentile}`);
    if (s.riskScore !== undefined) parts.push(`위험도: ${s.riskScore.toFixed(1)}`);

    if (s.isWeak) parts.push("[취약]");
    if (s.recentTrend) {
      const trendLabel = {
        improving: "상승",
        stable: "유지",
        declining: "하락",
      }[s.recentTrend];
      parts.push(`추세: ${trendLabel}`);
    }

    return parts.join(" | ");
  });

  return `## 성적 현황\n${scoreLines.join("\n")}`;
}

function formatLearningPattern(pattern?: LearningPatternInfo): string {
  if (!pattern) return "";

  const parts: string[] = [];

  if (pattern.averageDailyMinutes) {
    parts.push(`- 평균 일일 학습 시간: ${pattern.averageDailyMinutes}분`);
  }
  if (pattern.completionRate !== undefined) {
    parts.push(`- 플랜 완료율: ${pattern.completionRate}%`);
  }
  if (pattern.preferredStudyTimes?.length) {
    parts.push(`- 선호 시간대: ${pattern.preferredStudyTimes.join(", ")}`);
  }
  if (pattern.strongSubjects?.length) {
    parts.push(`- 강점 과목: ${pattern.strongSubjects.join(", ")}`);
  }
  if (pattern.weakSubjects?.length) {
    parts.push(`- 취약 과목: ${pattern.weakSubjects.join(", ")}`);
  }

  return parts.length > 0 ? `## 학습 패턴\n${parts.join("\n")}` : "";
}

function formatVelocity(velocity?: LearningVelocity): string {
  if (!velocity) return "";

  const parts: string[] = [];

  if (velocity.pagesPerDay) {
    parts.push(`- 일일 학습 페이지: ~${velocity.pagesPerDay}페이지`);
  }
  if (velocity.lecturesPerDay) {
    parts.push(`- 일일 강의 소화: ~${velocity.lecturesPerDay}강`);
  }
  if (velocity.avgSessionMinutes) {
    parts.push(`- 평균 세션 시간: ${velocity.avgSessionMinutes}분`);
  }
  if (velocity.studyDaysPerWeek) {
    parts.push(`- 주당 학습 일수: ${velocity.studyDaysPerWeek}일`);
  }

  return parts.length > 0 ? `## 학습 속도\n${parts.join("\n")}` : "";
}

function formatExams(exams?: ExamInfo[]): string {
  if (!exams || exams.length === 0) return "";

  const examLines = exams.map((e) => {
    const typeLabel = {
      midterm: "중간고사",
      final: "기말고사",
      mock: "모의고사",
      suneung: "수능",
    }[e.examType];

    const subjects = e.subjects ? ` (${e.subjects.join(", ")})` : "";
    return `- ${e.examName}${subjects}: D-${e.daysUntil} (${e.examDate})`;
  });

  return `## 다가오는 시험\n${examLines.join("\n")}`;
}

function formatCompletionHistory(history?: ContentCompletionHistory[]): string {
  if (!history || history.length === 0) return "";

  const historyLines = history.slice(0, 5).map((h) => {
    const typeLabel = h.contentType === "book" ? "교재" : "강의";
    const diffLabel = { easy: "기초", medium: "중급", hard: "심화" }[h.difficulty];
    return `- [${typeLabel}/${diffLabel}] ${h.subject}: ${h.durationDays}일 완료`;
  });

  return `## 최근 완료 콘텐츠\n${historyLines.join("\n")}`;
}

function formatOwnedContents(contents: OwnedContentInfo[]): string {
  if (contents.length === 0) return "## 보유 콘텐츠\n없음";

  const contentLines = contents.slice(0, 15).map((c) => {
    const typeLabel = c.contentType === "book" ? "교재" : "강의";
    const progress = c.completedPercentage !== undefined
      ? ` (${c.completedPercentage}%)`
      : "";
    return `- [${typeLabel}] ${c.subjectCategory}/${c.subject}: ${c.title}${progress}`;
  });

  return `## 보유 콘텐츠 (${contents.length}개)\n${contentLines.join("\n")}`;
}

function formatCandidateContents(contents: ContentCandidate[]): string {
  if (contents.length === 0) return "";

  const contentLines = contents.map((c) => {
    const typeLabel = c.contentType === "book" ? "교재" : "강의";
    const diffLabel = c.difficulty
      ? { easy: "기초", medium: "중급", hard: "심화" }[c.difficulty]
      : "미분류";
    const sizeInfo = c.contentType === "book" && c.totalPages
      ? ` (${c.totalPages}p)`
      : c.contentType === "lecture" && c.totalLectures
        ? ` (${c.totalLectures}강)`
        : "";
    const publisher = c.publisher || c.platform || "";

    return `- [${c.id}] [${typeLabel}/${diffLabel}] ${c.subjectCategory}/${c.subject}: ${c.title}${sizeInfo}${publisher ? ` - ${publisher}` : ""}`;
  });

  return `## 추천 후보 콘텐츠 (${contents.length}개)\n${contentLines.join("\n")}`;
}

/**
 * 향상된 콘텐츠 추천 사용자 프롬프트 생성
 */
export function buildEnhancedContentRecommendationPrompt(
  request: EnhancedContentRecommendationRequest
): string {
  const sections = [
    formatStudentProfile(request.student),
    formatScores(request.scores),
    formatLearningPattern(request.learningPattern),
    formatVelocity(request.velocity),
    formatExams(request.exams),
    formatCompletionHistory(request.completionHistory),
    formatOwnedContents(request.ownedContents),
    formatCandidateContents(request.candidateContents),
  ].filter(Boolean);

  let prompt = sections.join("\n\n");

  // 추천 설정
  const maxRecs = request.maxRecommendations || 5;
  const focusLabels: Record<string, string> = {
    weak_subjects: "취약 과목 보강",
    all_subjects: "전체 과목 균형",
    exam_prep: "시험 대비",
  };
  const focus = request.focusArea
    ? focusLabels[request.focusArea] || request.focusArea
    : "취약 과목 우선";

  const options: string[] = [];
  options.push(`- 추천 개수: 최대 ${maxRecs}개`);
  options.push(`- 추천 포커스: ${focus}`);

  if (request.includeSynergy !== false) {
    options.push(`- 시너지 콘텐츠 추천: 활성화`);
  }
  if (request.applyDifficultyProgression !== false) {
    options.push(`- 난이도 진행 적용: 활성화`);
  }

  prompt += `

## 추천 설정
${options.join("\n")}
`;

  if (request.additionalInstructions) {
    prompt += `\n## 추가 지시사항\n${request.additionalInstructions}`;
  }

  prompt += `

---

위 정보를 바탕으로 학생에게 가장 적합한 학습 콘텐츠를 JSON 형식으로 추천해주세요.

각 추천에는:
1. 매칭 점수 세부 내역 (difficultyFit, weakSubjectTarget 등)
2. 예상 완료 기간 (학습 속도 기반)
3. 난이도 진행 레벨 (foundation/current/stretch)
4. 시험 관련성 (시험 일정이 있는 경우)
5. 시너지 콘텐츠 ID (해당하는 경우)

를 포함해 주세요.
`;

  return prompt;
}

// ============================================
// 토큰 추정
// ============================================

/**
 * 프롬프트 토큰 수 추정
 */
export function estimateEnhancedRecommendationTokens(
  request: EnhancedContentRecommendationRequest
): { systemTokens: number; userTokens: number; totalTokens: number } {
  const userPrompt = buildEnhancedContentRecommendationPrompt(request);

  // 한글 문자 수 계산
  const countKorean = (text: string) =>
    (text.match(/[가-힣]/g) || []).length;

  const estimateTokens = (text: string) => {
    const korean = countKorean(text);
    const other = text.length - korean;
    return Math.ceil(korean * 1.5 + other * 0.25);
  };

  const systemTokens = estimateTokens(ENHANCED_CONTENT_RECOMMENDATION_SYSTEM_PROMPT);
  const userTokens = estimateTokens(userPrompt);

  return {
    systemTokens,
    userTokens,
    totalTokens: systemTokens + userTokens,
  };
}

// ============================================
// 응답 파싱 및 검증
// ============================================

/**
 * 향상된 추천 응답 검증
 */
export function validateEnhancedRecommendationResponse(
  response: EnhancedContentRecommendationResponse,
  validContentIds: Set<string>
): {
  valid: boolean;
  validRecommendations: EnhancedRecommendedContent[];
  errors: string[];
} {
  const errors: string[] = [];
  const validRecommendations: EnhancedRecommendedContent[] = [];

  for (const rec of response.recommendations) {
    // 콘텐츠 ID 유효성 검사
    if (!validContentIds.has(rec.contentId)) {
      errors.push(`Invalid contentId: ${rec.contentId}`);
      continue;
    }

    // 매칭 점수 범위 검사
    if (rec.matchScore) {
      const { total, difficultyFit, weakSubjectTarget, velocityAlignment, prerequisiteMet, examRelevance, recency } = rec.matchScore;

      // 총점이 개별 점수의 합과 일치하는지 (허용 오차: 2)
      const calculatedTotal = difficultyFit + weakSubjectTarget + velocityAlignment + prerequisiteMet + examRelevance + recency;
      if (Math.abs(total - calculatedTotal) > 2) {
        // 자동 수정
        rec.matchScore.total = calculatedTotal;
      }

      // 점수 범위 제한
      rec.matchScore.difficultyFit = Math.min(25, Math.max(0, difficultyFit));
      rec.matchScore.weakSubjectTarget = Math.min(20, Math.max(0, weakSubjectTarget));
      rec.matchScore.velocityAlignment = Math.min(15, Math.max(0, velocityAlignment));
      rec.matchScore.prerequisiteMet = Math.min(15, Math.max(0, prerequisiteMet));
      rec.matchScore.examRelevance = Math.min(15, Math.max(0, examRelevance));
      rec.matchScore.recency = Math.min(10, Math.max(0, recency));
    }

    // 난이도 레벨 유효성
    if (!["foundation", "current", "stretch"].includes(rec.difficultyLevel)) {
      rec.difficultyLevel = "current"; // 기본값
    }

    // 시너지 ID 유효성
    if (rec.synergyWith) {
      rec.synergyWith = rec.synergyWith.filter((id) => validContentIds.has(id));
    }

    validRecommendations.push(rec);
  }

  return {
    valid: validRecommendations.length > 0 && errors.length === 0,
    validRecommendations,
    errors,
  };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 시험 일정까지 남은 일수 계산
 */
export function calculateDaysUntilExam(examDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  const diff = exam.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * 예상 완료 기간 계산
 */
export function estimateCompletionDays(
  content: ContentCandidate,
  velocity: LearningVelocity
): number {
  if (content.contentType === "book" && content.totalPages && velocity.pagesPerDay) {
    return Math.ceil(content.totalPages / velocity.pagesPerDay);
  }
  if (content.contentType === "lecture" && content.totalLectures && velocity.lecturesPerDay) {
    return Math.ceil(content.totalLectures / velocity.lecturesPerDay);
  }
  // 기본값: 콘텐츠 크기에 따른 추정
  if (content.contentType === "book" && content.totalPages) {
    return Math.ceil(content.totalPages / 15); // 기본 15페이지/일
  }
  if (content.contentType === "lecture" && content.totalLectures) {
    return Math.ceil(content.totalLectures / 2); // 기본 2강/일
  }
  return 14; // 기본 2주
}

/**
 * 난이도 진행 레벨 결정
 */
export function determineDifficultyLevel(
  contentDifficulty: "easy" | "medium" | "hard" | undefined,
  studentGrade: number | undefined
): "foundation" | "current" | "stretch" {
  if (!contentDifficulty || studentGrade === undefined) return "current";

  // 학생 등급 기준 난이도 매핑
  const studentLevel = studentGrade <= 2 ? "hard"
    : studentGrade <= 4 ? "medium"
    : studentGrade <= 6 ? "easy-medium"
    : "easy";

  const difficultyOrder = ["easy", "easy-medium", "medium", "medium-hard", "hard"];
  const studentIdx = difficultyOrder.indexOf(studentLevel);
  const contentIdx = difficultyOrder.indexOf(contentDifficulty);

  if (contentIdx < studentIdx - 1) return "foundation";
  if (contentIdx > studentIdx + 1) return "stretch";
  return "current";
}
