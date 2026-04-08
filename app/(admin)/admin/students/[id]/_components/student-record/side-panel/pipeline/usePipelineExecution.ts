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
  const [isCancelling, setIsCancelling] = useState(false);
  const fullRunAbortRef = useRef(false);
  const fullRunCtrlRef = useRef<AbortController | null>(null);
  const fetchingRef = useRef(false);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
    });

  // ─── 내부 헬퍼: signal-aware fetch + abort-aware sleep ────────────────────

  async function fetchPhase(
    url: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<unknown> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    // 499: 서버가 cancelled 감지하여 응답한 custom status
    if (res.status === 499) {
      throw new DOMException("Pipeline cancelled by server", "AbortError");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

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
    // 동기 ref 가드: 이미 실행 중이거나 개별 phase fetch 중이면 무시 (race 방지)
    if (fullRunCtrlRef.current || fetchingRef.current) return;

    const ctrl = new AbortController();
    fullRunCtrlRef.current = ctrl;
    fetchingRef.current = true;
    fullRunAbortRef.current = false;
    setIsCancelling(false);
    setIsFullRunning(true);
    pollingStartRef.current = Date.now();

    const isAborted = () => fullRunAbortRef.current || ctrl.signal.aborted;

    try {
      const json = (await fetchPhase(
        "/api/admin/pipeline/grade/run",
        { studentId, tenantId },
        ctrl.signal,
      )) as {
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
        if (isAborted()) return;

        const cachedGrade = cachedStatus?.gradePipelines?.[gpItem.grade as number];
        if (cachedGrade?.status === "completed") continue;

        for (let phase = 1; phase <= 8; phase++) {
          if (isAborted()) return;

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
            while (hasMore && !isAborted()) {
              try {
                const phaseJson = (await fetchPhase(
                  `/api/admin/pipeline/grade/phase-${phase}`,
                  { pipelineId: gpItem.pipelineId, chunkSize: 4 },
                  ctrl.signal,
                )) as { hasMore?: boolean };
                hasMore = phaseJson.hasMore ?? false;
                retries = 0;
                invalidate();
              } catch (e) {
                if ((e as Error)?.name === "AbortError") return;
                retries++;
                if (retries > MAX_RETRIES) break;
                try {
                  await abortableSleep(3000, ctrl.signal);
                } catch {
                  return;
                }
              }
            }
          } else {
            for (let retry = 0; retry <= MAX_RETRIES; retry++) {
              try {
                await fetchPhase(
                  `/api/admin/pipeline/grade/phase-${phase}`,
                  { pipelineId: gpItem.pipelineId },
                  ctrl.signal,
                );
                invalidate();
                break;
              } catch (e) {
                if ((e as Error)?.name === "AbortError") return;
                if (retry >= MAX_RETRIES) break;
                try {
                  await abortableSleep(3000, ctrl.signal);
                } catch {
                  return;
                }
              }
            }
          }
        }
      }
      if (isAborted()) return;

      const sJson = (await fetchPhase(
        "/api/admin/pipeline/synthesis/run",
        { studentId, tenantId },
        ctrl.signal,
      )) as { pipelineId?: string };
      if (!sJson.pipelineId) throw new Error("Synthesis 생성 실패");
      invalidate();

      const freshStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );
      const synthTasks = freshStatus?.synthesisPipeline?.tasks ?? {};

      for (let phase = 1; phase <= 6; phase++) {
        if (isAborted()) return;

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
            await fetchPhase(
              `/api/admin/pipeline/synthesis/phase-${phase}`,
              { pipelineId: sJson.pipelineId },
              ctrl.signal,
            );
            invalidate();
            break;
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return;
            if (retry >= 2) break;
            try {
              await abortableSleep(3000, ctrl.signal);
            } catch {
              return;
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        /* swallow — UI는 폴링으로 상태 반영 */
      }
    } finally {
      fullRunCtrlRef.current = null;
      fetchingRef.current = false;
      setIsFullRunning(false);
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
      // setIsCancelling(false)는 폴링 결과 cancelled 확정 시 호출자가 useEffect로 해제
    }
  };

  // ─── 전체 실행 중단 ────────────────────────────────────────────────────────

  const stopFullRun = async (
    gp: GradeAwarePipelineStatus["gradePipelines"],
    sp: GradeAwarePipelineStatus["synthesisPipeline"],
  ) => {
    setIsCancelling(true);
    fullRunAbortRef.current = true;
    fullRunCtrlRef.current?.abort();
    // 셀 "running" 표시도 즉시 제거 (runFullSequence finally 기다리지 않음)
    setRunningCell(null);

    const allPipelineIds: string[] = [];
    for (const g of Object.keys(gp).map(Number)) {
      const pid = gp[g]?.pipelineId;
      if (pid && (gp[g]?.status === "running" || gp[g]?.status === "pending")) {
        allPipelineIds.push(pid);
      }
    }
    if (sp?.pipelineId && (sp.status === "running" || sp.status === "pending")) {
      allPipelineIds.push(sp.pipelineId);
    }

    try {
      // allSettled로 일부 실패해도 나머지 cancel 시도 유지
      await Promise.allSettled(
        allPipelineIds.map((pid) => cancelPipeline(pid)),
      );
    } catch {
      /* allSettled는 throw 안 함 — 방어적 catch */
    } finally {
      invalidate();
      // 폴링이 cancelled를 확정하지 못하는 상황(예: 404, 서버 오류) 대비 안전망
      // 일정 시간 후 isCancelling 자동 해제 (useEffect도 해제하지만 이중 방어)
      setTimeout(() => setIsCancelling(false), 5000);
    }
  };

  return {
    runningCell,
    runningStartMs,
    isFullRunning,
    isCancelling,
    setIsCancelling,
    runGradePhase,
    runSynthesisPhase,
    runFullSequence,
    stopFullRun,
  };
}
