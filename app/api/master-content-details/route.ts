import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById, getMasterLectureById } from "@/lib/data/contentMasters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

    // contentType 검증
    if (contentType !== "book" && contentType !== "lecture") {
      console.error("[api/master-content-details] 잘못된 contentType:", {
        contentType,
        contentId,
        receivedValue: contentType,
        expectedValues: ["book", "lecture"],
      });
      return apiBadRequest(
        `지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요. (받은 값: ${contentType})`
      );
    }

    const supabase = await createSupabaseServerClient();
    
    // 관리자/컨설턴트가 다른 테넌트의 마스터 콘텐츠를 조회할 때는 Admin 클라이언트 사용 (RLS 우회)
    const masterQueryClient = (role === "admin" || role === "consultant") 
      ? createSupabaseAdminClient() || supabase
      : supabase;

    if (contentType === "book") {
      try {
        const result = await getMasterBookById(contentId, masterQueryClient);
        const { details, book } = result;

        if (includeMetadata) {
          const { data: bookData } = await supabase
            .from("master_books")
            .select("subject, semester, revision, difficulty_level, difficulty_level_id, publisher")
            .eq("id", contentId)
            .maybeSingle();

          return apiSuccess({
            details: details || [],
            total_pages: book?.total_pages || null,
            metadata: bookData || null,
          });
        }

        return apiSuccess({ 
          details: details || [],
          total_pages: book?.total_pages || null,
        });
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
        const result = await getMasterLectureById(contentId, masterQueryClient);
        const { episodes, lecture } = result;

        if (includeMetadata) {
          const { data: lectureData } = await supabase
            .from("master_lectures")
            .select("subject, semester, revision, difficulty_level, difficulty_level_id, platform")
            .eq("id", contentId)
            .maybeSingle();

          return apiSuccess({
            episodes: episodes || [],
            total_episodes: lecture?.total_episodes || null,
            metadata: lectureData || null,
          });
        }

        return apiSuccess({ 
          episodes: episodes || [],
          total_episodes: lecture?.total_episodes || null,
        });
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
