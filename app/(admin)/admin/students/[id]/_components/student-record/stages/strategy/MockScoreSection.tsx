"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Trash2, Check, X } from "lucide-react";
import { SectionSkeleton } from "../../StudentRecordHelpers";
import { useStudentRecordContext } from "../../StudentRecordContext";
import { mockScoreListQueryOptions } from "@/lib/query-options/mockScores";
import { invalidateMockScoreQueries } from "@/lib/query-options/scoreInvalidation";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import type { ScorePanelData } from "@/lib/domains/score/actions/fetchScoreData";
import type { MockScoreListItem } from "@/lib/domains/score/actions/core";

const MockScoreInput = lazy(() => import("@/app/(student)/scores/input/_components/MockScoreInput"));

type MockScoreRow = MockScoreListItem;

interface MockScoreSectionProps {
  studentId: string;
  tenantId: string;
  showInput: boolean;
  onToggleInput: () => void;
  scorePanelData: ScorePanelData | null | undefined;
  scorePanelLoading: boolean;
  onSaveSuccess: () => void;
}

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
  const { curriculumRevisionId } = useStudentRecordContext();

  // 모의고사 목록 조회 (서버 액션 경유)
  const { data: mockScores, isLoading: listLoading } = useQuery(
    mockScoreListQueryOptions(studentId, tenantId)
  );

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (scoreId: string) => {
      const { adminDeleteMockScore } = await import("@/lib/domains/score/actions/core");
      const result = await adminDeleteMockScore(scoreId, studentId, tenantId);
      if (!result.success) throw new Error(result.error ?? "삭제 실패");
    },
    onSuccess: () => invalidateMockScoreQueries(queryClient, studentId, tenantId),
  });

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);

  const editMutation = useMutation({
    mutationFn: async ({ scoreId, updates }: { scoreId: string; updates: { raw_score?: number | null; standard_score?: number | null; percentile?: number | null; grade_score?: number | null } }) => {
      const { adminUpdateMockScore } = await import("@/lib/domains/score/actions/core");
      const result = await adminUpdateMockScore(scoreId, studentId, tenantId, updates);
      if (!result.success) throw new Error(result.error ?? "수정 실패");
    },
    onSuccess: () => {
      invalidateMockScoreQueries(queryClient, studentId, tenantId);
      setEditingId(null);
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
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-[var(--text-tertiary)] dark:border-border">
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
              editingId={editingId}
              onEdit={setEditingId}
              onSaveEdit={(scoreId, updates) => editMutation.mutate({ scoreId, updates })}
              isEditPending={editMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* 시험별 등급 비교 차트 */}
      {examGroups.length >= 2 && (
        <MockGradeComparisonChart examGroups={examGroups} />
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
                curriculumRevisionId={curriculumRevisionId}
                onSuccess={() => {
                  onSaveSuccess();
                  invalidateMockScoreQueries(queryClient, studentId, tenantId);
                }}
              />
            </div>
          )}
        </Suspense>
      ) : (
        <button
          type="button"
          onClick={onToggleInput}
          className="rounded-lg border border-dashed border-border p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-border"
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
  editingId,
  onEdit,
  onSaveEdit,
  isEditPending,
}: {
  group: { examDate: string; examTitle: string; scores: MockScoreRow[] };
  onDelete: (id: string) => void;
  isDeleting: boolean;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onSaveEdit: (scoreId: string, updates: { raw_score?: number | null; standard_score?: number | null; percentile?: number | null; grade_score?: number | null }) => void;
  isEditPending: boolean;
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
    <div className="rounded-lg border border-border bg-white dark:border-border dark:bg-bg-primary">
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
        <div className="border-t border-border dark:border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-secondary dark:bg-bg-secondary">
              <tr>
                <th className="px-3 py-1.5 font-medium text-[var(--text-secondary)]">교과군</th>
                <th className="px-3 py-1.5 font-medium text-[var(--text-secondary)]">과목</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">원점수</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">표준점수</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">백분위</th>
                <th className="px-3 py-1.5 text-right font-medium text-[var(--text-secondary)]">등급</th>
                <th className="w-16 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {group.scores.map((s) =>
                editingId === s.id ? (
                  <EditableMockScoreRow
                    key={s.id}
                    score={s}
                    onSave={(updates) => onSaveEdit(s.id, updates)}
                    onCancel={() => onEdit(null)}
                    isPending={isEditPending}
                  />
                ) : (
                  <tr
                    key={s.id}
                    className="group cursor-pointer border-t border-gray-50 hover:bg-bg-secondary dark:border-border dark:hover:bg-gray-800/50"
                    onClick={() => onEdit(s.id)}
                  >
                    <td className="px-3 py-1.5 text-[var(--text-secondary)]">{s.subject_group_name ?? "-"}</td>
                    <td className="px-3 py-1.5 text-[var(--text-primary)]">{s.subject_name ?? "-"}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-primary)]">{s.raw_score ?? "-"}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-primary)]">{s.standard_score ?? "-"}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-primary)]">{s.percentile ?? "-"}</td>
                    <td className="px-3 py-1.5 text-right">
                      {s.grade_score != null ? (
                        <span className={cn(
                          "inline-flex rounded-full px-1.5 py-0.5 text-3xs font-medium",
                          s.grade_score <= 2 ? "bg-blue-100 text-blue-700" : s.grade_score <= 4 ? "bg-green-100 text-green-700" : "bg-bg-tertiary text-text-secondary",
                        )}>
                          {s.grade_score}등급
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                        disabled={isDeleting}
                        className="rounded p-0.5 text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 모의고사 인라인 편집 행 ─────────────────────

function EditableMockScoreRow({
  score,
  onSave,
  onCancel,
  isPending,
}: {
  score: MockScoreRow;
  onSave: (updates: { raw_score?: number | null; standard_score?: number | null; percentile?: number | null; grade_score?: number | null }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [rawScore, setRawScore] = useState(score.raw_score?.toString() ?? "");
  const [standardScore, setStandardScore] = useState(score.standard_score?.toString() ?? "");
  const [percentile, setPercentile] = useState(score.percentile?.toString() ?? "");
  const [gradeScore, setGradeScore] = useState(score.grade_score?.toString() ?? "");

  const handleSave = () => {
    onSave({
      raw_score: rawScore ? Number(rawScore) : null,
      standard_score: standardScore ? Number(standardScore) : null,
      percentile: percentile ? Number(percentile) : null,
      grade_score: gradeScore ? Number(gradeScore) : null,
    });
  };

  const inputCls = "w-full rounded border border-indigo-300 bg-indigo-50/30 px-1 py-0.5 text-right text-xs dark:border-indigo-700 dark:bg-indigo-950/20";

  return (
    <tr className="border-t border-gray-50 bg-indigo-50/50 dark:border-border dark:bg-indigo-950/10">
      <td className="px-3 py-1.5 text-[var(--text-secondary)]">{score.subject_group_name ?? "-"}</td>
      <td className="px-3 py-1.5 text-[var(--text-primary)]">{score.subject_name ?? "-"}</td>
      <td className="px-3 py-1.5"><input type="number" value={rawScore} onChange={(e) => setRawScore(e.target.value)} className={inputCls} /></td>
      <td className="px-3 py-1.5"><input type="number" value={standardScore} onChange={(e) => setStandardScore(e.target.value)} className={inputCls} /></td>
      <td className="px-3 py-1.5"><input type="number" value={percentile} onChange={(e) => setPercentile(e.target.value)} min={0} max={100} className={inputCls} /></td>
      <td className="px-3 py-1.5"><input type="number" value={gradeScore} onChange={(e) => setGradeScore(e.target.value)} min={1} max={9} className={inputCls} /></td>
      <td className="px-2 py-1.5">
        <div className="flex gap-1">
          <button type="button" onClick={handleSave} disabled={isPending} className="rounded bg-indigo-600 p-0.5 text-white hover:bg-indigo-700 disabled:opacity-50">
            <Check className="h-3 w-3" />
          </button>
          <button type="button" onClick={onCancel} className="rounded bg-bg-tertiary p-0.5 text-text-secondary hover:bg-gray-300 dark:bg-bg-tertiary dark:text-text-disabled">
            <X className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── 시험별 등급 비교 차트 ─────────────────────

const GRADE_BAR_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function MockGradeComparisonChart({
  examGroups,
}: {
  examGroups: Array<{ examDate: string; examTitle: string; scores: MockScoreRow[] }>;
}) {
  const { recharts, loading } = useRecharts();

  const chartData = useMemo(() => {
    // 주요 교과군만 추출
    const mainGroups = ["국어", "수학", "영어"];
    return examGroups.map((g) => {
      const row: Record<string, unknown> = {
        name: g.examTitle || g.examDate,
      };
      for (const s of g.scores) {
        if (s.subject_group_name && mainGroups.includes(s.subject_group_name) && s.grade_score != null) {
          row[s.subject_group_name] = s.grade_score;
        }
      }
      // 탐구 평균
      const inquiryScores = g.scores.filter(
        (s) => (s.subject_group_name === "사회" || s.subject_group_name === "과학") && s.grade_score != null,
      );
      if (inquiryScores.length > 0) {
        row["탐구"] = Math.round(inquiryScores.reduce((sum, s) => sum + (s.grade_score ?? 0), 0) / inquiryScores.length * 10) / 10;
      }
      return row;
    });
  }, [examGroups]);

  if (loading || !recharts || chartData.length < 2) return null;

  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } = recharts;
  const subjects = ["국어", "수학", "영어", "탐구"];

  return (
    <div className="rounded-lg border border-border bg-white p-3 dark:border-border dark:bg-bg-primary">
      <span className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">시험별 주요 교과 등급 비교</span>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 9]} reversed tick={{ fontSize: 11 }} width={25} />
            <Tooltip formatter={(value: number, name: string) => [`${value}등급`, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {subjects.map((subj, i) => (
              <Bar key={subj} dataKey={subj} fill={GRADE_BAR_COLORS[i]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
