/**
 * useRangeEditor Hook
 * 콘텐츠 범위 편집 상태 관리
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { WizardData } from "../../PlanGroupWizard";
import { BookDetail, LectureEpisode, UseRangeEditorReturn } from "../types";
import { toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

type ContentDetail =
  | { details: BookDetail[]; type: "book" }
  | { details: LectureEpisode[]; type: "lecture" };

type UseRangeEditorProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
};

export function useRangeEditor({
  data,
  onUpdate,
}: UseRangeEditorProps): UseRangeEditorReturn {
  const [editingRangeIndex, setEditingRangeIndex] = useState<number | null>(null);
  const [editingRange, setEditingRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [contentDetails, setContentDetails] = useState<Map<number, ContentDetail>>(
    new Map()
  );
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());
  const [startDetailId, setStartDetailId] = useState<Map<number, string>>(new Map());
  const [endDetailId, setEndDetailId] = useState<Map<number, string>>(new Map());
  const [contentTotals, setContentTotals] = useState<Map<number, number>>(new Map());
  
  const cachedDetailsRef = useRef<Map<string, ContentDetail>>(new Map());
  const cachedTotalsRef = useRef<Map<string, number>>(new Map());

  /**
   * 총 페이지수/회차 조회
   */
  const fetchContentTotal = useCallback(async (
    contentType: "book" | "lecture",
    contentId: string
  ): Promise<number | null> => {
    // 캐시 확인
    if (cachedTotalsRef.current.has(contentId)) {
      return cachedTotalsRef.current.get(contentId) ?? null;
    }

    try {
      const response = await fetch(
        `/api/master-content-info?content_type=${contentType}&content_id=${contentId}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const total = contentType === "book" 
            ? result.data.total_pages 
            : result.data.total_episodes;
          
          if (total && total > 0) {
            cachedTotalsRef.current.set(contentId, total);
            return total;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("[useRangeEditor] 총 페이지수/회차 조회 실패:", {
        contentType,
        contentId,
        error,
      });
      return null;
    }
  }, []);

  /**
   * 콘텐츠 상세정보 조회 (편집 시작 시)
   */
  useEffect(() => {
    if (editingRangeIndex === null) {
      return;
    }

    const content = data.recommended_contents[editingRangeIndex];
    if (!content) return;

    const fetchDetails = async () => {
      // 캐시 확인
      if (cachedDetailsRef.current.has(content.content_id)) {
        const cached = cachedDetailsRef.current.get(content.content_id)!;
        setContentDetails(new Map([[editingRangeIndex, cached]]));
        
        // 총 페이지수/회차 정보도 확인
        const cachedTotal = cachedTotalsRef.current.get(content.content_id);
        if (cachedTotal) {
          setContentTotals(new Map([[editingRangeIndex, cachedTotal]]));
        }
        return;
      }

      setLoadingDetails(new Set([editingRangeIndex]));

      try {
        // 상세정보와 총 페이지수/회차를 동시에 조회
        const [detailsResponse, total] = await Promise.all([
          fetch(
            `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`
          ),
          fetchContentTotal(content.content_type, content.content_id),
        ]);

        // 총 페이지수/회차 정보 저장
        if (total) {
          setContentTotals(new Map([[editingRangeIndex, total]]));
        }

        if (detailsResponse.ok) {
          const result = await detailsResponse.json();
          const detailData: ContentDetail =
            content.content_type === "book"
              ? { details: result.details || [], type: "book" as const }
              : { details: result.episodes || [], type: "lecture" as const };

          // 상세정보가 없는 경우 로깅 (정상 케이스)
          if (detailData.details.length === 0) {
            console.warn("[useRangeEditor] 상세정보 없음 (정상):", {
              type: "NO_DETAILS",
              contentType: content.content_type,
              contentId: content.content_id,
              title: content.title,
              total: total || "없음",
              reason: "해당 콘텐츠에 목차/회차 정보가 없습니다. 총 페이지수/회차를 바탕으로 범위를 설정할 수 있습니다.",
            });

            // 상세정보가 없고 총 페이지수/회차가 있는 경우, 전체 범위로 자동 설정
            if (total && total > 0) {
              setEditingRange({
                start: "1",
                end: String(total),
              });
            }
          } else {
            console.log("[useRangeEditor] 상세정보 조회 성공:", {
              type: "SUCCESS",
              contentType: content.content_type,
              contentId: content.content_id,
              title: content.title,
              detailsCount: detailData.details.length,
            });

            // 캐시 저장
            cachedDetailsRef.current.set(content.content_id, detailData);
            setContentDetails(new Map([[editingRangeIndex, detailData]]));

            // 현재 범위에 해당하는 항목 자동 선택
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
              if (startDetail)
                setStartDetailId(new Map([[editingRangeIndex, startDetail.id]]));
              if (endDetail)
                setEndDetailId(new Map([[editingRangeIndex, endDetail.id]]));
            } else {
              const episodes = detailData.details as LectureEpisode[];
              const startEpisode = episodes.find(
                (e) => e.episode_number === currentRange.start
              );
              const endEpisode = episodes.find(
                (e) => e.episode_number === currentRange.end
              );
              if (startEpisode)
                setStartDetailId(new Map([[editingRangeIndex, startEpisode.id]]));
              if (endEpisode)
                setEndDetailId(new Map([[editingRangeIndex, endEpisode.id]]));
            }
          }

          // 캐시 저장 (상세정보가 없어도 빈 배열로 저장)
          cachedDetailsRef.current.set(content.content_id, detailData);
          setContentDetails(new Map([[editingRangeIndex, detailData]]));
        } else {
          // API 호출 실패 시에도 총 페이지수/회차가 있으면 범위 자동 설정
          if (total && total > 0) {
            setEditingRange({
              start: "1",
              end: String(total),
            });
          }
        }
      } catch (error) {
        const planGroupError = toPlanGroupError(
          error,
          PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED
        );
        console.error(
          "[useRangeEditor] 상세정보 조회 실패 (에러):",
          {
            type: "API_ERROR",
            error: planGroupError,
            contentType: content.content_type,
            contentId: content.content_id,
            title: content.title,
            reason: "API 호출 실패 또는 네트워크 에러",
          }
        );
      } finally {
        setLoadingDetails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(editingRangeIndex);
          return newSet;
        });
      }
    };

    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRangeIndex, fetchContentTotal]);

  /**
   * 시작/끝 범위 선택 시 범위 자동 계산
   */
  useEffect(() => {
    if (editingRangeIndex === null) return;

    const content = data.recommended_contents[editingRangeIndex];
    if (!content) return;

    const contentInfo = contentDetails.get(editingRangeIndex);
    const startId = startDetailId.get(editingRangeIndex);
    const endId = endDetailId.get(editingRangeIndex);

    if (!contentInfo || !startId || !endId) return;

    let newStart: number | null = null;
    let newEnd: number | null = null;

    if (contentInfo.type === "book") {
      const details = contentInfo.details as BookDetail[];
      const startDetail = details.find((d) => d.id === startId);
      const endDetail = details.find((d) => d.id === endId);
      if (startDetail && endDetail) {
        newStart = startDetail.page_number;

        // 끝 범위: 끝 항목의 다음 항목의 페이지 - 1
        const endIndex = details.findIndex((d) => d.id === endId);
        if (endIndex !== -1 && endIndex < details.length - 1) {
          newEnd = details[endIndex + 1].page_number - 1;
        } else {
          // 끝 항목이 마지막 항목이면 총 페이지까지
          const totalPages = Math.max(
            content.end_range || 0,
            details.length > 0 ? details[details.length - 1].page_number : 0
          );
          newEnd = totalPages;
        }

        if (newStart > newEnd) [newStart, newEnd] = [newEnd, newStart];
      }
    } else {
      // 강의는 끝 항목의 회차를 그대로 사용
      const episodes = contentInfo.details as LectureEpisode[];
      const startEpisode = episodes.find((e) => e.id === startId);
      const endEpisode = episodes.find((e) => e.id === endId);
      if (startEpisode && endEpisode) {
        newStart = startEpisode.episode_number;
        newEnd = endEpisode.episode_number;
        if (newStart > newEnd) [newStart, newEnd] = [newEnd, newStart];
      }
    }

    if (newStart !== null && newEnd !== null) {
      setEditingRange({
        start: String(newStart),
        end: String(newEnd),
      });
    }
  }, [
    startDetailId,
    endDetailId,
    contentDetails,
    editingRangeIndex,
    data.recommended_contents,
  ]);

  /**
   * 범위 편집 시작
   */
  const startEditingRange = useCallback((index: number) => {
    const content = data.recommended_contents[index];
    setEditingRangeIndex(index);
    setEditingRange({
      start: String(content.start_range),
      end: String(content.end_range),
    });
  }, [data.recommended_contents]);

  /**
   * 범위 편집 취소
   */
  const cancelEditingRange = useCallback(() => {
    setEditingRangeIndex(null);
    setEditingRange(null);
  }, []);

  /**
   * 범위 저장
   */
  const saveEditingRange = useCallback(() => {
    if (editingRangeIndex === null || !editingRange) return;

    const newContents = [...data.recommended_contents];
    newContents[editingRangeIndex] = {
      ...newContents[editingRangeIndex],
      start_range: Number(editingRange.start),
      end_range: Number(editingRange.end),
    };
    onUpdate({ recommended_contents: newContents });
    setEditingRangeIndex(null);
    setEditingRange(null);
  }, [editingRangeIndex, editingRange, data.recommended_contents, onUpdate]);

  /**
   * 시작 범위 설정
   */
  const setStartRange = useCallback((index: number, detailId: string) => {
    const newMap = new Map(startDetailId);
    newMap.set(index, detailId);
    setStartDetailId(newMap);
  }, [startDetailId]);

  /**
   * 끝 범위 설정
   */
  const setEndRange = useCallback((index: number, detailId: string) => {
    const newMap = new Map(endDetailId);
    newMap.set(index, detailId);
    setEndDetailId(newMap);
  }, [endDetailId]);

  return {
    editingRangeIndex,
    editingRange,
    contentDetails,
    loadingDetails,
    startDetailId,
    endDetailId,
    contentTotals,
    startEditingRange,
    cancelEditingRange,
    saveEditingRange,
    setStartRange,
    setEndRange,
    setEditingRange,
  };
}

