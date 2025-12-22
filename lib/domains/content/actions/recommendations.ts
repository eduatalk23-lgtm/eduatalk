"use server";

/**
 * Content Recommendations Actions
 *
 * 추천 마스터 콘텐츠 조회
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRecommendedMasterContents, RecommendedMasterContent } from "@/lib/recommendations/masterContentRecommendation";

/**
 * 추천 마스터 콘텐츠 조회 액션
 *
 * 학생 ID와 과목별 개수를 기반으로 추천 콘텐츠를 반환합니다.
 * RecommendedMasterContent를 그대로 반환합니다 (contentType 포함).
 */
export async function getRecommendedMasterContentsAction(
  studentId: string | undefined,
  subjects: string[],
  counts: Record<string, number>
): Promise<{ success: boolean; data?: { recommendations: RecommendedMasterContent[] }; error?: string }> {
  try {
    // studentId가 없으면 현재 사용자 ID 사용
    let targetStudentId = studentId;
    if (!targetStudentId || targetStudentId === "undefined") {
      const user = await getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "로그인이 필요합니다.",
        };
      }
      targetStudentId = user.userId;
    }

    console.log("[getRecommendedMasterContentsAction] 호출:", {
      studentId,
      targetStudentId,
      subjects,
      counts,
    });

    // Supabase 클라이언트 생성
    const supabase = await createSupabaseServerClient();

    // 학생 정보 조회 (tenant_id 필요)
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", targetStudentId)
      .maybeSingle();

    if (studentError) {
      console.error("[getRecommendedMasterContentsAction] 학생 조회 실패:", studentError);
      return {
        success: false,
        error: "학생 정보를 조회할 수 없습니다.",
      };
    }

    if (!student) {
      return {
        success: false,
        error: "학생을 찾을 수 없습니다.",
      };
    }

    // 교과별 추천 개수를 Map으로 변환
    const subjectCounts = new Map<string, number>();
    subjects.forEach((subject) => {
      const count = counts[subject] || 1;
      subjectCounts.set(subject, count);
    });

    // 추천 콘텐츠 조회
    const recommendations = await getRecommendedMasterContents(
      supabase,
      targetStudentId,
      student.tenant_id || null,
      subjectCounts.size > 0 ? subjectCounts : undefined
    );

    console.log("[getRecommendedMasterContentsAction] 성공:", {
      recommendationsCount: recommendations.length,
      firstItem: recommendations[0] ? {
        id: recommendations[0].id,
        title: recommendations[0].title,
        contentType: recommendations[0].contentType,
        hasContentType: !!recommendations[0].contentType,
      } : null,
    });

    // RecommendedMasterContent를 그대로 반환 (contentType 포함)
    // Step3ContentSelection에서 RecommendedContent로 변환
    return {
      success: true,
      data: {
        recommendations: recommendations,
      },
    };
  } catch (error) {
    console.error("[getRecommendedMasterContentsAction] 예외 발생:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천 콘텐츠를 불러오는 데 실패했습니다.",
    };
  }
}
