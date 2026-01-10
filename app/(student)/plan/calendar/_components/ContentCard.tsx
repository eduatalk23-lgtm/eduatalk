"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { textPrimary, textMuted } from "@/lib/utils/darkMode";

export type ContentCardColorScheme = "indigo" | "amber";

type ContentCardProps = {
  /** 콘텐츠 ID (key로 사용) */
  contentId: string;
  /** 콘텐츠 제목 */
  title: string;
  /** 선택 상태 */
  isSelected: boolean;
  /** 아이콘 컴포넌트 */
  icon: React.ComponentType<{ className?: string }>;
  /** 색상 스킴 */
  colorScheme?: ContentCardColorScheme;
  /** 제목 옆에 표시될 배지 */
  badge?: React.ReactNode;
  /** 아이콘 옆에 표시될 추가 아이콘 (예: 추천 스파클) */
  iconOverlay?: React.ReactNode;
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 서브 카테고리 (첫 번째 줄) */
  subjectCategory?: string | null;
  /** 과목 (첫 번째 줄) */
  subject?: string | null;
  /** 출판사/학원명 */
  publisherOrAcademy?: string | null;
  /** 추가 설명 텍스트 */
  description?: string | null;
  /** 페이지 수 */
  totalPages?: number | null;
  /** 회차 수 */
  totalEpisodes?: number | null;
};

const colorSchemeStyles: Record<
  ContentCardColorScheme,
  {
    selected: string;
    hover: string;
    iconSelected: string;
    titleSelected: string;
    checkColor: string;
  }
> = {
  indigo: {
    selected: "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30",
    hover: "hover:border-indigo-300",
    iconSelected: "text-indigo-600",
    titleSelected: "text-indigo-700",
    checkColor: "text-indigo-600",
  },
  amber: {
    selected: "border-amber-500 bg-amber-50 dark:bg-amber-900/30",
    hover: "hover:border-amber-300",
    iconSelected: "text-amber-600",
    titleSelected: "text-amber-700",
    checkColor: "text-amber-600",
  },
};

export function ContentCard({
  contentId,
  title,
  isSelected,
  icon: Icon,
  colorScheme = "indigo",
  badge,
  iconOverlay,
  onClick,
  subjectCategory,
  subject,
  publisherOrAcademy,
  description,
  totalPages,
  totalEpisodes,
}: ContentCardProps) {
  const styles = colorSchemeStyles[colorScheme];

  // 메타 정보 (페이지 수 또는 회차 수)
  const metaInfo =
    totalPages != null
      ? `${totalPages}페이지`
      : totalEpisodes != null
        ? `${totalEpisodes}회차`
        : null;

  return (
    <button
      key={contentId}
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border-2 p-4 text-left transition-all",
        isSelected
          ? styles.selected
          : `border-gray-200 dark:border-gray-700 ${styles.hover} hover:bg-gray-50 dark:hover:bg-gray-800`
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={iconOverlay ? "relative" : undefined}>
            <Icon
              className={cn(
                "mt-0.5 h-5 w-5",
                isSelected ? styles.iconSelected : "text-gray-400"
              )}
            />
            {iconOverlay}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-medium",
                  isSelected ? styles.titleSelected : textPrimary
                )}
              >
                {title}
              </span>
              {badge}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {publisherOrAcademy && (
                <span className={cn("text-xs", textMuted)}>
                  {publisherOrAcademy}
                </span>
              )}
              {subjectCategory && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {subjectCategory}
                </span>
              )}
              {subject && (
                <span className={cn("text-xs", textMuted)}>{subject}</span>
              )}
              {description && (
                <span className={cn("text-xs", textMuted)}>{description}</span>
              )}
            </div>
            {metaInfo && (
              <div className={cn("mt-1 text-xs", textMuted)}>{metaInfo}</div>
            )}
          </div>
        </div>
        {isSelected && <Check className={cn("h-5 w-5", styles.checkColor)} />}
      </div>
    </button>
  );
}
