"use client";

// ============================================
// 파이프라인 실행 로직 훅
// runGradePhase / runSynthesisPhase / runFullSequence + 중단 처리
// ============================================

import { useState, useRef, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  gradeAwarePipelineStatusQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";
import { cancelPipeline } from "@/lib/domains/student-record/actions/pipeline";
import {
  GRADE_PHASE_GROUPS,
  SYNTHESIS_PHASE_GROUPS,
} from "./pipeline-constants";
import type { GradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-types";

interface UsePipelineExecutionOptions {
  studentId: string;
  tenantId: string;
  pollingStartRef: MutableRefObject<number | null>;
}

export function usePipelineExecution({
  studentId,
  tenantId,
  pollingStartRef,
}: UsePipelineExecutionOptions) {
  const queryClient = useQueryClient();
  const [runningCell, setRunningCell] = useState<string | null>(null);
  const [runningStartMs, setRunningStartMs] = useState<number | null>(null);
  const [isFullRunning, setIsFullRunning] = useState(false);
  const fullRunAbortRef = useRef(false);
  const fetchingRef = useRef(false);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
    });

  // ─── Grade Phase 실행 ──────────────────────────────────────────────────────

  const runGradePhase = async (grade: number, phase: number) => {
    if (fetchingRef.current) return;
    setRunningCell(`g-${grade}-${phase}`);
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();

    const gp = queryClient.getQueryData<GradeAwarePipelineStatus>(
      gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
    )?.gradePipelines ?? {};

    try {
      let pid = gp[grade]?.pipelineId;
      if (!pid) {
        const { runGradePipeline } = await import(
          "@/lib/domains/student-record/actions/pipeline-orchestrator"
        );
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
            retries = 0;
            if (hasMore) invalidate();
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
    } catch {
      /* 최종 실패 — 폴링으로 반영 */
    } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
      // S6-3: Grade Phase 완료 시 진단/리포트 캐시 무효화
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

  // ─── Synthesis Phase 실행 ─────────────────────────────────────────────────

  const runSynthesisPhase = async (phase: number) => {
    if (fetchingRef.current) return;
    setRunningCell(`s-${phase}`);
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();

    const sp = queryClient.getQueryData<GradeAwarePipelineStatus>(
      gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
    )?.synthesisPipeline ?? null;

    try {
      let pid = sp?.pipelineId;
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
    } catch {
      /* */
    } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

  // ─── 전체 시퀀스 실행 ─────────────────────────────────────────────────────

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

      // 캐시된 파이프라인 상태를 가져와서 완료된 Phase 스킵 (이어서 실행)
      await queryClient.invalidateQueries({
        queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      });
      const cachedStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );

      for (const gpItem of json.gradePipelines) {
        if (fullRunAbortRef.current) return;

        const cachedGrade = cachedStatus?.gradePipelines?.[gpItem.grade as number];
        if (cachedGrade?.status === "completed") continue;

        for (let phase = 1; phase <= 8; phase++) {
          if (fullRunAbortRef.current) return;

          const cachedTasks = cachedGrade?.tasks ?? {};
          const phaseKeys = GRADE_PHASE_GROUPS[phase - 1]?.keys ?? [];
          if (
            phaseKeys.length > 0 &&
            phaseKeys.every((k) => cachedTasks[k] === "completed")
          )
            continue;

          setRunningCell(`g-${gpItem.grade}-${phase}`);
          setRunningStartMs(Date.now());

          const MAX_RETRIES = 2;
          if (phase <= 3) {
            let hasMore = true;
            let retries = 0;
            while (hasMore && !fullRunAbortRef.current) {
              try {
                const phaseRes = await fetch(
                  `/api/admin/pipeline/grade/phase-${phase}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pipelineId: gpItem.pipelineId,
                      chunkSize: 4,
                    }),
                  },
                );
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
            for (let retry = 0; retry <= MAX_RETRIES; retry++) {
              try {
                const phaseRes = await fetch(
                  `/api/admin/pipeline/grade/phase-${phase}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pipelineId: gpItem.pipelineId }),
                  },
                );
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

      const freshStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );
      const synthTasks = freshStatus?.synthesisPipeline?.tasks ?? {};

      for (let phase = 1; phase <= 6; phase++) {
        if (fullRunAbortRef.current) return;

        const synthPhaseKeys = SYNTHESIS_PHASE_GROUPS[phase - 1]?.keys ?? [];
        if (
          synthPhaseKeys.length > 0 &&
          synthPhaseKeys.every((k) => synthTasks[k] === "completed")
        )
          continue;

        setRunningCell(`s-${phase}`);
        setRunningStartMs(Date.now());
        for (let retry = 0; retry <= 2; retry++) {
          try {
            const synthPhaseRes = await fetch(
              `/api/admin/pipeline/synthesis/phase-${phase}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pipelineId: sJson.pipelineId }),
              },
            );
            if (!synthPhaseRes.ok)
              throw new Error(`HTTP ${synthPhaseRes.status}`);
            invalidate();
            break;
          } catch {
            if (retry >= 2) break;
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    } catch {
      /* */
    } finally {
      setIsFullRunning(false);
      setRunningCell(null);
      invalidate();
    }
  };

  // ─── 전체 실행 중단 ────────────────────────────────────────────────────────

  const stopFullRun = async (
    gp: GradeAwarePipelineStatus["gradePipelines"],
    sp: GradeAwarePipelineStatus["synthesisPipeline"],
  ) => {
    fullRunAbortRef.current = true;
    const allPipelineIds: string[] = [];
    for (const g of Object.keys(gp).map(Number)) {
      const pid = gp[g]?.pipelineId;
      if (pid && gp[g]?.status === "running") allPipelineIds.push(pid);
    }
    if (sp?.pipelineId && sp.status === "running")
      allPipelineIds.push(sp.pipelineId);
    await Promise.all(allPipelineIds.map((pid) => cancelPipeline(pid)));
    invalidate();
  };

  return {
    runningCell,
    runningStartMs,
    isFullRunning,
    runGradePhase,
    runSynthesisPhase,
    runFullSequence,
    stopFullRun,
  };
}
