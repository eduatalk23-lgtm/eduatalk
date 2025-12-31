/**
 * schedulerOptionsBuilder.ts - 스케줄러 옵션 빌더 유틸리티
 *
 * 플랜 생성 시 scheduler_options를 구성하는 로직을 통합합니다.
 *
 * 주요 기능:
 * - time_settings 병합
 * - study_review_cycle 병합
 * - 보호 필드 자동 보호
 */

import {
  mergeTimeSettingsSafely,
  mergeStudyReviewCycle,
} from "@/lib/utils/schedulerOptionsMerge";
import type { SchedulerOptions, TimeSettings, StudyReviewCycle } from "@/lib/types/plan/domain";

/**
 * 스케줄러 옵션 빌드를 위한 입력 타입
 */
type SchedulerOptionsBuildInput = {
  /** 기존 scheduler_options */
  scheduler_options?: Partial<SchedulerOptions> | null;
  /** 병합할 time_settings */
  time_settings?: TimeSettings | null;
  /** 병합할 study_review_cycle */
  study_review_cycle?: StudyReviewCycle | null;
};

/**
 * 스케줄러 옵션 빌더
 *
 * time_settings와 study_review_cycle을 scheduler_options에 안전하게 병합합니다.
 * 보호 필드(subject_allocations, content_allocations 등)는 자동으로 보호됩니다.
 *
 * @param input 입력 데이터
 * @returns 병합된 scheduler_options
 */
export function buildSchedulerOptions(
  input: SchedulerOptionsBuildInput
): Partial<SchedulerOptions> {
  const { scheduler_options, time_settings, study_review_cycle } = input;

  // 1단계: time_settings 병합
  let merged = mergeTimeSettingsSafely(
    scheduler_options || {},
    time_settings
  );

  // 2단계: study_review_cycle 병합
  merged = mergeStudyReviewCycle(merged, study_review_cycle);

  return merged;
}

/**
 * scheduler_options가 비어있는지 확인
 *
 * @param options scheduler_options 객체
 * @returns 비어있으면 true
 */
export function isSchedulerOptionsEmpty(
  options: Partial<SchedulerOptions> | null | undefined
): boolean {
  if (!options) return true;
  return Object.keys(options).length === 0;
}

/**
 * scheduler_options를 DB 저장용으로 변환
 *
 * 비어있는 경우 null 반환 (DB 저장 시 null 처리)
 *
 * @param options scheduler_options 객체
 * @returns DB 저장용 값 (null 또는 객체)
 */
export function toDbSchedulerOptions(
  options: Partial<SchedulerOptions> | null | undefined
): Partial<SchedulerOptions> | null {
  if (isSchedulerOptionsEmpty(options)) {
    return null;
  }
  return options as Partial<SchedulerOptions>;
}
