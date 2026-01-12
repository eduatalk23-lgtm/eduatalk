"use server";

/**
 * 콘텐츠 의존성(선수학습) 관리 Server Actions
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  ContentDependency,
  ContentDependencyInput,
  ContentDependencyResponse,
  GetDependenciesOptions,
  ContentType,
} from "@/lib/types/content-dependency";

// =============================================
// 타입 변환 헬퍼
// =============================================

interface DbContentDependency {
  id: string;
  tenant_id: string;
  prerequisite_content_id: string;
  prerequisite_content_type: string;
  dependent_content_id: string;
  dependent_content_type: string;
  scope: string;
  plan_group_id: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

function mapDbToContentDependency(
  row: DbContentDependency,
  prerequisiteTitle?: string,
  dependentTitle?: string
): ContentDependency {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    prerequisiteContentId: row.prerequisite_content_id,
    prerequisiteContentType: row.prerequisite_content_type as ContentType,
    prerequisiteTitle,
    dependentContentId: row.dependent_content_id,
    dependentContentType: row.dependent_content_type as ContentType,
    dependentTitle,
    scope: row.scope as "global" | "plan_group",
    planGroupId: row.plan_group_id || undefined,
    note: row.note || undefined,
    createdAt: row.created_at,
    createdBy: row.created_by || undefined,
  };
}

// =============================================
// 콘텐츠 제목 조회 헬퍼
// =============================================

async function getContentTitle(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  contentId: string,
  contentType: ContentType
): Promise<string | undefined> {
  if (!supabase) return undefined;

  let data: { title: string | null } | null = null;

  switch (contentType) {
    case "book": {
      const result = await supabase
        .from("master_books")
        .select("title")
        .eq("id", contentId)
        .maybeSingle();
      data = result.data;
      break;
    }
    case "lecture": {
      const result = await supabase
        .from("master_lectures")
        .select("title")
        .eq("id", contentId)
        .maybeSingle();
      data = result.data;
      break;
    }
    case "custom": {
      const result = await supabase
        .from("master_custom_contents")
        .select("title")
        .eq("id", contentId)
        .maybeSingle();
      data = result.data;
      break;
    }
    default:
      return undefined;
  }

  return data?.title || undefined;
}

// =============================================
// CRUD Actions
// =============================================

/**
 * 특정 콘텐츠의 의존성 목록 조회
 * (이 콘텐츠가 선수인 것 + 이 콘텐츠의 선수 학습)
 */
export async function getContentDependencies(
  contentId: string,
  contentType: ContentType,
  options?: GetDependenciesOptions
): Promise<ContentDependencyResponse<ContentDependency[]>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });

    if (!tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const supabase = createSupabaseAdminClient();

    if (!supabase) {
      return { success: false, error: "Admin client unavailable" };
    }

    // 이 콘텐츠가 선수인 의존성 (다른 콘텐츠가 이 콘텐츠를 필요로 함)
    let prereqQuery = supabase
      .from("content_dependencies")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("prerequisite_content_id", contentId)
      .eq("prerequisite_content_type", contentType);

    // 이 콘텐츠의 선수 학습 (이 콘텐츠가 다른 콘텐츠를 필요로 함)
    let depQuery = supabase
      .from("content_dependencies")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("dependent_content_id", contentId)
      .eq("dependent_content_type", contentType);

    // scope 필터링
    if (options?.planGroupId) {
      if (options.includeGlobal !== false) {
        // global + 특정 plan_group
        prereqQuery = prereqQuery.or(
          `scope.eq.global,and(scope.eq.plan_group,plan_group_id.eq.${options.planGroupId})`
        );
        depQuery = depQuery.or(
          `scope.eq.global,and(scope.eq.plan_group,plan_group_id.eq.${options.planGroupId})`
        );
      } else {
        // 특정 plan_group만
        prereqQuery = prereqQuery
          .eq("scope", "plan_group")
          .eq("plan_group_id", options.planGroupId);
        depQuery = depQuery
          .eq("scope", "plan_group")
          .eq("plan_group_id", options.planGroupId);
      }
    } else {
      // global만
      prereqQuery = prereqQuery.eq("scope", "global");
      depQuery = depQuery.eq("scope", "global");
    }

    const [prereqResult, depResult] = await Promise.all([prereqQuery, depQuery]);

    if (prereqResult.error) {
      throw prereqResult.error;
    }
    if (depResult.error) {
      throw depResult.error;
    }

    // 중복 제거 및 결합
    const allRows = [...(prereqResult.data || []), ...(depResult.data || [])];
    const uniqueRows = Array.from(
      new Map(allRows.map((r) => [r.id, r])).values()
    ) as DbContentDependency[];

    // 제목 조회
    const dependencies = await Promise.all(
      uniqueRows.map(async (row) => {
        const [prereqTitle, depTitle] = await Promise.all([
          getContentTitle(
            supabase,
            row.prerequisite_content_id,
            row.prerequisite_content_type as ContentType
          ),
          getContentTitle(
            supabase,
            row.dependent_content_id,
            row.dependent_content_type as ContentType
          ),
        ]);
        return mapDbToContentDependency(row, prereqTitle, depTitle);
      })
    );

    return { success: true, data: dependencies };
  } catch (error) {
    logActionError(
      { domain: "content-dependency", action: "getContentDependencies" },
      error,
      { contentId, contentType }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "의존성 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 플랜 그룹에 해당하는 모든 의존성 조회
 */
export async function getDependenciesForPlanGroup(
  planGroupId: string
): Promise<ContentDependencyResponse<ContentDependency[]>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });

    if (!tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const supabase = createSupabaseAdminClient();

    if (!supabase) {
      return { success: false, error: "Admin client unavailable" };
    }

    // global + 이 plan_group의 의존성 모두 조회
    const { data, error } = await supabase
      .from("content_dependencies")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`scope.eq.global,and(scope.eq.plan_group,plan_group_id.eq.${planGroupId})`);

    if (error) {
      throw error;
    }

    const dependencies = await Promise.all(
      (data || []).map(async (row: DbContentDependency) => {
        const [prereqTitle, depTitle] = await Promise.all([
          getContentTitle(
            supabase,
            row.prerequisite_content_id,
            row.prerequisite_content_type as ContentType
          ),
          getContentTitle(
            supabase,
            row.dependent_content_id,
            row.dependent_content_type as ContentType
          ),
        ]);
        return mapDbToContentDependency(row, prereqTitle, depTitle);
      })
    );

    return { success: true, data: dependencies };
  } catch (error) {
    logActionError(
      { domain: "content-dependency", action: "getDependenciesForPlanGroup" },
      error,
      { planGroupId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "의존성 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 콘텐츠 의존성 추가
 */
export async function addContentDependency(
  input: ContentDependencyInput
): Promise<ContentDependencyResponse<ContentDependency>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });

    if (!tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 유효성 검사
    if (
      input.prerequisiteContentId === input.dependentContentId &&
      input.prerequisiteContentType === input.dependentContentType
    ) {
      return { success: false, error: "자기 자신에 대한 의존성은 설정할 수 없습니다." };
    }

    if (input.scope === "plan_group" && !input.planGroupId) {
      return { success: false, error: "플랜 그룹 범위일 경우 플랜 그룹 ID가 필요합니다." };
    }

    // 순환 의존성 검사 (간단 버전: 직접 역방향 의존성만 검사)
    const { data: reverseExists } = await supabase
      .from("content_dependencies")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("prerequisite_content_id", input.dependentContentId)
      .eq("prerequisite_content_type", input.dependentContentType)
      .eq("dependent_content_id", input.prerequisiteContentId)
      .eq("dependent_content_type", input.prerequisiteContentType)
      .maybeSingle();

    if (reverseExists) {
      return {
        success: false,
        error: "역방향 의존성이 이미 존재합니다. 순환 의존성은 허용되지 않습니다.",
      };
    }

    // 의존성 추가
    const { data, error } = await supabase
      .from("content_dependencies")
      .insert({
        tenant_id: tenantId,
        prerequisite_content_id: input.prerequisiteContentId,
        prerequisite_content_type: input.prerequisiteContentType,
        dependent_content_id: input.dependentContentId,
        dependent_content_type: input.dependentContentType,
        scope: input.scope || "global",
        plan_group_id: input.planGroupId || null,
        note: input.note || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // unique constraint violation
        return { success: false, error: "이미 동일한 의존성이 존재합니다." };
      }
      throw error;
    }

    const adminClient = createSupabaseAdminClient();
    const [prereqTitle, depTitle] = await Promise.all([
      getContentTitle(
        adminClient,
        input.prerequisiteContentId,
        input.prerequisiteContentType
      ),
      getContentTitle(
        adminClient,
        input.dependentContentId,
        input.dependentContentType
      ),
    ]);

    return {
      success: true,
      data: mapDbToContentDependency(data as DbContentDependency, prereqTitle, depTitle),
    };
  } catch (error) {
    logActionError(
      { domain: "content-dependency", action: "addContentDependency" },
      error,
      { input }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "의존성 추가 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 콘텐츠 의존성 삭제
 */
export async function removeContentDependency(
  dependencyId: string
): Promise<ContentDependencyResponse> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });

    if (!tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("content_dependencies")
      .delete()
      .eq("id", dependencyId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "content-dependency", action: "removeContentDependency" },
      error,
      { dependencyId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "의존성 삭제 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 콘텐츠 ID에 해당하는 의존성 조회 (검증용)
 */
export async function getDependenciesForContents(
  contentIds: string[],
  tenantId: string,
  planGroupId?: string
): Promise<ContentDependency[]> {
  try {
    const supabase = createSupabaseAdminClient();

    if (!supabase || contentIds.length === 0) {
      return [];
    }

    // 선수 또는 의존 콘텐츠가 contentIds에 포함된 의존성 조회
    let query = supabase
      .from("content_dependencies")
      .select("*")
      .eq("tenant_id", tenantId);

    if (planGroupId) {
      query = query.or(
        `scope.eq.global,and(scope.eq.plan_group,plan_group_id.eq.${planGroupId})`
      );
    } else {
      query = query.eq("scope", "global");
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getDependenciesForContents] Query error:", error);
      return [];
    }

    // contentIds에 관련된 의존성만 필터링
    const contentIdSet = new Set(contentIds);
    const relevantDeps = (data || []).filter(
      (row: DbContentDependency) =>
        contentIdSet.has(row.prerequisite_content_id) ||
        contentIdSet.has(row.dependent_content_id)
    );

    // 제목 조회
    const dependencies = await Promise.all(
      relevantDeps.map(async (row: DbContentDependency) => {
        const [prereqTitle, depTitle] = await Promise.all([
          getContentTitle(
            supabase,
            row.prerequisite_content_id,
            row.prerequisite_content_type as ContentType
          ),
          getContentTitle(
            supabase,
            row.dependent_content_id,
            row.dependent_content_type as ContentType
          ),
        ]);
        return mapDbToContentDependency(row, prereqTitle, depTitle);
      })
    );

    return dependencies;
  } catch (error) {
    console.error("[getDependenciesForContents] Error:", error);
    return [];
  }
}
