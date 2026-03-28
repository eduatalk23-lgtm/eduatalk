"use client";

// ============================================
// 세특 역량 분석 뷰 (v2)
// [역량] 뷰: 영역→항목→근거 문장 그룹핑
// [원문] 뷰: 멀티 태그 하이라이트 + 퍼지 매칭
// ============================================

import { Fragment, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { CompetencyArea, CompetencyItemCode } from "@/lib/domains/student-record";
import type { HighlightTag, AnalyzedSection } from "@/lib/domains/student-record/llm/types";

// ─── 색상 체계 ────────────────────────────────

const AREA_COLORS: Record<CompetencyArea, { mark: string; badge: string; badgeBorder: string; underline: string }> = {
  academic: {
    mark: "bg-blue-100 dark:bg-blue-800/50 text-[var(--text-primary)]",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    badgeBorder: "border-blue-300 dark:border-blue-700",
    underline: "decoration-blue-400",
  },
  career: {
    mark: "bg-purple-100 dark:bg-purple-800/50 text-[var(--text-primary)]",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
    badgeBorder: "border-purple-300 dark:border-purple-700",
    underline: "decoration-purple-400",
  },
  community: {
    mark: "bg-green-100 dark:bg-green-800/50 text-[var(--text-primary)]",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    badgeBorder: "border-green-300 dark:border-green-700",
    underline: "decoration-green-400",
  },
};

const NEGATIVE_MARK = "bg-red-50 dark:bg-red-900/30 text-[var(--text-primary)] decoration-red-400 decoration-wavy";
const NEEDS_REVIEW_MARK = "bg-yellow-100 dark:bg-yellow-800/50 text-[var(--text-primary)] decoration-yellow-500";

export const EVAL_LABELS: Record<string, { label: string; dot: string }> = {
  positive: { label: "긍정", dot: "🟢" },
  negative: { label: "부정", dot: "🔴" },
  needs_review: { label: "확인필요", dot: "🟡" },
};

export function getAreaOfItem(code: CompetencyItemCode): CompetencyArea {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.area ?? "academic";
}

export function getItemLabel(code: CompetencyItemCode): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

export function getMarkClass(tags: HighlightTag[]): string {
  if (tags.some((t) => t.evaluation === "negative")) return NEGATIVE_MARK;
  if (tags.every((t) => t.evaluation === "needs_review")) return NEEDS_REVIEW_MARK;
  const primaryArea = getAreaOfItem(tags[0].competencyItem);
  return AREA_COLORS[primaryArea].mark;
}

// ─── CompetencyBadge (export — 다른 컴포넌트에서도 사용) ──

export function CompetencyBadge({ tag }: { tag: HighlightTag }) {
  const area = getAreaOfItem(tag.competencyItem);
  const colors = AREA_COLORS[area];
  const itemLabel = getItemLabel(tag.competencyItem);
  const areaLabel = COMPETENCY_AREA_LABELS[area];
  const evalInfo = EVAL_LABELS[tag.evaluation] ?? EVAL_LABELS.positive;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
        colors.badge, colors.badgeBorder,
      )}
      title={`${areaLabel} > ${itemLabel} (${evalInfo.label}): ${tag.reasoning}`}
    >
      {evalInfo.dot} {itemLabel}
    </span>
  );
}

// ─── 멀티 태그 하이라이트 엔진 ──────────────────

export type Segment = { text: string; tags: HighlightTag[] };

/** 퍼지 매칭: 공백/구두점 무시하고 원본 인덱스 반환 */
export function fuzzyIndexOf(content: string, highlight: string): { start: number; end: number } | null {
  // 1. 정확 매칭
  const exact = content.indexOf(highlight);
  if (exact !== -1) return { start: exact, end: exact + highlight.length };

  // 2. 정규화 매칭
  const strip = (s: string) => s.replace(/[\s.,;:!?'"()·\-—]/g, "");
  const normContent = strip(content);
  const normHighlight = strip(highlight);
  if (normHighlight.length < 5) return null;
  const normIdx = normContent.indexOf(normHighlight);
  if (normIdx === -1) return null;

  // 3. 정규화 인덱스 → 원본 인덱스 역매핑
  let origStart = -1;
  let normCursor = 0;
  for (let i = 0; i < content.length; i++) {
    if (strip(content[i]).length > 0) {
      if (normCursor === normIdx && origStart === -1) origStart = i;
      if (normCursor === normIdx + normHighlight.length) return { start: origStart, end: i };
      normCursor++;
    }
  }
  if (origStart !== -1) return { start: origStart, end: content.length };
  return null;
}

/** 겹침 허용 멀티 태그 세그먼트 생성 */
export function buildSegments(content: string, tags: HighlightTag[]): Segment[] {
  if (tags.length === 0) return [{ text: content, tags: [] }];

  type Match = { start: number; end: number; tag: HighlightTag };
  const matches: Match[] = [];

  for (const tag of tags) {
    const result = fuzzyIndexOf(content, tag.highlight);
    if (result) matches.push({ ...result, tag });
  }

  if (matches.length === 0) return [{ text: content, tags: [] }];

  // 이벤트 포인트 수집 (모든 start/end)
  const pointSet = new Set<number>([0, content.length]);
  for (const m of matches) {
    pointSet.add(m.start);
    pointSet.add(m.end);
  }
  const points = [...pointSet].sort((a, b) => a - b);

  // 구간별 활성 태그 계산
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segStart === segEnd) continue;
    const activeTags = matches
      .filter((m) => m.start <= segStart && segEnd <= m.end)
      .map((m) => m.tag);
    segments.push({ text: content.slice(segStart, segEnd), tags: activeTags });
  }

  return segments;
}

// ─── 역량 그룹핑 ────────────────────────────────

export type CompetencyGroup = {
  area: CompetencyArea;
  areaLabel: string;
  items: {
    code: CompetencyItemCode;
    label: string;
    tags: HighlightTag[];
  }[];
  totalCount: number;
};

export function groupTagsByCompetency(sections: AnalyzedSection[]): CompetencyGroup[] {
  const allTags = sections.flatMap((s) => s.tags);
  const itemMap = new Map<CompetencyItemCode, HighlightTag[]>();

  for (const tag of allTags) {
    const existing = itemMap.get(tag.competencyItem) ?? [];
    existing.push(tag);
    itemMap.set(tag.competencyItem, existing);
  }

  // COMPETENCY_ITEMS 순서 유지, 태그가 있는 항목만
  const areas: CompetencyArea[] = ["academic", "career", "community"];
  const groups: CompetencyGroup[] = [];

  for (const area of areas) {
    const areaItems = COMPETENCY_ITEMS.filter((i) => i.area === area);
    const items: CompetencyGroup["items"] = [];
    let totalCount = 0;

    for (const item of areaItems) {
      const tags = itemMap.get(item.code);
      if (!tags || tags.length === 0) continue;
      // 정렬: negative → needs_review → positive
      const evalOrder = { negative: 0, needs_review: 1, positive: 2 };
      tags.sort((a, b) => (evalOrder[a.evaluation as keyof typeof evalOrder] ?? 2) - (evalOrder[b.evaluation as keyof typeof evalOrder] ?? 2));
      items.push({ code: item.code, label: item.label, tags });
      totalCount += tags.length;
    }

    if (items.length > 0) {
      groups.push({ area, areaLabel: COMPETENCY_AREA_LABELS[area], items, totalCount });
    }
  }

  return groups;
}

/** 크로스 레퍼런스 매핑: highlight 텍스트 → 항목 코드 Set */
function buildCrossRefMap(sections: AnalyzedSection[]): Map<string, Set<CompetencyItemCode>> {
  const map = new Map<string, Set<CompetencyItemCode>>();
  for (const sec of sections) {
    for (const tag of sec.tags) {
      const key = tag.highlight;
      const set = map.get(key) ?? new Set();
      set.add(tag.competencyItem);
      map.set(key, set);
    }
  }
  return map;
}

// ─── 메인 컴포넌트 ────────────────────────────

type Props = {
  content: string;
  sections: AnalyzedSection[];
  label: string;
  defaultExpanded?: boolean;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
};

export function HighlightedSetekView({ content, sections, label, defaultExpanded = false, onReanalyze, isReanalyzing }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [viewMode, setViewMode] = useState<"competency" | "original">("competency");
  const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false);

  const allTags = useMemo(() => sections.flatMap((s) => s.tags), [sections]);
  const hasNeedsReview = sections.some((s) => s.needsReview);

  // 영역별 카운트
  const areaCounts = useMemo(() => {
    const counts: Record<CompetencyArea, number> = { academic: 0, career: 0, community: 0 };
    for (const tag of allTags) counts[getAreaOfItem(tag.competencyItem)]++;
    return counts;
  }, [allTags]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 헤더 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
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
        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          {expanded && allTags.length > 0 && (
            <div className="flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-600" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setViewMode("competency")}
                className={cn(
                  "px-2.5 py-1 text-[10px] leading-none transition-colors",
                  viewMode === "competency"
                    ? "bg-gray-800 text-white font-medium dark:bg-gray-200 dark:text-gray-900"
                    : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                )}
              >
                역량
              </button>
              <button
                type="button"
                onClick={() => setViewMode("original")}
                className={cn(
                  "border-l border-gray-200 px-2.5 py-1 text-[10px] leading-none transition-colors dark:border-gray-600",
                  viewMode === "original"
                    ? "bg-gray-800 text-white font-medium dark:bg-gray-200 dark:text-gray-900"
                    : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                )}
              >
                원문
              </button>
            </div>
          )}
          {onReanalyze && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowReanalyzeConfirm(true); }}
                disabled={isReanalyzing}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                title="재분석"
              >
                {isReanalyzing ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-blue-300 border-t-blue-600" />
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                )}
                재분석
              </button>
              {showReanalyzeConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReanalyzeConfirm(false)}>
                  <div className="mx-4 w-full max-w-xs rounded-xl bg-white p-4 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
                    <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">재분석 확인</h3>
                    <p className="mb-4 text-xs text-[var(--text-secondary)]">
                      <span className="font-medium">{label}</span>의 역량 분석을 다시 실행합니다. 기존 AI 분석 결과가 새로운 결과로 대체됩니다.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowReanalyzeConfirm(false)}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => { setShowReanalyzeConfirm(false); onReanalyze(); }}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        재분석
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <span className="text-xs text-[var(--text-tertiary)]">{expanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {viewMode === "competency" ? (
            <CompetencyView sections={sections} areaCounts={areaCounts} />
          ) : (
            <OriginalView content={content} allTags={allTags} areaCounts={areaCounts} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── [역량] 뷰 — 영역→항목→근거 문장 ─────────

function CompetencyView({ sections, areaCounts }: { sections: AnalyzedSection[]; areaCounts: Record<CompetencyArea, number> }) {
  const groups = useMemo(() => groupTagsByCompetency(sections), [sections]);
  const crossRefMap = useMemo(() => buildCrossRefMap(sections), [sections]);

  if (groups.length === 0) {
    return <p className="px-3 py-4 text-sm text-[var(--text-tertiary)]">분석된 역량 태그가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {groups.map((group) => (
        <div key={group.area}>
          {/* 영역 헤더 */}
          <div className="mb-2 flex items-center gap-2">
            <span className={cn(
              "text-xs font-semibold",
              group.area === "academic" && "text-blue-700 dark:text-blue-400",
              group.area === "career" && "text-purple-700 dark:text-purple-400",
              group.area === "community" && "text-green-700 dark:text-green-400",
            )}>
              {group.areaLabel} ({group.totalCount})
            </span>
            <span className={cn(
              "flex-1 border-t",
              group.area === "academic" && "border-blue-200 dark:border-blue-800",
              group.area === "career" && "border-purple-200 dark:border-purple-800",
              group.area === "community" && "border-green-200 dark:border-green-800",
            )} />
          </div>

          {/* 항목별 */}
          <div className="flex flex-col gap-2 ml-1">
            {group.items.map((item) => (
              <div key={item.code}>
                <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  {item.label}
                  <span className="ml-1 text-[var(--text-tertiary)] font-normal">×{item.tags.length}</span>
                </div>
                <div className="flex flex-col gap-0.5 ml-2">
                  {item.tags.map((tag, j) => {
                    const evalInfo = EVAL_LABELS[tag.evaluation] ?? EVAL_LABELS.positive;
                    // 크로스 레퍼런스
                    const crossItems = crossRefMap.get(tag.highlight);
                    const otherItems = crossItems
                      ? [...crossItems].filter((c) => c !== item.code).map((c) => getItemLabel(c))
                      : [];

                    return (
                      <div key={j} className="flex items-start gap-1.5 text-[11px] group">
                        <span className={cn(
                          "shrink-0 mt-0.5 rounded px-1 py-px text-[8px] font-medium",
                          tag.evaluation === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/30",
                          tag.evaluation === "negative" && "bg-red-100 text-red-600 dark:bg-red-900/30",
                          tag.evaluation === "needs_review" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                        )}>
                          {evalInfo.dot}
                        </span>
                        <span className="flex-1 text-[var(--text-secondary)] leading-relaxed">
                          &ldquo;{tag.highlight.length > 80 ? tag.highlight.slice(0, 80) + "..." : tag.highlight}&rdquo;
                          {otherItems.length > 0 && (
                            <span className="ml-1 text-[9px] text-[var(--text-quaternary)]">
                              ↗{otherItems.join("·")}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── [원문] 뷰 — 멀티 태그 하이라이트 ─────────

function OriginalView({ content, allTags, areaCounts }: { content: string; allTags: HighlightTag[]; areaCounts: Record<CompetencyArea, number> }) {
  const segments = useMemo(() => buildSegments(content, allTags), [content, allTags]);

  // 커버리지 계산
  const highlightedChars = useMemo(() => {
    return segments.reduce((sum, seg) => sum + (seg.tags.length > 0 ? seg.text.length : 0), 0);
  }, [segments]);
  const coverage = content.length > 0 ? Math.round((highlightedChars / content.length) * 100) : 0;

  return (
    <div className="px-3 py-3">
      {/* 원문 하이라이트 */}
      <p className="text-sm leading-relaxed text-[var(--text-primary)]">
        {segments.map((seg, i) =>
          seg.tags.length > 0 ? (
            <MultiTagSpan key={i} text={seg.text} tags={seg.tags} />
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          ),
        )}
      </p>

      {/* 영역별 카운트 + 커버리지 */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
        {areaCounts.academic > 0 && <span className="text-blue-600 dark:text-blue-400">학업 {areaCounts.academic}</span>}
        {areaCounts.career > 0 && <span className="text-purple-600 dark:text-purple-400">진로 {areaCounts.career}</span>}
        {areaCounts.community > 0 && <span className="text-green-600 dark:text-green-400">공동체 {areaCounts.community}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          커버리지 {coverage}%
          <span className="inline-block h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
            <span
              className="block h-full rounded-full bg-blue-400 dark:bg-blue-500 transition-all"
              style={{ width: `${Math.min(coverage, 100)}%` }}
            />
          </span>
        </span>
      </div>
    </div>
  );
}

// ─── 멀티 태그 하이라이트 스팬 ──────────────────

export function MultiTagSpan({ text, tags }: { text: string; tags: HighlightTag[] }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleEnter = (e: React.MouseEvent) => {
    clearTimeout(hideTimer.current);
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setShowTooltip(true);
  };

  const handleLeave = () => {
    hideTimer.current = setTimeout(() => setShowTooltip(false), 150);
  };

  const markClass = getMarkClass(tags);
  const hasMultiArea = new Set(tags.map((t) => getAreaOfItem(t.competencyItem))).size > 1;

  // 뷰포트 경계 체크
  const below = tooltipPos ? tooltipPos.y < 150 : false;
  const right = tooltipPos ? tooltipPos.x > window.innerWidth - 320 : false;

  return (
    <span
      className="relative inline"
      ref={containerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <span
        className={cn(
          "cursor-help rounded-sm px-0.5 decoration-2 underline",
          markClass,
          hasMultiArea ? "decoration-double" : "decoration-dotted",
        )}
      >
        {text}
      </span>
      {showTooltip && tooltipPos && (
        <span
          className="fixed z-[9999] w-72 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          style={{
            top: below ? tooltipPos.y + 12 : undefined,
            bottom: below ? undefined : window.innerHeight - tooltipPos.y + 12,
            left: right ? undefined : tooltipPos.x,
            right: right ? window.innerWidth - tooltipPos.x : undefined,
          }}
          onMouseEnter={() => clearTimeout(hideTimer.current)}
          onMouseLeave={handleLeave}
        >
          {tags.map((tag, i) => {
            const evalInfo = EVAL_LABELS[tag.evaluation] ?? EVAL_LABELS.positive;
            return (
              <span key={i} className={cn("flex flex-col", i > 0 && "mt-2 border-t border-gray-100 pt-2 dark:border-gray-700")}>
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <CompetencyBadge tag={tag} />
                  <span className="text-[var(--text-tertiary)]">{evalInfo.label}</span>
                </span>
                <span className="mt-1 text-xs text-[var(--text-secondary)] select-text">
                  {tag.reasoning}
                </span>
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}
