"use client";

// ============================================
// AI 파이프라인 조종석 패널 (Cockpit View)
// 상단: 전체 그리드 (학년 × Phase) — 항상 모든 학년 표시
// 하단: 실행 중인 태스크 상세 로그
// ============================================

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  gradeAwarePipelineStatusQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";
import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  type GradePipelineTaskKey,
  type SynthesisPipelineTaskKey,
} from "@/lib/domains/student-record/pipeline-types";
import { checkPipelineStalenessAction } from "@/lib/domains/student-record/actions/staleness";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import {
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  Play,
  X,
  Clock,
  TriangleAlert,
  RefreshCw,
  ChevronRight,
  Target,
} from "lucide-react";

// ─── Phase 그룹 정의 ────────────────────────────────────────────────────────

const GRADE_PHASE_GROUPS: Array<{
  label: string;
  keys: GradePipelineTaskKey[];
}> = [
  { label: "세특 역량", keys: ["competency_setek"] },
  { label: "창체 역량", keys: ["competency_changche"] },
  { label: "행특 역량", keys: ["competency_haengteuk"] },
  { label: "세특+슬롯", keys: ["setek_guide", "slot_generation"] },
  { label: "창체 방향", keys: ["changche_guide"] },
  { label: "행특 방향", keys: ["haengteuk_guide"] },
];

const SYNTHESIS_PHASE_GROUPS: Array<{
  label: string;
  keys: SynthesisPipelineTaskKey[];
}> = [
  { label: "스토리라인", keys: ["storyline_generation"] },
  { label: "연결+가이드", keys: ["edge_computation", "guide_matching"] },
  { label: "진단+추천", keys: ["ai_diagnosis", "course_recommendation"] },
  { label: "우회학과", keys: ["bypass_analysis"] },
  { label: "요약+전략", keys: ["activity_summary", "ai_strategy"] },
  { label: "면접+로드맵", keys: ["interview_generation", "roadmap_generation"] },
];

const GRADE_TASK_LABEL_MAP: Record<GradePipelineTaskKey, string> = {
  competency_setek: "세특 역량",
  competency_changche: "창체 역량",
  competency_haengteuk: "행특 역량",
  setek_guide: "세특 방향",
  slot_generation: "슬롯 생성",
  changche_guide: "창체 방향",
  haengteuk_guide: "행특 방향",
};

const SYNTH_TASK_LABEL_MAP: Record<SynthesisPipelineTaskKey, string> = {
  storyline_generation: "스토리라인",
  edge_computation: "연결 그래프",
  ai_diagnosis: "종합 진단",
  course_recommendation: "수강 추천",
  guide_matching: "가이드 매칭",
  bypass_analysis: "우회학과",
  activity_summary: "활동 요약",
  ai_strategy: "보완 전략",
  interview_generation: "면접 질문",
  roadmap_generation: "로드맵",
};

// ─── 상태 헬퍼 ──────────────────────────────────────────────────────────────

type CellStatus = "locked" | "ready" | "running" | "completed" | "cached" | "failed";

function isGradePhaseReady(
  grade: number,
  phase: number,
  gradePipelines: Record<number, { status: string; tasks: Record<string, string> }>,
): boolean {
  const t = gradePipelines[grade]?.tasks ?? {};
  if (phase === 1) {
    if (grade === 1) return true;
    for (let g = 1; g < grade; g++) {
      if (gradePipelines[g]?.status !== "completed") return false;
    }
    return true;
  }
  if (phase === 2) return t.competency_setek === "completed";
  if (phase === 3) return t.competency_changche === "completed";
  if (phase === 4) return t.competency_haengteuk === "completed";
  if (phase === 5) return t.setek_guide === "completed" && t.slot_generation === "completed";
  if (phase === 6) return t.changche_guide === "completed";
  return false;
}

function isSynthesisPhaseReady(
  phase: number,
  allGradesCompleted: boolean,
  synth: { tasks: Record<string, string> } | null,
): boolean {
  if (!allGradesCompleted) return false;
  if (!synth) return phase === 1;
  const t = synth.tasks;
  if (phase === 1) return true;
  if (phase === 2) return t.storyline_generation === "completed";
  if (phase === 3) return t.edge_computation === "completed";
  if (phase === 4) return t.ai_diagnosis === "completed" && t.course_recommendation === "completed";
  if (phase === 5) return t.bypass_analysis === "completed";
  if (phase === 6) return t.activity_summary === "completed" && t.ai_strategy === "completed";
  return false;
}

function deriveCellStatus(statuses: string[], prereqMet: boolean, isCached?: boolean): CellStatus {
  if (statuses.some((s) => s === "running")) return "running";
  if (statuses.every((s) => s === "completed")) return isCached ? "cached" : "completed";
  if (statuses.some((s) => s === "failed")) return "failed";
  if (prereqMet) return "ready";
  return "locked";
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

// ─── 셀 컴포넌트 ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CellStatus, { bg: string; text: string; border: string }> = {
  completed: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  cached: { bg: "bg-teal-50 dark:bg-teal-900/15", text: "text-teal-700 dark:text-teal-400", border: "border-teal-200 dark:border-teal-800" },
  running: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-300 dark:border-indigo-700" },
  failed: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
  ready: { bg: "bg-white dark:bg-gray-900", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-700 hover:border-indigo-400" },
  locked: { bg: "bg-gray-50 dark:bg-gray-900/50", text: "text-gray-400 dark:text-gray-600", border: "border-gray-200 dark:border-gray-800" },
};

function StatusIcon({ status }: { status: CellStatus }) {
  switch (status) {
    case "completed": return <Check className="h-3.5 w-3.5" />;
    case "cached": return <Check className="h-3.5 w-3.5" />;
    case "running": return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case "failed": return <AlertCircle className="h-3.5 w-3.5" />;
    case "ready": return <Play className="h-3 w-3" />;
    default: return <span className="w-3.5 h-3.5" />;
  }
}

interface CockpitCellProps {
  label: string;
  status: CellStatus;
  elapsedMs?: number;
  progressText?: string;
  runningStartMs?: number;
  tooltip?: string;
  onClick?: () => void;
}

function CockpitCell({ label, status, elapsedMs, progressText, runningStartMs, tooltip, onClick }: CockpitCellProps) {
  const s = STATUS_STYLES[status];
  const clickable = status === "ready" || status === "completed" || status === "cached" || status === "failed";
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={tooltip}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-all min-h-[56px]",
        s.bg, s.border, s.text,
        clickable && "cursor-pointer",
      )}
    >
      <StatusIcon status={status} />
      <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
      {status === "cached" && (
        <span className="text-[9px] font-semibold text-teal-500 dark:text-teal-400">캐시</span>
      )}
      {status === "running" && progressText && (
        <span className="text-[9px] font-semibold">{progressText}</span>
      )}
      {status === "running" && runningStartMs != null && (
        <CockpitRunningTimer startMs={runningStartMs} />
      )}
      {elapsedMs != null && (status === "completed" || status === "cached" || status === "failed") && (
        <span className="flex items-center gap-0.5 text-[9px] opacity-60">
          <Clock className="h-2.5 w-2.5" />
          {formatElapsed(elapsedMs)}
        </span>
      )}
    </button>
  );
}

function CockpitRunningTimer({ startMs }: { startMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="flex items-center gap-0.5 text-[9px] tabular-nums opacity-70">
      <Clock className="h-2.5 w-2.5" />
      {formatElapsed(now - startMs)}
    </span>
  );
}

// ─── 메인 패널 ──────────────────────────────────────────────────────────────

interface PipelinePanelAppProps {
  studentId: string;
  tenantId: string;
  /** 진로 설정 여부 — false면 빈 상태 렌더링 */
  hasTargetMajor: boolean;
  /** 파이프라인 완료 후 "결과 리뷰" 클릭 시 호출 */
  onReview?: () => void;
}

export function PipelinePanelApp({ studentId, tenantId, hasTargetMajor, onReview }: PipelinePanelAppProps) {
  const { closePanel } = useSidePanel();
  const queryClient = useQueryClient();
  const [runningCell, setRunningCell] = useState<string | null>(null);
  const [runningStartMs, setRunningStartMs] = useState<number | null>(null);
  const [isFullRunning, setIsFullRunning] = useState(false);
  const fullRunAbortRef = useRef(false);
  const fetchingRef = useRef(false);
  const pollingStartRef = useRef<number | null>(null);

  const { data: gradeStatus } = useQuery({
    ...gradeAwarePipelineStatusQueryOptions(studentId),
    refetchInterval: () => {
      if (!runningCell && !isFullRunning) {
        pollingStartRef.current = null;
        return false;
      }
      if (!pollingStartRef.current) pollingStartRef.current = Date.now();
      if (Date.now() - pollingStartRef.current > 3600000) return false;
      return 3000;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: studentRecordKeys.gradeAwarePipeline(studentId) });

  // ─── Stale 감지 ──────────────────────────────────────────────────────────
  const allGradesCompletedForStale =
    Object.values(gradeStatus?.gradePipelines ?? {}).length > 0 &&
    Object.values(gradeStatus?.gradePipelines ?? {}).every((p) => p.status === "completed");

  const { data: stalenessData } = useQuery({
    queryKey: [...studentRecordKeys.gradeAwarePipeline(studentId), "staleness"],
    queryFn: () => checkPipelineStalenessAction(studentId),
    enabled: allGradesCompletedForStale,
    staleTime: 30_000,
  });
  const isPipelineStale = stalenessData?.isStale ?? false;

  // ─── Phase 실행 함수 ──────────────────────────────────────────────────────

  const runGradePhase = async (grade: number, phase: number) => {
    if (fetchingRef.current) return;
    setRunningCell(`g-${grade}-${phase}`);
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();
    try {
      let pid = gradeStatus?.gradePipelines[grade]?.pipelineId;
      if (!pid) {
        const { runGradePipeline } = await import("@/lib/domains/student-record/actions/pipeline");
        const r = await runGradePipeline(studentId, tenantId, grade);
        if (!r.success || !r.data) throw new Error(r.error ?? "생성 실패");
        pid = r.data.pipelineId;
        invalidate();
      }
      const MAX_RETRIES = 2;

      if (phase <= 3) {
        // Phase 1~3 (역량 분석): 청크 루프 — 미캐시 4건씩 처리
        let hasMore = true;
        let retries = 0;
        while (hasMore) {
          try {
            const res = await fetch(`/api/admin/pipeline/grade/phase-${phase}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pipelineId: pid, chunkSize: 4 }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as { hasMore?: boolean };
            hasMore = json.hasMore ?? false;
            retries = 0; // 성공 시 재시도 카운터 리셋
            if (hasMore) invalidate();
          } catch {
            retries++;
            if (retries > MAX_RETRIES) break; // 연속 실패 시 중단
            await new Promise((r) => setTimeout(r, 3000)); // 3초 대기 후 재시도
          }
        }
      } else {
        // Phase 4~6: 단일 호출 + 재시도
        for (let retry = 0; retry <= MAX_RETRIES; retry++) {
          try {
            const res = await fetch(`/api/admin/pipeline/grade/phase-${phase}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pipelineId: pid }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            break;
          } catch {
            if (retry >= MAX_RETRIES) break;
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      }
    } catch { /* 최종 실패 — 폴링으로 반영 */ } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
    }
  };

  const runSynthesisPhase = async (phase: number) => {
    if (fetchingRef.current) return;
    setRunningCell(`s-${phase}`);
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();
    try {
      let pid = gradeStatus?.synthesisPipeline?.pipelineId;
      if (!pid) {
        const res = await fetch("/api/admin/pipeline/synthesis/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, tenantId }),
        });
        const json = (await res.json()) as { pipelineId?: string };
        if (!json.pipelineId) throw new Error("생성 실패");
        pid = json.pipelineId;
        invalidate();
      }
      await fetch(`/api/admin/pipeline/synthesis/phase-${phase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: pid }),
      });
    } catch { /* */ } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

  const runFullSequence = async () => {
    setIsFullRunning(true);
    fullRunAbortRef.current = false;
    pollingStartRef.current = Date.now();
    try {
      const res = await fetch("/api/admin/pipeline/grade/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, tenantId }),
      });
      const json = (await res.json()) as {
        gradePipelines?: Array<{ grade: number; pipelineId: string }>;
        error?: string;
      };
      if (!json.gradePipelines) throw new Error(json.error ?? "시작 실패");
      invalidate();

      for (const gp of json.gradePipelines) {
        for (let phase = 1; phase <= 6; phase++) {
          if (fullRunAbortRef.current) return;
          setRunningCell(`g-${gp.grade}-${phase}`);
          setRunningStartMs(Date.now());

          const MAX_RETRIES = 2;
          if (phase <= 3) {
            // 역량 분석: 청크 루프 + 재시도
            let hasMore = true;
            let retries = 0;
            while (hasMore && !fullRunAbortRef.current) {
              try {
                const phaseRes = await fetch(`/api/admin/pipeline/grade/phase-${phase}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pipelineId: gp.pipelineId, chunkSize: 4 }),
                });
                if (!phaseRes.ok) throw new Error(`HTTP ${phaseRes.status}`);
                const phaseJson = (await phaseRes.json()) as { hasMore?: boolean };
                hasMore = phaseJson.hasMore ?? false;
                retries = 0;
                invalidate();
              } catch {
                retries++;
                if (retries > MAX_RETRIES) break;
                await new Promise((r) => setTimeout(r, 3000));
              }
            }
          } else {
            // Phase 4~6: 단일 호출 + 재시도
            for (let retry = 0; retry <= MAX_RETRIES; retry++) {
              try {
                const phaseRes = await fetch(`/api/admin/pipeline/grade/phase-${phase}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pipelineId: gp.pipelineId }),
                });
                if (!phaseRes.ok) throw new Error(`HTTP ${phaseRes.status}`);
                invalidate();
                break;
              } catch {
                if (retry >= MAX_RETRIES) break;
                await new Promise((r) => setTimeout(r, 3000));
              }
            }
          }
        }
      }
      if (fullRunAbortRef.current) return;

      const sRes = await fetch("/api/admin/pipeline/synthesis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, tenantId }),
      });
      const sJson = (await sRes.json()) as { pipelineId?: string };
      if (!sJson.pipelineId) throw new Error("Synthesis 생성 실패");
      invalidate();

      for (let phase = 1; phase <= 6; phase++) {
        if (fullRunAbortRef.current) return;
        setRunningCell(`s-${phase}`);
        setRunningStartMs(Date.now());
        for (let retry = 0; retry <= 2; retry++) {
          try {
            const synthPhaseRes = await fetch(`/api/admin/pipeline/synthesis/phase-${phase}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pipelineId: sJson.pipelineId }),
            });
            if (!synthPhaseRes.ok) throw new Error(`HTTP ${synthPhaseRes.status}`);
            invalidate();
            break;
          } catch {
            if (retry >= 2) break;
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    } catch { /* */ } finally {
      setIsFullRunning(false);
      setRunningCell(null);
      invalidate();
    }
  };

  // ─── 파생 상태 ────────────────────────────────────────────────────────────

  const gp = gradeStatus?.gradePipelines ?? {};
  const sp = gradeStatus?.synthesisPipeline ?? null;
  const gradeNumbers = Object.keys(gp).map(Number).sort((a, b) => a - b);
  // 항상 1~3학년 모두 표시 (파이프라인 없는 학년도 표시)
  const displayGrades = [1, 2, 3];
  const allGradesCompleted = gradeNumbers.length > 0 && gradeNumbers.every((g) => gp[g]?.status === "completed");
  const allComplete = allGradesCompleted && sp?.status === "completed";
  const isAnyRunning = isFullRunning || !!runningCell;

  // 현재 실행 중인 태스크 로그
  const runningTasks: Array<{ label: string; preview: string }> = [];
  for (const g of gradeNumbers) {
    const pipeline = gp[g];
    if (!pipeline) continue;
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      if (pipeline.tasks[key] === "running" && pipeline.previews[key]) {
        runningTasks.push({ label: `${g}학년 ${key}`, preview: pipeline.previews[key] });
      }
    }
  }
  if (sp) {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      if (sp.tasks[key] === "running" && sp.previews[key]) {
        runningTasks.push({ label: key, preview: sp.previews[key] });
      }
    }
  }

  // 완료된 태스크 로그 (최근순)
  const completedTasks: Array<{ label: string; preview: string; elapsedMs?: number }> = [];
  for (const g of [1, 2, 3]) {
    const pipeline = gp[g];
    if (!pipeline) continue;
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      const status = pipeline.tasks[key];
      if (status === "completed" || status === "failed") {
        const elapsed = pipeline.elapsed?.[key];
        completedTasks.push({
          label: `${g}학년 ${GRADE_TASK_LABEL_MAP[key as GradePipelineTaskKey] ?? key}`,
          preview: pipeline.previews[key] ?? (status === "failed" ? "실패" : "완료"),
          elapsedMs: elapsed,
        });
      }
    }
  }
  if (sp) {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      const status = sp.tasks[key];
      if (status === "completed" || status === "failed") {
        completedTasks.push({
          label: SYNTH_TASK_LABEL_MAP[key as SynthesisPipelineTaskKey] ?? key,
          preview: sp.previews[key] ?? (status === "failed" ? "실패" : "완료"),
          elapsedMs: sp.elapsed?.[key],
        });
      }
    }
  }

  // ─── 진로 미설정 빈 상태 ───────────────────────────────────────────────────
  if (!hasTargetMajor) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold">파이프라인 대시보드</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Target className="h-10 w-10 text-[var(--text-placeholder)]" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">진로가 설정되지 않았습니다</p>
          <p className="text-xs text-[var(--text-tertiary)]">
            AI 파이프라인을 실행하려면 먼저 진로를 설정해 주세요.
          </p>
          <button
            type="button"
            onClick={() => {
              closePanel();
              onReview?.();
            }}
            className="rounded-md border border-indigo-200 px-4 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            진로 설정하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ─── 상단: 컨트롤 바 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold">파이프라인 대시보드</span>
        </div>
        <div className="flex items-center gap-2">
          {isFullRunning && (
            <button
              type="button"
              onClick={() => { fullRunAbortRef.current = true; }}
              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            >
              <X className="inline h-3 w-3 mr-1" />중단
            </button>
          )}
          <button
            type="button"
            onClick={runFullSequence}
            disabled={isAnyRunning}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isFullRunning ? "실행 중..." : "전체 실행"}
          </button>
        </div>
      </div>

      {/* ─── Stale 배너 ─────────────────────────────────────────────────── */}
      {isPipelineStale && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-300 truncate">
              입력 데이터가 변경되었습니다. 재분석이 필요합니다.
            </span>
          </div>
          <button
            type="button"
            onClick={runFullSequence}
            disabled={isAnyRunning}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            재분석
          </button>
        </div>
      )}

      {/* ─── 2단 레이아웃: 좌=그리드, 우=로그 ─────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* ── 좌: 조종석 그리드 (항상 전체 표시) ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 border-r border-[var(--border-secondary)]">
          {/* 학년별 그리드 */}
          <div>
            <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Grade Pipeline</h4>
            <div className="grid grid-cols-[44px_repeat(6,1fr)] gap-1">
              {/* 헤더 */}
              <div />
              {GRADE_PHASE_GROUPS.map((pg) => (
                <div key={pg.label} className="text-center text-[8px] font-semibold text-[var(--text-tertiary)] pb-0.5">
                  {pg.label}
                </div>
              ))}

              {/* 1~3학년 행 — 항상 모두 표시 */}
              {displayGrades.map((grade) => {
                const pipeline = gp[grade];
                const tasks = pipeline?.tasks ?? {};
                const previews = pipeline?.previews ?? {};
                const elapsed = pipeline?.elapsed ?? {};

                return (
                  <div key={grade} className="contents">
                    <div className="flex items-center justify-center">
                      <span className={cn(
                        "text-[11px] font-bold",
                        pipeline?.status === "completed" ? "text-emerald-600 dark:text-emerald-400"
                          : pipeline?.status === "running" ? "text-indigo-600 dark:text-indigo-400"
                          : "text-[var(--text-tertiary)]",
                      )}>
                        {grade}학년
                      </span>
                    </div>

                    {GRADE_PHASE_GROUPS.map((pg, idx) => {
                      const phaseNum = idx + 1;
                      const taskStatuses = pg.keys.map((k) => tasks[k] ?? "pending");
                      const prereqMet = isGradePhaseReady(grade, phaseNum, gp);
                      const isCached = pg.keys.some((k) => previews[k]?.includes("캐시"));
                      const cellKey = `g-${grade}-${phaseNum}`;
                      const status = runningCell === cellKey
                        ? "running" as CellStatus
                        : deriveCellStatus(taskStatuses, prereqMet, isCached);

                      const elapsedValues = pg.keys.map((k) => elapsed[k]).filter((v): v is number => v != null);
                      const maxElapsed = elapsedValues.length > 0 ? Math.max(...elapsedValues) : undefined;
                      const runningPreview = status === "running"
                        ? pg.keys.map((k) => previews[k]).filter(Boolean).join(" / ") || undefined
                        : undefined;

                      const errors = pipeline?.errors ?? {};
                      const errorMsg = status === "failed"
                        ? pg.keys.map((k) => errors[k]).filter(Boolean).join("; ") || undefined
                        : undefined;

                      return (
                        <CockpitCell
                          key={pg.label}
                          label={pg.label}
                          status={status}
                          elapsedMs={maxElapsed}
                          progressText={runningPreview}
                          runningStartMs={runningCell === cellKey ? runningStartMs ?? undefined : undefined}
                          tooltip={status === "failed" ? errorMsg : undefined}
                          onClick={() => runGradePhase(grade, phaseNum)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 종합 분석 그리드 */}
          <div>
            <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Synthesis Pipeline</h4>
            <div className="grid grid-cols-[44px_repeat(6,1fr)] gap-1">
              <div className="flex items-center justify-center">
                <span className={cn(
                  "text-[11px] font-bold",
                  sp?.status === "completed" ? "text-emerald-600 dark:text-emerald-400"
                    : sp?.status === "running" ? "text-indigo-600 dark:text-indigo-400"
                    : "text-[var(--text-tertiary)]",
                )}>
                  종합
                </span>
              </div>
              {SYNTHESIS_PHASE_GROUPS.map((pg, idx) => {
                const phaseNum = idx + 1;
                const synthTasks = sp?.tasks ?? {};
                const taskStatuses = pg.keys.map((k) => synthTasks[k] ?? "pending");
                const prereqMet = isSynthesisPhaseReady(phaseNum, allGradesCompleted, sp);
                const synthPreviews = sp?.previews ?? {};
                const isCached = pg.keys.some((k) => synthPreviews[k]?.includes("캐시"));
                const cellKey = `s-${phaseNum}`;
                const status = runningCell === cellKey
                  ? "running" as CellStatus
                  : deriveCellStatus(taskStatuses, prereqMet, isCached);

                const elapsedValues = pg.keys.map((k) => sp?.elapsed?.[k]).filter((v): v is number => v != null);
                const maxElapsed = elapsedValues.length > 0 ? Math.max(...elapsedValues) : undefined;

                const synthErrors = sp?.errors ?? {};
                const errorMsg = status === "failed"
                  ? pg.keys.map((k) => synthErrors[k]).filter(Boolean).join("; ") || undefined
                  : undefined;

                return (
                  <CockpitCell
                    key={pg.label}
                    label={pg.label}
                    status={status}
                    elapsedMs={maxElapsed}
                    runningStartMs={runningCell === cellKey ? runningStartMs ?? undefined : undefined}
                    tooltip={status === "failed" ? errorMsg : undefined}
                    onClick={() => runSynthesisPhase(phaseNum)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 우: 태스크 로그 (실행 중 + 완료) ──────────────────────────── */}
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-3">
          {/* 실행 중 */}
          {runningTasks.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                실행 중
              </h4>
              <div className="space-y-1">
                {runningTasks.map((t) => (
                  <div key={t.label} className="rounded-md bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/50 px-2.5 py-1.5">
                    <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">{t.label}</span>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t.preview}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 완료 로그 */}
          {completedTasks.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1">
                <Check className="h-3 w-3" />
                완료 ({completedTasks.length})
              </h4>
              <div className="space-y-0.5">
                {completedTasks.map((t) => (
                  <div key={t.label} className="flex items-start gap-1.5 py-1 px-1.5">
                    <Check className="h-3 w-3 shrink-0 text-emerald-500 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t.label}</span>
                      {t.elapsedMs != null && (
                        <span className="text-[9px] text-[var(--text-placeholder)] ml-1">{formatElapsed(t.elapsedMs)}</span>
                      )}
                      <p className="text-[9px] text-[var(--text-tertiary)] truncate">{t.preview}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {runningTasks.length === 0 && completedTasks.length === 0 && (
            <div className="flex items-center justify-center h-32 text-[11px] text-[var(--text-placeholder)]">
              전체 실행 또는 개별 셀을 클릭하세요
            </div>
          )}
        </div>
      </div>

      {/* ─── 완료 후 결과 리뷰 ──────────────────────────────────────────── */}
      {allComplete && (
        <div className="border-t border-[var(--border-secondary)] px-4 py-2">
          <button
            type="button"
            onClick={() => {
              closePanel();
              onReview?.();
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            결과 리뷰
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
