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
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  linkContentToVirtualPlan,
  getAvailableContentsForSlot,
  type ContentLinkInfo,
} from "@/lib/domains/plan/actions/linkContent";
import {
  bgSurface,
  borderDefault,
  textPrimary,
  textSecondary,
  textMuted,
} from "@/lib/utils/darkMode";

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

const TAB_CONFIG: Record<ContentTab, { label: string; icon: typeof BookOpen }> = {
  book: { label: "교재", icon: BookOpen },
  lecture: { label: "강의", icon: Video },
  custom: { label: "커스텀", icon: FileText },
};

export function ContentLinkingModal({
  isOpen,
  onClose,
  virtualPlan,
  studentId,
  onSuccess,
}: ContentLinkingModalProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<ContentTab>("book");
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(10);
  const [selectedContent, setSelectedContent] = useState<ContentLinkInfo | null>(null);
  const [contents, setContents] = useState<{
    books: ContentLinkInfo[];
    lectures: ContentLinkInfo[];
    custom: ContentLinkInfo[];
  }>({ books: [], lectures: [], custom: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때 콘텐츠 로드
  useEffect(() => {
    if (isOpen && virtualPlan && studentId) {
      setIsLoading(true);
      setError(null);
      setSelectedContent(null);
      setSearchQuery("");

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
          setContents(data);
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

  // 검색 필터링
  const filteredContents = useMemo(() => {
    const getContentsForTab = () => {
      switch (activeTab) {
        case "book":
          return contents.books;
        case "lecture":
          return contents.lectures;
        case "custom":
          return contents.custom;
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
  }, [activeTab, contents, searchQuery]);

  // 콘텐츠 선택 핸들러
  const handleSelectContent = useCallback((content: ContentLinkInfo) => {
    setSelectedContent(content);
    // 기본 범위 설정
    setRangeStart(1);
    if (content.totalPages) {
      setRangeEnd(Math.min(content.totalPages, 20));
    } else if (content.totalEpisodes) {
      setRangeEnd(Math.min(content.totalEpisodes, 5));
    } else {
      setRangeEnd(10);
    }
  }, []);

  // 연결 확정 핸들러
  const handleConfirmLink = useCallback(() => {
    if (!virtualPlan || !selectedContent) return;

    startTransition(async () => {
      const result = await linkContentToVirtualPlan(virtualPlan.planId, {
        ...selectedContent,
        startRange: rangeStart,
        endRange: rangeEnd,
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || "콘텐츠 연결에 실패했습니다.");
      }
    });
  }, [virtualPlan, selectedContent, rangeStart, rangeEnd, onSuccess, onClose]);

  // 모달 닫기
  const handleClose = useCallback(() => {
    if (!isPending) {
      onClose();
    }
  }, [isPending, onClose]);

  if (!isOpen) return null;

  return (
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

        {/* 탭 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {(Object.entries(TAB_CONFIG) as [ContentTab, typeof TAB_CONFIG.book][]).map(
            ([key, { label, icon: Icon }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    activeTab === key
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {key === "book"
                    ? contents.books.length
                    : key === "lecture"
                      ? contents.lectures.length
                      : contents.custom.length}
                </span>
              </button>
            )
          )}
        </div>

        {/* 검색 */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="콘텐츠 검색..."
              className={cn(
                "w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                borderDefault
              )}
            />
          </div>
        </div>

        {/* 콘텐츠 목록 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className={cn("mt-2 text-sm", textMuted)}>콘텐츠 로딩 중...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="mt-2 text-sm text-red-600">{error}</p>
            </div>
          ) : filteredContents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className={cn("text-sm", textMuted)}>
                {searchQuery ? "검색 결과가 없습니다" : "사용 가능한 콘텐츠가 없습니다"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContents.map((content) => {
                const isSelected = selectedContent?.contentId === content.contentId;
                const TypeIcon = TAB_CONFIG[activeTab].icon;

                return (
                  <button
                    key={content.contentId}
                    type="button"
                    onClick={() => handleSelectContent(content)}
                    className={cn(
                      "w-full rounded-lg border-2 p-4 text-left transition-all",
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <TypeIcon
                          className={cn(
                            "mt-0.5 h-5 w-5",
                            isSelected ? "text-indigo-600" : "text-gray-400"
                          )}
                        />
                        <div>
                          <div
                            className={cn(
                              "font-medium",
                              isSelected ? "text-indigo-700" : textPrimary
                            )}
                          >
                            {content.title}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            {content.subjectCategory && (
                              <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                                {content.subjectCategory}
                              </span>
                            )}
                            {content.subject && (
                              <span className={cn("text-xs", textMuted)}>
                                {content.subject}
                              </span>
                            )}
                          </div>
                          <div className={cn("mt-1 text-xs", textMuted)}>
                            {content.totalPages
                              ? `${content.totalPages}페이지`
                              : content.totalEpisodes
                                ? `${content.totalEpisodes}회차`
                                : null}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-indigo-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 범위 설정 (콘텐츠 선택 시) */}
        {selectedContent && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center gap-4">
              <span className={cn("text-sm font-medium", textSecondary)}>
                학습 범위:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Number(e.target.value))}
                  className={cn(
                    "w-20 rounded border px-3 py-1.5 text-sm",
                    borderDefault
                  )}
                />
                <span className="text-gray-400">~</span>
                <input
                  type="number"
                  min={rangeStart}
                  max={selectedContent.totalPages || selectedContent.totalEpisodes || undefined}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(Number(e.target.value))}
                  className={cn(
                    "w-20 rounded border px-3 py-1.5 text-sm",
                    borderDefault
                  )}
                />
                <span className={cn("text-sm", textMuted)}>
                  {activeTab === "book" ? "페이지" : "회차"}
                </span>
              </div>
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
  );
}
