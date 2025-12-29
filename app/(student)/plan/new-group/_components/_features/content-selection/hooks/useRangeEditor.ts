/**
 * useRangeEditor Hook
 * 콘텐츠 범위 편집 상태 관리
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { BookDetail, LectureEpisode, UseRangeEditorReturn } from "../types";
import { toPlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { parseContentDetailsResponse } from "@/lib/api/contentDetails";
import type { ContentType } from "@/lib/types/common";

type ContentDetail =
  | { details: BookDetail[]; type: "book" }
  | { details: LectureEpisode[]; type: "lecture" };

type UseRangeEditorProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  studentId?: string; // 관리자 모드에서 필요
};

export function useRangeEditor({
  data,
  onUpdate,
  studentId,
}: UseRangeEditorProps): UseRangeEditorReturn {
  const [editingRangeIndex, setEditingRangeIndex] = useState<number | null>(null);
  const [editingContentType, setEditingContentType] = useState<"recommended" | "student">("recommended");
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

  // AbortController for canceling previous requests (race condition prevention)
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 총 페이지수/회차 조회
   */
  const fetchContentTotal = useCallback(async (
    contentType: ContentType,
    contentId: string,
    studentId?: string,
    isStudentContent?: boolean
  ): Promise<number | null> => {
    // custom 타입은 총량 조회 지원하지 않음
    if (contentType === "custom") {
      return null;
    }
    // 캐시 확인 (학생 콘텐츠의 경우 studentId를 포함한 키 사용)
    const cacheKey = isStudentContent && studentId 
      ? `${contentId}_${studentId}` 
      : contentId;
    
    if (cachedTotalsRef.current.has(cacheKey)) {
      return cachedTotalsRef.current.get(cacheKey) ?? null;
    }

    try {
      // 학생 콘텐츠의 경우 student-content-info API 사용
      const apiEndpoint = isStudentContent && studentId
        ? `/api/student-content-info?content_type=${contentType}&content_id=${contentId}&student_id=${studentId}`
        : `/api/master-content-info?content_type=${contentType}&content_id=${contentId}`;
      
      const response = await fetch(apiEndpoint);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const total = contentType === "book" 
            ? result.data.total_pages 
            : result.data.total_episodes;
          
          if (total && total > 0) {
            cachedTotalsRef.current.set(cacheKey, total);
            return total;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("[useRangeEditor] 총 페이지수/회차 조회 실패:", {
        contentType,
        contentId,
        studentId,
        isStudentContent,
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

    const contents = editingContentType === "recommended"
      ? data.recommended_contents
      : data.student_contents;
    const content = contents[editingRangeIndex];
    if (!content) return;

    // Cancel previous request (race condition prevention)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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
        // 콘텐츠 타입에 따라 올바른 API 엔드포인트 선택
        const apiEndpoint = editingContentType === "recommended"
          ? `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`
          : `/api/student-content-details?contentType=${content.content_type}&contentId=${content.content_id}${studentId ? `&student_id=${studentId}` : ""}`;

        // 상세정보와 총 페이지수/회차를 동시에 조회
        const [detailsResponse, total] = await Promise.all([
          fetch(apiEndpoint, { signal: abortController.signal }),
          fetchContentTotal(content.content_type, content.content_id, studentId, editingContentType === "student"),
        ]);

        // 총 페이지수/회차 정보 저장
        if (total) {
          setContentTotals(new Map([[editingRangeIndex, total]]));
        }

        if (detailsResponse.ok) {
          const result = await detailsResponse.json();
          
          // API 응답을 타입 안전하게 파싱
          const parsedData = parseContentDetailsResponse(result, content.content_type);
          
          if (!parsedData) {
            console.error("[useRangeEditor] 상세정보 파싱 실패:", {
              contentId: content.content_id,
              contentType: content.content_type,
              response: result,
            });
            // 파싱 실패 시 빈 배열로 처리
            const detailData: ContentDetail = {
              details: [],
              type: content.content_type,
            } as ContentDetail;
            
            // 상세정보가 없는 경우 로깅 (개발 환경에서만)
            if (process.env.NODE_ENV === "development") {
              console.debug("[useRangeEditor] 상세정보 없음 (정상):", {
                type: "NO_DETAILS",
                contentType: content.content_type,
                contentId: content.content_id,
              });
            }
            
            setContentDetails((prev) => {
              const newMap = new Map(prev);
              newMap.set(editingRangeIndex, detailData);
              return newMap;
            });
            return;
          }
          
          const detailData: ContentDetail = parsedData as ContentDetail;

          // 상세정보가 없는 경우 로깅 (개발 환경에서만)
          if (detailData.details.length === 0) {
            if (process.env.NODE_ENV === "development") {
              console.debug("[useRangeEditor] 상세정보 없음 (정상):", {
                type: "NO_DETAILS",
                contentType: content.content_type,
                contentId: content.content_id,
                title: content.title,
                total: total || "없음",
                reason: "해당 콘텐츠에 목차/회차 정보가 없습니다. 총 페이지수/회차를 바탕으로 범위를 설정할 수 있습니다.",
              });
            }

            // 상세정보가 없을 때 현재 범위를 기본값으로 사용
            setEditingRange((prev) => {
              // 이미 편집 중인 범위가 있으면 유지
              if (prev) {
                return prev;
              }
              // 총 페이지수/회차가 있으면 전체 범위로 설정, 없으면 현재 범위 사용
              if (total && total > 0) {
                return {
                  start: "1",
                  end: String(total),
                };
              } else {
                // 현재 범위를 기본값으로 사용
                return {
                  start: String(content.start_range || 1),
                  end: String(content.end_range || 100),
                };
              }
            });
          } else {
            // 캐시 저장
            cachedDetailsRef.current.set(content.content_id, detailData);
            setContentDetails(new Map([[editingRangeIndex, detailData]]));

            // 현재 범위에 해당하는 항목 자동 선택
            const currentRange = {
              start: content.start_range || 1,
              end: content.end_range || 1,
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
          // API 호출 실패 시에도 빈 배열로 저장하여 직접 입력 UI 표시
          const emptyDetailData: ContentDetail =
            content.content_type === "book"
              ? { details: [], type: "book" as const }
              : { details: [], type: "lecture" as const };
          
          cachedDetailsRef.current.set(content.content_id, emptyDetailData);
          setContentDetails(new Map([[editingRangeIndex, emptyDetailData]]));
          
          // 총 페이지수/회차가 있으면 범위 자동 설정
          if (total && total > 0) {
            setEditingRange({
              start: "1",
              end: String(total),
            });
          } else {
            // 총량도 없으면 현재 범위 유지
            setEditingRange({
              start: String(content.start_range),
              end: String(content.end_range),
            });
          }
        }
      } catch (error) {
        // Abort된 요청은 무시 (race condition 방지)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

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
        
        // 에러 발생 시에도 빈 배열로 저장하여 직접 입력 UI 표시
        const emptyDetailData: ContentDetail =
          content.content_type === "book"
            ? { details: [], type: "book" as const }
            : { details: [], type: "lecture" as const };
        
        cachedDetailsRef.current.set(content.content_id, emptyDetailData);
        setContentDetails(new Map([[editingRangeIndex, emptyDetailData]]));
        
        // 총 페이지수/회차 조회 시도
        try {
          const total = await fetchContentTotal(content.content_type, content.content_id, studentId, editingContentType === "student");
          if (total) {
            setContentTotals(new Map([[editingRangeIndex, total]]));
            setEditingRange({
              start: "1",
              end: String(total),
            });
          } else {
            // 총량도 없으면 현재 범위 유지
            setEditingRange({
              start: String(content.start_range || 1),
              end: String(content.end_range || 100),
            });
          }
        } catch (totalError) {
          // 총량 조회 실패 시 현재 범위 유지
          setEditingRange({
            start: String(content.start_range || 1),
            end: String(content.end_range || 100),
          });
        }
      } finally {
        setLoadingDetails((prev) => {
          const newSet = new Set(prev);
          newSet.delete(editingRangeIndex);
          return newSet;
        });
      }
    };

    fetchDetails();

    // Cleanup: 컴포넌트 언마운트 또는 의존성 변경 시 요청 취소
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRangeIndex, fetchContentTotal]);

  /**
   * 시작/끝 범위 선택 시 범위 자동 계산
   */
  useEffect(() => {
    if (editingRangeIndex === null) return;

    const contents = editingContentType === "recommended" 
      ? data.recommended_contents 
      : data.student_contents;
    const content = contents[editingRangeIndex];
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
    editingContentType,
    data.recommended_contents,
    data.student_contents,
    studentId,
  ]);

  /**
   * 범위 편집 시작
   */
  const startEditingRange = useCallback((index: number, type: "recommended" | "student" = "recommended") => {
    const contents = type === "recommended" 
      ? data.recommended_contents 
      : data.student_contents;
    const content = contents[index];
    if (!content) return;
    
    setEditingContentType(type);
    setEditingRangeIndex(index);
    setEditingRange({
      start: String(content.start_range || 1),
      end: String(content.end_range || 1),
    });
  }, [data.recommended_contents, data.student_contents]);

  /**
   * 범위 편집 취소
   */
  const cancelEditingRange = useCallback(() => {
    setEditingRangeIndex(null);
    setEditingContentType("recommended");
    setEditingRange(null);
  }, []);

  /**
   * 범위 저장
   */
  const saveEditingRange = useCallback(() => {
    if (editingRangeIndex === null || !editingRange) return;

    const startNum = Number(editingRange.start);
    const endNum = Number(editingRange.end);

    // 유효성 검사
    if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum <= 0) {
      alert("유효한 숫자 범위를 입력해주세요.");
      return;
    }

    if (startNum > endNum) {
      alert("시작 범위는 종료 범위보다 클 수 없습니다.");
      return;
    }

    // 총 페이지수/회차 확인
    const contents = editingContentType === "recommended" 
      ? data.recommended_contents 
      : data.student_contents;
    const content = contents[editingRangeIndex];
    if (!content) return;
    
    const total = contentTotals.get(editingRangeIndex);
    if (total && (startNum > total || endNum > total)) {
      alert(
        `범위는 최대 ${total}${content.content_type === "book" ? "페이지" : "회차"}까지 입력할 수 있습니다.`
      );
      return;
    }

    if (editingContentType === "recommended") {
      const newContents = [...data.recommended_contents];
      newContents[editingRangeIndex] = {
        ...newContents[editingRangeIndex],
        start_range: startNum,
        end_range: endNum,
      };
      onUpdate({ recommended_contents: newContents });
    } else {
      const newContents = [...data.student_contents];
      newContents[editingRangeIndex] = {
        ...newContents[editingRangeIndex],
        start_range: startNum,
        end_range: endNum,
      };
      onUpdate({ student_contents: newContents });
    }
    setEditingRangeIndex(null);
    setEditingContentType("recommended");
    setEditingRange(null);
  }, [editingRangeIndex, editingContentType, editingRange, data.recommended_contents, data.student_contents, contentTotals, onUpdate]);

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

