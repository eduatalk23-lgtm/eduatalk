"use client";

import { cn } from "@/lib/cn";
import type { ExplorationGuide, GuideType } from "@/lib/domains/guide";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide";

const TYPE_COLORS: Record<GuideType, string> = {
  reading: "bg-amber-100 text-amber-700",
  topic_exploration: "bg-blue-100 text-blue-700",
  subject_performance: "bg-emerald-100 text-emerald-700",
  experiment: "bg-purple-100 text-purple-700",
  program: "bg-pink-100 text-pink-700",
};

interface GuideCardProps {
  guide: ExplorationGuide;
  onSelect: (guideId: string) => void;
  onAssign?: (guideId: string) => void;
  isAssigned?: boolean;
}

export function GuideCard({
  guide,
  onSelect,
  onAssign,
  isAssigned,
}: GuideCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
        "hover:bg-gray-50 cursor-pointer",
        isAssigned && "opacity-60",
      )}
      onClick={() => onSelect(guide.id)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
              TYPE_COLORS[guide.guide_type],
            )}
          >
            {GUIDE_TYPE_LABELS[guide.guide_type]}
          </span>
          <span className="truncate text-sm font-medium text-gray-900">
            {guide.title}
          </span>
        </div>
        {guide.book_title && (
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {guide.book_title}
            {guide.book_author && ` — ${guide.book_author}`}
          </p>
        )}
      </div>
      {onAssign && !isAssigned && (
        <button
          type="button"
          className="shrink-0 rounded-md bg-primary-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-600"
          onClick={(e) => {
            e.stopPropagation();
            onAssign(guide.id);
          }}
        >
          배정
        </button>
      )}
      {isAssigned && (
        <span className="shrink-0 text-xs text-gray-400">배정됨</span>
      )}
    </div>
  );
}
