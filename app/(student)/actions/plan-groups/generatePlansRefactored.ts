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
  loadContentChapters,
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
  // RLS 정책을 고려하여 올바른 클라이언트 사용
  // - 관리자/컨설턴트가 다른 학생의 데이터를 조회할 경우 Admin 클라이언트 사용
  // - 그 외에는 학생용 클라이언트 사용
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

  // plan_contents의 content_id 해석: master_content_id가 있으면 우선 사용
  // - master_content_id가 있으면: 마스터 콘텐츠 ID (학생이 저장한 경우)
  // - 없으면: content_id 사용 (이미 학생 콘텐츠 ID이거나 관리자가 변환한 경우)
  const getResolvedContentId = (content: typeof contents[0]): string => {
    return content.master_content_id || content.content_id;
  };

  // 콘텐츠를 타입별로 분류 (더미 콘텐츠 제외)
  // resolvedContentId를 사용하여 마스터 콘텐츠 ID 우선 처리
  const bookContents = contents
    .filter((c) => c.content_type === "book" && !isDummyContent(c.content_id))
    .map((c) => ({
      ...c,
      resolvedContentId: getResolvedContentId(c),
    }));
  const lectureContents = contents
    .filter((c) => c.content_type === "lecture" && !isDummyContent(c.content_id))
    .map((c) => ({
      ...c,
      resolvedContentId: getResolvedContentId(c),
    }));
  const customContents = contents.filter(
    (c) => c.content_type === "custom" || isDummyContent(c.content_id)
  );

  // 더미/커스텀 콘텐츠는 그대로 매핑
  customContents.forEach((c) => contentIdMap.set(c.content_id, c.content_id));
  contents
    .filter((c) => isDummyContent(c.content_id))
    .forEach((c) => contentIdMap.set(c.content_id, c.content_id));

  // 배치 쿼리: 학생 콘텐츠 존재 여부 확인 (병렬)
  // resolvedContentId를 사용하여 조회 (마스터 콘텐츠 ID 우선)
  const [directBooksResult, directLecturesResult, masterBooksResult, masterLecturesResult] = await Promise.all([
    bookContents.length > 0
      ? queryClient
          .from("books")
          .select("id, master_content_id")
          .in("id", bookContents.map((c) => c.resolvedContentId))
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] }),
    lectureContents.length > 0
      ? queryClient
          .from("lectures")
          .select("id, master_content_id")
          .in("id", lectureContents.map((c) => c.resolvedContentId))
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] }),
    bookContents.length > 0
      ? queryClient
          .from("books")
          .select("id, master_content_id")
          .in(
            "master_content_id",
            bookContents.map((c) => c.resolvedContentId)
          )
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] }),
    lectureContents.length > 0
      ? queryClient
          .from("lectures")
          .select("id, master_content_id")
          .in(
            "master_content_id",
            lectureContents.map((c) => c.resolvedContentId)
          )
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] }),
  ]);

  // 직접 조회한 학생 콘텐츠 매핑 (plan_contents의 content_id가 이미 학생 콘텐츠 ID인 경우)
  // 원본 content_id를 찾아서 매핑해야 함
  (directBooksResult.data || []).forEach((b) => {
    // resolvedContentId가 b.id인 원본 content_id 찾기
    const originalContent = bookContents.find((c) => c.resolvedContentId === b.id);
    if (originalContent) {
      contentIdMap.set(originalContent.content_id, b.id);
    }
  });
  (directLecturesResult.data || []).forEach((l) => {
    // resolvedContentId가 l.id인 원본 content_id 찾기
    const originalContent = lectureContents.find((c) => c.resolvedContentId === l.id);
    if (originalContent) {
      contentIdMap.set(originalContent.content_id, l.id);
    }
  });

  // 마스터 콘텐츠 ID로 찾은 학생 콘텐츠 매핑
  const masterBooksMap = new Map(
    (masterBooksResult.data || []).map((b) => [b.master_content_id, b.id])
  );
  const masterLecturesMap = new Map(
    (masterLecturesResult.data || []).map((l) => [l.master_content_id, l.id])
  );

  // 마스터 콘텐츠 ID로 찾은 학생 콘텐츠 매핑
  // resolvedContentId를 키로 사용하여 매핑
  bookContents.forEach((c) => {
    // 이미 매핑되어 있으면 스킵 (원본 content_id로 확인)
    if (contentIdMap.has(c.content_id)) {
      return;
    }
    // resolvedContentId로 매핑 확인
    const existingId = masterBooksMap.get(c.resolvedContentId);
    if (existingId) {
      // 원본 content_id를 키로, 학생 콘텐츠 ID를 값으로 매핑
      contentIdMap.set(c.content_id, existingId);
    }
  });
  lectureContents.forEach((c) => {
    // 이미 매핑되어 있으면 스킵 (원본 content_id로 확인)
    if (contentIdMap.has(c.content_id)) {
      return;
    }
    // resolvedContentId로 매핑 확인
    const existingId = masterLecturesMap.get(c.resolvedContentId);
    if (existingId) {
      // 원본 content_id를 키로, 학생 콘텐츠 ID를 값으로 매핑
      contentIdMap.set(c.content_id, existingId);
    }
  });

  // 학생 콘텐츠가 없는 것들 필터링
  // resolvedContentId를 사용하여 마스터 콘텐츠 ID 추출
  const missingBookIds = bookContents
    .filter((c) => !contentIdMap.has(c.content_id))
    .map((c) => c.resolvedContentId);
  const missingLectureIds = lectureContents
    .filter((c) => !contentIdMap.has(c.content_id))
    .map((c) => c.resolvedContentId);

  // 플랜 생성 전 콘텐츠 검증: contentIdMap에 매핑되지 않은 콘텐츠 로그 기록
  if (missingBookIds.length > 0 || missingLectureIds.length > 0) {
    console.warn(
      `[generatePlansRefactored] contentIdMap에 매핑되지 않은 콘텐츠 발견:`,
      {
        groupId,
        studentId,
        missingBookIds,
        missingLectureIds,
        totalMissing: missingBookIds.length + missingLectureIds.length,
        totalContents: contents.length,
        message: "이 콘텐츠들은 플랜 생성 시 제외됩니다.",
      }
    );
  }

  // 배치 쿼리: 마스터 콘텐츠 존재 여부 확인 (병렬)
  const [masterBooksCheckResult, masterLecturesCheckResult] = await Promise.all([
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
    (masterBooksCheckResult.data || []).map((b) => b.id)
  );
  const masterLectureIds = new Set(
    (masterLecturesCheckResult.data || []).map((l) => l.id)
  );

  // 마스터 콘텐츠 복사 (복사는 순차 처리 필요 - DB 트랜잭션)
  // 복사 실패 시 contentIdMap에 매핑하지 않음 (외래 키 제약 조건 위반 방지)
  // missingBookIds와 missingLectureIds는 resolvedContentId를 포함하므로,
  // 복사 후 원본 content_id를 키로 매핑해야 함
  for (const resolvedContentId of missingBookIds) {
    if (masterBookIds.has(resolvedContentId)) {
      try {
        const copiedBook = await copyMasterBookToStudent(
          resolvedContentId,
          studentId,
          group.tenant_id
        );
        if (copiedBook?.bookId) {
          // 원본 content_id를 찾아서 매핑
          const originalContent = bookContents.find(
            (c) => c.resolvedContentId === resolvedContentId
          );
          if (originalContent) {
            contentIdMap.set(originalContent.content_id, copiedBook.bookId);
          }
        } else {
          console.warn(
            `[generatePlansRefactored] 마스터 교재(${resolvedContentId}) 복사 실패: bookId가 없습니다.`
          );
          // 복사 실패 시 contentIdMap에 매핑하지 않음
        }
      } catch (error) {
        console.error(
          `[generatePlansRefactored] 마스터 교재(${resolvedContentId}) 복사 실패:`,
          error
        );
        // 복사 실패 시 contentIdMap에 매핑하지 않음
      }
    } else {
      // 마스터 콘텐츠가 아닌 경우 원본 ID를 그대로 사용하지 않음
      // plan_contents에 이미 저장된 콘텐츠 ID이므로 contentIdMap에 매핑하지 않음
      console.warn(
        `[generatePlansRefactored] 교재(${resolvedContentId})가 마스터 교재가 아니며 학생 교재로도 찾을 수 없습니다.`
      );
    }
  }

  for (const resolvedContentId of missingLectureIds) {
    if (masterLectureIds.has(resolvedContentId)) {
      try {
        const copiedLecture = await copyMasterLectureToStudent(
          resolvedContentId,
          studentId,
          group.tenant_id
        );
        if (copiedLecture?.lectureId) {
          // 원본 content_id를 찾아서 매핑
          const originalContent = lectureContents.find(
            (c) => c.resolvedContentId === resolvedContentId
          );
          if (originalContent) {
            contentIdMap.set(originalContent.content_id, copiedLecture.lectureId);
          }
        } else {
          console.warn(
            `[generatePlansRefactored] 마스터 강의(${resolvedContentId}) 복사 실패: lectureId가 없습니다.`
          );
          // 복사 실패 시 contentIdMap에 매핑하지 않음
        }
      } catch (error) {
        console.error(
          `[generatePlansRefactored] 마스터 강의(${resolvedContentId}) 복사 실패:`,
          error
        );
        // 복사 실패 시 contentIdMap에 매핑하지 않음
      }
    } else {
      // 마스터 콘텐츠가 아닌 경우 원본 ID를 그대로 사용하지 않음
      // plan_contents에 이미 저장된 콘텐츠 ID이므로 contentIdMap에 매핑하지 않음
      console.warn(
        `[generatePlansRefactored] 강의(${resolvedContentId})가 마스터 강의가 아니며 학생 강의로도 찾을 수 없습니다.`
      );
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

  // 9.5. 콘텐츠 chapter 정보 조회 (start_detail_id/end_detail_id 사용)
  const contentChapterMap = await loadContentChapters(
    contents,
    contentIdMap,
    studentId,
    queryClient
  );

  // 10. 스케줄러 호출 (플랜 생성)
  let scheduledPlans: import("@/lib/plan/scheduler").ScheduledPlan[];
  try {
    // generatePlansFromGroup에 전달하기 전에 contents의 content_id를 변환
    // contentIdMap에 매핑되지 않은 콘텐츠는 제외 (외래 키 제약 조건 위반 방지)
    const transformedContents = contents
      .filter((c) => {
        // 더미 콘텐츠는 항상 포함
        if (isDummyContent(c.content_id)) {
          return true;
        }
        // contentIdMap에 매핑된 콘텐츠만 포함
        return contentIdMap.has(c.content_id);
      })
      .map((c) => {
        // contentIdMap에서 학생 콘텐츠 ID 가져오기
        const finalContentId = contentIdMap.get(c.content_id) || c.content_id;
        return {
          ...c,
          content_id: finalContentId,
        };
      });

    // 변환된 콘텐츠가 없는 경우 에러
    if (transformedContents.length === 0) {
      const unmappedContents = contents.filter(
        (c) => !contentIdMap.has(c.content_id) && !isDummyContent(c.content_id)
      );
      throw new AppError(
        `플랜 생성에 실패했습니다. 모든 콘텐츠가 contentIdMap에 매핑되지 않았습니다. (${unmappedContents.length}개 콘텐츠 제외)`,
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // contentIdMap에 매핑되지 않은 콘텐츠가 있으면 경고
    const excludedContents = contents.filter(
      (c) => !contentIdMap.has(c.content_id) && !isDummyContent(c.content_id)
    );
    if (excludedContents.length > 0) {
      console.warn(
        `[generatePlansRefactored] contentIdMap에 매핑되지 않은 ${excludedContents.length}개 콘텐츠가 플랜 생성에서 제외됩니다:`,
        {
          groupId,
          studentId,
          excludedContentIds: excludedContents.map((c) => ({
            content_id: c.content_id.substring(0, 8) + "...",
            content_type: c.content_type,
            master_content_id: c.master_content_id?.substring(0, 8) + "..." || null,
          })),
        }
      );
    }

    scheduledPlans = await generatePlansFromGroup(
      group,
      transformedContents,
      exclusions,
      academySchedules,
      [],
      undefined,
      undefined,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap,
      contentChapterMap // chapter 정보 전달
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
  // 관리자/컨설턴트가 다른 학생의 플랜을 삭제할 때는 queryClient(Admin 클라이언트) 사용
  const { error: deleteError } = await queryClient
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
    // contentIdMap에 없는 콘텐츠는 제외 (마스터 콘텐츠 복사 실패 시 외래 키 제약 조건 위반 방지)
    const excludedContents: Array<{
      content_id: string;
      content_type: string;
      reason: string;
    }> = [];
    
    const plansForAssign = datePlans
      .map((plan, originalIndex) => {
        const finalContentId = contentIdMap.get(plan.content_id);
        // contentIdMap에 없는 경우 null 반환하여 필터링
        if (!finalContentId) {
          excludedContents.push({
            content_id: plan.content_id,
            content_type: plan.content_type,
            reason: "contentIdMap에 매핑되지 않음 (학생 콘텐츠가 존재하지 않거나 복사 실패)",
          });
          return null;
        }
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
      })
      .filter((plan): plan is NonNullable<typeof plan> => plan !== null);

    // 제외된 콘텐츠 로그 기록
    if (excludedContents.length > 0) {
      console.warn(
        `[generatePlansRefactored] ${date} 플랜 생성 시 제외된 콘텐츠:`,
        {
          date,
          excludedCount: excludedContents.length,
          totalPlans: datePlans.length,
          excludedContents: excludedContents.map((c) => ({
            content_id: c.content_id.substring(0, 8) + "...",
            content_type: c.content_type,
            reason: c.reason,
          })),
        }
      );
    }

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
      // transformedContents를 사용했으므로 segment.plan.content_id는 이미 학생 콘텐츠 ID
      // 원본 content_id를 찾기 위해 reverseContentIdMap 사용 (메타데이터 조회용)
      const originalContentId =
        reverseContentIdMap.get(segment.plan.content_id) ||
        segment.plan.content_id;
      const metadata = contentMetadataMap.get(originalContentId) || {};

      // transformedContents를 사용했으므로 segment.plan.content_id는 이미 변환된 학생 콘텐츠 ID
      // 추가 변환 불필요
      const finalContentId = segment.plan.content_id;

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
        finalContentId,
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
        content_id: finalContentId,
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
    // contentIdMap에 매핑되지 않은 콘텐츠 정보 포함
    const unmappedContents = contents.filter(
      (c) => !contentIdMap.has(c.content_id) && !isDummyContent(c.content_id)
    );
    
    const errorMessage = unmappedContents.length > 0
      ? `저장할 플랜이 없습니다. ${unmappedContents.length}개의 콘텐츠가 contentIdMap에 매핑되지 않았습니다. 콘텐츠 ID: ${unmappedContents.map((c) => c.content_id.substring(0, 8)).join(", ")}`
      : "저장할 플랜이 없습니다.";
    
    throw new AppError(
      errorMessage,
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

  // 플랜 저장 전 콘텐츠 존재 여부 검증 (외래 키 제약 조건 위반 방지)
  // planPayloads의 content_id는 이미 contentIdMap을 통해 변환된 학생 콘텐츠 ID
  const uniqueContentIds = new Set(
    planPayloads.map((p) => p.content_id).filter((id) => id)
  );
  
  // 콘텐츠 타입별로 분류
  const contentIdsByType = {
    book: planPayloads
      .filter((p) => p.content_type === "book" && p.content_id)
      .map((p) => p.content_id),
    lecture: planPayloads
      .filter((p) => p.content_type === "lecture" && p.content_id)
      .map((p) => p.content_id),
    custom: planPayloads
      .filter((p) => p.content_type === "custom" && p.content_id)
      .map((p) => p.content_id),
  };

  // 콘텐츠 존재 여부 확인 (병렬)
  // 관리자/컨설턴트가 다른 학생의 데이터를 조회할 경우 Admin 클라이언트 사용
  // RLS 정책으로 인한 조회 실패를 방지하기 위해 Admin 클라이언트 우선 사용
  const verificationClient = isAdminOrConsultant && studentId !== access.user.userId
    ? ensureAdminClient()
    : queryClient;

  const [booksCheck, lecturesCheck] = await Promise.all([
    contentIdsByType.book.length > 0
      ? verificationClient
          .from("books")
          .select("id")
          .in("id", contentIdsByType.book)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
    contentIdsByType.lecture.length > 0
      ? verificationClient
          .from("lectures")
          .select("id")
          .in("id", contentIdsByType.lecture)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 에러 처리: 조회 실패 시 Admin 클라이언트로 재시도
  let finalBooksCheck = booksCheck;
  let finalLecturesCheck = lecturesCheck;

  if (booksCheck.error || lecturesCheck.error) {
    console.warn(
      "[_generatePlansFromGroupRefactored] 콘텐츠 조회 실패, Admin 클라이언트로 재시도:",
      {
        booksError: booksCheck.error?.message,
        lecturesError: lecturesCheck.error?.message,
        groupId,
        studentId,
        isAdminOrConsultant,
        verificationClientType: isAdminOrConsultant && studentId !== access.user.userId ? "Admin" : "Server",
      }
    );
    
    // Admin 클라이언트로 재시도
    const adminClient = ensureAdminClient();
    [finalBooksCheck, finalLecturesCheck] = await Promise.all([
      contentIdsByType.book.length > 0
        ? adminClient
            .from("books")
            .select("id")
            .in("id", contentIdsByType.book)
            .eq("student_id", studentId)
        : Promise.resolve({ data: [], error: null }),
      contentIdsByType.lecture.length > 0
        ? adminClient
            .from("lectures")
            .select("id")
            .in("id", contentIdsByType.lecture)
            .eq("student_id", studentId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // 재시도 후에도 에러가 있으면 로그만 남기고 계속 진행
    if (finalBooksCheck.error || finalLecturesCheck.error) {
      console.error(
        "[_generatePlansFromGroupRefactored] Admin 클라이언트로도 조회 실패:",
        {
          booksError: finalBooksCheck.error?.message,
          lecturesError: finalLecturesCheck.error?.message,
          groupId,
          studentId,
        }
      );
    }
  }

  const existingBookIds = new Set((finalBooksCheck.data || []).map((b) => b.id));
  const existingLectureIds = new Set((finalLecturesCheck.data || []).map((l) => l.id));

  // 존재하지 않는 콘텐츠 필터링
  const missingBooks = contentIdsByType.book.filter((id) => !existingBookIds.has(id));
  const missingLectures = contentIdsByType.lecture.filter((id) => !existingLectureIds.has(id));

  if (missingBooks.length > 0 || missingLectures.length > 0) {
    console.error(
      "[_generatePlansFromGroupRefactored] 존재하지 않는 콘텐츠 발견:",
      {
        groupId,
        studentId,
        missingBooks,
        missingLectures,
        totalMissing: missingBooks.length + missingLectures.length,
        booksCheckError: finalBooksCheck.error?.message,
        lecturesCheckError: finalLecturesCheck.error?.message,
        message: "이 콘텐츠들은 플랜에서 제외됩니다.",
      }
    );
    
    // 존재하지 않는 콘텐츠를 포함한 플랜 제외
    const validPlanPayloads = planPayloads.filter((p) => {
      if (p.content_type === "book") {
        return existingBookIds.has(p.content_id);
      }
      if (p.content_type === "lecture") {
        return existingLectureIds.has(p.content_id);
      }
      return true; // custom 콘텐츠는 검증하지 않음
    });

    if (validPlanPayloads.length === 0) {
      throw new AppError(
        `플랜 생성에 실패했습니다. 모든 콘텐츠가 존재하지 않습니다. (교재: ${missingBooks.length}개, 강의: ${missingLectures.length}개)`,
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    console.warn(
      `[generatePlansRefactored] 존재하지 않는 콘텐츠를 포함한 ${planPayloads.length - validPlanPayloads.length}개의 플랜이 제외되었습니다.`
    );
    
    // 유효한 플랜만 사용
    planPayloads.length = 0;
    planPayloads.push(...validPlanPayloads);
  }

  // 최종 검증: 모든 플랜의 content_id가 검증된 콘텐츠인지 확인
  const allContentIds = new Set([
    ...contentIdsByType.book,
    ...contentIdsByType.lecture,
    ...contentIdsByType.custom,
  ]);
  const verifiedContentIds = new Set([
    ...existingBookIds,
    ...existingLectureIds,
    ...contentIdsByType.custom, // custom 콘텐츠는 검증하지 않음
  ]);

  const unverifiedPlans = planPayloads.filter(
    (p) => p.content_id && !verifiedContentIds.has(p.content_id)
  );

  if (unverifiedPlans.length > 0) {
    console.error(
      "[_generatePlansFromGroupRefactored] 검증되지 않은 콘텐츠를 포함한 플랜 발견:",
      {
        groupId,
        studentId,
        unverifiedPlansCount: unverifiedPlans.length,
        unverifiedContentIds: unverifiedPlans.map((p) => ({
          content_id: p.content_id?.substring(0, 8) + "...",
          content_type: p.content_type,
        })),
        message: "이 플랜들은 제외됩니다.",
      }
    );

    // 검증되지 않은 플랜 제외
    const finalValidPlanPayloads = planPayloads.filter(
      (p) => !p.content_id || verifiedContentIds.has(p.content_id)
    );

    if (finalValidPlanPayloads.length === 0) {
      throw new AppError(
        `플랜 생성에 실패했습니다. 모든 플랜이 검증되지 않았습니다.`,
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    console.warn(
      `[generatePlansRefactored] 검증되지 않은 콘텐츠를 포함한 ${planPayloads.length - finalValidPlanPayloads.length}개의 플랜이 제외되었습니다.`
    );

    planPayloads.length = 0;
    planPayloads.push(...finalValidPlanPayloads);
  }

  // 15. 플랜 일괄 저장
  // 관리자/컨설턴트가 다른 학생의 플랜을 생성할 때는 queryClient(Admin 클라이언트) 사용
  const { error: insertError, data: insertedData } = await queryClient
    .from("student_plan")
    .insert(planPayloads)
    .select();

  if (insertError) {
    // 외래 키 제약 조건 위반 에러인지 확인
    const isForeignKeyError =
      insertError.message?.includes("does not exist") ||
      insertError.message?.includes("foreign key") ||
      insertError.code === "23503";

    if (isForeignKeyError) {
      // 문제가 되는 콘텐츠 ID 추출
      const contentIdMatch = insertError.message?.match(/Referenced (book|lecture) \(([^)]+)\)/);
      const problematicContentId = contentIdMatch?.[2];
      const contentType = contentIdMatch?.[1] || "unknown";

      // 해당 콘텐츠가 planPayloads에 있는지 확인
      const problematicPlans = planPayloads.filter(
        (p) => p.content_id === problematicContentId
      );

      console.error(
        "[_generatePlansFromGroupRefactored] 외래 키 제약 조건 위반:",
        {
          groupId,
          studentId,
          errorCode: insertError.code,
          errorMessage: insertError.message,
          problematicContentId,
          contentType,
          problematicPlansCount: problematicPlans.length,
          totalPlans: planPayloads.length,
          contentIdMapSize: contentIdMap.size,
          contentsCount: contents.length,
          message: "콘텐츠가 존재하지 않거나 contentIdMap에 매핑되지 않았습니다.",
        }
      );

      throw new AppError(
        `플랜 저장에 실패했습니다. ${contentType === "lecture" ? "강의" : contentType === "book" ? "교재" : "콘텐츠"}(${problematicContentId?.substring(0, 8)}...)가 존재하지 않습니다. 콘텐츠가 삭제되었거나 contentIdMap에 매핑되지 않았을 수 있습니다.`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

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
  // 관리자/컨설턴트가 다른 학생의 플랜을 생성할 때도 작동하도록 직접 업데이트
  if ((group.status as PlanStatus) === "draft") {
    try {
      const { error: statusUpdateError } = await queryClient
        .from("plan_groups")
        .update({ status: "saved", updated_at: new Date().toISOString() })
        .eq("id", groupId);

      if (statusUpdateError) {
        throw statusUpdateError;
      }
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
