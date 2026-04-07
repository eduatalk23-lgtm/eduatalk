"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Trash2 } from "lucide-react";
import { SectionSkeleton } from "./StudentRecordHelpers";
import type { ScorePanelData } from "@/lib/domains/score/actions/fetchScoreData";

const MockScoreInput = lazy(() => import("@/app/(student)/scores/input/_components/MockScoreInput"));

interface MockScoreSectionProps {
  studentId: string;
  tenantId: string;
  showInput: boolean;
  onToggleInput: () => void;
  scorePanelData: ScorePanelData | null | undefined;
  scorePanelLoading: boolean;
  onSaveSuccess: () => void;
}

type MockScoreRow = {
  id: string;
  exam_date: string | null;
  exam_title: string | null;
  subject_name: string | null;
  subject_group_name: string | null;
  raw_score: number | null;
  standard_score: number | null;
  percentile: number | null;
  grade_score: number | null;
};

export function MockScoreSection({
  studentId,
  tenantId,
  showInput,
  onToggleInput,
  scorePanelData,
  scorePanelLoading,
  onSaveSuccess,
}: MockScoreSectionProps) {
  const queryClient = useQueryClient();

  // 모의고사 목록 조회
  const { data: mockScores, isLoading: listLoading } = useQuery({
    queryKey: ["mockScores", "list", studentId, tenantId],
    queryFn: async () => {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("student_mock_scores")
        .select(`
          id, exam_date, exam_title, raw_score, standard_score, percentile, grade_score,
          subject:subjects ( name, subject_group:subject_groups ( name ) )
        `)
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .order("exam_date", { ascending: false })
        .order("created_at", { ascending: false });

      return (data ?? []).map((row) => {
        const subjectData = row.subject as { name?: string; subject_group?: { name?: string } } | null;
        return {
          id: row.id,
          exam_date: row.exam_date,
          exam_title: row.exam_title,
          subject_name: subjectData?.name ?? null,
          subject_group_name: subjectData?.subject_group?.name ?? null,
          raw_score: row.raw_score,
          standard_score: row.standard_score,
          percentile: row.percentile,
          grade_score: row.grade_score,
        } satisfies MockScoreRow;
      });
    },
    staleTime: 30_000,
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (scoreId: string) => {
      const { adminDeleteMockScore } = await import("@/lib/domains/score/actions/core");
      const result = await adminDeleteMockScore(scoreId, studentId, tenantId);
      if (!result.success) throw new Error(result.error ?? "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mockScores"] });
      queryClient.invalidateQueries({ queryKey: ["scoreTrends"] });
    },
  });

  // 시험별 그룹핑
  const examGroups = useMemo(() => {
    if (!mockScores) return [];
    const groups = new Map<string, { examDate: string; examTitle: string; scores: MockScoreRow[] }>();
    for (const s of mockScores) {
      const key = s.exam_date ?? "unknown";
      if (!groups.has(key)) {
        groups.set(key, { examDate: s.exam_date ?? "", examTitle: s.exam_title ?? "", scores: [] });
      }
      groups.get(key)!.scores.push(s);
    }
    return Array.from(groups.values());
  }, [mockScores]);

  return (
    <div className="flex flex-col gap-4">
      {/* 목록 */}
      {listLoading ? (
        <SectionSkeleton />
      ) : examGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
          등록된 모의고사 성적이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {examGroups.map((group) => (
            <ExamGroupCard
              key={group.examDate}
              group={group}
              onDelete={(id) => {
                if (confirm("이 성적을 삭제하시겠습니까?")) deleteMutation.mutate(id);
              }}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* 입력 토글 */}
      {showInput ? (
        <Suspense fallback={<SectionSkeleton />}>
          {scorePanelLoading || !scorePanelData ? (
            <SectionSkeleton />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <button type="button" onClick={onToggleInput} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                  접기
                </button>
              </div>
              <MockScoreInput
                studentId={studentId}
                tenantId={tenantId}
                subjectGroups={scorePanelData.curriculumOptions?.[0]?.subjectGroups ?? scorePanelData.subjectGroups ?? []}
                onSuccess={() => {
                  onSaveSuccess();
                  queryClient.invalidateQueries({ queryKey: ["mockScores", "list"] });
                }}
              />
            </div>
          )}
        </Suspense>
      ) : (
        <button
          type="button"
          onClick={onToggleInput}
          className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-gray-600"
        >
          + 모의고사 성적 입력
        </button>
      )}
    </div>
  );
}

// ─── 시험 그룹 카드 ─────────────────────────

function ExamGroupCard({
  group,
  onDelete,
  isDeleting,
}: {
  group: { examDate: string; examTitle: string; scores: MockScoreRow[] };
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" }); }
    catch { return d; }
  };

  // 주요 과목 요약
  const summary = group.scores
    .filter((s) => ["국어", "수학", "영어"].includes(s.subject_group_name ?? ""))
    .map((s) => `${s.subject_group_name} ${s.grade_score ?? "-"}등급`)
    .join(" / ");

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{group.examTitle || "시험명 없음"}</span>
          <span className="text-xs text-[var(--text-tertiary)]">{formatDate(group.examDate)}</span>
          <span className="text-xs text-[var(--text-secondary)]">{group.scores.length}과목</span>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">{summary}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-1.5 font-medium text-[var(--text-secondary)]">교과군</th>
                <th className="px-3 py-1.5 font-medium text-[var(--text-secondary)]">과목</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">원점수</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">표준점수</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">백분위</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">등급</th>
                <th className="w-8 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {group.scores.map((s) => (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-1.5 text-[var(--text-secondary)]">{s.subject_group_name ?? "-"}</td>
                  <td className="px-3 py-1.5 text-[var(--text-primary)]">{s.subject_name ?? "-"}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text-primary)]">{s.raw_score ?? "-"}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text-primary)]">{s.standard_score ?? "-"}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text-primary)]">{s.percentile ?? "-"}</td>
                  <td className="px-3 py-1.5 text-right">
                    {s.grade_score != null ? (
                      <span className={cn(
                        "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        s.grade_score <= 2 ? "bg-blue-100 text-blue-700" : s.grade_score <= 4 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
                      )}>
                        {s.grade_score}등급
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => onDelete(s.id)}
                      disabled={isDeleting}
                      className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
