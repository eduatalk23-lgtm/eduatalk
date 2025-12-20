/**
 * 캠프 템플릿 및 초대 데이터 액세스 레이어
 * 
 * typedQueryBuilder 패턴을 사용하여 타입 안전성과 에러 처리를 표준화합니다.
 * Admin Client를 사용하는 함수들은 RLS를 우회하여 관리자 권한이 필요한 작업을 수행합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CampTemplate, CampInvitation } from "@/lib/types/plan";
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type { PaginationOptions, ListResult } from "@/lib/data/core/types";
import { createTypedQuery, createTypedSingleQuery } from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";
import type {
  CampTemplateUpdate,
  CampInvitationUpdate,
} from "@/lib/domains/camp/types";

// Database 타입에서 테이블 타입 추출
type CampTemplateRow = Database["public"]["Tables"]["camp_templates"]["Row"];
type CampTemplateInsert = Database["public"]["Tables"]["camp_templates"]["Insert"];
type CampTemplateUpdateRow = Database["public"]["Tables"]["camp_templates"]["Update"];

type CampInvitationRow = Database["public"]["Tables"]["camp_invitations"]["Row"];
type CampInvitationInsert = Database["public"]["Tables"]["camp_invitations"]["Insert"];
type CampInvitationUpdateRow = Database["public"]["Tables"]["camp_invitations"]["Update"];

/**
 * 캠프 템플릿 조회
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampTemplate(templateId: string): Promise<CampTemplate | null> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    handleQueryError(null, {
      context: "[data/campTemplates] getCampTemplate",
      logError: true,
    });
    return null;
  }

  const result = await createTypedSingleQuery<CampTemplateRow>(
    async () => {
      return await (supabase as unknown as SupabaseServerClient)
        .from("camp_templates")
        .select("*")
        .eq("id", templateId);
    },
    {
      context: "[data/campTemplates] getCampTemplate",
      defaultValue: null,
    }
  );

  return result as CampTemplate | null;
}

/**
 * 캠프 템플릿 생성
 * 관리자 전용 함수이므로 Admin 클라이언트를 사용하여 RLS를 우회합니다.
 */
export async function createCampTemplate(data: {
  tenant_id: string;
  name: string;
  description?: string;
  program_type: string;
  template_data: Partial<WizardData> | null;
  created_by?: string;
  camp_start_date?: string;
  camp_end_date?: string;
  camp_location?: string;
}): Promise<{ success: boolean; templateId?: string; error?: string }> {
  // 관리자 전용 함수이므로 Admin 클라이언트 사용 (RLS 우회)
  // 호출 전에 requireAdminOrConsultant()로 권한 검증이 완료되어야 함
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      success: false,
      error: "Admin Client를 생성할 수 없습니다.",
    };
  }

  const insertData: CampTemplateInsert = {
    tenant_id: data.tenant_id,
    name: data.name,
    description: data.description || null,
    program_type: data.program_type as CampTemplateInsert["program_type"],
    template_data: data.template_data as CampTemplateInsert["template_data"],
    status: "draft",
  };

  // created_by는 users 테이블이 있을 때만 추가
  if (data.created_by) {
    insertData.created_by = data.created_by;
  }

  // 캠프 기간 및 장소 필드 추가
  if (data.camp_start_date) {
    insertData.camp_start_date = data.camp_start_date;
  }
  if (data.camp_end_date) {
    insertData.camp_end_date = data.camp_end_date;
  }
  if (data.camp_location) {
    insertData.camp_location = data.camp_location;
  }

  const result = await createTypedQuery<{ id: string }>(
    async () => {
      return await (supabase as unknown as SupabaseServerClient)
        .from("camp_templates")
        .insert(insertData)
        .select("id")
        .single();
    },
    {
      context: "[data/campTemplates] createCampTemplate",
      defaultValue: null,
    }
  );

  if (!result) {
    return {
      success: false,
      error: "템플릿 생성에 실패했습니다.",
    };
  }

  return { success: true, templateId: result.id };
}

/**
 * 캠프 템플릿 목록 조회 (관리자용)
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampTemplatesForTenant(
  tenantId: string
): Promise<CampTemplate[]> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    handleQueryError(null, {
      context: "[data/campTemplates] getCampTemplatesForTenant",
      logError: true,
    });
    return [];
  }

  const result = await createTypedQuery<CampTemplateRow[]>(
    async () => {
      return await (supabase as unknown as SupabaseServerClient)
        .from("camp_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
    },
    {
      context: "[data/campTemplates] getCampTemplatesForTenant",
      defaultValue: [],
    }
  );

  return (result ?? []) as CampTemplate[];
}

/**
 * 캠프 템플릿 목록 조회 (페이지네이션 지원, 서버 사이드 필터링)
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampTemplatesForTenantWithPagination(
  tenantId: string,
  options: PaginationOptions & {
    filters?: {
      search?: string;
      status?: string;
      programType?: string;
    };
  } = {}
): Promise<ListResult<CampTemplate>> {
  try {
    // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      console.error("[data/campTemplates] Admin Client를 생성할 수 없습니다.");
      return {
        items: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || options.limit || 20,
      };
    }
    
    const page = options.page || 1;
    const pageSize = options.pageSize || options.limit || 20;
    const offset = options.offset ?? (page - 1) * pageSize;
    const filters = options.filters || {};

    // 디버깅: tenantId 확인
    if (process.env.NODE_ENV === "development") {
      console.log("[data/campTemplates] 템플릿 조회 시작", {
        tenantId,
        filters,
        page,
        pageSize,
      });
    }

    // 쿼리 빌더 함수 (필터 적용) - supabaseQueryBuilder 사용
    const buildQuery = () => {
      let query = supabase
        .from("camp_templates")
        .select("*")
        .eq("tenant_id", tenantId);

      // 검색어 필터링 (name 또는 description) - 특수 처리
      if (filters.search?.trim()) {
        const searchLower = filters.search.toLowerCase().trim();
        query = query.or(`name.ilike.%${searchLower}%,description.ilike.%${searchLower}%`);
      }

      // 상태 필터
      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      // 프로그램 유형 필터 (programType -> program_type 매핑)
      if (filters.programType) {
        query = query.eq("program_type", filters.programType);
      }

      return query;
    };

    // 전체 개수 조회 (필터 적용된 쿼리 사용)
    const countQuery = buildQuery();
    // Supabase count 쿼리는 타입 정의가 복잡하므로 타입 단언 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (countQuery.select as any)("*", { count: "exact", head: true });

    if (countError) {
      handleQueryError(countError as Parameters<typeof handleQueryError>[0], {
        context: "[data/campTemplates] getCampTemplatesForTenantWithPagination - count",
      });
    }

    // 데이터 조회 (필터 적용된 쿼리 사용)
    const dataQuery = buildQuery();
    const { data, error } = await dataQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      handleQueryError(error, {
        context: "[data/campTemplates] getCampTemplatesForTenantWithPagination - data",
      });
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }

    // count가 null이거나 undefined인 경우, 데이터 길이로 대체 시도
    let total = count ?? null;
    if (total === null) {
      // count 쿼리가 실패했거나 null인 경우, 전체 데이터를 조회하여 개수 확인
      const { data: allData, error: allDataError } = await buildQuery()
        .select("id");
      
      if (!allDataError && allData) {
        total = allData.length;
        console.warn("[data/campTemplates] count 쿼리 실패, 데이터 길이로 대체", {
          total,
          tenantId,
        });
      } else {
        total = 0;
        console.error("[data/campTemplates] 전체 데이터 조회도 실패", {
          error: allDataError?.message,
          tenantId,
        });
      }
    }

    // 디버깅 로그
    if (process.env.NODE_ENV === "development") {
      console.log("[data/campTemplates] 템플릿 조회 결과", {
        total,
        itemsCount: data?.length || 0,
        tenantId,
        filters,
        page,
        pageSize,
      });
    }

    return {
      items: (data || []) as CampTemplate[],
      total,
      page,
      pageSize,
    };
  } catch (error) {
    // 예상치 못한 에러 처리
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 템플릿 목록 조회 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      items: [],
      total: 0,
      page: options.page || 1,
      pageSize: options.pageSize || options.limit || 20,
    };
  }
}

/**
 * 학생의 캠프 초대 목록 조회
 */
export async function getCampInvitationsForStudent(
  studentId: string
): Promise<CampInvitation[]> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<CampInvitationRow[]>(
    async () => {
      return await supabase
        .from("camp_invitations")
        .select("*")
        .eq("student_id", studentId)
        .in("status", ["pending", "accepted"])
        .order("invited_at", { ascending: false });
    },
    {
      context: "[data/campTemplates] getCampInvitationsForStudent",
      defaultValue: [],
    }
  );

  return (result ?? []) as CampInvitation[];
}

/**
 * 캠프 초대 조회
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampInvitation(
  invitationId: string
): Promise<CampInvitation | null> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    handleQueryError(null, {
      context: "[data/campTemplates] getCampInvitation",
      logError: true,
    });
    return null;
  }

  const result = await createTypedSingleQuery<CampInvitationRow>(
    async () => {
      return await (supabase as unknown as SupabaseServerClient)
        .from("camp_invitations")
        .select("*")
        .eq("id", invitationId);
    },
    {
      context: "[data/campTemplates] getCampInvitation",
      defaultValue: null,
    }
  );

  return result as CampInvitation | null;
}

/**
 * 캠프 초대 상태 업데이트
 */
export async function updateCampInvitationStatus(
  invitationId: string,
  status: "accepted" | "declined"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const updateData: CampInvitationUpdateRow = {
    status,
    updated_at: new Date().toISOString(),
    accepted_at: status === "accepted" ? new Date().toISOString() : null,
    declined_at: status === "declined" ? new Date().toISOString() : null,
  };

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("camp_invitations")
        .update(updateData)
        .eq("id", invitationId);
    },
    {
      context: "[data/campTemplates] updateCampInvitationStatus",
      defaultValue: null,
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
  return { success: true };
}

/**
 * 템플릿별 캠프 초대 목록 조회 (관리자용)
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampInvitationsForTemplate(
  templateId: string
): Promise<Array<CampInvitation & { student_name?: string; student_grade?: string; student_class?: string }>> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[data/campTemplates] Admin Client를 생성할 수 없습니다.");
    return [];
  }

  const { data, error } = await supabase
    .from("camp_invitations")
    .select(`
      *,
      students:student_id (
        name,
        grade,
        class
      )
    `)
    .eq("camp_template_id", templateId)
    .order("invited_at", { ascending: false });

  if (error) {
    console.error("[data/campTemplates] 템플릿별 초대 목록 조회 실패", error);
    return [];
  }

  // 학생 정보를 평탄화
  type InvitationWithStudent = CampInvitation & {
    students?: {
      name: string | null;
      grade: number | null;
      class: string | null;
    } | null;
  };
  
  return (data as InvitationWithStudent[] | null)?.map((invitation) => ({
    ...invitation,
    student_name: invitation.students?.name ?? undefined,
    student_grade: invitation.students?.grade ? String(invitation.students.grade) : undefined,
    student_class: invitation.students?.class ?? undefined,
  })) ?? [];
}

/**
 * 템플릿별 캠프 초대 목록 조회 (페이지네이션 지원, 서버 사이드 필터링)
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampInvitationsForTemplateWithPagination(
  templateId: string,
  tenantId: string,
  options: PaginationOptions & {
    filters?: {
      search?: string;
      status?: string;
    };
  } = {}
): Promise<ListResult<CampInvitation & { student_name?: string | null; student_grade?: string | null; student_class?: string | null }>> {
  try {
    // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      console.error("[data/campTemplates] Admin Client를 생성할 수 없습니다.");
      return {
        items: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || options.limit || 20,
      };
    }
    
    const page = options.page || 1;
    const pageSize = options.pageSize || options.limit || 20;
    const offset = options.offset ?? (page - 1) * pageSize;
    const filters = options.filters || {};

    // 쿼리 빌더 함수 (필터 적용)
    const buildQuery = () => {
      let query = supabase
        .from("camp_invitations")
        .select(`
          *,
          students:student_id (
            name,
            grade,
            class
          )
        `)
        .eq("camp_template_id", templateId)
        .eq("tenant_id", tenantId);

      // 상태 필터
      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      return query;
    };

    // 전체 개수 조회 (필터 적용된 쿼리 사용)
    const countQuery = buildQuery();
    // Supabase count 쿼리는 타입 정의가 복잡하므로 타입 단언 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (countQuery.select as any)("*", { count: "exact", head: true });

    if (countError) {
      handleQueryError(countError as Parameters<typeof handleQueryError>[0], {
        context: "[data/campTemplates] getCampInvitationsForTemplateWithPagination - count",
      });
    }

    // 데이터 조회 (필터 적용된 쿼리 사용)
    const dataQuery = buildQuery();
    const { data, error } = await dataQuery
      .order("invited_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      handleQueryError(error, {
        context: "[data/campTemplates] getCampInvitationsForTemplateWithPagination - data",
      });
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }

    // 학생 정보를 평탄화
    type InvitationWithStudent = CampInvitation & {
      students?: {
        name: string | null;
        grade: number | null;
        class: string | null;
      } | null;
    };
    
    let items = (data as InvitationWithStudent[] | null)?.map((invitation) => ({
      ...invitation,
      student_name: invitation.students?.name ?? undefined,
      student_grade: invitation.students?.grade ? String(invitation.students.grade) : undefined,
      student_class: invitation.students?.class ?? undefined,
    })) ?? [];

    // 학생명 검색 필터 (클라이언트 사이드에서 처리 - Supabase의 관계형 쿼리에서 ilike 사용이 복잡함)
    if (filters.search?.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      items = items.filter((invitation) => {
        const nameMatch = invitation.student_name?.toLowerCase().includes(searchLower) ?? false;
        return nameMatch;
      });
      // 검색 필터 적용 시 total count도 재계산 필요 (하지만 서버 사이드에서 정확한 count를 얻기 어려움)
      // 실제로는 검색 전 total을 반환하고, 클라이언트에서 필터링된 결과만 표시
    }

    const total = count || 0;

    return {
      items,
      total,
      page,
      pageSize,
    };
  } catch (error) {
    // 예상치 못한 에러 처리
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 템플릿별 초대 목록 조회 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      items: [],
      total: 0,
      page: options.page || 1,
      pageSize: options.pageSize || options.limit || 20,
    };
  }
}

export type CampTemplateImpactSummary = {
  invitationStats: {
    pending: number;
    accepted: number;
    declined: number;
  };
  planGroupStats: {
    draft: number;
    saved: number;
    active: number;
    paused: number;
    completed: number;
    cancelled: number;
  };
  totalInvitations: number;
  submittedInvitationCount: number;
  hasPendingInvites: boolean;
  hasAcceptedInvites: boolean;
  hasReviewInProgress: boolean;
  hasActivatedPlans: boolean;
};

/**
 * 템플릿별 캠프 영향 요약 조회
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampTemplateImpactSummary(
  templateId: string,
  tenantId: string
): Promise<CampTemplateImpactSummary> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[data/campTemplates] Admin Client를 생성할 수 없습니다.");
    return {
      invitationStats: { pending: 0, accepted: 0, declined: 0 },
      planGroupStats: { draft: 0, saved: 0, active: 0, paused: 0, completed: 0, cancelled: 0 },
      totalInvitations: 0,
      submittedInvitationCount: 0,
      hasPendingInvites: false,
      hasAcceptedInvites: false,
      hasReviewInProgress: false,
      hasActivatedPlans: false,
    };
  }

  const invitationStats = {
    pending: 0,
    accepted: 0,
    declined: 0,
  };

  const planGroupStats = {
    draft: 0,
    saved: 0,
    active: 0,
    paused: 0,
    completed: 0,
    cancelled: 0,
  };

  const { data: invitations, error: invitationsError } = await supabase
    .from("camp_invitations")
    .select("id, status")
    .eq("camp_template_id", templateId)
    .eq("tenant_id", tenantId);

  if (invitationsError) {
    handleQueryError(invitationsError, {
      context: "[data/campTemplates] getCampTemplateImpactSummary - invitations",
    });
  } else {
    (invitations || []).forEach((invitation) => {
      const status = invitation.status as keyof typeof invitationStats;
      if (status in invitationStats) {
        invitationStats[status]++;
      }
    });
  }

  const submittedInvitationIds = new Set<string>();
  const { data: planGroups, error: planGroupsError } = await supabase
    .from("plan_groups")
    .select("id, status, camp_invitation_id")
    .eq("camp_template_id", templateId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (planGroupsError) {
    handleQueryError(planGroupsError, {
      context: "[data/campTemplates] getCampTemplateImpactSummary - planGroups",
    });
  } else {
    (planGroups || []).forEach((group) => {
      if (group.camp_invitation_id) {
        submittedInvitationIds.add(group.camp_invitation_id);
      }
      const status = group.status as keyof typeof planGroupStats;
      if (status in planGroupStats) {
        planGroupStats[status]++;
      }
    });
  }

  return {
    invitationStats,
    planGroupStats,
    totalInvitations: invitations?.length || 0,
    submittedInvitationCount: submittedInvitationIds.size,
    hasPendingInvites: invitationStats.pending > 0,
    hasAcceptedInvites: invitationStats.accepted > 0,
    hasReviewInProgress:
      planGroupStats.draft > 0 || planGroupStats.saved > 0,
    hasActivatedPlans: planGroupStats.active > 0,
  };
}

/**
 * 캠프 초대 삭제
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function deleteCampInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { success: false, error: "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다." };
  }

  // 1. 초대 삭제 전에 관련된 플랜 그룹 삭제
  const { deletePlanGroupByInvitationId } = await import(
    "@/lib/data/planGroups"
  );
  const planGroupResult = await deletePlanGroupByInvitationId(invitationId);

  if (!planGroupResult.success) {
    console.error(
      "[data/campTemplates] 플랜 그룹 삭제 실패",
      planGroupResult.error
    );
    return {
      success: false,
      error: `플랜 그룹 삭제 실패: ${planGroupResult.error}`,
    };
  }

  // 2. 초대 삭제
  const { data: deletedRows, error } = await supabase
    .from("camp_invitations")
    .delete()
    .eq("id", invitationId)
    .select();

  if (error) {
    handleQueryError(error, {
      context: "[data/campTemplates] deleteCampInvitation",
    });
    return { success: false, error: error.message };
  }

  if (!deletedRows || deletedRows.length === 0) {
    return { success: false, error: "초대를 찾을 수 없습니다." };
  }

  return { success: true };
}

/**
 * 캠프 초대 일괄 삭제
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function deleteCampInvitations(
  invitationIds: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { success: false, error: "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다." };
  }

  // 1. 각 초대에 대해 플랜 그룹 삭제
  const { deletePlanGroupByInvitationId } = await import(
    "@/lib/data/planGroups"
  );

  const planGroupResults = await Promise.all(
    invitationIds.map((invitationId) =>
      deletePlanGroupByInvitationId(invitationId)
    )
  );

  // 플랜 그룹 삭제 실패한 경우 확인
  const failedPlanGroupDeletes = planGroupResults.filter(
    (result) => !result.success
  );

  if (failedPlanGroupDeletes.length > 0) {
    const errorMessages = failedPlanGroupDeletes
      .map((result) => result.error)
      .join("; ");
    console.error(
      "[data/campTemplates] 일부 플랜 그룹 삭제 실패",
      errorMessages
    );
    // 플랜 그룹 삭제 실패해도 초대 삭제는 계속 진행 (데이터 일관성 유지)
    // 하지만 에러를 기록해두는 것이 좋음
  }

  // 2. 초대 일괄 삭제
  const { data: deletedRows, error } = await supabase
    .from("camp_invitations")
    .delete()
    .in("id", invitationIds)
    .select();
  
  const count = error ? 0 : (deletedRows?.length || 0);

  if (error) {
    handleQueryError(error, {
      context: "[data/campTemplates] deleteCampInvitations",
    });
    return { success: false, error: error.message };
  }

  return { success: true, count: count || 0 };
}

/**
 * 캠프 템플릿 복사
 * 템플릿 데이터와 블록 세트 연결을 복사합니다. 초대 정보는 복사하지 않습니다.
 * 관리자 전용 함수이므로 Admin 클라이언트를 사용하여 RLS를 우회합니다.
 */
export async function copyCampTemplate(
  templateId: string,
  newName?: string
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    // 관리자 전용 함수이므로 Admin 클라이언트 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return { success: false, error: "Admin Client를 생성할 수 없습니다." };
    }

    // 원본 템플릿 조회
    const originalTemplate = await getCampTemplate(templateId);
    if (!originalTemplate) {
      return { success: false, error: "템플릿을 찾을 수 없습니다." };
    }

    // 새 템플릿 이름 생성
    const copiedName = newName || `${originalTemplate.name} (복사본)`;

    // 새 템플릿 생성
    const newTemplateResult = await createCampTemplate({
      tenant_id: originalTemplate.tenant_id,
      name: copiedName,
      description: originalTemplate.description || undefined,
      program_type: originalTemplate.program_type,
      template_data: originalTemplate.template_data,
      created_by: originalTemplate.created_by || undefined,
      camp_start_date: originalTemplate.camp_start_date || undefined,
      camp_end_date: originalTemplate.camp_end_date || undefined,
      camp_location: originalTemplate.camp_location || undefined,
    });

    if (!newTemplateResult.success || !newTemplateResult.templateId) {
      return {
        success: false,
        error: newTemplateResult.error || "템플릿 복사에 실패했습니다.",
      };
    }

    const newTemplateId = newTemplateResult.templateId;

    // 블록 세트 연결 복사 (camp_template_block_sets 테이블)
    const { data: originalBlockSetLink, error: blockSetLinkError } =
      await supabase
        .from("camp_template_block_sets")
        .select("tenant_block_set_id")
        .eq("camp_template_id", templateId)
        .maybeSingle();

    if (blockSetLinkError && blockSetLinkError.code !== "PGRST116") {
      // PGRST116은 결과가 없을 때 발생하는 정상적인 에러
      handleQueryError(blockSetLinkError, {
        context: "[data/campTemplates] copyCampTemplate - blockSetLink",
      });
      // 조회 실패 시 템플릿 삭제 (롤백)
      await supabase.from("camp_templates").delete().eq("id", newTemplateId);
      return {
        success: false,
        error: `블록 세트 연결 조회 실패: ${blockSetLinkError.message}`,
      };
    } else if (originalBlockSetLink) {
      // 블록 세트 연결이 있으면 복사
      const { error: insertError } = await supabase
        .from("camp_template_block_sets")
        .insert({
          camp_template_id: newTemplateId,
          tenant_block_set_id: originalBlockSetLink.tenant_block_set_id,
        });

      if (insertError) {
        handleQueryError(insertError, {
          context: "[data/campTemplates] copyCampTemplate - blockSetLink insert",
        });
        // 블록 세트 연결 실패 시 템플릿 삭제 (롤백)
        await supabase.from("camp_templates").delete().eq("id", newTemplateId);
        return {
          success: false,
          error: `블록 세트 연결 실패: ${insertError.message}`,
        };
      }
    }

    return { success: true, templateId: newTemplateId };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 템플릿 복사 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      success: false,
      error: errorMessage || "템플릿 복사에 실패했습니다.",
    };
  }
}

/**
 * 테넌트별 캠프 통계 조회
 */
export type CampStatistics = {
  activeTemplates: number;
  totalInvitations: number;
  acceptedInvitations: number;
  declinedInvitations: number;
  pendingInvitations: number;
  participationRate: number; // 참여율 (수락 / 전체 초대)
};

/**
 * 테넌트별 캠프 통계 조회
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampStatisticsForTenant(
  tenantId: string
): Promise<{ success: boolean; data?: CampStatistics; error?: string }> {
  try {
    // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
      };
    }

    // 활성 템플릿 수 조회
    const { count: activeTemplatesCount, error: templatesError } = await supabase
      .from("camp_templates")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (templatesError) {
      handleQueryError(templatesError, {
        context: "[data/campTemplates] getCampStatisticsForTenant - templates",
      });
      const errorMessage = templatesError.message || "활성 템플릿 수 조회 실패";
      return {
        success: false,
        error: errorMessage,
      };
    }

    // 초대 통계 조회
    const { data: invitations, error: invitationsError } = await supabase
      .from("camp_invitations")
      .select("status")
      .eq("tenant_id", tenantId);

    if (invitationsError) {
      handleQueryError(invitationsError, {
        context: "[data/campTemplates] getCampStatisticsForTenant - invitations",
      });
      const errorMessage = invitationsError.message || "초대 통계 조회 실패";
      return {
        success: false,
        error: errorMessage,
      };
    }

    const totalInvitations = invitations?.length || 0;
    const acceptedInvitations =
      invitations?.filter((inv) => inv.status === "accepted").length || 0;
    const declinedInvitations =
      invitations?.filter((inv) => inv.status === "declined").length || 0;
    const pendingInvitations =
      invitations?.filter((inv) => inv.status === "pending").length || 0;

    const participationRate =
      totalInvitations > 0
        ? Math.round((acceptedInvitations / totalInvitations) * 100)
        : 0;

    return {
      success: true,
      data: {
        activeTemplates: activeTemplatesCount || 0,
        totalInvitations,
        acceptedInvitations,
        declinedInvitations,
        pendingInvitations,
        participationRate,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 캠프 통계 조회 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 템플릿별 캠프 통계 조회
 */
export type CampTemplateStatistics = {
  totalInvitations: number;
  acceptedInvitations: number;
  declinedInvitations: number;
  pendingInvitations: number;
  participationRate: number;
  planGroupsCount: number;
  activePlanGroupsCount: number;
};

/**
 * 템플릿별 캠프 통계 조회
 * 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
 */
export async function getCampTemplateStatistics(
  templateId: string,
  tenantId: string
): Promise<{ success: boolean; data?: CampTemplateStatistics; error?: string }> {
  try {
    // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
      };
    }

    // 초대 통계 조회
    const { data: invitations, error: invitationsError } = await supabase
      .from("camp_invitations")
      .select("status")
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId);

    if (invitationsError) {
      handleQueryError(invitationsError, {
        context: "[data/campTemplates] getCampTemplateStatistics - invitations",
      });
      const errorMessage = invitationsError.message || "템플릿별 초대 통계 조회 실패";
      return {
        success: false,
        error: errorMessage,
      };
    }

    const totalInvitations = invitations?.length || 0;
    const acceptedInvitations =
      invitations?.filter((inv) => inv.status === "accepted").length || 0;
    const declinedInvitations =
      invitations?.filter((inv) => inv.status === "declined").length || 0;
    const pendingInvitations =
      invitations?.filter((inv) => inv.status === "pending").length || 0;

    const participationRate =
      totalInvitations > 0
        ? Math.round((acceptedInvitations / totalInvitations) * 100)
        : 0;

    // 플랜 그룹 통계 조회
    const { data: planGroups, error: planGroupsError } = await supabase
      .from("plan_groups")
      .select("status")
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    if (planGroupsError) {
      handleQueryError(planGroupsError, {
        context: "[data/campTemplates] getCampTemplateStatistics - planGroups",
      });
      const errorMessage = planGroupsError.message || "템플릿별 플랜 그룹 통계 조회 실패";
      return {
        success: false,
        error: errorMessage,
      };
    }

    const planGroupsCount = planGroups?.length || 0;
    const activePlanGroupsCount =
      planGroups?.filter((pg) => pg.status === "active").length || 0;

    return {
      success: true,
      data: {
        totalInvitations,
        acceptedInvitations,
        declinedInvitations,
        pendingInvitations,
        participationRate,
        planGroupsCount,
        activePlanGroupsCount,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[data/campTemplates] 템플릿별 캠프 통계 조회 중 예외 발생",
      {
        message: errorMessage,
        error,
      }
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

