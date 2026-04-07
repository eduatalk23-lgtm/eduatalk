"use client";

// ============================================
// AI vs 컨설턴트 진단 비교 뷰
// 2열 레이아웃: AI(읽기전용) | 컨설턴트(편집 가능)
// ============================================

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { useSidePanel } from "@/components/side-panel";
import { upsertDiagnosisAction, confirmDiagnosisAction, findDiagnosisSnapshotsAction } from "@/lib/domains/student-record/actions/diagnosis";
import { generateAiDiagnosis } from "@/lib/domains/student-record/llm/actions/generateDiagnosis";
import { buildEdgeSummaryForPrompt } from "@/lib/domains/student-record/llm/edge-summary";
import { fetchPersistedEdges } from "@/lib/domains/student-record/actions/diagnosis-helpers";
import { syncPipelineTaskStatus } from "@/lib/domains/student-record/actions/pipeline";
import { checkDiagnosisStalenessAction } from "@/lib/domains/student-record/actions/staleness";
import { MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record";
import { setekGuideKeys } from "@/lib/query-options/setekGuide";
import type { Diagnosis, CompetencyScore, ActivityTag, CompetencyGrade } from "@/lib/domains/student-record";
import { RecommendedCourses } from "./GradeSummaryTable";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { Sparkles, Copy, Check, Loader2, History } from "lucide-react";
import { useAutoSave } from "./useAutoSave";

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
  const { isPanelOpen } = useSidePanel();
  const qk = studentRecordKeys.diagnosisTab(studentId, schoolYear);

  // 컨설턴트 폼 상태 — prop 변경 시 동기화
  const [grade, setGrade] = useState<CompetencyGrade>((consultantDiagnosis?.overall_grade as CompetencyGrade) ?? "B");
  const [direction, setDirection] = useState(consultantDiagnosis?.record_direction ?? "");
  const [dirStrength, setDirStrength] = useState(consultantDiagnosis?.direction_strength ?? "moderate");
  const [strengths, setStrengths] = useState<string[]>(consultantDiagnosis?.strengths ?? []);
  const [weaknesses, setWeaknesses] = useState<string[]>(consultantDiagnosis?.weaknesses ?? []);
  const [majors, setMajors] = useState<string[]>(consultantDiagnosis?.recommended_majors ?? []);
  const [notes, setNotes] = useState(consultantDiagnosis?.strategy_notes ?? "");
  const [improvements, setImprovements] = useState<Array<{ priority: string; area: string; gap: string; action: string; outcome: string }>>(
    () => {
      const raw = (consultantDiagnosis as Record<string, unknown> | null)?.improvements;
      return Array.isArray(raw) ? raw as Array<{ priority: string; area: string; gap: string; action: string; outcome: string }> : [];
    },
  );
  const [newStrength, setNewStrength] = useState("");
  const [newWeakness, setNewWeakness] = useState("");

  // prop 변경 시 폼 동기화 (저장 후 refetch 시)
  // ⚠️ auto-save 진행 중에는 동기화 억제 — 사용자 편집이 refetch로 덮어써지는 것을 방지
  const isSavingRef = useRef(false);
  const [prevDiagnosisId, setPrevDiagnosisId] = useState(consultantDiagnosis?.id);
  if (consultantDiagnosis?.id !== prevDiagnosisId && !isSavingRef.current) {
    setPrevDiagnosisId(consultantDiagnosis?.id);
    setGrade((consultantDiagnosis?.overall_grade as CompetencyGrade) ?? "B");
    setDirection(consultantDiagnosis?.record_direction ?? "");
    setDirStrength(consultantDiagnosis?.direction_strength ?? "moderate");
    setStrengths(consultantDiagnosis?.strengths ?? []);
    setWeaknesses(consultantDiagnosis?.weaknesses ?? []);
    setMajors(consultantDiagnosis?.recommended_majors ?? []);
    setNotes(consultantDiagnosis?.strategy_notes ?? "");
    const rawImp = (consultantDiagnosis as Record<string, unknown> | null)?.improvements;
    setImprovements(Array.isArray(rawImp) ? rawImp as Array<{ priority: string; area: string; gap: string; action: string; outcome: string }> : []);
  }

  // 자동 저장용 데이터 객체
  const autoSaveData = useMemo(() => ({
    grade, direction, dirStrength, strengths, weaknesses, majors, notes, improvements,
  }), [grade, direction, dirStrength, strengths, weaknesses, majors, notes, improvements]);

  // 확정/진행 상태 ref — 자동저장 핸들러 내부에서 최신 값 참조용
  const isConfirmedRef = useRef(consultantDiagnosis?.status === "confirmed");
  const isConfirmingRef = useRef(false);
  useEffect(() => {
    isConfirmedRef.current = consultantDiagnosis?.status === "confirmed";
  }, [consultantDiagnosis?.status]);

  const autoSaveHandler = useCallback(async (data: typeof autoSaveData) => {
    // 이중 방어: 확정 완료 또는 확정 진행 중이면 autoSave 차단
    if (isConfirmedRef.current || isConfirmingRef.current) return { success: true };

    isSavingRef.current = true;
    try {
      const result = await upsertDiagnosisAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        overall_grade: data.grade,
        record_direction: data.direction || null,
        direction_strength: data.dirStrength,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        improvements: data.improvements as unknown as import("@/lib/supabase/database.types").Json,
        recommended_majors: data.majors,
        strategy_notes: data.notes || null,
        source: "manual",
        status: "draft",
      } as import("@/lib/domains/student-record/types").DiagnosisInsert);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: qk });
      }
      return result;
    } finally {
      // 짧은 지연 후 해제 — invalidateQueries 후 refetch가 도착할 시간 확보
      setTimeout(() => { isSavingRef.current = false; }, 500);
    }
  }, [tenantId, studentId, schoolYear, queryClient, qk]);

  const [confirmError, setConfirmError] = useState<string | null>(null);
  const confirmMutation = useMutation({
    mutationFn: async () => {
      isConfirmingRef.current = true;
      if (!consultantDiagnosis?.id) throw new Error("먼저 저장해주세요");
      const result = await confirmDiagnosisAction(consultantDiagnosis.id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      setConfirmError(null);
      queryClient.invalidateQueries({ queryKey: qk });
      // 하류 캐시 무효화: 진단 확정 시 세특 방향·전략이 구 진단 기반일 수 있음
      queryClient.invalidateQueries({ queryKey: setekGuideKeys.list(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.strategyTab(studentId, schoolYear) });
    },
    onError: (err: Error) => setConfirmError(err.message),
    onSettled: () => { isConfirmingRef.current = false; },
  });

  const { status: autoSaveStatus, error: autoSaveError } = useAutoSave({
    data: autoSaveData,
    onSave: autoSaveHandler,
    debounceMs: 3000,
    enabled: consultantDiagnosis?.status !== "confirmed" && !confirmMutation.isPending,
  });

  // 진단 staleness 조회 (엣지 stale + 파이프라인 stale)
  const { data: diagnosisStaleness } = useQuery({
    queryKey: ["diagnosis-staleness", studentId],
    queryFn: () => checkDiagnosisStalenessAction(studentId),
    staleTime: 30_000,
    enabled: !!aiDiagnosis,
  });

  // P2-4: 히스토리 토글
  const [showHistory, setShowHistory] = useState(false);

  // AI 종합진단 생성
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const aiGenMutation = useMutation({
    mutationFn: async () => {
      // P1: 엣지 데이터 자동 조회 → 프롬프트에 연관성 요약 투입
      const edges = await fetchPersistedEdges(studentId, tenantId);
      const edgeSummary = buildEdgeSummaryForPrompt(edges) || undefined;

      const result = await generateAiDiagnosis(
        [...aiScores, ...consultantScores], activityTags,
        { targetMajor: targetMajor ?? undefined, schoolName, studentId },
        edgeSummary,
      );
      if (!result.success) throw new Error(result.error);

      // AI 진단 저장 (direction_reasoning + improvements 신규 컬럼 포함)
      const saveResult = await upsertDiagnosisAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        overall_grade: result.data.overallGrade,
        record_direction: result.data.recordDirection,
        direction_strength: result.data.directionStrength,
        direction_reasoning: result.data.directionReasoning || null,
        strengths: result.data.strengths,
        weaknesses: result.data.weaknesses,
        improvements: result.data.improvements as unknown as import("@/lib/supabase/database.types").Json,
        recommended_majors: result.data.recommendedMajors,
        strategy_notes: result.data.strategyNotes,
        source: "ai",
        status: "draft",
      });
      if (!saveResult.success) throw new Error(saveResult.error);
      return result.data;
    },
    onSuccess: (data) => {
      setAiWarnings(data.warnings ?? []);
      queryClient.invalidateQueries({ queryKey: qk });
      // 하류 캐시 무효화: 진단 재생성 시 세특 방향·전략이 구 진단 기반일 수 있음
      queryClient.invalidateQueries({ queryKey: setekGuideKeys.list(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.strategyTab(studentId, schoolYear) });
      syncPipelineTaskStatus(studentId, "ai_diagnosis").then(() => {
        queryClient.invalidateQueries({ queryKey: studentRecordKeys.pipeline(studentId) });
      }).catch(() => {});
    },
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
    const rawImp = (aiDiagnosis as Record<string, unknown>).improvements;
    setImprovements(Array.isArray(rawImp) ? rawImp as Array<{ priority: string; area: string; gap: string; action: string; outcome: string }> : []);
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
          onClick={() => {
            if (aiDiagnosis && !window.confirm("기존 AI 진단을 덮어씁니다. 계속하시겠습니까?")) return;
            aiGenMutation.mutate();
          }}
          disabled={aiGenMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Sparkles size={14} />
          {aiGenMutation.isPending ? "생성 중..." : aiDiagnosis ? "AI 진단 재생성" : "AI 종합 진단 생성"}
        </button>
        {aiDiagnosis && (
          <button
            onClick={copyFromAi}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Copy size={12} /> AI → 컨설턴트 복사
          </button>
        )}
        {/* P2-4: 히스토리 토글 */}
        {aiDiagnosis && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition",
              showHistory
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                : "border-gray-300 text-[var(--text-secondary)] hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800",
            )}
          >
            <History size={12} /> 이력
          </button>
        )}
        {aiGenMutation.isError && <span className="text-xs text-red-500">{aiGenMutation.error.message}</span>}
        {aiWarnings.length > 0 && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            AI 응답 일부가 기본값으로 대체됨: {aiWarnings.join(", ")}
          </span>
        )}
      </div>

      {/* P2-4: 히스토리 패널 */}
      {showHistory && <DiagnosisHistoryPanel studentId={studentId} schoolYear={schoolYear} />}

      {/* Staleness 경고 배너 */}
      {diagnosisStaleness?.isStale && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
          <span className="text-xs text-amber-700 dark:text-amber-400">
            ⚠ 진단이 최신이 아닐 수 있습니다
            {diagnosisStaleness.staleEdgeCount > 0 && ` (변경된 연결 ${diagnosisStaleness.staleEdgeCount}건)`}
            {diagnosisStaleness.pipelineStale && " — 레코드가 변경됨"}
          </span>
          <button
            type="button"
            onClick={() => aiGenMutation.mutate()}
            disabled={aiGenMutation.isPending}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-800"
          >
            재생성
          </button>
        </div>
      )}

      {/* 2열 비교 — 모바일에서는 컨설턴트(편집)를 먼저 표시 */}
      <div className={cn("grid grid-cols-1 gap-4", !isPanelOpen && "lg:grid-cols-2")}>
        {/* ─── AI 진단 (읽기전용) — 모바일에서 아래로 ─── */}
        <div className="order-2 rounded-lg border border-blue-200 p-4 lg:order-1 dark:border-blue-800">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">AI 분석</span>
            {aiDiagnosis && (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_BADGE[aiDiagnosis.status ?? "suggested"]?.cls)}>
                {STATUS_BADGE[aiDiagnosis.status ?? "suggested"]?.label}
              </span>
            )}
          </div>

          {aiGenMutation.isPending ? (
            <div className="flex flex-col gap-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-2">
                  <div className="h-4 w-16 shrink-0 rounded bg-blue-100 dark:bg-blue-900/30" />
                  <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : !aiDiagnosis ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-[var(--text-tertiary)] dark:border-gray-600">
              상단의 &ldquo;AI 종합 진단 생성&rdquo; 버튼을 눌러 분석을 시작하세요
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-xs">
              <Row label="종합등급" value={aiDiagnosis.overall_grade} diff={isDiff(aiDiagnosis.overall_grade, grade)} />
              <Row label="방향" value={aiDiagnosis.record_direction ?? "-"} diff={isDiff(aiDiagnosis.record_direction, direction)} />
              <Row label="강도" value={STRENGTH_LABELS[aiDiagnosis.direction_strength ?? "moderate"]} />
              {aiDiagnosis.direction_reasoning && (
                <Row label="근거" value={aiDiagnosis.direction_reasoning} />
              )}
              <TagList label="강점" items={aiDiagnosis.strengths ?? []} matchItems={strengthsDiff.match} />
              <TagList label="약점" items={aiDiagnosis.weaknesses ?? []} matchItems={weaknessesDiff.match} />
              {/* 개선 전략 */}
              {(() => {
                const improvements = aiDiagnosis.improvements as Array<{ priority: string; area: string; gap: string; action: string; outcome: string }> | null;
                if (!Array.isArray(improvements) || improvements.length === 0) return null;
                return <ImprovementsList items={improvements} />;
              })()}
              <TagList label="추천전공" items={aiDiagnosis.recommended_majors ?? []} />
              <RecommendedCourses majors={aiDiagnosis.recommended_majors ?? []} />
              {aiDiagnosis.strategy_notes && <Row label="메모" value={aiDiagnosis.strategy_notes} />}
            </div>
          )}
        </div>

        {/* ─── 컨설턴트 진단 (편집) — 모바일에서 위로 ─── */}
        <div className="order-1 rounded-lg border border-gray-200 p-4 lg:order-2 dark:border-gray-700">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">컨설턴트 진단</span>
            {consultantDiagnosis && (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_BADGE[consultantDiagnosis.status ?? "draft"]?.cls)}>
                {STATUS_BADGE[consultantDiagnosis.status ?? "draft"]?.label}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {/* 종합등급 */}
            <FormRow label="종합등급" diff={isDiff(aiDiagnosis?.overall_grade, grade)}>
              <select value={grade} onChange={(e) => setGrade(e.target.value as CompetencyGrade)}
                className="min-h-[32px] w-16 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600">
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
              <div className="flex gap-1.5">
                {STRENGTHS.map((s) => (
                  <button key={s} onClick={() => setDirStrength(s)}
                    aria-pressed={dirStrength === s}
                    className={cn("min-h-[32px] rounded px-3 py-1 text-xs font-medium", dirStrength === s ? "bg-indigo-600 text-white" : "border border-gray-300 dark:border-gray-600")}>
                    {STRENGTH_LABELS[s]}
                  </button>
                ))}
              </div>
            </FormRow>

            {/* 강점 */}
            <FormRow label="강점">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap gap-1">
                  {strengths.map((s) => {
                    const isMatch = strengthsDiff.match.includes(s);
                    return (
                      <span key={s} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]", isMatch ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-700")}>
                        {isMatch && <Check size={10} />}{s}
                        <button onClick={() => setStrengths(strengths.filter((v) => v !== s))} className="hover:text-red-500" aria-label={`${s} 강점 삭제`}>×</button>
                      </span>
                    );
                  })}
                </div>
                <input type="text" value={newStrength} onChange={(e) => setNewStrength(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(strengths, setStrengths, newStrength, setNewStrength); } }}
                  placeholder="강점 입력 후 Enter" className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600" />
              </div>
            </FormRow>

            {/* 약점 */}
            <FormRow label="약점">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap gap-1">
                  {weaknesses.map((w) => {
                    const isMatch = weaknessesDiff.match.includes(w);
                    return (
                      <span key={w} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]", isMatch ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-700")}>
                        {isMatch && <Check size={10} />}{w}
                        <button onClick={() => setWeaknesses(weaknesses.filter((v) => v !== w))} className="hover:text-red-500" aria-label={`${w} 약점 삭제`}>×</button>
                      </span>
                    );
                  })}
                </div>
                <input type="text" value={newWeakness} onChange={(e) => setNewWeakness(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(weaknesses, setWeaknesses, newWeakness, setNewWeakness); } }}
                  placeholder="약점 입력 후 Enter" className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600" />
              </div>
            </FormRow>

            {/* 추천전공 — 선택된 항목 상단 + 나머지 접기 */}
            <FormRow label="추천전공">
              <div className="flex flex-1 flex-col gap-1.5">
                {majors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {majors.map((k) => (
                      <button key={k} onClick={() => setMajors((p) => p.filter((m) => m !== k))}
                        className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30">
                        {k} ×
                      </button>
                    ))}
                  </div>
                )}
                <details className="text-[10px]">
                  <summary className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                    전공 계열 선택 ({MAJOR_KEYS.length}개)
                  </summary>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {MAJOR_KEYS.filter((k) => !majors.includes(k)).map((k) => (
                      <button key={k} onClick={() => setMajors((p) => [...p, k])}
                        className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-600">
                        {k}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </FormRow>

            {/* 추천 교과목 */}
            <RecommendedCourses majors={majors} />

            {/* 개선 전략 */}
            <FormRow label="개선전략">
              <div className="flex flex-1 flex-col gap-1.5">
                {improvements.map((imp, i) => (
                  <div key={i} className="flex flex-col gap-1 rounded border border-gray-200 p-1.5 dark:border-gray-700">
                    <div className="flex items-center gap-1">
                      <select value={imp.priority} onChange={(e) => {
                        const next = [...improvements];
                        next[i] = { ...imp, priority: e.target.value };
                        setImprovements(next);
                      }} className="min-h-[24px] rounded border border-gray-300 px-1 py-0.5 text-[10px] dark:border-gray-600">
                        <option value="높음">높음</option>
                        <option value="중간">중간</option>
                        <option value="낮음">낮음</option>
                      </select>
                      <input type="text" value={imp.area} placeholder="영역" onChange={(e) => {
                        const next = [...improvements];
                        next[i] = { ...imp, area: e.target.value };
                        setImprovements(next);
                      }} className="min-w-0 flex-1 rounded border border-gray-300 px-1 py-0.5 text-[10px] dark:border-gray-600" />
                      <button onClick={() => setImprovements(improvements.filter((_, j) => j !== i))}
                        className="text-[10px] text-red-400 hover:text-red-600" aria-label="삭제">×</button>
                    </div>
                    <input type="text" value={imp.action} placeholder="실행 방안" onChange={(e) => {
                      const next = [...improvements];
                      next[i] = { ...imp, action: e.target.value };
                      setImprovements(next);
                    }} className="rounded border border-gray-300 px-1 py-0.5 text-[10px] dark:border-gray-600" />
                  </div>
                ))}
                <button onClick={() => setImprovements([...improvements, { priority: "중간", area: "", gap: "", action: "", outcome: "" }])}
                  className="self-start rounded border border-dashed border-gray-300 px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-600">
                  + 개선 전략 추가
                </button>
              </div>
            </FormRow>

            {/* 메모 */}
            <FormRow label="메모">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="flex-1 resize-none rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600" />
            </FormRow>

            {/* 버튼 + 자동저장 상태 */}
            <div className="flex items-center gap-2 pt-1">
              {consultantDiagnosis?.id && consultantDiagnosis.status !== "confirmed" && (
                <button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}
                  className="rounded border border-green-600 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:hover:bg-green-900/20">
                  {confirmMutation.isPending ? "확정 중..." : "확정"}
                </button>
              )}
              {confirmError && <span className="text-xs text-red-500">{confirmError}</span>}
              <span className="ml-auto text-xs text-[var(--text-tertiary)]" aria-live="polite" aria-atomic="true">
                {autoSaveStatus === "saving" && (
                  <span className="inline-flex items-center gap-1 text-blue-500">
                    <Loader2 size={10} className="animate-spin" /> 저장 중…
                  </span>
                )}
                {autoSaveStatus === "saved" && (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <Check size={10} /> 자동 저장됨
                  </span>
                )}
                {autoSaveStatus === "error" && (
                  <span className="text-red-500">저장 실패: {autoSaveError}</span>
                )}
              </span>
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
      <span className="w-16 shrink-0 text-[var(--text-tertiary)]">{label}</span>
      <span className={cn("text-[var(--text-primary)]", diff && "font-medium text-amber-600 dark:text-amber-400")}>{value}</span>
      {diff && <span className="text-amber-500" title="AI와 차이 있음">⚡ <span className="sr-only">차이</span></span>}
    </div>
  );
}

function TagList({ label, items, matchItems }: { label: string; items: string[]; matchItems?: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-[var(--text-tertiary)]">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((s) => {
          const isMatch = matchItems?.includes(s);
          return (
            <span key={s} className={cn("rounded-full px-1.5 py-0.5 text-[10px]", isMatch ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-700")}>
              {isMatch && "✓ "}{s}
            </span>
          );
        })}
        {items.length === 0 && <span className="text-[var(--text-tertiary)]">-</span>}
      </div>
    </div>
  );
}


function FormRow({ label, children, diff }: { label: string; children: React.ReactNode; diff?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn("w-16 shrink-0 pt-1 text-xs", diff ? "font-medium text-amber-600 dark:text-amber-400" : "text-[var(--text-tertiary)]")}>
        {label} {diff && <span title="AI와 차이 있음">⚡</span>}
      </span>
      {children}
    </div>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  "높음": "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  "중간": "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
  "낮음": "text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400",
};

function ImprovementsList({ items }: { items: Array<{ priority: string; area: string; gap: string; action: string; outcome: string }> }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-[var(--text-tertiary)]">개선전략</span>
      <div className="flex flex-1 flex-col gap-1.5">
        {items.map((imp, i) => (
          <div key={i} className="rounded border border-gray-200 p-1.5 dark:border-gray-700">
            <div className="flex items-center gap-1.5">
              <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium", PRIORITY_COLORS[imp.priority] ?? PRIORITY_COLORS["중간"])}>
                {imp.priority}
              </span>
              <span className="text-[10px] font-medium text-[var(--text-primary)]">{imp.area}</span>
            </div>
            {imp.gap && <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{imp.gap}</p>}
            <p className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400">{imp.action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P2-4: 진단 변경 히스토리 패널 ──────────────────────────

const GRADE_LABELS: Record<string, string> = { "A+": "A+", "A-": "A-", "B+": "B+", B: "B", "B-": "B-", C: "C" };

function DiagnosisHistoryPanel({ studentId, schoolYear }: { studentId: string; schoolYear: number }) {
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
