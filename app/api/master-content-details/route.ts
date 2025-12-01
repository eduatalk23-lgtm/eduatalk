import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById, getMasterLectureById } from "@/lib/data/contentMasters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

/**
 * 마스터 콘텐츠 상세 정보 조회 API
 * GET /api/master-content-details?contentType=book&contentId=...&includeMetadata=true
 *
 * @returns
 * 성공: { success: true, data: { details/episodes, metadata? } }
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
    const contentType = searchParams.get("contentType");
    const contentId = searchParams.get("contentId");
    const includeMetadata = searchParams.get("includeMetadata") === "true";

    if (!contentType || !contentId) {
      return apiBadRequest("contentType과 contentId가 필요합니다.");
    }

    const supabase = await createSupabaseServerClient();

    if (contentType === "book") {
      try {
        const result = await getMasterBookById(contentId);
        const { details } = result;

        if (includeMetadata) {
          const { data: bookData } = await supabase
            .from("master_books")
            .select("subject, semester, revision, difficulty_level, publisher")
            .eq("id", contentId)
            .maybeSingle();

          return apiSuccess({
            details: details || [],
            metadata: bookData || null,
          });
        }

        return apiSuccess({ details: details || [] });
      } catch (error) {
        console.error("[api/master-content-details] 교재 조회 실패:", {
          contentId,
          contentType,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // getMasterBookById에서 발생한 에러를 재던지기
        throw error;
      }
    } else if (contentType === "lecture") {
      try {
        const result = await getMasterLectureById(contentId);
        const { episodes } = result;

        if (includeMetadata) {
          const { data: lectureData } = await supabase
            .from("master_lectures")
            .select("subject, semester, revision, difficulty_level, platform")
            .eq("id", contentId)
            .maybeSingle();

          return apiSuccess({
            episodes: episodes || [],
            metadata: lectureData || null,
          });
        }

        return apiSuccess({ episodes: episodes || [] });
      } catch (error) {
        console.error("[api/master-content-details] 강의 조회 실패:", {
          contentId,
          contentType,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // getMasterLectureById에서 발생한 에러를 재던지기
        throw error;
      }
    } else {
      return apiBadRequest("지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.");
    }
  } catch (error) {
    console.error("[api/master-content-details] 예외 발생:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleApiError(error, "[api/master-content-details]");
  }
}
