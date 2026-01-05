"use client";

import { useState, useCallback, useTransition } from "react";
import { Star, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  submitSatisfactionRating,
  type SatisfactionTag,
} from "@/lib/domains/satisfaction/satisfactionService";

interface SatisfactionRatingProps {
  planId: string;
  studentId: string;
  tenantId?: string;
  contentType?: string;
  subjectType?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  completionRate?: number;
  onComplete?: (rating: number) => void;
  onSkip?: () => void;
  className?: string;
}

const RATING_LABELS = ["", "불만족", "아쉬움", "보통", "만족", "매우 만족"];

const QUICK_TAGS: Array<{ value: SatisfactionTag; label: string }> = [
  { value: "too_easy", label: "너무 쉬웠어요" },
  { value: "appropriate", label: "딱 적당했어요" },
  { value: "too_hard", label: "어려웠어요" },
  { value: "interesting", label: "재미있었어요" },
  { value: "helpful", label: "도움이 됐어요" },
];

/**
 * 만족도 별점 평가 컴포넌트
 *
 * 플랜 완료 후 간단한 1-5점 별점 평가를 수집합니다.
 * 비침투적으로 설계되어 건너뛰기가 가능합니다.
 */
export function SatisfactionRating({
  planId,
  studentId,
  tenantId,
  contentType,
  subjectType,
  estimatedDuration,
  actualDuration,
  completionRate,
  onComplete,
  onSkip,
  className,
}: SatisfactionRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<SatisfactionTag[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const handleRatingClick = useCallback((value: number) => {
    setRating(value);
    setShowTags(true);
  }, []);

  const handleTagToggle = useCallback((tag: SatisfactionTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (rating === 0) return;

    startTransition(async () => {
      try {
        const result = await submitSatisfactionRating({
          planId,
          studentId,
          tenantId,
          rating: rating as 1 | 2 | 3 | 4 | 5,
          tags: selectedTags,
          contentType,
          subjectType,
          estimatedDuration,
          actualDuration,
          completionRate,
        });

        if (result.success) {
          setSubmitted(true);
          setTimeout(() => {
            onComplete?.(rating);
          }, 500);
        } else {
          console.error("[SatisfactionRating] 제출 실패:", result.error);
          // 실패해도 사용자 경험을 위해 완료 처리
          onComplete?.(rating);
        }
      } catch (error) {
        console.error("[SatisfactionRating] 제출 중 오류:", error);
        onComplete?.(rating);
      }
    });
  }, [
    planId,
    studentId,
    tenantId,
    rating,
    selectedTags,
    contentType,
    subjectType,
    estimatedDuration,
    actualDuration,
    completionRate,
    onComplete,
  ]);

  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  if (submitted) {
    return (
      <div
        className={cn(
          "rounded-lg bg-green-50 p-4 text-center text-green-700",
          className
        )}
      >
        <p className="text-sm font-medium">감사합니다!</p>
      </div>
    );
  }

  const displayRating = hoveredRating || rating;

  return (
    <div className={cn("rounded-lg bg-gray-50 p-4", className)}>
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          이번 학습은 어떠셨나요?
        </h4>
        {onSkip && (
          <button
            onClick={handleSkip}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="건너뛰기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 별점 */}
      <div className="flex flex-col items-center">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => handleRatingClick(value)}
              onMouseEnter={() => setHoveredRating(value)}
              onMouseLeave={() => setHoveredRating(0)}
              className={cn(
                "rounded p-1 transition-colors",
                "hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1"
              )}
              aria-label={`${value}점`}
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  value <= displayRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                )}
              />
            </button>
          ))}
        </div>
        {displayRating > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {RATING_LABELS[displayRating]}
          </p>
        )}
      </div>

      {/* 빠른 태그 (별점 선택 후) */}
      {showTags && (
        <div className="mt-3 animate-in fade-in slide-in-from-bottom-1">
          <div className="flex flex-wrap justify-center gap-1.5">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag.value}
                onClick={() => handleTagToggle(tag.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs transition-colors",
                  selectedTags.includes(tag.value)
                    ? "bg-blue-100 text-blue-700"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 제출 버튼 */}
      {rating > 0 && (
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className={cn(
            "mt-3 w-full rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors",
            "hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              제출 중...
            </span>
          ) : (
            "제출하기"
          )}
        </button>
      )}
    </div>
  );
}

/**
 * 컴팩트 버전 (인라인 표시용)
 */
interface CompactSatisfactionRatingProps {
  planId: string;
  studentId: string;
  tenantId?: string;
  onComplete?: (rating: number) => void;
  className?: string;
}

export function CompactSatisfactionRating({
  planId,
  studentId,
  tenantId,
  onComplete,
  className,
}: CompactSatisfactionRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const handleRatingClick = useCallback(
    (value: number) => {
      setRating(value);

      startTransition(async () => {
        const result = await submitSatisfactionRating({
          planId,
          studentId,
          tenantId,
          rating: value as 1 | 2 | 3 | 4 | 5,
        });

        if (result.success) {
          setSubmitted(true);
          onComplete?.(value);
        }
      });
    },
    [planId, studentId, tenantId, onComplete]
  );

  if (submitted) {
    return (
      <span className={cn("text-xs text-green-600", className)}>
        평가 완료
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          onClick={() => handleRatingClick(value)}
          disabled={isPending}
          className="rounded p-0.5 transition-colors hover:bg-gray-100"
          aria-label={`${value}점`}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              value <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            )}
          />
        </button>
      ))}
      {isPending && <Loader2 className="ml-1 h-3 w-3 animate-spin text-gray-400" />}
    </div>
  );
}
