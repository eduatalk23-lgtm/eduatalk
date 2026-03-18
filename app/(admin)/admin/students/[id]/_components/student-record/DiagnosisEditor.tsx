"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  upsertDiagnosisAction,
  confirmDiagnosisAction,
} from "@/lib/domains/student-record/actions/diagnosis";
import { MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record";
import type { Diagnosis, CompetencyGrade } from "@/lib/domains/student-record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";

type Props = {
  diagnosis: Diagnosis | null;
  studentId: string;
  tenantId: string;
  schoolYear: number;
};

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const STRENGTHS = ["strong", "moderate", "weak"] as const;
const STRENGTH_LABELS: Record<string, string> = { strong: "강함", moderate: "보통", weak: "약함" };
const MAJOR_KEYS = Object.keys(MAJOR_RECOMMENDED_COURSES);

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  ai: { label: "AI 생성", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  manual: { label: "수동 입력", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "초안", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmed: { label: "확정", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

export function DiagnosisEditor({ diagnosis, studentId, tenantId, schoolYear }: Props) {
  const queryClient = useQueryClient();

  const [overallGrade, setOverallGrade] = useState<CompetencyGrade>(
    (diagnosis?.overall_grade as CompetencyGrade) ?? "B",
  );
  const [direction, setDirection] = useState(diagnosis?.record_direction ?? "");
  const [dirStrength, setDirStrength] = useState(diagnosis?.direction_strength ?? "moderate");
  const [strengths, setStrengths] = useState<string[]>(diagnosis?.strengths ?? []);
  const [weaknesses, setWeaknesses] = useState<string[]>(diagnosis?.weaknesses ?? []);
  const [majors, setMajors] = useState<string[]>(diagnosis?.recommended_majors ?? []);
  const [notes, setNotes] = useState(diagnosis?.strategy_notes ?? "");
  const [newStrength, setNewStrength] = useState("");
  const [newWeakness, setNewWeakness] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const result = await upsertDiagnosisAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        overall_grade: overallGrade,
        record_direction: direction || null,
        direction_strength: dirStrength,
        strengths,
        weaknesses,
        recommended_majors: majors,
        strategy_notes: notes || null,
        source: "manual",
        status: "draft",
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear) }),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!diagnosis?.id) throw new Error("저장 먼저 필요");
      const result = await confirmDiagnosisAction(diagnosis.id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear) }),
  });

  const addTag = useCallback((list: string[], setList: (v: string[]) => void, val: string, setVal: (v: string) => void) => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setVal("");
  }, []);

  const removeTag = useCallback((list: string[], setList: (v: string[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  }, []);

  const src = SOURCE_BADGE[diagnosis?.source ?? "manual"] ?? SOURCE_BADGE.manual;
  const sts = STATUS_BADGE[diagnosis?.status ?? "draft"] ?? STATUS_BADGE.draft;

  return (
    <div className="flex flex-col gap-4">
      {/* 상태 배지 */}
      {diagnosis && (
        <div className="flex items-center gap-2">
          <span className={cn("rounded px-2 py-0.5 text-xs font-medium", src.cls)}>{src.label}</span>
          <span className={cn("rounded px-2 py-0.5 text-xs font-medium", sts.cls)}>{sts.label}</span>
          {diagnosis.evaluated_at && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {new Date(diagnosis.evaluated_at).toLocaleDateString("ko-KR")}
            </span>
          )}
        </div>
      )}

      {/* 종합 등급 */}
      <div className="flex items-center gap-3">
        <label className="w-24 shrink-0 text-sm font-medium text-[var(--text-primary)]">종합 등급</label>
        <select
          value={overallGrade}
          onChange={(e) => setOverallGrade(e.target.value as CompetencyGrade)}
          className="rounded-md border border-gray-300 bg-[var(--background)] px-3 py-1.5 text-sm dark:border-gray-600"
        >
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* 기록 방향 */}
      <div className="flex items-center gap-3">
        <label className="w-24 shrink-0 text-sm font-medium text-[var(--text-primary)]">기록 방향</label>
        <input
          type="text"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          placeholder="예: 생명과학 심화 탐구 중심"
          maxLength={50}
          className="flex-1 rounded-md border border-gray-300 bg-[var(--background)] px-3 py-1.5 text-sm dark:border-gray-600"
        />
      </div>

      {/* 방향 강도 */}
      <div className="flex items-center gap-3">
        <label className="w-24 shrink-0 text-sm font-medium text-[var(--text-primary)]">방향 강도</label>
        <div className="flex gap-1">
          {STRENGTHS.map((s) => (
            <button
              key={s}
              onClick={() => setDirStrength(s)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                dirStrength === s
                  ? "bg-indigo-600 text-white"
                  : "border border-gray-300 text-[var(--text-secondary)] hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800",
              )}
            >
              {STRENGTH_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 강점 */}
      <TagListInput
        label="강점"
        tags={strengths}
        onRemove={(i) => removeTag(strengths, setStrengths, i)}
        inputValue={newStrength}
        onInputChange={setNewStrength}
        onAdd={() => addTag(strengths, setStrengths, newStrength, setNewStrength)}
        placeholder="강점 입력 후 Enter"
      />

      {/* 약점 */}
      <TagListInput
        label="약점"
        tags={weaknesses}
        onRemove={(i) => removeTag(weaknesses, setWeaknesses, i)}
        inputValue={newWeakness}
        onInputChange={setNewWeakness}
        onAdd={() => addTag(weaknesses, setWeaknesses, newWeakness, setNewWeakness)}
        placeholder="약점 입력 후 Enter"
      />

      {/* 추천 전공 */}
      <div className="flex items-start gap-3">
        <label className="w-24 shrink-0 pt-1.5 text-sm font-medium text-[var(--text-primary)]">추천 전공</label>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {MAJOR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setMajors((prev) => prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key])}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                majors.includes(key)
                  ? "bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "border border-gray-200 text-[var(--text-tertiary)] hover:border-gray-400 dark:border-gray-600",
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* 전략 메모 */}
      <div className="flex items-start gap-3">
        <label className="w-24 shrink-0 pt-1.5 text-sm font-medium text-[var(--text-primary)]">전략 메모</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="지원 전략, 보완 사항 등"
          className="flex-1 resize-none rounded-md border border-gray-300 bg-[var(--background)] px-3 py-1.5 text-sm dark:border-gray-600"
        />
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? "저장 중..." : "저장"}
        </button>
        {diagnosis?.id && diagnosis.status !== "confirmed" && (
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            className="rounded-md border border-green-600 px-4 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-900/20"
          >
            확정
          </button>
        )}
        {saveMutation.isError && (
          <span className="text-xs text-red-500">{saveMutation.error.message}</span>
        )}
      </div>
    </div>
  );
}

function TagListInput({
  label, tags, onRemove, inputValue, onInputChange, onAdd, placeholder,
}: {
  label: string;
  tags: string[];
  onRemove: (idx: number) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <label className="w-24 shrink-0 pt-1.5 text-sm font-medium text-[var(--text-primary)]">{label}</label>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
              {tag}
              <button onClick={() => onRemove(i)} className="text-[var(--text-tertiary)] hover:text-red-500">×</button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className="rounded-md border border-gray-300 bg-[var(--background)] px-3 py-1 text-xs dark:border-gray-600"
        />
      </div>
    </div>
  );
}
