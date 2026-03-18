"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { upsertCompetencyScoreAction } from "@/lib/domains/student-record/actions/diagnosis";
import {
  COMPETENCY_ITEMS,
  COMPETENCY_AREA_LABELS,
  COMPETENCY_RUBRIC_QUESTIONS,
} from "@/lib/domains/student-record";
import type { CompetencyScore, CompetencyArea, CompetencyGrade, CompetencyItemCode } from "@/lib/domains/student-record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { analyzeCompetencyFromRecords } from "@/lib/domains/student-record/llm/actions/analyzeCompetency";
import type { CompetencyAnalysisItem } from "@/lib/domains/student-record/llm/actions/analyzeCompetency";
import { HelpCircle, Sparkles } from "lucide-react";

/** AI 분석에 전달할 레코드 */
export type RecordForAnalysis = {
  type: string;
  label: string;
  content: string;
};

type Props = {
  scores: CompetencyScore[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
  /** AI 종합 분석용 레코드 (세특/창체/행특) */
  records?: RecordForAnalysis[];
};

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const AREAS: CompetencyArea[] = ["academic", "career", "community"];

function findScore(scores: CompetencyScore[], code: string): CompetencyScore | undefined {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly");
}

export function CompetencyScoreGrid({ scores, studentId, tenantId, schoolYear, records = [] }: Props) {
  const queryClient = useQueryClient();
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, CompetencyAnalysisItem>>(new Map());
  const [aiSummary, setAiSummary] = useState("");
  const [aiError, setAiError] = useState("");

  const aiMutation = useMutation({
    mutationFn: async () => {
      const result = await analyzeCompetencyFromRecords(records);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      const map = new Map<string, CompetencyAnalysisItem>();
      data.items.forEach((item) => map.set(item.competencyItem, item));
      setAiSuggestions(map);
      setAiSummary(data.summary);
      setAiError("");
    },
    onError: (err: Error) => setAiError(err.message),
  });

  const mutation = useMutation({
    mutationFn: async (input: {
      area: CompetencyArea;
      item: CompetencyItemCode;
      grade: CompetencyGrade;
      notes?: string;
      narrative?: string;
    }) => {
      const result = await upsertCompetencyScoreAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        scope: "yearly",
        competency_area: input.area,
        competency_item: input.item,
        grade_value: input.grade,
        notes: input.notes ?? null,
        narrative: input.narrative ?? null,
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear),
      });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* AI 역량 종합 분석 */}
      {records.length > 0 && (
        <div className="flex flex-col gap-2">
          {aiMutation.isPending ? (
            <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs text-blue-600 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-400">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
              생기부 {records.length}건을 종합 분석하고 있습니다...
            </div>
          ) : aiSuggestions.size > 0 ? (
            <div className="rounded-md border border-blue-200 bg-blue-50/30 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  AI 제안 ({aiSuggestions.size}개 항목) — 등급을 클릭하여 반영하세요
                </span>
                <button onClick={() => { setAiSuggestions(new Map()); setAiSummary(""); }} className="text-xs text-[var(--text-tertiary)] underline">닫기</button>
              </div>
              {aiSummary && <p className="mt-1 text-xs text-[var(--text-secondary)]">{aiSummary}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => aiMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
              >
                <Sparkles size={14} />
                AI 역량 종합 분석
              </button>
              <span className="text-xs text-[var(--text-tertiary)]">생기부 {records.length}건 기반</span>
            </div>
          )}
          {aiError && (
            <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-xs dark:border-red-800 dark:bg-red-900/10">
              <span className="text-red-600 dark:text-red-400">{aiError}</span>
              <button onClick={() => { setAiError(""); aiMutation.mutate(); }} className="text-red-700 underline dark:text-red-400">재시도</button>
            </div>
          )}
        </div>
      )}

      {AREAS.map((area) => {
        const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
        return (
          <div key={area}>
            <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
              {COMPETENCY_AREA_LABELS[area]}
            </h4>
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <CompetencyRow
                  key={item.code}
                  item={item}
                  score={findScore(scores, item.code)}
                  aiSuggestion={aiSuggestions.get(item.code)}
                  onSave={(grade, notes, narrative) =>
                    mutation.mutate({ area, item: item.code, grade, notes, narrative })
                  }
                  isSaving={mutation.isPending}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompetencyRow({
  item,
  score,
  aiSuggestion,
  onSave,
  isSaving,
}: {
  item: (typeof COMPETENCY_ITEMS)[0];
  score: CompetencyScore | undefined;
  aiSuggestion?: CompetencyAnalysisItem;
  onSave: (grade: CompetencyGrade, notes?: string, narrative?: string) => void;
  isSaving: boolean;
}) {
  const [grade, setGrade] = useState<CompetencyGrade | "">(
    (score?.grade_value as CompetencyGrade) ?? "",
  );
  const [notes, setNotes] = useState(score?.notes ?? "");
  const [showRubric, setShowRubric] = useState(false);
  const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];

  const handleGradeChange = useCallback(
    (newGrade: CompetencyGrade, narrative?: string) => {
      setGrade(newGrade);
      onSave(newGrade, notes || undefined, narrative);
    },
    [notes, onSave],
  );

  const handleNotesBlur = useCallback(() => {
    if (grade && notes !== (score?.notes ?? "")) {
      onSave(grade as CompetencyGrade, notes || undefined);
    }
  }, [grade, notes, score?.notes, onSave]);

  return (
    <div className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
      {/* 항목명 + 평가대상 */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
          <button
            type="button"
            onClick={() => setShowRubric(!showRubric)}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            title="루브릭 질문 보기"
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">{item.evalTarget}</span>
        {showRubric && (
          <ul className="mt-1 space-y-0.5 rounded bg-gray-50 p-2 text-xs text-[var(--text-secondary)] dark:bg-gray-800/50">
            {questions.map((q, i) => (
              <li key={i}>• {q}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 등급 선택 + AI 제안 */}
      <div className="flex shrink-0 items-center gap-1.5">
        <select
          value={grade}
          onChange={(e) => handleGradeChange(e.target.value as CompetencyGrade)}
          disabled={isSaving}
          className={cn(
            "w-16 rounded-md border px-2 py-1 text-center text-sm",
            "border-gray-300 bg-[var(--background)] text-[var(--text-primary)]",
            "dark:border-gray-600",
            "focus:border-indigo-400 focus:outline-none",
            !grade && "text-[var(--text-tertiary)]",
          )}
        >
          <option value="">-</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {aiSuggestion && (
          <button
            onClick={() => handleGradeChange(aiSuggestion.suggestedGrade, aiSuggestion.narrative)}
            title={`AI 제안: ${aiSuggestion.suggestedGrade} — ${aiSuggestion.reasoning}`}
            className="rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
          >
            AI:{aiSuggestion.suggestedGrade}
          </button>
        )}
      </div>

      {/* 메모 */}
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleNotesBlur}
        placeholder="메모"
        className="w-32 shrink-0 rounded-md border border-gray-300 bg-[var(--background)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] dark:border-gray-600 focus:border-indigo-400 focus:outline-none"
      />
    </div>
  );
}
