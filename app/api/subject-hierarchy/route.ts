import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getSubjectHierarchyOptimized } from "@/lib/data/subjects";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

/**
 * 계층형 데이터 조회 API
 * GET /api/subject-hierarchy?curriculum_revision_id=...
 *
 * @returns
 * 성공: { success: true, data: SubjectHierarchy }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { role } = await getCurrentUserRole();

    if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
      return apiUnauthorized();
    }

    const searchParams = request.nextUrl.searchParams;
    const curriculumRevisionId = searchParams.get("curriculum_revision_id");

    if (!curriculumRevisionId) {
      return apiBadRequest("curriculum_revision_id가 필요합니다.");
    }

    const hierarchy = await getSubjectHierarchyOptimized(curriculumRevisionId);

    return apiSuccess(hierarchy);
  } catch (error) {
    return handleApiError(error, "[api/subject-hierarchy]");
  }
}

