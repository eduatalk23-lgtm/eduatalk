"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InternalScoreWithRelations, MockScoreWithRelations } from "@/lib/types/scoreAnalysis";
import type { SubjectGroup } from "@/lib/data/subjects";
import {
  adminDeleteInternalScore,
  adminDeleteMockScore,
  updateInternalScore,
  updateMockScoreAction,
} from "@/lib/domains/score/actions/core";
import {
  computeScoreAnalysis,
  determineSubjectCategory,
  determineGradeSystem,
} from "@/lib/domains/score/computation";
import ScoreConfidenceChart from "@/components/score/ScoreConfidenceChart";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import { InternalScoreTable } from "./scoreList/InternalScoreTable";
import { MockScoreTable } from "./scoreList/MockScoreTable";
import { cn } from "@/lib/cn";

type ScoreType = "internal" | "mock";

/** 교과 조합별 평균등급 계산용 조합 정의 */
const SUBJECT_COMBINATIONS: Array<{ label: string; groups: string[] | null }> = [
  { label: "전과목", groups: null },
  { label: "국영수사과", groups: ["국어", "영어", "수학", "사회", "과학"] },
  { label: "국영수", groups: ["국어", "영어", "수학"] },
  { label: "국영수과", groups: ["국어", "영어", "수학", "과학"] },
  { label: "국영수사", groups: ["국어", "영어", "수학", "사회"] },
  { label: "국영과", groups: ["국어", "영어", "과학"] },
  { label: "국영사", groups: ["국어", "영어", "사회"] },
  { label: "영수사", groups: ["영어", "수학", "사회"] },
  { label: "영수과", groups: ["영어", "수학", "과학"] },
];

/** 학점 가중 평균등급 계산 (term-first: 학기별 먼저 → 학기 수 나눔) */
function computeTermFirstGPA(
  scores: InternalScoreWithRelations[],
  gradeField: "rank_grade" | "converted_grade_9" | "adjusted_grade" = "rank_grade"
): number | null {
  const termGroups: Record<string, { gradeCredit: number; credit: number }> = {};
  for (const s of scores) {
    const gradeValue = s[gradeField];
    if (gradeValue == null || s.credit_hours == null) continue;
    const key = `${s.grade}-${s.semester}`;
    if (!termGroups[key]) termGroups[key] = { gradeCredit: 0, credit: 0 };
    termGroups[key].gradeCredit += gradeValue * s.credit_hours;
    termGroups[key].credit += s.credit_hours;
  }
  const termGpas = Object.values(termGroups)
    .filter((t) => t.credit > 0)
    .map((t) => t.gradeCredit / t.credit);
  if (termGpas.length === 0) return null;
  return termGpas.reduce((sum, g) => sum + g, 0) / termGpas.length;
}

/** 특정 학기의 학점 가중 평균등급 계산 */
function computeSingleSemesterGPA(
  scores: InternalScoreWithRelations[],
  targetGrade: number,
  targetSemester: number,
  gradeField: "rank_grade" | "converted_grade_9" | "adjusted_grade" = "rank_grade"
): number | null {
  let totalGradeCredit = 0;
  let totalCredit = 0;
  for (const s of scores) {
    if (s.grade !== targetGrade || s.semester !== targetSemester) continue;
    const gradeValue = s[gradeField];
    if (gradeValue == null || s.credit_hours == null) continue;
    totalGradeCredit += gradeValue * s.credit_hours;
    totalCredit += s.credit_hours;
  }
  if (totalCredit === 0) return null;
  return totalGradeCredit / totalCredit;
}

type AdminScoreListClientProps = {
  studentId: string;
  tenantId: string;
  curriculumYear: number | null;
  subjectGroups: SubjectGroup[];
  internalScores: InternalScoreWithRelations[];
  mockScores: MockScoreWithRelations[];
  onRefresh?: () => void;
};

export default function AdminScoreListClient({
  studentId,
  tenantId,
  curriculumYear,
  subjectGroups,
  internalScores,
  mockScores,
  onRefresh,
}: AdminScoreListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const refreshData = useCallback(() => {
    if (onRefresh) onRefresh();
    else router.refresh();
  }, [onRefresh, router]);

  // --- State ---
  const [scoreType, setScoreType] = useState<ScoreType>("internal");
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [semesterFilter, setSemesterFilter] = useState<number | "all">("all");
  const [subjectGroupFilter, setSubjectGroupFilter] = useState<string | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingScore, setEditingScore] = useState<InternalScoreWithRelations | MockScoreWithRelations | null>(null);

  const gradeSystem = determineGradeSystem(curriculumYear);

  // --- Filtered Data ---
  const filteredInternal = useMemo(() => {
    let result = internalScores;
    if (gradeFilter !== "all") result = result.filter((s) => s.grade === gradeFilter);
    if (semesterFilter !== "all") result = result.filter((s) => s.semester === semesterFilter);
    if (subjectGroupFilter !== "all") result = result.filter((s) => s.subject_group_id === subjectGroupFilter);
    return result;
  }, [internalScores, gradeFilter, semesterFilter, subjectGroupFilter]);

  const filteredMock = useMemo(() => {
    let result = mockScores;
    if (gradeFilter !== "all") result = result.filter((s) => s.grade === gradeFilter);
    if (subjectGroupFilter !== "all") result = result.filter((s) => s.subject_group_id === subjectGroupFilter);
    return result;
  }, [mockScores, gradeFilter, subjectGroupFilter]);

  const currentScores = scoreType === "internal" ? filteredInternal : filteredMock;

  // --- Summary Stats ---
  const summary = useMemo(() => {
    if (scoreType === "internal") {
      const scores = filteredInternal;
      const totalSubjects = scores.length;
      const avgGrade = computeTermFirstGPA(scores, "rank_grade");
      const avgGrade9 = gradeSystem === 5 ? computeTermFirstGPA(scores, "converted_grade_9") : null;
      const avgAdjusted = computeTermFirstGPA(scores, "adjusted_grade");

      const rawScoresWithValues = scores.filter((s) => s.raw_score != null);
      const avgRawScore =
        rawScoresWithValues.length > 0
          ? rawScoresWithValues.reduce((sum, s) => sum + (s.raw_score ?? 0), 0) / rawScoresWithValues.length
          : null;
      const totalCredits = scores.reduce((sum, s) => sum + (s.credit_hours ?? 0), 0);
      return { totalSubjects, avgGrade, avgGrade9, avgAdjusted, avgRawScore, totalCredits };
    } else {
      const scores = filteredMock;
      const totalSubjects = scores.length;
      const gradesWithValues = scores.filter((s) => s.grade_score != null);
      const avgGrade =
        gradesWithValues.length > 0
          ? gradesWithValues.reduce((sum, s) => sum + (s.grade_score ?? 0), 0) / gradesWithValues.length
          : null;
      const rawScoresWithValues = scores.filter((s) => s.raw_score != null);
      const avgRawScore =
        rawScoresWithValues.length > 0
          ? rawScoresWithValues.reduce((sum, s) => sum + (s.raw_score ?? 0), 0) / rawScoresWithValues.length
          : null;
      return { totalSubjects, avgGrade, avgGrade9: null as number | null, avgAdjusted: null as number | null, avgRawScore, totalCredits: null };
    }
  }, [scoreType, filteredInternal, filteredMock, gradeSystem]);

  // --- Computed Preview (for internal editing) ---
  const computedPreview = useMemo(() => {
    if (!editingScore || scoreType !== "internal") return null;
    const s = editingScore as InternalScoreWithRelations;
    const isAchievementOnly = s.rank_grade === null && s.std_dev === null;
    return computeScoreAnalysis({
      rawScore: s.raw_score ?? null,
      avgScore: s.avg_score ?? null,
      stdDev: s.std_dev ?? null,
      rankGrade: s.rank_grade ?? null,
      achievementLevel: s.achievement_level ?? null,
      ratioA: s.achievement_ratio_a ?? null,
      ratioB: s.achievement_ratio_b ?? null,
      ratioC: s.achievement_ratio_c ?? null,
      ratioD: s.achievement_ratio_d ?? null,
      ratioE: s.achievement_ratio_e ?? null,
      totalStudents: s.total_students ?? null,
      classRank: s.class_rank ?? null,
      subjectCategory: determineSubjectCategory(
        isAchievementOnly,
        s.rank_grade ?? null,
        s.std_dev ?? null
      ),
      gradeSystem: determineGradeSystem(curriculumYear),
    });
  }, [editingScore, scoreType, curriculumYear]);

  // --- Handlers ---
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    const ids = currentScores.map((s) => s.id);
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }, [currentScores]);

  const handleRowClick = useCallback(
    (score: InternalScoreWithRelations | MockScoreWithRelations) => {
      setEditingScore((prev: InternalScoreWithRelations | MockScoreWithRelations | null) => (prev?.id === score.id ? null : score));
    },
    []
  );

  const handleDelete = useCallback(
    async (scoreId: string) => {
      if (!confirm("이 성적을 삭제하시겠습니까?")) return;
      startTransition(async () => {
        const result =
          scoreType === "internal"
            ? await adminDeleteInternalScore(scoreId, studentId, tenantId)
            : await adminDeleteMockScore(scoreId, studentId, tenantId);
        if (result.success) {
          setEditingScore(null);
          refreshData();
        } else {
          alert(result.error || "삭제에 실패했습니다.");
        }
      });
    },
    [scoreType, studentId, tenantId, refreshData]
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개의 성적을 삭제하시겠습니까?`)) return;
    startTransition(async () => {
      const deleteFn = scoreType === "internal" ? adminDeleteInternalScore : adminDeleteMockScore;
      for (const id of selectedIds) {
        await deleteFn(id, studentId, tenantId);
      }
      setSelectedIds(new Set());
      setEditingScore(null);
      refreshData();
    });
  }, [selectedIds, scoreType, studentId, tenantId, refreshData]);

  const handleCSVDownload = useCallback(() => {
    const BOM = "\uFEFF";
    let csvContent: string;
    const is5Grade = gradeSystem === 5;

    if (scoreType === "internal") {
      const percentileHeader = is5Grade ? "추정백분위" : "백분위";
      const gradeHeader = is5Grade ? "9등급환산(추정)" : "변환등급";
      const headers = ["학년", "학기", "교과군", "과목명", "과목유형", "이수단위", "원점수", "과목평균", "표준편차", "석차등급", "성취도", percentileHeader, gradeHeader];
      const rows = filteredInternal.map((s) => [
        s.grade,
        s.semester,
        s.subject_group?.name ?? "",
        s.subject?.name ?? "",
        s.subject_type?.name ?? "",
        s.credit_hours,
        s.raw_score ?? "",
        s.avg_score ?? "",
        s.std_dev ?? "",
        s.rank_grade ?? "",
        s.achievement_level ?? "",
        s.estimated_percentile != null ? (s.estimated_percentile * 100).toFixed(1) : "",
        s.converted_grade_9 ?? "",
      ]);
      csvContent = BOM + [headers, ...rows].map((r) => r.join(",")).join("\n");
    } else {
      const headers = ["시험명", "시험일자", "학년", "교과군", "과목명", "원점수", "표준점수", "백분위", "등급"];
      const rows = filteredMock.map((s) => [
        s.exam_title,
        s.exam_date,
        s.grade,
        s.subject_group?.name ?? "",
        s.subject?.name ?? "",
        s.raw_score ?? "",
        s.standard_score ?? "",
        s.percentile ?? "",
        s.grade_score ?? "",
      ]);
      csvContent = BOM + [headers, ...rows].map((r) => r.join(",")).join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `성적_${scoreType === "internal" ? "내신" : "모의고사"}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [scoreType, filteredInternal, filteredMock, gradeSystem]);

  const handleSaveInternal = useCallback(
    async (score: InternalScoreWithRelations) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.set("tenant_id", tenantId);
        if (score.raw_score != null) formData.set("raw_score", String(score.raw_score));
        if (score.avg_score != null) formData.set("avg_score", String(score.avg_score));
        if (score.std_dev != null) formData.set("std_dev", String(score.std_dev));
        if (score.rank_grade != null) formData.set("rank_grade", String(score.rank_grade));
        if (score.credit_hours != null) formData.set("credit_hours", String(score.credit_hours));
        if (score.achievement_level != null) formData.set("achievement_level", score.achievement_level);
        if (score.total_students != null) formData.set("total_students", String(score.total_students));
        if (score.class_rank != null) formData.set("class_rank", String(score.class_rank));
        if (score.achievement_ratio_a != null) formData.set("achievement_ratio_a", String(score.achievement_ratio_a));
        if (score.achievement_ratio_b != null) formData.set("achievement_ratio_b", String(score.achievement_ratio_b));
        if (score.achievement_ratio_c != null) formData.set("achievement_ratio_c", String(score.achievement_ratio_c));
        if (score.achievement_ratio_d != null) formData.set("achievement_ratio_d", String(score.achievement_ratio_d));
        if (score.achievement_ratio_e != null) formData.set("achievement_ratio_e", String(score.achievement_ratio_e));

        const result = await updateInternalScore(score.id, formData);
        if (result.success) {
          setEditingScore(null);
          refreshData();
        } else {
          alert(result.error || "저장에 실패했습니다.");
        }
      });
    },
    [tenantId, refreshData]
  );

  const handleSaveMock = useCallback(
    async (score: MockScoreWithRelations) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.set("id", score.id);
        formData.set("student_id", studentId);
        if (score.raw_score != null) formData.set("raw_score", String(score.raw_score));
        if (score.standard_score != null) formData.set("standard_score", String(score.standard_score));
        if (score.percentile != null) formData.set("percentile", String(score.percentile));
        if (score.grade_score != null) formData.set("grade_score", String(score.grade_score));

        const result = await updateMockScoreAction(formData);
        if (result.success) {
          setEditingScore(null);
          refreshData();
        } else {
          alert(result.error || "저장에 실패했습니다.");
        }
      });
    },
    [studentId, refreshData]
  );

  // Available grades
  const availableGrades = useMemo(() => {
    const grades = new Set<number>();
    internalScores.forEach((s) => grades.add(s.grade));
    mockScores.forEach((s) => grades.add(s.grade));
    return Array.from(grades).sort();
  }, [internalScores, mockScores]);

  return (
    <div className="flex flex-col gap-5">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Score Type Toggle */}
        <div className="flex rounded-lg bg-bg-tertiary p-1">
          <button
            onClick={() => { setScoreType("internal"); setSelectedIds(new Set()); setEditingScore(null); }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              scoreType === "internal" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            )}
          >
            내신
          </button>
          <button
            onClick={() => { setScoreType("mock"); setSelectedIds(new Set()); setEditingScore(null); }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              scoreType === "mock" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            )}
          >
            모의고사
          </button>
        </div>

        {/* Grade Filter */}
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">전체 학년</option>
          {availableGrades.map((g) => (
            <option key={g} value={g}>{g}학년</option>
          ))}
        </select>

        {/* Semester Filter (internal only) */}
        {scoreType === "internal" && (
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
          >
            <option value="all">전체 학기</option>
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
        )}

        {/* Subject Group Filter */}
        <select
          value={subjectGroupFilter}
          onChange={(e) => setSubjectGroupFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">전체 교과군</option>
          {subjectGroups.map((sg) => (
            <option key={sg.id} value={sg.id}>{sg.name}</option>
          ))}
        </select>

        {/* CSV Download */}
        <button
          onClick={handleCSVDownload}
          className="ml-auto rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-bg-secondary"
        >
          CSV 다운로드
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="총 과목수" value={summary.totalSubjects} />
        {scoreType === "internal" ? (
          <div className="rounded-lg border border-border bg-white p-4">
            <p className="text-xs text-text-tertiary">평균 등급</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-text-primary">
                {summary.avgGrade != null ? summary.avgGrade.toFixed(2) : "-"}
              </span>
              {gradeSystem === 5 && <span className="text-[10px] text-text-tertiary">(5등급)</span>}
            </div>
            {gradeSystem === 5 && summary.avgGrade9 != null && (
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-indigo-600">
                  {summary.avgGrade9.toFixed(2)}
                </span>
                <span className="text-[10px] text-text-tertiary">(9등급 환산)</span>
              </div>
            )}
            {summary.avgAdjusted != null && (
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-emerald-600">
                  {summary.avgAdjusted.toFixed(2)}
                </span>
                <span className="text-[10px] text-text-tertiary">(조정등급)</span>
              </div>
            )}
          </div>
        ) : (
          <SummaryCard
            label="평균 등급"
            value={summary.avgGrade != null ? summary.avgGrade.toFixed(2) : "-"}
          />
        )}
        <SummaryCard
          label="평균 원점수"
          value={summary.avgRawScore != null ? summary.avgRawScore.toFixed(1) : "-"}
        />
        <SummaryCard
          label={scoreType === "internal" ? "총 이수단위" : "총 과목수"}
          value={scoreType === "internal" ? (summary.totalCredits ?? 0) : summary.totalSubjects}
        />
      </div>

      {/* GPA Trend Chart (internal only) */}
      {scoreType === "internal" && internalScores.length >= 2 && (
        <GpaTrendChart
          scores={internalScores}
          gradeSystem={gradeSystem}
        />
      )}

      {/* Subject Combination Table (internal only) */}
      {scoreType === "internal" && internalScores.length >= 2 && (
        <SubjectCombinationTable
          scores={internalScores}
          gradeSystem={gradeSystem}
        />
      )}

      {/* Table */}
      {scoreType === "internal" ? (
        <InternalScoreTable
          scores={filteredInternal}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          onRowClick={handleRowClick}
          editingId={editingScore?.id ?? null}
          gradeSystem={gradeSystem}
        />
      ) : (
        <MockScoreTable
          scores={filteredMock}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          onRowClick={handleRowClick}
          editingId={editingScore?.id ?? null}
        />
      )}

      {/* Inline Edit Panel */}
      {editingScore && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">성적 편집</h3>
            <button
              onClick={() => setEditingScore(null)}
              className="text-sm text-text-tertiary hover:text-text-primary"
            >
              닫기
            </button>
          </div>

          {scoreType === "internal" ? (
            <InternalEditPanel
              score={editingScore as InternalScoreWithRelations}
              computedPreview={computedPreview}
              gradeSystem={gradeSystem}
              isPending={isPending}
              onSave={handleSaveInternal}
              onDelete={() => handleDelete(editingScore.id)}
              onChange={(updated) => setEditingScore(updated)}
            />
          ) : (
            <MockEditPanel
              score={editingScore as MockScoreWithRelations}
              isPending={isPending}
              onSave={handleSaveMock}
              onDelete={() => handleDelete(editingScore.id)}
              onChange={(updated) => setEditingScore(updated)}
            />
          )}
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3 shadow-lg">
          <span className="text-sm text-text-primary">
            <strong>{selectedIds.size}</strong>개 선택됨
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "삭제 중..." : "일괄 삭제"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Sub Components ---

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function GpaTrendChart({
  scores,
  gradeSystem,
}: {
  scores: InternalScoreWithRelations[];
  gradeSystem: 5 | 9;
}) {
  const { recharts, loading } = useRecharts();

  const chartData = useMemo(() => {
    const semesters = new Set<string>();
    for (const s of scores) semesters.add(`${s.grade}-${s.semester}`);

    const sorted = Array.from(semesters)
      .map((key) => {
        const [grade, semester] = key.split("-").map(Number);
        return { grade, semester };
      })
      .sort((a, b) => (a.grade !== b.grade ? a.grade - b.grade : a.semester - b.semester));

    return sorted.map((sem) => ({
      term: `${sem.grade}-${sem.semester}`,
      rankGrade: computeSingleSemesterGPA(scores, sem.grade, sem.semester, "rank_grade"),
      grade9: gradeSystem === 5
        ? computeSingleSemesterGPA(scores, sem.grade, sem.semester, "converted_grade_9")
        : null,
      adjusted: computeSingleSemesterGPA(scores, sem.grade, sem.semester, "adjusted_grade"),
    }));
  }, [scores, gradeSystem]);

  const overallAvg = useMemo(() => computeTermFirstGPA(scores, "rank_grade"), [scores]);

  if (loading || !recharts) return <ChartLoadingSkeleton height={240} />;
  if (chartData.length < 2) return null;

  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } = recharts;

  const allValues = chartData.flatMap((d) =>
    [d.rankGrade, d.grade9, d.adjusted].filter((v): v is number => v != null)
  );
  if (allValues.length === 0) return null;
  const minVal = Math.floor(Math.min(...allValues) - 0.5);
  const maxVal = Math.ceil(Math.max(...allValues) + 0.5);

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">학기별 평균등급 추이</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="term" tick={{ fontSize: 12 }} />
          <YAxis
            reversed
            domain={[minVal, maxVal]}
            tick={{ fontSize: 12 }}
            label={{ value: "등급", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#9ca3af" } }}
          />
          <Tooltip
            formatter={(value: number) => value?.toFixed(2)}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {overallAvg != null && (
            <ReferenceLine
              y={overallAvg}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              label={{ value: `전체 ${overallAvg.toFixed(2)}`, position: "right", style: { fontSize: 10, fill: "#9ca3af" } }}
            />
          )}
          <Line
            type="monotone"
            dataKey="rankGrade"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            name={gradeSystem === 5 ? "석차등급 (5등급)" : "석차등급"}
            connectNulls
          />
          {gradeSystem === 5 && (
            <Line
              type="monotone"
              dataKey="grade9"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="9등급 환산"
              connectNulls
            />
          )}
          <Line
            type="monotone"
            dataKey="adjusted"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={{ r: 3 }}
            name="조정등급"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SubjectCombinationTable({
  scores,
  gradeSystem,
}: {
  scores: InternalScoreWithRelations[];
  gradeSystem: 5 | 9;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<"rank_grade" | "converted_grade_9">(
    gradeSystem === 5 ? "converted_grade_9" : "rank_grade"
  );

  const availableSemesters = useMemo(() => {
    const semesters = new Set<string>();
    for (const s of scores) {
      semesters.add(`${s.grade}-${s.semester}`);
    }
    return Array.from(semesters)
      .map((key) => {
        const [grade, semester] = key.split("-").map(Number);
        return { grade, semester, label: `${grade}-${semester}` };
      })
      .sort((a, b) => (a.grade !== b.grade ? a.grade - b.grade : a.semester - b.semester));
  }, [scores]);

  const combinationData = useMemo(() => {
    return SUBJECT_COMBINATIONS.map((combo) => {
      const filteredScores = combo.groups
        ? scores.filter((s) => combo.groups!.includes(s.subject_group?.name ?? ""))
        : scores;

      const semesterGpas: Record<string, number | null> = {};
      for (const sem of availableSemesters) {
        semesterGpas[sem.label] = computeSingleSemesterGPA(
          filteredScores, sem.grade, sem.semester, displayMode
        );
      }
      const overallGpa = computeTermFirstGPA(filteredScores, displayMode);

      return {
        label: combo.label,
        semesterGpas,
        overallGpa,
      };
    });
  }, [scores, availableSemesters, displayMode]);

  return (
    <div className="rounded-lg border border-border bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-secondary"
      >
        <span>교과 조합별 평균등급</span>
        <svg
          className={cn("h-4 w-4 text-text-tertiary transition-transform", isOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-3">
          {gradeSystem === 5 && (
            <div className="mb-3 flex rounded-lg bg-bg-tertiary p-0.5 w-fit">
              <button
                onClick={() => setDisplayMode("rank_grade")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  displayMode === "rank_grade" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                )}
              >
                5등급
              </button>
              <button
                onClick={() => setDisplayMode("converted_grade_9")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  displayMode === "converted_grade_9" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                )}
              >
                9등급
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">교과 조합별 학기 GPA 표</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="whitespace-nowrap px-2 py-2 text-xs font-medium text-text-tertiary">조합</th>
                  {availableSemesters.map((sem) => (
                    <th scope="col" key={sem.label} className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium text-text-tertiary">
                      {sem.label}
                    </th>
                  ))}
                  <th scope="col" className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium text-text-primary">전체</th>
                </tr>
              </thead>
              <tbody>
                {combinationData.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-xs font-medium text-text-primary text-left">{row.label}</th>
                    {availableSemesters.map((sem) => (
                      <td key={sem.label} className="whitespace-nowrap px-2 py-1.5 text-center text-xs text-text-secondary">
                        {row.semesterGpas[sem.label]?.toFixed(2) ?? "-"}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-2 py-1.5 text-center text-xs font-semibold text-text-primary">
                      {row.overallGpa?.toFixed(2) ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InternalEditPanel({
  score,
  computedPreview,
  gradeSystem,
  isPending,
  onSave,
  onDelete,
  onChange,
}: {
  score: InternalScoreWithRelations;
  computedPreview: ReturnType<typeof computeScoreAnalysis> | null;
  gradeSystem: 5 | 9;
  isPending: boolean;
  onSave: (s: InternalScoreWithRelations) => void;
  onDelete: () => void;
  onChange: (s: InternalScoreWithRelations) => void;
}) {
  const updateField = (field: string, value: string) => {
    const numValue = value === "" ? null : Number(value);
    onChange({ ...score, [field]: numValue } as InternalScoreWithRelations);
  };

  const is5Grade = gradeSystem === 5;
  const isStdDevInput = score.std_dev != null;
  const isCareer = score.std_dev == null;

  return (
    <div className="space-y-4">
    <div className="grid gap-5 md:grid-cols-2">
      {/* Left: Input Fields */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <EditField label="원점수" value={score.raw_score} onChange={(v) => updateField("raw_score", v)} />
          <EditField label="과목평균" value={score.avg_score} onChange={(v) => updateField("avg_score", v)} />
          <EditField label="표준편차" value={score.std_dev} onChange={(v) => updateField("std_dev", v)} />
          <EditField label="석차등급" value={score.rank_grade} onChange={(v) => updateField("rank_grade", v)} />
          <EditField label="이수단위" value={score.credit_hours} onChange={(v) => updateField("credit_hours", v)} />
          <EditField label="수강자수" value={score.total_students} onChange={(v) => updateField("total_students", v)} />
          <EditField label="석차" value={score.class_rank} onChange={(v) => updateField("class_rank", v)} />
          <div>
            <label className="mb-1 block text-xs text-text-tertiary">성취도</label>
            <select
              value={score.achievement_level ?? ""}
              onChange={(e) => onChange({ ...score, achievement_level: e.target.value || null })}
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <option value="">-</option>
              {["A", "B", "C", "D", "E"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        {/* 성취도비율 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-tertiary">성취도비율 (%)</p>
          <div className="grid grid-cols-5 gap-2">
            {(["a", "b", "c", "d", "e"] as const).map((level) => {
              const fieldKey = `achievement_ratio_${level}` as keyof InternalScoreWithRelations;
              return (
                <EditField
                  key={level}
                  label={level.toUpperCase()}
                  value={score[fieldKey] as number | null | undefined}
                  onChange={(v) => updateField(`achievement_ratio_${level}`, v)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Computed Preview + Actions */}
      <div className="flex flex-col gap-3">
        {computedPreview && (
          <div className="grid grid-cols-2 gap-2 rounded-md bg-white p-3 text-sm">
            <div>
              <span className="text-xs text-text-tertiary">{is5Grade ? "추정 백분위" : "백분위"}</span>
              <p className="font-medium">
                {computedPreview.estimatedPercentile != null
                  ? `상위 ${(computedPreview.estimatedPercentile * 100).toFixed(1)}%`
                  : "-"}
              </p>
            </div>
            {!isStdDevInput && (
              <div>
                <span className="text-xs text-text-tertiary">추정 표준편차</span>
                <p className="font-medium">
                  {computedPreview.estimatedStdDev?.toFixed(2) ?? "-"}
                </p>
              </div>
            )}
            {is5Grade && (
              <div>
                <span className="text-xs text-text-tertiary">9등급 환산 (추정)</span>
                <p className="font-medium">{computedPreview.convertedGrade9 ?? "-"}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-text-tertiary">{isCareer ? "변환석차등급" : "조정등급"}</span>
              <p className="text-[10px] text-text-tertiary">{isCareer ? "성취도비율 기반" : "MIN(Z등급, 석차등급)"}</p>
              <p className="font-medium">{computedPreview.adjustedGrade?.toFixed(2) ?? "-"}</p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onSave(score)}
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            삭제
          </button>
        </div>
      </div>
    </div>

    {/* Full-width: 산출 근거 시각화 */}
    {computedPreview?.meta && computedPreview.estimatedPercentile != null && (
      <ScoreConfidenceChart
        percentile={computedPreview.estimatedPercentile}
        gradeSystem={gradeSystem}
        meta={computedPreview.meta}
        convertedGrade9={computedPreview.convertedGrade9}
        achievement={
          score.achievement_level &&
          score.achievement_ratio_a != null &&
          score.achievement_ratio_b != null &&
          score.achievement_ratio_c != null &&
          score.achievement_ratio_d != null &&
          score.achievement_ratio_e != null &&
          score.raw_score != null
            ? {
                ratioA: score.achievement_ratio_a,
                ratioB: score.achievement_ratio_b,
                ratioC: score.achievement_ratio_c,
                ratioD: score.achievement_ratio_d,
                ratioE: score.achievement_ratio_e,
                level: score.achievement_level,
                rawScore: score.raw_score,
              }
            : null
        }
      />
    )}
    </div>
  );
}

function MockEditPanel({
  score,
  isPending,
  onSave,
  onDelete,
  onChange,
}: {
  score: MockScoreWithRelations;
  isPending: boolean;
  onSave: (s: MockScoreWithRelations) => void;
  onDelete: () => void;
  onChange: (s: MockScoreWithRelations) => void;
}) {
  const updateField = (field: string, value: string) => {
    const numValue = value === "" ? null : Number(value);
    onChange({ ...score, [field]: numValue } as MockScoreWithRelations);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <EditField label="원점수" value={score.raw_score} onChange={(v) => updateField("raw_score", v)} />
        <EditField label="표준점수" value={score.standard_score} onChange={(v) => updateField("standard_score", v)} />
        <EditField label="백분위" value={score.percentile} onChange={(v) => updateField("percentile", v)} />
        <EditField label="등급" value={score.grade_score} onChange={(v) => updateField("grade_score", v)} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(score)}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "저장 중..." : "저장"}
        </button>
        <button
          onClick={onDelete}
          disabled={isPending}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-tertiary">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
      />
    </div>
  );
}
