/**
 * 플랜 그룹 관리자 전용 함수
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import type { Database } from "@/lib/supabase/database.types";
import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule } from "./types";
import { getPlanGroupById } from "./core";
import { getPlanContents } from "./contents";
import { getPlanExclusions } from "./exclusions";
import { getAcademySchedules } from "./academies";

/**
 * 관리자용 플랜 그룹 조회 (tenant_id 기반)
 */
export async function getPlanGroupByIdForAdmin(
  groupId: string,
  tenantId: string
): Promise<PlanGroup | null> {
  const supabase = await createSupabaseServerClient();

  const selectGroup = () =>
    supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
      )
      .eq("id", groupId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

  let { data, error } = await selectGroup().maybeSingle<PlanGroup>();

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // 컬럼이 없는 경우 fallback
    const fallbackSelect = () =>
      supabase
        .from("plan_groups")
        .select(
          "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
        )
        .eq("id", groupId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

    ({ data, error } = await fallbackSelect().maybeSingle<PlanGroup>());

    if (data && !error) {
      data = { ...data, scheduler_options: null } as PlanGroup;
    }
  }

  if (error && !ErrorCodeCheckers.isNoRowsReturned(error)) {
    handleQueryError(error, {
      context: "[data/planGroups] getPlanGroupByIdForAdmin",
    });
    return null;
  }

  return data ?? null;
}

/**
 * 플랜 그룹 상세 정보 조회 (콘텐츠, 제외일, 학원 일정 포함)
 */
export async function getPlanGroupWithDetails(
  groupId: string,
  studentId: string,
  tenantId?: string | null
): Promise<{
  group: PlanGroup | null;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
}> {
  // 플랜 그룹별 제외일과 학원 일정 조회
  // 각 조회가 실패해도 다른 데이터는 정상적으로 반환되도록 Promise.allSettled 사용
  const [groupResult, contentsResult, exclusionsResult, academySchedulesResult] = await Promise.allSettled([
    getPlanGroupById(groupId, studentId, tenantId),
    getPlanContents(groupId, tenantId),
    getPlanExclusions(groupId, tenantId), // 플랜 그룹별 제외일
    getAcademySchedules(groupId, tenantId), // 플랜 그룹별 학원 일정 조회 (전역 아님)
  ]);

  // 결과 추출 (실패 시 기본값 사용)
  const group = groupResult.status === "fulfilled" ? groupResult.value : null;
  const contents = contentsResult.status === "fulfilled" ? contentsResult.value : [];
  const exclusions = exclusionsResult.status === "fulfilled" ? exclusionsResult.value : [];
  const academySchedules = academySchedulesResult.status === "fulfilled" ? academySchedulesResult.value : [];

  // 실패한 조회가 있으면 로깅
  if (contentsResult.status === "rejected") {
    handleQueryError(contentsResult.reason as PostgrestError, {
      context: "[data/planGroups] getPlanGroupWithDetails - contents",
    });
  }
  if (exclusionsResult.status === "rejected") {
    handleQueryError(exclusionsResult.reason as PostgrestError, {
      context: "[data/planGroups] getPlanGroupWithDetails - exclusions",
    });
  }
  if (academySchedulesResult.status === "rejected") {
    handleQueryError(academySchedulesResult.reason as PostgrestError, {
      context: "[data/planGroups] getPlanGroupWithDetails - academySchedules",
    });
  }

  return {
    group,
    contents,
    exclusions,
    academySchedules,
  };
}

/**
 * 관리자용 플랜 그룹 상세 정보 조회 (RLS 우회)
 */
export async function getPlanGroupWithDetailsForAdmin(
  groupId: string,
  tenantId: string
): Promise<{
  group: PlanGroup | null;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
}> {
  const group = await getPlanGroupByIdForAdmin(groupId, tenantId);

  if (!group) {
    return {
      group: null,
      contents: [],
      exclusions: [],
      academySchedules: [],
    };
  }

  // 관리자용 학원 일정 조회 (RLS 우회를 위해 Admin 클라이언트 사용)
  // 플랜 그룹별 학원 일정만 조회 (전역 아님)
  const getAcademySchedulesForAdmin = async (): Promise<AcademySchedule[]> => {
    let adminSchedulesData: AcademySchedule[] | null = null;

    // 1. Service Role Key로 시도 (RLS 우회)
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      // Admin 클라이언트를 생성할 수 없으면 일반 함수 사용 (fallback)
      if (process.env.NODE_ENV === "development") {
        logActionWarn(
          { domain: "data", action: "getPlanGroupWithDetailsForAdmin" },
          "Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용"
        );
      }
      return getAcademySchedules(groupId, tenantId); // 플랜 그룹별 조회로 변경
    }

    // academies와 조인하여 travel_time 가져오기 (plan_group_id로 조회)
    const selectSchedules = () =>
      adminClient
        .from("academy_schedules")
        .select(
          "id,tenant_id,student_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
        )
        .eq("plan_group_id", groupId) // 플랜 그룹별 조회로 변경
        .eq("tenant_id", tenantId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

    let { data, error } = await selectSchedules();
    adminSchedulesData = data as AcademySchedule[] | null;

    if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
      // academy_id가 없는 경우를 대비한 fallback (plan_group_id로 조회)
      const fallbackSelect = () =>
        adminClient
          .from("academy_schedules")
          .select(
            "id,tenant_id,student_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at"
          )
          .eq("plan_group_id", groupId) // 플랜 그룹별 조회로 변경
          .eq("tenant_id", tenantId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

      const fallbackResult = await fallbackSelect();
      error = fallbackResult.error;

      // academy_id를 빈 문자열로 설정 (fallback 쿼리에는 academy_id가 없음)
      if (fallbackResult.data && !error) {
        adminSchedulesData = fallbackResult.data.map((schedule) => ({
          id: schedule.id,
          tenant_id: schedule.tenant_id || "",
          student_id: schedule.student_id,
          academy_id: "", // fallback 쿼리에는 academy_id가 없으므로 빈 문자열
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          subject: schedule.subject ?? null,
          created_at: schedule.created_at,
          updated_at: schedule.updated_at,
          academy_name: schedule.academy_name || null,
          travel_time: null,
        })) as AcademySchedule[];
      }
    }

    if (error) {
      handleQueryError(error, {
        context: "[data/planGroups] getPlanGroupWithDetailsForAdmin",
      });
      // 에러 발생 시 빈 배열 반환
      return [];
    }

    // 데이터 변환: academies 관계 데이터를 travel_time으로 변환
    type ScheduleWithAcademies = AcademySchedule & {
      academies?: { travel_time?: number } | null;
    };

    const schedules = (adminSchedulesData ?? []) as ScheduleWithAcademies[];
    const academySchedules = schedules.map((schedule) => ({
      ...schedule,
      travel_time: schedule.academies?.travel_time ?? 60, // 기본값 60분
      academies: undefined, // 관계 데이터 제거
    })) as AcademySchedule[];

    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "getPlanGroupWithDetailsForAdmin" },
        "관리자용 학원 일정 조회 성공",
        {
          groupId,
          studentId: group.student_id,
          tenantId,
          academySchedulesCount: academySchedules.length,
        }
      );
    }

    return academySchedules;
  };

  // 플랜 그룹별 제외일과 학원 일정 조회
  const [contents, exclusions, academySchedules] = await Promise.all([
    getPlanContents(groupId, tenantId),
    getPlanExclusions(groupId, tenantId),
    getAcademySchedulesForAdmin(),
  ]);

  return {
    group,
    contents,
    exclusions,
    academySchedules,
  };
}
