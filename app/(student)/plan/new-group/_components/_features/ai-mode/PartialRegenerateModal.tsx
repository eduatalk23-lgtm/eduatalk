"use client";

/**
 * PartialRegenerateModal - 부분 재생성 모달
 *
 * 기존 플랜의 특정 부분만 AI로 재생성하는 모달입니다.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import TextArea from "@/components/atoms/TextArea";
import Label from "@/components/atoms/Label";
import FormCheckbox from "@/components/ui/FormCheckbox";
import {
  Calendar,
  BookOpen,
  FileText,
  CalendarRange,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { GeneratedPlanItem } from "@/lib/domains/plan/llm/types";
import type { RegenerateScope } from "@/lib/domains/plan/llm/prompts/partialRegeneration";
import {
  regeneratePartialPlan,
  type PartialRegenerateResult,
} from "@/lib/domains/plan/llm/actions/regeneratePartial";

export interface PartialRegenerateModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 기존 플랜 목록 */
  existingPlans: GeneratedPlanItem[];
  /** 재생성 완료 콜백 */
  onRegenerated: (result: PartialRegenerateResult) => void;
  /** 추가 클래스 */
  className?: string;
}

type ScopeType = "date" | "dateRange" | "subject" | "content";

const SCOPE_OPTIONS: {
  value: ScopeType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "date",
    label: "특정 날짜",
    description: "선택한 날짜의 플랜만 재생성",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    value: "dateRange",
    label: "기간",
    description: "특정 기간의 플랜을 재생성",
    icon: <CalendarRange className="h-4 w-4" />,
  },
  {
    value: "subject",
    label: "과목",
    description: "특정 과목의 플랜만 재생성",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    value: "content",
    label: "콘텐츠",
    description: "특정 콘텐츠의 플랜만 재생성",
    icon: <FileText className="h-4 w-4" />,
  },
];

export function PartialRegenerateModal({
  open,
  onOpenChange,
  existingPlans,
  onRegenerated,
}: PartialRegenerateModalProps) {
  const [scopeType, setScopeType] = useState<ScopeType>("date");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [keepExisting, setKeepExisting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 유니크한 날짜, 과목, 콘텐츠 추출
  const uniqueDates = [...new Set(existingPlans.map((p) => p.date))].sort();
  const uniqueSubjects = [...new Set(existingPlans.map((p) => p.subject))];
  const uniqueContents = existingPlans.reduce(
    (acc, p) => {
      if (!acc.find((c) => c.id === p.contentId)) {
        acc.push({ id: p.contentId, title: p.contentTitle });
      }
      return acc;
    },
    [] as { id: string; title: string }[]
  );

  const handleRegenerate = useCallback(async () => {
    setError(null);
    setIsRegenerating(true);

    try {
      let scope: RegenerateScope;

      switch (scopeType) {
        case "date":
          if (selectedDates.length === 0) {
            throw new Error("날짜를 선택해주세요.");
          }
          scope = { type: "date", dates: selectedDates };
          break;
        case "dateRange":
          if (selectedDates.length < 2) {
            throw new Error("시작일과 종료일을 선택해주세요.");
          }
          const sortedDates = [...selectedDates].sort();
          scope = {
            type: "dateRange",
            dateRange: {
              start: sortedDates[0],
              end: sortedDates[sortedDates.length - 1],
            },
          };
          break;
        case "subject":
          if (selectedSubjects.length === 0) {
            throw new Error("과목을 선택해주세요.");
          }
          scope = { type: "subject", subjects: selectedSubjects };
          break;
        case "content":
          if (selectedContentIds.length === 0) {
            throw new Error("콘텐츠를 선택해주세요.");
          }
          scope = { type: "content", contentIds: selectedContentIds };
          break;
        default:
          throw new Error("잘못된 범위 유형입니다.");
      }

      const result = await regeneratePartialPlan({
        existingPlans,
        scope,
        feedback: feedback || undefined,
        keepExisting,
      });

      if (result.success) {
        onRegenerated(result);
        onOpenChange(false);
        // Reset form
        setSelectedDates([]);
        setSelectedSubjects([]);
        setSelectedContentIds([]);
        setFeedback("");
        setKeepExisting(false);
      } else {
        setError(result.error || "재생성에 실패했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsRegenerating(false);
    }
  }, [
    scopeType,
    selectedDates,
    selectedSubjects,
    selectedContentIds,
    feedback,
    keepExisting,
    existingPlans,
    onRegenerated,
    onOpenChange,
  ]);

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const toggleContent = (contentId: string) => {
    setSelectedContentIds((prev) =>
      prev.includes(contentId)
        ? prev.filter((c) => c !== contentId)
        : [...prev, contentId]
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="부분 재생성"
      description="기존 플랜의 특정 부분만 AI로 재생성합니다."
      size="lg"
    >
      <DialogContent>
        <div className="space-y-6">
          {/* 범위 유형 선택 */}
          <div className="space-y-3">
            <Label className={textPrimary}>재생성 범위</Label>
            <div className="grid grid-cols-2 gap-3">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScopeType(option.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    scopeType === option.value
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span className={cn("font-medium", textPrimary)}>
                        {option.label}
                      </span>
                    </div>
                    <p className={cn("text-xs mt-1", textMuted)}>
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 선택 (date/dateRange) */}
          {(scopeType === "date" || scopeType === "dateRange") && (
            <div className="space-y-3">
              <Label className={textPrimary}>
                {scopeType === "date" ? "날짜 선택" : "기간 선택 (시작/종료)"}
              </Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {uniqueDates.map((date) => (
                  <Button
                    key={date}
                    type="button"
                    variant={selectedDates.includes(date) ? "primary" : "outline"}
                    size="sm"
                    onClick={() => toggleDate(date)}
                  >
                    {new Date(date).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 과목 선택 */}
          {scopeType === "subject" && (
            <div className="space-y-3">
              <Label className={textPrimary}>과목 선택</Label>
              <div className="flex flex-wrap gap-2">
                {uniqueSubjects.map((subject) => (
                  <Button
                    key={subject}
                    type="button"
                    variant={
                      selectedSubjects.includes(subject) ? "primary" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleSubject(subject)}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 콘텐츠 선택 */}
          {scopeType === "content" && (
            <div className="space-y-3">
              <Label className={textPrimary}>콘텐츠 선택</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uniqueContents.map((content) => (
                  <FormCheckbox
                    key={content.id}
                    id={`content-${content.id}`}
                    label={content.title}
                    checked={selectedContentIds.includes(content.id)}
                    onChange={() => toggleContent(content.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 피드백/요청 */}
          <div className="space-y-2">
            <Label htmlFor="feedback" className={textPrimary}>
              요청사항 (선택)
            </Label>
            <TextArea
              id="feedback"
              placeholder="예: 오후 시간대로 옮겨주세요, 학습량을 줄여주세요..."
              value={feedback}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
              className="h-20 resize-none"
            />
          </div>

          {/* 기존 유지 옵션 */}
          <FormCheckbox
            id="keep-existing"
            label="기존 플랜을 유지하면서 추가/수정"
            checked={keepExisting}
            onChange={() => setKeepExisting(!keepExisting)}
          />

          {/* 에러 표시 */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isRegenerating}
        >
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              재생성 중...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI 재생성
            </span>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
