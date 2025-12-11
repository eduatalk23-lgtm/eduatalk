
import { useState, useEffect } from "react";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { WizardData } from "../../PlanGroupWizard";
import { ContentInfo, BookDetail, LectureEpisode } from "../types";

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

  useEffect(() => {
    const fetchContentTotals = async () => {
      setLoadingContentTotals(true);
      const newTotals = new Map<string, number>();

      // contentKey 매핑 생성 (최적화)
      const contentKeyMap = new Map<string, string>();
      data.student_contents.forEach((c, idx) => {
        contentKeyMap.set(c.content_id, `student-${idx}`);
      });
      data.recommended_contents.forEach((c, idx) => {
        contentKeyMap.set(c.content_id, `recommended-${idx}`);
      });

      for (const contentInfo of contentInfos) {
        const contentKey = contentKeyMap.get(contentInfo.content_id);
        if (!contentKey || contentTotals.has(contentKey)) continue;

        try {
          // 캠프 모드에서 관리자의 경우 student_id를 쿼리 파라미터로 추가
          const studentIdParam =
            isCampMode && studentId ? `&student_id=${studentId}` : "";
          const apiPath = contentInfo.isRecommended
            ? `/api/master-content-info?content_type=${contentInfo.content_type}&content_id=${contentInfo.content_id}`
            : `/api/student-content-info?content_type=${contentInfo.content_type}&content_id=${contentInfo.content_id}${studentIdParam}`;

          const response = await fetch(apiPath);
          if (response.ok) {
            const info = await response.json();
            let total =
              contentInfo.content_type === "book"
                ? info.total_pages
                : info.total_episodes;

            // 총량 정보가 없으면 상세 정보에서 최대값 추정
            if (!total) {
              const detailsApiPath = contentInfo.isRecommended
                ? `/api/master-content-details?contentType=${contentInfo.content_type}&contentId=${contentInfo.content_id}`
                : `/api/student-content-details?contentType=${contentInfo.content_type}&contentId=${contentInfo.content_id}${studentIdParam}`;

              try {
                const detailsResponse = await fetch(detailsApiPath);
                if (detailsResponse.ok) {
                  const detailsResult = await detailsResponse.json();
                  if (contentInfo.content_type === "book") {
                    const details = detailsResult.details || [];
                    if (details.length > 0) {
                      // 상세 정보의 최대 페이지 찾기
                      const maxPage = Math.max(
                        ...details.map((d: BookDetail) => d.page_number)
                      );
                      total = maxPage;
                    }
                  } else {
                    const episodes = detailsResult.episodes || [];
                    if (episodes.length > 0) {
                      const maxEpisode = Math.max(
                        ...episodes.map((e: LectureEpisode) => e.episode_number)
                      );
                      total = maxEpisode;
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
                  `[useContentTotals] 콘텐츠 ${contentInfo.content_id} 상세정보 조회 실패 (총량 추정용):`,
                  planGroupError
                );
              }
            }

            if (total && total > 0) {
              newTotals.set(contentKey, total);
            }
          }
        } catch (error) {
          const planGroupError = toPlanGroupError(
            error,
            PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED,
            { contentId: contentInfo.content_id }
          );
          console.error(
            `[useContentTotals] 콘텐츠 ${contentInfo.content_id} 총량 조회 실패:`,
            planGroupError
          );
        }
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
    data.student_contents,
    data.recommended_contents,
    contentTotals,
    isCampMode,
    studentId,
  ]);

  return { contentTotals, loadingContentTotals };
}
