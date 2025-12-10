/**
 * 미진행 범위 계산기
 * 
 * 오늘 이전의 미진행 플랜 범위를 계산합니다.
 * 재조정 시 미완료된 학습량을 향후 일정에 재분배하기 위해 사용됩니다.
 * 
 * @module lib/reschedule/uncompletedRangeCalculator
 */

// ============================================
// 타입 정의
// ============================================

/**
 * 미진행 범위 계산을 위한 플랜 데이터
 */
export interface UncompletedPlanData {
  content_id: string;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_amount: number | null;
}

/**
 * 콘텐츠별 미진행 범위 결과
 */
export interface UncompletedRangeResult {
  contentId: string;
  uncompletedRange: number;
  totalPlanned: number;
  totalCompleted: number;
}

/**
 * 미진행 범위의 시작점과 종료점 정보
 */
export interface UncompletedRangeBounds {
  startRange: number;
  endRange: number;
  totalUncompleted: number;
}

// ============================================
// 미진행 범위 계산 함수
// ============================================

/**
 * 미진행 범위 계산
 * 
 * 오늘 이전의 미진행 플랜 범위를 계산합니다.
 * 각 플랜별 미진행 범위를 계산하고 콘텐츠별로 합산합니다.
 * 
 * @param plans 오늘 이전의 플랜 목록 (pending, in_progress 상태)
 * @returns 콘텐츠별 미진행 범위 Map (content_id -> uncompleted_range)
 * 
 * @example
 * ```ts
 * const plans = [
 *   { content_id: 'c1', planned_start_page_or_time: 1, planned_end_page_or_time: 20, completed_amount: 10 },
 *   { content_id: 'c1', planned_start_page_or_time: 21, planned_end_page_or_time: 40, completed_amount: null },
 * ];
 * const result = calculateUncompletedRange(plans);
 * // Map { 'c1' => 30 } (10 + 20 = 30 미진행)
 * ```
 */
export function calculateUncompletedRange(
  plans: UncompletedPlanData[]
): Map<string, number> {
  const uncompletedRangeMap = new Map<string, number>();

  for (const plan of plans) {
    if (!plan.content_id) continue;

    // 계획된 범위 계산
    const plannedStart = plan.planned_start_page_or_time ?? 0;
    const plannedEnd = plan.planned_end_page_or_time ?? 0;
    const plannedAmount = Math.max(0, plannedEnd - plannedStart);

    // 완료된 양
    const completedAmount = plan.completed_amount ?? 0;

    // 미진행 범위 계산 (음수 방지)
    const uncompletedAmount = Math.max(0, plannedAmount - completedAmount);

    // 콘텐츠별 합산
    const currentTotal = uncompletedRangeMap.get(plan.content_id) ?? 0;
    uncompletedRangeMap.set(plan.content_id, currentTotal + uncompletedAmount);
  }

  return uncompletedRangeMap;
}

/**
 * 미진행 범위 상세 정보 계산
 * 
 * 콘텐츠별 미진행 범위와 함께 상세 통계 정보를 반환합니다.
 * 
 * @param plans 오늘 이전의 플랜 목록
 * @returns 콘텐츠별 미진행 범위 상세 결과 배열
 */
export function calculateUncompletedRangeDetails(
  plans: UncompletedPlanData[]
): UncompletedRangeResult[] {
  const statsMap = new Map<string, {
    uncompletedRange: number;
    totalPlanned: number;
    totalCompleted: number;
  }>();

  for (const plan of plans) {
    if (!plan.content_id) continue;

    const plannedStart = plan.planned_start_page_or_time ?? 0;
    const plannedEnd = plan.planned_end_page_or_time ?? 0;
    const plannedAmount = Math.max(0, plannedEnd - plannedStart);
    const completedAmount = plan.completed_amount ?? 0;
    const uncompletedAmount = Math.max(0, plannedAmount - completedAmount);

    const current = statsMap.get(plan.content_id) ?? {
      uncompletedRange: 0,
      totalPlanned: 0,
      totalCompleted: 0,
    };

    statsMap.set(plan.content_id, {
      uncompletedRange: current.uncompletedRange + uncompletedAmount,
      totalPlanned: current.totalPlanned + plannedAmount,
      totalCompleted: current.totalCompleted + completedAmount,
    });
  }

  return Array.from(statsMap.entries()).map(([contentId, stats]) => ({
    contentId,
    ...stats,
  }));
}

/**
 * 미진행 범위의 시작점과 종료점 계산
 * 
 * 오늘 이전의 미진행 플랜 범위를 계산하여 콘텐츠별로 미진행 범위의 실제 시작점과 종료점을 반환합니다.
 * 부분 완료된 플랜도 고려하여 정확한 미진행 범위를 계산합니다.
 * 
 * @param plans 오늘 이전의 플랜 목록 (pending, in_progress 상태)
 * @returns 콘텐츠별 미진행 범위 Bounds Map (content_id -> UncompletedRangeBounds)
 * 
 * @example
 * ```ts
 * const plans = [
 *   { content_id: 'c1', planned_start_page_or_time: 11, planned_end_page_or_time: 15, completed_amount: 0 },
 *   { content_id: 'c1', planned_start_page_or_time: 16, planned_end_page_or_time: 20, completed_amount: 5 },
 *   { content_id: 'c1', planned_start_page_or_time: 21, planned_end_page_or_time: 25, completed_amount: 2 },
 * ];
 * const result = calculateUncompletedRangeBounds(plans);
 * // Map {
 * //   'c1' => {
 * //     startRange: 11,  // 최소 시작점
 * //     endRange: 25,    // 최대 종료점
 * //     totalUncompleted: 10  // 총 미진행 범위 (4 + 4 + 2)
 * //   }
 * // }
 * ```
 */
export function calculateUncompletedRangeBounds(
  plans: UncompletedPlanData[]
): Map<string, UncompletedRangeBounds> {
  const boundsMap = new Map<string, UncompletedRangeBounds>();

  // 콘텐츠별로 그룹화
  const plansByContent = new Map<string, UncompletedPlanData[]>();
  for (const plan of plans) {
    if (!plan.content_id) continue;
    
    if (!plansByContent.has(plan.content_id)) {
      plansByContent.set(plan.content_id, []);
    }
    plansByContent.get(plan.content_id)!.push(plan);
  }

  // 각 콘텐츠별로 범위 계산
  for (const [contentId, contentPlans] of plansByContent.entries()) {
    let minStartRange = Infinity;
    let maxEndRange = -Infinity;
    let totalUncompleted = 0;

    for (const plan of contentPlans) {
      const plannedStart = plan.planned_start_page_or_time ?? 0;
      const plannedEnd = plan.planned_end_page_or_time ?? 0;
      const plannedAmount = Math.max(0, plannedEnd - plannedStart);
      const completedAmount = plan.completed_amount ?? 0;
      const uncompletedAmount = Math.max(0, plannedAmount - completedAmount);

      // 미진행 범위가 있는 경우만 처리
      if (uncompletedAmount > 0) {
        // 부분 완료된 경우, 실제 미진행 시작점 계산
        const actualStartRange = plannedStart + completedAmount;
        const actualEndRange = plannedEnd;

        minStartRange = Math.min(minStartRange, actualStartRange);
        maxEndRange = Math.max(maxEndRange, actualEndRange);
        totalUncompleted += uncompletedAmount;
      }
    }

    // 유효한 범위가 있는 경우만 추가
    if (minStartRange !== Infinity && maxEndRange !== -Infinity && totalUncompleted > 0) {
      boundsMap.set(contentId, {
        startRange: minStartRange,
        endRange: maxEndRange,
        totalUncompleted,
      });
    }
  }

  return boundsMap;
}

/**
 * 미진행 범위를 콘텐츠에 적용
 * 
 * 미진행 범위의 시작점과 종료점을 사용하여 콘텐츠의 start_range와 end_range를 조정합니다.
 * 원래 콘텐츠의 범위를 초과하지 않도록 보장합니다.
 * 
 * @param contents 콘텐츠 목록
 * @param uncompletedBoundsMap 콘텐츠별 미진행 범위 Bounds Map
 * @param selectedContentIds 선택된 콘텐츠 ID Set (선택, 지정 시 해당 콘텐츠만 처리)
 * @returns 미진행 범위가 적용된 콘텐츠 목록
 * 
 * @example
 * ```ts
 * const contents = [
 *   { content_id: 'c1', start_range: 1, end_range: 100 }
 * ];
 * const boundsMap = new Map([
 *   ['c1', { startRange: 11, endRange: 90, totalUncompleted: 80 }]
 * ]);
 * const result = applyUncompletedRangeToContents(contents, boundsMap);
 * // [{ content_id: 'c1', start_range: 11, end_range: 100 }]
 * ```
 */
export function applyUncompletedRangeToContents<T extends {
  id?: string;
  content_id?: string;
  start_range?: number | null;
  end_range?: number | null;
}>(
  contents: T[],
  uncompletedBoundsMap: Map<string, UncompletedRangeBounds>,
  selectedContentIds?: Set<string>
): T[] {
  return contents.map(content => {
    // content_id 또는 id로 매칭
    const contentId = content.content_id || content.id;
    if (!contentId) return content;

    // 선택된 콘텐츠만 처리 (selectedContentIds가 주어진 경우)
    if (selectedContentIds && selectedContentIds.size > 0 && !selectedContentIds.has(contentId)) {
      return content;
    }

    const bounds = uncompletedBoundsMap.get(contentId);
    if (!bounds || bounds.totalUncompleted <= 0) return content;

    // 원래 범위 가져오기
    const originalStartRange = content.start_range ?? 0;
    const originalEndRange = content.end_range ?? 0;

    // 미진행 범위의 시작점과 종료점 사용하여 조정
    // 시작점: 원래 시작점과 미진행 시작점 중 큰 값 (더 늦은 시작점)
    // 종료점: 원래 종료점과 미진행 종료점 중 작은 값 (원래 범위를 초과하지 않도록)
    const adjustedStartRange = Math.max(originalStartRange, bounds.startRange);
    const adjustedEndRange = Math.min(originalEndRange, bounds.endRange);

    // 조정된 범위가 유효한지 확인
    if (adjustedStartRange >= adjustedEndRange) {
      // 유효하지 않은 경우 원본 반환
      return content;
    }

    return {
      ...content,
      start_range: adjustedStartRange,
      end_range: adjustedEndRange,
    };
  });
}
