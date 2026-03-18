"use client";

// ============================================
// 세특 인라인 하이라이트 뷰
// Phase 6.1 — AI가 분석한 구절을 원문에서 역량별 색상으로 표시
// ============================================

import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { CompetencyArea, CompetencyItemCode } from "@/lib/domains/student-record";
import type { HighlightTag, AnalyzedSection } from "@/lib/domains/student-record/llm/types";

// ─── 색상 체계 ────────────────────────────────

/** 역량 영역별 하이라이트 색상 — mark 기본 노란색 오버라이드 필수 */
const AREA_HIGHLIGHT: Record<CompetencyArea, { mark: string; badge: string; badgeBorder: string }> = {
  academic: {
    mark: "bg-blue-100 dark:bg-blue-900/40 text-[var(--text-primary)] decoration-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    badgeBorder: "border-blue-300 dark:border-blue-700",
  },
  career: {
    mark: "bg-purple-100 dark:bg-purple-900/40 text-[var(--text-primary)] decoration-purple-400",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    badgeBorder: "border-purple-300 dark:border-purple-700",
  },
  community: {
    mark: "bg-green-100 dark:bg-green-900/40 text-[var(--text-primary)] decoration-green-400",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    badgeBorder: "border-green-300 dark:border-green-700",
  },
};

const NEEDS_REVIEW_HIGHLIGHT = {
  mark: "bg-yellow-100 dark:bg-yellow-900/40 text-[var(--text-primary)] decoration-yellow-500",
  badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  badgeBorder: "border-yellow-300 dark:border-yellow-700",
};

const EVAL_LABELS: Record<string, { label: string; dot: string }> = {
  positive: { label: "긍정", dot: "🟢" },
  negative: { label: "부정", dot: "🔴" },
  needs_review: { label: "확인필요", dot: "🟡" },
};

function getAreaOfItem(code: CompetencyItemCode): CompetencyArea {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.area ?? "academic";
}

function getItemLabel(code: CompetencyItemCode): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

function getHighlight(tag: HighlightTag) {
  if (tag.evaluation === "needs_review") return NEEDS_REVIEW_HIGHLIGHT;
  return AREA_HIGHLIGHT[getAreaOfItem(tag.competencyItem)];
}

// ─── 하이라이트 세그먼트 생성 ──────────────────

type Segment = { text: string; tag?: HighlightTag };

function buildSegments(content: string, tags: HighlightTag[]): Segment[] {
  if (tags.length === 0) return [{ text: content }];

  type Match = { start: number; end: number; tag: HighlightTag };
  const matches: Match[] = [];

  for (const tag of tags) {
    const idx = content.indexOf(tag.highlight);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + tag.highlight.length, tag });
    }
  }

  matches.sort((a, b) => a.start - b.start);
  const filtered: Match[] = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of filtered) {
    if (m.start > cursor) segments.push({ text: content.slice(cursor, m.start) });
    segments.push({ text: content.slice(m.start, m.end), tag: m.tag });
    cursor = m.end;
  }
  if (cursor < content.length) segments.push({ text: content.slice(cursor) });

  return segments;
}

// ─── CompetencyBadge ─────────────────────────

export function CompetencyBadge({ tag, compact }: { tag: HighlightTag; compact?: boolean }) {
  const colors = getHighlight(tag);
  const itemLabel = getItemLabel(tag.competencyItem);
  const areaLabel = COMPETENCY_AREA_LABELS[getAreaOfItem(tag.competencyItem)];
  const evalInfo = EVAL_LABELS[tag.evaluation] ?? EVAL_LABELS.positive;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-medium",
        compact ? "text-[9px]" : "text-[10px]",
        colors.badge, colors.badgeBorder,
      )}
      title={`${areaLabel} > ${itemLabel} (${evalInfo.label}): ${tag.reasoning}`}
    >
      {evalInfo.dot} {compact ? itemLabel : `${areaLabel}_${itemLabel}`}
    </span>
  );
}

// ─── HighlightedSetekView ────────────────────

type Props = {
  content: string;
  sections: AnalyzedSection[];
  label: string;
  defaultExpanded?: boolean;
};

export function HighlightedSetekView({ content, sections, label, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const allTags = useMemo(() => sections.flatMap((s) => s.tags), [sections]);
  const segments = useMemo(() => buildSegments(content, allTags), [content, allTags]);
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
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* 하이라이트된 원문 */}
          <div className="px-3 py-3">
            <p className="text-sm leading-relaxed text-[var(--text-primary)]">
              {segments.map((seg, i) =>
                seg.tag ? (
                  <HighlightedSpan key={i} text={seg.text} tag={seg.tag} />
                ) : (
                  <Fragment key={i}>{seg.text}</Fragment>
                ),
              )}
            </p>
          </div>

          {/* 태그 요약 바 */}
          {allTags.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag, i) => (
                  <CompetencyBadge key={i} tag={tag} />
                ))}
              </div>
            </div>
          )}

          {/* 구간별 상세 — 내용 요약 포함 */}
          {sections.length > 0 && (
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
  const colors = getHighlight(tag);
  const itemLabel = getItemLabel(tag.competencyItem);
  const evalInfo = EVAL_LABELS[tag.evaluation] ?? EVAL_LABELS.positive;

  return (
    <span className="relative inline">
      <span
        className={cn(
          "cursor-help rounded-sm px-0.5 decoration-2 underline decoration-dotted",
          colors.mark,
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {text}
      </span>
      {showTooltip && (
        <span className="absolute bottom-full left-0 z-10 mb-1 w-72 rounded-md border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <CompetencyBadge tag={tag} compact />
            <span className="text-[var(--text-tertiary)]">{evalInfo.label}</span>
          </span>
          <span className="mt-1.5 block text-xs text-[var(--text-secondary)]">
            {tag.reasoning}
          </span>
        </span>
      )}
    </span>
  );
}

// ─── 구간 상세 — 구절 요약 + 태그 ──────────────

function SectionDetails({ sections }: { sections: AnalyzedSection[] }) {
  return (
    <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">구간 분석</p>
      <div className="flex flex-col gap-2">
        {sections.map((sec, i) => (
          <div key={i} className="rounded-md border border-gray-100 p-2 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-[var(--text-primary)]">{sec.sectionType}</span>
              {sec.needsReview && (
                <span className="rounded bg-yellow-100 px-1 py-0.5 text-[9px] text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  확인 要
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {sec.tags.map((tag, j) => {
                const colors = getHighlight(tag);
                const evalInfo = EVAL_LABELS[tag.evaluation] ?? EVAL_LABELS.positive;
                return (
                  <div key={j} className="flex items-start gap-2 text-xs">
                    <CompetencyBadge tag={tag} compact />
                    <span className="flex-1 text-[var(--text-secondary)] line-clamp-1" title={tag.highlight}>
                      "{tag.highlight.length > 60 ? tag.highlight.slice(0, 60) + "..." : tag.highlight}"
                    </span>
                    <span className={cn("shrink-0 text-[9px]", evalInfo.dot === "🟢" ? "text-green-600" : evalInfo.dot === "🔴" ? "text-red-600" : "text-yellow-600")}>
                      {evalInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
