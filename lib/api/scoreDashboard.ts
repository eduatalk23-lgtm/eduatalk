/**
 * 성적 대시보드 API 클라이언트
 * 
 * /api/students/[id]/score-dashboard 를 호출하는 유틸리티 함수
 */

import type {
  ScoreDashboardResponse,
  ScoreDashboardParams,
} from "@/lib/types/scoreDashboard";

/**
 * 성적 대시보드 데이터를 가져옵니다.
 * 
 * @param params - API 호출 파라미터
 * @returns 성적 대시보드 응답 데이터
 * @throws {Error} API 호출 실패 시 에러
 */
export async function fetchScoreDashboard(
  params: ScoreDashboardParams
): Promise<ScoreDashboardResponse> {
  const { studentId, tenantId, termId, grade, semester } = params;

  // URL 생성
  const url = new URL(
    `/api/students/${studentId}/score-dashboard`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  );

  // Query 파라미터 추가 (tenantId가 null이면 "null" 문자열로 전달)
  url.searchParams.set("tenantId", tenantId ?? "null");

  if (termId) {
    url.searchParams.set("termId", termId);
  } else if (grade !== undefined && semester !== undefined) {
    url.searchParams.set("grade", grade.toString());
    url.searchParams.set("semester", semester.toString());
  }

  // API 호출
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store", // 항상 최신 데이터 가져오기
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: "Unknown error",
    }));

    throw new Error(
      `성적 대시보드 API 호출 실패: ${response.status} - ${
        errorData.error || errorData.message || "Unknown error"
      }`
    );
  }

  const data: ScoreDashboardResponse = await response.json();
  return data;
}

/**
 * 클라이언트 컴포넌트에서 사용하기 위한 래퍼 함수
 * (React Query 등과 함께 사용)
 */
export const scoreDashboardQueryKey = (params: ScoreDashboardParams) => [
  "scoreDashboard",
  params.studentId,
  params.tenantId,
  params.termId,
  params.grade,
  params.semester,
];

