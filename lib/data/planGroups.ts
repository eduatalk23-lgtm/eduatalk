// 플랜 그룹 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  PlanGroupCreationData,
  PlanFilters,
} from "@/lib/types/plan";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 플랜 그룹 필터
 */
export type PlanGroupFilters = {
  studentId: string;
  tenantId?: string | null;
  status?: string | string[];
  planPurpose?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  includeDeleted?: boolean;
};

/**
 * 학생의 플랜 그룹 목록 조회
 */
export async function getPlanGroupsForStudent(
  filters: PlanGroupFilters
): Promise<PlanGroup[]> {
  const supabase = await createSupabaseServerClient();

  const selectGroups = () =>
    supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,created_at,updated_at"
      )
      .eq("student_id", filters.studentId);

  let query = selectGroups();

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  if (filters.planPurpose) {
    query = query.eq("plan_purpose", filters.planPurpose);
  }

  if (filters.dateRange) {
    query = query
      .gte("period_start", filters.dateRange.start)
      .lte("period_end", filters.dateRange.end);
  }

  if (!filters.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  query = query.order("created_at", { ascending: false });

  let { data, error } = await query;

  if (error && error.code === "42703") {
    // fallback: 컬럼이 없는 경우
    const fallbackQuery = supabase
      .from("plan_groups")
      .select("*")
      .eq("student_id", filters.studentId);

    if (filters.tenantId) {
      fallbackQuery.eq("tenant_id", filters.tenantId);
    }

    if (!filters.includeDeleted) {
      fallbackQuery.is("deleted_at", null);
    }

    ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
  }

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 조회 실패", error);
    return [];
  }

  return (data as PlanGroup[] | null) ?? [];
}

/**
 * 플랜 그룹 ID로 조회
 */
export async function getPlanGroupById(
  groupId: string,
  studentId: string,
  tenantId?: string | null
): Promise<PlanGroup | null> {
  const supabase = await createSupabaseServerClient();

  const selectGroup = () =>
    supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,created_at,updated_at"
      )
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null);

  let query = selectGroup();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query.maybeSingle<PlanGroup>();

  // 컬럼이 없는 경우 fallback (scheduler_options 제외)
  if (error && error.code === "42703") {
    console.warn("[data/planGroups] scheduler_options 컬럼이 없어 fallback 쿼리 사용", {
      groupId,
      studentId,
      tenantId,
    });
    
    const fallbackSelect = () =>
      supabase
        .from("plan_groups")
        .select(
          "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,created_at,updated_at"
        )
        .eq("id", groupId)
        .eq("student_id", studentId)
        .is("deleted_at", null);
    
    let fallbackQuery = fallbackSelect();
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
    }
    
    ({ data, error } = await fallbackQuery.maybeSingle<PlanGroup>());
    
    // fallback 성공 시 scheduler_options를 null로 설정
    if (data && !error) {
      data = { ...data, scheduler_options: null } as PlanGroup;
    }
  }

  if (error && error.code !== "PGRST116") {
    // 에러 객체의 모든 속성을 안전하게 추출
    const errorInfo: Record<string, unknown> = {
      message: error.message || String(error),
      code: error.code || "UNKNOWN",
    };
    
    // 에러 객체의 다른 속성들도 추출
    if ("details" in error) errorInfo.details = (error as { details?: unknown }).details;
    if ("hint" in error) errorInfo.hint = (error as { hint?: unknown }).hint;
    if ("statusCode" in error) errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
    
    console.error("[data/planGroups] 플랜 그룹 조회 실패", {
      error: errorInfo,
      groupId,
      studentId,
      tenantId,
      errorString: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    return null;
  }

  return data ?? null;
}

/**
 * 플랜 그룹 생성
 */
export async function createPlanGroup(
  group: {
    tenant_id: string;
    student_id: string;
    name?: string | null;
    plan_purpose: string | null;
    scheduler_type: string | null;
    scheduler_options?: any | null;
    period_start: string;
    period_end: string;
    target_date?: string | null;
    block_set_id?: string | null;
    status?: string;
  }
): Promise<{ success: boolean; groupId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: any = {
    tenant_id: group.tenant_id,
    student_id: group.student_id,
    name: group.name || null,
    plan_purpose: group.plan_purpose,
    scheduler_type: group.scheduler_type,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date || null,
    block_set_id: group.block_set_id || null,
    status: group.status || "draft",
  };

  // scheduler_options가 실제 값이 있으면 추가 (데이터베이스에 컬럼이 있을 경우)
  // null이나 undefined가 아닐 때만 추가
  if (group.scheduler_options !== undefined && group.scheduler_options !== null) {
    payload.scheduler_options = group.scheduler_options;
  }

  let { data, error } = await supabase
    .from("plan_groups")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === "42703") {
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("plan_groups")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, groupId: data?.id };
}

/**
 * 플랜 그룹 업데이트
 */
export async function updatePlanGroup(
  groupId: string,
  studentId: string,
  updates: {
    name?: string | null;
    plan_purpose?: string | null;
    scheduler_type?: string | null;
    scheduler_options?: any | null;
    period_start?: string;
    period_end?: string;
    target_date?: string | null;
    block_set_id?: string | null;
    status?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.plan_purpose !== undefined) payload.plan_purpose = updates.plan_purpose;
  if (updates.scheduler_type !== undefined) payload.scheduler_type = updates.scheduler_type;
  if (updates.scheduler_options !== undefined) payload.scheduler_options = updates.scheduler_options;
  if (updates.period_start !== undefined) payload.period_start = updates.period_start;
  if (updates.period_end !== undefined) payload.period_end = updates.period_end;
  if (updates.target_date !== undefined) payload.target_date = updates.target_date;
  if (updates.block_set_id !== undefined) payload.block_set_id = updates.block_set_id;
  if (updates.status !== undefined) payload.status = updates.status;

  let { error } = await supabase
    .from("plan_groups")
    .update(payload)
    .eq("id", groupId)
    .eq("student_id", studentId)
    .is("deleted_at", null);

  // 컬럼이 없는 경우 fallback 처리
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    // scheduler_options가 포함된 경우 제외하고 재시도
    if (payload.scheduler_options !== undefined) {
      const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
      ({ error } = await supabase
        .from("plan_groups")
        .update(fallbackPayload)
        .eq("id", groupId)
        .eq("student_id", studentId)
        .is("deleted_at", null));
      
      // scheduler_options가 없어도 다른 필드는 업데이트 성공
      if (!error) {
        console.warn("[data/planGroups] scheduler_options 컬럼이 없어 해당 필드는 저장되지 않았습니다.");
        return { success: true };
      }
    }
    
    // 다른 컬럼 문제인 경우 일반 fallback
    ({ error } = await supabase
      .from("plan_groups")
      .update(payload)
      .eq("id", groupId));
  }

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹 Soft Delete
 */
export async function deletePlanGroup(
  groupId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("plan_groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", groupId)
    .eq("student_id", studentId)
    .is("deleted_at", null);

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹 콘텐츠 조회
 */
export async function getPlanContents(
  groupId: string,
  tenantId?: string | null
): Promise<PlanContent[]> {
  const supabase = await createSupabaseServerClient();

  const selectContents = () =>
    supabase
      .from("plan_contents")
      .select(
        "id,tenant_id,plan_group_id,content_type,content_id,start_range,end_range,display_order,created_at,updated_at"
      )
      .eq("plan_group_id", groupId)
      .order("display_order", { ascending: true });

  let query = selectContents();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (error && error.code === "42703") {
    ({ data, error } = await selectContents());
  }

  if (error) {
    console.error("[data/planGroups] 플랜 콘텐츠 조회 실패", error);
    return [];
  }

  return (data as PlanContent[] | null) ?? [];
}

/**
 * 플랜 그룹 콘텐츠 일괄 생성
 */
export async function createPlanContents(
  groupId: string,
  tenantId: string,
  contents: Array<{
    content_type: string;
    content_id: string;
    start_range: number;
    end_range: number;
    display_order?: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (contents.length === 0) {
    return { success: true };
  }

  const payload = contents.map((content, index) => ({
    tenant_id: tenantId,
    plan_group_id: groupId,
    content_type: content.content_type,
    content_id: content.content_id,
    start_range: content.start_range,
    end_range: content.end_range,
    display_order: content.display_order ?? index,
  }));

  let { error } = await supabase.from("plan_contents").insert(payload);

  if (error && error.code === "42703") {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("plan_contents").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 플랜 콘텐츠 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹 제외일 조회 (플랜 그룹별 관리)
 */
export async function getPlanExclusions(
  groupId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  const supabase = await createSupabaseServerClient();

  const selectExclusions = () =>
    supabase
      .from("plan_exclusions")
      .select("id,tenant_id,student_id,plan_group_id,exclusion_date,exclusion_type,reason,created_at")
      .eq("plan_group_id", groupId)
      .order("exclusion_date", { ascending: true });

  let query = selectExclusions();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (error && error.code === "42703") {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 제외일 조회 실패", error);
    return [];
  }

  return (data as PlanExclusion[] | null) ?? [];
}

/**
 * 학생별 제외일 조회 (전역 관리)
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

  if (error && error.code === "42703") {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    console.error("[data/planGroups] 학생 제외일 조회 실패", error);
    return [];
  }

  return (data as PlanExclusion[] | null) ?? [];
}

/**
 * 플랜 그룹 제외일 일괄 생성 (플랜 그룹별 관리)
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
  const supabase = await createSupabaseServerClient();

  if (exclusions.length === 0) {
    return { success: true };
  }

  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();
  
  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  const payload = exclusions.map((exclusion) => ({
    tenant_id: tenantId,
    student_id: group.student_id,
    plan_group_id: groupId,
    exclusion_date: exclusion.exclusion_date,
    exclusion_type: exclusion.exclusion_type,
    reason: exclusion.reason || null,
  }));

  let { error } = await supabase.from("plan_exclusions").insert(payload);

  if (error && error.code === "42703") {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("plan_exclusions").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 제외일 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 학생별 제외일 일괄 생성 (전역 관리)
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
  const supabase = await createSupabaseServerClient();

  if (exclusions.length === 0) {
    return { success: true };
  }

  // 중복 체크: 같은 날짜의 제외일이 이미 있으면 스킵
  const existingExclusions = await getStudentExclusions(studentId, tenantId);
  const existingDates = new Set(existingExclusions.map((e) => e.exclusion_date));

  const newExclusions = exclusions.filter(
    (e) => !existingDates.has(e.exclusion_date)
  );

  if (newExclusions.length === 0) {
    return { success: true }; // 모든 제외일이 이미 존재
  }

  const payload = newExclusions.map((exclusion) => ({
    tenant_id: tenantId,
    student_id: studentId,
    exclusion_date: exclusion.exclusion_date,
    exclusion_type: exclusion.exclusion_type,
    reason: exclusion.reason || null,
  }));

  let { error } = await supabase.from("plan_exclusions").insert(payload);

  if (error && error.code === "42703") {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("plan_exclusions").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 학생 제외일 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹 학원 일정 조회 (학생별 전역 관리)
 * @deprecated getStudentAcademySchedules 사용 권장
 */
export async function getAcademySchedules(
  groupId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  // 하위 호환성을 위해 student_id를 조회하여 사용
  const supabase = await createSupabaseServerClient();
  
  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();
  
  if (!group?.student_id) {
    return [];
  }
  
  return getStudentAcademySchedules(group.student_id, tenantId);
}

/**
 * 학생별 학원 일정 조회 (전역 관리)
 */
export async function getStudentAcademySchedules(
  studentId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  const supabase = await createSupabaseServerClient();

  // academies와 조인하여 travel_time 가져오기
  const selectSchedules = () =>
    supabase
      .from("academy_schedules")
      .select(
        "id,tenant_id,student_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
      )
      .eq("student_id", studentId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

  let query = selectSchedules();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (error && error.code === "42703") {
    // academy_id가 없는 경우를 대비한 fallback
    const fallbackSelect = () =>
      supabase
        .from("academy_schedules")
        .select(
          "id,tenant_id,student_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at"
        )
        .eq("student_id", studentId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
    
    let fallbackQuery = fallbackSelect();
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
    }
    ({ data, error } = await fallbackQuery);
  }

  if (error) {
    console.error("[data/planGroups] 학생 학원 일정 조회 실패", error);
    return [];
  }

  // 데이터 변환: academies 관계 데이터를 travel_time으로 변환
  const schedules = (data as any[] | null) ?? [];
  return schedules.map((schedule) => ({
    ...schedule,
    travel_time: schedule.academies?.travel_time ?? 60, // 기본값 60분
    academies: undefined, // 관계 데이터 제거
  })) as AcademySchedule[];
}

/**
 * 플랜 그룹 학원 일정 일괄 생성 (학생별 전역 관리)
 * @deprecated createStudentAcademySchedules 사용 권장
 */
export async function createAcademySchedules(
  groupId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  // 하위 호환성을 위해 student_id를 조회하여 사용
  const supabase = await createSupabaseServerClient();
  
  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();
  
  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }
  
  return createStudentAcademySchedules(group.student_id, tenantId, schedules);
}

/**
 * 학생별 학원 일정 일괄 생성 (전역 관리)
 */
export async function createStudentAcademySchedules(
  studentId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (schedules.length === 0) {
    return { success: true };
  }

  // 중복 체크: 같은 요일, 시간대의 학원 일정이 이미 있으면 스킵
  const existingSchedules = await getStudentAcademySchedules(studentId, tenantId);
  const existingKeys = new Set(
    existingSchedules.map((s) => `${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  const newSchedules = schedules.filter(
    (s) => !existingKeys.has(`${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  if (newSchedules.length === 0) {
    return { success: true }; // 모든 학원 일정이 이미 존재
  }

  // academy_name별로 academy를 찾거나 생성
  const academyNameMap = new Map<string, string>(); // academy_name -> academy_id

  for (const schedule of newSchedules) {
    const academyName = schedule.academy_name || "학원";
    
    if (!academyNameMap.has(academyName)) {
      // 기존 academy 찾기
      const { data: existingAcademy } = await supabase
        .from("academies")
        .select("id")
        .eq("student_id", studentId)
        .eq("name", academyName)
        .maybeSingle();

      let academyId: string;
      
      if (existingAcademy) {
        academyId = existingAcademy.id;
      } else {
        // 새 academy 생성
        const { data: newAcademy, error: academyError } = await supabase
          .from("academies")
          .insert({
            student_id: studentId,
            tenant_id: tenantId,
            name: academyName,
            travel_time: 60, // 기본값
          })
          .select("id")
          .single();

        if (academyError || !newAcademy) {
          console.error("[data/planGroups] 학원 생성 실패", academyError);
          return { success: false, error: academyError?.message || "학원 생성에 실패했습니다." };
        }

        academyId = newAcademy.id;
      }

      academyNameMap.set(academyName, academyId);
    }
  }

  // academy_id를 포함한 payload 생성
  const payload = newSchedules.map((schedule) => {
    const academyName = schedule.academy_name || "학원";
    const academyId = academyNameMap.get(academyName);
    
    if (!academyId) {
      throw new Error(`학원 ID를 찾을 수 없습니다: ${academyName}`);
    }

    return {
      tenant_id: tenantId,
      student_id: studentId,
      plan_group_id: null, // 학생별 전역 관리이므로 plan_group_id는 null
      academy_id: academyId,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      academy_name: schedule.academy_name || null, // 하위 호환성
      subject: schedule.subject || null,
    };
  });

  let { error } = await supabase.from("academy_schedules").insert(payload);

  if (error && error.code === "42703") {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("academy_schedules").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 학생 학원 일정 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹 전체 조회 (관련 데이터 포함)
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
  const [group, contents, exclusions, academySchedules] = await Promise.all([
    getPlanGroupById(groupId, studentId, tenantId),
    getPlanContents(groupId, tenantId),
    getPlanExclusions(groupId, tenantId), // 플랜 그룹별 제외일
    getStudentAcademySchedules(studentId, tenantId), // 학원 일정은 여전히 전역 관리
  ]);

  return {
    group,
    contents,
    exclusions,
    academySchedules,
  };
}

/**
 * 플랜 그룹 통계 정보 타입
 */
export type PlanGroupStats = {
  planCount: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean; // 실제 완료 상태
};

/**
 * 플랜 그룹과 통계 정보를 함께 조회
 */
export async function getPlanGroupsWithStats(
  filters: PlanGroupFilters
): Promise<Array<PlanGroup & PlanGroupStats>> {
  const supabase = await createSupabaseServerClient();
  
  // 1. 플랜 그룹 조회
  const groups = await getPlanGroupsForStudent(filters);
  
  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((g) => g.id);
  const studentId = filters.studentId;

  // 2. 플랜 개수 및 완료 상태 조회 (배치)
  const [planCountsResult, planCompletionResult] = await Promise.all([
    // 플랜 개수 조회
    supabase
      .from("student_plan")
      .select("plan_group_id")
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds),
    // 플랜 완료 상태 조회
    supabase
      .from("student_plan")
      .select(
        "plan_group_id, planned_end_page_or_time, completed_amount"
      )
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds)
      .not("plan_group_id", "is", null),
  ]);

  // 3. 통계 계산
  const planCountsMap = new Map<string, number>();
  (planCountsResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      planCountsMap.set(
        plan.plan_group_id,
        (planCountsMap.get(plan.plan_group_id) || 0) + 1
      );
    }
  });

  const completionMap = new Map<
    string,
    { completedCount: number; totalCount: number; isCompleted: boolean }
  >();

  // plan_group_id별로 그룹화
  const plansByGroup = new Map<
    string,
    Array<{ planned_end: number | null; completed: number | null }>
  >();

  (planCompletionResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      const groupPlans = plansByGroup.get(plan.plan_group_id) || [];
      groupPlans.push({
        planned_end: plan.planned_end_page_or_time ?? null,
        completed: plan.completed_amount ?? null,
      });
      plansByGroup.set(plan.plan_group_id, groupPlans);
    }
  });

  // 완료 상태 계산
  plansByGroup.forEach((groupPlans, groupId) => {
    const totalCount = groupPlans.length;
    let completedCount = 0;

    groupPlans.forEach((plan) => {
      if (
        plan.planned_end !== null &&
        plan.completed !== null &&
        plan.completed >= plan.planned_end
      ) {
        completedCount++;
      }
    });

    const isCompleted =
      totalCount > 0 &&
      completedCount === totalCount &&
      groupPlans.every((plan) => {
        if (plan.planned_end === null) return false;
        return plan.completed !== null && plan.completed >= plan.planned_end;
      });

    completionMap.set(groupId, {
      completedCount,
      totalCount,
      isCompleted,
    });
  });

  // 4. 결과 병합
  return groups.map((group) => {
    const planCount = planCountsMap.get(group.id) || 0;
    const completion = completionMap.get(group.id) || {
      completedCount: 0,
      totalCount: planCount,
      isCompleted: false,
    };

    // 완료 상태 표시 (실제 완료되었고 현재 상태가 completed가 아니면 표시용으로 completed)
    let displayStatus = group.status;
    if (
      completion.isCompleted &&
      group.status !== "completed" &&
      group.status !== "cancelled"
    ) {
      displayStatus = "completed";
    }

    return {
      ...group,
      status: displayStatus as typeof group.status,
      planCount,
      completedCount: completion.completedCount,
      totalCount: completion.totalCount,
      isCompleted: completion.isCompleted,
    };
  });
}

