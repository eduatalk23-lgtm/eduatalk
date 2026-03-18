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
import { HelpCircle } from "lucide-react";

type Props = {
  scores: CompetencyScore[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
};

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const AREAS: CompetencyArea[] = ["academic", "career", "community"];

function findScore(scores: CompetencyScore[], code: string): CompetencyScore | undefined {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly");
}

export function CompetencyScoreGrid({ scores, studentId, tenantId, schoolYear }: Props) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: {
      area: CompetencyArea;
      item: CompetencyItemCode;
      grade: CompetencyGrade;
      notes?: string;
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
                  onSave={(grade, notes) =>
                    mutation.mutate({ area, item: item.code, grade, notes })
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
  onSave,
  isSaving,
}: {
  item: (typeof COMPETENCY_ITEMS)[0];
  score: CompetencyScore | undefined;
  onSave: (grade: CompetencyGrade, notes?: string) => void;
  isSaving: boolean;
}) {
  const [grade, setGrade] = useState<CompetencyGrade | "">(
    (score?.grade_value as CompetencyGrade) ?? "",
  );
  const [notes, setNotes] = useState(score?.notes ?? "");
  const [showRubric, setShowRubric] = useState(false);
  const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];

  const handleGradeChange = useCallback(
    (newGrade: CompetencyGrade) => {
      setGrade(newGrade);
      onSave(newGrade, notes || undefined);
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

      {/* 등급 선택 */}
      <select
        value={grade}
        onChange={(e) => handleGradeChange(e.target.value as CompetencyGrade)}
        disabled={isSaving}
        className={cn(
          "w-16 shrink-0 rounded-md border px-2 py-1 text-center text-sm",
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
