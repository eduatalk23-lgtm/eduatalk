/**
 * 콘텐츠 상세정보 API 응답 처리 유틸리티
 * 
 * 플랜 그룹 생성 과정에서 교재 목차와 강의 회차 정보를 조회할 때
 * 사용하는 타입 안전한 API 응답 파싱 함수들을 제공합니다.
 */

import type { ApiSuccessResponse, ApiErrorResponse } from "./types";

// ============================================
// 타입 정의
// ============================================

/**
 * 교재 상세정보 (목차)
 */
export type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

/**
 * 강의 회차 정보
 */
export type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
  duration?: number | null;
};

/**
 * 교재 상세정보 API 응답 데이터
 */
export type BookDetailsResponseData = {
  details: BookDetail[];
  total_pages?: number | null;
  metadata?: {
    subject?: string | null;
    semester?: string | null;
    revision?: string | null;
    difficulty_level?: string | null;
    publisher?: string | null;
  };
};

/**
 * 강의 회차 정보 API 응답 데이터
 */
export type LectureEpisodesResponseData = {
  episodes: LectureEpisode[];
  total_episodes?: number | null;
  metadata?: {
    subject?: string | null;
    semester?: string | null;
    revision?: string | null;
    difficulty_level?: string | null;
    platform?: string | null;
  };
};

/**
 * 콘텐츠 상세정보 API 응답 (교재 또는 강의)
 */
export type ContentDetailsApiResponse =
  | ApiSuccessResponse<BookDetailsResponseData>
  | ApiSuccessResponse<LectureEpisodesResponseData>
  | ApiErrorResponse;

// ============================================
// 타입 가드
// ============================================

/**
 * 응답이 성공인지 확인
 */
export function isContentDetailsSuccess(
  response: ContentDetailsApiResponse
): response is ApiSuccessResponse<BookDetailsResponseData> | ApiSuccessResponse<LectureEpisodesResponseData> {
  return response.success === true;
}

/**
 * 응답이 교재 상세정보인지 확인
 */
export function isBookDetailsResponse(
  response: ApiSuccessResponse<BookDetailsResponseData> | ApiSuccessResponse<LectureEpisodesResponseData>
): response is ApiSuccessResponse<BookDetailsResponseData> {
  return "details" in response.data;
}

/**
 * 응답이 강의 회차 정보인지 확인
 */
export function isLectureEpisodesResponse(
  response: ApiSuccessResponse<BookDetailsResponseData> | ApiSuccessResponse<LectureEpisodesResponseData>
): response is ApiSuccessResponse<LectureEpisodesResponseData> {
  return "episodes" in response.data;
}

// ============================================
// 응답 파싱 함수
// ============================================

/**
 * 콘텐츠 상세정보 API 응답을 파싱하여 타입 안전하게 변환
 * 
 * @param response - API 응답 객체 (JSON 파싱된 결과)
 * @param contentType - 콘텐츠 타입 ("book" | "lecture")
 * @returns 파싱된 상세정보 데이터 또는 null (에러 시)
 * 
 * @example
 * ```typescript
 * const response = await fetch("/api/student-content-details?...");
 * const result = await response.json();
 * const detailData = parseContentDetailsResponse(result, "lecture");
 * 
 * if (detailData) {
 *   // detailData.details는 LectureEpisode[] 또는 BookDetail[]
 *   console.log(detailData.details);
 * }
 * ```
 */
export function parseContentDetailsResponse(
  response: unknown,
  contentType: "book" | "lecture"
): { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" } | null {
  // 기본 검증: 객체인지 확인
  if (!response || typeof response !== "object") {
    console.error("[parseContentDetailsResponse] 응답이 유효한 객체가 아닙니다:", response);
    return null;
  }

  // API 응답 구조 검증
  const apiResponse = response as ContentDetailsApiResponse;

  // 에러 응답 처리
  if (!apiResponse.success) {
    console.error("[parseContentDetailsResponse] API 에러:", apiResponse.error);
    return null;
  }

  // data 필드 존재 확인
  if (!apiResponse.data || typeof apiResponse.data !== "object") {
    console.error("[parseContentDetailsResponse] data 필드가 없거나 유효하지 않습니다:", apiResponse);
    return null;
  }

  const data = apiResponse.data;

  // 콘텐츠 타입에 따라 적절한 필드 추출
  if (contentType === "book") {
    // 교재의 경우 details 필드 확인
    if (isBookDetailsResponse(apiResponse)) {
      return {
        details: apiResponse.data.details || [],
        type: "book" as const,
      };
    }
    // 하위 호환성: data에 직접 details가 있는 경우
    if ("details" in data && Array.isArray(data.details)) {
      return {
        details: data.details as BookDetail[],
        type: "book" as const,
      };
    }
    console.warn("[parseContentDetailsResponse] 교재 상세정보를 찾을 수 없습니다:", data);
    return {
      details: [],
      type: "book" as const,
    };
  } else {
    // 강의의 경우 episodes 필드 확인
    if (isLectureEpisodesResponse(apiResponse)) {
      return {
        details: apiResponse.data.episodes || [],
        type: "lecture" as const,
      };
    }
    // 하위 호환성: data에 직접 episodes가 있는 경우
    if ("episodes" in data && Array.isArray(data.episodes)) {
      return {
        details: data.episodes as LectureEpisode[],
        type: "lecture" as const,
      };
    }
    console.warn("[parseContentDetailsResponse] 강의 회차 정보를 찾을 수 없습니다:", data);
    return {
      details: [],
      type: "lecture" as const,
    };
  }
}

/**
 * API 응답에서 data 필드를 안전하게 추출
 * 
 * @param response - API 응답 객체
 * @returns data 필드 또는 null
 */
export function extractApiData<T = unknown>(
  response: unknown
): T | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const apiResponse = response as { success?: boolean; data?: T };

  // success가 true이고 data가 있는 경우
  if (apiResponse.success === true && apiResponse.data !== undefined) {
    return apiResponse.data;
  }

  // 하위 호환성: success 필드가 없지만 data가 있는 경우
  if ("data" in apiResponse && apiResponse.data !== undefined) {
    return apiResponse.data as T;
  }

  return null;
}

