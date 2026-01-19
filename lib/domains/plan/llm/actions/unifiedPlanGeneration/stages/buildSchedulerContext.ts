/**
 * Stage 3: 스케줄러 컨텍스트 빌딩
 *
 * 검증된 입력과 해결된 콘텐츠를 기반으로 SchedulerEngine에 전달할 컨텍스트를 생성합니다.
 */

import type {
  ValidatedPlanInput,
  ContentResolutionResult,
  SchedulerContextResult,
  StageResult,
} from "../types";
import {
  toContentInfoArray,
  createSubjectTypeMap,
} from "../utils/contentMapper";

/**
 * 요일별 블록 정보를 생성합니다.
 *
 * @param studyHours - 학습 시간 범위
 * @param lunchTime - 점심 시간 범위 (선택)
 * @returns 블록 정보 배열
 */
function generateBlocks(
  studyHours: { start: string; end: string },
  lunchTime?: { start: string; end: string }
): SchedulerContextResult["blocks"] {
  const blocks: SchedulerContextResult["blocks"] = [];

  // 모든 요일에 대해 블록 생성 (0=일, 1=월, ..., 6=토)
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    if (lunchTime) {
      // 점심 시간이 있는 경우: 오전/오후 블록으로 분리
      const lunchStartMinutes = timeToMinutes(lunchTime.start);
      const lunchEndMinutes = timeToMinutes(lunchTime.end);
      const studyStartMinutes = timeToMinutes(studyHours.start);
      const studyEndMinutes = timeToMinutes(studyHours.end);

      // 오전 블록 (학습 시작 ~ 점심 시작)
      if (studyStartMinutes < lunchStartMinutes) {
        blocks.push({
          id: crypto.randomUUID(),
          day_of_week: dayOfWeek,
          block_index: 0,
          start_time: studyHours.start,
          end_time: lunchTime.start,
          duration_minutes: lunchStartMinutes - studyStartMinutes,
        });
      }

      // 오후 블록 (점심 끝 ~ 학습 끝)
      if (lunchEndMinutes < studyEndMinutes) {
        blocks.push({
          id: crypto.randomUUID(),
          day_of_week: dayOfWeek,
          block_index: 1,
          start_time: lunchTime.end,
          end_time: studyHours.end,
          duration_minutes: studyEndMinutes - lunchEndMinutes,
        });
      }
    } else {
      // 점심 시간이 없는 경우: 단일 블록
      const duration =
        timeToMinutes(studyHours.end) - timeToMinutes(studyHours.start);
      blocks.push({
        id: crypto.randomUUID(),
        day_of_week: dayOfWeek,
        block_index: 0,
        start_time: studyHours.start,
        end_time: studyHours.end,
        duration_minutes: duration,
      });
    }
  }

  return blocks;
}

/**
 * HH:mm 형식의 시간을 분 단위로 변환합니다.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 제외일 입력을 스케줄러 형식으로 변환합니다.
 */
function mapExclusions(
  exclusions: ValidatedPlanInput["exclusions"]
): SchedulerContextResult["exclusions"] {
  return exclusions.map((e) => ({
    id: crypto.randomUUID(),
    exclusion_date: e.date,
    exclusion_type: "personal",
    reason: e.reason ?? null,
  }));
}

/**
 * 학원 일정 입력을 스케줄러 형식으로 변환합니다.
 */
function mapAcademySchedules(
  academySchedules: ValidatedPlanInput["academySchedules"]
): SchedulerContextResult["academySchedules"] {
  return academySchedules.map((s) => ({
    id: crypto.randomUUID(),
    day_of_week: s.dayOfWeek,
    start_time: s.startTime,
    end_time: s.endTime,
    subject: s.subject ?? null,
  }));
}

/**
 * Stage 3: 스케줄러 컨텍스트 빌딩
 *
 * @param input - 검증된 입력 데이터
 * @param contentResolution - 콘텐츠 해결 결과
 * @returns 스케줄러 컨텍스트 또는 에러
 */
export function buildSchedulerContext(
  input: ValidatedPlanInput,
  contentResolution: ContentResolutionResult
): StageResult<SchedulerContextResult> {
  const { timeSettings, academySchedules, exclusions, timetableSettings } =
    input;

  // 1. 콘텐츠 정보 변환
  const contents = toContentInfoArray(contentResolution.items);

  if (contents.length === 0) {
    return {
      success: false,
      error: "스케줄링할 콘텐츠가 없습니다",
    };
  }

  // 2. 블록 정보 생성
  const blocks = generateBlocks(
    timeSettings.studyHours,
    timeSettings.lunchTime
  );

  // 3. subject_type 맵 생성
  const subjectTypeMap = createSubjectTypeMap(
    contentResolution.items,
    timetableSettings.subjectType
  );

  // 4. 결과 생성
  const result: SchedulerContextResult = {
    contents,
    blocks,
    exclusions: mapExclusions(exclusions),
    academySchedules: mapAcademySchedules(academySchedules),
    subjectTypeMap,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  };

  return { success: true, data: result };
}
