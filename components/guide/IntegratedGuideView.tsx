"use client";

/**
 * 통합 가이드 뷰 — outline 구조 안에 prose가 인라인으로 포함
 *
 * - "전체 보기": outline 대주제별로 하위 항목 + 이론 설명이 함께 표시
 * - "목차만 보기": outline만 (축약 모드)
 * - outline이 없으면 prose만 렌더링 (레거시 호환)
 */

import { useState, useMemo } from "react";
import { ChevronRight, BookOpen, Lightbulb, ListTree, BookOpenText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import type { OutlineItem, ContentSection } from "@/lib/domains/guide/types";
import { normalizeResources, hasResourceUrl } from "@/lib/domains/guide/utils/resource-helpers";
import DOMPurify from "dompurify";

type ViewMode = "integrated" | "outline_only";

interface IntegratedGuideViewProps {
  /** 같은 key의 복수 섹션 (탐구이론 1, 2, 3...) */
  sections: ContentSection[];
  /** 섹션 정의 라벨 (예: "탐구 이론") */
  defLabel: string;
  /** 인쇄 모드 (토글 숨김) */
  printMode?: boolean;
}

export function IntegratedGuideView({
  sections,
  defLabel,
  printMode,
}: IntegratedGuideViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("integrated");

  const hasAnyOutline = sections.some(
    (s) => s.outline && s.outline.length > 0,
  );

  // outline이 없으면 기존 산문 렌더링
  if (!hasAnyOutline) {
    return (
      <div className="space-y-3">
        {sections.map((sec, i) => (
          <ProseFallback key={i} section={sec} defLabel={defLabel} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 토글 */}
      {!printMode && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex rounded-lg border border-secondary-200 dark:border-secondary-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("integrated")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "integrated"
                  ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                  : "text-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-800",
              )}
            >
              <BookOpenText className="w-3.5 h-3.5" />
              전체 보기
            </button>
            <button
              type="button"
              onClick={() => setViewMode("outline_only")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-secondary-200 dark:border-secondary-700",
                viewMode === "outline_only"
                  ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                  : "text-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-800",
              )}
            >
              <ListTree className="w-3.5 h-3.5" />
              목차만 보기
            </button>
          </div>
        </div>
      )}

      {/* 섹션별 렌더링 — depth=0 연속 번호 */}
      <div className="space-y-4">
        {sections.map((sec, i) => {
          // 이전 섹션들의 depth=0 합산 → 연속 번호
          const prevDepth0Count = sections
            .slice(0, i)
            .reduce(
              (sum, s) =>
                sum + (s.outline?.filter((o) => o.depth === 0).length ?? 0),
              0,
            );
          return (
            <IntegratedSection
              key={i}
              section={sec}
              defLabel={defLabel}
              viewMode={viewMode}
              depth0StartIndex={prevDepth0Count}
            />
          );
        })}
      </div>
    </div>
  );
}

/** 하나의 탐구이론 섹션 — outline 구조 안에 prose 인라인 */
function IntegratedSection({
  section,
  defLabel,
  viewMode,
  depth0StartIndex = 0,
}: {
  section: ContentSection;
  defLabel: string;
  viewMode: ViewMode;
  /** 이전 섹션들의 depth=0 누적 수 — 연속 번호용 */
  depth0StartIndex?: number;
}) {
  const outline = section.outline ?? [];
  const hasOutline = outline.length > 0;

  // hooks는 조건 분기 전에 항상 호출 (React Rules of Hooks)
  const groups = useMemo(
    () => (hasOutline ? groupByDepth0(outline) : []),
    [outline, hasOutline],
  );
  const proseChunks = useMemo(
    () =>
      hasOutline
        ? splitProseByGroups(section.content, groups.length)
        : [],
    [section.content, groups.length, hasOutline],
  );

  // outline이 없으면 prose fallback
  if (!hasOutline) {
    return <ProseFallback section={section} defLabel={defLabel} />;
  }

  return (
    <div className="rounded-lg border border-secondary-200 dark:border-secondary-700 overflow-hidden">
      {/* 섹션 제목 */}
      {section.label && section.label !== defLabel && (
        <div className="px-4 py-2 bg-secondary-50 dark:bg-secondary-800/50 border-b border-secondary-200 dark:border-secondary-700">
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            {section.label}
          </p>
        </div>
      )}

      <div className="p-4 space-y-4">
        {groups.map((group, gi) => (
          <div key={gi}>
            {/* depth=0 대주제 — 연속 번호 */}
            <div className="flex items-start gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                  {depth0StartIndex + gi + 1}
                </span>
              </div>
              <h4 className="text-sm font-bold text-[var(--text-heading)] leading-relaxed">
                {group.heading.text}
              </h4>
            </div>

            {/* depth=0 tip/resources */}
            <TipAndResources item={group.heading} indent={0} />

            {/* depth=1,2 하위 항목 */}
            {group.children.length > 0 && (
              <div className="ml-4 sm:ml-8 space-y-0.5 mb-3">
                {group.children.map((child, ci) => (
                  <div key={ci}>
                    <div
                      className={cn(
                        "flex items-start gap-1.5",
                        child.depth === 2 && "pl-3 sm:pl-4",
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "flex-shrink-0 mt-1",
                          child.depth === 1
                            ? "w-3 h-3 text-secondary-500"
                            : "w-2.5 h-2.5 text-secondary-400",
                        )}
                      />
                      <span
                        className={cn(
                          "leading-relaxed",
                          child.depth === 1
                            ? "text-sm font-medium text-[var(--text-primary)]"
                            : "text-[13px] text-[var(--text-secondary)]",
                        )}
                      >
                        {child.text}
                      </span>
                    </div>
                    <TipAndResources
                      item={child}
                      indent={0}
                      depthClass={child.depth === 2 ? "pl-3 sm:pl-4" : undefined}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* prose 인라인 (전체 보기 모드에서만) */}
            {viewMode === "integrated" && proseChunks[gi] && (
              <div className="ml-4 sm:ml-8 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-blue-200 dark:border-blue-800 p-3 mb-2">
                <ProseContent html={proseChunks[gi]} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** tip + resources 인라인 표시 */
function TipAndResources({
  item,
  indent,
  depthClass,
}: {
  item: OutlineItem;
  indent: number;
  depthClass?: string;
}) {
  if (!item.tip && (!item.resources || item.resources.length === 0))
    return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 mt-0.5 mb-1 ml-4 sm:ml-8",
        depthClass,
      )}
    >
      {item.tip && (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
          <Lightbulb className="w-3 h-3" />
          {item.tip}
        </span>
      )}
      {normalizeResources(item.resources).map((res, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
          <BookOpen className="w-3 h-3 flex-shrink-0" />
          <span>{res.description}</span>
          {hasResourceUrl(res) && (
            <a
              href={res.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-800 dark:hover:text-blue-200"
            >
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </span>
      ))}
    </div>
  );
}

/** prose HTML 또는 plain text 렌더링 */
function ProseContent({ html }: { html: string }) {
  if (!html.trim()) return null;

  if (html.startsWith("<")) {
    return (
      <div
        className="text-[13px] text-[var(--text-primary)] leading-relaxed prose-sm max-w-prose"
        dangerouslySetInnerHTML={{
          __html: typeof window !== "undefined" ? DOMPurify.sanitize(html) : html,
        }}
      />
    );
  }

  return (
    <p className="text-[13px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap max-w-prose">
      {html}
    </p>
  );
}

/** outline이 없을 때 기존 산문 렌더링 */
function ProseFallback({
  section,
  defLabel,
}: {
  section: ContentSection;
  defLabel: string;
}) {
  return (
    <div className="rounded-lg border-l-2 border-blue-300 dark:border-blue-600 bg-secondary-50 dark:bg-secondary-800/30 p-3">
      {section.label && section.label !== defLabel && (
        <p className="text-xs font-semibold text-secondary-500 mb-1.5">
          {section.label}
        </p>
      )}
      <ProseContent html={section.content} />
    </div>
  );
}

// ─── 유틸 ──────────────────────────────────────

interface OutlineGroup {
  heading: OutlineItem;
  children: OutlineItem[];
}

/** outline 배열을 depth=0 기준으로 그룹 분리 */
function groupByDepth0(items: OutlineItem[]): OutlineGroup[] {
  const groups: OutlineGroup[] = [];
  let current: OutlineGroup | null = null;

  for (const item of items) {
    if (item.depth === 0) {
      current = { heading: item, children: [] };
      groups.push(current);
    } else if (current) {
      current.children.push(item);
    }
  }

  // depth=0이 하나도 없으면 전체를 하나의 그룹으로
  if (groups.length === 0 && items.length > 0) {
    groups.push({
      heading: { depth: 0, text: items[0].text },
      children: items.slice(1),
    });
  }

  return groups;
}

/**
 * prose HTML을 대주제 수만큼 균등 분할
 * - <p> 또는 \n\n 기준으로 단락 분리
 * - 대주제 수에 맞게 균등 배분
 */
function splitProseByGroups(content: string, groupCount: number): string[] {
  if (groupCount <= 1) return [content];

  // HTML인 경우 <p>...</p> 단위로 분할
  let paragraphs: string[];
  if (content.startsWith("<")) {
    paragraphs = content
      .split(/<\/p>\s*<p/i)
      .map((p, i, arr) => {
        let result = p;
        if (i > 0) result = "<p" + result;
        if (i < arr.length - 1) result = result + "</p>";
        return result;
      })
      .filter((p) => p.replace(/<[^>]*>/g, "").trim().length > 0);
  } else {
    paragraphs = content
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);
  }

  if (paragraphs.length <= groupCount) {
    // 단락 수 ≤ 그룹 수: 1:1 매칭, 남는 그룹은 빈 문자열
    const result: string[] = [];
    for (let i = 0; i < groupCount; i++) {
      result.push(paragraphs[i] ?? "");
    }
    return result;
  }

  // 단락을 균등 배분
  const perGroup = Math.ceil(paragraphs.length / groupCount);
  const result: string[] = [];
  for (let i = 0; i < groupCount; i++) {
    const start = i * perGroup;
    const chunk = paragraphs.slice(start, start + perGroup);
    result.push(chunk.join(content.startsWith("<") ? "" : "\n\n"));
  }
  return result;
}
