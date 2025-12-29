"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Zap,
  BookOpen,
  Video,
  FileText,
  Calendar,
  Clock,
  ChevronRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  quickCreateFromContent,
  getSmartScheduleRecommendation,
  type QuickCreateInput,
} from "@/lib/domains/plan/actions/contentPlanGroup";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent?: {
    type: "book" | "lecture" | "custom";
    id: string;
    name: string;
    subject?: string;
    totalUnits?: number;
    unitType?: "page" | "episode" | "chapter";
  };
}

type Step = "content" | "range" | "schedule" | "confirm";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 빠른 플랜 생성 모달
 *
 * 콘텐츠 우선 접근법: 콘텐츠를 선택하고 간단한 설정만으로
 * 바로 플랜을 생성할 수 있습니다.
 */
export function QuickCreateModal({
  isOpen,
  onClose,
  initialContent,
}: QuickCreateModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(initialContent ? "range" : "content");
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);

  // Form state
  const [content, setContent] = useState<QuickCreateInput["content"]>({
    type: initialContent?.type ?? "book",
    id: initialContent?.id ?? "",
    name: initialContent?.name ?? "",
    subject: initialContent?.subject,
  });

  const [range, setRange] = useState({
    start: 1,
    end: initialContent?.totalUnits ?? 100,
    unit: (initialContent?.unitType ?? "page") as "page" | "episode" | "chapter" | "unit",
  });

  const [schedule, setSchedule] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    weekdays: [1, 2, 3, 4, 5] as number[],
    studyType: "weakness" as "strategy" | "weakness",
    reviewEnabled: true,
  });

  const [recommendation, setRecommendation] = useState<{
    recommendedDailyAmount: number;
    estimatedEndDate: string;
    reasoning: string;
  } | null>(null);

  // Load smart recommendation when range changes
  useEffect(() => {
    if (step === "schedule" && content.id && range.end > range.start) {
      setIsLoadingRecommendation(true);
      getSmartScheduleRecommendation(
        content.id,
        range.end - range.start + 1,
        range.unit === "unit" ? "chapter" : range.unit
      )
        .then((rec) => {
          setRecommendation({
            recommendedDailyAmount: rec.recommendedDailyAmount,
            estimatedEndDate: rec.estimatedEndDate,
            reasoning: rec.reasoning,
          });
          setSchedule((prev) => ({
            ...prev,
            endDate: rec.estimatedEndDate,
            weekdays: rec.recommendedWeekdays,
            studyType: rec.studyType,
          }));
        })
        .catch(console.error)
        .finally(() => setIsLoadingRecommendation(false));
    }
  }, [step, content.id, range.end, range.start, range.unit]);

  if (!isOpen) return null;

  const handleCreate = useCallback(() => {
    startTransition(async () => {
      const input: QuickCreateInput = {
        content,
        range,
        schedule: {
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          weekdays: schedule.weekdays,
          studyType: schedule.studyType,
          reviewEnabled: schedule.reviewEnabled,
        },
      };

      const result = await quickCreateFromContent(input);

      if (result.success && result.planGroup) {
        showToast("플랜이 생성되었습니다!", "success");
        onClose();
        router.push(`/plan/group/${result.planGroup.id}`);
      } else {
        showToast(`생성 실패: ${result.error}`, "error");
      }
    });
  }, [content, range, schedule, showToast, onClose, router]);

  const toggleWeekday = useCallback((day: number) => {
    setSchedule((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort(),
    }));
  }, []);

  const totalUnits = useMemo(() => range.end - range.start + 1, [range.start, range.end]);

  const studyDays = useMemo(() => {
    if (!schedule.endDate) return 0;
    return Math.ceil(
      ((new Date(schedule.endDate).getTime() -
        new Date(schedule.startDate).getTime()) /
        86400000) *
        (schedule.weekdays.length / 7)
    );
  }, [schedule.endDate, schedule.startDate, schedule.weekdays.length]);

  const dailyAmount = useMemo(
    () => (studyDays > 0 ? Math.ceil(totalUnits / studyDays) : 0),
    [studyDays, totalUnits]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              빠른 플랜 생성
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex border-b border-gray-100 dark:border-gray-700/50">
          {(["content", "range", "schedule", "confirm"] as const).map((s, i) => (
            <div
              key={s}
              className={cn(
                "flex-1 py-2 text-center text-xs font-medium",
                step === s
                  ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : i < ["content", "range", "schedule", "confirm"].indexOf(step)
                    ? "text-gray-500"
                    : "text-gray-300 dark:text-gray-600"
              )}
            >
              {s === "content" && "콘텐츠"}
              {s === "range" && "범위"}
              {s === "schedule" && "일정"}
              {s === "confirm" && "확인"}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Content Selection */}
          {step === "content" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                학습할 콘텐츠 유형을 선택하세요
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: "book" as const, icon: BookOpen, label: "교재" },
                  { type: "lecture" as const, icon: Video, label: "강의" },
                  { type: "custom" as const, icon: FileText, label: "커스텀" },
                ].map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() =>
                      setContent((prev) => ({ ...prev, type }))
                    }
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                      content.type === type
                        ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20"
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        content.type === type
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-gray-400"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        content.type === type
                          ? "text-indigo-700 dark:text-indigo-300"
                          : "text-gray-600 dark:text-gray-400"
                      )}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    콘텐츠 이름
                  </label>
                  <input
                    type="text"
                    value={content.name}
                    onChange={(e) =>
                      setContent((prev) => ({ ...prev, name: e.target.value, id: e.target.value }))
                    }
                    placeholder="예: 수학의 정석, 영어 기초 강의"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    과목 (선택)
                  </label>
                  <input
                    type="text"
                    value={content.subject ?? ""}
                    onChange={(e) =>
                      setContent((prev) => ({ ...prev, subject: e.target.value }))
                    }
                    placeholder="예: 수학, 영어"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Range Setting */}
          {step === "range" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                학습 범위를 설정하세요
              </p>

              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {content.name}
                </p>
                {content.subject && (
                  <p className="text-sm text-gray-500">{content.subject}</p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    단위 유형
                  </label>
                  <select
                    value={range.unit}
                    onChange={(e) =>
                      setRange((prev) => ({
                        ...prev,
                        unit: e.target.value as typeof range.unit,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="page">페이지</option>
                    <option value="episode">회차</option>
                    <option value="chapter">챕터</option>
                    <option value="unit">단원</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      시작
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={range.start}
                      onChange={(e) =>
                        setRange((prev) => ({
                          ...prev,
                          start: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      끝
                    </label>
                    <input
                      type="number"
                      min={range.start}
                      value={range.end}
                      onChange={(e) =>
                        setRange((prev) => ({
                          ...prev,
                          end: parseInt(e.target.value) || range.start,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 p-3">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    총 {range.end - range.start + 1}
                    {range.unit === "page" ? "페이지" : range.unit === "episode" ? "회차" : "단원"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Schedule Setting */}
          {step === "schedule" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                학습 일정을 설정하세요
              </p>

              {isLoadingRecommendation ? (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span className="text-sm text-indigo-700 dark:text-indigo-300">
                    스마트 추천 계산 중...
                  </span>
                </div>
              ) : recommendation ? (
                <div className="flex items-start gap-2 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4">
                  <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <div className="text-sm">
                    <p className="font-medium text-indigo-700 dark:text-indigo-300">
                      스마트 추천
                    </p>
                    <p className="text-indigo-600/80 dark:text-indigo-400/80">
                      {recommendation.reasoning}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    시작일
                  </label>
                  <input
                    type="date"
                    value={schedule.startDate}
                    onChange={(e) =>
                      setSchedule((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    종료일
                  </label>
                  <input
                    type="date"
                    value={schedule.endDate}
                    min={schedule.startDate}
                    onChange={(e) =>
                      setSchedule((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  학습 요일
                </label>
                <div className="flex gap-1">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <button
                      key={index}
                      onClick={() => toggleWeekday(index)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                        schedule.weekdays.includes(index)
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={schedule.reviewEnabled}
                    onChange={(e) =>
                      setSchedule((prev) => ({
                        ...prev,
                        reviewEnabled: e.target.checked,
                      }))
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
                </label>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  주간 복습 포함
                </span>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === "confirm" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                아래 내용으로 플랜을 생성합니다
              </p>

              <div className="space-y-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">콘텐츠</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {content.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">범위</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {range.start}~{range.end} ({totalUnits}
                    {range.unit === "page" ? "p" : range.unit === "episode" ? "회" : "단원"})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">기간</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {schedule.startDate} ~ {schedule.endDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">학습 요일</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {schedule.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">일일 분량</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    약 {dailyAmount}
                    {range.unit === "page" ? "p" : "단위"}/일
                  </span>
                </div>
                {schedule.reviewEnabled && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">복습</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      주간 복습 포함
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={() => {
              if (step === "content") {
                onClose();
              } else {
                const steps: Step[] = ["content", "range", "schedule", "confirm"];
                const currentIndex = steps.indexOf(step);
                setStep(steps[currentIndex - 1]);
              }
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {step === "content" ? "취소" : "이전"}
          </button>

          <button
            onClick={() => {
              if (step === "confirm") {
                handleCreate();
              } else {
                const steps: Step[] = ["content", "range", "schedule", "confirm"];
                const currentIndex = steps.indexOf(step);
                setStep(steps[currentIndex + 1]);
              }
            }}
            disabled={
              isPending ||
              (step === "content" && !content.name) ||
              (step === "range" && range.end < range.start) ||
              (step === "schedule" && (!schedule.endDate || schedule.weekdays.length === 0))
            }
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : step === "confirm" ? (
              "플랜 생성"
            ) : (
              <>
                다음
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
