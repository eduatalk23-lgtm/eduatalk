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

  // 최대 개수 도달
  const maxReached = currentTotal >= maxContents;
  const canAddMore = !maxReached;

  // 콘텐츠 선택/해제
  const handleContentSelect = useCallback(
    async (contentId: string, type: "book" | "lecture" | "custom") => {
      if (!editable) return;

      // 이미 선택된 경우 무시
      if (selectedIds.has(contentId)) return;

      // 최대 개수 체크
      if (maxReached) {
        alert(`플랜 대상 콘텐츠는 최대 ${maxContents}개까지 가능합니다.`);
        return;
      }

      // 커스텀 콘텐츠는 메타데이터 없이 바로 추가
      if (type === "custom") {
        const customContent = contents.custom.find((c) => c.id === contentId);
        if (!customContent) return;

        // 범위 설정 모달 열기
        setRangeModalContent({
          id: contentId,
          type: "book", // 커스텀은 기본적으로 book 타입으로 처리
          title: customContent.title,
        });
        setRangeModalOpen(true);
        return;
      }

      // 메타데이터 조회 (이미 캐시에 있으면 재사용)
      let metadata = metadataCache.get(contentId);
      if (!metadata) {
        try {
          const result = await fetchContentMetadataAction(contentId, type);
          if (result.success && result.data) {
            metadata = result.data;
            setMetadataCache((prev) => new Map(prev).set(contentId, metadata!));
          }
        } catch (error) {
          console.error("[StudentContentsPanel] 메타데이터 조회 실패:", error);
        }
      }

      // 범위 설정 모달 열기
      const content =
        type === "book"
          ? contents.books.find((b) => b.id === contentId)
          : contents.lectures.find((l) => l.id === contentId);

      if (!content) return;

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
      if (!rangeModalContent) return;

      const { id, type, title } = rangeModalContent;

      // 기존 콘텐츠 찾기
      const existingIndex = selectedContents.findIndex(
        (c) => c.content_id === id
      );

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
        updated = [...selectedContents];
        updated[existingIndex] = newContent;
      } else {
        // 새 콘텐츠 추가
        updated = [...selectedContents, newContent];
      }

      onUpdate(updated);
      setRangeModalOpen(false);
      setRangeModalContent(null);
    },
    [rangeModalContent, selectedContents, metadataCache, contents, onUpdate]
  );

  // 콘텐츠 카드 렌더링
  const renderContentCard = useCallback(
    (content: SelectedContent) => {
      const metadata = metadataCache.get(content.content_id);

      return (
        <ContentCard
          key={content.content_id}
          content={{
            id: content.content_id,
            title: content.title || "제목 없음",
            subject: metadata?.subject,
            semester: metadata?.semester,
            difficulty: metadata?.difficulty_level,
            publisher: metadata?.publisher,
            platform: metadata?.platform,
          }}
          selected={true}
          readOnly={!editable}
          range={{
            start: String(content.start_range),
            end: String(content.end_range),
            start_detail_id: content.start_detail_id,
            end_detail_id: content.end_detail_id,
          }}
          onRemove={() => handleContentRemove(content.content_id)}
          onEditRange={() => handleEditRange(content)}
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
        <div className="space-y-4">
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
          <p className="mt-1 text-sm text-gray-500">
            위에서 콘텐츠를 선택해주세요
          </p>
        </div>
      )}

      {/* 범위 설정 모달 */}
      {rangeModalContent && (
        <RangeSettingModal
          open={rangeModalOpen}
          onClose={() => {
            setRangeModalOpen(false);
            setRangeModalContent(null);
          }}
          content={rangeModalContent}
          currentRange={rangeModalContent.currentRange}
          onSave={handleRangeSave}
        />
      )}
    </div>
  );
}

