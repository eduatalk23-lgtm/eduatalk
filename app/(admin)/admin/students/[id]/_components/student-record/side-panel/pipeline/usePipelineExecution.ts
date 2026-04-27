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
import { useToast } from "@/components/ui/ToastProvider";
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
  const { showError } = useToast();
  const [runningCell, setRunningCell] = useState<string | null>(null);
  const [runningStartMs, setRunningStartMs] = useState<number | null>(null);
  const [isFullRunning, setIsFullRunning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const fullRunAbortRef = useRef(false);
  const fullRunCtrlRef = useRef<AbortController | null>(null);
  const fetchingRef = useRef(false);
  // 클릭 쿨다운(1초) — 기존 ref 가드는 첫 fetch 가 에러로 빨리 실패할 때 해제되어
  // 재클릭을 허용한다. 쿨다운은 "에러 후 즉시 재시도"까지 막아 rate limit 카운트
  // 누수와 UI race 를 일원화 차단.
  const lastFullRunClickRef = useRef<number>(0);

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
    if (!res.ok) {
      // 서버 에러 바디에서 "error" 필드를 꺼내 사용자 메시지로 전파.
      // (기존에는 "HTTP 400"만 던져서 어떤 이유로 실패했는지 UI에 안 보였다.)
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // JSON 파싱 실패 — 기본 메시지 유지
      }
      throw new Error(message);
    }
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

      // 청크 지원 phase: P1~P3 (역량 분석) + P4 (M1-c W5 setek_guide chunk) + P7 (가안 생성) + P8 (가안 분석)
      const isChunkedPhase = phase <= 3 || phase === 4 || phase === 7 || phase === 8;
      if (isChunkedPhase) {
        let hasMore = true;
        let retries = 0;
        const chunkSize = phase === 4 ? 6 : 4;
        while (hasMore) {
          try {
            const res = await fetch(`/api/admin/pipeline/grade/phase-${phase}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pipelineId: pid, chunkSize }),
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
        // Phase 5~6: 단일 호출 + 재시도
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

      // 트랙 D (2026-04-14): Phase 2 진입 전 narrative_arc chunked 선행.
      //   Vercel 300s 벽 회피 — grade P1~P3 자기치유 청크 패턴과 동일.
      if (phase === 2) {
        const narrativeStatus = sp?.tasks?.narrative_arc_extraction;
        if (narrativeStatus !== "completed") {
          let hasMore = true;
          let retries = 0;
          while (hasMore) {
            try {
              const r = await fetch(
                "/api/admin/pipeline/synthesis/phase-2/narrative-chunk",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pipelineId: pid, chunkSize: 4 }),
                },
              );
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              const j = (await r.json()) as { hasMore?: boolean };
              hasMore = j.hasMore ?? false;
              retries = 0;
              if (hasMore) invalidate();
            } catch {
              retries++;
              if (retries > 2) break;
              await new Promise((r) => setTimeout(r, 3000));
            }
          }
        }
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

  // ─── Past Analytics Phase 실행 (개별 셀 클릭) ─────────────────────────────

  const runPastAnalyticsPhase = async (phase: number) => {
    if (fetchingRef.current) return;
    setRunningCell(`a-${phase}`);
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();

    try {
      const cached = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );
      let pid = cached?.pastAnalyticsPipeline?.pipelineId;
      if (!pid) {
        const { runPastAnalyticsPipeline } = await import(
          "@/lib/domains/student-record/actions/pipeline-orchestrator"
        );
        const r = await runPastAnalyticsPipeline(studentId, tenantId);
        if (!r.success) throw new Error(r.error ?? "Past Analytics 생성 실패");
        if (!r.data) throw new Error("Past Analytics 응답 누락");
        pid = r.data.pipelineId;
        invalidate();
      }

      for (let retry = 0; retry <= 2; retry++) {
        try {
          const res = await fetch(`/api/admin/pipeline/past-analytics/${phase}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pipelineId: pid }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          break;
        } catch {
          if (retry >= 2) break;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Past Analytics 실행 실패";
      showError(`Past Analytics ${phase} 실패: ${msg}`);
    } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

  // ─── Bootstrap Phase 실행 (개별 셀 클릭) ──────────────────────────────────
  // BT0→BT1→BT2 를 각 task 단위 route 로 순차 호출 (I1, 2026-04-26).
  // BT0 실패 시 BT1/BT2 는 cascade 차단. BT1 rate limit 미회복 시 pending 유지.

  const runBootstrapPhase = async () => {
    if (fetchingRef.current) return;
    setRunningCell("boot-1");
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();

    try {
      const cached = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );
      let pid = cached?.bootstrapPipeline?.pipelineId;
      if (!pid) {
        const { runBootstrapPipeline } = await import(
          "@/lib/domains/student-record/actions/pipeline-orchestrator-init"
        );
        const r = await runBootstrapPipeline(studentId, tenantId);
        if (!r.success) throw new Error(r.error ?? "Bootstrap 생성 실패");
        if (!r.data) throw new Error("Bootstrap 응답 누락");
        pid = r.data.pipelineId;
        invalidate();
      }

      const tasks = [
        "/api/admin/pipeline/bootstrap/task/bt0",
        "/api/admin/pipeline/bootstrap/task/bt1",
        "/api/admin/pipeline/bootstrap/task/bt2",
      ] as const;

      for (const taskUrl of tasks) {
        for (let retry = 0; retry <= 2; retry++) {
          try {
            const res = await fetch(taskUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pipelineId: pid }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            break;
          } catch {
            if (retry >= 2) break;
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        // BT0 실패 시 cascade 차단
        if (taskUrl.endsWith("/bt0")) {
          await queryClient.refetchQueries({
            queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
          });
          const status = queryClient.getQueryData<GradeAwarePipelineStatus>(
            gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
          );
          if (status?.bootstrapPipeline?.tasks?.["target_major_validation"] === "failed") {
            break;
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bootstrap 실행 실패";
      showError(`Bootstrap 실행 실패: ${msg}`);
    } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

  // ─── Blueprint Phase 실행 (개별 셀 클릭) ──────────────────────────────────

  const runBlueprintPhase = async () => {
    if (fetchingRef.current) return;
    setRunningCell("b-1");
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();

    try {
      const cached = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );
      let pid = cached?.blueprintPipeline?.pipelineId;
      if (!pid) {
        const { runBlueprintPipeline } = await import(
          "@/lib/domains/student-record/actions/pipeline-orchestrator"
        );
        const r = await runBlueprintPipeline(studentId, tenantId);
        if (!r.success) throw new Error(r.error ?? "Blueprint 생성 실패");
        if (!r.data) throw new Error("Blueprint 응답 누락");
        pid = r.data.pipelineId;
        invalidate();
      }

      for (let retry = 0; retry <= 2; retry++) {
        try {
          const res = await fetch("/api/admin/pipeline/blueprint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pipelineId: pid }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          break;
        } catch {
          if (retry >= 2) break;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Blueprint 실행 실패";
      showError(`Blueprint 실행 실패: ${msg}`);
    } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

  // ─── 공통 헬퍼: 단일 grade 파이프라인의 Phase 1~8 순차 실행 ──────────────

  async function executeGradePhasesForPipeline(
    grade: number,
    pipelineId: string,
    cachedGrade: GradeAwarePipelineStatus["gradePipelines"][number] | undefined,
    signal: AbortSignal,
    isAborted: () => boolean,
  ): Promise<"completed" | "aborted"> {
    // 이미 완료된 학년이면 스킵 (refetch 이후 진짜 상태 기반)
    if (cachedGrade?.status === "completed") return "completed";

    // 설계 모드만 Phase 7/8/9 실행. 분석 모드는 Phase 6까지.
    // P9(draft_refinement): ENABLE_DRAFT_REFINEMENT 플래그가 off이면 server-side에서 no-op(skip) 처리.
    const mode = cachedGrade?.mode ?? "analysis";
    const maxPhase = mode === "design" ? 9 : 6;

    for (let phase = 1; phase <= maxPhase; phase++) {
      if (isAborted()) return "aborted";

      const cachedTasks = cachedGrade?.tasks ?? {};
      const phaseKeys = GRADE_PHASE_GROUPS[phase - 1]?.keys ?? [];
      if (
        phaseKeys.length > 0 &&
        phaseKeys.every((k) => {
          const s = cachedTasks[k];
          return s === "completed" || s === "cached" || s === "skipped";
        })
      )
        continue;

      setRunningCell(`g-${grade}-${phase}`);
      setRunningStartMs(Date.now());

      const MAX_RETRIES = 2;
      // 청크 지원 phase: P1~P3 (역량 분석 배치) + P4 (M1-c W5 setek_guide chunk, 2026-04-27) + P7 (가안 생성 배치, B6 2026-04-15) + P8 (가안 분석 배치, 트랙 A 2026-04-14) + P9 (재생성 배치, Phase 5)
      const isChunkedPhase = phase <= 3 || phase === 4 || phase === 7 || phase === 8 || phase === 9;
      if (isChunkedPhase) {
        let hasMore = true;
        let retries = 0;
        // P4 setek_guide chunk: chunkSize=6 (24과목 → 4 chunk). P1~P3, P7~P9 는 chunkSize=4 (레코드 단위).
        const chunkSize = phase === 4 ? 6 : 4;
        while (hasMore && !isAborted()) {
          try {
            const phaseJson = (await fetchPhase(
              `/api/admin/pipeline/grade/phase-${phase}`,
              { pipelineId, chunkSize },
              signal,
            )) as { hasMore?: boolean };
            hasMore = phaseJson.hasMore ?? false;
            retries = 0;
            invalidate();
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return "aborted";
            retries++;
            if (retries > MAX_RETRIES) break;
            try {
              await abortableSleep(3000, signal);
            } catch {
              return "aborted";
            }
          }
        }
      } else {
        for (let retry = 0; retry <= MAX_RETRIES; retry++) {
          try {
            await fetchPhase(
              `/api/admin/pipeline/grade/phase-${phase}`,
              { pipelineId },
              signal,
            );
            invalidate();
            break;
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return "aborted";
            if (retry >= MAX_RETRIES) break;
            try {
              await abortableSleep(3000, signal);
            } catch {
              return "aborted";
            }
          }
        }
      }
    }
    return "completed";
  }

  // ─── 내부 헬퍼: Past Analytics A1/A2/A3 순차 실행 ────────────────────────

  async function executePastAnalyticsPhases(
    pipelineId: string,
    signal: AbortSignal,
    isAborted: () => boolean,
  ): Promise<"completed" | "aborted"> {
    for (const phase of [1, 2, 3] as const) {
      if (isAborted()) return "aborted";
      setRunningCell(`a-${phase}`);
      setRunningStartMs(Date.now());
      for (let retry = 0; retry <= 2; retry++) {
        try {
          await fetchPhase(
            `/api/admin/pipeline/past-analytics/${phase}`,
            { pipelineId },
            signal,
          );
          invalidate();
          break;
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return "aborted";
          if (retry >= 2) break;
          try {
            await abortableSleep(3000, signal);
          } catch {
            return "aborted";
          }
        }
      }
    }
    return "completed";
  }

  // ─── 내부 헬퍼: Bootstrap Phase 0 실행 ──────────────────────────────────
  // BT0→BT1→BT2 task 단위 route 순차 호출 (I1, 2026-04-26).
  // BT0 실패 시 BT1/BT2 cascade 차단. 클라이언트가 task 상태로 판단.

  async function executeBootstrapPhaseForFullRun(
    pipelineId: string,
    signal: AbortSignal,
    isAborted: () => boolean,
  ): Promise<"completed" | "aborted"> {
    setRunningCell("boot-1");
    setRunningStartMs(Date.now());

    const tasks = [
      "/api/admin/pipeline/bootstrap/task/bt0",
      "/api/admin/pipeline/bootstrap/task/bt1",
      "/api/admin/pipeline/bootstrap/task/bt2",
    ] as const;

    for (const taskUrl of tasks) {
      for (let retry = 0; retry <= 2; retry++) {
        if (isAborted()) return "aborted";
        try {
          await fetchPhase(taskUrl, { pipelineId }, signal);
          break;
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return "aborted";
          if (retry >= 2) break;
          try {
            await abortableSleep(3000, signal);
          } catch {
            return "aborted";
          }
        }
      }

      // BT0 완료 후 cascade 차단 여부 확인
      if (taskUrl.endsWith("/bt0")) {
        await queryClient.refetchQueries({
          queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
        });
        const status = queryClient.getQueryData<GradeAwarePipelineStatus>(
          gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
        );
        if (status?.bootstrapPipeline?.tasks?.["target_major_validation"] === "failed") {
          invalidate();
          return "completed";
        }
      }
    }

    invalidate();
    return "completed";
  }

  // ─── 내부 헬퍼: Blueprint B1 실행 ────────────────────────────────────────

  async function executeBlueprintPhase(
    pipelineId: string,
    signal: AbortSignal,
    isAborted: () => boolean,
  ): Promise<"completed" | "aborted"> {
    setRunningCell("b-1");
    setRunningStartMs(Date.now());
    for (let retry = 0; retry <= 2; retry++) {
      if (isAborted()) return "aborted";
      try {
        await fetchPhase(
          "/api/admin/pipeline/blueprint",
          { pipelineId },
          signal,
        );
        invalidate();
        return "completed";
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return "aborted";
        if (retry >= 2) break;
        try {
          await abortableSleep(3000, signal);
        } catch {
          return "aborted";
        }
      }
    }
    return "completed"; // 실패해도 다음 단계로 진행 — 폴링/토스트로 노출
  }

  // ─── 전체 시퀀스 실행 ─────────────────────────────────────────────────────

  const runFullSequence = async () => {
    // 쿨다운(1초) — 더블클릭 + 에러 후 즉시 재시도 차단
    const nowMs = Date.now();
    if (nowMs - lastFullRunClickRef.current < 1000) return;
    lastFullRunClickRef.current = nowMs;

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
      // ── 1. Full Orchestration: 4 파이프라인 INSERT (2026-04-16 #5) ──
      //   grade(analysis) + past_analytics + blueprint + grade(design).
      //   Synthesis는 Grade/Past/Blueprint 완료 후 별도 INSERT.
      const full = (await fetchPhase(
        "/api/admin/pipeline/full-run",
        { studentId, tenantId },
        ctrl.signal,
      )) as {
        pipelineIds?: {
          bootstrap?: string;
          gradeNeis?: string[];
          pastAnalytics?: string;
          blueprint?: string;
          gradeProspective?: string[];
        };
        route?: {
          neisGrades: number[];
          consultingGrades: number[];
          skipped: Array<"past_analytics" | "blueprint" | "bootstrap">;
        };
        error?: string;
      };
      if (!full.pipelineIds || !full.route) {
        throw new Error(full.error ?? "전체 파이프라인 시작 실패");
      }

      // refetch로 신규 파이프라인의 mode/status 반영
      await queryClient.refetchQueries({
        queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      });
      const cachedStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );

      // ── 1.5. Bootstrap Phase 0 (신규 학생 자동 셋업) ──
      //   target_major 진입 자동 셋업. 기존 학생은 pipelineIds.bootstrap 이 없을 수 있음.
      if (full.pipelineIds.bootstrap) {
        const result = await executeBootstrapPhaseForFullRun(
          full.pipelineIds.bootstrap,
          ctrl.signal,
          isAborted,
        );
        if (result === "aborted") return;

        // Bootstrap 완료 후 BT1(main_exploration_seed) 실패 여부 확인.
        // 실패 시 Blueprint/Design Grade 단계가 메인 탐구 없이 실행되면 silent 빈 결과가 생성되므로 차단.
        await queryClient.refetchQueries({
          queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
        });
        const bootStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
          gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
        );
        const bt1Status = bootStatus?.bootstrapPipeline?.tasks?.["main_exploration_seed"];
        if (bt1Status === "failed") {
          showError(
            "메인 탐구 설정(BT1) 실패 — 전공 정보를 확인한 후 Bootstrap을 재실행하거나 메인 탐구를 직접 설정해주세요.",
          );
          return;
        }
      }

      // ── 2. Grade(analysis) 학년별 실행 ──
      for (const grade of full.route.neisGrades) {
        if (isAborted()) return;
        const cachedGrade = cachedStatus?.gradePipelines?.[grade];
        if (!cachedGrade) continue;
        const result = await executeGradePhasesForPipeline(
          grade,
          cachedGrade.pipelineId,
          cachedGrade,
          ctrl.signal,
          isAborted,
        );
        if (result === "aborted") return;
      }
      if (isAborted()) return;

      // ── 3. Past Analytics A1/A2/A3 (neisGrades ≥ 1일 때만) ──
      if (full.pipelineIds.pastAnalytics) {
        const result = await executePastAnalyticsPhases(
          full.pipelineIds.pastAnalytics,
          ctrl.signal,
          isAborted,
        );
        if (result === "aborted") return;
      }

      // ── 4. Blueprint B1 (consultingGrades ≥ 1일 때만) ──
      if (full.pipelineIds.blueprint) {
        const result = await executeBlueprintPhase(
          full.pipelineIds.blueprint,
          ctrl.signal,
          isAborted,
        );
        if (result === "aborted") return;
      }

      // ── 5. Grade(design) 학년별 실행 ──
      //   Blueprint 산출물을 P7(draft_generation)에서 주입하므로 Blueprint 이후 실행.
      if (full.route.consultingGrades.length > 0) {
        await queryClient.refetchQueries({
          queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
        });
        const designStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
          gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
        );
        // gradeProspective 배열은 consultingGrades 순서와 동일하게 매핑된 pipelineId 목록.
        const prospectiveIds = full.pipelineIds.gradeProspective ?? [];
        for (let i = 0; i < full.route.consultingGrades.length; i++) {
          const grade = full.route.consultingGrades[i];
          if (isAborted()) return;
          const cachedGrade = designStatus?.gradePipelines?.[grade];
          // 캐시 미스 시: refetch 타이밍 문제일 수 있으므로 gradeProspective에서 직접 pipelineId 사용.
          const pipelineId = cachedGrade?.pipelineId ?? prospectiveIds[i];
          if (!pipelineId) continue;
          const result = await executeGradePhasesForPipeline(
            grade,
            pipelineId,
            cachedGrade,
            ctrl.signal,
            isAborted,
          );
          if (result === "aborted") return;
        }
      }
      if (isAborted()) return;

      const sJson = (await fetchPhase(
        "/api/admin/pipeline/synthesis/run",
        { studentId, tenantId },
        ctrl.signal,
      )) as { pipelineId?: string };
      if (!sJson.pipelineId) throw new Error("Synthesis 생성 실패");

      // Synthesis도 완료 Phase 스킵을 위해 동기 refetch
      await queryClient.refetchQueries({
        queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      });
      const freshStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );
      const synthTasks = freshStatus?.synthesisPipeline?.tasks ?? {};

      for (let phase = 1; phase <= 7; phase++) {
        if (isAborted()) return;

        const synthPhaseKeys = SYNTHESIS_PHASE_GROUPS[phase - 1]?.keys ?? [];
        if (
          synthPhaseKeys.length > 0 &&
          synthPhaseKeys.every((k) => {
            const s = synthTasks[k];
            return s === "completed" || s === "cached" || s === "skipped";
          })
        )
          continue;

        setRunningCell(`s-${phase}`);
        setRunningStartMs(Date.now());

        // 트랙 D (2026-04-14): Phase 2 진입 전 narrative_arc chunked 선행.
        //   Vercel 300s 벽 회피 — 자기치유 청크 패턴 (DB 캐시가 진실 소스).
        if (phase === 2 && synthTasks.narrative_arc_extraction !== "completed") {
          let nHasMore = true;
          let nRetries = 0;
          while (nHasMore && !isAborted()) {
            try {
              const nJson = (await fetchPhase(
                "/api/admin/pipeline/synthesis/phase-2/narrative-chunk",
                { pipelineId: sJson.pipelineId, chunkSize: 4 },
                ctrl.signal,
              )) as { hasMore?: boolean };
              nHasMore = nJson.hasMore ?? false;
              nRetries = 0;
              if (nHasMore) invalidate();
            } catch (e) {
              if ((e as Error)?.name === "AbortError") return;
              nRetries++;
              if (nRetries > 2) break;
              try {
                await abortableSleep(3000, ctrl.signal);
              } catch {
                return;
              }
            }
          }
          invalidate();
        }

        for (let retry = 0; retry <= 2; retry++) {
          try {
            await fetchPhase(
              `/api/admin/pipeline/synthesis/phase-${phase}`,
              { pipelineId: sJson.pipelineId },
              ctrl.signal,
            );
            invalidate();

            // D6(M7): Phase 2(guide_matching) 완료 후 queued_generation 가이드 전문 생성
            if (phase === 2) {
              try {
                let remaining = 1;
                while (remaining > 0 && !isAborted()) {
                  const genRes = await fetchPhase(
                    "/api/admin/pipeline/ai-guide-gen",
                    {},
                    ctrl.signal,
                  ) as { remainingQueued?: number };
                  remaining = genRes?.remainingQueued ?? 0;
                }
              } catch {
                // AI 가이드 생성 실패는 치명적이지 않음 — 계속 진행
              }
              invalidate();
            }

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
        // 서버/네트워크 에러를 사용자에게 노출. (silent swallow 제거)
        // 이전에는 "왜 막혔는지" 피드백 없이 버튼만 잠긴 채로 남아 디버깅 불가.
        const msg = e instanceof Error ? e.message : "파이프라인 실행 실패";
        showError(`파이프라인 실행 실패: ${msg}`);
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

  // ─── 학년 단위 전체 실행 ──────────────────────────────────────────────────
  // 특정 학년의 Phase 1~6 (설계 모드면 1~8) 순차 실행. Synthesis는 진행하지 않음.

  const runGradeSequence = async (grade: number) => {
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
      // 해당 학년만 생성/resume
      const json = (await fetchPhase(
        "/api/admin/pipeline/grade/run",
        { studentId, tenantId, grades: [grade] },
        ctrl.signal,
      )) as {
        gradePipelines?: Array<{ grade: number; pipelineId: string }>;
        error?: string;
      };
      if (!json.gradePipelines) throw new Error(json.error ?? "시작 실패");

      await queryClient.refetchQueries({
        queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      });
      const cachedStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );

      const target = json.gradePipelines.find((g) => g.grade === grade);
      if (!target) return;

      const cachedGrade = cachedStatus?.gradePipelines?.[grade];
      await executeGradePhasesForPipeline(
        grade,
        target.pipelineId,
        cachedGrade,
        ctrl.signal,
        isAborted,
      );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        // silent swallow 제거 — 학년별 실행 실패 시 사용자에게 알림
        const msg = e instanceof Error ? e.message : "학년 실행 실패";
        showError(`${grade}학년 실행 실패: ${msg}`);
      }
    } finally {
      fullRunCtrlRef.current = null;
      fetchingRef.current = false;
      setIsFullRunning(false);
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

  // ─── 전체 실행 중단 ────────────────────────────────────────────────────────

  const stopFullRun = async (
    gp: GradeAwarePipelineStatus["gradePipelines"],
    sp: GradeAwarePipelineStatus["synthesisPipeline"],
    pa?: GradeAwarePipelineStatus["pastAnalyticsPipeline"],
    bp?: GradeAwarePipelineStatus["blueprintPipeline"],
    boot?: GradeAwarePipelineStatus["bootstrapPipeline"],
  ) => {
    setIsCancelling(true);
    fullRunAbortRef.current = true;
    fullRunCtrlRef.current?.abort();
    // 셀 "running" 표시도 즉시 제거 (runFullSequence finally 기다리지 않음)
    setRunningCell(null);

    const allPipelineIds: string[] = [];
    const isInflight = (s: string | undefined) => s === "running" || s === "pending";

    for (const g of Object.keys(gp).map(Number)) {
      const pid = gp[g]?.pipelineId;
      if (pid && isInflight(gp[g]?.status)) {
        allPipelineIds.push(pid);
      }
    }
    if (sp?.pipelineId && isInflight(sp.status)) {
      allPipelineIds.push(sp.pipelineId);
    }
    // 4축×3층 A/B층: orchestrator가 큐잉한 past_analytics/blueprint도 함께 cancel.
    // 호출자가 인자로 넘기지 않으면 최신 캐시에서 직접 조회 (하위 호환).
    const status = queryClient.getQueryData<GradeAwarePipelineStatus>(
      gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
    );
    const past = pa ?? status?.pastAnalyticsPipeline ?? null;
    const blueprint = bp ?? status?.blueprintPipeline ?? null;
    const bootstrap = boot ?? status?.bootstrapPipeline ?? null;
    if (past?.pipelineId && isInflight(past.status)) {
      allPipelineIds.push(past.pipelineId);
    }
    if (blueprint?.pipelineId && isInflight(blueprint.status)) {
      allPipelineIds.push(blueprint.pipelineId);
    }
    if (bootstrap?.pipelineId && isInflight(bootstrap.status)) {
      allPipelineIds.push(bootstrap.pipelineId);
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
    runPastAnalyticsPhase,
    runBlueprintPhase,
    runBootstrapPhase,
    runFullSequence,
    runGradeSequence,
    stopFullRun,
  };
}
