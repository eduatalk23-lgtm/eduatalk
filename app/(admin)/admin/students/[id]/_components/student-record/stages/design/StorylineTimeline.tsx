"use client";

import { cn } from "@/lib/cn";
import type { Storyline, RoadmapItem } from "@/lib/domains/student-record";
import { StorylineStrengthBadge } from "../../StorylineStrengthBadge";

type StorylineTimelineProps = {
  storylines: Storyline[];
  roadmapItems: RoadmapItem[];
};

const GRADE_LABELS = ["1학년", "2학년", "3학년"];

export function StorylineTimeline({ storylines, roadmapItems }: StorylineTimelineProps) {
  if (storylines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
        스토리라인을 먼저 추가해주세요. 타임라인이 자동으로 생성됩니다.
      </div>
    );
  }

  // Group roadmap items by storyline
  const roadmapByStoryline = new Map<string, RoadmapItem[]>();
  for (const item of roadmapItems) {
    if (!item.storyline_id) continue;
    const list = roadmapByStoryline.get(item.storyline_id) ?? [];
    list.push(item);
    roadmapByStoryline.set(item.storyline_id, list);
  }

  // Orphaned items (not linked to any storyline)
  const orphanedItems = roadmapItems.filter((item) => !item.storyline_id);

  return (
    <div className="flex flex-col gap-6">
      {/* 스토리라인별 타임라인 */}
      {storylines.map((storyline) => {
        const items = roadmapByStoryline.get(storyline.id) ?? [];
        const itemsByGrade = [1, 2, 3].map((grade) =>
          items.filter((item) => item.grade === grade)
        );

        return (
          <div key={storyline.id} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            {/* 헤더 */}
            <div className="flex items-center gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
              <span className="font-medium text-sm text-[var(--text-primary)]">{storyline.title}</span>
              <StorylineStrengthBadge strength={storyline.strength} />
              {storyline.career_field && (
                <span className="text-xs text-[var(--text-tertiary)]">{storyline.career_field}</span>
              )}
            </div>

            {/* 학년별 그리드 */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
              {GRADE_LABELS.map((label, idx) => {
                const grade = idx + 1;
                const theme = grade === 1 ? storyline.grade_1_theme
                  : grade === 2 ? storyline.grade_2_theme
                  : storyline.grade_3_theme;
                const gradeItems = itemsByGrade[idx];

                return (
                  <div key={grade} className="p-3">
                    <div className="mb-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
                      {theme && (
                        <span className="ml-1 text-xs text-[var(--text-tertiary)]">({theme})</span>
                      )}
                    </div>

                    {gradeItems.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {gradeItems.map((item) => (
                          <RoadmapItemChip key={item.id} item={item} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-placeholder)]">활동 없음</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 키워드 */}
            {storyline.keywords.length > 0 && (
              <div className="flex gap-1 border-t border-gray-100 px-3 py-2 dark:border-gray-800">
                {storyline.keywords.map((kw) => (
                  <span key={kw} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* 미연결 항목 */}
      {orphanedItems.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              미연결 로드맵 항목 ({orphanedItems.length}개)
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {orphanedItems.map((item) => (
              <RoadmapItemChip key={item.id} item={item} variant="warning" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// RoadmapItemChip
// ============================================

const AREA_LABELS: Record<string, string> = {
  autonomy: "자율",
  club: "동아리",
  career: "진로",
  setek: "세특",
  personal_setek: "개인세특",
  reading: "독서",
  course_selection: "교과",
  competition: "대회",
  external: "외부",
  volunteer: "봉사",
  general: "기타",
};

function RoadmapItemChip({
  item,
  variant = "default",
}: {
  item: RoadmapItem;
  variant?: "default" | "warning";
}) {
  const hasExecution = !!item.execution_content;
  const matchLabel = item.match_rate != null ? `${item.match_rate}%` : null;

  return (
    <div
      className={cn(
        "rounded px-2 py-1 text-xs",
        variant === "warning"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          : hasExecution
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
            : "bg-gray-100 text-[var(--text-secondary)] dark:bg-gray-800",
      )}
    >
      <span className="font-medium">{AREA_LABELS[item.area] ?? item.area}</span>
      {" "}
      <span className="line-clamp-1">{item.plan_content}</span>
      {matchLabel && (
        <span className={cn(
          "ml-1 font-medium",
          (item.match_rate ?? 0) >= 70 ? "text-emerald-600" : "text-amber-600",
        )}>
          {matchLabel}
        </span>
      )}
    </div>
  );
}
