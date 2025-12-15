/**
 * useContentSelection Hook
 * 콘텐츠 선택 상태 관리
 */

import { useState, useCallback } from "react";
import { WizardData } from "../../PlanGroupWizard";
import { RecommendedContent, UseContentSelectionReturn } from "../types";
import { MAX_CONTENTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "../constants";

type UseContentSelectionProps = {
  data: WizardData;
  recommendedContents: RecommendedContent[];
  allRecommendedContents: RecommendedContent[];
  onUpdate: (updates: Partial<WizardData>) => void;
};

export function useContentSelection({
  data,
  recommendedContents,
  allRecommendedContents,
  onUpdate,
}: UseContentSelectionProps): UseContentSelectionReturn {
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(
    new Set()
  );

  /**
   * 콘텐츠 선택 토글
   */
  const toggleContentSelection = useCallback((contentId: string) => {
    setSelectedContentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contentId)) {
        newSet.delete(contentId);
      } else {
        // 중복 확인
        const isDuplicate =
          data.student_contents.some((c) => c.content_id === contentId) ||
          data.recommended_contents.some((c) => c.content_id === contentId);
        
        if (isDuplicate) {
          alert(ERROR_MESSAGES.ALREADY_SELECTED);
          return prev;
        }
        newSet.add(contentId);
      }
      return newSet;
    });
  }, [data.student_contents, data.recommended_contents]);

  /**
   * 총 페이지수/회차 조회
   */
  const fetchContentTotal = useCallback(async (
    contentType: "book" | "lecture",
    contentId: string
  ): Promise<number | null> => {
    try {
      const response = await fetch(
        `/api/master-content-info?content_type=${contentType}&content_id=${contentId}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          if (contentType === "book") {
            return result.data.total_pages ?? null;
          } else {
            return result.data.total_episodes ?? null;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("[useContentSelection] 총 페이지수/회차 조회 실패:", {
        contentType,
        contentId,
        error,
      });
      return null;
    }
  }, []);

  /**
   * 선택된 콘텐츠 추가
   */
  const addSelectedContents = useCallback(async () => {
    console.log("[useContentSelection] addSelectedContents 호출:", {
      selectedContentIds: Array.from(selectedContentIds),
      selectedContentIdsSize: selectedContentIds.size,
      currentStudentContents: data.student_contents.length,
      currentRecommendedContents: data.recommended_contents.length,
    });

    if (selectedContentIds.size === 0) {
      console.warn("[useContentSelection] 선택된 콘텐츠가 없음");
      alert(ERROR_MESSAGES.NO_CONTENT_SELECTED);
      return;
    }

    // 최대 개수 확인
    const currentTotal =
      data.student_contents.length + data.recommended_contents.length;
    const toAdd = selectedContentIds.size;

    console.log("[useContentSelection] 개수 확인:", {
      currentTotal,
      toAdd,
      max: MAX_CONTENTS,
      willExceed: currentTotal + toAdd > MAX_CONTENTS,
    });

    if (currentTotal + toAdd > MAX_CONTENTS) {
      console.warn("[useContentSelection] 최대 개수 초과");
      alert(ERROR_MESSAGES.EXCEED_MAX_CONTENTS(currentTotal, toAdd, MAX_CONTENTS));
      return;
    }

    // 선택된 콘텐츠 정보 수집
    const contentsToAdd: Array<{
      content_type: "book" | "lecture";
      content_id: string;
      start_range: number;
      end_range: number;
      title?: string;
      subject_category?: string;
      master_content_id?: string;
      recommendation_reason?: string;
    }> = [];

    // 각 콘텐츠의 총 페이지수/회차 조회
    for (const contentId of selectedContentIds) {
      const content = recommendedContents.find((c) => c.id === contentId);
      if (content) {
        // 총 페이지수/회차 조회
        const total = await fetchContentTotal(content.contentType, content.id);
        const endRange = total && total > 0 ? total : 100;

        contentsToAdd.push({
          content_type: content.contentType,
          content_id: content.id,
          start_range: 1,
          end_range: endRange,
          title: content.title,
          subject_category: content.subject_category || undefined,
          master_content_id: content.id,
          recommendation_reason: content.reason,
        });
      }
    }

    if (contentsToAdd.length > 0) {
      console.log("[useContentSelection] 콘텐츠 추가:", {
        contentsToAdd: contentsToAdd.map((c) => ({
          content_id: c.content_id,
          content_type: c.content_type,
          title: c.title,
        })),
        currentRecommendedContents: data.recommended_contents.length,
        newRecommendedContents: data.recommended_contents.length + contentsToAdd.length,
      });

      onUpdate({
        recommended_contents: [
          ...data.recommended_contents,
          ...contentsToAdd,
        ],
      });

      console.log("[useContentSelection] onUpdate 호출 완료");
      alert(SUCCESS_MESSAGES.CONTENTS_ADDED(contentsToAdd.length));
      setSelectedContentIds(new Set());
    } else {
      console.warn("[useContentSelection] 추가할 콘텐츠가 없음");
    }
  }, [
    selectedContentIds,
    data.student_contents,
    data.recommended_contents,
    recommendedContents,
    onUpdate,
    fetchContentTotal,
  ]);

  /**
   * 콘텐츠 제거 (추천 콘텐츠와 학생 콘텐츠 모두 지원)
   */
  const removeContent = useCallback(
    (index: number, type: "recommended" | "student" = "recommended") => {
      if (type === "recommended") {
        const newContents = [...data.recommended_contents];
        newContents.splice(index, 1);
        onUpdate({ recommended_contents: newContents });
      } else {
        const newContents = [...data.student_contents];
        newContents.splice(index, 1);
        onUpdate({ student_contents: newContents });
      }
    },
    [data.recommended_contents, data.student_contents, onUpdate]
  );

  return {
    selectedContentIds,
    toggleContentSelection,
    addSelectedContents,
    removeContent,
    setSelectedContentIds,
  };
}

