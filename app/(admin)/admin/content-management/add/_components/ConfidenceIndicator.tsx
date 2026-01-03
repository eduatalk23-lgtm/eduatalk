"use client";

/**
 * AI 추론 확신도 표시 컴포넌트
 */

import { cn } from "@/lib/cn";

interface ConfidenceIndicatorProps {
  confidence: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ConfidenceIndicator({
  confidence,
  size = "md",
  showLabel = true,
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100);

  // 색상 결정
  const getColorClass = () => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    if (confidence >= 0.4) return "bg-orange-500";
    return "bg-red-500";
  };

  // 라벨 텍스트
  const getLabel = () => {
    if (confidence >= 0.8) return "높음";
    if (confidence >= 0.6) return "중간";
    if (confidence >= 0.4) return "낮음";
    return "불확실";
  };

  const sizeClasses = {
    sm: "h-1.5 w-12",
    md: "h-2 w-16",
    lg: "h-2.5 w-20",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div className="flex items-center gap-2">
      {/* Progress bar */}
      <div className={cn("rounded-full bg-gray-200 overflow-hidden", sizeClasses[size])}>
        <div
          className={cn("h-full rounded-full transition-all", getColorClass())}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span className={cn("text-gray-600", textSizeClasses[size])}>
          {percentage}% ({getLabel()})
        </span>
      )}
    </div>
  );
}

/**
 * 전체 품질 점수 배지
 */
interface QualityBadgeProps {
  score: number;
  className?: string;
}

export function QualityBadge({ score, className }: QualityBadgeProps) {
  const percentage = Math.round(score * 100);

  const getBadgeColor = () => {
    if (score >= 0.8) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 0.6) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (score >= 0.4) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getStatus = () => {
    if (score >= 0.8) return "우수";
    if (score >= 0.6) return "양호";
    if (score >= 0.4) return "검토 필요";
    return "수동 입력 권장";
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium",
        getBadgeColor(),
        className
      )}
    >
      <span className="font-semibold">{percentage}점</span>
      <span className="text-xs opacity-80">({getStatus()})</span>
    </div>
  );
}
