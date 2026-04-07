"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { findDiagnosisSnapshotsAction } from "@/lib/domains/student-record/actions/diagnosis";
import { Row, TagList } from "./DiagnosisSharedComponents";

const GRADE_LABELS: Record<string, string> = { "A+": "A+", "A-": "A-", "B+": "B+", B: "B", "B-": "B-", C: "C" };
const STRENGTH_LABELS: Record<string, string> = { strong: "강함", moderate: "보통", weak: "약함" };

export function DiagnosisHistoryPanel({ studentId, schoolYear }: { studentId: string; schoolYear: number }) {
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["diagnosis-snapshots", studentId, schoolYear],
    queryFn: () => findDiagnosisSnapshotsAction(studentId, schoolYear, "ai"),
    staleTime: 60_000,
  });

  const [selected, setSelected] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary)] p-4">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (!snapshots?.length) {
    return (
      <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-3 py-2 text-center text-xs text-[var(--text-tertiary)]">
        변경 이력이 없습니다 (다음 AI 재생성 시 기록됩니다)
      </div>
    );
  }

  const selectedSnap = selected !== null ? snapshots[selected]?.snapshot : null;

  return (
    <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary)] p-3">
      <p className="mb-2 text-[10px] font-semibold text-[var(--text-primary)]">AI 진단 변경 이력 ({snapshots.length}건)</p>

      {/* 타임라인 */}
      <div className="flex flex-wrap gap-1.5">
        {snapshots.map((snap, i) => {
          const d = new Date(snap.created_at);
          const grade = (snap.snapshot as Record<string, unknown>).overall_grade as string;
          return (
            <button
              key={snap.id}
              type="button"
              onClick={() => setSelected(selected === i ? null : i)}
              className={cn(
                "rounded-md border px-2 py-1 text-[10px] transition",
                selected === i
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-gray-400",
              )}
            >
              {d.getMonth() + 1}/{d.getDate()} {d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}
              {grade && ` (${GRADE_LABELS[grade] ?? grade})`}
            </button>
          );
        })}
      </div>

      {/* 선택된 스냅샷 상세 */}
      {selectedSnap && (
        <div className="mt-2 space-y-1 rounded border border-gray-200 bg-white p-2 text-[10px] dark:border-gray-700 dark:bg-gray-900">
          <Row label="등급" value={String((selectedSnap as Record<string, unknown>).overall_grade ?? "-")} />
          <Row label="방향" value={String((selectedSnap as Record<string, unknown>).record_direction ?? "-")} />
          <Row label="강도" value={STRENGTH_LABELS[String((selectedSnap as Record<string, unknown>).direction_strength ?? "moderate")] ?? "-"} />
          <TagList label="강점" items={((selectedSnap as Record<string, unknown>).strengths as string[]) ?? []} />
          <TagList label="약점" items={((selectedSnap as Record<string, unknown>).weaknesses as string[]) ?? []} />
          <TagList label="추천전공" items={((selectedSnap as Record<string, unknown>).recommended_majors as string[]) ?? []} />
        </div>
      )}
    </div>
  );
}
