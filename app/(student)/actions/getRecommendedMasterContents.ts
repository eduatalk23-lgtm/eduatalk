"use server";

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

type ApiResponse = {
  success: boolean;
  data?: {
    recommendations: RecommendedContent[];
  };
  error?: {
    code: string;
    message: string;
  };
};

export async function getRecommendedMasterContentsAction(
  studentId: string,
  subjects: string[],
  counts: Record<string, number>
): Promise<{ success: boolean; data?: { recommendations: RecommendedContent[] }; error?: string }> {
  try {
    console.log("[getRecommendedMasterContentsAction] 호출:", {
      studentId,
      subjects,
      counts,
    });

    // 교과별 추천 개수를 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    subjects.forEach((subject) => {
      const count = counts[subject] || 1;
      params.append("subjects", subject);
      params.append(`count_${subject}`, String(count));
    });
    
    // student_id 파라미터 추가
    params.append("student_id", studentId);

    // API 호출
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL 
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : typeof window !== 'undefined' 
        ? window.location.origin 
        : 'http://localhost:3000';
    
    const apiUrl = `${baseUrl}/api/recommended-master-contents?${params.toString()}`;
    
    console.log("[getRecommendedMasterContentsAction] API 호출:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[getRecommendedMasterContentsAction] API 응답 실패:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      
      return {
        success: false,
        error: `API 호출 실패: ${response.status} ${response.statusText}`,
      };
    }

    const result: ApiResponse = await response.json();
    
    if (!result.success) {
      console.error("[getRecommendedMasterContentsAction] API 에러:", result.error);
      return {
        success: false,
        error: result.error?.message || "추천 콘텐츠를 불러오는 데 실패했습니다.",
      };
    }

    console.log("[getRecommendedMasterContentsAction] 성공:", {
      recommendationsCount: result.data?.recommendations?.length || 0,
    });

    return {
      success: true,
      data: {
        recommendations: result.data?.recommendations || [],
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

