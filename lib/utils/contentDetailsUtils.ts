/**
 * 콘텐츠 상세 정보 관련 유틸리티 함수
 * 콘텐츠 타입 확인, API 엔드포인트 생성, 응답 데이터 변환 로직 통합
 */

export type ContentType = "book" | "lecture" | "custom";

export type ContentDetail = {
  id: string;
  page_number?: number;
  episode_number?: number;
  major_unit?: string | null;
  minor_unit?: string | null;
  title?: string | null;
};

export type ContentMetadata = {
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

export type ContentDetailsResponse = {
  details?: ContentDetail[];
  episodes?: ContentDetail[];
  total_pages?: number | null;
  total_episodes?: number | null;
  metadata?: ContentMetadata;
};

/**
 * 콘텐츠 ID가 교재인지 확인
 * @param contentId 콘텐츠 ID
 * @param bookIdSet 교재 ID Set (O(1) 조회를 위해)
 * @returns 교재 여부
 */
export function isBookContent(
  contentId: string,
  bookIdSet: Set<string>
): boolean {
  return bookIdSet.has(contentId);
}

/**
 * 콘텐츠 타입 결정
 * @param contentId 콘텐츠 ID
 * @param bookIdSet 교재 ID Set
 * @param lectureIdSet 강의 ID Set (선택적)
 * @returns 콘텐츠 타입
 */
export function getContentType(
  contentId: string,
  bookIdSet: Set<string>,
  lectureIdSet?: Set<string>
): ContentType {
  if (bookIdSet.has(contentId)) {
    return "book";
  }
  if (lectureIdSet && lectureIdSet.has(contentId)) {
    return "lecture";
  }
  // 기본값은 book (하위 호환성)
  return "book";
}

/**
 * 학생 콘텐츠 상세 정보 API 엔드포인트 생성
 * @param contentType 콘텐츠 타입
 * @param contentId 콘텐츠 ID
 * @param options 옵션
 * @returns API 엔드포인트 URL
 */
export function getStudentContentDetailsEndpoint(
  contentType: ContentType,
  contentId: string,
  options?: {
    includeMetadata?: boolean;
    studentId?: string;
  }
): string {
  const params = new URLSearchParams({
    contentType,
    contentId,
  });

  if (options?.includeMetadata) {
    params.set("includeMetadata", "true");
  }

  if (options?.studentId) {
    params.set("student_id", options.studentId);
  }

  return `/api/student-content-details?${params.toString()}`;
}

/**
 * 마스터 콘텐츠 상세 정보 API 엔드포인트 생성
 * @param contentType 콘텐츠 타입
 * @param contentId 콘텐츠 ID
 * @param options 옵션
 * @returns API 엔드포인트 URL
 */
export function getMasterContentDetailsEndpoint(
  contentType: ContentType,
  contentId: string,
  options?: {
    includeMetadata?: boolean;
  }
): string {
  const params = new URLSearchParams({
    contentType,
    contentId,
  });

  if (options?.includeMetadata) {
    params.set("includeMetadata", "true");
  }

  return `/api/master-content-details?${params.toString()}`;
}

/**
 * 배치 API 요청 데이터 생성
 * @param contents 콘텐츠 목록
 * @param bookIdSet 교재 ID Set
 * @param includeMetadata 메타데이터 포함 여부
 * @returns 배치 API 요청 본문
 */
export function createBatchRequest(
  contents: Array<{ content_id: string }>,
  bookIdSet: Set<string>,
  includeMetadata = false
): {
  contents: Array<{ contentId: string; contentType: "book" | "lecture" }>;
  includeMetadata: boolean;
} {
  return {
    contents: contents.map((content) => ({
      contentId: content.content_id,
      contentType: isBookContent(content.content_id, bookIdSet)
        ? ("book" as const)
        : ("lecture" as const),
    })),
    includeMetadata,
  };
}

/**
 * 배치 API 응답 데이터 변환
 * @param batchResponse 배치 API 응답
 * @param contentId 콘텐츠 ID
 * @param contentType 콘텐츠 타입
 * @returns 변환된 상세 정보
 */
export function transformBatchResponse(
  batchResponse: Record<
    string,
    {
      details?: ContentDetail[];
      episodes?: ContentDetail[];
      total_pages?: number | null;
      total_episodes?: number | null;
      metadata?: ContentMetadata;
    }
  >,
  contentId: string,
  contentType: ContentType
): ContentDetailsResponse | null {
  const contentData = batchResponse[contentId];
  if (!contentData) {
    return null;
  }

  if (contentType === "book") {
    return {
      details: contentData.details || [],
      total_pages: contentData.total_pages ?? null,
      metadata: contentData.metadata,
    };
  } else if (contentType === "lecture") {
    return {
      episodes: contentData.episodes || [],
      total_episodes: contentData.total_episodes ?? null,
      metadata: contentData.metadata,
    };
  }

  return null;
}

/**
 * 개별 API 응답 데이터 변환
 * @param response API 응답
 * @param contentType 콘텐츠 타입
 * @returns 변환된 상세 정보
 */
export function transformSingleResponse(
  response: {
    details?: ContentDetail[];
    episodes?: ContentDetail[];
    total_pages?: number | null;
    total_episodes?: number | null;
    metadata?: ContentMetadata;
  },
  contentType: ContentType
): ContentDetailsResponse {
  if (contentType === "book") {
    return {
      details: response.details || [],
      total_pages: response.total_pages ?? null,
      metadata: response.metadata,
    };
  } else {
    return {
      episodes: response.episodes || [],
      total_episodes: response.total_episodes ?? null,
      metadata: response.metadata,
    };
  }
}

