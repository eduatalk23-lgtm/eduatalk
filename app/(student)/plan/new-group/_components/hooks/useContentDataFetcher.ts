/**
 * useContentDataFetcher - 통합 콘텐츠 데이터 페칭 훅
 * 
 * 여러 컴포넌트에서 사용되는 콘텐츠 데이터 페칭 로직을 중앙화합니다.
 * - 배치 API 호출 최적화
 * - 캐싱을 통한 중복 요청 방지
 * - 메타데이터 및 상세 정보 통합 관리
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  createBatchRequest,
  transformBatchResponse,
  getContentType,
  type ContentType,
} from "@/lib/utils/contentDetailsUtils";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";
import { toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

/**
 * 콘텐츠 상세 정보 데이터 타입
 */
export type ContentDetailData = {
  details: Array<{
    id: string;
    page_number?: number;
    episode_number?: number;
    major_unit?: string | null;
    minor_unit?: string | null;
    title?: string | null;
  }>;
  type: "book" | "lecture";
  total_pages?: number | null;
  total_episodes?: number | null;
};

/**
 * 콘텐츠 메타데이터 타입
 */
export type ContentMetadata = {
  title?: string;
  subject?: string | null;
  subject_category?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

/**
 * 콘텐츠 정보 타입 (메타데이터 + 상세 정보 통합)
 */
export type ContentInfo = {
  content_type: "book" | "lecture";
  content_id: string;
  title: string;
  subject_category?: string | null;
  start_range: number;
  end_range: number;
  isRecommended: boolean;
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
  is_auto_recommended?: boolean;
  recommendation_source?: "auto" | "admin" | "template" | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: Record<string, unknown> | null;
};

type UseContentDataFetcherProps = {
  /**
   * 조회할 콘텐츠 ID 목록
   */
  contentIds: string[];
  /**
   * 교재 ID Set (타입 확인용)
   */
  bookIdSet: Set<string>;
  /**
   * 강의 ID Set (타입 확인용, 선택적)
   */
  lectureIdSet?: Set<string>;
  /**
   * 메타데이터 포함 여부
   */
  includeMetadata?: boolean;
  /**
   * 학생 ID (캠프 모드에서 사용)
   */
  studentId?: string;
  /**
   * 활성화 여부
   */
  enabled?: boolean;
  /**
   * 콘텐츠 타입 정보 (content_id -> content_type 매핑)
   */
  contentTypeMap?: Map<string, "book" | "lecture">;
};

type UseContentDataFetcherReturn = {
  /**
   * 콘텐츠 상세 정보 (content_id -> ContentDetailData)
   */
  contentDetails: Map<string, ContentDetailData>;
  /**
   * 콘텐츠 메타데이터 (content_id -> ContentMetadata)
   */
  contentMetadata: Map<string, ContentMetadata>;
  /**
   * 콘텐츠 정보 통합 (ContentInfo 배열)
   */
  contentInfos: ContentInfo[];
  /**
   * 콘텐츠 총량 정보 (content_id -> total)
   */
  contentTotals: Map<string, number>;
  /**
   * 로딩 중인 콘텐츠 ID Set
   */
  loadingDetails: Set<string>;
  /**
   * 전체 로딩 상태
   */
  loading: boolean;
  /**
   * 에러 상태
   */
  error: Error | null;
  /**
   * 특정 콘텐츠의 메타데이터를 수동으로 조회하는 함수
   */
  fetchMetadata: (contentId: string, contentType: "book" | "lecture") => Promise<ContentMetadata | null>;
};

/**
 * 전역 캐시 (모든 인스턴스에서 공유)
 * 컴포넌트가 언마운트되어도 캐시는 유지되어 재사용 가능
 */
const globalContentDetailsCache = new Map<string, ContentDetailData>();
const globalContentMetadataCache = new Map<string, ContentMetadata>();

/**
 * useContentDataFetcher 훅
 * 
 * 콘텐츠 데이터 페칭을 중앙화하고 캐싱을 통해 중복 요청을 방지합니다.
 */
export function useContentDataFetcher({
  contentIds,
  bookIdSet,
  lectureIdSet,
  includeMetadata = false,
  studentId,
  enabled = true,
  contentTypeMap,
}: UseContentDataFetcherProps): UseContentDataFetcherReturn {
  const [contentDetails, setContentDetails] = useState<Map<string, ContentDetailData>>(new Map());
  const [contentMetadata, setContentMetadata] = useState<Map<string, ContentMetadata>>(new Map());
  const [contentInfos, setContentInfos] = useState<ContentInfo[]>([]);
  const [contentTotals, setContentTotals] = useState<Map<string, number>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // AbortController를 위한 ref
  const abortControllerRef = useRef<AbortController | null>(null);
  // 마지막으로 조회한 콘텐츠 해시 (중복 요청 방지)
  const lastFetchedHashRef = useRef<string | null>(null);
  // 현재 요청 중인지 확인하는 ref
  const isFetchingRef = useRef(false);

  /**
   * 콘텐츠 목록 해시 생성 (중복 요청 방지용)
   */
  const contentHash = useMemo(() => {
    return contentIds.sort().join(",");
  }, [contentIds]);

  /**
   * 콘텐츠 타입 맵 생성 (없으면 bookIdSet으로부터 추론)
   */
  const effectiveContentTypeMap = useMemo(() => {
    if (contentTypeMap) {
      return contentTypeMap;
    }
    const map = new Map<string, "book" | "lecture">();
    contentIds.forEach((id) => {
      map.set(id, bookIdSet.has(id) ? "book" : "lecture");
    });
    return map;
  }, [contentIds, bookIdSet, contentTypeMap]);

  /**
   * 메타데이터 수동 조회 함수
   */
  const fetchMetadata = useCallback(
    async (contentId: string, contentType: "book" | "lecture"): Promise<ContentMetadata | null> => {
      // 캐시 확인
      if (globalContentMetadataCache.has(contentId)) {
        return globalContentMetadataCache.get(contentId)!;
      }

      try {
        const result = await fetchContentMetadataAction(contentId, contentType);
        if (result.success && result.data) {
          const metadata: ContentMetadata = {
            title: result.data.title,
            subject: result.data.subject,
            subject_category: result.data.subject_category,
            semester: result.data.semester,
            revision: result.data.revision,
            difficulty_level: result.data.difficulty_level,
            publisher: result.data.publisher,
            platform: result.data.platform,
          };
          // 캐시에 저장
          globalContentMetadataCache.set(contentId, metadata);
          return metadata;
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
        );
        console.error(`[useContentDataFetcher] 메타데이터 조회 실패 (${contentId}):`, planGroupError);
      }
      return null;
    },
    []
  );

  /**
   * 콘텐츠 데이터 페칭
   */
  useEffect(() => {
    if (!enabled || contentIds.length === 0) {
      setContentDetails(new Map());
      setContentMetadata(new Map());
      setContentInfos([]);
      setContentTotals(new Map());
      setLoadingDetails(new Set());
      setLoading(false);
      setError(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    // 중복 요청 방지
    if (lastFetchedHashRef.current === contentHash && isFetchingRef.current) {
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchAllData = async () => {
      if (isFetchingRef.current) {
        return;
      }
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      const newDetails = new Map<string, ContentDetailData>();
      const newMetadata = new Map<string, ContentMetadata>();
      const newTotals = new Map<string, number>();
      const newInfos: ContentInfo[] = [];

      try {
        // 1. 전역 캐시에서 먼저 확인
        const contentIdsToFetch: string[] = [];
        for (const contentId of contentIds) {
          if (globalContentDetailsCache.has(contentId)) {
            newDetails.set(contentId, globalContentDetailsCache.get(contentId)!);
            if (globalContentMetadataCache.has(contentId)) {
              newMetadata.set(contentId, globalContentMetadataCache.get(contentId)!);
            }
          } else {
            contentIdsToFetch.push(contentId);
          }
        }

        // 캐시된 데이터가 있으면 먼저 업데이트
        if (newDetails.size > 0) {
          setContentDetails(new Map(newDetails));
          if (newMetadata.size > 0) {
            setContentMetadata(new Map(newMetadata));
          }
        }

        // 2. 나머지 콘텐츠들을 배치 API로 조회
        if (contentIdsToFetch.length > 0) {
          const loadingSet = new Set(contentIdsToFetch);
          setLoadingDetails(new Set(loadingSet));

          try {
            const batchRequest = createBatchRequest(
              contentIdsToFetch.map((id) => ({ content_id: id })),
              bookIdSet,
              includeMetadata
            );

            const requestBody: typeof batchRequest & { student_id?: string } = {
              ...batchRequest,
            };
            if (studentId) {
              requestBody.student_id = studentId;
            }

            const response = await fetch("/api/student-content-details/batch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
              signal: abortController.signal,
            });

            if (response.ok) {
              const result = await response.json();
              const batchData = result.data;

              // 배치 응답 처리
              for (const contentId of contentIdsToFetch) {
                const contentType = effectiveContentTypeMap.get(contentId) || getContentType(
                  contentId,
                  bookIdSet,
                  lectureIdSet
                );
                const transformed = transformBatchResponse(
                  batchData,
                  contentId,
                  contentType
                );

                if (transformed) {
                  const detailData: ContentDetailData =
                    contentType === "book"
                      ? {
                          details: transformed.details || [],
                          type: "book",
                          total_pages: transformed.total_pages ?? null,
                        }
                      : {
                          details: transformed.episodes || [],
                          type: "lecture",
                          total_episodes: transformed.total_episodes ?? null,
                        };

                  // 전역 캐시 및 로컬 상태에 저장
                  globalContentDetailsCache.set(contentId, detailData);
                  newDetails.set(contentId, detailData);

                  // 메타데이터 저장
                  if (transformed.metadata) {
                    globalContentMetadataCache.set(contentId, transformed.metadata);
                    newMetadata.set(contentId, transformed.metadata);
                  }

                  // 총량 정보 저장
                  const total = contentType === "book"
                    ? transformed.total_pages
                    : transformed.total_episodes;
                  if (total && total > 0) {
                    newTotals.set(contentId, total);
                  }
                }
              }
            } else {
              throw new Error(`배치 API 호출 실패: ${response.status}`);
            }
          } catch (fetchError) {
            if (abortController.signal.aborted) {
              return;
            }
            throw fetchError;
          }
        }

        // 3. ContentInfo 배열 생성 (book, lecture만 포함, custom 제외)
        for (const contentId of contentIds) {
          const contentType = effectiveContentTypeMap.get(contentId) || getContentType(
            contentId,
            bookIdSet,
            lectureIdSet
          );
          
          // custom 타입은 ContentInfo에 포함하지 않음
          if (contentType === "custom") {
            continue;
          }
          
          const detail = newDetails.get(contentId);
          const metadata = newMetadata.get(contentId);

          // 메타데이터가 없으면 조회
          let finalMetadata: ContentMetadata | undefined = metadata;
          if (!finalMetadata && includeMetadata) {
            const fetchedMetadata = await fetchMetadata(contentId, contentType as "book" | "lecture");
            finalMetadata = fetchedMetadata ?? undefined;
          }

          const info: ContentInfo = {
            content_type: contentType as "book" | "lecture",
            content_id: contentId,
            title: finalMetadata?.title || "알 수 없음",
            subject_category: finalMetadata?.subject_category,
            start_range: 1, // 기본값 (실제 값은 wizardData에서 가져와야 함)
            end_range: detail?.total_pages || detail?.total_episodes || 1,
            isRecommended: false, // 실제 값은 wizardData에서 가져와야 함
            subject: finalMetadata?.subject,
            semester: finalMetadata?.semester,
            revision: finalMetadata?.revision,
            difficulty_level: finalMetadata?.difficulty_level,
            publisher: finalMetadata?.publisher,
            platform: finalMetadata?.platform,
          };

          newInfos.push(info);
        }

        // 요청이 취소되었는지 확인
        if (abortController.signal.aborted) {
          isFetchingRef.current = false;
          return;
        }

        // 상태 업데이트
        setContentDetails(new Map(newDetails));
        setContentMetadata(new Map(newMetadata));
        setContentInfos(newInfos);
        setContentTotals(newTotals);
        setLoadingDetails(new Set());
        setLoading(false);

        // 성공적으로 완료되면 해시 저장
        lastFetchedHashRef.current = contentHash;
      } catch (error) {
        if (abortController.signal.aborted) {
          isFetchingRef.current = false;
          return;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorObj = new Error(`콘텐츠 데이터 조회 실패: ${errorMessage}`);
        setError(errorObj);
        setLoading(false);
        setLoadingDetails(new Set());
        console.error("[useContentDataFetcher] Error:", error);
      } finally {
        isFetchingRef.current = false;
      }
    };

    fetchAllData();

    // Cleanup
    return () => {
      abortController.abort();
      isFetchingRef.current = false;
    };
  }, [
    enabled,
    contentIds,
    contentHash,
    bookIdSet,
    lectureIdSet,
    includeMetadata,
    studentId,
    effectiveContentTypeMap,
    fetchMetadata,
  ]);

  return {
    contentDetails,
    contentMetadata,
    contentInfos,
    contentTotals,
    loadingDetails,
    loading,
    error,
    fetchMetadata,
  };
}

