/**
 * 부분 재생성 프롬프트
 *
 * 기존 플랜의 특정 부분만 재생성하는 프롬프트를 구성합니다.
 */

import type { GeneratedPlanItem, DailyPlanGroup } from "../types";

// ============================================
// 시스템 프롬프트
// ============================================

export const PARTIAL_REGENERATION_SYSTEM_PROMPT = `당신은 한국의 대학 입시를 준비하는 학생들을 위한 전문 학습 플래너입니다.
기존 학습 계획의 일부분을 수정하거나 재생성하는 역할을 합니다.

## 핵심 원칙

1. **일관성 유지**: 기존 계획과의 일관성을 유지하면서 수정
2. **맥락 고려**: 전후 일정을 고려하여 자연스러운 흐름 유지
3. **사용자 피드백 반영**: 사용자의 요청사항을 최대한 반영
4. **균형 유지**: 수정된 부분이 전체 계획의 균형을 해치지 않도록 조정

## 출력 형식

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.

\`\`\`json
{
  "regeneratedPlans": [
    {
      "date": "YYYY-MM-DD",
      "dayOfWeek": 0,
      "slotId": "slot-1",
      "startTime": "08:00",
      "endTime": "08:50",
      "contentId": "content-uuid",
      "contentTitle": "콘텐츠 제목",
      "subject": "수학",
      "subjectCategory": "수학 가형",
      "rangeStart": 1,
      "rangeEnd": 20,
      "rangeDisplay": "p.1-20",
      "estimatedMinutes": 50,
      "isReview": false,
      "notes": "수정 이유 또는 학습 팁",
      "priority": "high"
    }
  ],
  "explanation": "수정된 내용에 대한 설명",
  "affectedDates": ["YYYY-MM-DD"],
  "recommendations": {
    "adjustmentNotes": ["조정된 부분에 대한 안내"],
    "warnings": ["주의사항"]
  }
}
\`\`\`

## 주의사항

- 요청된 범위 외의 플랜은 수정하지 마세요
- 기존 플랜과 충돌하지 않도록 시간대를 조정하세요
- 전체 학습량이 급격히 변하지 않도록 조절하세요
`;

// ============================================
// 재생성 범위 타입
// ============================================

export interface RegenerateScope {
  type: "date" | "dateRange" | "subject" | "content";
  dates?: string[];
  dateRange?: { start: string; end: string };
  subjects?: string[];
  contentIds?: string[];
}

// ============================================
// 프롬프트 빌더
// ============================================

export interface PartialRegenerationPromptInput {
  /** 기존 플랜 */
  existingPlans: GeneratedPlanItem[];
  /** 재생성 범위 */
  scope: RegenerateScope;
  /** 사용자 피드백/요청 */
  feedback?: string;
  /** 기존 플랜 유지 여부 */
  keepExisting?: boolean;
  /** 사용 가능한 콘텐츠 ID 목록 */
  availableContentIds?: string[];
  /** 일일 학습 시간 (분) */
  dailyStudyMinutes?: number;
}

export function buildPartialRegenerationPrompt(
  input: PartialRegenerationPromptInput
): string {
  const sections: string[] = [];

  // 1. 재생성 범위 설명
  sections.push(formatRegenerateScope(input.scope));

  // 2. 기존 플랜 (관련 부분만)
  const relevantPlans = filterRelevantPlans(input.existingPlans, input.scope);
  if (relevantPlans.length > 0) {
    sections.push(formatExistingPlans(relevantPlans, input.keepExisting));
  }

  // 3. 사용자 피드백
  if (input.feedback) {
    sections.push(`## 사용자 요청사항\n\n${input.feedback}`);
  }

  // 4. 제약조건
  sections.push(formatConstraints(input));

  return sections.join("\n\n");
}

// ============================================
// 포맷팅 헬퍼 함수
// ============================================

function formatRegenerateScope(scope: RegenerateScope): string {
  let description = "## 재생성 범위\n\n";

  switch (scope.type) {
    case "date":
      description += `**특정 날짜 재생성**\n`;
      description += `- 대상 날짜: ${scope.dates?.join(", ") || "없음"}\n`;
      break;

    case "dateRange":
      description += `**기간 재생성**\n`;
      description += `- 시작: ${scope.dateRange?.start || "없음"}\n`;
      description += `- 종료: ${scope.dateRange?.end || "없음"}\n`;
      break;

    case "subject":
      description += `**특정 과목 재생성**\n`;
      description += `- 대상 과목: ${scope.subjects?.join(", ") || "없음"}\n`;
      break;

    case "content":
      description += `**특정 콘텐츠 재생성**\n`;
      description += `- 대상 콘텐츠 ID: ${scope.contentIds?.join(", ") || "없음"}\n`;
      break;
  }

  return description;
}

function filterRelevantPlans(
  plans: GeneratedPlanItem[],
  scope: RegenerateScope
): GeneratedPlanItem[] {
  switch (scope.type) {
    case "date":
      return plans.filter((p) => scope.dates?.includes(p.date));

    case "dateRange":
      if (!scope.dateRange) return [];
      return plans.filter(
        (p) =>
          p.date >= scope.dateRange!.start && p.date <= scope.dateRange!.end
      );

    case "subject":
      return plans.filter((p) => scope.subjects?.includes(p.subject));

    case "content":
      return plans.filter((p) => scope.contentIds?.includes(p.contentId));

    default:
      return [];
  }
}

function formatExistingPlans(
  plans: GeneratedPlanItem[],
  keepExisting?: boolean
): string {
  const header = keepExisting
    ? "## 기존 플랜 (유지하면서 추가/수정)"
    : "## 기존 플랜 (대체 예정)";

  const planList = plans
    .map(
      (p) =>
        `- ${p.date} ${p.startTime}-${p.endTime}: ${p.contentTitle} (${p.subject}) ${p.rangeDisplay}`
    )
    .join("\n");

  return `${header}\n\n${planList}`;
}

function formatConstraints(input: PartialRegenerationPromptInput): string {
  const constraints: string[] = ["## 제약조건"];

  if (input.dailyStudyMinutes) {
    constraints.push(`- 일일 최대 학습 시간: ${input.dailyStudyMinutes}분`);
  }

  if (input.availableContentIds?.length) {
    constraints.push(
      `- 사용 가능한 콘텐츠: ${input.availableContentIds.length}개`
    );
  }

  if (input.keepExisting) {
    constraints.push(`- 기존 플랜을 유지하면서 추가/수정해주세요`);
  } else {
    constraints.push(`- 해당 범위의 기존 플랜을 완전히 대체합니다`);
  }

  return constraints.join("\n");
}

// ============================================
// 토큰 추정
// ============================================

export function estimatePartialPromptTokens(
  input: PartialRegenerationPromptInput
): number {
  const prompt = buildPartialRegenerationPrompt(input);
  // 대략적인 토큰 수 추정 (한글 1글자 ≈ 2토큰, 영문 1단어 ≈ 1토큰)
  const koreanChars = (prompt.match(/[가-힣]/g) || []).length;
  const otherChars = prompt.length - koreanChars;

  return Math.ceil(koreanChars * 2 + otherChars / 4);
}
