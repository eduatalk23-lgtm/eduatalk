/**
 * LLM 응답 변환기
 *
 * AI 플랜 생성 응답을 데이터베이스 저장 가능한 형식으로 변환합니다.
 *
 * @module lib/domains/admin-plan/transformers/llmResponseTransformer
 */

import type {
  LLMPlanGenerationResponse,
  TransformContext,
  BlockInfo,
} from "@/lib/domains/plan/llm";
import type {
  PlanPayloadBase,
  DayType,
  ContentType,
} from "@/lib/types/plan-generation";

/**
 * 변환된 플랜 페이로드 타입
 */
export type TransformedPlanPayload = PlanPayloadBase & {
  content_id: string;
  content_title?: string | null;
  content_subject?: string | null;
  content_subject_category?: string | null;
  content_category?: string | null;
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 시간 문자열을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 시간이 범위 내에 있는지 확인
 */
function isTimeInRange(
  targetTime: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const target = timeToMinutes(targetTime);
  const start = timeToMinutes(rangeStart);
  const end = timeToMinutes(rangeEnd);
  return target >= start && target < end;
}

/**
 * content_type 결정
 *
 * @param contentId 콘텐츠 ID
 * @param contentTypeMap contentId -> ContentType 매핑
 * @returns ContentType
 */
function determineContentType(
  contentId: string,
  contentTypeMap?: Map<string, ContentType>
): ContentType {
  if (!contentTypeMap) return "book";
  return contentTypeMap.get(contentId) ?? "book";
}

/**
 * block_index 계산
 *
 * 주어진 날짜와 시작 시간을 기반으로 해당하는 블록 인덱스를 찾습니다.
 *
 * @param date 날짜 (YYYY-MM-DD)
 * @param startTime 시작 시간 (HH:mm)
 * @param blockSets 블록 세트 배열
 * @param fallbackIndex 블록을 찾지 못했을 때 사용할 기본 인덱스
 * @returns 블록 인덱스
 */
function calculateBlockIndex(
  date: string,
  startTime: string,
  blockSets?: BlockInfo[],
  fallbackIndex: number = 0
): number {
  if (!blockSets || blockSets.length === 0) {
    return fallbackIndex;
  }

  const dayOfWeek = new Date(date).getDay();

  // 해당 요일의 블록들만 필터링
  const dayBlocks = blockSets
    .filter((b) => b.day_of_week === dayOfWeek)
    .sort((a, b) => a.block_index - b.block_index);

  if (dayBlocks.length === 0) {
    return fallbackIndex;
  }

  // 시작 시간이 포함되는 블록 찾기
  for (const block of dayBlocks) {
    if (isTimeInRange(startTime, block.start_time, block.end_time)) {
      return block.block_index;
    }
  }

  // 가장 가까운 이전 블록 찾기
  const targetMinutes = timeToMinutes(startTime);
  let closestBlock = dayBlocks[0];

  for (const block of dayBlocks) {
    const blockStart = timeToMinutes(block.start_time);
    if (blockStart <= targetMinutes) {
      closestBlock = block;
    }
  }

  return closestBlock.block_index;
}

/**
 * subject_type 결정
 *
 * @param contentId 콘텐츠 ID
 * @param allocationMap contentId -> SubjectAllocation 매핑
 * @returns "strategy" | "weakness" | null
 */
function determineSubjectType(
  contentId: string,
  allocationMap?: Map<string, { subject_type: "strategy" | "weakness" | null }>
): "strategy" | "weakness" | null {
  if (!allocationMap) return null;
  const allocation = allocationMap.get(contentId);
  return allocation?.subject_type ?? null;
}

/**
 * 날짜별 블록 인덱스 추적을 위한 카운터
 * 같은 날짜 내에서 블록을 찾지 못했을 때 순차적으로 인덱스를 할당
 */
function createDailyBlockCounter(): Map<string, number> {
  return new Map();
}

function getNextBlockIndex(
  dailyCounter: Map<string, number>,
  date: string
): number {
  const current = dailyCounter.get(date) ?? 0;
  dailyCounter.set(date, current + 1);
  return current;
}

// ============================================
// 메인 변환 함수
// ============================================

/**
 * LLM 응답을 PlanPayloadBase 배열로 변환
 *
 * @param response LLM 플랜 생성 응답
 * @param context 변환 컨텍스트 - 정확한 변환을 위해 반드시 제공 권장
 * @returns 변환된 플랜 페이로드 배열
 *
 * @note context가 없으면 fallback 값이 사용되어 정확도가 떨어질 수 있습니다:
 * - contentTypeMap 없음 → 모든 콘텐츠가 "book"으로 처리됨
 * - blockSets 없음 → block_index가 배열 순서로 할당됨
 * - allocationMap 없음 → subject_type이 null로 설정됨
 */
export function transformLLMResponseToPlans(
  response: LLMPlanGenerationResponse,
  context?: TransformContext
): TransformedPlanPayload[] {
  const plans: TransformedPlanPayload[] = [];

  // context 누락 경고 로깅
  if (!context) {
    console.warn(
      "[llmResponseTransformer] TransformContext가 제공되지 않았습니다. fallback 값이 사용됩니다."
    );
  } else {
    if (context.contentTypeMap.size === 0) {
      console.warn(
        "[llmResponseTransformer] contentTypeMap이 비어 있습니다. 모든 콘텐츠가 'book'으로 처리됩니다."
      );
    }
    if (context.blockSets.length === 0) {
      console.warn(
        "[llmResponseTransformer] blockSets가 비어 있습니다. block_index가 순차적으로 할당됩니다."
      );
    }
  }

  // plan_number 계산을 위한 Map
  const planNumberMap = new Map<string, number>();
  let nextPlanNumber = 1;

  // 날짜별 블록 인덱스 카운터 (context가 없을 때 fallback용)
  const dailyBlockCounter = createDailyBlockCounter();

  // 주간 매트릭스 순회
  for (const weekMatrix of response.weeklyMatrices) {
    // 일별 그룹 순회
    for (const dailyGroup of weekMatrix.days) {
      // 개별 플랜 아이템 순회
      dailyGroup.plans.forEach((item, index) => {
        // plan_number 계산: 동일한 날짜+콘텐츠+범위는 같은 번호 부여
        const planKey = `${item.date}:${item.contentId}:${item.rangeStart ?? 0}:${item.rangeEnd ?? 0}`;
        let planNumber: number;

        if (planNumberMap.has(planKey)) {
          planNumber = planNumberMap.get(planKey)!;
        } else {
          planNumber = nextPlanNumber;
          planNumberMap.set(planKey, planNumber);
          nextPlanNumber++;
        }

        // content_type 결정 (context가 있으면 정확한 타입 사용)
        const contentType = determineContentType(
          item.contentId,
          context?.contentTypeMap
        );

        // block_index 계산 (context가 있으면 정확한 블록 매핑)
        let blockIndex: number;
        if (context?.blockSets && context.blockSets.length > 0) {
          blockIndex = calculateBlockIndex(
            item.date,
            item.startTime,
            context.blockSets,
            getNextBlockIndex(dailyBlockCounter, item.date)
          );
        } else {
          // context가 없으면 배열 인덱스 사용
          blockIndex = index;
        }

        // subject_type 결정 (context가 있으면 할당 정보 사용)
        const subjectType = determineSubjectType(
          item.contentId,
          context?.allocationMap
        );

        // day_type 결정
        const dayType: DayType = item.isReview ? "복습일" : "학습일";

        plans.push({
          plan_date: item.date,
          block_index: blockIndex,
          content_type: contentType,
          content_id: item.contentId,
          planned_start_page_or_time: item.rangeStart ?? 0,
          planned_end_page_or_time: item.rangeEnd ?? 0,
          chapter: null,
          start_time: item.startTime,
          end_time: item.endTime,
          day_type: dayType,
          week: weekMatrix.weekNumber,
          day: item.dayOfWeek,
          is_partial: false,
          is_continued: false,
          plan_number: planNumber,
          subject_type: subjectType,
          content_title: item.contentTitle ?? null,
          content_subject: item.subject ?? null,
          content_subject_category: item.subjectCategory ?? null,
          content_category: null,
        });
      });
    }
  }

  return plans;
}

/**
 * 빈 TransformContext 생성 (기본값)
 */
export function createEmptyTransformContext(): TransformContext {
  return {
    contentTypeMap: new Map(),
    blockSets: [],
    allocationMap: new Map(),
    academySchedules: [],
    excludeDays: [],
    excludeDates: [],
  };
}

/**
 * 콘텐츠 정보로부터 contentTypeMap 생성
 */
export function buildContentTypeMap(
  contents: Array<{ id: string; contentType: "book" | "lecture" | "custom" }>
): Map<string, "book" | "lecture" | "custom"> {
  const map = new Map<string, "book" | "lecture" | "custom">();
  for (const content of contents) {
    map.set(content.id, content.contentType);
  }
  return map;
}

/**
 * 할당 정보로부터 allocationMap 생성
 */
export function buildAllocationMap(
  allocations: Array<{
    contentId: string;
    subject: string;
    subjectCategory?: string;
    subject_type: "strategy" | "weakness" | null;
  }>
): Map<
  string,
  {
    contentId: string;
    subject: string;
    subjectCategory?: string;
    subject_type: "strategy" | "weakness" | null;
  }
> {
  const map = new Map();
  for (const allocation of allocations) {
    map.set(allocation.contentId, allocation);
  }
  return map;
}
