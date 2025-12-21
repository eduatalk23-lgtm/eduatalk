import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getPlanGroupsWithStats, type PlanGroupFilters } from "@/lib/data/planGroups";
import type { PlanGroup } from "@/lib/types/plan";

export const dynamic = "force-dynamic";

type PlanGroupStats = {
  planCount: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
};

type PlanGroupWithStats = PlanGroup & PlanGroupStats;

/**
 * 플랜 그룹 목록 조회 API
 * GET /api/plan-groups?studentId=xxx&status=active&...
 *
 * @returns
 * 성공: { success: true, data: PlanGroupWithStats[] }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();

    const { searchParams } = new URL(request.url);
    
    const filters: PlanGroupFilters = {
      studentId: user.userId,
      tenantId: tenantContext?.tenantId || null,
    };

    // 필터 파라미터 파싱
    const status = searchParams.get("status");
    if (status) {
      filters.status = status as PlanGroupFilters["status"];
    }

    const planPurpose = searchParams.get("planPurpose");
    if (planPurpose) {
      filters.planPurpose = planPurpose as PlanGroupFilters["planPurpose"];
    }

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate && endDate) {
      filters.dateRange = {
        start: startDate,
        end: endDate,
      };
    }

    const includeDeleted = searchParams.get("includeDeleted");
    if (includeDeleted === "true") {
      filters.includeDeleted = true;
    }

    const data = await getPlanGroupsWithStats(filters);

    return apiSuccess<PlanGroupWithStats[]>(data);
  } catch (error) {
    return handleApiError(error, "[api/plan-groups] 오류");
  }
}

