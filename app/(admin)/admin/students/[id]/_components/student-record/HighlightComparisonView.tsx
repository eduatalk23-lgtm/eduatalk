"use client";

// ============================================
// AI vs 컨설턴트 하이라이트 비교 뷰
// 동일 원문에 대한 양측 분석 결과를 나란히 비교
// ============================================

import { cn } from "@/lib/cn";
import type { HighlightAnalysisResult } from "@/lib/domains/record-analysis/llm/types";
import { HighlightedSetekView } from "./HighlightedSetekView";
import { Bot, User } from "lucide-react";

interface HighlightComparisonViewProps {
  content: string;
  label: string;
  aiResult?: HighlightAnalysisResult | null;
  consultantResult?: HighlightAnalysisResult | null;
}

export function HighlightComparisonView({
  content,
  label,
  aiResult,
  consultantResult,
}: HighlightComparisonViewProps) {
  const aiTagCount = aiResult?.sections.reduce((sum, s) => sum + s.tags.length, 0) ?? 0;
  const consultantTagCount = consultantResult?.sections.reduce((sum, s) => sum + s.tags.length, 0) ?? 0;

  // 일치하는 태그 수 계산 (동일 competencyItem + 유사 highlight)
  const matchCount = (() => {
    if (!aiResult || !consultantResult) return 0;
    const aiTags = aiResult.sections.flatMap((s) => s.tags);
    const conTags = consultantResult.sections.flatMap((s) => s.tags);
    let matches = 0;
    for (const at of aiTags) {
      if (conTags.some((ct) => ct.competencyItem === at.competencyItem && ct.evaluation === at.evaluation)) {
        matches++;
      }
    }
    return matches;
  })();

  const totalUnique = aiTagCount + consultantTagCount - matchCount;
  const agreementRate = totalUnique > 0 ? Math.round((matchCount / totalUnique) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* 통계 바 */}
      <div className="flex items-center gap-3 rounded-lg bg-[var(--surface-secondary)] px-3 py-2 text-[10px]">
        <span className="font-medium text-[var(--text-primary)]">일치도</span>
        <div className="flex-1 rounded-full bg-gray-200 dark:bg-gray-700" style={{ height: 6 }}>
          <div
            className={cn(
              "h-full rounded-full transition-all",
              agreementRate >= 70 ? "bg-emerald-500" : agreementRate >= 40 ? "bg-amber-500" : "bg-red-400",
            )}
            style={{ width: `${agreementRate}%` }}
          />
        </div>
        <span className={cn(
          "font-semibold",
          agreementRate >= 70 ? "text-emerald-600" : agreementRate >= 40 ? "text-amber-600" : "text-red-500",
        )}>
          {agreementRate}%
        </span>
        <span className="text-[var(--text-tertiary)]">
          (일치 {matchCount} / AI {aiTagCount} / 컨설턴트 {consultantTagCount})
        </span>
      </div>

      {/* 좌우 비교 */}
      <div className="grid grid-cols-2 gap-2">
        {/* AI 분석 */}
        <div className="rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5 border-b border-blue-200 bg-blue-50 px-3 py-1.5 dark:border-blue-800 dark:bg-blue-950/20">
            <Bot className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">AI 분석</span>
            <span className="text-[10px] text-blue-500">{aiTagCount}건</span>
          </div>
          <div className="p-2">
            {aiResult ? (
              <HighlightedSetekView
                content={content}
                sections={aiResult.sections}
                label={`${label} (AI)`}
                defaultExpanded
              />
            ) : (
              <p className="py-3 text-center text-[10px] text-[var(--text-tertiary)]">AI 분석 결과 없음</p>
            )}
          </div>
        </div>

        {/* 컨설턴트 분석 */}
        <div className="rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-1.5 border-b border-orange-200 bg-orange-50 px-3 py-1.5 dark:border-orange-800 dark:bg-orange-950/20">
            <User className="h-3 w-3 text-orange-600 dark:text-orange-400" />
            <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">컨설턴트 분석</span>
            <span className="text-[10px] text-orange-500">{consultantTagCount}건</span>
          </div>
          <div className="p-2">
            {consultantResult ? (
              <HighlightedSetekView
                content={content}
                sections={consultantResult.sections}
                label={`${label} (컨설턴트)`}
                defaultExpanded
              />
            ) : (
              <p className="py-3 text-center text-[10px] text-[var(--text-tertiary)]">컨설턴트 분석 없음</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
