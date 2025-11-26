"use server";

import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanGroupById, getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { timeToMinutes } from "./utils";
import type { CalculateOptions } from "@/lib/scheduler/calculateAvailableDates";

/**
 * 플랜 그룹의 플랜 목록 조회
 */
async function _getPlansByGroupId(groupId: string): Promise<{
  plans: Array<{
    id: string;
    plan_date: string;
    block_index: number | null;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    is_reschedulable: boolean;
    sequence: number | null;
  }>;
}> {
  const user = await requireStudentAuth();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_plan")
    .select(
      "id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,is_reschedulable,sequence"
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (error) {
    console.error("[planGroupActions] 플랜 조회 실패", error);
    throw new AppError(
      error.message || "플랜 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return {
    plans: (data || []).map((plan) => ({
      id: plan.id,
      plan_date: plan.plan_date || "",
      block_index: plan.block_index,
      content_type: plan.content_type || "",
      content_id: plan.content_id || "",
      chapter: plan.chapter,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      completed_amount: plan.completed_amount,
      is_reschedulable: plan.is_reschedulable || false,
      sequence: (plan as any).sequence ?? null,
    })),
  };
}

/**
 * 플랜 그룹에 플랜이 생성되었는지 확인
 */
async function _checkPlansExist(groupId: string): Promise<{
  hasPlans: boolean;
  planCount: number;
}> {
  const user = await requireStudentAuth();

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("student_plan")
    .select("*", { count: "exact", head: true })
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId);

  if (error) {
    console.error("[planGroupActions] 플랜 개수 확인 실패", error);
    throw new AppError(
      error.message || "플랜 개수 확인에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return {
    hasPlans: (count ?? 0) > 0,
    planCount: count ?? 0,
  };
}

/**
 * 플랜 그룹의 스케줄 결과 데이터 조회 (표 형식 변환용)
 */
async function _getScheduleResultData(groupId: string): Promise<{
  plans: Array<{
    id: string;
    plan_date: string;
    block_index: number | null;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    plan_number: number | null;
    sequence: number | null;
  }>;
  periodStart: string;
  periodEnd: string | null;
  schedulerType: string | null;
  schedulerOptions: any;
  contents: Array<{
    id: string;
    title: string;
    subject?: string | null;
    subject_category?: string | null;
    total_pages?: number | null;
    duration?: number | null;
    total_page_or_time?: number | null;
  }>;
  blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    block_index: number;
  }>;
  dateTimeSlots: Record<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  >;
  dailySchedule: Array<{
    date: string;
    day_type: string;
    study_hours: number;
    time_slots?: Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>;
    exclusion?: {
      exclusion_type: string;
      reason?: string;
    } | null;
    academy_schedules?: Array<{
      academy_name?: string;
      subject?: string;
      start_time: string;
      end_time: string;
    }>;
  }>;
}> {
  const userRole = await getCurrentUserRole();
  if (
    !userRole.userId ||
    (!userRole.role ||
      (userRole.role !== "student" &&
        userRole.role !== "admin" &&
        userRole.role !== "consultant"))
  ) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // tenantId 조회
  const tenantContext = await getTenantContext();
  const tenantId = tenantContext?.tenantId || null;

  // 관리자/컨설턴트인 경우 플랜 그룹을 먼저 조회하여 student_id 가져오기
  let targetStudentId: string;
  let groupQuery = supabase
    .from("plan_groups")
    .select(
      "period_start, period_end, block_set_id, scheduler_type, scheduler_options, daily_schedule, student_id, plan_type, camp_template_id"
    )
    .eq("id", groupId);

  // 학생인 경우 student_id로 필터링
  if (userRole.role === "student") {
    groupQuery = groupQuery.eq("student_id", userRole.userId);
    targetStudentId = userRole.userId;
  } else {
    // 관리자/컨설턴트인 경우 tenant_id로 필터링
    if (tenantId) {
      groupQuery = groupQuery.eq("tenant_id", tenantId);
    }
  }

  const { data: group, error: groupError } = await groupQuery.maybeSingle();

  if (groupError) {
    console.error("[planGroupActions] 플랜 그룹 조회 오류:", groupError);
    throw new AppError(
      `플랜 그룹 정보를 조회할 수 없습니다: ${groupError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: groupError }
    );
  }

  if (!group) {
    console.error("[planGroupActions] 플랜 그룹을 찾을 수 없음:", {
      groupId,
      userId: userRole.userId,
    });
    throw new AppError(
      "플랜 그룹 정보를 조회할 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 관리자/컨설턴트인 경우 플랜 그룹의 student_id 사용
  if (userRole.role !== "student") {
    if (!group.student_id) {
      throw new AppError(
        "플랜 그룹에 학생 정보가 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }
    targetStudentId = group.student_id;
  }

  // 2. 플랜 데이터 조회
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select(
      "id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,plan_number,sequence"
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", targetStudentId)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (plansError) {
    throw new AppError(
      plansError.message || "플랜 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: plansError }
    );
  }

  // 3. 콘텐츠 데이터 조회 (총량/duration 정보 포함)
  const contentIds = new Set((plans || []).map((p) => p.content_id));
  const contentsMap = new Map<
    string,
    {
      id: string;
      title: string;
      subject?: string | null;
      subject_category?: string | null;
      total_pages?: number | null; // 책의 경우
      duration?: number | null; // 강의의 경우
      total_page_or_time?: number | null; // 커스텀의 경우
    }
  >();

  // 책 조회
  const bookPlans = (plans || []).filter((p) => p.content_type === "book");
  const bookIds = Array.from(new Set(bookPlans.map((p) => p.content_id)));

  if (bookIds.length > 0) {
    const { data: books } = await supabase
      .from("books")
      .select("id, title, subject, subject_category, total_pages")
      .in("id", bookIds)
      .eq("student_id", targetStudentId);

    books?.forEach((book) => {
      contentsMap.set(book.id, {
        id: book.id,
        title: book.title || "",
        subject: book.subject || null,
        subject_category: book.subject_category || null,
        total_pages: book.total_pages || null,
      });
    });

    // 마스터 책 조회 (학생 책에 없는 경우)
    const foundBookIds = new Set(books?.map((b) => b.id) || []);
    const missingBookIds = bookIds.filter((id) => !foundBookIds.has(id));

    if (missingBookIds.length > 0) {
      const { data: masterBooks } = await supabase
        .from("master_books")
        .select("id, title, subject, subject_category, total_pages")
        .in("id", missingBookIds);

      masterBooks?.forEach((book) => {
        contentsMap.set(book.id, {
          id: book.id,
          title: book.title || "",
          subject: book.subject || null,
          subject_category: book.subject_category || null,
          total_pages: book.total_pages || null,
        });
      });
    }
  }

  // 강의 조회
  const lecturePlans = (plans || []).filter(
    (p) => p.content_type === "lecture"
  );
  const lectureIds = Array.from(new Set(lecturePlans.map((p) => p.content_id)));

  if (lectureIds.length > 0) {
    const { data: lectures } = await supabase
      .from("lectures")
      .select("id, title, subject, subject_category, duration")
      .in("id", lectureIds)
      .eq("student_id", targetStudentId);

    lectures?.forEach((lecture) => {
      contentsMap.set(lecture.id, {
        id: lecture.id,
        title: lecture.title || "",
        subject: lecture.subject || null,
        subject_category: lecture.subject_category || null,
        duration: lecture.duration || null,
      });
    });

    // 마스터 강의 조회 (학생 강의에 없는 경우)
    const foundLectureIds = new Set(lectures?.map((l) => l.id) || []);
    const missingLectureIds = lectureIds.filter(
      (id) => !foundLectureIds.has(id)
    );

    if (missingLectureIds.length > 0) {
      const { data: masterLectures } = await supabase
        .from("master_lectures")
        .select("id, title, subject, subject_category, total_duration")
        .in("id", missingLectureIds);

      masterLectures?.forEach((lecture) => {
        contentsMap.set(lecture.id, {
          id: lecture.id,
          title: lecture.title || "",
          subject: lecture.subject || null,
          subject_category: lecture.subject_category || null,
          duration: lecture.total_duration || null, // 마스터 강의는 total_duration
        });
      });
    }
  }

  // 커스텀 콘텐츠 조회
  const customPlans = (plans || []).filter((p) => p.content_type === "custom");
  const customIds = Array.from(new Set(customPlans.map((p) => p.content_id)));

  if (customIds.length > 0) {
    const { data: customContents } = await supabase
      .from("student_custom_contents")
      .select("id, title, subject, subject_category, total_page_or_time")
      .in("id", customIds)
      .eq("student_id", targetStudentId);

    customContents?.forEach((custom) => {
      contentsMap.set(custom.id, {
        id: custom.id,
        title: custom.title || "",
        subject: custom.subject || null,
        subject_category: custom.subject_category || null,
        total_page_or_time: custom.total_page_or_time || null,
      });
    });
  }

  // 4. 블록 데이터 조회 (플랜 생성 시와 동일한 방식으로 block_index 재할당)
  let blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    block_index: number;
  }> = [];

  if (group.block_set_id) {
    const { data: blockData } = await supabase
      .from("student_block_schedule")
      .select("id, day_of_week, start_time, end_time, block_index")
      .eq("block_set_id", group.block_set_id)
      .eq("student_id", targetStudentId);

    if (blockData && blockData.length > 0) {
      // day_of_week별로 그룹화하여 block_index 재할당 (플랜 생성 시와 동일)
      const blocksByDay = new Map<number, typeof blockData>();
      blockData.forEach((b) => {
        const day = b.day_of_week;
        if (!blocksByDay.has(day)) {
          blocksByDay.set(day, []);
        }
        blocksByDay.get(day)!.push(b);
      });

      blocks = Array.from(blocksByDay.entries()).flatMap(([day, dayBlocks]) => {
        // 같은 day_of_week 내에서 start_time으로 정렬
        const sorted = [...dayBlocks].sort((a, b) => {
          const aTime = timeToMinutes(a.start_time);
          const bTime = timeToMinutes(b.start_time);
          return aTime - bTime;
        });

        return sorted.map((b, index) => ({
          id: b.id,
          day_of_week: day,
          block_index: index + 1, // 같은 day_of_week 내에서 1부터 시작
          start_time: b.start_time,
          end_time: b.end_time,
        }));
      });
    }
  }

  // 5. Step 2.5 스케줄 결과 조회 (time_slots 정보 포함)
  // 저장된 dailySchedule이 있으면 사용, 없으면 계산
  let dailySchedule: Array<{
    date: string;
    day_type: string;
    study_hours: number;
    time_slots?: Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>;
    exclusion?: {
      exclusion_type: string;
      reason?: string;
    } | null;
    academy_schedules?: Array<{
      academy_name?: string;
      subject?: string;
      start_time: string;
      end_time: string;
    }>;
  }> = [];

  /**
   * 저장된 daily_schedule 유효성 검증 함수
   */
  const isValidDailySchedule = (
    storedSchedule: any[],
    periodStart: string | null,
    periodEnd: string | null
  ): boolean => {
    if (
      !storedSchedule ||
      !Array.isArray(storedSchedule) ||
      storedSchedule.length === 0
    ) {
      return false;
    }

    // 기간 확인: 저장된 스케줄의 날짜 범위가 현재 기간과 일치하는지 확인
    if (periodStart && periodEnd) {
      const scheduleDates = storedSchedule.map((d) => d.date).sort();
      const firstDate = scheduleDates[0];
      const lastDate = scheduleDates[scheduleDates.length - 1];

      if (firstDate !== periodStart || lastDate !== periodEnd) {
        return false;
      }
    }

    // 기본 구조 확인: 각 항목에 필수 필드가 있는지 확인
    const hasRequiredFields = storedSchedule.every(
      (d) => d.date && d.day_type !== undefined && d.study_hours !== undefined
    );

    if (!hasRequiredFields) {
      return false;
    }

    return true;
  };

  /**
   * 재계산 필요 여부 판단 함수
   */
  const shouldRecalculateDailySchedule = (group: {
    daily_schedule: any;
    period_start: string | null;
    period_end: string | null;
  }): {
    shouldRecalculate: boolean;
    storedSchedule: typeof dailySchedule | null;
  } => {
    // 저장된 daily_schedule이 없으면 재계산 필요
    if (
      !group.daily_schedule ||
      !Array.isArray(group.daily_schedule) ||
      group.daily_schedule.length === 0
    ) {
      return { shouldRecalculate: true, storedSchedule: null };
    }

    // 유효성 검증
    const isValid = isValidDailySchedule(
      group.daily_schedule,
      group.period_start,
      group.period_end
    );

    if (isValid) {
      // 저장된 데이터 사용
      return {
        shouldRecalculate: false,
        storedSchedule: group.daily_schedule as typeof dailySchedule,
      };
    } else {
      // 유효하지 않으면 재계산
      return { shouldRecalculate: true, storedSchedule: null };
    }
  };

  // 재계산 필요 여부 판단
  const { shouldRecalculate, storedSchedule } =
    shouldRecalculateDailySchedule(group);

  if (!shouldRecalculate && storedSchedule) {
    // 저장된 데이터 사용
    dailySchedule = storedSchedule;
  } else {
    // 재계산 필요
    // 저장된 데이터가 없으면 계산
    const { calculateAvailableDates } = await import(
      "@/lib/scheduler/calculateAvailableDates"
    );

    // 제외일 및 학원 일정 조회 (getPlanGroupWithDetails 사용 - 일관성 유지)
    let exclusions: Array<{
      exclusion_date: string;
      exclusion_type: string;
      reason?: string | null;
    }> = [];
    let academySchedules: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      academy_name?: string | null;
      subject?: string | null;
      travel_time?: number | null;
    }> = [];

    try {
      const result = await getPlanGroupWithDetails(
        groupId,
        targetStudentId,
        tenantId
      );
      exclusions = result.exclusions || [];
      academySchedules = result.academySchedules || [];
    } catch (error) {
      console.error(
        "[planGroupActions] 제외일/학원일정 조회 실패, 폴백 로직 사용:",
        error
      );

      // 폴백: 저장된 daily_schedule에서 exclusion 정보 추출
      if (group.daily_schedule && Array.isArray(group.daily_schedule)) {
        exclusions = group.daily_schedule
          .filter((d) => d.exclusion)
          .map((d) => ({
            exclusion_date: d.date,
            exclusion_type: d.exclusion!.exclusion_type,
            reason: d.exclusion!.reason || null,
          }));
        console.log(
          "[planGroupActions] 저장된 daily_schedule에서 제외일 정보 추출:",
          exclusions.length,
          "개"
        );
      }

      // 학원 일정은 academy_schedules 테이블에서 조회
      try {
        const { data: academyData } = await supabase
          .from("academy_schedules")
          .select(
            "day_of_week, start_time, end_time, subject, travel_time_minutes, academy_id"
          )
          .eq("student_id", targetStudentId);

        if (academyData) {
          // academy_schedules 형식에 맞게 변환
          academySchedules = academyData.map((item) => ({
            day_of_week: item.day_of_week,
            start_time: item.start_time,
            end_time: item.end_time,
            subject: item.subject,
            travel_time: item.travel_time_minutes ?? 0,
            academy_name: null, // academy_id로 조회 필요시 별도 처리
          }));
        }
      } catch (academyError) {
        console.error(
          "[planGroupActions] 학원 일정 조회 실패 (무시됨):",
          academyError
        );
      }
    }

    // 기간 필터링 (제외일만)
    const filteredExclusions = (exclusions || []).filter((e) => {
      if (!group.period_start || !group.period_end) return true;
      return (
        e.exclusion_date >= group.period_start &&
        e.exclusion_date <= group.period_end
      );
    });

    // 블록 세트에서 기본 블록 정보 가져오기
    let baseBlocks: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];

    // 캠프 모드: 템플릿 블록 조회
    if (group.plan_type === "camp" && group.camp_template_id) {
      // 연결 테이블에서 템플릿에 연결된 블록 세트 조회
      const { data: templateBlockSetLink } = await supabase
        .from("camp_template_block_sets")
        .select("tenant_block_set_id")
        .eq("camp_template_id", group.camp_template_id)
        .maybeSingle();

      let templateBlockSetId: string | null = null;
      if (templateBlockSetLink) {
        templateBlockSetId = templateBlockSetLink.tenant_block_set_id;
      } else {
        // 하위 호환성: template_data.block_set_id 확인 (마이그레이션 전 데이터용)
        const { getCampTemplate } = await import("@/lib/data/campTemplates");
        const template = await getCampTemplate(group.camp_template_id);
        if (template && template.template_data) {
          const templateData = template.template_data as any;
          templateBlockSetId = templateData.block_set_id || null;
        }
      }

      if (templateBlockSetId) {
        const { data: blockRows, error: blocksError } = await supabase
          .from("tenant_blocks")
          .select("day_of_week, start_time, end_time")
          .eq("tenant_block_set_id", templateBlockSetId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blocksError) {
          console.error("[planGroupActions] 테넌트 블록 조회 실패:", blocksError);
        } else if (blockRows && blockRows.length > 0) {
          baseBlocks = blockRows.map((b) => ({
            day_of_week: b.day_of_week || 0,
            start_time: b.start_time || "00:00",
            end_time: b.end_time || "00:00",
          }));
        }
      }
    }

    // 일반 모드: 학생 블록 세트 조회
    if (baseBlocks.length === 0 && group.block_set_id) {
      const { data: blockSet } = await supabase
        .from("student_block_sets")
        .select("id, name, student_id")
        .eq("id", group.block_set_id)
        .maybeSingle();

      if (blockSet) {
        const blockSetOwnerId = blockSet.student_id;
        const { data: blockRows } = await supabase
          .from("student_block_schedule")
          .select("day_of_week, start_time, end_time")
          .eq("block_set_id", group.block_set_id)
          .eq("student_id", blockSetOwnerId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blockRows && blockRows.length > 0) {
          baseBlocks = blockRows.map((b) => ({
            day_of_week: b.day_of_week || 0,
            start_time: b.start_time || "00:00",
            end_time: b.end_time || "00:00",
          }));
        }
      }
    }

    if (baseBlocks.length > 0 && group.period_start && group.period_end) {
      try {
        const scheduleResult = calculateAvailableDates(
          group.period_start,
          group.period_end,
          baseBlocks.map((b) => ({
            day_of_week: b.day_of_week,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
          filteredExclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type as
              | "휴가"
              | "개인사정"
              | "휴일지정"
              | "기타",
            reason: e.reason || undefined,
          })),
          (academySchedules || []).map((a) => ({
            day_of_week: a.day_of_week,
            start_time: a.start_time,
            end_time: a.end_time,
            academy_name: a.academy_name || undefined,
            subject: a.subject || undefined,
            travel_time: a.travel_time || undefined,
          })),
          (() => {
            const options: CalculateOptions = {
              scheduler_type: "1730_timetable" as const,
              scheduler_options: group.scheduler_options || null,
              use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
              enable_self_study_for_holidays:
                (group.scheduler_options as any)
                  ?.enable_self_study_for_holidays === true,
              enable_self_study_for_study_days:
                (group.scheduler_options as any)
                  ?.enable_self_study_for_study_days === true,
              lunch_time: (group.scheduler_options as any)?.lunch_time,
              camp_study_hours: (group.scheduler_options as any)
                ?.camp_study_hours,
              camp_self_study_hours: (group.scheduler_options as any)
                ?.camp_self_study_hours,
              designated_holiday_hours: (group.scheduler_options as any)
                ?.designated_holiday_hours,
            };

            return options;
          })()
        );

        // daily_schedule 전체 정보 저장 (Step 2.5와 동일한 구조)
        dailySchedule = scheduleResult.daily_schedule.map((daily) => ({
          date: daily.date,
          day_type: daily.day_type,
          study_hours: daily.study_hours,
          time_slots: daily.time_slots, // 자율학습 시간이 포함된 time_slots
          exclusion: daily.exclusion,
          academy_schedules: daily.academy_schedules,
        }));

        // 자율학습 시간이 포함된 날짜 확인
        const selfStudyDays = dailySchedule.filter(
          (d) =>
            d.time_slots?.some((slot) => slot.type === "자율학습") ||
            (d.day_type === "지정휴일" && d.study_hours > 0)
        );

        // 계산한 결과를 저장 (다음 조회 시 사용)
        const { error: updateScheduleError } = await supabase
          .from("plan_groups")
          .update({ daily_schedule: dailySchedule })
          .eq("id", groupId)
          .eq("student_id", targetStudentId);

        if (updateScheduleError) {
          console.error(
            "[planGroupActions] dailySchedule 저장 실패",
            updateScheduleError
          );
          // 저장 실패해도 계속 진행
        }
      } catch (error) {
        console.error("[planGroupActions] daily_schedule 조회 실패", error);
        // daily_schedule 조회 실패해도 계속 진행
      }
    }
  }

  // dateTimeSlots 생성 (dailySchedule의 time_slots를 날짜별로 매핑)
  const dateTimeSlots: Record<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  > = {};

  dailySchedule.forEach((daily) => {
    if (daily.time_slots && daily.time_slots.length > 0) {
      dateTimeSlots[daily.date] = daily.time_slots;
    }
  });

  return {
    plans: (plans || []).map((p) => ({
      id: p.id,
      plan_date: p.plan_date || "",
      block_index: p.block_index,
      content_type: p.content_type || "",
      content_id: p.content_id || "",
      chapter: p.chapter,
      planned_start_page_or_time: p.planned_start_page_or_time,
      planned_end_page_or_time: p.planned_end_page_or_time,
      completed_amount: p.completed_amount,
      plan_number: p.plan_number ?? null,
      sequence: p.sequence ?? null,
    })),
    periodStart: group.period_start || "",
    periodEnd: group.period_end || "",
    schedulerType: group.scheduler_type || null,
    schedulerOptions: group.scheduler_options || null,
    contents: Array.from(contentsMap.values()),
    blocks,
    dateTimeSlots, // 날짜별 time_slots 매핑
    dailySchedule, // Step 2.5와 동일한 daily_schedule 구조
  };
}

/**
 * 활성 상태인 다른 플랜 그룹 조회
 */
async function _getActivePlanGroups(
  excludeGroupId?: string
): Promise<Array<{ id: string; name: string | null }>> {
  const user = await requireStudentAuth();

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_groups")
    .select("id, name")
    .eq("student_id", user.userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (excludeGroupId) {
    query = query.neq("id", excludeGroupId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      "활성 플랜 그룹 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return data || [];
}

export const getPlansByGroupIdAction = withErrorHandling(_getPlansByGroupId);
export const checkPlansExistAction = withErrorHandling(_checkPlansExist);
export const getScheduleResultDataAction = withErrorHandling(
  _getScheduleResultData
);
export const getActivePlanGroups = withErrorHandling(_getActivePlanGroups);

