import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRecommendedMasterContents } from "@/lib/recommendations/masterContentRecommendation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";

/**
 * 추천 마스터 콘텐츠 조회 API
 * GET /api/recommended-master-contents?subjects=국어&subjects=수학&count_국어=2
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

    const supabase = await createSupabaseServerClient();

    // 학생의 tenant_id 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", user.userId)
      .maybeSingle();

    if (studentError) {
      return handleApiError(studentError, "[api/recommended-master-contents] 학생 조회 실패");
    }

    // 쿼리 파라미터에서 교과와 개수 정보 추출
    const { searchParams } = new URL(request.url);
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
      user.userId,
      student?.tenant_id || null,
      subjectCounts.size > 0 ? subjectCounts : undefined
    );

    return apiSuccess({ recommendations });
  } catch (error) {
    return handleApiError(error, "[api/recommended-master-contents]");
  }
}
