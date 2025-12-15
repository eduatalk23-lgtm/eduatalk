
import { useState, useEffect, useMemo } from "react";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { ContentInfo } from "../types";
import { createBatchRequest, getContentType } from "@/lib/utils/contentDetailsUtils";

type UseContentTotalsProps = {
  data: WizardData;
  contentInfos: ContentInfo[];
  isCampMode?: boolean;
  studentId?: string;
};

export function useContentTotals({
  data,
  contentInfos,
  isCampMode = false,
  studentId,
}: UseContentTotalsProps) {
  const [contentTotals, setContentTotals] = useState<Map<string, number>>(
    new Map()
  );
  const [loadingContentTotals, setLoadingContentTotals] = useState(false);

  // contentKey 매핑 생성 (메모이제이션)
  const contentKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    data.student_contents.forEach((c, idx) => {
      map.set(c.content_id, `student-${idx}`);
    });
    data.recommended_contents.forEach((c, idx) => {
      map.set(c.content_id, `recommended-${idx}`);
    });
    return map;
  }, [data.student_contents, data.recommended_contents]);

  // bookIdSet 생성 (콘텐츠 타입 확인용)
  const bookIdSet = useMemo(() => {
    const set = new Set<string>();
    data.student_contents.forEach((c) => {
      if (c.content_type === "book") {
        set.add(c.content_id);
      }
    });
    data.recommended_contents.forEach((c) => {
      if (c.content_type === "book") {
        set.add(c.content_id);
      }
    });
    return set;
  }, [data.student_contents, data.recommended_contents]);

  useEffect(() => {
    const fetchContentTotals = async () => {
      setLoadingContentTotals(true);
      const newTotals = new Map<string, number>();

      // 이미 조회한 콘텐츠는 제외
      const contentInfosToFetch = contentInfos.filter((info) => {
        const contentKey = contentKeyMap.get(info.content_id);
        return contentKey && !contentTotals.has(contentKey);
      });

      if (contentInfosToFetch.length === 0) {
        setLoadingContentTotals(false);
        return;
      }

      // 학생 콘텐츠와 추천 콘텐츠 분리
      const studentContents = contentInfosToFetch.filter(
        (info) => !info.isRecommended
      );
      const recommendedContents = contentInfosToFetch.filter(
        (info) => info.isRecommended
      );

      try {
        // 학생 콘텐츠는 배치 API로 조회
        if (studentContents.length > 0) {
          const batchRequest = createBatchRequest(
            studentContents.map((info) => ({ content_id: info.content_id })),
            bookIdSet,
            false // 메타데이터 불필요
          );

          const requestBody: typeof batchRequest & { student_id?: string } = {
            ...batchRequest,
          };
          if (isCampMode && studentId) {
            requestBody.student_id = studentId;
          }

          const batchResponse = await fetch("/api/student-content-details/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (batchResponse.ok) {
            const batchResult = await batchResponse.json();
            const batchData = batchResult.data;

            studentContents.forEach((contentInfo) => {
              const contentKey = contentKeyMap.get(contentInfo.content_id);
              if (!contentKey) return;

              const contentData = batchData[contentInfo.content_id];
              if (contentData) {
                const total =
                  contentInfo.content_type === "book"
                    ? contentData.total_pages
                    : contentData.total_episodes;

                // 총량 정보가 없으면 상세 정보에서 최대값 추정
                if (!total) {
                  if (contentInfo.content_type === "book" && contentData.details) {
                    const details = contentData.details || [];
                    if (details.length > 0) {
                      const maxPage = Math.max(
                        ...details.map((d: { page_number?: number }) => d.page_number || 0)
                      );
                      if (maxPage > 0) {
                        newTotals.set(contentKey, maxPage);
                      }
                    }
                  } else if (contentInfo.content_type === "lecture" && contentData.episodes) {
                    const episodes = contentData.episodes || [];
                    if (episodes.length > 0) {
                      const maxEpisode = Math.max(
                        ...episodes.map((e: { episode_number?: number }) => e.episode_number || 0)
                      );
                      if (maxEpisode > 0) {
                        newTotals.set(contentKey, maxEpisode);
                      }
                    }
                  }
                } else if (total > 0) {
                  newTotals.set(contentKey, total);
                }
              }
            });
          }
        }

        // 추천 콘텐츠는 병렬로 개별 API 호출 (마스터 콘텐츠는 배치 API 없음)
        if (recommendedContents.length > 0) {
          const recommendedPromises = recommendedContents.map(
            async (contentInfo) => {
              const contentKey = contentKeyMap.get(contentInfo.content_id);
              if (!contentKey) return null;

              try {
                const apiPath = `/api/master-content-info?content_type=${contentInfo.content_type}&content_id=${contentInfo.content_id}`;
                const response = await fetch(apiPath);
                if (response.ok) {
                  const info = await response.json();
                  const total =
                    contentInfo.content_type === "book"
                      ? info.total_pages
                      : info.total_episodes;

                  // 총량 정보가 없으면 상세 정보에서 최대값 추정
                  if (!total) {
                    const detailsApiPath = `/api/master-content-details?contentType=${contentInfo.content_type}&contentId=${contentInfo.content_id}`;
                    try {
                      const detailsResponse = await fetch(detailsApiPath);
                      if (detailsResponse.ok) {
                        const detailsResult = await detailsResponse.json();
                        if (contentInfo.content_type === "book") {
                          const details = detailsResult.details || [];
                          if (details.length > 0) {
                            const maxPage = Math.max(
                              ...details.map((d: { page_number?: number }) => d.page_number || 0)
                            );
                            if (maxPage > 0) {
                              return { contentKey, total: maxPage };
                            }
                          }
                        } else {
                          const episodes = detailsResult.episodes || [];
                          if (episodes.length > 0) {
                            const maxEpisode = Math.max(
                              ...episodes.map((e: { episode_number?: number }) => e.episode_number || 0)
                            );
                            if (maxEpisode > 0) {
                              return { contentKey, total: maxEpisode };
                            }
                          }
                        }
                      }
                    } catch (detailsError) {
                      const planGroupError = toPlanGroupError(
                        detailsError,
                        PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED,
                        { contentId: contentInfo.content_id }
                      );
                      console.error(
                        `[useContentTotals] 추천 콘텐츠 ${contentInfo.content_id} 상세정보 조회 실패 (총량 추정용):`,
                        planGroupError
                      );
                    }
                  } else if (total > 0) {
                    return { contentKey, total };
                  }
                }
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED,
                  { contentId: contentInfo.content_id }
                );
                console.error(
                  `[useContentTotals] 추천 콘텐츠 ${contentInfo.content_id} 총량 조회 실패:`,
                  planGroupError
                );
              }
              return null;
            }
          );

          const recommendedResults = await Promise.all(recommendedPromises);
          recommendedResults.forEach((result) => {
            if (result) {
              newTotals.set(result.contentKey, result.total);
            }
          });
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
        );
        console.error("[useContentTotals] 총량 조회 실패:", planGroupError);
      }

      if (newTotals.size > 0) {
        setContentTotals((prev) => new Map([...prev, ...newTotals]));
      }
      setLoadingContentTotals(false);
    };

    if (contentInfos.length > 0) {
      fetchContentTotals();
    }
  }, [
    contentInfos,
    contentKeyMap,
    bookIdSet,
    contentTotals,
    isCampMode,
    studentId,
  ]);

  return { contentTotals, loadingContentTotals };
}
