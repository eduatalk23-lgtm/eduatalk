"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import { PLACEMENT_LABELS, PLACEMENT_COLORS } from "@/lib/domains/admission";
import type { PlacementVerdict } from "@/lib/domains/admission";
import type { ReplacementInfo } from "@/lib/domains/admission/placement/types";

// ─── 충원 분석 상수 ─────────────────────────────

const REPLACEMENT_PROB_COLORS: Record<
  ReplacementInfo["probabilityLevel"],
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  high: { bg: "bg-emerald-100", text: "text-emerald-700", darkBg: "dark:bg-emerald-900/30", darkText: "dark:text-emerald-300" },
  moderate: { bg: "bg-amber-100", text: "text-amber-700", darkBg: "dark:bg-amber-900/30", darkText: "dark:text-amber-300" },
  low: { bg: "bg-red-100", text: "text-red-700", darkBg: "dark:bg-red-900/30", darkText: "dark:text-red-300" },
  none: { bg: "bg-bg-tertiary", text: "text-text-tertiary", darkBg: "dark:bg-bg-secondary", darkText: "dark:text-text-tertiary" },
};

const REPLACEMENT_PROB_LABELS: Record<ReplacementInfo["probabilityLevel"], string> = {
  high: "높음",
  moderate: "보통",
  low: "낮음",
  none: "없음",
};

// ─── 충원 분석 섹션 ─────────────────────────────

function ReplacementSection({ info }: { info: ReplacementInfo }) {
  const colors = REPLACEMENT_PROB_COLORS[info.probabilityLevel];

  return (
    <div className="mt-2 rounded-md border border-[var(--border-secondary)] bg-[var(--surface-secondary)] p-2">
      <div className="flex items-center gap-2">
        <span className="text-3xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          충원
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-3xs font-medium",
            colors.bg, colors.text, colors.darkBg, colors.darkText,
          )}
        >
          {REPLACEMENT_PROB_LABELS[info.probabilityLevel]}
          {info.probabilityLevel !== "none" && ` ${Math.round(info.probability * 100)}%`}
        </span>
        <span className="text-3xs text-[var(--text-tertiary)]">{info.message}</span>
      </div>

      {/* 연도별 충원 인원 */}
      <div className="mt-1 flex items-center gap-3 text-3xs text-[var(--text-secondary)]">
        {info.historicalCounts.map((c) => (
          <span key={c.year}>{c.year}: {c.count}명</span>
        ))}
        <span className="text-[var(--text-tertiary)]">평균 {info.averageCount}명</span>
      </div>
    </div>
  );
}

// ─── 배치 카드 ────────────────────────────────────

export function PlacementCard({ verdict }: { verdict: PlacementVerdict }) {
  const [expanded, setExpanded] = useState(false);
  const colors = PLACEMENT_COLORS[verdict.level];

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] transition-colors hover:bg-[var(--surface-hover)]">
      {/* 카드 헤더 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        {/* 판정 배지 */}
        <span
          className={cn(
            "inline-flex min-w-[3.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
            colors.bg,
            colors.text,
            colors.darkBg,
            colors.darkText,
          )}
        >
          {PLACEMENT_LABELS[verdict.level]}
        </span>

        {/* 대학/학과 */}
        <div className="flex-1 overflow-hidden">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {verdict.universityName}
          </span>
          <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">
            {verdict.departmentName}
          </span>
        </div>

        {/* 점수/차이 */}
        <div className="flex items-center gap-2 text-right">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
              {verdict.studentScore.toFixed(1)}
            </span>
            {verdict.scoreDiff !== null && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  verdict.scoreDiff >= 0 ? "text-emerald-600" : "text-red-500",
                )}
              >
                {verdict.scoreDiff >= 0 ? "+" : ""}
                {verdict.scoreDiff.toFixed(1)}
              </span>
            )}
          </div>

          <ChevronDown
            size={14}
            className={cn(
              "flex-shrink-0 text-[var(--text-tertiary)] transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* 펼침: 입결 비교 */}
      {expanded && (
        <div className="border-t border-[var(--border-secondary)] px-3 py-2.5">
          <div className="flex flex-wrap gap-4 text-xs">
            {/* 메타 정보 */}
            <div className="flex gap-3 text-[var(--text-tertiary)]">
              {verdict.region && <span>{verdict.region}</span>}
              {verdict.departmentType && <span>{verdict.departmentType}</span>}
              <span>신뢰도: {verdict.confidence}%</span>
            </div>
          </div>

          {/* 입결 비교 테이블 */}
          {verdict.historicalComparisons.length > 0 && (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-secondary)] text-left text-[var(--text-tertiary)]">
                  <th className="py-1 pr-3">연도</th>
                  <th className="py-1 pr-3">기준</th>
                  <th className="py-1 pr-3">등급</th>
                  <th className="py-1 text-right">입결 점수</th>
                  <th className="py-1 text-right">차이</th>
                </tr>
              </thead>
              <tbody>
                {verdict.historicalComparisons.map((comp) => {
                  const diff = comp.score != null ? verdict.studentScore - comp.score : null;
                  return (
                    <tr key={comp.year} className="border-b border-[var(--border-secondary)] last:border-0">
                      <td className="py-1 pr-3 font-medium text-[var(--text-primary)]">{comp.year}</td>
                      <td className="py-1 pr-3 text-[var(--text-secondary)]">{comp.basis ?? "-"}</td>
                      <td className="py-1 pr-3 text-[var(--text-secondary)]">{comp.grade ?? "-"}</td>
                      <td className="py-1 text-right tabular-nums text-[var(--text-primary)]">
                        {comp.score?.toFixed(1) ?? "-"}
                      </td>
                      <td
                        className={cn(
                          "py-1 text-right tabular-nums",
                          diff != null && diff >= 0 ? "text-emerald-600" : "text-red-500",
                        )}
                      >
                        {diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 비고 */}
          {verdict.notes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {verdict.notes.map((note, i) => (
                <span
                  key={i}
                  className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-secondary dark:bg-bg-secondary dark:text-text-tertiary"
                >
                  {note}
                </span>
              ))}
            </div>
          )}

          {/* 충원 분석 */}
          {verdict.replacementInfo && (
            <ReplacementSection info={verdict.replacementInfo} />
          )}
        </div>
      )}
    </div>
  );
}
