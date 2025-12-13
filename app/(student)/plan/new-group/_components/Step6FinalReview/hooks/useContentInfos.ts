
import { useState, useEffect, useMemo } from "react";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";
import { WizardData } from "../../PlanGroupWizard";
import { ContentInfo } from "../types";
import { createBatchRequest, getContentType } from "@/lib/utils/contentDetailsUtils";

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
  const [loading, setLoading] = useState(true);

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
    const fetchContentInfos = async () => {
      setLoading(true);
      const infos: ContentInfo[] = [];

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

        let batchMetadataMap = new Map<string, any>();

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

            // 배치 응답에서 메타데이터 추출
            data.student_contents.forEach((content) => {
              const contentData = batchData[content.content_id];
              if (contentData?.metadata) {
                batchMetadataMap.set(content.content_id, contentData.metadata);
              }
            });
          }
        } catch (error) {
          console.error("[useContentInfos] 배치 API 호출 실패:", error);
        }

        // 각 학생 콘텐츠 처리
        const studentPromises = data.student_contents.map(async (content) => {
          let title = (content as any).title;
          let subjectCategory = (content as any).subject_category;
          let metadata = batchMetadataMap.get(content.content_id) || null;

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
          async (content) => {
            let title = (content as any).title;
            let subjectCategory = (content as any).subject_category;

            // 저장된 정보가 없으면 서버 액션으로 조회 (마스터 콘텐츠)
            let metadata: any = null;
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

            // 메타데이터가 없으면 상세 정보 API에서 조회
            if (!metadata) {
              try {
                const response = await fetch(
                  `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}&includeMetadata=true`
                );
                if (response.ok) {
                  const result = await response.json();
                  metadata = result.metadata;
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

            return {
              content_type: content.content_type,
              content_id: content.content_id,
              title: title || "알 수 없음",
              subject_category: subjectCategory,
              start_range: content.start_range,
              end_range: content.end_range,
              isRecommended: true,
              // 자동 추천 정보 (content에 포함된 경우)
              is_auto_recommended: (content as any).is_auto_recommended ?? false,
              recommendation_source: (content as any).recommendation_source ?? null,
              recommendation_reason: (content as any).recommendation_reason ?? null,
              recommendation_metadata:
                (content as any).recommendation_metadata ?? null,
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
      setLoading(false);
    };

    fetchContentInfos();
  }, [data.student_contents, data.recommended_contents, contents, isCampMode, studentId, bookIdSet]);

  return { contentInfos, loading };
}
