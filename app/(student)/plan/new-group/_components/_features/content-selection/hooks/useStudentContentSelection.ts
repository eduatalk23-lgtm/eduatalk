import { useState, useEffect } from "react";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { ContentDetailData, BookDetail, LectureEpisode } from "../types";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";
import { getStudentContentMasterIdsAction } from "@/app/(student)/actions/getStudentContentMasterIds";
import {
  toPlanGroupError,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";

type UseContentSelectionProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  isCampMode: boolean;
  contents: {
    books: Array<{
      id: string;
      title: string;
      subtitle?: string | null;
      master_content_id?: string | null;
    }>;
    lectures: Array<{
      id: string;
      title: string;
      subtitle?: string | null;
      master_content_id?: string | null;
    }>;
  };
  contentDetails: Map<string, ContentDetailData>;
  // Lifted state
  selectedContentIds: Set<string>;
  setSelectedContentIds: (ids: Set<string>) => void;
};

export function useContentSelection({
  data,
  onUpdate,
  isCampMode,
  contents,
  contentDetails,
  selectedContentIds,
  setSelectedContentIds,
}: UseContentSelectionProps) {
  // removed internal selectedContentIds state
  const [contentRanges, setContentRanges] = useState<
    Map<string, { start: string; end: string }>
  >(new Map());
  const [startDetailId, setStartDetailId] = useState<Map<string, string>>(
    new Map()
  );
  const [endDetailId, setEndDetailId] = useState<Map<string, string>>(
    new Map()
  );

  // Sync ranges when details or selection change
  useEffect(() => {
    setContentRanges((prevRanges) => {
      const newRanges = new Map(prevRanges);

      for (const contentId of selectedContentIds) {
        const contentInfo = contentDetails.get(contentId);
        if (!contentInfo) continue;

        const startId = startDetailId.get(contentId);
        const endId = endDetailId.get(contentId);

        if (!startId || !endId) continue;

        if (contentInfo.type === "book") {
          const details = contentInfo.details as BookDetail[];
          const startDetail = details.find((d) => d.id === startId);
          const endDetail = details.find((d) => d.id === endId);

          if (startDetail && endDetail) {
            const startPage = startDetail.page_number;
            const endPage = endDetail.page_number;

            if (startPage > endPage) {
              newRanges.set(contentId, {
                start: String(endPage),
                end: String(startPage),
              });
            } else {
              newRanges.set(contentId, {
                start: String(startPage),
                end: String(endPage),
              });
            }
          }
        } else {
          const episodes = contentInfo.details as LectureEpisode[];
          const startEpisode = episodes.find((e) => e.id === startId);
          const endEpisode = episodes.find((e) => e.id === endId);

          if (startEpisode && endEpisode) {
            const startNum = startEpisode.episode_number;
            const endNum = endEpisode.episode_number;

            if (startNum > endNum) {
              newRanges.set(contentId, {
                start: String(endNum),
                end: String(startNum),
              });
            } else {
              newRanges.set(contentId, {
                start: String(startNum),
                end: String(endNum),
              });
            }
          }
        }
      }
      return newRanges;
    });
  }, [startDetailId, endDetailId, contentDetails, selectedContentIds]);

  const toggleContentSelection = (
    contentId: string,
    contentType: "book" | "lecture"
  ) => {
    const newSet = new Set(selectedContentIds);
    if (newSet.has(contentId)) {
      newSet.delete(contentId);
      // Cleanup
      const newStartIds = new Map(startDetailId);
      newStartIds.delete(contentId);
      setStartDetailId(newStartIds);
      const newEndIds = new Map(endDetailId);
      newEndIds.delete(contentId);
      setEndDetailId(newEndIds);
      const newRanges = new Map(contentRanges);
      newRanges.delete(contentId);
      setContentRanges(newRanges);
    } else {
      const totalContents = isCampMode
        ? data.student_contents.length
        : data.student_contents.length + data.recommended_contents.length;
      if (totalContents + newSet.size >= 9) {
        alert("플랜 대상 콘텐츠는 최대 9개까지 가능합니다.");
        return;
      }
      newSet.add(contentId);
    }
    setSelectedContentIds(newSet);
  };

  const updateContentRange = (
    contentId: string,
    field: "start" | "end",
    value: string
  ) => {
    const newRanges = new Map(contentRanges);
    const current = newRanges.get(contentId) || { start: "", end: "" };
    newRanges.set(contentId, { ...current, [field]: value });
    setContentRanges(newRanges);
  };

  const addSelectedContents = async () => {
    // 1. Get Master IDs
    const studentContentsForMasterId = data.student_contents.filter(
      (c: WizardData["student_contents"][number]) => c.content_type === "book" || c.content_type === "lecture"
    ) as Array<{ content_id: string; content_type: "book" | "lecture" }>;

    const studentMasterIds = new Set<string>();
    if (studentContentsForMasterId.length > 0) {
      try {
        const masterIdResult = await getStudentContentMasterIdsAction(
          studentContentsForMasterId
        );
        if (masterIdResult.success && masterIdResult.data) {
            masterIdResult.data.forEach((masterId) => {
                if (masterId) studentMasterIds.add(masterId);
            });
        }
      } catch (error) {
        console.warn("[useContentSelection] master_content_id fetch failed:", error);
      }
    }

    const contentsToAdd: Array<{
      content_type: "book" | "lecture";
      content_id: string;
      master_content_id?: string | null;
      start_range: number;
      end_range: number;
      start_detail_id?: string | null;
      end_detail_id?: string | null;
      title?: string;
      subject_category?: string;
    }> = [];

    for (const contentId of selectedContentIds) {
      const range = contentRanges.get(contentId);
      if (!range || !range.start || !range.end) {
        alert("모든 선택된 콘텐츠의 학습 범위를 입력해주세요.");
        return;
      }

      const start = Number(range.start);
      const end = Number(range.end);
      if (isNaN(start) || isNaN(end) || start > end) {
        alert("올바른 범위를 입력해주세요. (시작 ≤ 종료)");
        return;
      }

      const isBook = contents.books.some((b) => b.id === contentId);
      const contentType = isBook ? "book" : "lecture";
      const content = isBook
        ? contents.books.find((b) => b.id === contentId)
        : contents.lectures.find((l) => l.id === contentId);

      // Duplicate Check
      const isDuplicateByContentId = data.student_contents.some(
        (c: WizardData["student_contents"][number]) => c.content_type === contentType && c.content_id === contentId
      );
      const isDuplicateByMasterId =
        content?.master_content_id &&
        studentMasterIds.has(content.master_content_id);

      if (isDuplicateByContentId || isDuplicateByMasterId) continue;

      // Metadata fetch
      let subjectCategory: string | undefined = undefined;
      try {
        const result = await fetchContentMetadataAction(contentId, contentType);
        if (result.success && result.data) {
          subjectCategory = result.data.subject_category || undefined;
        }
      } catch (error) {
        console.error("[useContentSelection] Metadata fetch failed", error);
        subjectCategory = content?.subtitle || undefined;
      }

      contentsToAdd.push({
        content_type: contentType,
        content_id: contentId,
        start_range: start,
        end_range: end,
        start_detail_id: startDetailId.get(contentId) || null,
        end_detail_id: endDetailId.get(contentId) || null,
        title: content?.title,
        subject_category: subjectCategory,
        master_content_id: content?.master_content_id || null,
      });
    }

    if (contentsToAdd.length === 0) {
      alert("추가할 콘텐츠를 선택해주세요.");
      return;
    }

    const totalContents = isCampMode
      ? data.student_contents.length
      : data.student_contents.length + data.recommended_contents.length;
    
    if (totalContents + contentsToAdd.length > 9) {
      alert("플랜 대상 콘텐츠는 최대 9개까지 가능합니다.");
      return;
    }

    onUpdate({
      student_contents: [...data.student_contents, ...contentsToAdd],
    });

    // Reset
    setSelectedContentIds(new Set());
    setStartDetailId(new Map());
    setEndDetailId(new Map());
    setContentRanges(new Map());
  };

  const removeContent = (index: number) => {
    onUpdate({
      student_contents: data.student_contents.filter((_: WizardData["student_contents"][number], i: number) => i !== index),
    });
  };

  return {
    contentRanges,
    startDetailId,
    endDetailId,
    toggleContentSelection,
    updateContentRange,
    setStartDetailId,
    setEndDetailId,
    addSelectedContents,
    removeContent,
  };
}
