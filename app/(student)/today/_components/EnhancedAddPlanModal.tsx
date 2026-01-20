"use client";

import { useState, useTransition, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Repeat,
  FileText,
  LayoutList,
  Book,
  Video,
  PenTool,
  Search,
  ChevronRight,
} from "lucide-react";
import { createQuickPlan } from "@/lib/domains/plan/actions/contentPlanGroup";
import { listCustomContents } from "@/lib/domains/content/actions/custom";
import type { CustomContent } from "@/lib/domains/content/types";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

type ContainerType = "daily" | "weekly";
type RepeatType = "none" | "daily" | "weekly" | "custom";
type ContentType = "book" | "lecture" | "custom";
type TabType = "quick" | "content";

interface EnhancedAddPlanModalProps {
  studentId: string;
  tenantId: string;
  planGroupId: string; // 캘린더 아키텍처 필수
  defaultDate?: string;
  defaultTab?: TabType;
  preselectedContent?: {
    id: string;
    title: string;
    type: ContentType;
    totalRange?: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function EnhancedAddPlanModal({
  studentId,
  tenantId,
  planGroupId,
  defaultDate,
  defaultTab = "quick",
  preselectedContent,
  onClose,
  onSuccess,
}: EnhancedAddPlanModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // Quick tab state (existing)
  const [title, setTitle] = useState("");
  const [planDate, setPlanDate] = useState(
    defaultDate ?? new Date().toISOString().split("T")[0]
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [containerType, setContainerType] = useState<ContainerType>("daily");

  // Content tab state (new)
  const [contentType, setContentType] = useState<ContentType>(
    preselectedContent?.type ?? "book"
  );
  const [selectedContent, setSelectedContent] = useState<{
    id: string;
    title: string;
    totalRange?: number;
  } | null>(
    preselectedContent
      ? {
          id: preselectedContent.id,
          title: preselectedContent.title,
          totalRange: preselectedContent.totalRange,
        }
      : null
  );
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [customContents, setCustomContents] = useState<CustomContent[]>([]);
  const [isLoadingContents, setIsLoadingContents] = useState(false);

  // Repeat settings (shared)
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [repeatCount, setRepeatCount] = useState("");

  const [validationError, setValidationError] = useState<string | null>(null);

  // Load custom contents when content tab is active
  useEffect(() => {
    if (activeTab === "content" && contentType === "custom") {
      loadCustomContents();
    }
  }, [activeTab, contentType]);

  const loadCustomContents = async () => {
    setIsLoadingContents(true);
    try {
      const result = await listCustomContents();
      if (result.success && result.data) {
        setCustomContents(result.data);
      }
    } catch {
      showToast("커스텀 콘텐츠 로딩 실패", "error");
    } finally {
      setIsLoadingContents(false);
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("제목을 입력하세요");
      return;
    }

    startTransition(async () => {
      // 통합 API 사용 (student_plan 테이블, Planner 연동)
      const result = await createQuickPlan({
        title: title.trim(),
        planDate: planDate,
        description: description.trim() || undefined,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        containerType: containerType,
        planGroupId: planGroupId,
        isFreeLearning: true, // Quick 탭은 자유 학습으로 처리
        // Note: recurrence_rule은 현재 통합 API 미지원
      });

      if (!result.success) {
        showToast("플랜 생성 실패: " + result.error, "error");
        return;
      }

      showToast("플랜이 추가되었습니다.", "success");
      onSuccess();
    });
  };

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedContent) {
      setValidationError("콘텐츠를 선택하세요");
      return;
    }

    if (!rangeStart || !rangeEnd) {
      setValidationError("범위를 설정하세요");
      return;
    }

    const start = Number(rangeStart);
    const end = Number(rangeEnd);

    if (isNaN(start) || isNaN(end) || start > end) {
      setValidationError("올바른 범위를 입력하세요");
      return;
    }

    startTransition(async () => {
      const planTitle = `${selectedContent.title} (${start}-${end})`;

      // 통합 API 사용 (student_plan 테이블, Planner 연동)
      const result = await createQuickPlan({
        title: planTitle,
        planDate: planDate,
        description: description.trim() || undefined,
        estimatedMinutes: estimatedMinutes
          ? Number(estimatedMinutes)
          : Math.ceil((end - start + 1) * 5),
        containerType: containerType,
        planGroupId: planGroupId,
        // 콘텐츠 연결 정보
        contentType: contentType,
        contentId: selectedContent.id,
        contentTitle: selectedContent.title,
        rangeStart: start,
        rangeEnd: end,
        isFreeLearning: false, // 콘텐츠 기반
        // Note: recurrence_rule은 현재 통합 API 미지원
      });

      if (!result.success) {
        showToast("플랜 생성 실패: " + result.error, "error");
        return;
      }

      showToast("콘텐츠 연결 플랜이 추가되었습니다.", "success");
      onSuccess();
    });
  };

  const buildRecurrenceRule = () => {
    if (repeatType === "none") return undefined;

    return {
      type: repeatType === "custom" ? ("weekly" as const) : repeatType,
      weekdays: repeatType === "weekly" ? repeatWeekdays : undefined,
      end_date: repeatEndDate || undefined,
      max_occurrences: repeatCount ? Number(repeatCount) : undefined,
    };
  };

  const toggleWeekday = (day: number) => {
    setRepeatWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleQuickRangeSelect = (
    type: "full" | "first-half" | "second-half" | "third"
  ) => {
    if (!selectedContent?.totalRange) return;
    const total = selectedContent.totalRange;

    switch (type) {
      case "full":
        setRangeStart("1");
        setRangeEnd(String(total));
        break;
      case "first-half":
        setRangeStart("1");
        setRangeEnd(String(Math.ceil(total / 2)));
        break;
      case "second-half":
        setRangeStart(String(Math.ceil(total / 2) + 1));
        setRangeEnd(String(total));
        break;
      case "third":
        setRangeStart("1");
        setRangeEnd(String(Math.ceil(total / 3)));
        break;
    }
  };

  const filteredContents = customContents.filter(
    (c) =>
      !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800",
          isPending && "pointer-events-none opacity-50"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              새 플랜 추가
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              학습할 항목을 추가하세요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "quick"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <FileText className="mr-2 inline h-4 w-4" />
            빠른 추가
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "content"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <Book className="mr-2 inline h-4 w-4" />
            콘텐츠 연결
          </button>
        </div>

        {/* Quick Tab Content */}
        {activeTab === "quick" && (
          <form onSubmit={handleQuickSubmit}>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
              {validationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {validationError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <FileText className="mr-1 inline h-4 w-4" />
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 모의고사 풀이, 오답노트 정리..."
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  required
                />
              </div>

              {/* Date and Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Calendar className="mr-1 inline h-4 w-4" />
                    날짜
                  </label>
                  <input
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Clock className="mr-1 inline h-4 w-4" />
                    예상 시간 (분)
                  </label>
                  <input
                    type="number"
                    placeholder="30"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                    min="1"
                  />
                </div>
              </div>

              {/* Container Type */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <LayoutList className="mr-1 inline h-4 w-4" />
                  배치 위치
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setContainerType("daily")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      containerType === "daily"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    Daily (오늘)
                  </button>
                  <button
                    type="button"
                    onClick={() => setContainerType("weekly")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      containerType === "weekly"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    Weekly (이번 주)
                  </button>
                </div>
              </div>

              {/* Repeat Settings */}
              <RepeatSection
                repeatType={repeatType}
                setRepeatType={setRepeatType}
                repeatWeekdays={repeatWeekdays}
                toggleWeekday={toggleWeekday}
                repeatEndDate={repeatEndDate}
                setRepeatEndDate={setRepeatEndDate}
                repeatCount={repeatCount}
                setRepeatCount={setRepeatCount}
              />

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  메모 (선택)
                </label>
                <textarea
                  placeholder="추가 메모..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  rows={2}
                />
              </div>
            </div>

            <FormFooter isPending={isPending} onClose={onClose} />
          </form>
        )}

        {/* Content Tab Content */}
        {activeTab === "content" && (
          <form onSubmit={handleContentSubmit}>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
              {validationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {validationError}
                </div>
              )}

              {/* Content Type Selection */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  콘텐츠 유형
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContentType("book");
                      setSelectedContent(null);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                      contentType === "book"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    <Book className="h-4 w-4" />
                    교재
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContentType("lecture");
                      setSelectedContent(null);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                      contentType === "lecture"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    <Video className="h-4 w-4" />
                    강의
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContentType("custom");
                      setSelectedContent(null);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                      contentType === "custom"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    <PenTool className="h-4 w-4" />
                    커스텀
                  </button>
                </div>
              </div>

              {/* Content Selection */}
              {contentType === "custom" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Search className="mr-1 inline h-4 w-4" />
                    커스텀 콘텐츠 선택
                  </label>
                  <input
                    type="text"
                    placeholder="콘텐츠 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    {isLoadingContents ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        로딩 중...
                      </div>
                    ) : filteredContents.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        커스텀 콘텐츠가 없습니다
                      </div>
                    ) : (
                      filteredContents.map((content) => (
                        <button
                          key={content.id}
                          type="button"
                          onClick={() =>
                            setSelectedContent({
                              id: content.id,
                              title: content.title,
                              totalRange:
                                content.rangeEnd && content.rangeStart
                                  ? content.rangeEnd - content.rangeStart + 1
                                  : undefined,
                            })
                          }
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700",
                            selectedContent?.id === content.id &&
                              "bg-blue-50 dark:bg-blue-900/20"
                          )}
                        >
                          <span>{content.title}</span>
                          {content.subject && (
                            <span className="text-xs text-gray-400">
                              {content.subject}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Placeholder for book/lecture selection */}
              {(contentType === "book" || contentType === "lecture") && (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-600">
                  <p>
                    {contentType === "book" ? "교재" : "강의"} 선택 기능은
                    추후 지원됩니다.
                  </p>
                  <p className="mt-1 text-xs">
                    현재는 커스텀 콘텐츠를 사용해주세요.
                  </p>
                </div>
              )}

              {/* Selected Content Display */}
              {selectedContent && (
                <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      선택됨: {selectedContent.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedContent(null)}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      변경
                    </button>
                  </div>
                </div>
              )}

              {/* Range Settings */}
              {selectedContent && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    범위 설정 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="시작"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                      min="1"
                    />
                    <input
                      type="number"
                      placeholder="끝"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                      min="1"
                    />
                  </div>

                  {/* Quick Range Selection */}
                  {selectedContent.totalRange && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickRangeSelect("full")}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickRangeSelect("first-half")}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        전반부
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickRangeSelect("second-half")}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        후반부
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickRangeSelect("third")}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        1/3
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Date and Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Calendar className="mr-1 inline h-4 w-4" />
                    날짜
                  </label>
                  <input
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Clock className="mr-1 inline h-4 w-4" />
                    예상 시간 (분)
                  </label>
                  <input
                    type="number"
                    placeholder="자동 계산"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                    min="1"
                  />
                </div>
              </div>

              {/* Container Type */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <LayoutList className="mr-1 inline h-4 w-4" />
                  배치 위치
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setContainerType("daily")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      containerType === "daily"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    Daily (오늘)
                  </button>
                  <button
                    type="button"
                    onClick={() => setContainerType("weekly")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      containerType === "weekly"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    Weekly (이번 주)
                  </button>
                </div>
              </div>

              {/* Repeat Settings */}
              <RepeatSection
                repeatType={repeatType}
                setRepeatType={setRepeatType}
                repeatWeekdays={repeatWeekdays}
                toggleWeekday={toggleWeekday}
                repeatEndDate={repeatEndDate}
                setRepeatEndDate={setRepeatEndDate}
                repeatCount={repeatCount}
                setRepeatCount={setRepeatCount}
              />
            </div>

            <FormFooter
              isPending={isPending}
              onClose={onClose}
              submitLabel="콘텐츠 연결 플랜 추가"
            />
          </form>
        )}
      </div>
    </div>
  );
}

// Repeat Section Component
function RepeatSection({
  repeatType,
  setRepeatType,
  repeatWeekdays,
  toggleWeekday,
  repeatEndDate,
  setRepeatEndDate,
  repeatCount,
  setRepeatCount,
}: {
  repeatType: RepeatType;
  setRepeatType: (v: RepeatType) => void;
  repeatWeekdays: number[];
  toggleWeekday: (day: number) => void;
  repeatEndDate: string;
  setRepeatEndDate: (v: string) => void;
  repeatCount: string;
  setRepeatCount: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        <Repeat className="mr-1 inline h-4 w-4" />
        반복 설정
      </label>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRepeatType("none")}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              repeatType === "none"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            )}
          >
            반복 없음
          </button>
          <button
            type="button"
            onClick={() => setRepeatType("daily")}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              repeatType === "daily"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            )}
          >
            매일
          </button>
          <button
            type="button"
            onClick={() => setRepeatType("weekly")}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              repeatType === "weekly"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            )}
          >
            매주
          </button>
        </div>

        {repeatType === "weekly" && (
          <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              반복할 요일 선택
            </p>
            <div className="flex gap-1">
              {WEEKDAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleWeekday(idx)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-medium transition-colors",
                    repeatWeekdays.includes(idx)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {repeatType !== "none" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                종료일 (선택)
              </label>
              <input
                type="date"
                value={repeatEndDate}
                onChange={(e) => setRepeatEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                반복 횟수 (선택)
              </label>
              <input
                type="number"
                placeholder="무제한"
                value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                min="1"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Form Footer Component
function FormFooter({
  isPending,
  onClose,
  submitLabel = "플랜 추가",
}: {
  isPending: boolean;
  onClose: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
      <button
        type="button"
        onClick={onClose}
        disabled={isPending}
        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isPending ? "추가 중..." : submitLabel}
      </button>
    </div>
  );
}
