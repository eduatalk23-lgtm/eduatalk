"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRecommendedMasterContents } from "@/lib/recommendations/masterContentRecommendation";

/**
 * 추천 마스터 콘텐츠 조회 액션
 * 
 * 학생 ID와 과목별 개수를 기반으로 추천 콘텐츠를 반환합니다.
 */

type RecommendedContent = {
  id: string;
  title: string;
  content_type: "book" | "lecture";
  subject_category: string;
  total_range: number;
  description?: string;
};

export async function getRecommendedMasterContentsAction(
  studentId: string | undefined,
  subjects: string[],
  counts: Record<string, number>
): Promise<{ success: boolean; data?: { recommendations: RecommendedContent[] }; error?: string }> {
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
    });

    // RecommendedMasterContent를 RecommendedContent로 변환
    const convertedRecommendations: RecommendedContent[] = recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      content_type: r.content_type,
      subject_category: r.subject_category,
      total_range: r.total_range,
      description: r.description,
    }));

    return {
      success: true,
      data: {
        recommendations: convertedRecommendations,
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

