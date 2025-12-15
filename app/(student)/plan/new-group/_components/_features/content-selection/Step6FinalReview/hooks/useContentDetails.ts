
import { useState, useEffect, useRef } from "react";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { BookDetail, LectureEpisode } from "../types";

type UseContentDetailsProps = {
  editingRangeIndex: { type: "student" | "recommended"; index: number } | null;
  data: WizardData;
  isCampMode?: boolean;
  studentId?: string;
};

export function useContentDetails({
  editingRangeIndex,
  data,
  isCampMode = false,
  studentId,
}: UseContentDetailsProps) {
  const [contentDetails, setContentDetails] = useState<
    Map<
      string,
      { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
    >
  >(new Map());
  const [startDetailId, setStartDetailId] = useState<Map<string, string>>(
    new Map()
  );
  const [endDetailId, setEndDetailId] = useState<Map<string, string>>(
    new Map()
  );
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const cachedDetailsRef = useRef<
    Map<
      string,
      { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
    >
  >(new Map());

  useEffect(() => {
    if (!editingRangeIndex) {
      return;
    }

    const fetchDetails = async () => {
      const content =
        editingRangeIndex.type === "student"
          ? data.student_contents[editingRangeIndex.index]
          : data.recommended_contents[editingRangeIndex.index];

      if (!content) return;

      const contentKey = `${editingRangeIndex.type}-${editingRangeIndex.index}`;

      // 이미 조회한 경우 캐시에서 가져오기
      if (cachedDetailsRef.current.has(content.content_id)) {
        const cached = cachedDetailsRef.current.get(content.content_id)!;
        setContentDetails(new Map([[contentKey, cached]]));
        return;
      }

      setLoadingDetails(new Set([contentKey]));

      try {
        // 캠프 모드에서 관리자의 경우 student_id를 쿼리 파라미터로 추가
        const studentIdParam =
          isCampMode && studentId ? `&student_id=${studentId}` : "";
        const apiPath =
          editingRangeIndex.type === "student"
            ? `/api/student-content-details?contentType=${content.content_type}&contentId=${content.content_id}${studentIdParam}`
            : `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`;

        const response = await fetch(apiPath);
        if (response.ok) {
          const result = await response.json();
          const detailData =
            content.content_type === "book"
              ? { details: result.details || [], type: "book" as const }
              : { details: result.episodes || [], type: "lecture" as const };

          // 캐시에 저장
          cachedDetailsRef.current.set(content.content_id, detailData);
          setContentDetails(new Map([[contentKey, detailData]]));

          // 저장된 상세 정보 ID가 있으면 우선 사용, 없으면 현재 범위로 찾기
          const savedStartDetailId = content.start_detail_id;
          const savedEndDetailId = content.end_detail_id;

          if (savedStartDetailId || savedEndDetailId) {
            // 저장된 detail_id로 직접 선택
            if (savedStartDetailId) {
              setStartDetailId((prev) => {
                const newMap = new Map(prev);
                newMap.set(contentKey, savedStartDetailId);
                return newMap;
              });
            }
            if (savedEndDetailId) {
              setEndDetailId((prev) => {
                const newMap = new Map(prev);
                newMap.set(contentKey, savedEndDetailId);
                return newMap;
              });
            }
          } else {
            // 저장된 detail_id가 없으면 현재 범위로 찾기 (하위 호환성)
            const currentRange = {
              start: content.start_range,
              end: content.end_range,
            };

            if (detailData.type === "book") {
              const details = detailData.details as BookDetail[];
              const startDetail = details.find(
                (d) => d.page_number === currentRange.start
              );
              const endDetail = details.find(
                (d) => d.page_number === currentRange.end
              );
              if (startDetail) {
                setStartDetailId((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(contentKey, startDetail.id);
                  return newMap;
                });
              }
              if (endDetail) {
                setEndDetailId((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(contentKey, endDetail.id);
                  return newMap;
                });
              }
            } else {
              const episodes = detailData.details as LectureEpisode[];
              const startEpisode = episodes.find(
                (e) => e.episode_number === currentRange.start
              );
              const endEpisode = episodes.find(
                (e) => e.episode_number === currentRange.end
              );
              if (startEpisode) {
                setStartDetailId((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(contentKey, startEpisode.id);
                  return newMap;
                });
              }
              if (endEpisode) {
                setEndDetailId((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(contentKey, endEpisode.id);
                  return newMap;
                });
              }
            }
          }
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
        );
        console.error("[useContentDetails] 상세정보 조회 실패:", planGroupError);
      } finally {
        setLoadingDetails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(contentKey);
          return newSet;
        });
      }
    };

    fetchDetails();
  }, [editingRangeIndex, data.student_contents, data.recommended_contents, isCampMode, studentId]);

  return {
    contentDetails,
    startDetailId,
    endDetailId,
    loadingDetails,
    setStartDetailId,
    setEndDetailId,
  };
}
