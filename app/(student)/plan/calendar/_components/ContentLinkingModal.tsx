"use client";

import { useState, useCallback, useEffect, useMemo, useTransition } from "react";
import {
  X,
  Search,
  BookOpen,
  Video,
  FileText,
  Check,
  Loader2,
  AlertCircle,
  Package,
  User,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  linkContentToVirtualPlan,
  getAvailableContentsForSlot,
  type ContentLinkInfo,
} from "@/lib/domains/plan/actions/linkContent";
import { getRecommendedMasterContentsAction } from "@/lib/domains/content";
import { useMasterContentSearch, type MasterContentResult } from "@/lib/hooks/useMasterContentSearch";
import { RangeSettingModal } from "@/app/(student)/plan/new-group/_components/_features/content-selection/components/RangeSettingModal";
import type { ContentRange } from "@/lib/types/content-selection";
import {
  bgSurface,
  borderDefault,
  textPrimary,
  textSecondary,
  textMuted,
} from "@/lib/utils/darkMode";
import { ContentCard } from "./ContentCard";

type VirtualPlanInfo = {
  planId: string;
  slotIndex: number;
  subjectCategory?: string | null;
  description?: string | null;
  slotType?: "book" | "lecture" | "custom" | null;
};

type ContentLinkingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  virtualPlan: VirtualPlanInfo | null;
  studentId: string;
  onSuccess?: () => void;
};

type ContentTab = "book" | "lecture" | "custom";
type SourceTab = "student" | "recommended" | "master";

// MasterContent 타입은 useMasterContentSearch에서 MasterContentResult로 제공

type RecommendedContentItem = {
  id: string;
  title: string;
  contentType: "book" | "lecture";
  subject?: string | null;
  subject_category?: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
  recommendationReason?: string | null;
};

const TAB_CONFIG: Record<ContentTab, { label: string; icon: typeof BookOpen }> = {
  book: { label: "교재", icon: BookOpen },
  lecture: { label: "강의", icon: Video },
  custom: { label: "커스텀", icon: FileText },
};

const SOURCE_TAB_CONFIG: Record<SourceTab, { label: string; icon: typeof User }> = {
  student: { label: "내 콘텐츠", icon: User },
  recommended: { label: "추천", icon: Sparkles },
  master: { label: "마스터 검색", icon: Package },
};

export function ContentLinkingModal({
  isOpen,
  onClose,
  virtualPlan,
  studentId,
  onSuccess,
}: ContentLinkingModalProps) {
  const [isPending, startTransition] = useTransition();

  // 소스 탭: 내 콘텐츠 vs 마스터 콘텐츠
  const [sourceTab, setSourceTab] = useState<SourceTab>("student");
  // 콘텐츠 타입 탭
  const [activeTab, setActiveTab] = useState<ContentTab>("book");
  const [searchQuery, setSearchQuery] = useState("");

  // 범위 설정 상태
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(10);
  const [startDetailId, setStartDetailId] = useState<string | null>(null);
  const [endDetailId, setEndDetailId] = useState<string | null>(null);

  // 선택된 콘텐츠
  const [selectedContent, setSelectedContent] = useState<ContentLinkInfo | null>(null);

  // 학생 콘텐츠 상태
  const [studentContents, setStudentContents] = useState<{
    books: ContentLinkInfo[];
    lectures: ContentLinkInfo[];
    custom: ContentLinkInfo[];
  }>({ books: [], lectures: [], custom: [] });

  // 마스터 콘텐츠 검색 훅
  const masterSearch = useMasterContentSearch({ limit: 20 });

  // 추천 콘텐츠 상태
  const [recommendedContents, setRecommendedContents] = useState<RecommendedContentItem[]>([]);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [hasLoadedRecommendations, setHasLoadedRecommendations] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RangeSettingModal 상태
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeModalContent, setRangeModalContent] = useState<{
    id: string;
    type: "book" | "lecture";
    title: string;
    isMaster: boolean;
  } | null>(null);

  // 모달 열릴 때 학생 콘텐츠 로드
  useEffect(() => {
    if (isOpen && virtualPlan && studentId) {
      setIsLoading(true);
      setError(null);
      setSelectedContent(null);
      setSearchQuery("");
      masterSearch.reset();
      setStartDetailId(null);
      setEndDetailId(null);
      setRecommendedContents([]);
      setHasLoadedRecommendations(false);

      // 슬롯 타입에 따라 기본 탭 설정
      if (virtualPlan.slotType) {
        setActiveTab(virtualPlan.slotType);
      }

      getAvailableContentsForSlot(
        studentId,
        virtualPlan.subjectCategory,
        virtualPlan.slotType
      )
        .then((data) => {
          setStudentContents(data);
        })
        .catch((err) => {
          console.error("[ContentLinkingModal] 콘텐츠 로드 실패:", err);
          setError("콘텐츠를 불러오는 데 실패했습니다.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, virtualPlan, studentId]);

  // 마스터 콘텐츠 검색
  const handleMasterSearch = useCallback(async () => {
    const contentType = activeTab === "custom" ? "book" : activeTab;
    await masterSearch.search(contentType);
  }, [activeTab, masterSearch]);

  // 추천 콘텐츠 로드
  const loadRecommendations = useCallback(async () => {
    if (hasLoadedRecommendations || !studentId || !virtualPlan) return;

    setIsRecommendationLoading(true);

    try {
      // 슬롯의 과목 카테고리를 기반으로 추천
      const subjects = virtualPlan.subjectCategory
        ? [virtualPlan.subjectCategory]
        : ["국어", "수학", "영어"]; // 기본 과목

      const counts: Record<string, number> = {};
      subjects.forEach((s) => {
        counts[s] = 5; // 과목당 5개 추천
      });

      const result = await getRecommendedMasterContentsAction(
        studentId,
        subjects,
        counts
      );

      if (result.success && result.data?.recommendations) {
        const transformed: RecommendedContentItem[] = result.data.recommendations.map((rec) => ({
          id: rec.id,
          title: rec.title,
          contentType: rec.contentType as "book" | "lecture",
          subject: rec.subject,
          subject_category: rec.subject_category,
          // RecommendedMasterContent doesn't have total_pages/episodes
          total_pages: undefined,
          total_episodes: undefined,
          recommendationReason: rec.reason, // 'reason' field in RecommendedMasterContent
        }));
        setRecommendedContents(transformed);
      }

      setHasLoadedRecommendations(true);
    } catch (err) {
      console.error("[ContentLinkingModal] 추천 콘텐츠 로드 실패:", err);
      setError("추천 콘텐츠를 불러오는 데 실패했습니다.");
    } finally {
      setIsRecommendationLoading(false);
    }
  }, [hasLoadedRecommendations, studentId, virtualPlan]);

  // 학생 콘텐츠 검색 필터링
  const filteredStudentContents = useMemo(() => {
    const getContentsForTab = () => {
      switch (activeTab) {
        case "book":
          return studentContents.books;
        case "lecture":
          return studentContents.lectures;
        case "custom":
          return studentContents.custom;
        default:
          return [];
      }
    };

    const items = getContentsForTab();

    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subjectCategory?.toLowerCase().includes(query) ||
        item.subject?.toLowerCase().includes(query)
    );
  }, [activeTab, studentContents, searchQuery]);

  // 학생 콘텐츠 선택 핸들러
  const handleSelectStudentContent = useCallback((content: ContentLinkInfo) => {
    setSelectedContent(content);
    setStartDetailId(null);
    setEndDetailId(null);

    // 기본 범위 설정
    setRangeStart(1);
    if (content.totalPages) {
      setRangeEnd(Math.min(content.totalPages, 20));
    } else if (content.totalEpisodes) {
      setRangeEnd(Math.min(content.totalEpisodes, 5));
    } else {
      setRangeEnd(10);
    }

    // 교재/강의인 경우 RangeSettingModal 표시
    if (content.contentType === "book" || content.contentType === "lecture") {
      setRangeModalContent({
        id: content.contentId,
        type: content.contentType,
        title: content.title,
        isMaster: false,
      });
      setRangeModalOpen(true);
    }
  }, []);

  // 마스터 콘텐츠 선택 핸들러
  const handleSelectMasterContent = useCallback((master: MasterContentResult) => {
    const content: ContentLinkInfo = {
      contentId: master.id,
      contentType: master.content_type,
      title: master.title,
      subjectCategory: master.subject_category,
      subject: master.subject,
      totalPages: master.total_pages,
      totalEpisodes: master.total_episodes,
      masterContentId: master.id,
    };

    setSelectedContent(content);
    setStartDetailId(null);
    setEndDetailId(null);

    // RangeSettingModal 표시
    setRangeModalContent({
      id: master.id,
      type: master.content_type,
      title: master.title,
      isMaster: true,
    });
    setRangeModalOpen(true);
  }, []);

  // 추천 콘텐츠 선택 핸들러
  const handleSelectRecommendedContent = useCallback((rec: RecommendedContentItem) => {
    const content: ContentLinkInfo = {
      contentId: rec.id,
      contentType: rec.contentType,
      title: rec.title,
      subjectCategory: rec.subject_category,
      subject: rec.subject,
      totalPages: rec.total_pages,
      totalEpisodes: rec.total_episodes,
      masterContentId: rec.id, // 추천 콘텐츠는 마스터 콘텐츠
    };

    setSelectedContent(content);
    setStartDetailId(null);
    setEndDetailId(null);

    // RangeSettingModal 표시
    setRangeModalContent({
      id: rec.id,
      type: rec.contentType,
      title: rec.title,
      isMaster: true,
    });
    setRangeModalOpen(true);
  }, []);

  // 범위 저장 핸들러
  const handleRangeSave = useCallback((range: ContentRange) => {
    if (!selectedContent) return;

    // 범위 문자열에서 숫자 추출
    const startNum = parseInt(range.start.replace(/[^\d]/g, ""), 10);
    const endNum = parseInt(range.end.replace(/[^\d]/g, ""), 10);

    setRangeStart(startNum || 1);
    setRangeEnd(endNum || 10);
    setStartDetailId(range.start_detail_id || null);
    setEndDetailId(range.end_detail_id || null);

    setRangeModalOpen(false);
    setRangeModalContent(null);
  }, [selectedContent]);

  // 연결 확정 핸들러
  const handleConfirmLink = useCallback(() => {
    if (!virtualPlan || !selectedContent) return;

    startTransition(async () => {
      const result = await linkContentToVirtualPlan(virtualPlan.planId, {
        ...selectedContent,
        startRange: rangeStart,
        endRange: rangeEnd,
        startDetailId,
        endDetailId,
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || "콘텐츠 연결에 실패했습니다.");
      }
    });
  }, [virtualPlan, selectedContent, rangeStart, rangeEnd, startDetailId, endDetailId, onSuccess, onClose]);

  // 모달 닫기
  const handleClose = useCallback(() => {
    if (!isPending) {
      onClose();
    }
  }, [isPending, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={handleClose}
      >
        <div
          className={cn(
            "relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 shadow-2xl",
            borderDefault,
            bgSurface
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div>
              <h2 className={cn("text-lg font-bold", textPrimary)}>
                콘텐츠 연결
              </h2>
              {virtualPlan?.subjectCategory && (
                <p className={cn("text-sm", textSecondary)}>
                  {virtualPlan.subjectCategory}
                  {virtualPlan.description && ` - ${virtualPlan.description}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className={cn(
                "rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 소스 탭: 내 콘텐츠 / 추천 / 마스터 검색 */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50 dark:bg-gray-800/50">
            {(Object.entries(SOURCE_TAB_CONFIG) as [SourceTab, typeof SOURCE_TAB_CONFIG.student][]).map(
              ([key, { label, icon: Icon }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSourceTab(key);
                    setSelectedContent(null);
                    setSearchQuery("");
                    // 추천 탭 선택 시 추천 콘텐츠 로드
                    if (key === "recommended") {
                      loadRecommendations();
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    sourceTab === key
                      ? "border-indigo-600 text-indigo-600 bg-white dark:bg-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {key === "recommended" && recommendedContents.length > 0 && (
                    <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs">
                      {recommendedContents.length}
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {/* 콘텐츠 타입 탭 (custom 제외 for master/recommended) */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
            {(Object.entries(TAB_CONFIG) as [ContentTab, typeof TAB_CONFIG.book][])
              .filter(([key]) => sourceTab === "student" || key !== "custom")
              .map(([key, { label, icon: Icon }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveTab(key);
                    setSelectedContent(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    activeTab === key
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {sourceTab === "student" && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        activeTab === key
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {key === "book"
                        ? studentContents.books.length
                        : key === "lecture"
                          ? studentContents.lectures.length
                          : studentContents.custom.length}
                    </span>
                  )}
                </button>
              ))}
          </div>

          {/* 검색 */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
            {sourceTab === "student" ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="내 콘텐츠 검색..."
                  className={cn(
                    "w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                    borderDefault
                  )}
                />
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={masterSearch.searchQuery}
                    onChange={(e) => masterSearch.setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMasterSearch()}
                    placeholder="마스터 콘텐츠 검색..."
                    className={cn(
                      "w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                      borderDefault
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleMasterSearch}
                  disabled={masterSearch.isSearching || !masterSearch.searchQuery.trim()}
                  className={cn(
                    "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700",
                    (masterSearch.isSearching || !masterSearch.searchQuery.trim()) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {masterSearch.isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "검색"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 콘텐츠 목록 */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {sourceTab === "student" ? (
              // 학생 콘텐츠 목록
              isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <p className={cn("mt-2 text-sm", textMuted)}>콘텐츠 로딩 중...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                </div>
              ) : filteredStudentContents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className={cn("text-sm", textMuted)}>
                    {searchQuery ? "검색 결과가 없습니다" : "사용 가능한 콘텐츠가 없습니다"}
                  </p>
                  <p className={cn("mt-2 text-xs", textMuted)}>
                    마스터 콘텐츠 탭에서 콘텐츠를 검색하여 추가할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStudentContents.map((content) => (
                    <ContentCard
                      key={content.contentId}
                      contentId={content.contentId}
                      title={content.title}
                      isSelected={selectedContent?.contentId === content.contentId}
                      icon={TAB_CONFIG[activeTab].icon}
                      colorScheme="indigo"
                      onClick={() => handleSelectStudentContent(content)}
                      subjectCategory={content.subjectCategory}
                      subject={content.subject}
                      totalPages={content.totalPages}
                      totalEpisodes={content.totalEpisodes}
                    />
                  ))}
                </div>
              )
            ) : sourceTab === "recommended" ? (
              // 추천 콘텐츠 목록
              isRecommendationLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  <p className={cn("mt-2 text-sm", textMuted)}>추천 콘텐츠 로딩 중...</p>
                </div>
              ) : recommendedContents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="h-12 w-12 text-gray-300" />
                  <p className={cn("mt-4 text-sm", textMuted)}>
                    {hasLoadedRecommendations
                      ? "추천할 콘텐츠가 없습니다"
                      : "추천 콘텐츠를 불러오는 중..."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendedContents
                    .filter((rec) => activeTab === "book" ? rec.contentType === "book" : rec.contentType === "lecture")
                    .map((rec) => (
                      <ContentCard
                        key={rec.id}
                        contentId={rec.id}
                        title={rec.title}
                        isSelected={selectedContent?.contentId === rec.id}
                        icon={rec.contentType === "book" ? BookOpen : Video}
                        colorScheme="amber"
                        iconOverlay={
                          <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-amber-500" />
                        }
                        badge={
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            추천
                          </span>
                        }
                        onClick={() => handleSelectRecommendedContent(rec)}
                        subjectCategory={rec.subject}
                        description={rec.recommendationReason}
                        totalPages={rec.total_pages}
                        totalEpisodes={rec.total_episodes}
                      />
                    ))}
                </div>
              )
            ) : (
              // 마스터 콘텐츠 목록
              !masterSearch.hasSearched ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-gray-300" />
                  <p className={cn("mt-4 text-sm", textMuted)}>
                    검색어를 입력하여 마스터 콘텐츠를 검색하세요
                  </p>
                </div>
              ) : masterSearch.isSearching ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <p className={cn("mt-2 text-sm", textMuted)}>검색 중...</p>
                </div>
              ) : masterSearch.results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className={cn("text-sm", textMuted)}>검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {masterSearch.results.map((master) => (
                    <ContentCard
                      key={master.id}
                      contentId={master.id}
                      title={master.title}
                      isSelected={selectedContent?.contentId === master.id}
                      icon={master.content_type === "book" ? BookOpen : Video}
                      colorScheme="indigo"
                      badge={
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            master.content_type === "book"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          )}
                        >
                          {master.content_type === "book" ? "교재" : "강의"}
                        </span>
                      }
                      onClick={() => handleSelectMasterContent(master)}
                      publisherOrAcademy={master.publisher_or_academy}
                      subjectCategory={master.subject}
                      totalPages={master.total_pages}
                      totalEpisodes={master.total_episodes}
                    />
                  ))}
                </div>
              )
            )}
          </div>

          {/* 범위 설정 (콘텐츠 선택 시) */}
          {selectedContent && !rangeModalOpen && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={cn("text-sm font-medium", textSecondary)}>
                    선택된 범위:
                  </span>
                  <span className={cn("text-sm font-bold", textPrimary)}>
                    {startDetailId || endDetailId
                      ? `${rangeStart} ~ ${rangeEnd}`
                      : `${rangeStart} ~ ${rangeEnd} ${activeTab === "book" ? "페이지" : "회차"}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedContent.contentType !== "custom") {
                      setRangeModalContent({
                        id: selectedContent.contentId,
                        type: selectedContent.contentType as "book" | "lecture",
                        title: selectedContent.title,
                        isMaster: !!selectedContent.masterContentId,
                      });
                      setRangeModalOpen(true);
                    }
                  }}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  범위 수정
                </button>
              </div>
            </div>
          )}

          {/* 푸터 */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300",
                "hover:bg-gray-100 dark:hover:bg-gray-800",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmLink}
              disabled={isPending || !selectedContent}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
                selectedContent
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gray-400 cursor-not-allowed"
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  연결 중...
                </>
              ) : (
                "콘텐츠 연결"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RangeSettingModal */}
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
          isRecommendedContent={rangeModalContent.isMaster}
          currentRange={
            startDetailId || endDetailId
              ? {
                  start: String(rangeStart),
                  end: String(rangeEnd),
                  start_detail_id: startDetailId,
                  end_detail_id: endDetailId,
                }
              : undefined
          }
          onSave={handleRangeSave}
          studentId={studentId}
        />
      )}
    </>
  );
}
