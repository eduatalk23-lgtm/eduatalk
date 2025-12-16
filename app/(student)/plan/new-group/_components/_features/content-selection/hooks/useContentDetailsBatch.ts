/**
 * useContentDetailsBatch Hook
 * 배치 API 호출 로직 통합, 캐싱 로직 통합, 에러 처리 통합
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  createBatchRequest,
  transformBatchResponse,
  getContentType,
  type ContentType,
  type ContentDetailsResponse,
} from "@/lib/utils/contentDetailsUtils";

type ContentDetailData = {
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

type ContentMetadata = {
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

type UseContentDetailsBatchProps = {
  contentIds: string[];
  bookIdSet: Set<string>;
  lectureIdSet?: Set<string>;
  includeMetadata?: boolean;
  studentId?: string;
  enabled?: boolean;
};

type UseContentDetailsBatchReturn = {
  contentDetails: Map<string, ContentDetailData>;
  contentMetadata: Map<string, ContentMetadata>;
  loadingDetails: Set<string>;
  error: Error | null;
};

export function useContentDetailsBatch({
  contentIds,
  bookIdSet,
  lectureIdSet,
  includeMetadata = false,
  studentId,
  enabled = true,
}: UseContentDetailsBatchProps): UseContentDetailsBatchReturn {
  const [contentDetails, setContentDetails] = useState<
    Map<string, ContentDetailData>
  >(new Map());
  const [contentMetadata, setContentMetadata] = useState<
    Map<string, ContentMetadata>
  >(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Error | null>(null);

  // 이미 조회한 콘텐츠 상세 정보를 캐시로 관리
  const cachedDetailsRef = useRef<Map<string, ContentDetailData>>(new Map());
  const cachedMetadataRef = useRef<Map<string, ContentMetadata>>(new Map());

  // 콘텐츠 목록을 content_id 형식으로 변환
  const contents = useMemo(
    () => contentIds.map((id) => ({ content_id: id })),
    [contentIds]
  );

  useEffect(() => {
    if (!enabled || contentIds.length === 0) {
      setContentDetails(new Map());
      setContentMetadata(new Map());
      setLoadingDetails(new Set());
      setError(null);
      return;
    }

    const fetchAllDetails = async () => {
      const newDetails = new Map<string, ContentDetailData>();
      const newMetadata = new Map<string, ContentMetadata>();

      // 1. 캐시된 콘텐츠 먼저 처리
      const contentIdsToFetch: string[] = [];
      for (const contentId of contentIds) {
        if (cachedDetailsRef.current.has(contentId)) {
          newDetails.set(
            contentId,
            cachedDetailsRef.current.get(contentId)!
          );
          if (cachedMetadataRef.current.has(contentId)) {
            newMetadata.set(
              contentId,
              cachedMetadataRef.current.get(contentId)!
            );
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
      if (contentIdsToFetch.length === 0) {
        return;
      }

      // 모든 콘텐츠를 로딩 상태로 설정
      const initialLoadingSet = new Set(contentIdsToFetch);
      setLoadingDetails(new Set(initialLoadingSet));
      setError(null);

      try {
        // 배치 요청 생성
        const batchRequest = createBatchRequest(
          contentIdsToFetch.map((id) => ({ content_id: id })),
          bookIdSet,
          includeMetadata
        );

        // studentId가 있으면 요청에 추가
        const requestBody: typeof batchRequest & { student_id?: string } = {
          ...batchRequest,
        };
        if (studentId) {
          requestBody.student_id = studentId;
        }

        // 재시도 가능한 에러인지 확인하는 헬퍼 함수
        const isRetryableError = (error: unknown): boolean => {
          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (
              message.includes("aborted") ||
              message.includes("econnreset") ||
              message.includes("network") ||
              message.includes("timeout") ||
              message.includes("fetch failed")
            );
          }
          return false;
        };

        // 배치 API 호출 (재시도 로직 포함)
        let response: Response | null = null;
        let batchError: Error | null = null;
        const maxRetries = 2;
        let retryCount = 0;

        while (retryCount <= maxRetries) {
          try {
            response = await fetch("/api/student-content-details/batch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
              signal: abortControllerRef.current?.signal,
            });

            if (response.ok) {
              break; // 성공하면 루프 종료
            }

            // 4xx 에러는 재시도하지 않음
            if (response.status >= 400 && response.status < 500) {
              break;
            }

            // 5xx 에러는 재시도
            if (response.status >= 500 && retryCount < maxRetries) {
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // 지수 백오프
              continue;
            }

            break;
          } catch (error) {
            batchError = error instanceof Error ? error : new Error(String(error));

            // 재시도 가능한 에러이고 재시도 횟수가 남아있으면 재시도
            if (isRetryableError(error) && retryCount < maxRetries) {
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // 지수 백오프
              continue;
            }

            // 재시도 불가능하거나 최대 재시도 횟수 초과
            break;
          }
        }

        if (response?.ok) {
          const result = await response.json();
          const batchData = result.data;

          // 배치 응답 결과 처리
          contentIdsToFetch.forEach((contentId) => {
            const contentType = getContentType(
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

              // 캐시에 저장
              cachedDetailsRef.current.set(contentId, detailData);
              newDetails.set(contentId, detailData);

              // 메타데이터 저장
              if (transformed.metadata) {
                cachedMetadataRef.current.set(contentId, transformed.metadata);
                newMetadata.set(contentId, transformed.metadata);
              }
            } else {
              // 응답이 없으면 빈 데이터로 저장
              const contentType = getContentType(
                contentId,
                bookIdSet,
                lectureIdSet
              );
              const emptyDetailData: ContentDetailData =
                contentType === "book"
                  ? { details: [], type: "book", total_pages: null }
                  : { details: [], type: "lecture", total_episodes: null };
              cachedDetailsRef.current.set(contentId, emptyDetailData);
              newDetails.set(contentId, emptyDetailData);
            }
          });

          if (process.env.NODE_ENV === "development") {
            console.log("[useContentDetailsBatch] 배치 API 성공:", {
              count: contentIdsToFetch.length,
              fetched: newDetails.size,
            });
          }
        } else {
          // 배치 API 실패 시 개별 API로 fallback
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[useContentDetailsBatch] 배치 API 실패, 개별 API로 fallback",
              {
                retryCount,
                error: batchError?.message || `HTTP ${batchResponse?.status}`,
              }
            );
          }

          const fetchPromises = contentIdsToFetch.map(async (contentId) => {
            const contentType = getContentType(
              contentId,
              bookIdSet,
              lectureIdSet
            );
            try {
              const endpoint = `/api/student-content-details?contentType=${contentType}&contentId=${contentId}&includeMetadata=${includeMetadata}${studentId ? `&student_id=${studentId}` : ""}`;
              const res = await fetch(endpoint);
              if (res.ok) {
                const r = await res.json();
                const transformed = transformBatchResponse(
                  { [contentId]: r.data },
                  contentId,
                  contentType
                );

                if (transformed) {
                  const d: ContentDetailData =
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

                  cachedDetailsRef.current.set(contentId, d);
                  if (transformed.metadata) {
                    cachedMetadataRef.current.set(
                      contentId,
                      transformed.metadata
                    );
                    newMetadata.set(contentId, transformed.metadata);
                  }
                  return { contentId, data: d };
                }
              }
            } catch (e) {
              console.error(
                `[useContentDetailsBatch] 개별 API 호출 실패 (${contentId}):`,
                e
              );
            }
            return null;
          });

          const results = await Promise.all(fetchPromises);
          results.forEach((r) => {
            if (r) {
              newDetails.set(r.contentId, r.data);
            }
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorObj = new Error(
          `콘텐츠 상세 정보 조회 실패: ${errorMessage}`
        );
        setError(errorObj);
        console.error("[useContentDetailsBatch] Error:", error);
      } finally {
        setLoadingDetails(new Set());
      }

      setContentDetails(new Map(newDetails));
      if (newMetadata.size > 0) {
        setContentMetadata(new Map(newMetadata));
      }
    };

    fetchAllDetails();
  }, [
    contentIds,
    bookIdSet,
    lectureIdSet,
    includeMetadata,
    studentId,
    enabled,
  ]);

  return { contentDetails, contentMetadata, loadingDetails, error };
}

