import { NextRequest } from "next/server";
import { getSubjectsByGroup } from "@/lib/data/subjects";
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectGroupId = searchParams.get("subject_group_id") || undefined;

    if (!subjectGroupId) {
      return apiBadRequest("subject_group_id가 필요합니다.");
    }

    const subjects = await getSubjectsByGroup(subjectGroupId);

    return apiSuccess(subjects);
  } catch (error) {
    return handleApiError(error, "[api/subjects]");
  }
}

