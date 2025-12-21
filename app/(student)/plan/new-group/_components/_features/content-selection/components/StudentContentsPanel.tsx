"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  StudentContentsPanelProps,
  SelectedContent,
  ContentMetadata,
  ContentRange,
} from "@/lib/types/content-selection";
import { ContentCard } from "./ContentCard";
import { ContentSelector } from "./ContentSelector";
import { RangeSettingModal } from "./RangeSettingModal";
import { fetchContentMetadataAction } from "@/app/(student)/actions/fetchContentMetadata";

/**
 * StudentContentsPanel - 학생 콘텐츠 선택 패널
 * 
 * Phase 3.3에서 구현
 * Step3Contents.tsx의 로직을 분리하여 재사용 가능하게 구현
 */
export function StudentContentsPanel({
  contents,
  selectedContents,
  maxContents,
  currentTotal,
  onUpdate,
  editable = true,
  isCampMode = false,
  studentId = null,
}: StudentContentsPanelProps) {
  // 선택된 콘텐츠 ID 관리
  const selectedIds = useMemo(() => {
    return new Set(selectedContents.map((c) => c.content_id));
  }, [selectedContents]);

  // 메타데이터 캐시
  const [metadataCache, setMetadataCache] = useState<Map<string, ContentMetadata>>(
    new Map()
  );

  // 범위 설정 모달
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeModalContent, setRangeModalContent] = useState<{
    id: string;
    type: "book" | "lecture";
    title: string;
    currentRange?: ContentRange;
  } | null>(null);
  
  // 범위 저장 여부 추적 (onClose에서 임시 콘텐츠 제거 여부 결정)
  const isRangeSavedRef = useRef(false);

  // 선택된 콘텐츠 목록 ref (스크롤용)
  const selectedContentsRef = useRef<HTMLDivElement>(null);

  // 최대 개수 도달
  const maxReached = currentTotal >= maxContents;
  const canAddMore = !maxReached;

  // 메타데이터 업데이트 헬퍼 함수
  const updateContentMetadata = useCallback(
    (contentId: string, updater: (content: SelectedContent) => SelectedContent) => {
      const index = selectedContents.findIndex((c: SelectedContent) => c.content_id === contentId);
      if (index >= 0) {
        const newContents = [...selectedContents];
        newContents[index] = updater(newContents[index]);
        onUpdate(newContents);
      }
    },
    [selectedContents, onUpdate]
  );

  // 콘텐츠 선택/해제
  const handleContentSelect = useCallback(
    (contentId: string, type: "book" | "lecture" | "custom") => {
      if (!editable) return;

      // 이미 선택된 경우 무시
      if (selectedIds.has(contentId)) return;

      // 최대 개수 체크
      if (maxReached) {
        alert(`플랜 대상 콘텐츠는 최대 ${maxContents}개까지 가능합니다.`);
        return;
      }

      // 마스터 콘텐츠 ID 기반 중복 체크 (book, lecture만)
      if (type === "book" || type === "lecture") {
        const content =
          type === "book"
            ? contents.books.find((b) => b.id === contentId)
            : contents.lectures.find((l) => l.id === contentId);

        if (content?.master_content_id) {
          // 이미 선택된 콘텐츠 중 같은 master_content_id를 가진 것이 있는지 확인
          const hasDuplicateMasterId = selectedContents.some(
            (c) => (c as any).master_content_id === content.master_content_id
          );

          if (hasDuplicateMasterId) {
            alert(
              "같은 마스터 콘텐츠를 기반으로 한 콘텐츠가 이미 추가되어 있습니다."
            );
            return;
          }
        }
      }

      // 커스텀 콘텐츠는 범위 설정 없이 바로 추가
      if (type === "custom") {
        const customContent = contents.custom.find((c) => c.id === contentId);
        if (!customContent) {
          console.error(`[StudentContentsPanel] custom 콘텐츠를 찾을 수 없습니다. contentId: ${contentId}`);
          return;
        }

        // custom 콘텐츠는 기본 범위 값으로 바로 추가
        const newContent: SelectedContent = {
          content_type: "custom",
          content_id: contentId,
          start_range: 1,
          end_range: 1,
          title: customContent.title,
        };

        console.log(`[StudentContentsPanel] custom 콘텐츠 추가: ${customContent.title} (${contentId})`);
        const updated = [...selectedContents, newContent];
        onUpdate(updated);
        return;
      }

      // 콘텐츠 정보 가져오기
      const content =
        type === "book"
          ? contents.books.find((b) => b.id === contentId)
          : contents.lectures.find((l) => l.id === contentId);

      if (!content) return;

      // Optimistic UI: 즉시 임시 데이터로 추가
      const tempContent: SelectedContent = {
        content_type: type,
        content_id: contentId,
        start_range: 1, // 기본값
        end_range: 100, // 기본값
        title: content.title,
        master_content_id: content.master_content_id || undefined,
        isLoadingMetadata: true, // 메타데이터 로딩 중 플래그
      };

      // 즉시 UI 업데이트
      const updated = [...selectedContents, tempContent];
      onUpdate(updated);

      // 백그라운드에서 메타데이터 조회
      // 캐시 확인
      const cachedMetadata = metadataCache.get(contentId);
      if (cachedMetadata) {
        // 캐시에 있으면 즉시 업데이트
        updateContentMetadata(contentId, (content) => ({
          ...content,
          subject_category: cachedMetadata.subject || content.subject_category,
          isLoadingMetadata: false,
        }));
        setMetadataCache((prev) => new Map(prev).set(contentId, cachedMetadata));
      } else {
        // 캐시에 없으면 서버에서 조회
        fetchContentMetadataAction(contentId, type)
          .then((result) => {
            if (result.success && result.data) {
              const metadata = result.data;
              // 메타데이터 캐시에 저장
              setMetadataCache((prev) => new Map(prev).set(contentId, metadata));

              // 해당 항목의 메타데이터만 업데이트
              updateContentMetadata(contentId, (content) => ({
                ...content,
                subject_category: metadata.subject || content.subject_category,
                isLoadingMetadata: false,
              }));
            } else {
              // 메타데이터 조회 실패
              updateContentMetadata(contentId, (content) => ({
                ...content,
                isLoadingMetadata: false,
                metadataError: result.error || "메타데이터를 불러올 수 없습니다.",
              }));
            }
          })
          .catch((error) => {
            console.error("[StudentContentsPanel] 메타데이터 조회 실패:", error);
            // 에러 처리
            updateContentMetadata(contentId, (content) => ({
              ...content,
              isLoadingMetadata: false,
              metadataError: "메타데이터를 불러올 수 없습니다.",
            }));
          });
      }

      // 범위 설정 모달 즉시 열기
      setRangeModalContent({
        id: contentId,
        type,
        title: content.title,
      });
      setRangeModalOpen(true);
    },
    [
      contents,
      selectedIds,
      maxReached,
      maxContents,
      editable,
      metadataCache,
      selectedContents,
      updateContentMetadata,
    ]
  );

  // 콘텐츠 삭제
  const handleContentRemove = useCallback(
    (contentId: string) => {
      if (!editable) return;

      const updated = selectedContents.filter((c) => c.content_id !== contentId);
      onUpdate(updated);
    },
    [selectedContents, onUpdate, editable]
  );

  // 범위 수정 모달 열기
  const handleEditRange = useCallback(
    (content: SelectedContent) => {
      if (!editable) return;

      // custom 타입은 범위 설정을 지원하지 않음
      if (content.content_type === "custom") {
        const errorMessage = `[StudentContentsPanel] custom 타입 콘텐츠는 범위 설정을 지원하지 않습니다. contentId: ${content.content_id}, title: ${content.title}`;
        console.error(errorMessage, { content });
        alert("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
        return;
      }

      const contentInfo =
        content.content_type === "book"
          ? contents.books.find((b) => b.id === content.content_id)
          : contents.lectures.find((l) => l.id === content.content_id);

      setRangeModalContent({
        id: content.content_id,
        type: content.content_type,
        title: content.title || contentInfo?.title || "제목 없음",
        currentRange: {
          start: String(content.start_range),
          end: String(content.end_range),
          start_detail_id: content.start_detail_id,
          end_detail_id: content.end_detail_id,
        },
      });
      setRangeModalOpen(true);
    },
    [contents, editable]
  );

  // 범위 저장
  const handleRangeSave = useCallback(
    (range: ContentRange) => {
      if (!rangeModalContent) {
        console.warn("[StudentContentsPanel] handleRangeSave: rangeModalContent is null");
        return;
      }

      const { id, type, title } = rangeModalContent;

      console.log("[StudentContentsPanel] handleRangeSave 시작:", {
        contentId: id,
        type,
        title,
        range,
        currentSelectedCount: selectedContents.length,
      });

      // 최신 selectedContents를 사용하기 위해 함수형 업데이트 패턴 사용
      // 하지만 onUpdate가 함수형을 지원하지 않으므로, selectedContents를 직접 사용
      // 대신 onUpdate 호출 전에 최신 상태를 확인
      const currentContents = selectedContents;
      
      // 기존 콘텐츠 찾기
      const existingIndex = currentContents.findIndex(
        (c) => c.content_id === id
      );

      console.log("[StudentContentsPanel] 기존 콘텐츠 검색 결과:", {
        existingIndex,
        contentId: id,
        currentContentsIds: currentContents.map(c => c.content_id),
      });

      const metadata = metadataCache.get(id);

      const newContent: SelectedContent = {
        content_type: type,
        content_id: id,
        start_range: Number(range.start.replace(/[^\d]/g, "")),
        end_range: Number(range.end.replace(/[^\d]/g, "")),
        start_detail_id: range.start_detail_id,
        end_detail_id: range.end_detail_id,
        title,
        subject_category: metadata?.subject || undefined,
        master_content_id:
          type === "book"
            ? contents.books.find((b) => b.id === id)?.master_content_id
            : contents.lectures.find((l) => l.id === id)?.master_content_id,
      };

      let updated: SelectedContent[];
      if (existingIndex >= 0) {
        // 기존 콘텐츠 업데이트
        updated = [...currentContents];
        updated[existingIndex] = newContent;
        console.log("[StudentContentsPanel] 기존 콘텐츠 업데이트:", {
          index: existingIndex,
          oldContent: currentContents[existingIndex],
          newContent,
        });
      } else {
        // 새 콘텐츠 추가
        updated = [...currentContents, newContent];
        console.log("[StudentContentsPanel] 새 콘텐츠 추가:", {
          newContent,
          updatedCount: updated.length,
        });
      }

      console.log("[StudentContentsPanel] onUpdate 호출 전:", {
        updatedCount: updated.length,
        updatedIds: updated.map(c => c.content_id),
      });

      // 범위 저장 플래그 설정 (onClose에서 임시 콘텐츠를 제거하지 않도록)
      isRangeSavedRef.current = true;

      // onUpdate 호출
      onUpdate(updated);

      console.log("[StudentContentsPanel] onUpdate 호출 완료");

      setRangeModalOpen(false);
      setRangeModalContent(null);
      
      // 다음 모달 열기를 위해 플래그 리셋 (약간의 지연 후)
      setTimeout(() => {
        isRangeSavedRef.current = false;
      }, 100);

      // 범위 저장 후 선택된 콘텐츠 목록으로 스크롤
      setTimeout(() => {
        if (selectedContentsRef.current) {
          selectedContentsRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
    },
    [rangeModalContent, selectedContents, metadataCache, contents, onUpdate]
  );

  // 콘텐츠 카드 렌더링
  const renderContentCard = useCallback(
    (content: SelectedContent) => {
      const metadata = metadataCache.get(content.content_id);

      // 커스텀 콘텐츠는 범위 정보가 없음
      const isCustom = content.content_type === "custom";

      return (
        <ContentCard
          key={content.content_id}
          content={{
            id: content.content_id,
            title: content.title || "제목 없음",
            subject: metadata?.subject,
            subject_group_name: metadata?.subject_group_name,
            semester: metadata?.semester,
            revision: metadata?.revision,
            difficulty: metadata?.difficulty_level,
            publisher: metadata?.publisher,
            platform: metadata?.platform,
            contentType: content.content_type,
          }}
          selected={true}
          readOnly={!editable}
          range={isCustom ? undefined : {
            start: String(content.start_range),
            end: String(content.end_range),
            start_detail_id: content.start_detail_id,
            end_detail_id: content.end_detail_id,
          }}
          isLoadingMetadata={content.isLoadingMetadata}
          metadataError={content.metadataError}
          onRemove={() => handleContentRemove(content.content_id)}
          onEditRange={isCustom ? undefined : () => handleEditRange(content)}
        />
      );
    },
    [metadataCache, editable, handleContentRemove, handleEditRange]
  );

  return (
    <div className="space-y-6">
      {/* 콘텐츠 선택기 */}
      {editable && (
        <ContentSelector
          books={contents.books}
          lectures={contents.lectures}
          custom={contents.custom}
          selectedIds={selectedIds}
          onSelect={handleContentSelect}
          disabled={!editable}
          maxReached={maxReached}
        />
      )}

      {/* 선택된 콘텐츠 목록 */}
      {selectedContents.length > 0 ? (
        <div ref={selectedContentsRef} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              선택된 콘텐츠
            </h3>
            <span className="text-sm text-gray-600">
              {selectedContents.length}개
            </span>
          </div>
          <div className="space-y-3">
            {selectedContents.map(renderContentCard)}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-sm font-medium text-gray-900">
            선택된 콘텐츠가 없습니다
          </p>
          <p className="text-sm text-gray-500">
            위에서 콘텐츠를 선택해주세요
          </p>
        </div>
      )}

      {/* 범위 설정 모달 */}
      {rangeModalContent && (
        <RangeSettingModal
          open={rangeModalOpen}
          onClose={() => {
            // 범위가 저장된 경우 임시 콘텐츠를 제거하지 않음
            if (isRangeSavedRef.current) {
              console.log("[StudentContentsPanel] 범위가 저장되어 임시 콘텐츠 제거하지 않음");
              setRangeModalOpen(false);
              setRangeModalContent(null);
              return;
            }

            // 모달을 닫을 때 임시로 추가한 콘텐츠 제거
            // (저장하지 않고 닫은 경우)
            console.log("[StudentContentsPanel] 범위 저장 없이 모달 닫기 - 임시 콘텐츠 제거");
            if (rangeModalContent) {
              // 임시 콘텐츠만 제거 (isLoadingMetadata가 true인 경우)
              const hasTempContent = selectedContents.some(
                (c) => c.content_id === rangeModalContent.id && c.isLoadingMetadata
              );
              if (hasTempContent) {
                console.log("[StudentContentsPanel] 임시 콘텐츠 제거:", rangeModalContent.id);
                const updated = selectedContents.filter(
                  (c) => c.content_id !== rangeModalContent.id
                );
                onUpdate(updated);
              } else {
                console.log("[StudentContentsPanel] 임시 콘텐츠가 없음 (이미 저장되었거나 없음)");
              }
            }
            setRangeModalOpen(false);
            setRangeModalContent(null);
          }}
          content={rangeModalContent}
          isRecommendedContent={false}
          currentRange={rangeModalContent.currentRange}
          onSave={handleRangeSave}
          studentId={studentId}
        />
      )}
    </div>
  );
}

