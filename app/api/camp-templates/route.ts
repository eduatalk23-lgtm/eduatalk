import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getCampTemplatesForTenantWithPagination } from "@/lib/data/campTemplates";
import type { CampTemplate } from "@/lib/types/plan";
import type { ListResult } from "@/lib/data/core/types";

export const dynamic = "force-dynamic";

type CampTemplatesFilters = {
  search?: string;
  status?: string;
  programType?: string;
};

/**
 * 캠프 템플릿 목록 조회 API
 * GET /api/camp-templates?page=1&pageSize=20&search=검색어&status=active&programType=winter
 *
 * @returns
 * 성공: { success: true, data: ListResult<CampTemplate> }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "consultant")) {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return apiUnauthorized();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    
    const filters: CampTemplatesFilters = {};
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const programType = searchParams.get("programType");
    
    if (search) filters.search = search;
    if (status) filters.status = status;
    if (programType) filters.programType = programType;

    const data = await getCampTemplatesForTenantWithPagination(
      tenantContext.tenantId,
      {
        page,
        pageSize,
        filters,
      }
    );

    return apiSuccess<ListResult<CampTemplate>>(data);
  } catch (error) {
    return handleApiError(error, "[api/camp-templates] 오류");
  }
}

