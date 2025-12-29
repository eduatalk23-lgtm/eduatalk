"use client";

import React, { memo, useCallback, useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/cn";
import { ContentSlot, SlotType, ContentRange } from "@/lib/types/content-selection";
import {
  Plus,
  Settings,
  Link2,
  FileText,
  ChevronRight,
  Check,
} from "lucide-react";
import { RangeSettingModal } from "../../components/RangeSettingModal";
import { getSubjectsByGroupNameAction } from "@/lib/domains/subject";
import { getRecommendedMasterContentsAction } from "@/lib/domains/content";
import { useMasterContentSearch, type MasterContentResult } from "@/lib/hooks/useMasterContentSearch";

// 서브 컴포넌트들
import {
  SLOT_TYPE_CONFIG,
  DEFAULT_SUBJECT_CATEGORIES,
  SlotDetailTab,
  ContentLinkingTab,
  RangeTab,
  type EditorTab,
  type SourceTab,
  type SubjectInfo,
  type ContentItem,
  type RecommendedContentItem,
  type RangeModalContent,
} from "./slot-editor";

// ============================================================================
// 타입 정의
// ============================================================================

type SlotEditorPanelProps = {
  // 선택된 슬롯
  selectedSlot: ContentSlot | null;
  slotIndex: number | null;
  // 슬롯 조작
  onSlotUpdate: (index: number, slot: ContentSlot) => void;
  onAddSlot: () => void;
  canAddSlot: boolean;
  currentSlotCount: number;
  maxSlots: number;
  // 콘텐츠 연결
  availableContents: {
    books: ContentItem[];
    lectures: ContentItem[];
    custom: ContentItem[];
  };
  onLinkContent: (
    slotIndex: number,
    content: ContentItem,
    range: { start: number; end: number },
    masterContentId?: string
  ) => void;
  onUnlinkContent: (slotIndex: number) => void;
  // 기타
  editable?: boolean;
  studentId?: string;
  subjectCategories?: string[];
  className?: string;
};

// ============================================================================
// 메인 컴포넌트
// ============================================================================

function SlotEditorPanelComponent({
  selectedSlot,
  slotIndex,
  onSlotUpdate,
  onAddSlot,
  canAddSlot,
  currentSlotCount,
  maxSlots,
  availableContents,
  onLinkContent,
  onUnlinkContent,
  editable = true,
  studentId,
  subjectCategories = DEFAULT_SUBJECT_CATEGORIES,
  className,
}: SlotEditorPanelProps) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<EditorTab>("detail");

  // 과목 로딩 상태
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // 콘텐츠 탭 상태
  const [sourceTab, setSourceTab] = useState<SourceTab>("student");
  const [searchQuery, setSearchQuery] = useState("");

  // 추천 콘텐츠 상태
  const [recommendedContents, setRecommendedContents] = useState<RecommendedContentItem[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [hasLoadedRecommendations, setHasLoadedRecommendations] = useState(false);

  // 마스터 검색
  const masterSearch = useMasterContentSearch({ limit: 20 });

  // 범위 설정 모달
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeModalContent, setRangeModalContent] = useState<RangeModalContent | null>(null);

  // 슬롯 변경 시 탭 리셋
  useEffect(() => {
    if (selectedSlot) {
      setActiveTab("detail");
      setSearchQuery("");
      setHasLoadedRecommendations(false);
      setRecommendedContents([]);
      masterSearch.reset();
    }
  }, [selectedSlot?.slot_index]);

  // 교과 선택 시 과목 로드
  useEffect(() => {
    if (!selectedSlot?.subject_category) {
      setSubjects([]);
      return;
    }

    const loadSubjects = async () => {
      setIsLoadingSubjects(true);
      try {
        const result = await getSubjectsByGroupNameAction(selectedSlot.subject_category!);
        setSubjects(result.map(s => ({ id: s.id, name: s.name })));
      } catch (error) {
        console.error("[SlotEditorPanel] 과목 로드 실패:", error);
        setSubjects([]);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    loadSubjects();
  }, [selectedSlot?.subject_category]);

  // 슬롯 업데이트 핸들러
  const handleSlotUpdate = useCallback(
    (updates: Partial<ContentSlot>) => {
      if (slotIndex === null || !selectedSlot) return;
      onSlotUpdate(slotIndex, { ...selectedSlot, ...updates });
    },
    [slotIndex, selectedSlot, onSlotUpdate]
  );

  // 슬롯 타입 변경
  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleSlotUpdate({ slot_type: (e.target.value as SlotType) || null });
    },
    [handleSlotUpdate]
  );

  // 교과 변경
  const handleSubjectCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleSlotUpdate({
        subject_category: e.target.value,
        subject_id: null,
      });
    },
    [handleSlotUpdate]
  );

  // 과목 변경
  const handleSubjectIdChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleSlotUpdate({ subject_id: e.target.value || null });
    },
    [handleSlotUpdate]
  );

  // 배정 방식 변경
  const handleSubjectTypeChange = useCallback(
    (subjectType: "strategy" | "weakness") => {
      handleSlotUpdate({
        subject_type: subjectType,
        weekly_days: subjectType === "weakness" ? null : (selectedSlot?.weekly_days ?? 3),
      });
    },
    [handleSlotUpdate, selectedSlot?.weekly_days]
  );

  // 주당 일수 변경
  const handleWeeklyDaysChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const days = parseInt(e.target.value, 10);
      handleSlotUpdate({ weekly_days: isNaN(days) ? null : days });
    },
    [handleSlotUpdate]
  );

  // 콘텐츠 필터링
  const filteredContents = useMemo(() => {
    if (!selectedSlot) return [];

    let contents: ContentItem[] = [];
    if (selectedSlot.slot_type === "book") {
      contents = availableContents.books;
    } else if (selectedSlot.slot_type === "lecture") {
      contents = availableContents.lectures;
    } else if (selectedSlot.slot_type === "custom") {
      contents = availableContents.custom;
    } else {
      return [];
    }

    if (selectedSlot.subject_category) {
      contents = contents.filter(
        (c) => c.subject_category === selectedSlot.subject_category || !c.subject_category
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      contents = contents.filter(
        (c) => c.title.toLowerCase().includes(query) || c.subtitle?.toLowerCase().includes(query)
      );
    }

    return contents;
  }, [selectedSlot, availableContents, searchQuery]);

  // 추천 콘텐츠 로드
  const loadRecommendations = useCallback(async () => {
    if (!studentId || !selectedSlot?.subject_category) return;
    if (hasLoadedRecommendations) return;

    setIsLoadingRecommendations(true);
    try {
      const subjects = [selectedSlot.subject_category];
      const counts = { [selectedSlot.subject_category]: 5 };
      const result = await getRecommendedMasterContentsAction(studentId, subjects, counts);

      if (result.success && result.data?.recommendations) {
        const contentTypeFilter = selectedSlot.slot_type === "book" ? "book" : "lecture";
        const transformed: RecommendedContentItem[] = result.data.recommendations
          .filter((rec) => rec.contentType === contentTypeFilter)
          .map((rec) => ({
            id: rec.id,
            title: rec.title,
            content_type: rec.contentType as "book" | "lecture",
            subject: rec.subject,
            subject_category: rec.subject_category,
            recommendationReason: rec.reason,
          }));
        setRecommendedContents(transformed);
      }
    } catch (error) {
      console.error("[SlotEditorPanel] 추천 로드 실패:", error);
    } finally {
      setIsLoadingRecommendations(false);
      setHasLoadedRecommendations(true);
    }
  }, [studentId, selectedSlot?.subject_category, selectedSlot?.slot_type, hasLoadedRecommendations]);

  // 추천 탭으로 전환 시 로드
  useEffect(() => {
    if (sourceTab === "recommended" && !hasLoadedRecommendations && studentId) {
      loadRecommendations();
    }
  }, [sourceTab, hasLoadedRecommendations, studentId, loadRecommendations]);

  // 콘텐츠 선택 핸들러
  const handleSelectContent = useCallback(
    (content: ContentItem) => {
      if (slotIndex === null) return;

      if (content.content_type === "custom") {
        onLinkContent(slotIndex, content, { start: 1, end: 1 });
        return;
      }

      setRangeModalContent({
        id: content.id,
        type: content.content_type as "book" | "lecture",
        title: content.title,
        content,
        isMasterContent: false,
      });
      setRangeModalOpen(true);
    },
    [slotIndex, onLinkContent]
  );

  // 추천/마스터 콘텐츠 선택
  const handleSelectRecommendedOrMaster = useCallback(
    (content: RecommendedContentItem | MasterContentResult) => {
      if (slotIndex === null) return;

      setRangeModalContent({
        id: content.id,
        type: content.content_type as "book" | "lecture",
        title: content.title,
        masterContentId: content.id,
        content,
        isMasterContent: true,
      });
      setRangeModalOpen(true);
    },
    [slotIndex]
  );

  // 범위 저장
  const handleRangeSave = useCallback(
    (range: ContentRange) => {
      if (slotIndex === null || !rangeModalContent) return;

      const startNum = Number(range.start.replace(/[^\d]/g, ""));
      const endNum = Number(range.end.replace(/[^\d]/g, ""));

      const contentItem: ContentItem = {
        id: rangeModalContent.id,
        title: rangeModalContent.title,
        content_type: rangeModalContent.type,
        master_content_id: rangeModalContent.masterContentId,
      };

      onLinkContent(slotIndex, contentItem, { start: startNum, end: endNum }, rangeModalContent.masterContentId);
      setRangeModalOpen(false);
      setRangeModalContent(null);
    },
    [slotIndex, rangeModalContent, onLinkContent]
  );

  // 마스터 검색
  const handleMasterSearch = useCallback(() => {
    if (!selectedSlot?.slot_type) return;
    const contentType = selectedSlot.slot_type === "book" ? "book" : "lecture";
    masterSearch.search(contentType);
  }, [selectedSlot?.slot_type, masterSearch]);

  // 콘텐츠 연결 해제
  const handleUnlinkContent = useCallback(() => {
    if (slotIndex === null) return;
    onUnlinkContent(slotIndex);
  }, [slotIndex, onUnlinkContent]);

  // ============================================================================
  // 슬롯 미선택 상태
  // ============================================================================
  if (!selectedSlot || slotIndex === null) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8">
          <div className="mb-4 text-gray-400">
            <ChevronRight className="h-12 w-12" />
          </div>
          <div className="mb-6 text-center text-sm text-gray-500">
            왼쪽에서 슬롯을 선택하거나
            <br />
            새 슬롯을 추가하세요
          </div>

          {/* 슬롯 추가 버튼 */}
          {editable && (
            <button
              type="button"
              onClick={onAddSlot}
              disabled={!canAddSlot}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 border-dashed px-6 py-3 text-sm font-medium transition-colors",
                canAddSlot
                  ? "border-primary-300 bg-primary-50 text-primary-600 hover:border-primary-400 hover:bg-primary-100"
                  : "cursor-not-allowed border-gray-200 text-gray-400"
              )}
            >
              <Plus className="h-5 w-5" />
              슬롯 추가 ({currentSlotCount}/{maxSlots})
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // 탭 정의
  // ============================================================================
  const tabs = [
    { id: "detail" as const, label: "슬롯 상세", icon: Settings },
    { id: "content" as const, label: "콘텐츠 연결", icon: Link2 },
    { id: "range" as const, label: "목차(범위)", icon: FileText },
  ];

  // 자습/테스트 슬롯인 경우 콘텐츠/범위 탭 비활성화
  const isNoContentSlot = selectedSlot.slot_type === "self_study" || selectedSlot.slot_type === "test";
  const typeConfig = selectedSlot.slot_type ? SLOT_TYPE_CONFIG[selectedSlot.slot_type] : null;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* 슬롯 헤더 */}
      <div className="mb-4 flex-shrink-0 rounded-lg bg-gray-100 p-3">
        <div className="flex items-center gap-2">
          {typeConfig && <typeConfig.icon className="h-4 w-4 text-gray-600" />}
          <span className="font-medium text-gray-700">슬롯 {slotIndex + 1}</span>
          {selectedSlot.subject_category && (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
              {selectedSlot.subject_category}
            </span>
          )}
          {selectedSlot.content_id && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" />
              연결됨
            </span>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDisabled = isNoContentSlot && (tab.id === "content" || tab.id === "range");
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-white text-gray-900 shadow-sm"
                    : isDisabled
                      ? "cursor-not-allowed text-gray-300"
                      : "text-gray-600 hover:text-gray-900"
                )}
              >
                <TabIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 슬롯 상세 탭 */}
        {activeTab === "detail" && (
          <SlotDetailTab
            slot={selectedSlot}
            subjects={subjects}
            isLoadingSubjects={isLoadingSubjects}
            subjectCategories={subjectCategories}
            editable={editable}
            onTypeChange={handleTypeChange}
            onSubjectCategoryChange={handleSubjectCategoryChange}
            onSubjectIdChange={handleSubjectIdChange}
            onSubjectTypeChange={handleSubjectTypeChange}
            onWeeklyDaysChange={handleWeeklyDaysChange}
          />
        )}

        {/* 콘텐츠 연결 탭 */}
        {activeTab === "content" && !isNoContentSlot && (
          <ContentLinkingTab
            slot={selectedSlot}
            filteredContents={filteredContents}
            sourceTab={sourceTab}
            searchQuery={searchQuery}
            recommendedContents={recommendedContents}
            isLoadingRecommendations={isLoadingRecommendations}
            masterSearch={masterSearch}
            editable={editable}
            studentId={studentId}
            onSourceTabChange={setSourceTab}
            onSearchQueryChange={setSearchQuery}
            onSelectContent={handleSelectContent}
            onSelectRecommendedOrMaster={handleSelectRecommendedOrMaster}
            onMasterSearch={handleMasterSearch}
            onUnlinkContent={handleUnlinkContent}
          />
        )}

        {/* 범위 탭 */}
        {activeTab === "range" && !isNoContentSlot && (
          <RangeTab
            slot={selectedSlot}
            editable={editable}
            studentId={studentId}
            onOpenRangeModal={() => {
              if (selectedSlot.content_id && selectedSlot.title) {
                setRangeModalContent({
                  id: selectedSlot.content_id,
                  type: (selectedSlot.slot_type as "book" | "lecture") || "book",
                  title: selectedSlot.title,
                  masterContentId: selectedSlot.master_content_id ?? undefined,
                  content: {
                    id: selectedSlot.content_id,
                    title: selectedSlot.title,
                    content_type: (selectedSlot.slot_type as "book" | "lecture" | "custom") || "book",
                  },
                  isMasterContent: !!selectedSlot.master_content_id,
                });
                setRangeModalOpen(true);
              }
            }}
          />
        )}
      </div>

      {/* 범위 설정 모달 */}
      {rangeModalContent && (
        <RangeSettingModal
          open={rangeModalOpen}
          onClose={() => {
            setRangeModalOpen(false);
            setRangeModalContent(null);
          }}
          content={{
            id: rangeModalContent.id,
            type: rangeModalContent.type,
            title: rangeModalContent.title,
          }}
          isRecommendedContent={rangeModalContent.isMasterContent}
          onSave={handleRangeSave}
          studentId={studentId}
        />
      )}
    </div>
  );
}

export const SlotEditorPanel = memo(SlotEditorPanelComponent);
