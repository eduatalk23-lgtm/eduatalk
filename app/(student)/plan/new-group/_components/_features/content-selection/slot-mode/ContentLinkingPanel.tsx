"use client";

import React, { memo, useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { ContentSlot, SlotType } from "@/lib/types/content-selection";
import {
  Search,
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
  Check,
  ChevronRight,
} from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type ContentItem = {
  id: string;
  title: string;
  subtitle?: string;
  content_type: "book" | "lecture" | "custom";
  subject_category?: string;
  subject?: string;
  total_pages?: number;
  total_episodes?: number;
  master_content_id?: string;
};

type ContentLinkingPanelProps = {
  selectedSlot: ContentSlot | null;
  slotIndex: number | null;
  availableContents: {
    books: ContentItem[];
    lectures: ContentItem[];
    custom: ContentItem[];
  };
  onLinkContent: (
    slotIndex: number,
    content: ContentItem,
    range: { start: number; end: number }
  ) => void;
  onUnlinkContent: (slotIndex: number) => void;
  editable?: boolean;
  studentId?: string;
  className?: string;
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

const SLOT_TYPE_CONFIG: Record<
  SlotType,
  { icon: typeof BookOpen; label: string }
> = {
  book: { icon: BookOpen, label: "교재" },
  lecture: { icon: Video, label: "강의" },
  custom: { icon: FileText, label: "커스텀" },
  self_study: { icon: Clock, label: "자습" },
  test: { icon: ClipboardList, label: "테스트" },
};

// ============================================================================
// 컴포넌트
// ============================================================================

function ContentLinkingPanelComponent({
  selectedSlot,
  slotIndex,
  availableContents,
  onLinkContent,
  onUnlinkContent,
  editable = true,
  studentId,
  className,
}: ContentLinkingPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(10);

  // 선택된 슬롯에 맞는 콘텐츠 필터링
  const filteredContents = useMemo(() => {
    if (!selectedSlot) return [];

    // 슬롯 타입에 따른 콘텐츠 소스 선택
    let contents: ContentItem[] = [];
    if (selectedSlot.slot_type === "book") {
      contents = availableContents.books;
    } else if (selectedSlot.slot_type === "lecture") {
      contents = availableContents.lectures;
    } else if (selectedSlot.slot_type === "custom") {
      contents = availableContents.custom;
    } else {
      // self_study, test는 콘텐츠 연결 불필요
      return [];
    }

    // 교과로 필터링
    if (selectedSlot.subject_category) {
      contents = contents.filter(
        (c) =>
          c.subject_category === selectedSlot.subject_category ||
          !c.subject_category
      );
    }

    // 검색어로 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      contents = contents.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.subtitle?.toLowerCase().includes(query)
      );
    }

    return contents;
  }, [selectedSlot, availableContents, searchQuery]);

  // 콘텐츠 선택 핸들러
  const handleSelectContent = useCallback(
    (content: ContentItem) => {
      if (slotIndex === null) return;
      onLinkContent(slotIndex, content, { start: rangeStart, end: rangeEnd });
    },
    [slotIndex, rangeStart, rangeEnd, onLinkContent]
  );

  // 콘텐츠 연결 해제 핸들러
  const handleUnlinkContent = useCallback(() => {
    if (slotIndex === null) return;
    onUnlinkContent(slotIndex);
  }, [slotIndex, onUnlinkContent]);

  // 슬롯이 선택되지 않은 경우
  if (!selectedSlot || slotIndex === null) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8",
          className
        )}
      >
        <div className="mb-2 text-gray-400">
          <ChevronRight className="h-8 w-8" />
        </div>
        <div className="text-center text-sm text-gray-500">
          왼쪽에서 슬롯을 선택하면
          <br />
          콘텐츠를 연결할 수 있습니다
        </div>
      </div>
    );
  }

  // 자습/테스트 슬롯인 경우
  if (
    selectedSlot.slot_type === "self_study" ||
    selectedSlot.slot_type === "test"
  ) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <SlotInfoHeader slot={selectedSlot} slotIndex={slotIndex} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-sm text-gray-500">
            {selectedSlot.slot_type === "self_study"
              ? "자습 슬롯은 콘텐츠 연결이 필요하지 않습니다."
              : "테스트 슬롯은 콘텐츠 연결이 필요하지 않습니다."}
          </div>
        </div>
      </div>
    );
  }

  // 슬롯 타입이 선택되지 않은 경우
  if (!selectedSlot.slot_type) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <SlotInfoHeader slot={selectedSlot} slotIndex={slotIndex} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-sm text-gray-500">
            먼저 슬롯 타입을 선택해주세요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* 슬롯 정보 헤더 */}
      <SlotInfoHeader slot={selectedSlot} slotIndex={slotIndex} />

      {/* 현재 연결된 콘텐츠 */}
      {selectedSlot.content_id && (
        <div className="mb-4 flex-shrink-0 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                연결됨: {selectedSlot.title}
              </span>
            </div>
            {editable && (
              <button
                type="button"
                onClick={handleUnlinkContent}
                className="text-xs text-red-500 hover:text-red-700"
              >
                연결 해제
              </button>
            )}
          </div>
          {selectedSlot.start_range !== undefined && (
            <div className="mt-1 text-xs text-green-600">
              범위: {selectedSlot.start_range} - {selectedSlot.end_range}
            </div>
          )}
        </div>
      )}

      {/* 검색 */}
      <div className="mb-4 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${selectedSlot.subject_category || ""} ${
              SLOT_TYPE_CONFIG[selectedSlot.slot_type]?.label || ""
            } 검색...`}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 범위 설정 */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">범위:</label>
          <input
            type="number"
            min={1}
            value={rangeStart}
            onChange={(e) => setRangeStart(Number(e.target.value))}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="number"
            min={rangeStart}
            value={rangeEnd}
            onChange={(e) => setRangeEnd(Number(e.target.value))}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <span className="text-xs text-gray-400">
            {selectedSlot.slot_type === "book" ? "페이지" : "회차"}
          </span>
        </div>
      </div>

      {/* 콘텐츠 리스트 */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {filteredContents.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {searchQuery
              ? "검색 결과가 없습니다"
              : "사용 가능한 콘텐츠가 없습니다"}
          </div>
        ) : (
          filteredContents.map((content) => (
            <ContentListItem
              key={content.id}
              content={content}
              isLinked={selectedSlot.content_id === content.id}
              onSelect={() => handleSelectContent(content)}
              disabled={!editable}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 하위 컴포넌트
// ============================================================================

type SlotInfoHeaderProps = {
  slot: ContentSlot;
  slotIndex: number;
};

function SlotInfoHeader({ slot, slotIndex }: SlotInfoHeaderProps) {
  const typeConfig = slot.slot_type
    ? SLOT_TYPE_CONFIG[slot.slot_type]
    : null;

  return (
    <div className="mb-4 flex-shrink-0 rounded-lg bg-gray-100 p-3">
      <div className="flex items-center gap-2">
        {typeConfig && <typeConfig.icon className="h-4 w-4 text-gray-600" />}
        <span className="font-medium text-gray-700">슬롯 {slotIndex + 1}</span>
        {slot.subject_category && (
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
            {slot.subject_category}
          </span>
        )}
      </div>
    </div>
  );
}

type ContentListItemProps = {
  content: ContentItem;
  isLinked: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

function ContentListItem({
  content,
  isLinked,
  onSelect,
  disabled,
}: ContentListItemProps) {
  const TypeIcon =
    content.content_type === "book"
      ? BookOpen
      : content.content_type === "lecture"
        ? Video
        : FileText;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || isLinked}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-all",
        isLinked
          ? "border-green-300 bg-green-50"
          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <TypeIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-800">
              {content.title}
            </div>
            {content.subtitle && (
              <div className="text-xs text-gray-500">{content.subtitle}</div>
            )}
            <div className="mt-1 text-xs text-gray-400">
              {content.content_type === "book" && content.total_pages
                ? `${content.total_pages}페이지`
                : content.content_type === "lecture" && content.total_episodes
                  ? `${content.total_episodes}회차`
                  : null}
            </div>
          </div>
        </div>
        {isLinked && <Check className="h-4 w-4 text-green-600" />}
      </div>
    </button>
  );
}

export const ContentLinkingPanel = memo(ContentLinkingPanelComponent);
