"use client";

import { useState } from "react";
import { WizardData } from "../PlanGroupWizard";
import { useBatchContentDetails } from "./hooks/useBatchContentDetails";
import { useContentSelection } from "./hooks/useContentSelection";
import { ContentList } from "./components/ContentList";
import { SelectionProgress } from "./components/SelectionProgress";
import { AddedContentList } from "./components/AddedContentList";
import { getContentTitleFromMaster } from "./utils";

type Step3ContentsProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
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
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  onSaveDraft?: () => Promise<void> | void;
  isSavingDraft?: boolean;
  isCampMode?: boolean;
  editable?: boolean;
};

export function Step3Contents({
  data,
  onUpdate,
  contents,
  onSaveDraft,
  isSavingDraft = false,
  isCampMode = false,
  editable = true,
}: Step3ContentsProps) {
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(
    new Set()
  );

  const { contentDetails, loadingDetails, contentMetadata } =
    useBatchContentDetails({
      selectedContentIds,
      contents,
    });

  const {
    contentRanges,
    startDetailId,
    endDetailId,
    toggleContentSelection,
    updateContentRange,
    setStartDetailId,
    setEndDetailId,
    addSelectedContents,
    removeContent,
  } = useContentSelection({
    data,
    onUpdate,
    isCampMode,
    contents,
    contentDetails,
    selectedContentIds,
    setSelectedContentIds,
  });

  const studentCount = data.student_contents.length;
  const recommendedCount = data.recommended_contents.length;
  const totalCount =
    studentCount + (isCampMode ? 0 : recommendedCount) + selectedContentIds.size;
  // Note: SelectionProgress uses "totalCount" as the currently filled slots for the progress bar.
  // The logic in original was:
  // const totalContents = isCampMode ? data.student_contents.length : data.student_contents.length + data.recommended_contents.length;
  // And it checked against 9.
  // Here we want to show progress.
  
  const currentTotal = isCampMode 
    ? studentCount 
    : studentCount + recommendedCount;

  const canAddMore = totalCount < 9;
  const remainingSlots = 9 - totalCount;

  return (
    <div className="space-y-6">
      <SelectionProgress
        totalCount={totalCount}
        studentCount={studentCount}
        recommendedCount={recommendedCount}
        isCampMode={isCampMode}
        canAddMore={canAddMore}
        remainingSlots={remainingSlots}
      />

      {/* Books List */}
      <ContentList
        title="📚 등록된 교재"
        contentType="book"
        items={contents.books}
        emptyMessage="등록된 교재가 없습니다."
        onSaveDraft={onSaveDraft}
        selectedContentIds={selectedContentIds}
        contentRanges={contentRanges}
        startDetailId={startDetailId}
        endDetailId={endDetailId}
        contentDetails={contentDetails}
        loadingDetails={loadingDetails}
        contentMetadata={contentMetadata}
        onToggleSelection={toggleContentSelection}
        onSetStartDetail={setStartDetailId}
        onSetEndDetail={setEndDetailId}
        onUpdateRange={updateContentRange}
        editable={editable}
      />

      {/* Lectures List */}
      <ContentList
        title="🎧 등록된 강의"
        contentType="lecture"
        items={contents.lectures}
        emptyMessage="등록된 강의가 없습니다."
        onSaveDraft={onSaveDraft}
        selectedContentIds={selectedContentIds}
        contentRanges={contentRanges}
        startDetailId={startDetailId}
        endDetailId={endDetailId}
        contentDetails={contentDetails}
        loadingDetails={loadingDetails}
        contentMetadata={contentMetadata}
        onToggleSelection={toggleContentSelection}
        onSetStartDetail={setStartDetailId}
        onSetEndDetail={setEndDetailId}
        onUpdateRange={updateContentRange}
        editable={editable}
      />

      {/* Add Button Area */}
      {selectedContentIds.size > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              선택된 콘텐츠: {selectedContentIds.size}개
            </span>
            {!canAddMore && !isCampMode && (
              <span className="text-xs font-medium text-amber-600">
                ⚠️ 추천 콘텐츠 불가
              </span>
            )}
          </div>
          {Array.from(selectedContentIds).map((id) => {
            const range = contentRanges.get(id);
            const hasRange =
              range &&
              range.start &&
              range.end &&
              range.start.trim() !== "" &&
              range.end.trim() !== "";
            if (!hasRange) {
              const isBook = contents.books.some((b) => b.id === id);
              return (
                <div
                  key={id}
                  className="mb-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800"
                >
                  {isBook ? "📚" : "🎧"}{" "}
                  {getContentTitleFromMaster(contents, isBook ? "book" : "lecture", id)}: 
                  학습 범위를 입력해주세요
                </div>
              );
            }
            return null;
          })}
          <button
            type="button"
            onClick={addSelectedContents}
            disabled={
              !editable ||
              Array.from(selectedContentIds).some((id) => {
                const range = contentRanges.get(id);
                return (
                  !range ||
                  !range.start ||
                  !range.end ||
                  range.start.trim() === "" ||
                  range.end.trim() === ""
                );
              }) ||
              !canAddMore
            }
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            선택한 콘텐츠 추가하기 ({totalCount}/9)
          </button>
        </div>
      )}

      {/* Added Content List */}
      <AddedContentList
        contents={contents}
        studentContents={data.student_contents}
        onRemove={removeContent}
        editable={editable}
      />
    </div>
  );
}
