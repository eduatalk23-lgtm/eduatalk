"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Plus,
  Clock,
  BookOpen,
  Video,
  FileText,
  Loader2,
  Sparkles,
  RotateCcw,
  PencilLine,
  Play,
  ClipboardList,
  Layers,
  History,
  Wand2,
} from "lucide-react";
import { createQuickPlan } from "@/lib/domains/plan/actions/contentPlanGroup";
import { getRecentFreeLearningItems } from "@/lib/domains/content/actions/freeItems";
import { parseNaturalInput } from "@/lib/domains/content/utils";
import { PlanGroupSelector } from "@/components/plan/PlanGroupSelector";
import {
  FreeLearningItemType,
  FREE_LEARNING_ITEM_LABELS,
  FREE_LEARNING_ITEM_COLORS,
  FREE_LEARNING_ITEM_ICONS,
} from "@/lib/domains/content/types";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

type QuickAddPlanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // YYYY-MM-DD
  studentId: string;
  tenantId: string | null;
  onSuccess?: () => void;
};

// 기존 콘텐츠 유형 (교재/강의/기타)
type LegacyContentType = "book" | "lecture" | "custom";

// 자유 학습 아이템 유형 옵션
const FREE_LEARNING_TYPE_OPTIONS: {
  type: FreeLearningItemType;
  label: string;
  icon: typeof Sparkles;
  color: string;
}[] = [
  { type: "free", label: "자유", icon: Sparkles, color: FREE_LEARNING_ITEM_COLORS.free },
  { type: "review", label: "복습", icon: RotateCcw, color: FREE_LEARNING_ITEM_COLORS.review },
  { type: "practice", label: "연습", icon: PencilLine, color: FREE_LEARNING_ITEM_COLORS.practice },
  { type: "reading", label: "독서", icon: BookOpen, color: FREE_LEARNING_ITEM_COLORS.reading },
  { type: "video", label: "영상", icon: Play, color: FREE_LEARNING_ITEM_COLORS.video },
  { type: "assignment", label: "과제", icon: ClipboardList, color: FREE_LEARNING_ITEM_COLORS.assignment },
];

// 기존 콘텐츠 유형 옵션
const LEGACY_CONTENT_TYPE_OPTIONS: {
  type: LegacyContentType;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { type: "book", label: "교재", icon: BookOpen },
  { type: "lecture", label: "강의", icon: Video },
  { type: "custom", label: "기타", icon: FileText },
];

const ESTIMATED_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120];

type RecentItem = {
  id: string;
  title: string;
  itemType: FreeLearningItemType;
  estimatedMinutes: number | null;
};

/**
 * 빠른 플랜 추가 모달
 *
 * 캘린더에서 날짜를 클릭했을 때 간단하게 플랜을 추가할 수 있습니다.
 * 자유 학습 아이템 유형과 자연어 입력을 지원합니다.
 */
export function QuickAddPlanModal({
  open,
  onOpenChange,
  date,
  studentId,
  tenantId,
  onSuccess,
}: QuickAddPlanModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  // 탭 상태: 'free' (자유 학습) 또는 'legacy' (기존 유형)
  const [activeTab, setActiveTab] = useState<"free" | "legacy">("free");

  // 자유 학습 상태
  const [title, setTitle] = useState("");
  const [freeItemType, setFreeItemType] = useState<FreeLearningItemType>("free");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [description, setDescription] = useState("");

  // 기존 유형 상태
  const [legacyContentType, setLegacyContentType] = useState<LegacyContentType>("book");

  // 최근 항목
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // 자연어 파싱 결과
  const [parsedHint, setParsedHint] = useState<string | null>(null);

  // 캘린더 선택
  const [selectedPlanGroupId, setSelectedPlanGroupId] = useState<string | null>(null);

  // 최근 항목 로드
  useEffect(() => {
    if (open && studentId) {
      getRecentFreeLearningItems(studentId, 5).then((result) => {
        if (result.success && result.data) {
          setRecentItems(
            result.data.map((item) => ({
              id: item.id,
              title: item.title,
              itemType: item.itemType,
              estimatedMinutes: item.estimatedMinutes,
            }))
          );
        }
      });
    }
  }, [open, studentId]);

  // 자연어 파싱
  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);

    // 입력이 충분히 길 때만 파싱
    if (value.length >= 3) {
      const parsed = parseNaturalInput(value);
      const hints: string[] = [];

      if (parsed.estimatedMinutes) {
        hints.push(`${parsed.estimatedMinutes}분`);
      }
      if (parsed.rangeStart && parsed.rangeEnd) {
        hints.push(`${parsed.rangeStart}-${parsed.rangeEnd}쪽`);
      }

      if (hints.length > 0) {
        setParsedHint(`자동 감지: ${hints.join(", ")}`);

        // 자동으로 시간 설정
        if (parsed.estimatedMinutes && parsed.estimatedMinutes !== estimatedMinutes) {
          setEstimatedMinutes(parsed.estimatedMinutes);
        }
      } else {
        setParsedHint(null);
      }
    } else {
      setParsedHint(null);
    }
  }, [estimatedMinutes]);

  const handleClose = () => {
    onOpenChange(false);
    // 폼 초기화
    setTitle("");
    setFreeItemType("free");
    setLegacyContentType("book");
    setEstimatedMinutes(30);
    setDescription("");
    setShowRecent(false);
    setParsedHint(null);
    setSelectedPlanGroupId(null);
  };

  const handleRecentItemClick = (item: RecentItem) => {
    setTitle(item.title);
    setFreeItemType(item.itemType);
    if (item.estimatedMinutes) {
      setEstimatedMinutes(item.estimatedMinutes);
    }
    setShowRecent(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("제목을 입력해주세요.", "error");
      return;
    }

    // tenantId가 없으면 에러 처리 (UUID 빈 문자열 방지)
    if (!tenantId) {
      showToast("테넌트 정보가 없습니다. 페이지를 새로고침해주세요.", "error");
      return;
    }

    // planGroupId가 없으면 에러 처리 (캘린더 아키텍처 필수)
    if (!selectedPlanGroupId) {
      showToast("캘린더를 선택해주세요.", "error");
      return;
    }

    startTransition(async () => {
      try {
        // 자연어 파싱 결과 적용
        const parsed = parseNaturalInput(title);
        const finalMinutes = parsed.estimatedMinutes ?? estimatedMinutes;

        // 통합 API 사용 (student_plan 테이블, Planner 연동)
        const result = await createQuickPlan({
          title: parsed.title ?? title.trim(),
          planDate: date,
          estimatedMinutes: finalMinutes,
          description: description.trim() || undefined,
          containerType: "daily",
          // 자유 학습 여부 및 유형
          isFreeLearning: activeTab === "free",
          freeLearningType: activeTab === "free" ? freeItemType : undefined,
          // 콘텐츠 유형 (기존 콘텐츠 탭 사용 시)
          contentType: activeTab === "free" ? "free" : legacyContentType,
          // 자유 학습 항목의 색상 및 아이콘 자동 설정
          color: activeTab === "free" ? FREE_LEARNING_ITEM_COLORS[freeItemType] : undefined,
          icon: activeTab === "free" ? FREE_LEARNING_ITEM_ICONS[freeItemType] : undefined,
          // 캘린더 연결 (선택된 Plan Group 사용)
          planGroupId: selectedPlanGroupId,
          // studentId 생략 시 현재 로그인한 학생 자동 사용
        });

        if (result.success) {
          showToast("플랜이 추가되었습니다!", "success");
          handleClose();
          router.refresh();
          onSuccess?.();
        } else {
          showToast(result.error || "플랜 추가에 실패했습니다.", "error");
        }
      } catch (error) {
        showToast("플랜 추가 중 오류가 발생했습니다.", "error");
      }
    });
  };

  if (!open) return null;

  // 날짜 포맷팅
  const dateObj = new Date(date + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2
              id="quick-add-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              빠른 플랜 추가
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200 px-6 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("free")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "free"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            <Sparkles className="h-4 w-4" />
            자유 학습
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("legacy")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "legacy"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            )}
          >
            <Layers className="h-4 w-4" />
            교재/강의
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex flex-col gap-4">
            {/* 캘린더 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                연결할 캘린더 <span className="text-gray-400">(선택)</span>
              </label>
              <PlanGroupSelector
                studentId={studentId}
                selectedId={selectedPlanGroupId}
                onSelect={setSelectedPlanGroupId}
                allowNone={true}
              />
            </div>

            {/* 제목 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="plan-title"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  제목 <span className="text-red-500">*</span>
                </label>
                {recentItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRecent(!showRecent)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400"
                  >
                    <History className="h-3 w-3" />
                    최근 항목
                  </button>
                )}
              </div>

              {/* 최근 항목 드롭다운 */}
              {showRecent && recentItems.length > 0 && (
                <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
                  <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                    최근 사용한 항목:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleRecentItemClick(item)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  id="plan-title"
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="예: 수학 50-60쪽 30분"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  required
                  autoFocus
                />
                {/* 자연어 파싱 힌트 */}
                {parsedHint && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                    <Wand2 className="h-3 w-3" />
                    {parsedHint}
                  </div>
                )}
              </div>
            </div>

            {/* 자유 학습 유형 (자유 학습 탭) */}
            {activeTab === "free" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  유형
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FREE_LEARNING_TYPE_OPTIONS.map(({ type, label, icon: Icon, color }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFreeItemType(type)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 py-2.5 text-xs font-medium transition-all",
                        freeItemType === type
                          ? "border-current shadow-sm"
                          : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                      )}
                      style={{
                        color: freeItemType === type ? color : undefined,
                        backgroundColor:
                          freeItemType === type ? `${color}15` : undefined,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 콘텐츠 유형 (기존 탭) */}
            {activeTab === "legacy" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  유형
                </label>
                <div className="flex gap-2">
                  {LEGACY_CONTENT_TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLegacyContentType(type)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                        legacyContentType === type
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 예상 학습 시간 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Clock className="inline h-4 w-4 mr-1" />
                예상 시간
              </label>
              <div className="flex flex-wrap gap-2">
                {ESTIMATED_MINUTES_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setEstimatedMinutes(minutes)}
                    className={cn(
                      "rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors",
                      estimatedMinutes === minutes
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                    )}
                  >
                    {minutes}분
                  </button>
                ))}
              </div>
            </div>

            {/* 설명 (선택) */}
            <div>
              <label
                htmlFor="plan-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                메모 <span className="text-gray-400">(선택)</span>
              </label>
              <textarea
                id="plan-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="추가 메모..."
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 resize-none"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  추가 중...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  플랜 추가
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
