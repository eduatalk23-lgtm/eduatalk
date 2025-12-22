/**
 * 스케줄 생성 서비스
 *
 * 콘텐츠를 날짜별로 분배하여 학습 스케줄을 생성합니다.
 * 기존 scheduler.ts의 함수들을 서비스 레이어로 래핑합니다.
 *
 * NOTE: Phase 2에서는 기존 generatePlansFromGroup 함수가
 * 많은 파라미터를 필요로 하므로, 이 서비스는 단순화된 인터페이스만 제공합니다.
 * Phase 3에서 기존 함수 리팩토링 후 완전한 통합이 이루어집니다.
 *
 * @module lib/plan/services/ScheduleGenerationService
 */

import type {
  DateMetadataMap,
} from "@/lib/types/plan-generation";
import type {
  ServiceResult,
  ScheduleGenerationInput,
  ScheduleGenerationOutput,
  IScheduleGenerationService,
  ScheduledPlan,
} from "./types";

/**
 * 스케줄 생성 서비스 구현
 *
 * 현재는 스텁 구현입니다. 기존 generatePlansFromGroup 함수는
 * 많은 추가 파라미터(group, blocks, academySchedules 등)를 필요로 합니다.
 * Phase 3에서 기존 함수 시그니처 리팩토링 후 완전한 통합이 이루어집니다.
 */
export class ScheduleGenerationService implements IScheduleGenerationService {
  /**
   * 콘텐츠를 날짜별로 분배하여 스케줄 생성
   *
   * @param input - 스케줄 생성 입력
   * @returns 스케줄 생성 결과
   */
  async generateSchedule(
    input: ScheduleGenerationInput
  ): Promise<ServiceResult<ScheduleGenerationOutput>> {
    const { contents, availableDates, dateMetadataMap, options } = input;

    try {
      // 입력 데이터 검증
      if (contents.length === 0) {
        return {
          success: true,
          data: {
            scheduledPlans: [],
            weekDatesMap: new Map(),
          },
        };
      }

      if (availableDates.length === 0) {
        return {
          success: false,
          error: "사용 가능한 날짜가 없습니다",
          errorCode: "NO_AVAILABLE_DATES",
        };
      }

      // 단순 분배 로직 (Phase 3에서 실제 스케줄러 통합)
      const scheduledPlans: ScheduledPlan[] = [];
      let dateIndex = 0;

      for (const content of contents) {
        if (dateIndex >= availableDates.length) {
          dateIndex = 0; // 날짜가 부족하면 순환
        }

        const date = availableDates[dateIndex];
        const metadata = dateMetadataMap.get(date);

        scheduledPlans.push({
          plan_date: date,
          block_index: 0,
          content_type: content.content_type,
          content_id: content.content_id,
          planned_start_page_or_time: content.start_range,
          planned_end_page_or_time: content.end_range,
          is_reschedulable: true,
          // 서비스 레이어 추가 필드
          date,
          start_range: content.start_range,
          end_range: content.end_range,
          estimated_duration: content.estimated_duration,
          is_review: false,
          day_type: metadata?.day_type ?? "학습일",
          week_number: metadata?.week_number ?? 1,
        });

        dateIndex++;
      }

      // 주차별 날짜 맵 생성
      const weekDatesMap = this.buildWeekDatesMap(availableDates, dateMetadataMap);

      return {
        success: true,
        data: {
          scheduledPlans,
          weekDatesMap,
        },
      };
    } catch (error) {
      console.error("[ScheduleGenerationService] generateSchedule 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        errorCode: "SCHEDULE_GENERATION_FAILED",
      };
    }
  }

  /**
   * 주차별 날짜 맵 생성 (내부 헬퍼)
   */
  private buildWeekDatesMap(
    availableDates: string[],
    dateMetadataMap: DateMetadataMap
  ): Map<number, string[]> {
    const weekDatesMap = new Map<number, string[]>();

    availableDates.forEach((date) => {
      const metadata = dateMetadataMap.get(date);
      const weekNumber = metadata?.week_number ?? 1;

      if (!weekDatesMap.has(weekNumber)) {
        weekDatesMap.set(weekNumber, []);
      }
      weekDatesMap.get(weekNumber)!.push(date);
    });

    return weekDatesMap;
  }
}

// 싱글톤 인스턴스
let instance: ScheduleGenerationService | null = null;

/**
 * ScheduleGenerationService 싱글톤 인스턴스 반환
 */
export function getScheduleGenerationService(): ScheduleGenerationService {
  if (!instance) {
    instance = new ScheduleGenerationService();
  }
  return instance;
}
