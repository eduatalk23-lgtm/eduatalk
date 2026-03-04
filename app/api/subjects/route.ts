import { NextRequest } from "next/server";
import { getSubjectsByGroup } from "@/lib/data/subjects";
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
  withCache,
  CACHE_STATIC,
} from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectGroupId = searchParams.get("subject_group_id") || undefined;

    if (!subjectGroupId) {
      return apiBadRequest("subject_group_id가 필요합니다.");
    }

    const subjects = await getSubjectsByGroup(subjectGroupId);

    return withCache(apiSuccess(subjects), CACHE_STATIC);
  } catch (error) {
    return handleApiError(error, "[api/subjects]");
  }
}

