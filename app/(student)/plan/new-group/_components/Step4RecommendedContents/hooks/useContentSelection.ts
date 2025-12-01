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
   * 선택된 콘텐츠 추가
   */
  const addSelectedContents = useCallback(() => {
    if (selectedContentIds.size === 0) {
      alert(ERROR_MESSAGES.NO_CONTENT_SELECTED);
      return;
    }

    // 최대 개수 확인
    const currentTotal =
      data.student_contents.length + data.recommended_contents.length;
    const toAdd = selectedContentIds.size;

    if (currentTotal + toAdd > MAX_CONTENTS) {
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

    selectedContentIds.forEach((contentId) => {
      const content = recommendedContents.find((c) => c.id === contentId);
      if (content) {
        contentsToAdd.push({
          content_type: content.contentType,
          content_id: content.id,
          start_range: 1,
          end_range: 100,
          title: content.title,
          subject_category: content.subject_category || undefined,
          master_content_id: content.id,
          recommendation_reason: content.reason,
        });
      }
    });

    if (contentsToAdd.length > 0) {
      onUpdate({
        recommended_contents: [
          ...data.recommended_contents,
          ...contentsToAdd,
        ],
      });
      alert(SUCCESS_MESSAGES.CONTENTS_ADDED(contentsToAdd.length));
      setSelectedContentIds(new Set());
    }
  }, [
    selectedContentIds,
    data.student_contents,
    data.recommended_contents,
    recommendedContents,
    onUpdate,
  ]);

  /**
   * 콘텐츠 제거
   */
  const removeContent = useCallback(
    (index: number) => {
      const newContents = [...data.recommended_contents];
      newContents.splice(index, 1);
      onUpdate({ recommended_contents: newContents });
    },
    [data.recommended_contents, onUpdate]
  );

  return {
    selectedContentIds,
    toggleContentSelection,
    addSelectedContents,
    removeContent,
    setSelectedContentIds,
  };
}

