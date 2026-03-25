"use client";

// ============================================
// 루브릭별 등급 입력 그리드
// AI 루브릭 등급 표시 + 컨설턴트 등급 입력
// 항목 등급 자동 계산 (수동 오버라이드 가능)
// ============================================

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { COMPETENCY_RUBRIC_QUESTIONS } from "@/lib/domains/student-record/constants";
import { deriveItemGradeFromRubrics } from "@/lib/domains/student-record/rubric-matcher";
import type { CompetencyGrade, CompetencyItemCode, RubricScoreEntry } from "@/lib/domains/student-record/types";

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30",
  "A-": "text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20",
  "B+": "text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30",
  "B": "text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-900/20",
  "B-": "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/20",
  "C": "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/20",
};

interface RubricGradeGridProps {
  itemCode: CompetencyItemCode;
  /** AI가 평가한 루브릭 점수 (없으면 빈 배열) */
  aiRubricScores: RubricScoreEntry[];
  /** 컨설턴트가 입력한 루브릭 점수 (없으면 빈 배열) */
  consultantRubricScores: RubricScoreEntry[];
  /** 컨설턴트 루브릭 등급 변경 시 호출 */
  onConsultantChange: (rubricScores: RubricScoreEntry[], derivedGrade: CompetencyGrade | null) => void;
  disabled?: boolean;
}

export function RubricGradeGrid({
  itemCode,
  aiRubricScores,
  consultantRubricScores,
  onConsultantChange,
  disabled,
}: RubricGradeGridProps) {
  const questions = COMPETENCY_RUBRIC_QUESTIONS[itemCode] ?? [];

  // 컨설턴트 루브릭 등급 로컬 상태
  const [localScores, setLocalScores] = useState<Map<number, { grade: CompetencyGrade; reasoning: string }>>(
    () => {
      const map = new Map<number, { grade: CompetencyGrade; reasoning: string }>();
      for (const rs of consultantRubricScores) {
        map.set(rs.questionIndex, { grade: rs.grade, reasoning: rs.reasoning });
      }
      return map;
    },
  );

  // AI 루브릭 인덱스 맵
  const aiMap = new Map<number, RubricScoreEntry>();
  for (const rs of aiRubricScores) {
    aiMap.set(rs.questionIndex, rs);
  }

  const handleGradeChange = useCallback((questionIndex: number, grade: CompetencyGrade) => {
    setLocalScores((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionIndex);
      next.set(questionIndex, { grade, reasoning: existing?.reasoning ?? "" });

      // 변경된 상태로 부모에 직접 전달 (useEffect 대신)
      const entries: RubricScoreEntry[] = [];
      for (const [qIdx, val] of next) {
        entries.push({ questionIndex: qIdx, grade: val.grade, reasoning: val.reasoning });
      }
      onConsultantChange(entries, deriveItemGradeFromRubrics(entries));

      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onConsultantChange]);

  if (questions.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-3 py-1.5 text-left font-medium text-[var(--text-tertiary)]">루브릭 질문</th>
            <th className="w-16 px-2 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">AI</th>
            <th className="w-20 px-2 py-1.5 text-center font-medium text-orange-600 dark:text-orange-400">컨설턴트</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((question, qIdx) => {
            const aiScore = aiMap.get(qIdx);
            const consultantScore = localScores.get(qIdx);
            const match = aiScore && consultantScore && aiScore.grade === consultantScore.grade;

            return (
              <tr
                key={qIdx}
                className="border-b border-gray-100 last:border-0 dark:border-gray-700/50"
              >
                {/* 질문 */}
                <td className="px-3 py-2">
                  <span className="text-[var(--text-secondary)] leading-relaxed">
                    {question}
                  </span>
                  {/* AI 근거 툴팁 */}
                  {aiScore?.reasoning && (
                    <p className="mt-0.5 text-[9px] text-blue-500/70 line-clamp-1">
                      AI: {aiScore.reasoning}
                    </p>
                  )}
                </td>

                {/* AI 등급 */}
                <td className="px-2 py-2 text-center">
                  {aiScore ? (
                    <span className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      GRADE_COLORS[aiScore.grade],
                    )}>
                      {aiScore.grade}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--text-tertiary)]">-</span>
                  )}
                </td>

                {/* 컨설턴트 등급 드롭다운 */}
                <td className="px-2 py-2 text-center">
                  <select
                    value={consultantScore?.grade ?? ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleGradeChange(qIdx, e.target.value as CompetencyGrade);
                      }
                    }}
                    disabled={disabled}
                    className={cn(
                      "w-16 rounded border px-1 py-1 text-center text-[10px]",
                      "border-gray-300 bg-[var(--background)] dark:border-gray-600",
                      match && "ring-1 ring-green-400",
                      !consultantScore?.grade && "text-[var(--text-tertiary)]",
                    )}
                  >
                    <option value="">-</option>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 자동 계산 결과 표시 */}
      {localScores.size > 0 && (
        <div className="border-t border-gray-200 px-3 py-1.5 text-[10px] text-[var(--text-tertiary)] dark:border-gray-700">
          루브릭 {localScores.size}/{questions.length}개 평가 →
          자동 산출: <span className="font-semibold text-[var(--text-primary)]">
            {deriveItemGradeFromRubrics([...localScores.values()]) ?? "-"}
          </span>
        </div>
      )}
    </div>
  );
}
