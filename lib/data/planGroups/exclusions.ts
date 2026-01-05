/**
 * 플랜 그룹 제외일 관련 함수
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import type { PlanExclusion, ExclusionType } from "./types";

/**
 * 플랜 그룹의 제외일 목록 조회
 * 전역 관리 방식: 학생의 모든 제외일을 조회 (plan_group_id IS NULL)
 * 캠프 플랜인 경우 템플릿 제외일도 포함
 */
export async function getPlanExclusions(
  groupId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  const supabase = await createSupabaseServerClient();

  // 먼저 플랜 그룹에서 student_id 조회
  const { data: planGroup } = await supabase
    .from("plan_groups")
    .select("student_id, camp_template_id, plan_type")
    .eq("id", groupId)
    .maybeSingle();

  if (!planGroup?.student_id) {
    return [];
  }

  // 전역 관리: 학생의 모든 제외일 조회 (plan_group_id IS NULL)
  const selectExclusions = () =>
    supabase
      .from("plan_exclusions")
      .select("id,tenant_id,student_id,plan_group_id,exclusion_date,exclusion_type,reason,created_at")
      .eq("student_id", planGroup.student_id)
      .is("plan_group_id", null)
      .order("exclusion_date", { ascending: true });

  let query = selectExclusions();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getPlanExclusions",
    });
    return [];
  }

  const dbExclusions = (data as PlanExclusion[] | null) ?? [];

  // 캠프 플랜인 경우 템플릿 제외일 확인 및 포함
  if (planGroup.plan_type === "camp" && planGroup.camp_template_id) {
    try {
      const { getCampTemplate } = await import("@/lib/data/campTemplates");
      const template = await getCampTemplate(planGroup.camp_template_id);
      const templateData = template?.template_data as Record<string, unknown> | null;

      if (templateData?.exclusions && Array.isArray(templateData.exclusions)) {
        const templateExclusions = templateData.exclusions as Array<{
          exclusion_date: string;
          exclusion_type: ExclusionType;
          reason?: string | null;
        }>;
        const dbExclusionDates = new Set(
          dbExclusions.map((e) => e.exclusion_date)
        );

        // 템플릿 제외일 중 DB에 없는 것만 추가
        const missingTemplateExclusions = templateExclusions.filter(
          (te) => !dbExclusionDates.has(te.exclusion_date)
        );

        // 템플릿 제외일을 PlanExclusion 형식으로 변환하여 추가
        const templateExclusionsAsPlanExclusions: PlanExclusion[] =
          missingTemplateExclusions.map((te) => ({
            id: `template-${te.exclusion_date}`, // 임시 ID (템플릿 제외일임을 표시)
            tenant_id: tenantId || "",
            student_id: planGroup.student_id || "",
            plan_group_id: groupId,
            exclusion_date: te.exclusion_date,
            exclusion_type: te.exclusion_type as ExclusionType,
            reason: te.reason || null,
            created_at: new Date().toISOString(),
          }));

        // DB 제외일과 템플릿 제외일을 합쳐서 반환 (날짜 순 정렬)
        const allExclusions = [
          ...dbExclusions,
          ...templateExclusionsAsPlanExclusions,
        ].sort((a, b) => {
          const dateA = new Date(a.exclusion_date).getTime();
          const dateB = new Date(b.exclusion_date).getTime();
          return dateA - dateB;
        });

        return allExclusions;
      }
    } catch (templateError) {
      // 템플릿 조회 실패 시 로그만 남기고 DB 제외일만 반환
      if (process.env.NODE_ENV === "development") {
        logActionWarn(
          { domain: "data", action: "getPlanExclusions" },
          "템플릿 제외일 조회 실패",
          { error: templateError }
        );
      }
    }
  }

  return dbExclusions;
}

/**
 * 학생의 전체 제외일 목록 조회 (모든 플랜 그룹)
 */
export async function getStudentExclusions(
  studentId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  const supabase = await createSupabaseServerClient();

  const selectExclusions = () =>
    supabase
      .from("plan_exclusions")
      .select("id,tenant_id,student_id,exclusion_date,exclusion_type,reason,created_at")
      .eq("student_id", studentId)
      .order("exclusion_date", { ascending: true });

  let query = selectExclusions();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getStudentExclusions",
    });
    return [];
  }

  return (data as PlanExclusion[] | null) ?? [];
}

/**
 * 제외일 생성 (내부 통합 함수)
 * - plan_group_id가 있으면 플랜 그룹별 관리
 * - plan_group_id가 없으면 시간 관리 영역에 저장
 */
async function createExclusions(
  studentId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>,
  planGroupId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (exclusions.length === 0) {
    return { success: true };
  }

  // plan_group_id가 있는 경우: 플랜 그룹별 관리 로직
  if (planGroupId) {
    // 플랜 그룹에서 student_id 확인
    const { data: group } = await supabase
      .from("plan_groups")
      .select("student_id")
      .eq("id", planGroupId)
      .maybeSingle();

    if (!group?.student_id) {
      return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
    }

    // student_id 일치 확인
    if (group.student_id !== studentId) {
      return { success: false, error: "학생 ID가 일치하지 않습니다." };
    }

    // 중복 체크: 현재 플랜 그룹 내 제외일 조회 (날짜+유형 조합)
    const currentExclusionsQuery = supabase
      .from("plan_exclusions")
      .select("id, exclusion_date, exclusion_type")
      .eq("student_id", studentId)
      .eq("plan_group_id", planGroupId);

    if (tenantId) {
      currentExclusionsQuery.eq("tenant_id", tenantId);
    }

    const { data: currentExclusions, error: exclusionsError } =
      await currentExclusionsQuery;

    if (exclusionsError) {
      handleQueryError(exclusionsError as PostgrestError | null, {
        context: "[data/planGroups] createExclusions - checkExclusions",
      });
    }

    // 현재 플랜 그룹에 이미 있는 제외일 (날짜+유형 조합)
    const existingKeys = new Set(
      (currentExclusions || []).map(
        (e) => `${e.exclusion_date}-${e.exclusion_type}`
      )
    );

    // 시간 관리 영역의 제외일 조회 (plan_group_id가 NULL이거나 다른 플랜 그룹)
    const timeManagementExclusionsQuery = supabase
      .from("plan_exclusions")
      .select("id, exclusion_date, exclusion_type, reason")
      .eq("student_id", studentId);

    if (tenantId) {
      timeManagementExclusionsQuery.eq("tenant_id", tenantId);
    }

    // plan_group_id가 NULL이거나 현재 그룹이 아닌 것
    timeManagementExclusionsQuery.or(
      `plan_group_id.is.null,plan_group_id.neq.${planGroupId}`
    );

    const { data: timeManagementExclusions } =
      await timeManagementExclusionsQuery;

    // 시간 관리 영역의 제외일을 키로 매핑
    const timeManagementMap = new Map(
      (timeManagementExclusions || []).map((e) => [
        `${e.exclusion_date}-${e.exclusion_type}`,
        e,
      ])
    );

    // 업데이트할 항목과 새로 생성할 항목 분리
    const toUpdate: Array<{ id: string; exclusion: typeof exclusions[0] }> =
      [];
    const toInsert: typeof exclusions = [];

    for (const exclusion of exclusions) {
      const key = `${exclusion.exclusion_date}-${exclusion.exclusion_type}`;

      // 현재 플랜 그룹에 이미 있으면 스킵
      if (existingKeys.has(key)) {
        if (process.env.NODE_ENV === "development") {
          logActionDebug(
            { domain: "data", action: "createExclusions" },
            "이미 존재하는 제외일 스킵",
            { key, planGroupId }
          );
        }
        continue;
      }

      // 시간 관리 영역에 있으면 업데이트
      const timeManagementExclusion = timeManagementMap.get(key);
      if (timeManagementExclusion) {
        toUpdate.push({
          id: timeManagementExclusion.id,
          exclusion,
        });
      } else {
        // 없으면 새로 생성
        toInsert.push(exclusion);
      }
    }

    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "createExclusions" },
        "처리 요약",
        {
          updateCount: toUpdate.length,
          insertCount: toInsert.length,
          skipCount: exclusions.length - toUpdate.length - toInsert.length,
          planGroupId,
        }
      );
    }

    // 시간 관리 영역의 제외일을 현재 플랜 그룹으로 업데이트
    if (toUpdate.length > 0) {
      for (const { id, exclusion } of toUpdate) {
        const { error: updateError } = await supabase
          .from("plan_exclusions")
          .update({
            plan_group_id: planGroupId,
            reason: exclusion.reason || null,
          })
          .eq("id", id);

        if (updateError) {
          handleQueryError(updateError, {
            context: "[data/planGroups] createExclusions - updateExclusion",
          });
          // 업데이트 실패 시 새로 생성 목록에 추가
          toInsert.push(exclusion);
        } else if (process.env.NODE_ENV === "development") {
          logActionDebug(
            { domain: "data", action: "createExclusions" },
            "제외일 재활용 성공",
            {
              exclusionDate: exclusion.exclusion_date,
              exclusionType: exclusion.exclusion_type,
              planGroupId,
            }
          );
        }
      }
    }

    // 새로 생성할 제외일
    if (toInsert.length > 0) {
      const payload = toInsert.map((exclusion) => ({
        tenant_id: tenantId,
        student_id: studentId,
        plan_group_id: planGroupId,
        exclusion_date: exclusion.exclusion_date,
        exclusion_type: exclusion.exclusion_type,
        reason: exclusion.reason || null,
      }));

      let { error } = await supabase.from("plan_exclusions").insert(payload);

      if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
        const fallbackPayload = payload.map(
          ({ tenant_id: _tenantId, ...rest }) => rest
        );
        ({ error } = await supabase
          .from("plan_exclusions")
          .insert(fallbackPayload));
      }

      // 중복 키 에러 처리 (데이터베이스 레벨 unique 제약조건)
      if (error && (ErrorCodeCheckers.isUniqueViolation(error) || error.message?.includes("duplicate"))) {
        return {
          success: false,
          error: "이미 등록된 제외일이 있습니다.",
        };
      }

      if (error) {
        handleQueryError(error, {
          context: "[data/planGroups] createExclusions",
        });
        return { success: false, error: error.message };
      }

      if (process.env.NODE_ENV === "development") {
        logActionDebug(
          { domain: "data", action: "createExclusions" },
          "제외일 생성 완료",
          { insertCount: toInsert.length, planGroupId }
        );
      }
    }

    return { success: true };
  }

  // plan_group_id가 없는 경우: 시간 관리 영역에 저장 (plan_group_id = NULL)
  // 중복 체크: 같은 날짜+유형의 제외일이 이미 있으면 스킵
  const existingExclusionsQuery = supabase
    .from("plan_exclusions")
    .select("id, exclusion_date, exclusion_type")
    .eq("student_id", studentId)
    .is("plan_group_id", null);

  if (tenantId) {
    existingExclusionsQuery.eq("tenant_id", tenantId);
  }

  const { data: existingExclusions, error: existingError } =
    await existingExclusionsQuery;

  if (existingError) {
    handleQueryError(existingError as PostgrestError | null, {
      context: "[data/planGroups] createExclusions - checkExisting",
    });
  }

  // 기존 제외일 키 (날짜+유형 조합)
  const existingKeys = new Set(
    (existingExclusions || []).map(
      (e) => `${e.exclusion_date}-${e.exclusion_type}`
    )
  );

  // 중복되지 않은 제외일만 필터링
  const newExclusions = exclusions.filter(
    (e) => !existingKeys.has(`${e.exclusion_date}-${e.exclusion_type}`)
  );

  if (newExclusions.length === 0) {
    return { success: true }; // 모든 제외일이 이미 존재
  }

  const payload = newExclusions.map((exclusion) => ({
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: null, // 시간 관리 영역
    exclusion_date: exclusion.exclusion_date,
    exclusion_type: exclusion.exclusion_type,
    reason: exclusion.reason || null,
  }));

  let { error } = await supabase.from("plan_exclusions").insert(payload);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    const fallbackPayload = payload.map(
      ({ tenant_id: _tenantId, ...rest }) => rest
    );
    ({ error } = await supabase.from("plan_exclusions").insert(fallbackPayload));
  }

  // 중복 키 에러 처리
  if (error && (ErrorCodeCheckers.isUniqueViolation(error) || error.message?.includes("duplicate"))) {
    return {
      success: false,
      error: "이미 등록된 제외일이 있습니다.",
    };
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] createExclusions",
    });
    return { success: false, error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "createExclusions" },
      "시간 관리 영역 제외일 생성 완료",
      { insertCount: newExclusions.length }
    );
  }

  return { success: true };
}

/**
 * 플랜 그룹에 제외일 생성
 * 전역 관리 방식: plan_group_id = NULL로 저장 (학생별 전역 관리)
 */
export async function createPlanExclusions(
  groupId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  // 플랜 그룹에서 student_id 조회
  const supabase = await createSupabaseServerClient();
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  // 전역 관리: plan_group_id = NULL로 저장
  return createStudentExclusions(group.student_id, tenantId, exclusions);
}

/**
 * 학생의 시간 관리 영역에 제외일 생성 (plan_group_id = NULL)
 */
export async function createStudentExclusions(
  studentId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  // 통합 함수 호출 (plan_group_id = null)
  return createExclusions(studentId, tenantId, exclusions, null);
}
