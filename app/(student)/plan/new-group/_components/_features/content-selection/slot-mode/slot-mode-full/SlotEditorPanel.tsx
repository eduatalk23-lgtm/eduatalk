"use client";

import React, { memo, useCallback, useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/cn";
import { ContentSlot, SlotType, ContentRange } from "@/lib/types/content-selection";
import {
  Plus,
  Settings,
  Link2,
  FileText,
  BookOpen,
  Video,
  Clock,
  ClipboardList,
  ChevronDown,
  Search,
  Loader2,
  Check,
  User,
  Sparkles,
  Package,
  ChevronRight,
} from "lucide-react";
import { RangeSettingModal } from "../../components/RangeSettingModal";
import { getSubjectsByGroupNameAction } from "@/lib/domains/subject";
import { getRecommendedMasterContentsAction } from "@/lib/domains/content";
import { useMasterContentSearch, type MasterContentResult } from "@/lib/hooks/useMasterContentSearch";

// ============================================================================
// 타입 정의
// ============================================================================

type EditorTab = "detail" | "content" | "range";

type SubjectInfo = {
  id: string;
  name: string;
};

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

type SourceTab = "student" | "recommended" | "master";

type RecommendedContentItem = {
  id: string;
  title: string;
  content_type: "book" | "lecture";
  subject?: string | null;
  subject_category?: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
  recommendationReason?: string | null;
};

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
// 상수
// ============================================================================

const SLOT_TYPE_CONFIG: Record<
  SlotType,
  { icon: typeof BookOpen; label: string; color: string }
> = {
  book: { icon: BookOpen, label: "교재", color: "blue" },
  lecture: { icon: Video, label: "강의", color: "green" },
  custom: { icon: FileText, label: "커스텀", color: "purple" },
  self_study: { icon: Clock, label: "자습", color: "orange" },
  test: { icon: ClipboardList, label: "테스트", color: "red" },
};

// DB subject_groups 테이블의 실제 name 값과 일치해야 함
const DEFAULT_SUBJECT_CATEGORIES = [
  "국어", "수학", "영어", "과학", "사회(역사/도덕 포함)", "한국사",
];

const SOURCE_TAB_CONFIG: Record<SourceTab, { label: string; icon: typeof User }> = {
  student: { label: "내 콘텐츠", icon: User },
  recommended: { label: "추천", icon: Sparkles },
  master: { label: "마스터 검색", icon: Package },
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
  const [rangeModalContent, setRangeModalContent] = useState<{
    id: string;
    type: "book" | "lecture";
    title: string;
    masterContentId?: string;
    content: ContentItem | MasterContentResult | RecommendedContentItem;
    isMasterContent: boolean;
  } | null>(null);

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

// ============================================================================
// 슬롯 상세 탭
// ============================================================================

type SlotDetailTabProps = {
  slot: ContentSlot;
  subjects: SubjectInfo[];
  isLoadingSubjects: boolean;
  subjectCategories: string[];
  editable: boolean;
  onTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectCategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectIdChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectTypeChange: (type: "strategy" | "weakness") => void;
  onWeeklyDaysChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

function SlotDetailTab({
  slot,
  subjects,
  isLoadingSubjects,
  subjectCategories,
  editable,
  onTypeChange,
  onSubjectCategoryChange,
  onSubjectIdChange,
  onSubjectTypeChange,
  onWeeklyDaysChange,
}: SlotDetailTabProps) {
  const isLocked = slot.is_locked;

  return (
    <div className="space-y-4">
      {/* 슬롯 타입 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">슬롯 타입</label>
        <div className="relative">
          <select
            value={slot.slot_type || ""}
            onChange={onTypeChange}
            disabled={!editable || isLocked}
            className={cn(
              "w-full appearance-none rounded-lg border bg-white px-3 py-3 pr-10 text-base",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">타입 선택</option>
            {Object.entries(SLOT_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* 교과 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">교과</label>
        <div className="relative">
          <select
            value={slot.subject_category || ""}
            onChange={onSubjectCategoryChange}
            disabled={!editable || isLocked}
            className={cn(
              "w-full appearance-none rounded-lg border bg-white px-3 py-3 pr-10 text-base",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">교과 선택</option>
            {subjectCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* 과목 */}
      {slot.subject_category && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">과목 (선택사항)</label>
          {isLoadingSubjects ? (
            <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              과목 불러오는 중...
            </div>
          ) : subjects.length > 0 ? (
            <div className="relative">
              <select
                value={slot.subject_id || ""}
                onChange={onSubjectIdChange}
                disabled={!editable || isLocked}
                className={cn(
                  "w-full appearance-none rounded-lg border bg-white px-3 py-3 pr-10 text-base",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                  (!editable || isLocked) && "cursor-not-allowed opacity-60"
                )}
              >
                <option value="">과목 선택</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>
          ) : (
            <div className="rounded-lg border bg-gray-50 px-3 py-3 text-sm text-gray-400">
              등록된 과목이 없습니다
            </div>
          )}
        </div>
      )}

      {/* 배정 방식 */}
      {slot.subject_category && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">배정 방식</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSubjectTypeChange("weakness")}
              disabled={!editable || isLocked}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-all",
                slot.subject_type !== "strategy"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              취약과목
              <span className="text-xs text-gray-400">(매일)</span>
            </button>
            <button
              type="button"
              onClick={() => onSubjectTypeChange("strategy")}
              disabled={!editable || isLocked}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-all",
                slot.subject_type === "strategy"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              전략과목
            </button>
          </div>

          {/* 주당 배정 일수 */}
          {slot.subject_type === "strategy" && (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs text-gray-500">주당 배정 일수</label>
              <div className="relative">
                <select
                  value={slot.weekly_days ?? 3}
                  onChange={onWeeklyDaysChange}
                  disabled={!editable || isLocked}
                  className={cn(
                    "w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-10 text-sm",
                    "focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500",
                    (!editable || isLocked) && "cursor-not-allowed opacity-60"
                  )}
                >
                  <option value={2}>주 2일</option>
                  <option value={3}>주 3일 (기본)</option>
                  <option value={4}>주 4일</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 콘텐츠 연결 탭
// ============================================================================

type ContentLinkingTabProps = {
  slot: ContentSlot;
  filteredContents: ContentItem[];
  sourceTab: SourceTab;
  searchQuery: string;
  recommendedContents: RecommendedContentItem[];
  isLoadingRecommendations: boolean;
  masterSearch: ReturnType<typeof useMasterContentSearch>;
  editable: boolean;
  studentId?: string;
  onSourceTabChange: (tab: SourceTab) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectContent: (content: ContentItem) => void;
  onSelectRecommendedOrMaster: (content: RecommendedContentItem | MasterContentResult) => void;
  onMasterSearch: () => void;
  onUnlinkContent: () => void;
};

function ContentLinkingTab({
  slot,
  filteredContents,
  sourceTab,
  searchQuery,
  recommendedContents,
  isLoadingRecommendations,
  masterSearch,
  editable,
  studentId,
  onSourceTabChange,
  onSearchQueryChange,
  onSelectContent,
  onSelectRecommendedOrMaster,
  onMasterSearch,
  onUnlinkContent,
}: ContentLinkingTabProps) {
  // 슬롯 타입 미선택
  if (!slot.slot_type) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Settings className="mb-3 h-8 w-8 text-gray-300" />
        <div className="text-sm text-gray-500">
          먼저 &quot;슬롯 상세&quot; 탭에서
          <br />
          슬롯 타입을 선택해주세요
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 현재 연결된 콘텐츠 */}
      {slot.content_id && (
        <div className="mb-4 flex-shrink-0 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {slot.title}
              </span>
            </div>
            {editable && (
              <button
                type="button"
                onClick={onUnlinkContent}
                className="rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-600"
              >
                연결 해제
              </button>
            )}
          </div>
          {slot.start_range !== undefined && (
            <div className="mt-1.5 text-xs text-green-600">
              범위: {slot.start_range} - {slot.end_range}
            </div>
          )}
        </div>
      )}

      {/* 소스 탭 */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(Object.keys(SOURCE_TAB_CONFIG) as SourceTab[]).map((tab) => {
            const config = SOURCE_TAB_CONFIG[tab];
            const isActive = sourceTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSourceTabChange(tab)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? tab === "recommended"
                      ? "bg-amber-500 text-white"
                      : tab === "master"
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <config.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 검색 */}
      {(sourceTab === "student" || sourceTab === "master") && (
        <div className="mb-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={sourceTab === "master" ? masterSearch.searchQuery : searchQuery}
              onChange={(e) => {
                if (sourceTab === "master") {
                  masterSearch.setSearchQuery(e.target.value);
                } else {
                  onSearchQueryChange(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sourceTab === "master") {
                  onMasterSearch();
                }
              }}
              placeholder={sourceTab === "master" ? "마스터 콘텐츠 검색..." : "콘텐츠 검색..."}
              className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
          {sourceTab === "master" && (
            <button
              type="button"
              onClick={onMasterSearch}
              disabled={!masterSearch.searchQuery.trim() || masterSearch.isSearching}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
                masterSearch.searchQuery.trim() && !masterSearch.isSearching
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {masterSearch.isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  검색
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* 콘텐츠 리스트 */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {sourceTab === "student" && (
          filteredContents.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {searchQuery ? "검색 결과가 없습니다" : "사용 가능한 콘텐츠가 없습니다"}
            </div>
          ) : (
            filteredContents.map((content) => (
              <ContentListItem
                key={content.id}
                content={content}
                isLinked={slot.content_id === content.id}
                onSelect={() => onSelectContent(content)}
                disabled={!editable}
              />
            ))
          )
        )}

        {sourceTab === "recommended" && (
          isLoadingRecommendations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <span className="ml-2 text-sm text-gray-500">추천 콘텐츠 로드 중...</span>
            </div>
          ) : recommendedContents.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {!studentId ? "학생 정보가 필요합니다" : !slot.subject_category ? "교과를 먼저 선택해주세요" : "추천 콘텐츠가 없습니다"}
            </div>
          ) : (
            recommendedContents.map((content) => (
              <RecommendedContentListItem
                key={content.id}
                content={content}
                onSelect={() => onSelectRecommendedOrMaster(content)}
                disabled={!editable}
              />
            ))
          )
        )}

        {sourceTab === "master" && (
          masterSearch.isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-gray-500">검색 중...</span>
            </div>
          ) : !masterSearch.hasSearched ? (
            <div className="py-8 text-center text-sm text-gray-400">
              검색어를 입력하고 검색 버튼을 클릭하세요
            </div>
          ) : masterSearch.results.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              검색 결과가 없습니다
            </div>
          ) : (
            masterSearch.results.map((content) => (
              <MasterContentListItem
                key={content.id}
                content={content}
                onSelect={() => onSelectRecommendedOrMaster(content)}
                disabled={!editable}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 범위 탭
// ============================================================================

type RangeTabProps = {
  slot: ContentSlot;
  editable: boolean;
  studentId?: string;
  onOpenRangeModal: () => void;
};

function RangeTab({ slot, editable, onOpenRangeModal }: RangeTabProps) {
  if (!slot.content_id) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Link2 className="mb-3 h-8 w-8 text-gray-300" />
        <div className="text-sm text-gray-500">
          먼저 &quot;콘텐츠 연결&quot; 탭에서
          <br />
          콘텐츠를 연결해주세요
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 연결된 콘텐츠 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-1 text-xs font-medium text-gray-500">연결된 콘텐츠</div>
        <div className="text-sm font-medium text-gray-800">{slot.title}</div>
      </div>

      {/* 현재 범위 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-medium text-gray-700">학습 범위</div>

        {slot.start_range !== undefined && slot.end_range !== undefined ? (
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-xs text-blue-600">시작</div>
                <div className="text-lg font-semibold text-blue-800">
                  {slot.start_range}
                  {slot.slot_type === "book" ? "p" : "회차"}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
              <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-xs text-blue-600">끝</div>
                <div className="text-lg font-semibold text-blue-800">
                  {slot.end_range}
                  {slot.slot_type === "book" ? "p" : "회차"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border-2 border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
            범위가 설정되지 않았습니다
          </div>
        )}

        {editable && (
          <button
            type="button"
            onClick={onOpenRangeModal}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            범위 {slot.start_range !== undefined ? "수정" : "설정"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 콘텐츠 리스트 아이템
// ============================================================================

type ContentListItemProps = {
  content: ContentItem;
  isLinked: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

function ContentListItem({ content, isLinked, onSelect, disabled }: ContentListItemProps) {
  const TypeIcon = content.content_type === "book" ? BookOpen : content.content_type === "lecture" ? Video : FileText;

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
      <div className="flex items-center gap-2">
        <TypeIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
        <div className="flex-1 truncate text-sm font-medium text-gray-800">{content.title}</div>
        {isLinked && <Check className="h-4 w-4 text-green-600" />}
      </div>
      {content.subtitle && (
        <div className="mt-1 truncate pl-6 text-xs text-gray-500">{content.subtitle}</div>
      )}
    </button>
  );
}

type RecommendedContentListItemProps = {
  content: RecommendedContentItem;
  onSelect: () => void;
  disabled?: boolean;
};

function RecommendedContentListItem({ content, onSelect, disabled }: RecommendedContentListItemProps) {
  const TypeIcon = content.content_type === "book" ? BookOpen : Video;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-left transition-all hover:border-amber-400 hover:bg-amber-100",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <TypeIcon className="h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="flex-1 truncate text-sm font-medium text-gray-800">{content.title}</div>
      </div>
      {content.recommendationReason && (
        <div className="mt-1 flex items-center gap-1 pl-6 text-xs text-amber-600">
          <Sparkles className="h-3 w-3" />
          <span>{content.recommendationReason}</span>
        </div>
      )}
    </button>
  );
}

type MasterContentListItemProps = {
  content: MasterContentResult;
  onSelect: () => void;
  disabled?: boolean;
};

function MasterContentListItem({ content, onSelect, disabled }: MasterContentListItemProps) {
  const TypeIcon = content.content_type === "book" ? BookOpen : Video;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-left transition-all hover:border-indigo-400 hover:bg-indigo-100",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <TypeIcon className="h-4 w-4 flex-shrink-0 text-indigo-600" />
        <div className="flex-1 truncate text-sm font-medium text-gray-800">{content.title}</div>
        <Package className="h-4 w-4 flex-shrink-0 text-indigo-400" />
      </div>
      <div className="mt-1 flex items-center gap-1.5 pl-6 text-xs text-gray-500">
        {content.subject && <span>{content.subject}</span>}
        {content.publisher_or_academy && (
          <>
            <span>·</span>
            <span>{content.publisher_or_academy}</span>
          </>
        )}
      </div>
    </button>
  );
}

export const SlotEditorPanel = memo(SlotEditorPanelComponent);
