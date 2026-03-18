"use client";

// ============================================
// AI vs 컨설턴트 진단 비교 뷰
// 2열 레이아웃: AI(읽기전용) | 컨설턴트(편집 가능)
// ============================================

import { useState, useCallback, useMemo, Fragment } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { upsertDiagnosisAction, confirmDiagnosisAction } from "@/lib/domains/student-record/actions/diagnosis";
import { generateAiDiagnosis } from "@/lib/domains/student-record/llm/actions/generateDiagnosis";
import { MAJOR_RECOMMENDED_COURSES, COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { Diagnosis, CompetencyScore, ActivityTag, CompetencyGrade, CompetencyArea } from "@/lib/domains/student-record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { Sparkles, Copy, Check } from "lucide-react";

type Props = {
  aiDiagnosis: Diagnosis | null;
  consultantDiagnosis: Diagnosis | null;
  aiScores: CompetencyScore[];
  consultantScores: CompetencyScore[];
  activityTags: ActivityTag[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
  targetMajor?: string | null;
  schoolName?: string;
};

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const STRENGTHS = ["strong", "moderate", "weak"] as const;
const STRENGTH_LABELS: Record<string, string> = { strong: "강함", moderate: "보통", weak: "약함" };
const MAJOR_KEYS = Object.keys(MAJOR_RECOMMENDED_COURSES);

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "초안", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmed: { label: "확정", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  suggested: { label: "제안", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

export function DiagnosisComparisonView({
  aiDiagnosis, consultantDiagnosis,
  aiScores, consultantScores, activityTags,
  studentId, tenantId, schoolYear,
  targetMajor, schoolName,
}: Props) {
  const queryClient = useQueryClient();
  const qk = studentRecordKeys.diagnosisTab(studentId, schoolYear);

  // 컨설턴트 폼 상태 — prop 변경 시 동기화
  const [grade, setGrade] = useState<CompetencyGrade>((consultantDiagnosis?.overall_grade as CompetencyGrade) ?? "B");
  const [direction, setDirection] = useState(consultantDiagnosis?.record_direction ?? "");
  const [dirStrength, setDirStrength] = useState(consultantDiagnosis?.direction_strength ?? "moderate");
  const [strengths, setStrengths] = useState<string[]>(consultantDiagnosis?.strengths ?? []);
  const [weaknesses, setWeaknesses] = useState<string[]>(consultantDiagnosis?.weaknesses ?? []);
  const [majors, setMajors] = useState<string[]>(consultantDiagnosis?.recommended_majors ?? []);
  const [notes, setNotes] = useState(consultantDiagnosis?.strategy_notes ?? "");
  const [newStrength, setNewStrength] = useState("");
  const [newWeakness, setNewWeakness] = useState("");

  // prop 변경 시 폼 동기화 (저장 후 refetch 시)
  const [prevDiagnosisId, setPrevDiagnosisId] = useState(consultantDiagnosis?.id);
  if (consultantDiagnosis?.id !== prevDiagnosisId) {
    setPrevDiagnosisId(consultantDiagnosis?.id);
    setGrade((consultantDiagnosis?.overall_grade as CompetencyGrade) ?? "B");
    setDirection(consultantDiagnosis?.record_direction ?? "");
    setDirStrength(consultantDiagnosis?.direction_strength ?? "moderate");
    setStrengths(consultantDiagnosis?.strengths ?? []);
    setWeaknesses(consultantDiagnosis?.weaknesses ?? []);
    setMajors(consultantDiagnosis?.recommended_majors ?? []);
    setNotes(consultantDiagnosis?.strategy_notes ?? "");
  }

  // AI 종합진단 생성
  const aiGenMutation = useMutation({
    mutationFn: async () => {
      const result = await generateAiDiagnosis(aiScores, activityTags, { targetMajor: targetMajor ?? undefined, schoolName });
      if (!result.success) throw new Error(result.error);

      // AI 진단 저장
      const saveResult = await upsertDiagnosisAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        overall_grade: result.data.overallGrade,
        record_direction: result.data.recordDirection,
        direction_strength: result.data.directionStrength,
        strengths: result.data.strengths,
        weaknesses: result.data.weaknesses,
        recommended_majors: result.data.recommendedMajors,
        strategy_notes: result.data.strategyNotes,
        source: "ai",
        status: "suggested",
      });
      if (!saveResult.success) throw new Error(saveResult.error);
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  // 컨설턴트 저장
  const saveMutation = useMutation({
    mutationFn: async () => {
      const result = await upsertDiagnosisAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        overall_grade: grade,
        record_direction: direction || null,
        direction_strength: dirStrength,
        strengths, weaknesses,
        recommended_majors: majors,
        strategy_notes: notes || null,
        source: "manual",
        status: "draft",
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!consultantDiagnosis?.id) throw new Error("먼저 저장해주세요");
      const result = await confirmDiagnosisAction(consultantDiagnosis.id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  // AI → 컨설턴트 복사
  const copyFromAi = useCallback(() => {
    if (!aiDiagnosis) return;
    setGrade((aiDiagnosis.overall_grade as CompetencyGrade) ?? "B");
    setDirection(aiDiagnosis.record_direction ?? "");
    setDirStrength(aiDiagnosis.direction_strength ?? "moderate");
    setStrengths(aiDiagnosis.strengths ?? []);
    setWeaknesses(aiDiagnosis.weaknesses ?? []);
    setMajors(aiDiagnosis.recommended_majors ?? []);
    setNotes(aiDiagnosis.strategy_notes ?? "");
  }, [aiDiagnosis]);

  const addTag = (list: string[], setList: (v: string[]) => void, val: string, setVal: (v: string) => void) => {
    const t = val.trim();
    if (t && !list.includes(t)) setList([...list, t]);
    setVal("");
  };

  // 일치/차이 비교
  function isDiff(aiVal: string | null | undefined, consultantVal: string | null | undefined): boolean {
    return (aiVal ?? "") !== (consultantVal ?? "");
  }

  function listDiff(aiList: string[], consultantList: string[]): { match: string[]; aiOnly: string[]; consultantOnly: string[] } {
    const aiSet = new Set(aiList);
    const consultantSet = new Set(consultantList);
    return {
      match: aiList.filter((s) => consultantSet.has(s)),
      aiOnly: aiList.filter((s) => !consultantSet.has(s)),
      consultantOnly: consultantList.filter((s) => !aiSet.has(s)),
    };
  }

  const strengthsDiff = listDiff(aiDiagnosis?.strengths ?? [], strengths);
  const weaknessesDiff = listDiff(aiDiagnosis?.weaknesses ?? [], weaknesses);

  return (
    <div className="flex flex-col gap-4">
      {/* AI 생성 버튼 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => aiGenMutation.mutate()}
          disabled={aiGenMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Sparkles size={14} />
          {aiGenMutation.isPending ? "생성 중..." : "AI 종합 진단 생성"}
        </button>
        {aiDiagnosis && (
          <button
            onClick={copyFromAi}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Copy size={12} /> AI → 컨설턴트 복사
          </button>
        )}
        {aiGenMutation.isError && <span className="text-xs text-red-500">{aiGenMutation.error.message}</span>}
      </div>

      {/* 10항목 등급 요약 */}
      {(aiScores.length > 0 || consultantScores.length > 0) && (
        <GradeSummaryTable aiScores={aiScores} consultantScores={consultantScores} activityTags={activityTags} />
      )}

      {/* 2열 비교 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ─── AI 진단 (읽기전용) ─── */}
        <div className="rounded-lg border border-blue-200 p-4 dark:border-blue-800">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">AI 분석</span>
            {aiDiagnosis && (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_BADGE[aiDiagnosis.status ?? "suggested"]?.cls)}>
                {STATUS_BADGE[aiDiagnosis.status ?? "suggested"]?.label}
              </span>
            )}
          </div>

          {!aiDiagnosis ? (
            <p className="text-xs text-[var(--text-tertiary)]">AI 종합 진단을 생성해주세요</p>
          ) : (
            <div className="flex flex-col gap-2 text-xs">
              <Row label="종합등급" value={aiDiagnosis.overall_grade} diff={isDiff(aiDiagnosis.overall_grade, grade)} />
              <Row label="방향" value={aiDiagnosis.record_direction ?? "-"} diff={isDiff(aiDiagnosis.record_direction, direction)} />
              <Row label="강도" value={STRENGTH_LABELS[aiDiagnosis.direction_strength ?? "moderate"]} />
              <TagList label="강점" items={aiDiagnosis.strengths ?? []} matchItems={strengthsDiff.match} />
              <TagList label="약점" items={aiDiagnosis.weaknesses ?? []} matchItems={weaknessesDiff.match} />
              <TagList label="추천전공" items={aiDiagnosis.recommended_majors ?? []} />
              <RecommendedCourses majors={aiDiagnosis.recommended_majors ?? []} />
              {aiDiagnosis.strategy_notes && <Row label="메모" value={aiDiagnosis.strategy_notes} />}
            </div>
          )}
        </div>

        {/* ─── 컨설턴트 진단 (편집) ─── */}
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">컨설턴트 진단</span>
            {consultantDiagnosis && (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_BADGE[consultantDiagnosis.status ?? "draft"]?.cls)}>
                {STATUS_BADGE[consultantDiagnosis.status ?? "draft"]?.label}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {/* 종합등급 */}
            <FormRow label="종합등급" diff={isDiff(aiDiagnosis?.overall_grade, grade)}>
              <select value={grade} onChange={(e) => setGrade(e.target.value as CompetencyGrade)}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600">
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </FormRow>

            {/* 방향 */}
            <FormRow label="방향" diff={isDiff(aiDiagnosis?.record_direction, direction)}>
              <input type="text" value={direction} onChange={(e) => setDirection(e.target.value)}
                maxLength={50} placeholder="예: 생명과학 심화 탐구 중심"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600" />
            </FormRow>

            {/* 강도 */}
            <FormRow label="강도">
              <div className="flex gap-1">
                {STRENGTHS.map((s) => (
                  <button key={s} onClick={() => setDirStrength(s)}
                    className={cn("rounded px-2 py-0.5 text-[10px] font-medium", dirStrength === s ? "bg-indigo-600 text-white" : "border border-gray-300 dark:border-gray-600")}>
                    {STRENGTH_LABELS[s]}
                  </button>
                ))}
              </div>
            </FormRow>

            {/* 강점 */}
            <FormRow label="강점">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap gap-1">
                  {strengths.map((s, i) => {
                    const isMatch = strengthsDiff.match.includes(s);
                    return (
                      <span key={i} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]", isMatch ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-700")}>
                        {isMatch && <Check size={10} />}{s}
                        <button onClick={() => setStrengths(strengths.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
                      </span>
                    );
                  })}
                </div>
                <input type="text" value={newStrength} onChange={(e) => setNewStrength(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(strengths, setStrengths, newStrength, setNewStrength); } }}
                  placeholder="강점 입력 후 Enter" className="rounded border border-gray-300 px-2 py-0.5 text-[10px] dark:border-gray-600" />
              </div>
            </FormRow>

            {/* 약점 */}
            <FormRow label="약점">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap gap-1">
                  {weaknesses.map((w, i) => {
                    const isMatch = weaknessesDiff.match.includes(w);
                    return (
                      <span key={i} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]", isMatch ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-700")}>
                        {isMatch && <Check size={10} />}{w}
                        <button onClick={() => setWeaknesses(weaknesses.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
                      </span>
                    );
                  })}
                </div>
                <input type="text" value={newWeakness} onChange={(e) => setNewWeakness(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(weaknesses, setWeaknesses, newWeakness, setNewWeakness); } }}
                  placeholder="약점 입력 후 Enter" className="rounded border border-gray-300 px-2 py-0.5 text-[10px] dark:border-gray-600" />
              </div>
            </FormRow>

            {/* 추천전공 */}
            <FormRow label="추천전공">
              <div className="flex flex-1 flex-wrap gap-1">
                {MAJOR_KEYS.map((k) => (
                  <button key={k} onClick={() => setMajors((p) => p.includes(k) ? p.filter((m) => m !== k) : [...p, k])}
                    className={cn("rounded-full px-2 py-0.5 text-[9px]", majors.includes(k) ? "bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-900/30" : "border border-gray-200 text-[var(--text-tertiary)] dark:border-gray-600")}>
                    {k}
                  </button>
                ))}
              </div>
            </FormRow>

            {/* 추천 교과목 */}
            <RecommendedCourses majors={majors} />

            {/* 메모 */}
            <FormRow label="메모">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="flex-1 resize-none rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600" />
            </FormRow>

            {/* 버튼 */}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {saveMutation.isPending ? "저장 중..." : "저장"}
              </button>
              {consultantDiagnosis?.id && consultantDiagnosis.status !== "confirmed" && (
                <button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}
                  className="rounded border border-green-600 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20">
                  확정
                </button>
              )}
              {saveMutation.isError && <span className="text-xs text-red-500">{saveMutation.error.message}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 보조 컴포넌트 ──────────────────────────

function Row({ label, value, diff }: { label: string; value: string; diff?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-[var(--text-tertiary)]">{label}</span>
      <span className={cn("text-[var(--text-primary)]", diff && "font-medium text-amber-600 dark:text-amber-400")}>{value}</span>
      {diff && <span className="text-amber-500">⚡</span>}
    </div>
  );
}

function TagList({ label, items, matchItems }: { label: string; items: string[]; matchItems?: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-[var(--text-tertiary)]">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((s, i) => {
          const isMatch = matchItems?.includes(s);
          return (
            <span key={i} className={cn("rounded-full px-1.5 py-0.5 text-[10px]", isMatch ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-700")}>
              {isMatch && "✓ "}{s}
            </span>
          );
        })}
        {items.length === 0 && <span className="text-[var(--text-tertiary)]">-</span>}
      </div>
    </div>
  );
}

function GradeSummaryTable({ aiScores, consultantScores, activityTags }: {
  aiScores: CompetencyScore[];
  consultantScores: CompetencyScore[];
  activityTags: ActivityTag[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const findScore = (scores: CompetencyScore[], code: string) =>
    scores.find((s) => s.competency_item === code && s.scope === "yearly");

  // P1-2: 역량별 근거 활동 집계
  const tagsByItem = useMemo(() => {
    const map = new Map<string, { positive: ActivityTag[]; negative: ActivityTag[]; needs_review: ActivityTag[] }>();
    for (const tag of activityTags) {
      const key = tag.competency_item;
      const entry = map.get(key) ?? { positive: [], negative: [], needs_review: [] };
      if (tag.evaluation === "positive") entry.positive.push(tag);
      else if (tag.evaluation === "negative") entry.negative.push(tag);
      else entry.needs_review.push(tag);
      map.set(key, entry);
    }
    return map;
  }, [activityTags]);

  const areas: CompetencyArea[] = ["academic", "career", "community"];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="px-3 py-1.5 text-left font-medium text-[var(--text-secondary)]">역량 항목</th>
            <th className="w-16 px-2 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">AI</th>
            <th className="w-16 px-2 py-1.5 text-center font-medium text-[var(--text-secondary)]">컨설턴트</th>
            <th className="w-14 px-2 py-1.5 text-center font-medium text-[var(--text-tertiary)]">근거</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => {
            const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
            return items.map((item, idx) => {
              const aiScore = findScore(aiScores, item.code);
              const conScore = findScore(consultantScores, item.code);
              const aiGrade = aiScore?.grade_value;
              const conGrade = conScore?.grade_value;
              const match = aiGrade && conGrade && aiGrade === conGrade;
              const differs = aiGrade && conGrade && aiGrade !== conGrade;
              const isExpanded = expanded === item.code;
              const tags = tagsByItem.get(item.code);
              const tagCount = tags ? tags.positive.length + tags.negative.length + tags.needs_review.length : 0;
              const aiNarrative = aiScore?.narrative;
              const conNarrative = conScore?.narrative;
              const hasDetail = aiNarrative || conNarrative || tagCount > 0;

              return (
                <Fragment key={item.code}>
                  <tr
                    onClick={() => hasDetail && setExpanded(isExpanded ? null : item.code)}
                    className={cn(
                      "border-t border-gray-100 dark:border-gray-800",
                      idx === 0 && "border-t-gray-300 dark:border-t-gray-600",
                      hasDetail && "cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50",
                    )}
                  >
                    <td className="px-3 py-1.5">
                      {idx === 0 && (
                        <span className="mr-1.5 text-[9px] font-semibold text-[var(--text-tertiary)]">
                          {COMPETENCY_AREA_LABELS[area]}
                        </span>
                      )}
                      <span className="text-[var(--text-primary)]">{item.label}</span>
                      {hasDetail && (
                        <span className="ml-1 text-[9px] text-[var(--text-tertiary)]">{isExpanded ? "▲" : "▼"}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <GradeBadge grade={aiGrade} variant={match ? "match" : differs ? "diff" : "default"} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <GradeBadge grade={conGrade} variant={match ? "match" : differs ? "diff" : "default"} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {tagCount > 0 && (
                        <span className="text-[9px] text-[var(--text-tertiary)]">
                          {tags!.positive.length > 0 && <span className="text-green-600">+{tags!.positive.length}</span>}
                          {tags!.needs_review.length > 0 && <span className="ml-0.5 text-amber-500">?{tags!.needs_review.length}</span>}
                          {tags!.negative.length > 0 && <span className="ml-0.5 text-red-500">-{tags!.negative.length}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="bg-gray-50/50 px-3 py-2 dark:bg-gray-800/30">
                        <GradeDetail
                          aiNarrative={aiNarrative ?? null}
                          conNarrative={conNarrative ?? null}
                          tags={tags}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 확장 행: 해석 서술 + 근거 활동 */
function GradeDetail({ aiNarrative, conNarrative, tags }: {
  aiNarrative: string | null;
  conNarrative: string | null;
  tags?: { positive: ActivityTag[]; negative: ActivityTag[]; needs_review: ActivityTag[] };
}) {
  const allTags = tags ? [...tags.positive, ...tags.needs_review, ...tags.negative] : [];

  return (
    <div className="flex flex-col gap-2">
      {/* P1-1: 해석 서술 */}
      {(aiNarrative || conNarrative) && (
        <div className="flex flex-col gap-1.5">
          {aiNarrative && (
            <div className="flex gap-1.5">
              <span className="shrink-0 text-[9px] font-medium text-blue-600 dark:text-blue-400">AI</span>
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{aiNarrative}</p>
            </div>
          )}
          {conNarrative && (
            <div className="flex gap-1.5">
              <span className="shrink-0 text-[9px] font-medium text-[var(--text-secondary)]">컨설턴트</span>
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{conNarrative}</p>
            </div>
          )}
        </div>
      )}

      {/* P1-2: 근거 활동 집계 */}
      {allTags.length > 0 && (
        <div>
          <span className="text-[9px] font-medium text-[var(--text-tertiary)]">근거 활동 ({allTags.length}건)</span>
          <div className="mt-1 flex flex-col gap-0.5">
            {allTags.slice(0, 5).map((tag) => (
              <div key={tag.id} className="flex items-start gap-1.5 text-[10px]">
                <span className={cn(
                  "mt-0.5 shrink-0 rounded px-1 py-px text-[8px] font-medium",
                  tag.evaluation === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                  tag.evaluation === "negative" && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
                  tag.evaluation === "needs_review" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                )}>
                  {tag.evaluation === "positive" ? "+" : tag.evaluation === "negative" ? "-" : "?"}
                </span>
                <span className="text-[var(--text-secondary)] line-clamp-1">
                  {tag.evidence_summary?.replace(/^\[AI\]\s*/, "").split("\n")[0] ?? tag.record_type}
                </span>
              </div>
            ))}
            {allTags.length > 5 && (
              <span className="text-[9px] text-[var(--text-tertiary)]">외 {allTags.length - 5}건</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GradeBadge({ grade, variant }: { grade?: string; variant: "match" | "diff" | "default" }) {
  if (!grade) return <span className="text-[var(--text-tertiary)]">-</span>;
  return (
    <span className={cn(
      "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
      variant === "match" && "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      variant === "diff" && "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      variant === "default" && "text-[var(--text-primary)]",
    )}>
      {variant === "match" && "✓ "}{grade}
    </span>
  );
}

function RecommendedCourses({ majors }: { majors: string[] }) {
  if (majors.length === 0) return null;

  return (
    <div className="ml-16 flex flex-col gap-2">
      {majors.map((major) => {
        const courses = MAJOR_RECOMMENDED_COURSES[major];
        if (!courses) return null;
        return (
          <div key={major} className="rounded border border-gray-100 bg-gray-50/50 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-800/50">
            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{major}</span>
            {courses.general.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">일반</span>
                {courses.general.map((c) => (
                  <span key={c} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">{c}</span>
                ))}
              </div>
            )}
            {courses.career.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">진로</span>
                {courses.career.map((c) => (
                  <span key={c} className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">{c}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormRow({ label, children, diff }: { label: string; children: React.ReactNode; diff?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn("w-14 shrink-0 pt-1 text-xs", diff ? "font-medium text-amber-600 dark:text-amber-400" : "text-[var(--text-tertiary)]")}>
        {label} {diff && "⚡"}
      </span>
      {children}
    </div>
  );
}
