/**
 * 콘텐츠 추천 프롬프트
 *
 * Claude API를 사용한 학습 콘텐츠 추천을 위한 프롬프트입니다.
 * 학생의 성적, 학습 이력, 목표를 분석하여 최적의 콘텐츠를 추천합니다.
 *
 * @module contentRecommendation
 */

// ============================================
// 입력 타입
// ============================================

/**
 * 학생 프로필
 */
export interface StudentProfile {
  id: string;
  name: string;
  grade: number;
  school?: string;
  targetUniversity?: string;
  targetMajor?: string;
}

/**
 * 과목별 성적 정보
 */
export interface SubjectScoreInfo {
  subjectId: string;
  subject: string;
  subjectCategory: string;
  latestGrade?: number;
  latestPercentile?: number;
  averageGrade?: number;
  recentTrend?: "improving" | "stable" | "declining";
  riskScore?: number;
  isWeak?: boolean;
}

/**
 * 학습 패턴 정보
 */
export interface LearningPatternInfo {
  preferredStudyTimes?: string[];
  averageDailyMinutes?: number;
  completionRate?: number;
  strongSubjects?: string[];
  weakSubjects?: string[];
}

/**
 * 보유 콘텐츠 정보
 */
export interface OwnedContentInfo {
  id: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: "book" | "lecture";
  difficulty?: string;
  completedPercentage?: number;
}

/**
 * 추천 후보 콘텐츠 (마스터)
 */
export interface ContentCandidate {
  id: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: "book" | "lecture";
  difficulty?: "easy" | "medium" | "hard";
  publisher?: string;
  platform?: string;
  description?: string;
  totalPages?: number;
  totalLectures?: number;
  tags?: string[];
}

/**
 * 콘텐츠 추천 요청
 */
export interface ContentRecommendationRequest {
  student: StudentProfile;
  scores: SubjectScoreInfo[];
  learningPattern?: LearningPatternInfo;
  ownedContents: OwnedContentInfo[];
  candidateContents: ContentCandidate[];
  /** 추천 개수 (기본값: 5) */
  maxRecommendations?: number;
  /** 추천 포커스 */
  focusArea?: "weak_subjects" | "all_subjects" | "exam_prep";
  /** 추가 지시사항 */
  additionalInstructions?: string;
}

// ============================================
// 출력 타입
// ============================================

/**
 * 추천 콘텐츠 결과
 */
export interface RecommendedContentResult {
  contentId: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: "book" | "lecture";
  /** 추천 우선순위 (1 = 가장 높음) */
  priority: number;
  /** 추천 이유 */
  reason: string;
  /** 추천 카테고리 */
  category: "weak_subject" | "strength_enhance" | "review" | "new_skill" | "exam_prep";
  /** 예상 효과 */
  expectedBenefit: string;
  /** 난이도 적합성 (1-5, 5가 가장 적합) */
  difficultyFit: number;
  /** 관련 성적 정보 */
  relatedScore?: {
    currentGrade?: number;
    currentPercentile?: number;
    targetGrade?: number;
  };
}

/**
 * 콘텐츠 추천 응답
 */
export interface ContentRecommendationResponse {
  recommendations: RecommendedContentResult[];
  summary: {
    totalRecommended: number;
    byCategory: Record<string, number>;
    mainFocus: string;
  };
  insights: {
    strengthAreas: string[];
    improvementAreas: string[];
    studyStrategy: string;
  };
}

// ============================================
// 시스템 프롬프트
// ============================================

export const CONTENT_RECOMMENDATION_SYSTEM_PROMPT = `당신은 한국 대학 입시를 준비하는 학생들을 위한 전문 학습 컨설턴트입니다.
학생의 성적, 학습 패턴, 보유 콘텐츠를 분석하여 최적의 학습 콘텐츠를 추천합니다.

## 핵심 원칙

1. **개인화**: 학생의 현재 수준, 목표 대학/학과, 취약점을 고려한 맞춤형 추천
2. **우선순위**: 취약 과목 보강 → 강점 강화 → 새로운 영역 확장 순서
3. **난이도 적합성**: 현재 수준에 맞는 콘텐츠 추천 (너무 쉽거나 어려운 것 제외)
4. **중복 방지**: 이미 보유한 콘텐츠와 유사한 것은 추천하지 않음
5. **균형**: 과목 간 균형을 고려하되, 취약 과목에 더 많은 비중

## 추천 카테고리

- **weak_subject**: 취약 과목 보강 (성적 하락 또는 낮은 등급)
- **strength_enhance**: 강점 강화 (이미 잘하는 과목을 더 발전)
- **review**: 복습/정리 (기존 학습 내용 정리)
- **new_skill**: 새로운 영역 (아직 다루지 않은 분야)
- **exam_prep**: 시험 대비 (모의고사, 기출 문제 등)

## 난이도 판단 기준

| 학생 등급 | 권장 난이도 |
|----------|-----------|
| 1-2등급 | hard (심화) |
| 3-4등급 | medium-hard |
| 5-6등급 | medium |
| 7-9등급 | easy-medium |

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
      "reason": "최근 수학 성적이 3등급 → 4등급으로 하락하여 기초 개념 보강 필요",
      "category": "weak_subject",
      "expectedBenefit": "수학 개념 정리를 통해 3등급 회복 가능",
      "difficultyFit": 4,
      "relatedScore": {
        "currentGrade": 4,
        "currentPercentile": 55,
        "targetGrade": 3
      }
    }
  ],
  "summary": {
    "totalRecommended": 5,
    "byCategory": {
      "weak_subject": 2,
      "strength_enhance": 1,
      "exam_prep": 2
    },
    "mainFocus": "수학 취약 과목 보강 및 영어 강점 강화"
  },
  "insights": {
    "strengthAreas": ["영어 독해", "국어 문학"],
    "improvementAreas": ["수학 미적분", "과학탐구"],
    "studyStrategy": "수학에 일일 학습 시간의 40%를 배분하고, 영어는 현재 수준 유지에 집중"
  }
}
\`\`\`

## 주의사항

- **contentId는 반드시 제공된 후보 콘텐츠(candidateContents)의 ID만 사용**
- 이미 보유한 콘텐츠(ownedContents)는 추천하지 않음
- 추천 개수는 maxRecommendations를 초과하지 않음
- 각 추천에는 구체적인 이유와 기대 효과를 명시
- 한국어로 응답
`;

// ============================================
// 사용자 프롬프트 빌더
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

    if (s.isWeak) parts.push("⚠️ 취약");
    if (s.recentTrend) {
      const trendEmoji = {
        improving: "📈 상승",
        stable: "➡️ 유지",
        declining: "📉 하락",
      }[s.recentTrend];
      parts.push(trendEmoji);
    }

    return parts.join(" | ");
  });

  return `## 성적 현황\n${scoreLines.join("\n")}`;
}

function formatLearningPattern(pattern: LearningPatternInfo | undefined): string {
  if (!pattern) return "";

  const parts: string[] = [];

  if (pattern.averageDailyMinutes) {
    parts.push(`- 평균 일일 학습 시간: ${pattern.averageDailyMinutes}분`);
  }
  if (pattern.completionRate !== undefined) {
    parts.push(`- 플랜 완료율: ${pattern.completionRate}%`);
  }
  if (pattern.preferredStudyTimes?.length) {
    const timeLabels: Record<string, string> = {
      morning: "아침",
      afternoon: "오후",
      evening: "저녁",
      night: "밤",
    };
    const times = pattern.preferredStudyTimes
      .map((t) => timeLabels[t] || t)
      .join(", ");
    parts.push(`- 선호 학습 시간대: ${times}`);
  }
  if (pattern.strongSubjects?.length) {
    parts.push(`- 강점 과목: ${pattern.strongSubjects.join(", ")}`);
  }
  if (pattern.weakSubjects?.length) {
    parts.push(`- 취약 과목: ${pattern.weakSubjects.join(", ")}`);
  }

  return parts.length > 0 ? `## 학습 패턴\n${parts.join("\n")}` : "";
}

function formatOwnedContents(contents: OwnedContentInfo[]): string {
  if (contents.length === 0) return "## 보유 콘텐츠\n없음";

  const contentLines = contents.map((c) => {
    const typeLabel = c.contentType === "book" ? "📖" : "🎬";
    const progress = c.completedPercentage !== undefined
      ? ` (진행률: ${c.completedPercentage}%)`
      : "";
    return `- ${typeLabel} [${c.subjectCategory}] ${c.title}${progress}`;
  });

  return `## 보유 콘텐츠 (${contents.length}개)\n${contentLines.join("\n")}`;
}

function formatCandidateContents(contents: ContentCandidate[]): string {
  if (contents.length === 0) return "";

  const contentLines = contents.map((c) => {
    const typeLabel = c.contentType === "book" ? "📖" : "🎬";
    const diffLabel = c.difficulty
      ? ` [${c.difficulty === "easy" ? "🟢" : c.difficulty === "medium" ? "🟡" : "🔴"}]`
      : "";
    const extra = c.contentType === "book" && c.totalPages
      ? ` (${c.totalPages}p)`
      : c.contentType === "lecture" && c.totalLectures
        ? ` (${c.totalLectures}강)`
        : "";

    return `- [${c.id}] ${typeLabel} ${c.subjectCategory}/${c.subject}: ${c.title}${diffLabel}${extra}`;
  });

  return `## 추천 후보 콘텐츠 (${contents.length}개)\n${contentLines.join("\n")}`;
}

/**
 * 콘텐츠 추천 사용자 프롬프트 생성
 */
export function buildContentRecommendationPrompt(
  request: ContentRecommendationRequest
): string {
  const sections = [
    formatStudentProfile(request.student),
    formatScores(request.scores),
    formatLearningPattern(request.learningPattern),
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

  prompt += `

## 추천 설정
- 추천 개수: 최대 ${maxRecs}개
- 추천 포커스: ${focus}
`;

  if (request.additionalInstructions) {
    prompt += `\n## 추가 지시사항\n${request.additionalInstructions}`;
  }

  prompt += `

---

위 정보를 바탕으로 학생에게 가장 적합한 학습 콘텐츠를 JSON 형식으로 추천해주세요.
각 추천에는 구체적인 이유와 기대 효과를 포함하고, 현재 성적 상황과 연결지어 설명해주세요.
`;

  return prompt;
}

// ============================================
// 토큰 추정
// ============================================

/**
 * 프롬프트 토큰 수 추정
 */
export function estimateContentRecommendationTokens(
  request: ContentRecommendationRequest
): { systemTokens: number; userTokens: number; totalTokens: number } {
  const userPrompt = buildContentRecommendationPrompt(request);

  // 한글 문자 수 계산
  const countKorean = (text: string) =>
    (text.match(/[가-힣]/g) || []).length;

  const estimateTokens = (text: string) => {
    const korean = countKorean(text);
    const other = text.length - korean;
    return Math.ceil(korean * 1.5 + other * 0.25);
  };

  const systemTokens = estimateTokens(CONTENT_RECOMMENDATION_SYSTEM_PROMPT);
  const userTokens = estimateTokens(userPrompt);

  return {
    systemTokens,
    userTokens,
    totalTokens: systemTokens + userTokens,
  };
}
