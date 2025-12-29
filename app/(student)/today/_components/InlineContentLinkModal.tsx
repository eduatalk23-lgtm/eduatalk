"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Play, FileText, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import {
  linkContentToVirtualPlan,
  getAvailableContentsForSlot,
  type ContentLinkInfo,
} from "@/lib/domains/plan/actions/linkContent";
import { cn } from "@/lib/cn";
import { bgSurface, borderDefault, textPrimary, textSecondary } from "@/lib/utils/darkMode";

type ContentTab = "book" | "lecture" | "custom";

type InlineContentLinkModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  studentId: string;
  subjectCategory?: string | null;
  slotDescription?: string | null;
  onSuccess?: () => void;
};

/**
 * 인라인 콘텐츠 연결 모달
 *
 * 가상 플랜에 콘텐츠를 연결할 수 있는 모달입니다.
 * 페이지 이동 없이 현재 화면에서 콘텐츠를 검색하고 연결할 수 있습니다.
 *
 * @example
 * <InlineContentLinkModal
 *   open={isModalOpen}
 *   onOpenChange={setIsModalOpen}
 *   planId={plan.id}
 *   studentId={user.userId}
 *   subjectCategory="수학"
 *   onSuccess={() => router.refresh()}
 * />
 */
export function InlineContentLinkModal({
  open,
  onOpenChange,
  planId,
  studentId,
  subjectCategory,
  slotDescription,
  onSuccess,
}: InlineContentLinkModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ContentTab>("book");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContent, setSelectedContent] = useState<ContentLinkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contents, setContents] = useState<{
    books: ContentLinkInfo[];
    lectures: ContentLinkInfo[];
    custom: ContentLinkInfo[];
  }>({
    books: [],
    lectures: [],
    custom: [],
  });

  // 콘텐츠 로드
  useEffect(() => {
    if (!open) return;

    async function loadContents() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getAvailableContentsForSlot(
          studentId,
          subjectCategory
        );
        setContents(result);

        // 자동으로 적절한 탭 선택
        if (result.books.length > 0) {
          setActiveTab("book");
        } else if (result.lectures.length > 0) {
          setActiveTab("lecture");
        } else if (result.custom.length > 0) {
          setActiveTab("custom");
        }
      } catch (e) {
        console.error("[InlineContentLinkModal] 콘텐츠 로드 실패:", e);
        setError("콘텐츠를 불러오는데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadContents();
  }, [open, studentId, subjectCategory]);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedContent(null);
      setError(null);
    }
  }, [open]);

  // 검색 필터링
  const filteredContents = useMemo(() => {
    const currentList = activeTab === "book"
      ? contents.books
      : activeTab === "lecture"
        ? contents.lectures
        : contents.custom;

    if (!searchQuery.trim()) {
      return currentList;
    }

    const query = searchQuery.toLowerCase().trim();
    return currentList.filter(
      (content) =>
        content.title.toLowerCase().includes(query) ||
        content.subject?.toLowerCase().includes(query) ||
        content.subjectCategory?.toLowerCase().includes(query)
    );
  }, [activeTab, contents, searchQuery]);

  // 추천 콘텐츠 (과목 카테고리 일치하는 것들)
  const recommendedContents = useMemo(() => {
    if (!subjectCategory) return [];

    const allContents = [
      ...contents.books,
      ...contents.lectures,
      ...contents.custom,
    ];

    return allContents
      .filter((c) => c.subjectCategory === subjectCategory)
      .slice(0, 3);
  }, [contents, subjectCategory]);

  // 콘텐츠 연결 처리
  const handleLink = useCallback(async () => {
    if (!selectedContent) return;

    setIsLinking(true);
    setError(null);

    try {
      const result = await linkContentToVirtualPlan(planId, selectedContent);

      if (result.success) {
        onOpenChange(false);
        router.refresh();
        onSuccess?.();
      } else {
        setError(result.error ?? "콘텐츠 연결에 실패했습니다.");
      }
    } catch (e) {
      console.error("[InlineContentLinkModal] 연결 실패:", e);
      setError("콘텐츠 연결 중 오류가 발생했습니다.");
    } finally {
      setIsLinking(false);
    }
  }, [planId, selectedContent, onOpenChange, router, onSuccess]);

  const getTabIcon = (tab: ContentTab) => {
    switch (tab) {
      case "book":
        return <BookOpen className="h-4 w-4" />;
      case "lecture":
        return <Play className="h-4 w-4" />;
      case "custom":
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTabLabel = (tab: ContentTab) => {
    switch (tab) {
      case "book":
        return "교재";
      case "lecture":
        return "강의";
      case "custom":
        return "커스텀";
    }
  };

  const getTabCount = (tab: ContentTab) => {
    switch (tab) {
      case "book":
        return contents.books.length;
      case "lecture":
        return contents.lectures.length;
      case "custom":
        return contents.custom.length;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="콘텐츠 연결"
      description={slotDescription ?? subjectCategory ?? "학습할 콘텐츠를 선택해주세요"}
      size="lg"
      showCloseButton
    >
      <DialogContent className="flex flex-col gap-4 max-h-[60vh] overflow-hidden">
        {/* 추천 콘텐츠 */}
        {recommendedContents.length > 0 && !searchQuery && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
              <span>추천 콘텐츠</span>
            </div>
            <div className="grid gap-2">
              {recommendedContents.map((content) => (
                <button
                  key={content.contentId}
                  type="button"
                  onClick={() => setSelectedContent(content)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    borderDefault,
                    bgSurface,
                    selectedContent?.contentId === content.contentId
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <span className="text-xl">
                    {content.contentType === "book" ? "📚" : content.contentType === "lecture" ? "🎧" : "📝"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium truncate", textPrimary)}>{content.title}</p>
                    {content.subject && (
                      <p className={cn("text-xs truncate", textSecondary)}>{content.subject}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="콘텐츠 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm",
              borderDefault,
              bgSurface,
              "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            )}
          />
        </div>

        {/* 탭 */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {(["book", "lecture", "custom"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-white text-indigo-600 shadow dark:bg-gray-700 dark:text-indigo-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              {getTabIcon(tab)}
              <span className="hidden sm:inline">{getTabLabel(tab)}</span>
              <span className="text-xs opacity-60">({getTabCount(tab)})</span>
            </button>
          ))}
        </div>

        {/* 콘텐츠 목록 */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredContents.length === 0 ? (
            <div className={cn("flex flex-col items-center justify-center py-12 text-center", textSecondary)}>
              <p className="text-sm">
                {searchQuery
                  ? "검색 결과가 없습니다"
                  : `등록된 ${getTabLabel(activeTab)}이(가) 없습니다`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredContents.map((content) => (
                <button
                  key={content.contentId}
                  type="button"
                  onClick={() => setSelectedContent(content)}
                  className={cn(
                    "flex w-full items-center gap-3 p-3 text-left transition-all",
                    selectedContent?.contentId === content.contentId
                      ? "bg-indigo-50 dark:bg-indigo-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                      selectedContent?.contentId === content.contentId
                        ? "bg-indigo-100 dark:bg-indigo-800"
                        : "bg-gray-100 dark:bg-gray-700"
                    )}
                  >
                    <span className="text-lg">
                      {content.contentType === "book" ? "📚" : content.contentType === "lecture" ? "🎧" : "📝"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium truncate", textPrimary)}>{content.title}</p>
                    <p className={cn("text-xs truncate", textSecondary)}>
                      {content.subjectCategory && <span>{content.subjectCategory}</span>}
                      {content.subject && <span> · {content.subject}</span>}
                      {content.totalPages && <span> · {content.totalPages}페이지</span>}
                      {content.totalEpisodes && <span> · {content.totalEpisodes}강</span>}
                    </p>
                  </div>
                  {selectedContent?.contentId === content.contentId && (
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isLinking}
        >
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleLink}
          disabled={!selectedContent}
          isLoading={isLinking}
        >
          연결하기
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
