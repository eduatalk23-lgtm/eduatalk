
import { useState, useEffect } from "react";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";
import { WizardData } from "../../PlanGroupWizard";
import { ContentInfo } from "../types";

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

  useEffect(() => {
    const fetchContentInfos = async () => {
      setLoading(true);
      const infos: ContentInfo[] = [];

      // 학생 콘텐츠
      for (const content of data.student_contents) {
        let title = (content as any).title;
        let subjectCategory = (content as any).subject_category;

        // 저장된 정보가 없으면 서버 액션으로 조회
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
              PlanGroupErrorCodes.CONTENT_FETCH_FAILED
            );
            console.error(
              "[useContentInfos] 학생 콘텐츠 메타데이터 조회 실패:",
              planGroupError
            );
          }
        }

        // 메타데이터가 없으면 상세 정보 API에서 조회
        if (!metadata) {
          try {
            // 캠프 모드에서 관리자의 경우 student_id를 쿼리 파라미터로 추가
            const studentIdParam =
              isCampMode && studentId ? `&student_id=${studentId}` : "";
            const response = await fetch(
              `/api/student-content-details?contentType=${content.content_type}&contentId=${content.content_id}&includeMetadata=true${studentIdParam}`
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

        infos.push({
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
        });
      }

      // 추천 콘텐츠
      for (const content of data.recommended_contents) {
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

        infos.push({
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
        });
      }

      setContentInfos(infos);
      setLoading(false);
    };

    fetchContentInfos();
  }, [data.student_contents, data.recommended_contents, contents, isCampMode, studentId]);

  return { contentInfos, loading };
}
