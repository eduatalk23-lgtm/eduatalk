/**
 * 플랜 그룹 관리자 전용 함수
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import type { Database } from "@/lib/supabase/database.types";
import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule } from "./types";
import { getPlanGroupById } from "./core";
import { getPlanContents } from "./contents";
import { getPlanExclusionsFromCalendar as getPlanExclusions } from "../calendarExclusions";
import { getAcademySchedules } from "./index";

/**
 * 관리자용 플랜 그룹 조회 (tenant_id 기반, RLS 우회)
 *
 * Admin Client를 사용하여 RLS를 우회합니다.
 * Server Client로는 관리자가 학생의 플랜 그룹을 조회할 수 없는 RLS 정책 문제를 해결합니다.
 */
export async function getPlanGroupByIdForAdmin(
  groupId: string,
  tenantId: string
): Promise<PlanGroup | null> {
  // Admin Client 사용 (RLS 우회)
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    // Admin 클라이언트 생성 실패 시 Server Client로 fallback
    logActionWarn(
      { domain: "data", action: "getPlanGroupByIdForAdmin" },
      "Admin 클라이언트를 생성할 수 없어 Server 클라이언트로 fallback"
    );
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at,study_hours,self_study_hours,lunch_time,calendar_id"
      )
      .eq("id", groupId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle<PlanGroup>();

    if (error && !ErrorCodeCheckers.isNoRowsReturned(error)) {
      handleQueryError(error, {
        context: "[data/planGroups] getPlanGroupByIdForAdmin (fallback)",
      });
      return null;
    }

    return data ?? null;
  }

  const selectGroup = () =>
    adminClient
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at,study_hours,self_study_hours,lunch_time,calendar_id"
      )
      .eq("id", groupId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

  let { data, error } = await selectGroup().maybeSingle<PlanGroup>();

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // 컬럼이 없는 경우 fallback
    const fallbackSelect = () =>
      adminClient
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
  // 전역 관리: 학생별 제외일/학원 일정 조회 (plan_group_id IS NULL)
  // 각 조회가 실패해도 다른 데이터는 정상적으로 반환되도록 Promise.allSettled 사용
  const [groupResult, contentsResult, exclusionsResult, academySchedulesResult] = await Promise.allSettled([
    getPlanGroupById(groupId, studentId, tenantId),
    getPlanContents(groupId, tenantId),
    getPlanExclusions(groupId, tenantId), // 학생별 전역 제외일
    getAcademySchedules(groupId, tenantId), // 학생별 전역 학원 일정
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
 * 관리자용 플랜 콘텐츠 조회 (RLS 우회)
 *
 * plan_contents 테이블은 RLS 정책이 plan_groups를 통해 적용되며,
 * Server Action 컨텍스트에서 auth.uid()가 올바르게 설정되지 않을 수 있어
 * Admin Client를 사용하여 RLS를 우회합니다.
 */
export async function getPlanContentsForAdmin(
  groupId: string,
  tenantId: string
): Promise<PlanContent[]> {
  // 1. Service Role Key로 시도 (RLS 우회)
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    // Admin 클라이언트를 생성할 수 없으면 일반 함수 사용 (fallback)
    if (process.env.NODE_ENV === "development") {
      logActionWarn(
        { domain: "data", action: "getPlanContentsForAdmin" },
        "Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용"
      );
    }
    return getPlanContents(groupId, tenantId);
  }

  const selectContents = () =>
    adminClient
      .from("plan_contents")
      .select(
        "id,tenant_id,plan_group_id,content_type,content_id,master_content_id,start_range,end_range,start_detail_id,end_detail_id,display_order,is_auto_recommended,recommendation_source,recommendation_reason,recommendation_metadata,recommended_at,recommended_by,created_at,updated_at"
      )
      .eq("plan_group_id", groupId)
      .eq("tenant_id", tenantId)
      .order("display_order", { ascending: true });

  let { data, error } = await selectContents();

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // 컬럼이 없는 경우 fallback 쿼리 시도
    const fallbackSelect = () =>
      adminClient
        .from("plan_contents")
        .select(
          "id,tenant_id,plan_group_id,content_type,content_id,master_content_id,start_range,end_range,start_detail_id,end_detail_id,display_order,is_auto_recommended,recommendation_source,recommendation_reason,recommendation_metadata,recommended_at,recommended_by,created_at,updated_at"
        )
        .eq("plan_group_id", groupId)
        .eq("tenant_id", tenantId)
        .order("display_order", { ascending: true });

    ({ data, error } = await fallbackSelect());
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getPlanContentsForAdmin",
    });
    // 에러 발생 시 빈 배열 반환
    return [];
  }

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "getPlanContentsForAdmin" },
      "관리자용 플랜 콘텐츠 조회 성공",
      {
        groupId,
        tenantId,
        contentsCount: data?.length ?? 0,
      }
    );
  }

  return (data as PlanContent[] | null) ?? [];
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

  // 관리자용 학원 일정 조회 (calendar_events 기반 어댑터)
  const getAcademySchedulesForAdmin = async (): Promise<AcademySchedule[]> => {
    // calendar_events 기반: 플랜 그룹 → student_id → 전역 학원 일정 조회
    return getAcademySchedules(groupId, tenantId);
  };

  // 플랜 그룹별 제외일과 학원 일정 조회 (RLS 우회)
  const [contents, exclusions, academySchedules] = await Promise.all([
    getPlanContentsForAdmin(groupId, tenantId), // RLS 우회를 위해 Admin 버전 사용
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
