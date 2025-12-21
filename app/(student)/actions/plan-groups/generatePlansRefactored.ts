"use server";

import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanStatus } from "@/lib/types/plan";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import {
  assignPlanTimes,
  calculatePlanEstimatedTime,
} from "@/lib/plan/assignPlanTimes";
import { splitPlanTimeInputByEpisodes } from "@/lib/plan/planSplitter";
import { updatePlanGroupStatus } from "./status";
import { timeToMinutes } from "./utils";
import {
  getPlanGroupWithDetailsByRole,
  getStudentIdForPlanGroup,
  getSupabaseClientForStudent,
  shouldBypassStatusCheck,
  verifyPlanGroupAccess,
} from "@/lib/auth/planGroupAuth";
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
import {
  getBlockSetForPlanGroup,
  getBlockSetErrorMessage,
} from "@/lib/plan/blocks";
import {
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_SELF_STUDY_CONTENT_ID,
  isDummyContent,
} from "@/lib/utils/planUtils";
import { calculateAvailableDates } from "@/lib/scheduler/calculateAvailableDates";
import { generatePlansFromGroup } from "@/lib/plan/scheduler";
import {
  resolveContentIds,
  loadContentDurations,
  loadContentMetadata,
} from "@/lib/plan/contentResolver";
import { extractScheduleMaps } from "@/lib/plan/planDataLoader";
import { getMergedSchedulerSettings } from "@/lib/data/schedulerSettings";
import { PlanGroupError } from "@/lib/errors/planGroupErrors";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";

/**
 * 리팩토링된 _generatePlansFromGroup 함수
 * - contentResolver 모듈 사용으로 코드 중복 제거
 * - planDataLoader 모듈 사용으로 스케줄 계산 로직 분리
 */
async function _generatePlansFromGroupRefactored(
  groupId: string
): Promise<{ count: number }> {
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsByRole(
      groupId,
      access.user.userId,
      access.role,
      tenantContext.tenantId
    );

  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  const studentId = getStudentIdForPlanGroup(
    group,
    access.user.userId,
    access.role
  );

  const bypassStatusCheck = shouldBypassStatusCheck(
    access.role,
    group.plan_type ?? null
  );

  if (!bypassStatusCheck) {
    if (group.status !== "saved" && group.status !== "active") {
      throw new AppError(
        "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // 2. 블록 세트 조회
  const baseBlocks = await getBlockSetForPlanGroup(
    group,
    studentId,
    access.user.userId,
    access.role,
    tenantContext.tenantId
  );

  if (baseBlocks.length === 0) {
    const errorMessage = getBlockSetErrorMessage(group, false);
    throw new AppError(errorMessage, ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 3. 병합된 스케줄러 설정
  const mergedSettings = await getMergedSchedulerSettings(
    group.tenant_id,
    group.camp_template_id,
    group.scheduler_options as Record<string, unknown>
  );

  const schedulerOptions = {
    study_days: mergedSettings.study_review_ratio.study_days,
    review_days: mergedSettings.study_review_ratio.review_days,
    weak_subject_focus: mergedSettings.weak_subject_focus,
    review_scope: mergedSettings.review_scope,
    lunch_time: mergedSettings.lunch_time,
    camp_study_hours: mergedSettings.study_hours,
    self_study_hours: mergedSettings.self_study_hours,
  };

  // scheduler_options에서 TimeSettings 추출 (타입 안전하게)
  const groupSchedulerOptions = getSchedulerOptionsWithTimeSettings(group);

  // 4. 스케줄 계산
  const scheduleResult = calculateAvailableDates(
    group.period_start,
    group.period_end,
    baseBlocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
      reason: e.reason || undefined,
    })),
    academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: "1730_timetable",
      scheduler_options: schedulerOptions || null,
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays:
        groupSchedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days:
        groupSchedulerOptions?.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.self_study_hours,
      designated_holiday_hours: groupSchedulerOptions?.designated_holiday_hours,
      non_study_time_blocks: group.non_study_time_blocks || undefined,
    }
  );

  // 5. 스케줄 맵 추출 (새 모듈 사용)
  const { dateTimeSlots, dateMetadataMap, weekDatesMap } =
    extractScheduleMaps(scheduleResult);

  // dateAvailableTimeRanges 추출
  const dateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  scheduleResult.daily_schedule.forEach((daily) => {
    if (
      (daily.day_type === "학습일" || daily.day_type === "복습일") &&
      daily.available_time_ranges.length > 0
    ) {
      dateAvailableTimeRanges.set(
        daily.date,
        daily.available_time_ranges.map((range) => ({
          start: range.start,
          end: range.end,
        }))
      );
    }
  });

  // 6. Supabase 클라이언트 설정
  const isAdminOrConsultant =
    access.role === "admin" || access.role === "consultant";
  const queryClient = await getSupabaseClientForStudent(
    studentId,
    access.user.userId,
    access.role
  );
  const masterQueryClient = isAdminOrConsultant
    ? ensureAdminClient()
    : supabase;

  if (!queryClient || !masterQueryClient) {
    throw new AppError(
      "Supabase 클라이언트를 생성할 수 없습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  // 7. 콘텐츠 ID 해석 및 복사 (배치 쿼리로 최적화)
  const contentIdMap = new Map<string, string>();

  // 콘텐츠를 타입별로 분류 (더미 콘텐츠 제외)
  const bookContents = contents.filter(
    (c) => c.content_type === "book" && !isDummyContent(c.content_id)
  );
  const lectureContents = contents.filter(
    (c) => c.content_type === "lecture" && !isDummyContent(c.content_id)
  );
  const customContents = contents.filter(
    (c) => c.content_type === "custom" || isDummyContent(c.content_id)
  );

  // 더미/커스텀 콘텐츠는 그대로 매핑
  customContents.forEach((c) => contentIdMap.set(c.content_id, c.content_id));
  contents
    .filter((c) => isDummyContent(c.content_id))
    .forEach((c) => contentIdMap.set(c.content_id, c.content_id));

  // 배치 쿼리: 학생 콘텐츠 존재 여부 확인 (병렬)
  const [existingBooksResult, existingLecturesResult] = await Promise.all([
    bookContents.length > 0
      ? queryClient
          .from("books")
          .select("id, master_content_id")
          .in(
            "master_content_id",
            bookContents.map((c) => c.content_id)
          )
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] }),
    lectureContents.length > 0
      ? queryClient
          .from("lectures")
          .select("id, master_content_id")
          .in(
            "master_content_id",
            lectureContents.map((c) => c.content_id)
          )
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] }),
  ]);

  // 존재하는 학생 콘텐츠 매핑
  const existingBooksMap = new Map(
    (existingBooksResult.data || []).map((b) => [b.master_content_id, b.id])
  );
  const existingLecturesMap = new Map(
    (existingLecturesResult.data || []).map((l) => [l.master_content_id, l.id])
  );

  // 이미 존재하는 학생 콘텐츠 매핑
  bookContents.forEach((c) => {
    const existingId = existingBooksMap.get(c.content_id);
    if (existingId) {
      contentIdMap.set(c.content_id, existingId);
    }
  });
  lectureContents.forEach((c) => {
    const existingId = existingLecturesMap.get(c.content_id);
    if (existingId) {
      contentIdMap.set(c.content_id, existingId);
    }
  });

  // 학생 콘텐츠가 없는 것들 필터링
  const missingBookIds = bookContents
    .filter((c) => !contentIdMap.has(c.content_id))
    .map((c) => c.content_id);
  const missingLectureIds = lectureContents
    .filter((c) => !contentIdMap.has(c.content_id))
    .map((c) => c.content_id);

  // 배치 쿼리: 마스터 콘텐츠 존재 여부 확인 (병렬)
  const [masterBooksResult, masterLecturesResult] = await Promise.all([
    missingBookIds.length > 0
      ? masterQueryClient
          .from("master_books")
          .select("id")
          .in("id", missingBookIds)
      : Promise.resolve({ data: [] }),
    missingLectureIds.length > 0
      ? masterQueryClient
          .from("master_lectures")
          .select("id")
          .in("id", missingLectureIds)
      : Promise.resolve({ data: [] }),
  ]);

  const masterBookIds = new Set(
    (masterBooksResult.data || []).map((b) => b.id)
  );
  const masterLectureIds = new Set(
    (masterLecturesResult.data || []).map((l) => l.id)
  );

  // 마스터 콘텐츠 복사 (복사는 순차 처리 필요 - DB 트랜잭션)
  for (const contentId of missingBookIds) {
    if (masterBookIds.has(contentId)) {
      const copiedBook = await copyMasterBookToStudent(
        contentId,
        studentId,
        group.tenant_id
      );
      contentIdMap.set(contentId, copiedBook?.bookId || contentId);
    } else {
      contentIdMap.set(contentId, contentId);
    }
  }

  for (const contentId of missingLectureIds) {
    if (masterLectureIds.has(contentId)) {
      const copiedLecture = await copyMasterLectureToStudent(
        contentId,
        studentId,
        group.tenant_id
      );
      contentIdMap.set(contentId, copiedLecture?.lectureId || contentId);
    } else {
      contentIdMap.set(contentId, contentId);
    }
  }

  // 8. 콘텐츠 소요시간 조회 (새 모듈 사용)
  const contentDurationMap = await loadContentDurations(
    contents,
    contentIdMap,
    studentId,
    queryClient,
    masterQueryClient
  );

  // Episode 정보 전달 경로 검증 (개발 환경에서만)
  if (process.env.NODE_ENV === "development") {
    const lectureContentsWithEpisodes = contents
      .filter((c) => c.content_type === "lecture")
      .map((c) => {
        const durationInfo = contentDurationMap.get(c.content_id);
        const hasEpisodes =
          durationInfo?.episodes && durationInfo.episodes.length > 0;
        const episodeCount = durationInfo?.episodes?.length ?? 0;
        return {
          content_id: c.content_id,
          hasEpisodes,
          episodeCount,
          hasDuration: !!durationInfo?.duration,
          totalEpisodes: durationInfo?.total_episodes ?? null,
        };
      });

    const contentsWithEpisodes = lectureContentsWithEpisodes.filter(
      (c) => c.hasEpisodes
    );
    const contentsWithoutEpisodes = lectureContentsWithEpisodes.filter(
      (c) => !c.hasEpisodes
    );

    if (contentsWithEpisodes.length > 0) {
      console.log(
        `[generatePlansRefactored] 강의 콘텐츠 episode 정보 확인: ${contentsWithEpisodes.length}개 콘텐츠에 episode 정보 있음`,
        contentsWithEpisodes.map((c) => ({
          content_id: c.content_id,
          episode_count: c.episodeCount,
        }))
      );
    }

    if (contentsWithoutEpisodes.length > 0) {
      console.warn(
        `[generatePlansRefactored] 강의 콘텐츠 episode 정보 누락: ${contentsWithoutEpisodes.length}개 콘텐츠에 episode 정보 없음`,
        contentsWithoutEpisodes.map((c) => ({
          content_id: c.content_id,
          has_duration: c.hasDuration,
          total_episodes: c.totalEpisodes,
        }))
      );
    }
  }

  // 9. 콘텐츠 메타데이터 조회 (새 모듈 사용)
  const contentMetadataMap = await loadContentMetadata(
    contents,
    contentIdMap,
    studentId,
    queryClient,
    masterQueryClient
  );

  // 10. 스케줄러 호출 (플랜 생성)
  let scheduledPlans: import("@/lib/plan/scheduler").ScheduledPlan[];
  try {
    scheduledPlans = await generatePlansFromGroup(
      group,
      contents,
      exclusions,
      academySchedules,
      [],
      undefined,
      undefined,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap
    );
  } catch (error) {
    // PlanGroupError인 경우 failureReason을 사용하여 구체적인 메시지 전달
    if (error instanceof PlanGroupError) {
      const userMessage = error.userMessage || error.message;

      throw new AppError(
        userMessage,
        ErrorCode.BUSINESS_LOGIC_ERROR,
        400,
        true,
        {
          originalError: error.message,
          failureReason: error.failureReason,
          code: error.code,
        }
      );
    }

    // 기타 에러는 그대로 throw
    throw error;
  }

  if (scheduledPlans.length === 0) {
    throw new AppError(
      "일정에 맞는 플랜을 생성할 수 없습니다. 기간과 콘텐츠 양을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 11. 기존 플랜 삭제
  const { error: deleteError } = await supabase
    .from("student_plan")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteError) {
    throw new AppError(
      `기존 플랜 삭제에 실패했습니다: ${
        deleteError.message || deleteError.code || "알 수 없는 오류"
      }`,
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  // 12. tenant_id 검증 (플랜 저장 전에 미리 검증)
  const tenantId = group.tenant_id || tenantContext.tenantId;
  if (!tenantId) {
    throw new AppError(
      "테넌트 ID를 찾을 수 없습니다. 플랜 그룹 또는 사용자 정보를 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 13. 플랜 저장 준비 (날짜별로 그룹화하여 시간 배정)
  const planPayloads: Array<{
    plan_group_id: string;
    student_id: string;
    tenant_id: string;
    plan_date: string;
    block_index: number;
    status: string;
    content_type: string;
    content_id: string;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    chapter: string | null;
    start_time: string | null;
    end_time: string | null;
    day_type: string | null;
    week: number | null;
    day: number | null;
    is_partial: boolean;
    is_continued: boolean;
    content_title: string | null;
    content_subject: string | null;
    content_subject_category: string | null;
    created_at: string;
    updated_at: string;
    sequence: number | null;
  }> = [];

  // 역방향 콘텐츠 ID 맵 생성 (resolved ID -> original ID)
  const reverseContentIdMap = new Map<string, string>();
  contentIdMap.forEach((resolvedId, originalId) => {
    reverseContentIdMap.set(resolvedId, originalId);
  });

  // 전체 플랜 컨텍스트에서 plan_number 추론 (날짜 순서 고려)
  // 같은 콘텐츠의 같은 범위를 가진 플랜들은 같은 plan_number를 가짐
  const planNumberMap = new Map<string, number>(); // key: `${content_id}-${start}-${end}`, value: plan_number
  const planKeyToNumber = new Map<string, number>();
  let nextPlanNumber = 1;

  // 모든 플랜을 날짜 순서대로 정렬하여 plan_number 추론
  const sortedAllPlans = [...scheduledPlans].sort((a, b) => {
    if (a.plan_date !== b.plan_date) {
      return a.plan_date.localeCompare(b.plan_date);
    }
    return (a.block_index || 0) - (b.block_index || 0);
  });

  // 전체 플랜 컨텍스트에서 plan_number 추론
  sortedAllPlans.forEach((plan) => {
    const planKey = `${plan.content_id}-${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
    if (!planKeyToNumber.has(planKey)) {
      planKeyToNumber.set(planKey, nextPlanNumber);
      nextPlanNumber++;
    }
    planNumberMap.set(`${plan.plan_date}-${plan.block_index}-${plan.content_id}`, planKeyToNumber.get(planKey)!);
  });

  // 날짜별로 그룹화
  const plansByDate = new Map<string, typeof scheduledPlans>();
  scheduledPlans.forEach((plan) => {
    if (!plansByDate.has(plan.plan_date)) {
      plansByDate.set(plan.plan_date, []);
    }
    plansByDate.get(plan.plan_date)!.push(plan);
  });

  // 콘텐츠별 회차 계산을 위한 맵
  // key: content_id, value: { lastSequence: number, seenPlanNumbers: Set<number | null>, planNumberToSequence: Map<number | null, number> }
  const contentSequenceMap = new Map<
    string,
    {
      lastSequence: number;
      seenPlanNumbers: Set<number | null>;
      planNumberToSequence: Map<number | null, number>;
    }
  >();

  /**
   * 콘텐츠별 회차 계산 함수 (날짜 순서 고려)
   * 같은 plan_number를 가진 플랜들은 같은 회차를 가짐
   * 날짜 순서대로 회차가 증가함
   */
  function calculateContentSequence(
    contentId: string,
    planNumber: number | null,
    planDate: string
  ): number {
    if (!contentSequenceMap.has(contentId)) {
      contentSequenceMap.set(contentId, {
        lastSequence: 0,
        seenPlanNumbers: new Set(),
        planNumberToSequence: new Map(),
      });
    }

    const contentSeq = contentSequenceMap.get(contentId)!;

    // 같은 plan_number를 가진 플랜이 이미 있으면 그 회차를 재사용
    if (planNumber !== null && contentSeq.planNumberToSequence.has(planNumber)) {
      return contentSeq.planNumberToSequence.get(planNumber)!;
    }

    // plan_number가 null이거나 새로운 plan_number인 경우
    if (planNumber === null) {
      // null은 개별 카운트 (날짜 순서대로)
      contentSeq.lastSequence++;
      return contentSeq.lastSequence;
    } else {
      // 새로운 plan_number인 경우 회차 증가 (날짜 순서대로)
      if (!contentSeq.seenPlanNumbers.has(planNumber)) {
        contentSeq.seenPlanNumbers.add(planNumber);
        contentSeq.lastSequence++;
        contentSeq.planNumberToSequence.set(planNumber, contentSeq.lastSequence);
      }
      return contentSeq.planNumberToSequence.get(planNumber)!;
    }
  }

  // 각 날짜별로 처리 (날짜 순서대로)
  const sortedDates = Array.from(plansByDate.keys()).sort();
  for (const date of sortedDates) {
    const datePlans = plansByDate.get(date)!;
    const timeSlotsForDate = dateTimeSlots.get(date) || [];
    const studyTimeSlots = timeSlotsForDate
      .filter((slot) => slot.type === "학습시간")
      .map((slot) => ({ start: slot.start, end: slot.end }))
      .sort((a, b) => {
        const aMinutes = timeToMinutes(a.start);
        const bMinutes = timeToMinutes(b.start);
        return aMinutes - bMinutes;
      });

    const dateMetadata = dateMetadataMap.get(date) || {
      day_type: null,
      week_number: null,
    };

    const dailySchedule = scheduleResult.daily_schedule.find(
      (d) => d.date === date
    );
    const totalStudyHours = dailySchedule?.study_hours || 0;
    const dayType = dateMetadata.day_type || "학습일";

    // 원본 플랜 정보를 추적하기 위해 인덱스와 함께 저장
    const plansForAssign = datePlans.map((plan, originalIndex) => {
      const finalContentId =
        contentIdMap.get(plan.content_id) || plan.content_id;
      return {
        content_id: finalContentId,
        content_type: plan.content_type,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        chapter: plan.chapter || null,
        block_index: plan.block_index,
        // Preserve pre-calculated times if available (from SchedulerEngine)
        _precalculated_start: plan.start_time,
        _precalculated_end: plan.end_time,
        // 원본 플랜 인덱스 저장 (회차 계산용)
        _originalIndex: originalIndex,
      } as import("@/lib/plan/assignPlanTimes").PlanTimeInput & {
        _originalIndex: number;
      };
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[generatePlansRefactored] ${date} plans precalc check:`,
        plansForAssign.map((p) => ({
          id: p.content_id,
          range: `${p.planned_start_page_or_time}~${p.planned_end_page_or_time}`,
          start: p._precalculated_start,
          end: p._precalculated_end,
        }))
      );
    }

    // Episode 정보 전달 확인 (개발 환경에서만)
    if (process.env.NODE_ENV === "development") {
      const lecturePlans = plansForAssign.filter(
        (p) => p.content_type === "lecture"
      );
      if (lecturePlans.length > 0) {
        const plansWithEpisodeInfo = lecturePlans
          .map((p) => {
            const durationInfo = contentDurationMap.get(p.content_id);
            return {
              content_id: p.content_id,
              has_episodes: !!(
                durationInfo?.episodes && durationInfo.episodes.length > 0
              ),
              episode_count: durationInfo?.episodes?.length ?? 0,
              range: `${p.planned_start_page_or_time}~${p.planned_end_page_or_time}`,
            };
          })
          .filter((p) => p.has_episodes);

        if (plansWithEpisodeInfo.length > 0) {
          console.log(
            `[generatePlansRefactored] assignPlanTimes 호출 전 episode 정보 확인: ${plansWithEpisodeInfo.length}개 강의 플랜에 episode 정보 있음`,
            plansWithEpisodeInfo
          );
        }
      }
    }

    // Episode별 플랜 분할 (Pre-calculated time 여부와 무관하게)
    // 큰 범위(예: 2~23)를 개별 episode로 분할하여 각 episode의 실제 duration을 정확히 반영
    // 단, SchedulerEngine이 이미 episode별로 분할한 경우(start === end)는 재분할하지 않음
    // 복습일인 경우에는 범위형으로 유지 (episode별 분할하지 않음)
    const splitPlansForAssign = plansForAssign.flatMap((p) => {
      // 강의 콘텐츠만 episode별로 분할
      if (p.content_type === "lecture") {
        // 복습일인 경우 범위형으로 유지 (episode별 분할하지 않음)
        if (dayType === "복습일") {
          return [p];
        }

        // 이미 단일 episode로 분할된 경우(start === end)는 재분할하지 않음
        // SchedulerEngine이 이미 episode별로 분할했을 수 있음
        const isAlreadySingleEpisode =
          p.planned_start_page_or_time === p.planned_end_page_or_time;
        if (isAlreadySingleEpisode) {
          return [p];
        }
        // 범위가 있는 경우에만 분할
        const splitPlans = splitPlanTimeInputByEpisodes(p, contentDurationMap);
        // 분할된 플랜들도 원본 인덱스 유지
        return splitPlans.map((splitPlan) => ({
          ...splitPlan,
          _originalIndex: p._originalIndex,
        })) as Array<
          import("@/lib/plan/assignPlanTimes").PlanTimeInput & {
            _originalIndex: number;
          }
        >;
      }
      return [p];
    });

    if (process.env.NODE_ENV === "development") {
      const splitCount = splitPlansForAssign.length - plansForAssign.length;

      // 분할 전후 precalculated time 비교
      const beforePrecalcCount = plansForAssign.filter(
        (p) => p._precalculated_start && p._precalculated_end
      ).length;
      const afterPrecalcCount = splitPlansForAssign.filter(
        (p) => p._precalculated_start && p._precalculated_end
      ).length;

      console.log(
        `[generatePlansRefactored] ${date} episode별 분할 및 precalc 상태:`,
        {
          before: plansForAssign.length,
          after: splitPlansForAssign.length,
          splitCount,
          beforePrecalcCount,
          afterPrecalcCount,
          precalcLost: beforePrecalcCount - afterPrecalcCount,
          // 분할 후 precalculated time 상세
          afterSplitDetail: splitPlansForAssign.slice(0, 5).map((p) => ({
            id: p.content_id.substring(0, 8),
            range: `${p.planned_start_page_or_time}~${p.planned_end_page_or_time}`,
            precalc_start: p._precalculated_start,
            precalc_end: p._precalculated_end,
          })),
        }
      );
    }

    // Pre-calculated time이 있으면 사용, 없으면 재계산
    const hasPrecalculatedTimes = splitPlansForAssign.some(
      (p) => p._precalculated_start && p._precalculated_end
    );

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[generatePlansRefactored] ${date} assignPlanTimes 호출 전:`,
        {
          totalPlans: splitPlansForAssign.length,
          hasPrecalculatedTimes,
          studyTimeSlots: studyTimeSlots.length,
          dayType,
        }
      );
    }

    let timeSegments: import("@/lib/plan/assignPlanTimes").PlanTimeSegment[];

    // Episode별 분할 후 시간 재배정 (모든 플랜에 대해)
    timeSegments = assignPlanTimes(
      splitPlansForAssign,
      studyTimeSlots,
      contentDurationMap,
      dayType,
      totalStudyHours
    );

    if (process.env.NODE_ENV === "development") {
      console.log(`[generatePlansRefactored] ${date} assignPlanTimes 결과:`, {
        totalSegments: timeSegments.length,
        segmentDetail: timeSegments.slice(0, 5).map((s) => ({
          content_id: s.plan.content_id.substring(0, 8),
          range: `${s.plan.planned_start_page_or_time}~${s.plan.planned_end_page_or_time}`,
          start: s.start,
          end: s.end,
          precalc_start: s.plan._precalculated_start,
          precalc_end: s.plan._precalculated_end,
        })),
      });
    }

    let blockIndex = 1;
    const now = new Date().toISOString();

    for (const segment of timeSegments) {
      // O(1) 조회: 역방향 맵 사용
      const originalContentId =
        reverseContentIdMap.get(segment.plan.content_id) ||
        segment.plan.content_id;
      const metadata = contentMetadataMap.get(originalContentId) || {};

      // 원본 플랜 찾기 (회차 계산용)
      const originalPlanIndex = segment.plan._originalIndex ?? 0;
      const originalPlan = datePlans[originalPlanIndex];

      // 전체 플랜 컨텍스트에서 plan_number 추론
      // 같은 콘텐츠의 같은 범위를 가진 플랜들은 같은 plan_number를 가짐
      let planNumber: number | null = null;
      if (originalPlan) {
        const planKey = `${originalPlan.content_id}-${originalPlan.planned_start_page_or_time}-${originalPlan.planned_end_page_or_time}`;
        planNumber = planKeyToNumber.get(planKey) || null;
      }

      // 콘텐츠별 회차 계산 (날짜 순서 고려)
      const contentSequence = calculateContentSequence(
        segment.plan.content_id,
        planNumber,
        date
      );

      // 주차별 일차 계산
      let weekDay: number | null = null;
      if (dateMetadata.week_number) {
        const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
        const dayIndex = weekDates.indexOf(date);
        if (dayIndex >= 0) {
          weekDay = dayIndex + 1;
        }
      }

      planPayloads.push({
        plan_group_id: groupId,
        student_id: studentId,
        tenant_id: tenantId,
        plan_date: date,
        block_index: blockIndex,
        status: "pending",
        content_type: segment.plan.content_type,
        content_id: segment.plan.content_id,
        planned_start_page_or_time: segment.plan.planned_start_page_or_time,
        planned_end_page_or_time: segment.plan.planned_end_page_or_time,
        chapter: segment.plan.chapter || null,
        start_time: segment.start,
        end_time: segment.end,
        day_type: dateMetadata.day_type,
        week: dateMetadata.week_number,
        day: weekDay,
        is_partial: segment.isPartial,
        is_continued: segment.isContinued,
        content_title: metadata?.title || null,
        content_subject: metadata?.subject || null,
        content_subject_category: metadata?.subject_category || null,
        created_at: now,
        updated_at: now,
        sequence: contentSequence, // 콘텐츠별 회차 사용
        subject_type: originalPlan?.subject_type || null, // 전략/취약 정보
      });

      blockIndex++;
    }
  }

  // 14. 플랜 저장 전 검증
  if (planPayloads.length === 0) {
    throw new AppError(
      "저장할 플랜이 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 필수 필드 검증
  const invalidPayloads = planPayloads.filter(
    (p) =>
      !p.plan_group_id ||
      !p.student_id ||
      !p.tenant_id ||
      !p.content_id ||
      !p.plan_date
  );

  if (invalidPayloads.length > 0) {
    console.error(
      "[_generatePlansFromGroupRefactored] 유효하지 않은 플랜 페이로드:",
      {
        invalidCount: invalidPayloads.length,
        totalCount: planPayloads.length,
        sampleInvalid: invalidPayloads[0],
      }
    );
    throw new AppError(
      `${invalidPayloads.length}개의 플랜에 필수 필드가 누락되었습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 15. 플랜 일괄 저장
  const { error: insertError, data: insertedData } = await supabase
    .from("student_plan")
    .insert(planPayloads)
    .select();

  if (insertError) {
    // 상세한 에러 정보 로깅
    const errorDetails = {
      errorCode: insertError.code,
      errorMessage: insertError.message,
      errorDetails: insertError.details,
      errorHint: insertError.hint,
      planPayloadsCount: planPayloads.length,
      samplePayload: planPayloads[0], // 첫 번째 페이로드 샘플 (디버깅용)
    };

    console.error("[_generatePlansFromGroupRefactored] 플랜 저장 실패:", {
      ...errorDetails,
      fullError: insertError,
    });

    // 사용자 친화적인 에러 메시지 생성
    let userMessage = "플랜 저장에 실패했습니다.";

    if (insertError.message) {
      userMessage += ` ${insertError.message}`;
    }

    if (insertError.details) {
      userMessage += ` (${insertError.details})`;
    }

    if (insertError.hint) {
      userMessage += ` 힌트: ${insertError.hint}`;
    }

    // 특정 에러 코드에 대한 더 구체적인 메시지
    if (insertError.code === "23503") {
      userMessage =
        "참조 무결성 오류가 발생했습니다. 콘텐츠, 학생, 또는 플랜 그룹 정보를 확인해주세요.";
    } else if (insertError.code === "23505") {
      userMessage = "중복된 플랜이 이미 존재합니다.";
    } else if (insertError.code === "23502") {
      userMessage = "필수 필드가 누락되었습니다. 플랜 데이터를 확인해주세요.";
    } else if (insertError.code === "23514") {
      userMessage =
        "데이터 제약 조건을 위반했습니다. 플랜 데이터의 형식을 확인해주세요.";
    }

    throw new AppError(userMessage, ErrorCode.INTERNAL_ERROR, 500, true);
  }

  // 성공 시 로깅
  if (insertedData && insertedData.length > 0) {
    console.log(
      `[_generatePlansFromGroupRefactored] 플랜 저장 성공: ${insertedData.length}개 플랜 저장됨 (스케줄러 원본: ${scheduledPlans.length}개)`
    );
  }

  // 16. 플랜 그룹 상태 업데이트
  if ((group.status as PlanStatus) === "draft") {
    try {
      await updatePlanGroupStatus(groupId, "saved");
    } catch (error) {
      console.warn(
        "[_generatePlansFromGroupRefactored] 플랜 그룹 상태 변경 실패:",
        error
      );
    }
  }

  // 실제 저장된 플랜 수 반환 (episode별 분할 후 실제 저장된 수)
  return { count: insertedData?.length ?? 0 };
}

export const generatePlansFromGroupRefactoredAction = withErrorHandling(
  _generatePlansFromGroupRefactored
);

export { _generatePlansFromGroupRefactored };
