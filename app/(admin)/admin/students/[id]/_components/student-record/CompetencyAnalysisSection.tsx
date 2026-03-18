"use client";

// ============================================
// 역량 분석 통합 섹션
// Phase 6.1 — 종합 등급(상단) + 세특별 하이라이트(중단) + 태그 요약(하단)
// ============================================

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { analyzeSetekWithHighlight } from "@/lib/domains/student-record/llm/actions/analyzeWithHighlight";
import { upsertCompetencyScoreAction, addActivityTagAction } from "@/lib/domains/student-record/actions/diagnosis";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { CompetencyScore, ActivityTag, CompetencyArea, CompetencyGrade } from "@/lib/domains/student-record";
import type { HighlightAnalysisResult } from "@/lib/domains/student-record/llm/types";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { HighlightedSetekView, CompetencyBadge } from "./HighlightedSetekView";
import { Sparkles } from "lucide-react";

type RecordForHighlight = {
  id: string;
  type: "setek" | "personal_setek" | "changche" | "haengteuk";
  label: string;
  content: string;
  subjectName?: string;
  grade?: number;
};

type Props = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  records: RecordForHighlight[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
};

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const AREAS: CompetencyArea[] = ["academic", "career", "community"];

function findScore(scores: CompetencyScore[], code: string): string {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly")?.grade_value ?? "";
}

// 태그 통계
function countTagsByItem(tags: ActivityTag[]) {
  const map = new Map<string, { positive: number; negative: number; needs_review: number }>();
  for (const tag of tags) {
    const key = tag.competency_item;
    const entry = map.get(key) ?? { positive: 0, negative: 0, needs_review: 0 };
    if (tag.evaluation === "positive") entry.positive++;
    else if (tag.evaluation === "negative") entry.negative++;
    else entry.needs_review++;
    map.set(key, entry);
  }
  return map;
}

export function CompetencyAnalysisSection({
  competencyScores,
  activityTags,
  records,
  studentId,
  tenantId,
  schoolYear,
}: Props) {
  const queryClient = useQueryClient();
  const [highlightResults, setHighlightResults] = useState<Map<string, HighlightAnalysisResult>>(new Map());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tagStats = countTagsByItem(activityTags);

  const gradeMutation = useMutation({
    mutationFn: async (input: { area: CompetencyArea; item: string; grade: CompetencyGrade }) => {
      const result = await upsertCompetencyScoreAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        scope: "yearly",
        competency_area: input.area,
        competency_item: input.item,
        grade_value: input.grade,
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear) }),
  });

  // 개별 레코드 AI 분석
  async function analyzeRecord(rec: RecordForHighlight) {
    setAnalyzingId(rec.id);
    setError("");
    const result = await analyzeSetekWithHighlight({
      content: rec.content,
      recordType: rec.type,
      subjectName: rec.subjectName,
      grade: rec.grade,
    });
    if (result.success) {
      setHighlightResults((prev) => new Map(prev).set(rec.id, result.data));
    } else {
      setError(result.error);
    }
    setAnalyzingId(null);
  }

  // 전체 레코드 일괄 분석
  const batchMutation = useMutation({
    mutationFn: async () => {
      const results = new Map<string, HighlightAnalysisResult>();
      for (const rec of records) {
        if (rec.content.trim().length < 20) continue;
        const result = await analyzeSetekWithHighlight({
          content: rec.content,
          recordType: rec.type,
          subjectName: rec.subjectName,
          grade: rec.grade,
        });
        if (result.success) {
          results.set(rec.id, result.data);
        }
      }
      return results;
    },
    onSuccess: (results) => setHighlightResults(results),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ─── AI 분석 버튼 ──────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => batchMutation.mutate()}
          disabled={batchMutation.isPending || records.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Sparkles size={14} />
          {batchMutation.isPending ? "분석 중..." : "AI 역량 종합 분석"}
        </button>
        <span className="text-xs text-[var(--text-tertiary)]">
          {records.length}건 레코드 기반
        </span>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {/* ─── 종합 등급 그리드 (컴팩트) ──────── */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">종합 등급</h4>
        <div className="flex flex-col gap-3">
          {AREAS.map((area) => {
            const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
            return (
              <div key={area} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium text-[var(--text-secondary)]">
                  {COMPETENCY_AREA_LABELS[area]}
                </span>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => {
                    const currentGrade = findScore(competencyScores, item.code);
                    const stats = tagStats.get(item.code);
                    return (
                      <div key={item.code} className="flex items-center gap-1">
                        <span className="text-xs text-[var(--text-tertiary)]">{item.label}</span>
                        <select
                          value={currentGrade}
                          onChange={(e) =>
                            gradeMutation.mutate({ area, item: item.code, grade: e.target.value as CompetencyGrade })
                          }
                          className={cn(
                            "w-14 rounded border px-1 py-0.5 text-center text-xs",
                            "border-gray-300 bg-[var(--background)] dark:border-gray-600",
                            !currentGrade && "text-[var(--text-tertiary)]",
                          )}
                        >
                          <option value="">-</option>
                          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        {stats && (
                          <span className="text-[9px] text-[var(--text-tertiary)]">
                            {stats.positive > 0 && `+${stats.positive}`}
                            {stats.needs_review > 0 && ` ?${stats.needs_review}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 세특별 하이라이트 뷰 ──────────── */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">활동별 역량 분석</h4>
        <div className="flex flex-col gap-2">
          {records.map((rec) => {
            const result = highlightResults.get(rec.id);
            const isAnalyzing = analyzingId === rec.id;

            if (result) {
              return (
                <HighlightedSetekView
                  key={rec.id}
                  content={rec.content}
                  sections={result.sections}
                  label={rec.label}
                  defaultExpanded={true}
                />
              );
            }

            return (
              <div key={rec.id} className="rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-[var(--text-primary)]">{rec.label}</span>
                  <button
                    onClick={() => analyzeRecord(rec)}
                    disabled={isAnalyzing || rec.content.trim().length < 20}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    {isAnalyzing ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-blue-300 border-t-blue-600" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    분석
                  </button>
                </div>
                <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{rec.content.slice(0, 150)}...</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
