"use client";

// ============================================
// 분석 레이어 공용 컴포넌트
// AI / 컨설턴트 / 확정 독립 블록 + 역량 뷰 + 원문 뷰
// SetekEditor, ChangcheEditor, HaengteukEditor 등에서 재사용
// ============================================

import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { buildSegments, getMarkClass, getAreaOfItem, groupTagsByCompetency, EVAL_LABELS, MultiTagSpan } from "../HighlightedSetekView";
import { TextSelectionTagger } from "../TextSelectionTagger";
import type { HighlightTag, AnalyzedSection } from "@/lib/domains/student-record/llm/types";
import type { CompetencyItemCode, CompetencyArea } from "@/lib/domains/student-record";
import { ArrowDownToLine, Trash2 } from "lucide-react";

// ─── 공용 타입 ──

export interface AnalysisTagLike {
  id: string;
  record_type: string;
  record_id: string;
  competency_item: string;
  evaluation: string;
  evidence_summary?: string | null;
  source?: string;
  status?: string;
}

/** 태깅 모드에서 사용하는 레코드 정보 (에디터 무관 공통) */
export interface TaggerRecord {
  id: string;
  content?: string | null;
  imported_content?: string | null;
  semester?: number;
}

export interface TaggerProps {
  studentId: string;
  tenantId: string;
  schoolYear: number;
  records: TaggerRecord[];
  displayName: string;
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
}

export type AnalysisBlockMode = "tagging" | "competency" | "original";

// ─── 역량 라벨 ──

const COMPETENCY_LABELS: Record<string, string> = {
  academic_achievement: "학업성취도", academic_attitude: "학업태도", academic_inquiry: "탐구력",
  career_course_effort: "과목이수노력", career_course_achievement: "과목성취도", career_exploration: "진로탐색",
  community_collaboration: "협업", community_caring: "배려", community_integrity: "성실성", community_leadership: "리더십",
};

const EVAL_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const AREA_SECTION_STYLES: Record<CompetencyArea, { text: string; border: string; bg: string; headerBg: string }> = {
  academic: {
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50/40 dark:bg-blue-950/20",
    headerBg: "bg-blue-50 dark:bg-blue-900/30",
  },
  career: {
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    bg: "bg-purple-50/40 dark:bg-purple-950/20",
    headerBg: "bg-purple-50 dark:bg-purple-900/30",
  },
  community: {
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    bg: "bg-green-50/40 dark:bg-green-950/20",
    headerBg: "bg-green-50 dark:bg-green-900/30",
  },
};

// ─── 유틸리티 ──

/** AnalysisTagLike → HighlightTag 변환 */
export function toHighlightTags(tags: AnalysisTagLike[]): HighlightTag[] {
  return tags
    .filter((t) => t.evidence_summary)
    .map((t) => {
      const quoteMatch = t.evidence_summary?.match(/근거:\s*"(.+?)"/);
      const highlight = quoteMatch?.[1] ?? t.evidence_summary ?? "";
      return {
        competencyItem: t.competency_item as CompetencyItemCode,
        evaluation: (t.evaluation || "needs_review") as HighlightTag["evaluation"],
        highlight,
        reasoning: t.evidence_summary ?? "",
      };
    })
    .filter((t) => t.highlight.length >= 5);
}

/** AnalysisTagLike[] → AnalyzedSection[] */
function toSections(tags: AnalysisTagLike[]): AnalyzedSection[] {
  const hlTags = toHighlightTags(tags);
  if (hlTags.length === 0) return [];
  return [{ sectionType: "전체" as const, tags: hlTags, needsReview: hlTags.some((t) => t.evaluation === "needs_review") }];
}

/** 레코드에서 표시할 텍스트 (content → imported_content fallback) */
function getRecordText(r: TaggerRecord): string {
  return r.content?.trim() || r.imported_content || "";
}

// ─── 역량 그룹 렌더 ──

export function CompactCompetencyView({ tags }: { tags: AnalysisTagLike[] }) {
  const sections = useMemo(() => toSections(tags), [tags]);
  const groups = useMemo(() => groupTagsByCompetency(sections), [sections]);

  if (groups.length === 0) {
    return <p className="py-2 text-sm text-[var(--text-tertiary)]">태그 없음</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const s = AREA_SECTION_STYLES[group.area];
        return (
          <div key={group.area} className={cn("rounded-lg border p-3", s.border, s.bg)}>
            <div className={cn("mb-2 flex items-center gap-2 rounded-md px-2 py-1 -mx-1", s.headerBg)}>
              <span className={cn("text-sm font-semibold", s.text)}>
                {group.areaLabel} ({group.totalCount})
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {group.items.map((item) => (
                <div key={item.code}>
                  <div className="text-sm font-medium text-[var(--text-secondary)] mb-1">
                    {item.label}
                    <span className="ml-1.5 text-[var(--text-tertiary)] font-normal">x{item.tags.length}</span>
                  </div>
                  <div className="flex flex-col gap-1 ml-2">
                    {item.tags.map((tag, j) => {
                      const evalInfo = EVAL_LABELS[tag.evaluation] ?? EVAL_LABELS.positive;
                      return (
                        <div key={j} className="flex items-start gap-1.5 text-sm">
                          <span className={cn(
                            "shrink-0 mt-0.5 rounded px-1 py-px text-[11px] font-medium",
                            tag.evaluation === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/30",
                            tag.evaluation === "negative" && "bg-red-100 text-red-600 dark:bg-red-900/30",
                            tag.evaluation === "needs_review" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                          )}>
                            {evalInfo.dot}
                          </span>
                          <span className="flex-1 text-[var(--text-secondary)] leading-relaxed">
                            &ldquo;{tag.highlight.length > 80 ? tag.highlight.slice(0, 80) + "..." : tag.highlight}&rdquo;
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
      })}
    </div>
  );
}

// ─── 인라인 하이라이트 텍스트 ──

export function HighlightedInlineText({ content, hlTags }: { content: string; hlTags: HighlightTag[] }) {
  const segments = useMemo(() => buildSegments(content, hlTags), [content, hlTags]);

  return (
    <>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
        {segments.map((seg, i) =>
          seg.tags.length > 0 ? (
            <MultiTagSpan key={i} text={seg.text} tags={seg.tags} />
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          ),
        )}
      </p>
      {hlTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-secondary)] pt-2 mt-2">
          {(() => {
            const areaCounts: Record<CompetencyArea, number> = { academic: 0, career: 0, community: 0 };
            for (const t of hlTags) areaCounts[getAreaOfItem(t.competencyItem)]++;
            return (["academic", "career", "community"] as const)
              .filter((a) => areaCounts[a] > 0)
              .map((area) => (
                <span key={area} className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
                  area === "academic" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : area === "career" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
                )}>
                  {area === "academic" ? "학업" : area === "career" ? "진로" : "공동체"} {areaCounts[area]}
                </span>
              ));
          })()}
        </div>
      )}
    </>
  );
}

// ─── 독립 분석 블록 ──

export function AnalysisBlock({
  label,
  tags,
  content,
  mode,
  setMode,
  importAction,
  importLabel,
  isImporting,
  taggerProps,
  onDeleteTag,
  onDeleteAll,
}: {
  label: string;
  tags: AnalysisTagLike[];
  content: string;
  mode: AnalysisBlockMode;
  setMode: (m: AnalysisBlockMode) => void;
  importAction?: () => void;
  importLabel?: string;
  isImporting?: boolean;
  taggerProps?: TaggerProps;
  onDeleteTag?: (tag: AnalysisTagLike) => void;
  onDeleteAll?: () => void;
}) {
  const hlTags = useMemo(() => toHighlightTags(tags), [tags]);

  const hasTagger = !!taggerProps;

  const modes: { key: AnalysisBlockMode; label: string }[] = hasTagger
    ? [{ key: "tagging", label: "태깅" }, { key: "competency", label: "역량" }, { key: "original", label: "원문" }]
    : [{ key: "competency", label: "역량" }, { key: "original", label: "원문" }];

  return (
    <div className="rounded-lg border border-[var(--border-secondary)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-secondary)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
          <span className="text-xs text-[var(--text-tertiary)]">{tags.length}건</span>
        </div>
        <div className="flex items-center gap-2">
          {mode === "tagging" && importAction && (
            <button
              type="button"
              onClick={importAction}
              disabled={isImporting}
              className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              {importLabel}
            </button>
          )}
          {mode === "tagging" && tags.length > 0 && onDeleteAll && (
            <button
              type="button"
              onClick={onDeleteAll}
              className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              전체 삭제
            </button>
          )}
          <div className="flex overflow-hidden rounded border border-[var(--border-secondary)]">
            {modes.map((m, i) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  i > 0 && "border-l border-[var(--border-secondary)]",
                  mode === m.key
                    ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900"
                    : "text-[var(--text-tertiary)] hover:bg-gray-100 dark:hover:bg-gray-700",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="p-3">
        {/* 태깅 모드 */}
        {mode === "tagging" && taggerProps && (
          <div className="flex flex-col gap-3">
            {taggerProps.records.filter((r) => getRecordText(r)).length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[var(--text-tertiary)]">텍스트를 드래그하여 역량 태그를 지정하세요</p>
                {taggerProps.records.filter((r) => getRecordText(r)).map((r) => {
                  const recordText = getRecordText(r);
                  const recordHlTags = hlTags.filter((ht) => {
                    const seg = buildSegments(recordText, [ht]);
                    return seg.some((s) => s.tags.length > 0);
                  });
                  const recordSegments = buildSegments(recordText, recordHlTags);
                  return (
                    <TextSelectionTagger
                      key={r.id}
                      content={recordText}
                      recordType={taggerProps.recordType}
                      recordId={r.id}
                      studentId={taggerProps.studentId}
                      tenantId={taggerProps.tenantId}
                      schoolYear={taggerProps.schoolYear}
                      subjectName={taggerProps.displayName}
                    >
                      <p className="whitespace-pre-wrap rounded bg-[var(--surface-primary)] p-3 text-sm leading-relaxed text-[var(--text-primary)]">
                        {recordSegments.map((seg, i) =>
                          seg.tags.length > 0 ? (
                            <MultiTagSpan key={i} text={seg.text} tags={seg.tags} />
                          ) : (
                            <Fragment key={i}>{seg.text}</Fragment>
                          ),
                        )}
                      </p>
                    </TextSelectionTagger>
                  );
                })}
              </div>
            ) : (
              <p className="py-2 text-sm text-[var(--text-tertiary)]">원문 없음</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-[var(--border-secondary)] pt-3">
                <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1">태그 목록</p>
                {tags.map((tag, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-[var(--border-secondary)] px-3 py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium",
                      EVAL_COLORS[tag.evaluation || "needs_review"],
                    )}>
                      {tag.evaluation === "positive" ? "+" : tag.evaluation === "negative" ? "-" : "?"}
                    </span>
                    <span className="flex-1 truncate text-sm text-[var(--text-secondary)]">
                      {COMPETENCY_LABELS[tag.competency_item || ""] || tag.competency_item}
                      {tag.evidence_summary && (
                        <span className="ml-1.5 text-[var(--text-tertiary)]">
                          — {tag.evidence_summary.slice(0, 50)}
                        </span>
                      )}
                    </span>
                    {onDeleteTag && (
                      <button
                        type="button"
                        onClick={() => onDeleteTag(tag)}
                        className="shrink-0 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 역량 모드 */}
        {mode === "competency" && <CompactCompetencyView tags={tags} />}

        {/* 원문 모드 */}
        {mode === "original" && (
          content ? (
            <HighlightedInlineText content={content} hlTags={hlTags} />
          ) : (
            <p className="py-2 text-sm text-[var(--text-tertiary)]">원문 없음</p>
          )
        )}
      </div>
    </div>
  );
}
