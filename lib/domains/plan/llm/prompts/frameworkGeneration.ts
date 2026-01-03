/**
 * AI Framework 생성 프롬프트
 *
 * 하이브리드 플랜 생성을 위한 경량 프롬프트입니다.
 * AI는 전략적 결정(과목 분류, 우선순위, 시간 힌트)만 제공하고,
 * 정확한 시간 배치는 코드 기반 스케줄러가 처리합니다.
 *
 * 토큰 절약 목표: 기존 플랜 생성 프롬프트 대비 ~30% 절약
 *
 * @module lib/domains/plan/llm/prompts/frameworkGeneration
 */

import type {
  AIFrameworkInput,
  AIFrameworkStudentInfo,
  AIFrameworkScoreInfo,
  AIFrameworkContentInfo,
  AIFrameworkLearningHistory,
  AIFrameworkPeriod,
} from "../types/aiFramework";

// ============================================
// 시스템 프롬프트
// ============================================

/**
 * AI Framework 생성용 시스템 프롬프트
 *
 * 전체 플랜 생성 프롬프트(~8000자)보다 간결한 버전(~5500자)
 * 시간 배치 관련 상세 규칙은 제외됨
 */
export const FRAMEWORK_SYSTEM_PROMPT = `당신은 한국의 대학 입시를 준비하는 학생들을 위한 학습 전략 어드바이저입니다.
학생의 성적, 콘텐츠, 학습 이력을 분석하여 전략적 학습 가이드라인을 생성합니다.

## 역할

- **전략 수립**: 과목별 분류(전략/취약/중립), 우선순위 결정
- **시간 제안**: 과목별 최적 학습 시간대, 권장 학습 시간 힌트
- **콘텐츠 정렬**: 콘텐츠 우선순위 및 긴급도 결정
- **추천사항**: 학습 팁, 경고, 조정 제안

**주의: 구체적인 시간 배치(08:00-09:00 등)는 하지 않습니다. 별도의 스케줄러가 처리합니다.**

## 출력 형식

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.

\`\`\`json
{
  "version": "1.0",
  "generatedAt": "ISO 8601 형식",
  "strategySummary": "전체 전략 요약 (2-3문장)",
  "subjectClassifications": [
    {
      "subjectCategory": "수학",
      "subjectId": "subject-uuid (선택)",
      "classification": "weakness",
      "confidence": 0.85,
      "reasoning": "분류 근거",
      "recommendedWeeklyDays": 5,
      "priorityRank": 1
    }
  ],
  "weeklyStrategies": [
    {
      "weekNumber": 1,
      "theme": "기초 다지기 주간",
      "goals": ["목표1", "목표2"],
      "dailyStrategies": [
        {
          "dayOfWeek": 1,
          "focusType": "intensive",
          "primarySubjects": ["수학"],
          "secondarySubjects": ["영어"],
          "strategyDescription": "아침 수학 집중, 오후 영어 보조",
          "recommendedMinutes": 180
        }
      ]
    }
  ],
  "timeHints": [
    {
      "subjectCategory": "수학",
      "preferredTimeSlot": "morning",
      "optimalDurationMinutes": 60,
      "minDurationMinutes": 30,
      "maxDurationMinutes": 90,
      "reasoning": "집중력 고려"
    }
  ],
  "contentPriority": [
    {
      "contentId": "content-uuid",
      "priorityRank": 1,
      "subjectType": "weakness",
      "orderInSubject": 1,
      "urgency": "high",
      "reasoning": "시험 대비 필수"
    }
  ],
  "recommendations": {
    "studyTips": ["팁1", "팁2"],
    "warnings": ["경고1"],
    "suggestedAdjustments": ["조정1"],
    "focusAreas": ["집중 영역1"],
    "motivationalNotes": ["동기부여 메시지 (선택)"]
  },
  "meta": {
    "confidence": 0.85
  }
}
\`\`\`

## 과목 분류 기준

### classification 결정
| 유형 | 기준 | 권장 주간 학습일 |
|------|------|-----------------|
| strategy | 상위권 가능, 현재 70점 이상 | 2-3일 |
| weakness | 보강 필수, 현재 60점 미만 | 4-6일 |
| neutral | 현상 유지, 60-70점 사이 | 2-3일 |

### priorityRank 결정
1. 취약 과목 중 가장 낮은 점수 → 1순위
2. 전략 과목 중 성장 가능성 높은 순 → 이후 순위
3. 중립 과목 → 마지막 순위

## focusType 기준

| 유형 | 설명 | 권장 시간 |
|------|------|----------|
| intensive | 취약 과목 집중일 | 180분+ |
| balanced | 균형 학습일 | 120-180분 |
| light | 가벼운 학습일 | 60-120분 |
| review | 복습 위주일 | 90-120분 |

## preferredTimeSlot 기준

| 시간대 | 적합 과목 | 이유 |
|--------|----------|------|
| morning | 수학, 과학 (논리) | 아침 집중력 최고 |
| afternoon | 영어, 사회 (암기) | 오후 기억력 양호 |
| evening | 국어, 복습 | 저녁 정리 시간 |

## urgency 결정

| 긴급도 | 기준 |
|--------|------|
| critical | 시험 D-7 이내 과목 |
| high | 취약 과목 또는 D-14 이내 |
| medium | 일반 학습 |
| low | 여유 있는 진도 |

## 신뢰도(confidence) 산출

- 성적 데이터 풍부: +0.1
- 학습 이력 제공: +0.1
- 콘텐츠 정보 명확: +0.05
- 기간이 적절(2주 이상): +0.05
- 기본값: 0.7

## 제약 조건

1. **subjectClassifications**: 제공된 과목만 분류 (최소 1개 이상)
2. **weeklyStrategies**: 최대 4주 분량만 생성
3. **contentPriority**: 제공된 콘텐츠 ID만 사용
4. **timeHints**: 분류된 과목에 대해서만 제공
5. **recommendedWeeklyDays**: 2-7일 범위

## 주의사항

- 모든 ID는 제공된 입력 데이터의 ID만 사용
- confidence는 0.5-1.0 범위
- priorityRank는 1부터 시작하는 자연수
- JSON 외 다른 텍스트 출력 금지
`;

// ============================================
// 사용자 프롬프트 빌드 함수
// ============================================

/**
 * Framework 생성용 사용자 프롬프트 빌드
 */
export function buildFrameworkUserPrompt(input: AIFrameworkInput): string {
  const sections: string[] = [];

  // 학생 정보
  sections.push(formatStudentSection(input.student));

  // 성적 정보
  if (input.scores.length > 0) {
    sections.push(formatScoresSection(input.scores));
  }

  // 콘텐츠 정보
  sections.push(formatContentsSection(input.contents));

  // 학습 이력
  if (input.learningHistory) {
    sections.push(formatLearningHistorySection(input.learningHistory));
  }

  // 기간 정보
  sections.push(formatPeriodSection(input.period));

  // 추가 지시사항
  if (input.additionalInstructions) {
    sections.push(`## 추가 지시사항\n${input.additionalInstructions}`);
  }

  return sections.join("\n\n");
}

function formatStudentSection(student: AIFrameworkStudentInfo): string {
  let content = `## 학생 정보
- 이름: ${student.name}
- 학년: ${student.grade}`;

  if (student.school) {
    content += `\n- 학교: ${student.school}`;
  }

  return content;
}

function formatScoresSection(scores: AIFrameworkScoreInfo[]): string {
  const rows = scores.map((s) => {
    const parts = [s.subject, s.subjectCategory];
    if (s.score !== undefined) parts.push(`${s.score}점`);
    if (s.percentile !== undefined) parts.push(`상위 ${s.percentile}%`);
    if (s.trend) {
      const trendMap = {
        improving: "↑",
        stable: "→",
        declining: "↓",
      };
      parts.push(trendMap[s.trend]);
    }
    return `| ${parts.join(" | ")} |`;
  });

  return `## 성적 정보
| 과목 | 카테고리 | 점수 | 백분위 | 추세 |
|------|---------|------|--------|------|
${rows.join("\n")}`;
}

function formatContentsSection(contents: AIFrameworkContentInfo[]): string {
  const rows = contents.map((c) => {
    const type = c.contentType === "book" ? "📚" : c.contentType === "lecture" ? "🎬" : "📝";
    const difficulty = c.difficulty === "hard" ? "🔴" : c.difficulty === "medium" ? "🟡" : "🟢";
    return `| ${c.id} | ${c.title} | ${c.subject} (${c.subjectCategory}) | ${type} | ${c.estimatedHours}h | ${difficulty} |`;
  });

  return `## 학습 콘텐츠
| ID | 제목 | 과목 | 유형 | 예상시간 | 난이도 |
|----|------|------|------|----------|--------|
${rows.join("\n")}`;
}

function formatLearningHistorySection(history: AIFrameworkLearningHistory): string {
  let content = `## 학습 이력
- 완료율: ${(history.completionRate * 100).toFixed(0)}%
- 일일 평균 학습 시간: ${history.averageDailyMinutes}분`;

  if (history.preferredTimes.length > 0) {
    content += `\n- 선호 시간대: ${history.preferredTimes.join(", ")}`;
  }

  if (history.weakPatterns.length > 0) {
    content += `\n- 취약 패턴: ${history.weakPatterns.join(", ")}`;
  }

  return content;
}

function formatPeriodSection(period: AIFrameworkPeriod): string {
  return `## 학습 기간
- 시작일: ${period.startDate}
- 종료일: ${period.endDate}
- 총 일수: ${period.totalDays}일
- 학습 가능 일수: ${period.studyDays}일`;
}

// ============================================
// 토큰 추정
// ============================================

/**
 * Framework 프롬프트의 토큰 수 추정
 *
 * @returns 예상 토큰 수 (input)
 */
export function estimateFrameworkPromptTokens(input: AIFrameworkInput): number {
  const systemTokens = Math.ceil(FRAMEWORK_SYSTEM_PROMPT.length / 4);
  const userPrompt = buildFrameworkUserPrompt(input);
  const userTokens = Math.ceil(userPrompt.length / 4);

  return {
    system: systemTokens,
    user: userTokens,
    total: systemTokens + userTokens,
  }.total;
}

/**
 * 상세 토큰 추정 결과
 */
export function estimateFrameworkPromptTokensDetailed(input: AIFrameworkInput): {
  system: number;
  user: number;
  total: number;
  estimatedOutputTokens: number;
} {
  const systemTokens = Math.ceil(FRAMEWORK_SYSTEM_PROMPT.length / 4);
  const userPrompt = buildFrameworkUserPrompt(input);
  const userTokens = Math.ceil(userPrompt.length / 4);

  // 출력 토큰 추정: 과목 수 * 150 + 콘텐츠 수 * 50 + 기본 500
  const estimatedOutputTokens =
    input.scores.length * 150 +
    input.contents.length * 50 +
    500;

  return {
    system: systemTokens,
    user: userTokens,
    total: systemTokens + userTokens,
    estimatedOutputTokens,
  };
}

// ============================================
// 응답 파싱
// ============================================

import type { AIFramework, AIFrameworkMeta } from "../types/aiFramework";

/**
 * Framework JSON 응답 파싱
 */
export function parseFrameworkResponse(responseText: string): {
  success: boolean;
  framework?: AIFramework;
  error?: string;
} {
  try {
    // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
    let jsonStr = responseText;

    const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1];
    } else {
      // 순수 JSON 시도
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    // 필수 필드 검증
    if (!parsed.version || parsed.version !== "1.0") {
      return {
        success: false,
        error: "Invalid framework version",
      };
    }

    if (!parsed.subjectClassifications || !Array.isArray(parsed.subjectClassifications)) {
      return {
        success: false,
        error: "Missing subjectClassifications",
      };
    }

    // 기본값 채우기
    const framework: AIFramework = {
      version: "1.0",
      generatedAt: parsed.generatedAt || new Date().toISOString(),
      strategySummary: parsed.strategySummary || "",
      subjectClassifications: parsed.subjectClassifications,
      weeklyStrategies: parsed.weeklyStrategies || [],
      timeHints: parsed.timeHints || [],
      contentPriority: parsed.contentPriority || [],
      recommendations: {
        studyTips: parsed.recommendations?.studyTips || [],
        warnings: parsed.recommendations?.warnings || [],
        suggestedAdjustments: parsed.recommendations?.suggestedAdjustments || [],
        focusAreas: parsed.recommendations?.focusAreas || [],
        motivationalNotes: parsed.recommendations?.motivationalNotes,
      },
      meta: {
        modelId: "",
        tokensUsed: { input: 0, output: 0 },
        confidence: parsed.meta?.confidence || 0.7,
        processingTimeMs: 0,
      },
    };

    return {
      success: true,
      framework,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse framework response",
    };
  }
}

/**
 * Framework 메타데이터 업데이트
 */
export function updateFrameworkMeta(
  framework: AIFramework,
  meta: Partial<AIFrameworkMeta>
): AIFramework {
  return {
    ...framework,
    meta: {
      ...framework.meta,
      ...meta,
    },
  };
}
