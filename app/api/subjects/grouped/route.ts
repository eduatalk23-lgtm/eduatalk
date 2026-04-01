import { NextRequest } from "next/server";
import { getSubjectGroupsWithSubjects, getActiveCurriculumRevision } from "@/lib/data/subjects";
import { apiSuccess, handleApiError, withCache, CACHE_STATIC } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const revisionId = request.nextUrl.searchParams.get("revisionId") || undefined;

    let effectiveRevisionId = revisionId;
    if (!effectiveRevisionId) {
      const active = await getActiveCurriculumRevision();
      effectiveRevisionId = active?.id;
    }

    const grouped = await getSubjectGroupsWithSubjects(effectiveRevisionId);
    const result = grouped
      .filter((g) => g.subjects.length > 0)
      .map((g) => ({
        groupName: g.name,
        subjects: g.subjects.map((s) => ({ id: s.id, name: s.name })),
      }));

    return withCache(apiSuccess(result), CACHE_STATIC);
  } catch (error) {
    console.error("[api/subjects/grouped] 실패:", error);
    return handleApiError(error, "[api/subjects/grouped]");
  }
}
