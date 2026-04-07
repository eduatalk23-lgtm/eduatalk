"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { useStudentRecordContext } from "./StudentRecordContext";
import { internalGradesQueryOptions } from "@/lib/query-options/scores";
import { invalidateInternalScoreQueries } from "@/lib/query-options/scoreInvalidation";

import {
  adminDeleteInternalScore,
  adminUpdateInternalScore,
  adminCreateInternalScore,
} from "@/lib/domains/score/actions/core";

// ─── Types ──────────────────────────────────────────

type Score = {
  id: string;
  semester: number;
  grade: number;
  credit_hours: number;
  raw_score: number | null;
  avg_score: number | null;
  std_dev: number | null;
  rank_grade: number | null;
  achievement_level: string | null;
  total_students: number | null;
  achievement_ratio_a: number | null;
  achievement_ratio_b: number | null;
  achievement_ratio_c: number | null;
  achievement_ratio_d: number | null;
  achievement_ratio_e: number | null;
  subject_group: { name: string } | null;
  subject: { name: string } | null;
  subject_type: { name: string; is_achievement_only: boolean } | null;
};

type GradeVariant = "general" | "elective" | "pe_art" | "all";

type RecordGradesDisplayProps = {
  studentId: string;
  tenantId?: string;
  schoolYear: number;
  studentGrade: number;
  subjects?: { id: string; name: string; subject_group?: { name: string } | null }[];
  /** 표시할 성적 영역. "all"이면 전체 (기존 동작). 기본값 "all" */
  variant?: GradeVariant;
};

const B = "border border-gray-400 dark:border-gray-500";

// ─── Main Component ─────────────────────────────────

export function RecordGradesDisplay({ studentId, tenantId, schoolYear, studentGrade, subjects, variant = "all" }: RecordGradesDisplayProps) {
  const queryClient = useQueryClient();
  const { curriculumRevisionId: ctxCurriculumRevisionId } = useStudentRecordContext();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: scores, isLoading } = useQuery(
    internalGradesQueryOptions(studentId, schoolYear, studentGrade)
  );

  const deleteMutation = useMutation({
    mutationFn: async (scoreId: string) => {
      if (!tenantId) throw new Error("테넌트 정보 없음");
      const result = await adminDeleteInternalScore(scoreId, studentId, tenantId);
      if (!result.success) throw new Error(result.error ?? "삭제 실패");
    },
    onSuccess: () => invalidateInternalScoreQueries(queryClient, studentId, schoolYear, tenantId),
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const editMutation = useMutation({
    mutationFn: async ({ scoreId, updates }: { scoreId: string; updates: Partial<Score> }) => {
      if (!tenantId) throw new Error("테넌트 정보 없음");
      const result = await adminUpdateInternalScore(scoreId, studentId, tenantId, {
        raw_score: updates.raw_score ?? null,
        avg_score: updates.avg_score ?? null,
        rank_grade: updates.rank_grade ?? null,
        achievement_level: updates.achievement_level ?? null,
        total_students: updates.total_students ?? null,
        credit_hours: updates.credit_hours ?? 1,
      });
      if (!result.success) throw new Error(result.error ?? "수정 실패");
    },
    onSuccess: () => {
      invalidateInternalScoreQueries(queryClient, studentId, schoolYear, tenantId);
      setEditingId(null);
    },
  });

  const addMutation = useMutation({
    mutationFn: async (input: AddScoreInput) => {
      if (studentGrade < 1) throw new Error("유효하지 않은 학년");
      const result = await adminCreateInternalScore(studentId, input.tenantId, {
        grade: studentGrade,
        semester: input.semester,
        school_year: schoolYear,
        credit_hours: input.creditHours,
        raw_score: input.rawScore || null,
        avg_score: input.avgScore || null,
        achievement_level: input.achievementLevel || null,
        rank_grade: input.rankGrade || null,
        total_students: input.totalStudents || null,
        subject_id: input.subjectId,
        subject_group_id: input.subjectGroupId,
        subject_type_id: input.subjectTypeId,
        curriculum_revision_id: input.curriculumRevisionId,
      });
      if (!result.success) throw new Error(result.error ?? "추가 실패");
    },
    onSuccess: () => {
      invalidateInternalScoreQueries(queryClient, studentId, schoolYear, tenantId);
      setShowAddForm(false);
    },
  });

  const addForm = tenantId && subjects ? (
    showAddForm ? (
      <AddScoreForm
        tenantId={tenantId}
        subjects={subjects}
        curriculumRevisionId={ctxCurriculumRevisionId}
        onSubmit={(input) => addMutation.mutate(input)}
        onCancel={() => setShowAddForm(false)}
        isPending={addMutation.isPending}
        error={addMutation.isError ? addMutation.error.message : undefined}
      />
    ) : (
      <button onClick={() => setShowAddForm(true)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
        + 성적 추가
      </button>
    )
  ) : null;

  // Hook은 early return 전에 호출 (Rules of Hooks)
  const grouped = useMemo(() => classifyScores(scores ?? []), [scores]);
  const onDel = (id: string) => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(id); };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  if (!scores || scores.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <EmptyGradeTable variant={variant === "all" ? "general" : variant} />
        {addForm}
      </div>
    );
  }

  // variant별 필터링
  if (variant === "general") {
    const combined = [...grouped.general, ...grouped.liberal];
    return (
      <div className="flex flex-col gap-4">
        {combined.length === 0 ? <EmptyGradeTable variant="general" /> : (
          <>
            {grouped.general.length > 0 && <GradesTable scores={grouped.general} variant="general" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />}
            {grouped.liberal.length > 0 && <GradesTable scores={grouped.liberal} variant="liberal" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />}
          </>
        )}
        {addForm}
      </div>
    );
  }
  if (variant === "elective") {
    return (
      <div className="flex flex-col gap-4">
        {grouped.elective.length === 0 ? <EmptyGradeTable variant="elective" /> : (
          <GradesTable scores={grouped.elective} variant="elective" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />
        )}
        {addForm}
      </div>
    );
  }
  if (variant === "pe_art") {
    return (
      <div className="flex flex-col gap-4">
        {grouped.pe_art.length === 0 ? <EmptyGradeTable variant="pe_art" /> : (
          <GradesTable scores={grouped.pe_art} variant="pe_art" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />
        )}
        {addForm}
      </div>
    );
  }

  // variant === "all" (기존 동작)
  return (
    <div className="flex flex-col gap-6">
      {grouped.general.length > 0 && (
        <GradesTable scores={grouped.general} variant="general" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />
      )}
      {grouped.elective.length > 0 && (
        <GradesTable scores={grouped.elective} variant="elective" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />
      )}
      {grouped.pe_art.length > 0 && (
        <GradesTable scores={grouped.pe_art} variant="pe_art" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />
      )}
      {grouped.liberal.length > 0 && (
        <GradesTable scores={grouped.liberal} variant="liberal" tenantId={tenantId} onDelete={onDel} editingId={editingId} onEdit={setEditingId} onSaveEdit={(id, upd) => editMutation.mutate({ scoreId: id, updates: upd })} isEditPending={editMutation.isPending} />
      )}

      {addForm}
    </div>
  );
}

// ─── Score Classification ───────────────────────────

function classifyScores(scores: Score[]) {
  const general: Score[] = [];
  const elective: Score[] = [];
  const pe_art: Score[] = [];
  const liberal: Score[] = [];

  const PE_ART_GROUPS = new Set(["체육", "예술"]);
  const ELECTIVE_TYPES = new Set(["진로선택", "진로 선택", "융합선택", "융합 선택"]);
  const LIBERAL_GROUPS = new Set(["교양"]);

  for (const s of scores) {
    const groupName = s.subject_group?.name ?? "";
    const typeName = s.subject_type?.name ?? "";
    const isAchievementOnly = s.subject_type?.is_achievement_only ?? false;
    const isPF = s.achievement_level === "P" || s.achievement_level === "F";

    if (LIBERAL_GROUPS.has(groupName) || (isPF && !PE_ART_GROUPS.has(groupName))) {
      liberal.push(s);
    } else if (PE_ART_GROUPS.has(groupName) || isAchievementOnly) {
      pe_art.push(s);
    } else if (ELECTIVE_TYPES.has(typeName)) {
      elective.push(s);
    } else {
      general.push(s);
    }
  }

  return { general, elective, pe_art, liberal };
}

// ─── Grades Table ───────────────────────────────────

type Variant = "general" | "elective" | "pe_art" | "liberal";

function EmptyGradeTable({ variant = "general" }: { variant?: Variant }) {
  const isPeArt = variant === "pe_art";
  const isElective = variant === "elective";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <Th>학년</Th><Th>학기</Th><Th>교과</Th><Th>과목</Th><Th>학점</Th>
            {isPeArt ? (
              <Th>성취도</Th>
            ) : (
              <>
                <Th>원점수</Th><Th>과목평균</Th><Th>성취도</Th>
                {isElective ? <Th>성취도별 분포비율</Th> : <Th>석차등급</Th>}
                <Th>수강자수</Th>
              </>
            )}
            <Th>비고</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={isPeArt ? 7 : 11} className={`${B} px-4 py-2 text-center text-xs text-[var(--text-tertiary)]`}>
              해당 사항 없음
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function GradesTable({ scores, variant, tenantId, onDelete, editingId, onEdit, onSaveEdit, isEditPending }: {
  scores: Score[]; variant: Variant; tenantId?: string; onDelete?: (id: string) => void;
  editingId?: string | null; onEdit?: (id: string | null) => void;
  onSaveEdit?: (scoreId: string, updates: Partial<Score>) => void; isEditPending?: boolean;
}) {
  const totalCredits = scores.reduce((sum, s) => sum + s.credit_hours, 0);
  const isPeArt = variant === "pe_art";
  const isLiberal = variant === "liberal";
  const isSimple = isPeArt || isLiberal;
  const colCount = isSimple ? 7 : (variant === "elective" ? 11 : 12);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>학년</Th>
              <Th>학기</Th>
              <Th>교과</Th>
              <Th>과목</Th>
              <Th>학점</Th>
              {isSimple ? (
                <Th>{isLiberal ? "이수여부" : "성취도"}</Th>
              ) : (
                <>
                  <Th>원점수</Th>
                  <Th>{<>과목<br />평균</>}</Th>
                  <Th>성취도</Th>
                  <Th>{<>성취도별<br />분포비율</>}</Th>
                  {variant !== "elective" && <Th>{<>석차<br />등급</>}</Th>}
                  <Th>{<>수강<br />자수</>}</Th>
                </>
              )}
              <Th>비고</Th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) =>
              editingId === s.id ? (
                <EditableRow key={s.id} score={s} variant={variant} isSimple={isSimple} isLiberal={isLiberal}
                  onSave={(updates) => onSaveEdit?.(s.id, updates)} onCancel={() => onEdit?.(null)} isPending={isEditPending} />
              ) : (
                <tr key={s.id} className={tenantId ? "group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""}
                  onClick={() => tenantId && onEdit?.(s.id)}>
                  <Td center>{s.grade}</Td>
                  <Td center>{s.semester}</Td>
                  <Td center>{s.subject_group?.name ?? "-"}</Td>
                  <Td center bold>{s.subject?.name ?? "-"}</Td>
                  <Td center>{s.credit_hours}</Td>
                  {isSimple ? (
                    <Td center>{isLiberal ? (s.achievement_level ?? "P") : (s.achievement_level ?? "-")}</Td>
                  ) : (
                    <>
                      <Td center>{s.raw_score ?? "-"}</Td>
                      <Td center>{s.avg_score ?? "-"}</Td>
                      <Td center>{s.achievement_level ?? "-"}</Td>
                      <Td center><RatioBadges score={s} /></Td>
                      {variant !== "elective" && <Td center>{s.rank_grade ?? "-"}</Td>}
                      <Td center>{s.total_students ?? "-"}</Td>
                    </>
                  )}
                  <td className={`${B} px-1.5 py-1 text-center text-xs text-[var(--text-secondary)] relative`}>
                    {tenantId && onDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                        className="invisible rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500 transition-all hover:bg-red-100 hover:text-red-700 group-hover:visible dark:bg-red-950/30 dark:hover:bg-red-950/50"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className={`${B} px-2 py-1 text-right text-xs font-medium text-[var(--text-secondary)]`}>
                이수학점 합계
              </td>
              <td className={`${B} px-2 py-1 text-center text-xs font-bold text-[var(--text-primary)]`}>{totalCredits}</td>
              <td colSpan={colCount - 5} className={B} />
            </tr>
          </tfoot>
        </table>
      </div>
      {variant === "general" && (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">※ 성취도별 분포비율의 E비율 내에는 미이수자가 포함되어 있음</p>
      )}
    </div>
  );
}

// ─── Add Score Form ─────────────────────────────────

type AddScoreInput = {
  tenantId: string;
  semester: number;
  creditHours: number;
  rawScore: number | null;
  avgScore: number | null;
  achievementLevel: string | null;
  rankGrade: number | null;
  totalStudents: number | null;
  subjectId: string;
  subjectGroupId: string;
  subjectTypeId: string;
  curriculumRevisionId: string;
};

function AddScoreForm({ tenantId, subjects, curriculumRevisionId, onSubmit, onCancel, isPending, error }: {
  tenantId: string;
  subjects: { id: string; name: string; subject_group?: { name: string } | null }[];
  curriculumRevisionId?: string;
  onSubmit: (input: AddScoreInput) => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [semester, setSemester] = useState(1);
  const [creditHours, setCreditHours] = useState("3");
  const [rawScore, setRawScore] = useState("");
  const [avgScore, setAvgScore] = useState("");
  const [achievementLevel, setAchievementLevel] = useState("");
  const [rankGrade, setRankGrade] = useState("");
  const [totalStudents, setTotalStudents] = useState("");

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const handleSubmit = async () => {
    if (!subjectId || !curriculumRevisionId) return;

    // subject에서 FK 조회
    const { data: subj } = await supabase
      .from("subjects")
      .select("subject_group_id, subject_type_id")
      .eq("id", subjectId)
      .single();

    if (!subj) return;

    // subject_type_id fallback
    let subjectTypeId = subj.subject_type_id;
    if (!subjectTypeId) {
      const { data: types } = await supabase.from("subject_types").select("id").limit(1);
      subjectTypeId = types?.[0]?.id ?? "";
    }

    onSubmit({
      tenantId,
      semester,
      creditHours: parseInt(creditHours) || 3,
      rawScore: rawScore ? parseFloat(rawScore) : null,
      avgScore: avgScore ? parseFloat(avgScore) : null,
      achievementLevel: achievementLevel || null,
      rankGrade: rankGrade ? parseInt(rankGrade) : null,
      totalStudents: totalStudents ? parseInt(totalStudents) : null,
      subjectId,
      subjectGroupId: subj.subject_group_id,
      subjectTypeId,
      curriculumRevisionId,
    });
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">성적 추가</span>
        <button onClick={onCancel} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">취소</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900">
          <option value="">과목 선택 *</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={semester} onChange={(e) => setSemester(Number(e.target.value))} className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900">
          <option value={1}>1학기</option>
          <option value={2}>2학기</option>
        </select>
        <input type="number" value={creditHours} onChange={(e) => setCreditHours(e.target.value)} placeholder="학점 *" min={1} max={10} className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
        <input type="number" value={rawScore} onChange={(e) => setRawScore(e.target.value)} placeholder="원점수" className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
        <input type="number" value={avgScore} onChange={(e) => setAvgScore(e.target.value)} placeholder="과목평균" className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
        <select value={achievementLevel} onChange={(e) => setAchievementLevel(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900">
          <option value="">성취도</option>
          {["A", "B", "C", "D", "E", "P"].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="number" value={rankGrade} onChange={(e) => setRankGrade(e.target.value)} placeholder="석차등급" min={1} max={9} className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
        <input type="number" value={totalStudents} onChange={(e) => setTotalStudents(e.target.value)} placeholder="수강자수" className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={handleSubmit} disabled={!subjectId || isPending} className="rounded bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? "저장 중..." : "추가"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

// ─── Shared Cell Components ─────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className={`${B} px-1.5 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] whitespace-pre-line`}>
      {children}
    </th>
  );
}

function Td({ children, center, bold }: { children?: React.ReactNode; center?: boolean; bold?: boolean }) {
  return (
    <td className={cn(`${B} px-1.5 py-1`, center && "text-center", bold ? "text-xs font-medium text-[var(--text-primary)]" : "text-xs text-[var(--text-secondary)]")}>
      {children}
    </td>
  );
}

// ─── Inline Edit Row ──────────────────────────────

function EditableRow({ score, variant, isSimple, isLiberal, onSave, onCancel, isPending }: {
  score: Score; variant: Variant; isSimple: boolean; isLiberal: boolean;
  onSave: (updates: Partial<Score>) => void; onCancel: () => void; isPending?: boolean;
}) {
  const [rawScore, setRawScore] = useState(score.raw_score?.toString() ?? "");
  const [avgScore, setAvgScore] = useState(score.avg_score?.toString() ?? "");
  const [rankGrade, setRankGrade] = useState(score.rank_grade?.toString() ?? "");
  const [achievementLevel, setAchievementLevel] = useState(score.achievement_level ?? "");
  const [totalStudents, setTotalStudents] = useState(score.total_students?.toString() ?? "");
  const [creditHours, setCreditHours] = useState(score.credit_hours.toString());

  const handleSave = () => {
    onSave({
      raw_score: rawScore ? Number(rawScore) : null,
      avg_score: avgScore ? Number(avgScore) : null,
      rank_grade: rankGrade ? Number(rankGrade) : null,
      achievement_level: achievementLevel || null,
      total_students: totalStudents ? Number(totalStudents) : null,
      credit_hours: Number(creditHours) || 1,
    });
  };

  const inputCls = `w-full rounded border border-indigo-300 bg-indigo-50/30 px-1 py-0.5 text-center text-xs dark:border-indigo-700 dark:bg-indigo-950/20`;

  return (
    <tr className="bg-indigo-50/50 dark:bg-indigo-950/10">
      <Td center>{score.grade}</Td>
      <Td center>{score.semester}</Td>
      <Td center>{score.subject_group?.name ?? "-"}</Td>
      <Td center bold>{score.subject?.name ?? "-"}</Td>
      <td className={`${B} px-1 py-0.5`}><input type="number" value={creditHours} onChange={(e) => setCreditHours(e.target.value)} className={inputCls} min={1} /></td>
      {isSimple ? (
        <td className={`${B} px-1 py-0.5`}>
          <select value={achievementLevel} onChange={(e) => setAchievementLevel(e.target.value)} className={inputCls}>
            <option value="">-</option>
            {(isLiberal ? ["P", "F"] : ["A", "B", "C", "D", "E"]).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </td>
      ) : (
        <>
          <td className={`${B} px-1 py-0.5`}><input type="number" value={rawScore} onChange={(e) => setRawScore(e.target.value)} className={inputCls} /></td>
          <td className={`${B} px-1 py-0.5`}><input type="number" value={avgScore} onChange={(e) => setAvgScore(e.target.value)} className={inputCls} /></td>
          <td className={`${B} px-1 py-0.5`}>
            <select value={achievementLevel} onChange={(e) => setAchievementLevel(e.target.value)} className={inputCls}>
              <option value="">-</option>
              {["A", "B", "C", "D", "E"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </td>
          <td className={`${B} px-1 py-0.5 text-center text-xs text-[var(--text-tertiary)]`}>-</td>
          {variant !== "elective" && (
            <td className={`${B} px-1 py-0.5`}><input type="number" value={rankGrade} onChange={(e) => setRankGrade(e.target.value)} className={inputCls} min={1} max={9} /></td>
          )}
          <td className={`${B} px-1 py-0.5`}><input type="number" value={totalStudents} onChange={(e) => setTotalStudents(e.target.value)} className={inputCls} /></td>
        </>
      )}
      <td className={`${B} px-1 py-0.5 text-center`}>
        <div className="flex items-center justify-center gap-1">
          <button onClick={handleSave} disabled={isPending} className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {isPending ? "..." : "저장"}
          </button>
          <button onClick={onCancel} className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300">
            취소
          </button>
        </div>
      </td>
    </tr>
  );
}

function RatioBadges({ score }: { score: Score }) {
  const { achievement_ratio_a: a, achievement_ratio_b: b, achievement_ratio_c: c, achievement_ratio_d: d, achievement_ratio_e: e } = score;
  if (a == null && b == null && c == null) return null;

  const parts: string[] = [];
  if (a != null) parts.push(`A(${a})`);
  if (b != null) parts.push(`B(${b})`);
  if (c != null) parts.push(`C(${c})`);
  if (d != null && d > 0) parts.push(`D(${d})`);
  if (e != null && e > 0) parts.push(`E(${e})`);
  return (
    <span className="text-xs leading-relaxed text-[var(--text-secondary)]">
      {parts.join(" ")}
    </span>
  );
}
