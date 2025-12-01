import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRecommendedMasterContents } from "@/lib/recommendations/masterContentRecommendation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

/**
 * 추천 마스터 콘텐츠 조회 API
 * GET /api/recommended-master-contents?subjects=국어&subjects=수학&count_국어=2&student_id=xxx
 *
 * @returns
 * 성공: { success: true, data: { recommendations: [...] } }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiUnauthorized();
    }

    const { role } = await getCurrentUserRole();
    
    // 쿼리 파라미터에서 교과와 개수 정보 추출
    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get("student_id");
    
    // 학생 ID 결정: 관리자/컨설턴트인 경우 student_id 파라미터 사용, 학생인 경우 자신의 ID 사용
    let targetStudentId: string;
    const isAdminOrConsultant = role === "admin" || role === "consultant";
    
    if (isAdminOrConsultant) {
      if (!studentIdParam) {
        return apiBadRequest("관리자/컨설턴트의 경우 student_id가 필요합니다.");
      }
      targetStudentId = studentIdParam;
    } else {
      targetStudentId = user.userId;
    }

    // 관리자/컨설턴트가 다른 학생의 추천 콘텐츠를 조회할 때는 Admin 클라이언트 사용 (RLS 우회)
    // 마스터 콘텐츠 조회 시에도 RLS 문제가 있을 수 있으므로 Admin 클라이언트 사용
    let supabase;
    if (isAdminOrConsultant && studentIdParam) {
      const adminClient = createSupabaseAdminClient();
      if (!adminClient) {
        console.warn("[api/recommended-master-contents] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
        supabase = await createSupabaseServerClient();
      } else {
        supabase = adminClient;
      }
    } else {
      supabase = await createSupabaseServerClient();
    }

    // 대상 학생의 tenant_id 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", targetStudentId)
      .maybeSingle();

    if (studentError) {
      return handleApiError(studentError, "[api/recommended-master-contents] 학생 조회 실패");
    }

    if (!student) {
      return apiBadRequest("학생을 찾을 수 없습니다.");
    }

    const subjectsParam = searchParams.getAll("subjects");
    const subjectCounts = new Map<string, number>();

    if (subjectsParam.length > 0) {
      subjectsParam.forEach((subject) => {
        const countParam = searchParams.get(`count_${subject}`);
        const count = countParam ? parseInt(countParam, 10) : 1;
        if (!isNaN(count) && count > 0) {
          subjectCounts.set(subject, count);
        }
      });
    }

    const recommendations = await getRecommendedMasterContents(
      supabase,
      targetStudentId,
      student.tenant_id || null,
      subjectCounts.size > 0 ? subjectCounts : undefined
    );

    // 서버 사이드에서 반환 전 로깅
    console.log("[api/recommended-master-contents] 반환 전 recommendations 확인:", {
      count: recommendations.length,
      items: recommendations.map((r) => ({
        id: r.id,
        title: r.title,
        contentType: r.contentType,
        hasContentType: !!r.contentType,
        contentTypeType: typeof r.contentType,
        allKeys: Object.keys(r),
      })),
    });

    // 첫 번째 항목 전체 확인
    if (recommendations.length > 0) {
      const firstItem = recommendations[0];
      console.log("[api/recommended-master-contents] 첫 번째 항목 상세:", {
        id: firstItem.id,
        title: firstItem.title,
        contentType: firstItem.contentType,
        fullObject: firstItem,
        jsonStringified: JSON.stringify(firstItem),
      });

      // JSON 직렬화 테스트
      const testSerialized = JSON.stringify(firstItem);
      const testParsed = JSON.parse(testSerialized);
      console.log("[api/recommended-master-contents] JSON 직렬화 테스트:", {
        originalContentType: firstItem.contentType,
        serialized: testSerialized.substring(0, 200) + "...",
        parsedContentType: testParsed.contentType,
        hasContentTypeAfterParse: !!testParsed.contentType,
        parsedAllKeys: Object.keys(testParsed),
      });
    }

    // apiSuccess로 감싸기 전 데이터 확인
    const responseData = { recommendations };
    console.log("[api/recommended-master-contents] apiSuccess 호출 전 데이터:", {
      hasRecommendations: !!responseData.recommendations,
      recommendationsCount: responseData.recommendations.length,
      firstItemContentType: responseData.recommendations[0]?.contentType,
    });

    return apiSuccess({ recommendations });
  } catch (error) {
    return handleApiError(error, "[api/recommended-master-contents]");
  }
}
