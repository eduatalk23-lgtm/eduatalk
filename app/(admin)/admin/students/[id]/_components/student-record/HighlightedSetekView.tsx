"use client";

// ============================================
// 세특 인라인 하이라이트 뷰
// Phase 6.1 — AI가 분석한 구절을 원문에서 색상으로 표시
// ============================================

import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { CompetencyArea, CompetencyItemCode } from "@/lib/domains/student-record";
import type { HighlightTag, AnalyzedSection } from "@/lib/domains/student-record/llm/types";

// ─── 색상 체계 ────────────────────────────────

const AREA_COLORS: Record<CompetencyArea, { bg: string; text: string; border: string }> = {
  academic: {
    bg: "bg-blue-100/70 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-300 dark:border-blue-700",
  },
  career: {
    bg: "bg-purple-100/70 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-300 dark:border-purple-700",
  },
  community: {
    bg: "bg-green-100/70 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-300 dark:border-green-700",
  },
};

const NEEDS_REVIEW_COLORS = {
  bg: "bg-yellow-100/70 dark:bg-yellow-900/30",
  text: "text-yellow-700 dark:text-yellow-400",
  border: "border-yellow-300 dark:border-yellow-700",
};

function getAreaOfItem(code: CompetencyItemCode): CompetencyArea {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.area ?? "academic";
}

function getItemLabel(code: CompetencyItemCode): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

function getColors(tag: HighlightTag) {
  if (tag.evaluation === "needs_review") return NEEDS_REVIEW_COLORS;
  return AREA_COLORS[getAreaOfItem(tag.competencyItem)];
}

// ─── 하이라이트 세그먼트 생성 ──────────────────

type Segment = { text: string; tag?: HighlightTag };

function buildSegments(content: string, tags: HighlightTag[]): Segment[] {
  if (tags.length === 0) return [{ text: content }];

  // 모든 하이라이트 위치 찾기
  type Match = { start: number; end: number; tag: HighlightTag };
  const matches: Match[] = [];

  for (const tag of tags) {
    const idx = content.indexOf(tag.highlight);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + tag.highlight.length, tag });
    }
  }

  // 겹침 제거 (먼저 나오는 것 우선)
  matches.sort((a, b) => a.start - b.start);
  const filtered: Match[] = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // 세그먼트 생성
  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of filtered) {
    if (m.start > cursor) {
      segments.push({ text: content.slice(cursor, m.start) });
    }
    segments.push({ text: content.slice(m.start, m.end), tag: m.tag });
    cursor = m.end;
  }
  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor) });
  }

  return segments;
}

// ─── CompetencyBadge ─────────────────────────

export function CompetencyBadge({ tag, compact }: { tag: HighlightTag; compact?: boolean }) {
  const colors = getColors(tag);
  const areaLabel = COMPETENCY_AREA_LABELS[getAreaOfItem(tag.competencyItem)];
  const itemLabel = getItemLabel(tag.competencyItem);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-medium",
        compact ? "text-[9px]" : "text-[10px]",
        colors.bg, colors.text, colors.border,
      )}
      title={`${areaLabel} > ${itemLabel}: ${tag.reasoning}`}
    >
      {compact ? itemLabel : `${areaLabel}_${itemLabel}`}
    </span>
  );
}

// ─── HighlightedSetekView ────────────────────

type Props = {
  content: string;
  sections: AnalyzedSection[];
  label: string;
  /** 태그 펼침 토글 */
  defaultExpanded?: boolean;
};

export function HighlightedSetekView({ content, sections, label, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // 모든 섹션의 태그를 플랫하게
  const allTags = useMemo(
    () => sections.flatMap((s) => s.tags),
    [sections],
  );

  const segments = useMemo(
    () => buildSegments(content, allTags),
    [content, allTags],
  );

  const hasNeedsReview = sections.some((s) => s.needsReview);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
          {hasNeedsReview && (
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              확인 要
            </span>
          )}
          <span className="text-xs text-[var(--text-tertiary)]">{allTags.length}개 태그</span>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          {/* 하이라이트된 원문 */}
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">
            {segments.map((seg, i) =>
              seg.tag ? (
                <HighlightedSpan key={i} text={seg.text} tag={seg.tag} />
              ) : (
                <Fragment key={i}>{seg.text}</Fragment>
              ),
            )}
          </p>

          {/* 태그 요약 */}
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {allTags.map((tag, i) => (
                <CompetencyBadge key={i} tag={tag} />
              ))}
            </div>
          )}

          {/* 구간별 상세 (접이식) */}
          {sections.length > 1 && (
            <SectionDetails sections={sections} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── 하이라이트된 텍스트 스팬 ──────────────────

function HighlightedSpan({ text, tag }: { text: string; tag: HighlightTag }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = getColors(tag);

  return (
    <span className="relative inline">
      <mark
        className={cn(
          "cursor-help rounded-sm px-0.5",
          colors.bg,
          "decoration-2 underline decoration-dotted",
          colors.text.replace("text-", "decoration-"),
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {text}
      </mark>
      {showTooltip && (
        <span className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          <span className="flex items-center gap-1 text-xs font-medium">
            <CompetencyBadge tag={tag} compact />
          </span>
          <span className="mt-1 block text-xs text-[var(--text-secondary)]">
            {tag.reasoning}
          </span>
        </span>
      )}
    </span>
  );
}

// ─── 구간 상세 ──────────────────────────────

function SectionDetails({ sections }: { sections: AnalyzedSection[] }) {
  return (
    <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-700">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">구간 분석</p>
      <div className="flex flex-col gap-1">
        {sections.map((sec, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 w-16 text-[var(--text-tertiary)]">{sec.sectionType}</span>
            <div className="flex flex-wrap gap-1">
              {sec.tags.map((tag, j) => (
                <CompetencyBadge key={j} tag={tag} compact />
              ))}
              {sec.needsReview && (
                <span className="rounded bg-yellow-100 px-1 py-0.5 text-[9px] text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  확인 要
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
