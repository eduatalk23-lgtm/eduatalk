import { NextRequest } from "next/server";
import { findCurriculumUnitsBySubject } from "@/lib/domains/guide/repository";
import { apiSuccess, apiBadRequest, handleApiError, withCache, CACHE_STATIC } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const subjectName = request.nextUrl.searchParams.get("subjectName");
    if (!subjectName) {
      return apiBadRequest("subjectName이 필요합니다.");
    }

    const data = await findCurriculumUnitsBySubject(subjectName);
    return withCache(apiSuccess(data), CACHE_STATIC);
  } catch (error) {
    console.error("[api/subjects/curriculum-units] 실패:", error);
    return handleApiError(error, "[api/subjects/curriculum-units]");
  }
}
