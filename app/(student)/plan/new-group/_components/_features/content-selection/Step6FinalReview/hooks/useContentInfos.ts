
import { useState, useEffect, useMemo } from "react";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { ContentInfo } from "../types";
import { createBatchRequest, getContentType } from "@/lib/utils/contentDetailsUtils";

type ContentMetadata = {
  title?: string;
  subject?: string | null;
  subject_category?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

type UseContentInfosProps = {
  data: WizardData;
  contents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  isCampMode?: boolean;
  studentId?: string;
};

export function useContentInfos({
  data,
  contents,
  isCampMode = false,
  studentId,
}: UseContentInfosProps) {
  const [contentInfos, setContentInfos] = useState<ContentInfo[]>([]);
  const [contentTotals, setContentTotals] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingContentTotals, setLoadingContentTotals] = useState(true);

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

  // contentKeyMap 생성 (메모이제이션)
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

  useEffect(() => {
    const fetchContentInfos = async () => {
      setLoading(true);
      setLoadingContentTotals(true);
      const infos: ContentInfo[] = [];
      const newTotals = new Map<string, number>();

      // 학생 콘텐츠 배치 조회
      if (data.student_contents.length > 0) {
        // 배치 API로 메타데이터 조회
        const batchRequest = createBatchRequest(
          data.student_contents.map((c) => ({ content_id: c.content_id })),
          bookIdSet,
          true // 메타데이터 포함
        );

        const requestBody: typeof batchRequest & { student_id?: string } = {
          ...batchRequest,
        };
        if (isCampMode && studentId) {
          requestBody.student_id = studentId;
        }

        let batchMetadataMap = new Map<string, ContentMetadata>();

        try {
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

            // 배치 응답에서 메타데이터 및 total 정보 추출
            data.student_contents.forEach((content) => {
              const contentData = batchData[content.content_id];
              if (contentData?.metadata) {
                batchMetadataMap.set(content.content_id, contentData.metadata);
              }

              // total 정보 추출 (contentTotals용)
              const contentKey = contentKeyMap.get(content.content_id);
              if (contentKey && contentData) {
                const total = content.content_type === "book"
                  ? contentData.total_pages
                  : contentData.total_episodes;

                if (total && total > 0) {
                  newTotals.set(contentKey, total);
                } else {
                  // total이 없으면 상세 정보에서 최대값 추정
                  if (content.content_type === "book" && contentData.details) {
                    const details = contentData.details || [];
                    if (details.length > 0) {
                      const maxPage = Math.max(
                        ...details.map((d: { page_number?: number }) => d.page_number || 0)
                      );
                      if (maxPage > 0) {
                        newTotals.set(contentKey, maxPage);
                      }
                    }
                  } else if (content.content_type === "lecture" && contentData.episodes) {
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
                }
              }
            });
          }
        } catch (error) {
          console.error("[useContentInfos] 배치 API 호출 실패:", error);
        }

        // 각 학생 콘텐츠 처리
        const studentPromises = data.student_contents.map(async (content) => {
          let title = content.title;
          let subjectCategory = content.subject_category;
          let metadata: ContentMetadata | null = batchMetadataMap.get(content.content_id) || null;

          // 저장된 정보가 없으면 서버 액션으로 조회
          if (!title || !subjectCategory) {
            try {
              const result = await fetchContentMetadataAction(
                content.content_id,
                content.content_type
              );
              if (result.success && result.data) {
                title = title || result.data.title || "알 수 없음";
                subjectCategory = subjectCategory || result.data.subject_category;
                metadata = metadata || result.data;
              }
            } catch (error) {
              const planGroupError = toPlanGroupError(
                error,
                PlanGroupErrorCodes.CONTENT_FETCH_FAILED
              );
              console.error(
                "[useContentInfos] 학생 콘텐츠 메타데이터 조회 실패:",
                planGroupError
              );
            }
          }

          // 여전히 없으면 contents에서 찾기
          if (!title && contents) {
            if (content.content_type === "book") {
              const book = contents.books.find(
                (b) => b.id === content.content_id
              );
              title = book?.title || "알 수 없음";
              subjectCategory = subjectCategory || book?.subtitle || undefined;
            } else if (content.content_type === "lecture") {
              const lecture = contents.lectures.find(
                (l) => l.id === content.content_id
              );
              title = lecture?.title || "알 수 없음";
              subjectCategory = subjectCategory || lecture?.subtitle || undefined;
            }
          }

          return {
            content_type: content.content_type,
            content_id: content.content_id,
            title: title || "알 수 없음",
            subject_category: subjectCategory,
            start_range: content.start_range,
            end_range: content.end_range,
            isRecommended: false,
            subject: metadata?.subject || null,
            semester: metadata?.semester || null,
            revision: metadata?.revision || null,
            difficulty_level: metadata?.difficulty_level || null,
            publisher: metadata?.publisher || null,
            platform: metadata?.platform || null,
          };
        });

        const studentResults = await Promise.all(studentPromises);
        infos.push(...studentResults);
      }

      // 추천 콘텐츠 병렬 조회
      if (data.recommended_contents.length > 0) {
        const recommendedPromises = data.recommended_contents.map(
          async (content, idx) => {
            let title = content.title;
            let subjectCategory = content.subject_category;
            const contentKey = `recommended-${idx}`;

            // 저장된 정보가 없으면 서버 액션으로 조회 (마스터 콘텐츠)
            let metadata: ContentMetadata | null = null;
            let totalValue: number | null = null;

            if (!title || !subjectCategory) {
              try {
                const result = await fetchContentMetadataAction(
                  content.content_id,
                  content.content_type
                );
                if (result.success && result.data) {
                  title = title || result.data.title || "알 수 없음";
                  subjectCategory = subjectCategory || result.data.subject_category;
                  metadata = result.data;
                }
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
                );
                console.error(
                  "[useContentInfos] 마스터 콘텐츠 메타데이터 조회 실패:",
                  planGroupError
                );
              }
            }

            // 메타데이터가 없으면 상세 정보 API에서 조회 + total 정보 조회
            try {
              const apiPath = `/api/master-content-info?content_type=${content.content_type}&content_id=${content.content_id}`;
              const response = await fetch(apiPath);
              if (response.ok) {
                const info = await response.json();
                totalValue = content.content_type === "book"
                  ? info.total_pages
                  : info.total_episodes;

                if (!metadata) {
                  metadata = {
                    subject: info.subject,
                    semester: info.semester,
                    revision: info.revision,
                    difficulty_level: info.difficulty_level,
                    publisher: info.publisher,
                    platform: info.platform,
                  };
                }
              }
            } catch (error) {
              const planGroupError = toPlanGroupError(
                error,
                PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
              );
              console.error(
                "[useContentInfos] 마스터 콘텐츠 정보 조회 실패:",
                planGroupError
              );
            }

            // total이 없으면 상세 정보에서 추정
            if (!totalValue) {
              try {
                const detailsApiPath = `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`;
                const detailsResponse = await fetch(detailsApiPath);
                if (detailsResponse.ok) {
                  const detailsResult = await detailsResponse.json();
                  if (!metadata) {
                    metadata = detailsResult.metadata;
                  }
                  if (content.content_type === "book") {
                    const details = detailsResult.details || [];
                    if (details.length > 0) {
                      const maxPage = Math.max(
                        ...details.map((d: { page_number?: number }) => d.page_number || 0)
                      );
                      if (maxPage > 0) {
                        totalValue = maxPage;
                      }
                    }
                  } else {
                    const episodes = detailsResult.episodes || [];
                    if (episodes.length > 0) {
                      const maxEpisode = Math.max(
                        ...episodes.map((e: { episode_number?: number }) => e.episode_number || 0)
                      );
                      if (maxEpisode > 0) {
                        totalValue = maxEpisode;
                      }
                    }
                  }
                }
              } catch (error) {
                const planGroupError = toPlanGroupError(
                  error,
                  PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
                );
                console.error(
                  "[useContentInfos] 마스터 콘텐츠 상세정보 조회 실패:",
                  planGroupError
                );
              }
            }

            // total 정보 저장
            if (totalValue && totalValue > 0) {
              newTotals.set(contentKey, totalValue);
            }

            return {
              content_type: content.content_type,
              content_id: content.content_id,
              title: title || "알 수 없음",
              subject_category: subjectCategory,
              start_range: content.start_range,
              end_range: content.end_range,
              isRecommended: true,
              // 자동 추천 정보 (content에 포함된 경우)
              is_auto_recommended: content.is_auto_recommended ?? false,
              recommendation_source: content.recommendation_source ?? null,
              recommendation_reason: content.recommendation_reason ?? null,
              recommendation_metadata: content.recommendation_metadata ?? null,
              subject: metadata?.subject || null,
              semester: metadata?.semester || null,
              revision: metadata?.revision || null,
              difficulty_level: metadata?.difficulty_level || null,
              publisher: metadata?.publisher || null,
              platform: metadata?.platform || null,
            };
          }
        );

        const recommendedResults = await Promise.all(recommendedPromises);
        infos.push(...recommendedResults);
      }

      setContentInfos(infos);
      setContentTotals(newTotals);
      setLoading(false);
      setLoadingContentTotals(false);
    };

    fetchContentInfos();
  }, [data.student_contents, data.recommended_contents, contents, isCampMode, studentId, bookIdSet, contentKeyMap]);

  return { contentInfos, loading, contentTotals, loadingContentTotals };
}
