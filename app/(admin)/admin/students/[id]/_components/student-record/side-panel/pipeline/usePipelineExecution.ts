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
import { fetchAiGuideStatusAction } from "@/lib/domains/guide/actions/crud";
import { useToast } from "@/components/ui/ToastProvider";
import { GRADE_PHASE_GROUPS } from "./pipeline-constants";
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
  const { showError, showInfo } = useToast();
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

  // ai-guide-gen 라우트가 202 로 응답한 뒤 background 본문 생성 완료까지 폴링.
  // ECONNRESET / abort 와 무관하게 DB status 가 진실원.
  // 6분 deadline — Vercel 300s 한도 + 여유. 초과 시 timeout 으로 실패 취급.
  async function waitForAiGuideTerminal(
    guideId: string,
    signal: AbortSignal,
  ): Promise<"completed" | "failed" | "timeout"> {
    const deadline = Date.now() + 6 * 60 * 1000;
    while (Date.now() < deadline) {
      try {
        await abortableSleep(4000, signal);
      } catch {
        return "timeout"; // abort
      }
      const r = await fetchAiGuideStatusAction(guideId);
      if (!r.success) continue;
      const s = r.data.status;
      if (s === "pending_approval" || s === "approved") return "completed";
      if (s === "ai_failed") return "failed";
    }
    return "timeout";
  }

  // P1-1: 풀런/synthesis 시퀀스가 phase 2 안에서 본문 생성을 시리얼 처리하면 LLM 본문 1건당
  // 4~5분 × N 건이 phase 3~7 진입을 막아 사용자에게 "synthesis phase 2 진행중 무한" 으로 보였다.
  // 메타 row 까지만 phase 2 task 로 마감하고 본문 생성은 시퀀스 종료 후 background 로 이관.
  // 진행률은 P0-2 aiGuideProgress 배지가 노출. 사용자가 PendingApproval 일괄 버튼으로 재개 가능.
  async function runAiGuideBodyGenBackground(signal: AbortSignal) {
    try {
      while (!signal.aborted) {
        const res = await fetch("/api/admin/pipeline/ai-guide-gen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal,
        });
        if (!res.ok && res.status !== 202) break;
        const json = (await res.json()) as {
          accepted?: boolean;
          completed?: boolean;
          guideId?: string;
          remainingQueued?: number;
        };
        if (json?.completed) break;
        if (json?.accepted && json.guideId) {
          await waitForAiGuideTerminal(json.guideId, signal);
          invalidate();
          if (!json.remainingQueued || json.remainingQueued <= 0) break;
          continue;
        }
        break;
      }
    } catch {
      // background — silent. 사용자는 PendingApproval 에서 재시도 가능.
    } finally {
      invalidate();
    }
  }

  // ─── Grade Pre-Task 실행 (Phase 3.5 사전 분석 4종) ────────────────────────
  // phase-4-pre route 를 단독 호출하여 cross_subject / volunteer / awards / derive_main_theme 실행.
  // "전체 실행" 시퀀스에서는 executeGradePhasesForPipeline 내부에서 phase===4 직전에 자동 호출되므로
  // 이 핸들러는 개별 셀 클릭 및 "재실행" 버튼 전용.

  const runGradePreTask = async (grade: number) => {
    if (fetchingRef.current) return;
    // pre-task 4종을 하나의 cellKey 로 묶어 실행 상태 표시
    setRunningCell(`g-${grade}-pre`);
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
      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        try {
          const res = await fetch("/api/admin/pipeline/grade/phase-4-pre", {
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
    } catch {
      /* 최종 실패 — 폴링으로 반영 */
    } finally {
      fetchingRef.current = false;
      setRunningCell(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  };

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

    // M1-c W6 hotfix (2026-04-28): synthesis prereq UX — 모든 학년 완료 후만 가능.
    const status = queryClient.getQueryData<GradeAwarePipelineStatus>(
      gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
    );
    const grades = Object.values(status?.gradePipelines ?? {});
    if (grades.length === 0 || !grades.every((p) => p.status === "completed")) {
      showInfo("종합 파이프라인은 1·2·3학년 모두 완료 후 가능합니다");
      return;
    }

    setRunningCell(`s-${phase}`);
    setRunningStartMs(Date.now());
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();

    const sp = status?.synthesisPipeline ?? null;

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
      // M1-c W6 (2026-04-28): haengteuk_linking 도 chunked sub-route 추가 — narrative 다음.
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

        // M1-c W6: haengteuk_linking chunked. guide_matching 완료 후 가능하지만
        // phase-2 main 이 guide_matching 까지 처리하므로 이 시점엔 main 호출 후 cleanup 단계에 둘 수도.
        // 단순화: phase-2 main 호출 직전엔 narrative 만 chunked, haengteuk 는 phase-2 main 후 cleanup.
        // 사실 phase-2 main 안에서 guide_matching 까지 처리. haengteuk_linking 만 main 에서 fail 했음.
        // → main 안의 haengteuk_linking 호출이 chunked variant 경로를 사용하지 않게 skip 하고,
        //   클라이언트가 main 후 별도 chunk loop 호출 패턴.
        // 단 이번 fix 는 main 안의 haengteuk_linking 가 task=completed 면 skip 하도록 변경됨.
        // → 클라이언트가 main 호출 전 chunk loop 으로 haengteuk task=completed 마킹.
        const haengteukStatus = sp?.tasks?.haengteuk_linking;
        if (haengteukStatus !== "completed") {
          let hasMore = true;
          let retries = 0;
          while (hasMore) {
            try {
              const r = await fetch(
                "/api/admin/pipeline/synthesis/phase-2/haengteuk-chunk",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pipelineId: pid, chunkSize: 1 }),
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

      // Phase 5 진입 전: activity_summary 를 학년 단위 chunked sub-route 로 선행 처리.
      // 단일 3년 LLM 호출(~240s) → 학년별 ~60s 호출 3회로 분산 → 240s wall 안전 회피.
      if (phase === 5) {
        const activitySummaryStatus = sp?.tasks?.activity_summary;
        if (activitySummaryStatus !== "completed") {
          let hasMore = true;
          let retries = 0;
          while (hasMore) {
            try {
              const r = await fetch(
                "/api/admin/pipeline/synthesis/phase-5/activity-summary-chunk",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pipelineId: pid }),
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

      // M1-c W6 (2026-04-27): phase=4 진입 직전 phase-4-pre 1회 선행 호출.
      // pre-task 4종 (cross_subject + volunteer + awards + derive_main_theme) 분리 → route timeout 압박 해소.
      if (phase === 4) {
        for (let preRetry = 0; preRetry <= MAX_RETRIES; preRetry++) {
          try {
            await fetchPhase(
              `/api/admin/pipeline/grade/phase-4-pre`,
              { pipelineId },
              signal,
            );
            invalidate();
            break;
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return "aborted";
            if (preRetry >= MAX_RETRIES) break;
            try {
              await abortableSleep(3000, signal);
            } catch {
              return "aborted";
            }
          }
        }
        if (isAborted()) return "aborted";
      }

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

      // M1-c W6 hotfix (2026-04-28): synthesis prereq UX 개선.
      // grade 모두 completed 안 됐으면 synthesis 호출 안 하고 안내 토스트 (실패 X).
      // 이전엔 backend prereq fail → throw → "파이프라인 실행 실패" 일반 토스트로 노출.
      await queryClient.refetchQueries({
        queryKey: gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      });
      const preSynthStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
        gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
      );
      const gradePipelines = Object.values(preSynthStatus?.gradePipelines ?? {});
      const allGradesCompleted = gradePipelines.length > 0 && gradePipelines.every(
        (p) => p.status === "completed",
      );
      if (!allGradesCompleted) {
        showInfo("종합 파이프라인은 1·2·3학년 모두 완료 후 가능합니다");
        return;
      }

      const sJson = (await fetchPhase(
        "/api/admin/pipeline/synthesis/run",
        { studentId, tenantId },
        ctrl.signal,
      )) as { pipelineId?: string };
      if (!sJson.pipelineId) throw new Error("Synthesis 생성 실패");

      // fetchGradeAwarePipelineStatus 는 task-level union (이전 풀런 completed 합산) 을 반환한다.
      // 이것을 phase skip 판정에 사용하면 클라이언트는 "phase 1~3 완료" 로 보지만 서버 prereq 검증은
      // 새 row 단독 view(전부 pending) → 409 → 풀런 차단. (client/server view mismatch)
      // → 새 synthesis 세션에서는 phase skip 을 비활성화하고 phase 1 부터 순차 실행한다.
      //   각 phase 는 content_hash 기반 cache 로 빠르게 통과한다 (LLM 미호출).
      for (let phase = 1; phase <= 7; phase++) {
        if (isAborted()) return;

        setRunningCell(`s-${phase}`);
        setRunningStartMs(Date.now());

        // 트랙 D (2026-04-14): Phase 2 진입 전 narrative_arc chunked 선행.
        //   Vercel 300s 벽 회피 — 자기치유 청크 패턴 (DB 캐시가 진실 소스).
        // M1-c W6 (2026-04-28): haengteuk_linking 도 chunked sub-route 추가.
        // synthTasks 는 task-level union 이라 이전 풀런 completed 가 섞여있음 — 새 row 기준으로
        // 판정 불가하므로 무조건 호출. 청크 엔드포인트가 내부 cache 로 빠르게 회전.
        if (phase === 2) {
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

        // M1-c W6: haengteuk_linking chunked sub-route 선행 (narrative 패턴 mimic).
        // chunk runner 는 학년 단위 행특 가이드 + assignments 조회 — guide_matching 결과 직접 의존 X.
        // task='completed' 마킹되면 phase-2 main 안의 haengteuk_linking 호출 skip.
        if (phase === 2) {
          let hHasMore = true;
          let hRetries = 0;
          while (hHasMore && !isAborted()) {
            try {
              const hJson = (await fetchPhase(
                "/api/admin/pipeline/synthesis/phase-2/haengteuk-chunk",
                { pipelineId: sJson.pipelineId, chunkSize: 1 },
                ctrl.signal,
              )) as { hasMore?: boolean };
              hHasMore = hJson.hasMore ?? false;
              hRetries = 0;
              if (hHasMore) invalidate();
            } catch (e) {
              if ((e as Error)?.name === "AbortError") return;
              hRetries++;
              if (hRetries > 2) break;
              try {
                await abortableSleep(3000, ctrl.signal);
              } catch {
                return;
              }
            }
          }
          invalidate();
        }

        // Phase 5 진입 전: activity_summary 를 학년 단위 chunked sub-route 로 선행 처리.
        // 단일 3년 LLM 호출(~240s) → 학년별 ~60s 호출 3회로 분산 → 240s wall 안전 회피.
        // task='completed' 마킹되면 phase-5 main 안의 activity_summary 호출 skip.
        if (phase === 5) {
          let aHasMore = true;
          let aRetries = 0;
          while (aHasMore && !isAborted()) {
            try {
              const aJson = (await fetchPhase(
                "/api/admin/pipeline/synthesis/phase-5/activity-summary-chunk",
                { pipelineId: sJson.pipelineId },
                ctrl.signal,
              )) as { hasMore?: boolean };
              aHasMore = aJson.hasMore ?? false;
              aRetries = 0;
              if (aHasMore) invalidate();
            } catch (e) {
              if ((e as Error)?.name === "AbortError") return;
              aRetries++;
              if (aRetries > 2) break;
              try {
                await abortableSleep(3000, ctrl.signal);
              } catch {
                return;
              }
            }
          }
          invalidate();
        }

        let lastErr: unknown = null;
        for (let retry = 0; retry <= 2; retry++) {
          try {
            await fetchPhase(
              `/api/admin/pipeline/synthesis/phase-${phase}`,
              { pipelineId: sJson.pipelineId },
              ctrl.signal,
            );
            invalidate();

            // P1-1: phase 2 (guide_matching) 완료 후 본문 생성은 시퀀스 종료 후 background 로 이관.
            // 여기서는 task='completed' 만 확인하고 phase 3 진입.

            lastErr = null;
            break;
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return;
            lastErr = e;
            if (retry >= 2) break;
            try {
              await abortableSleep(3000, ctrl.signal);
            } catch {
              return;
            }
          }
        }
        // 재시도 소진. 선행 phase 미완료(409) 또는 영구 에러 — 다음 phase 로 silent 진행 시
        // 후속 phase 가 같은 이유로 모두 409 → 사용자에겐 "스킵된 채 풀런 종료" 로 보인다.
        // 풀런 전체를 중단하고 outer catch 가 사용자에게 에러를 노출하도록 throw.
        // 단, throw 전에 synthesis 파이프라인을 cancelled 로 마킹하여 다른 액션 버튼이
        // running 상태에 갇히지 않도록 한다 (heartbeat 5분 대기 회피).
        if (lastErr) {
          try {
            const { cancelPipeline } = await import(
              "@/lib/domains/student-record/actions/pipeline"
            );
            await cancelPipeline(sJson.pipelineId);
          } catch {
            // cancel 실패는 치명적 아님 — heartbeat 가 결국 처리
          }
          throw lastErr;
        }
      }
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });

      // P1-1: synthesis 시퀀스 완료 후 가이드 본문 생성을 background 로 fire-and-forget.
      // 시퀀스의 ctrl.signal 을 공유하므로 사용자가 cancel 하면 자연스레 중단.
      // 진행률은 aiGuideProgress 배지가 노출 (P0-2).
      void runAiGuideBodyGenBackground(ctrl.signal);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
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

  // ─── Synthesis 단독 전체 실행 ─────────────────────────────────────────────
  // 1·2·3학년 모두 완료된 상태에서 synthesis phase 1~7 만 순차 실행.
  // fullRunCtrlRef / fetchingRef / isFullRunning 을 runFullSequence 와 공유하여 동시 실행 자연 차단.

  const runSynthesisSequence = async () => {
    if (fullRunCtrlRef.current || fetchingRef.current) return;

    // prereq 체크: 1·2·3학년 모두 completed 여야 synthesis 진행 가능
    const preStatus = queryClient.getQueryData<GradeAwarePipelineStatus>(
      gradeAwarePipelineStatusQueryOptions(studentId).queryKey,
    );
    const gradePipelinesForCheck = Object.values(preStatus?.gradePipelines ?? {});
    if (
      gradePipelinesForCheck.length === 0 ||
      !gradePipelinesForCheck.every((p) => p.status === "completed")
    ) {
      showInfo("종합 파이프라인은 1·2·3학년 모두 완료 후 가능합니다");
      return;
    }

    const ctrl = new AbortController();
    fullRunAbortRef.current = false;
    setIsCancelling(false);
    setIsFullRunning(true);
    fullRunCtrlRef.current = ctrl;
    fetchingRef.current = true;
    pollingStartRef.current = Date.now();

    const isAborted = () => fullRunAbortRef.current || ctrl.signal.aborted;

    try {
      // synthesis/run 호출 — 신규 파이프라인 row INSERT (또는 기존 resume)
      const sJson = (await fetchPhase(
        "/api/admin/pipeline/synthesis/run",
        { studentId, tenantId },
        ctrl.signal,
      )) as { pipelineId?: string };
      if (!sJson.pipelineId) throw new Error("Synthesis 생성 실패");

      // 새 synthesis 세션에서는 phase skip 을 비활성화하고 phase 1 부터 순차 실행.
      // 각 phase 는 content_hash 기반 cache 로 이미 완료된 부분은 빠르게 통과.
      for (let phase = 1; phase <= 7; phase++) {
        if (isAborted()) return;

        setRunningCell(`s-${phase}`);
        setRunningStartMs(Date.now());

        // Phase 2: narrative_arc chunked 선행 (Vercel 300s 벽 회피)
        if (phase === 2) {
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

        // Phase 2: haengteuk_linking chunked sub-route 선행
        if (phase === 2) {
          let hHasMore = true;
          let hRetries = 0;
          while (hHasMore && !isAborted()) {
            try {
              const hJson = (await fetchPhase(
                "/api/admin/pipeline/synthesis/phase-2/haengteuk-chunk",
                { pipelineId: sJson.pipelineId, chunkSize: 1 },
                ctrl.signal,
              )) as { hasMore?: boolean };
              hHasMore = hJson.hasMore ?? false;
              hRetries = 0;
              if (hHasMore) invalidate();
            } catch (e) {
              if ((e as Error)?.name === "AbortError") return;
              hRetries++;
              if (hRetries > 2) break;
              try {
                await abortableSleep(3000, ctrl.signal);
              } catch {
                return;
              }
            }
          }
          invalidate();
        }

        // Phase 5: activity_summary chunked sub-route 선행
        if (phase === 5) {
          let aHasMore = true;
          let aRetries = 0;
          while (aHasMore && !isAborted()) {
            try {
              const aJson = (await fetchPhase(
                "/api/admin/pipeline/synthesis/phase-5/activity-summary-chunk",
                { pipelineId: sJson.pipelineId },
                ctrl.signal,
              )) as { hasMore?: boolean };
              aHasMore = aJson.hasMore ?? false;
              aRetries = 0;
              if (aHasMore) invalidate();
            } catch (e) {
              if ((e as Error)?.name === "AbortError") return;
              aRetries++;
              if (aRetries > 2) break;
              try {
                await abortableSleep(3000, ctrl.signal);
              } catch {
                return;
              }
            }
          }
          invalidate();
        }

        let lastErr: unknown = null;
        for (let retry = 0; retry <= 2; retry++) {
          try {
            await fetchPhase(
              `/api/admin/pipeline/synthesis/phase-${phase}`,
              { pipelineId: sJson.pipelineId },
              ctrl.signal,
            );
            invalidate();

            // P1-1: phase 2 본문 생성은 시퀀스 종료 후 background 로 이관.

            lastErr = null;
            break;
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return;
            lastErr = e;
            if (retry >= 2) break;
            try {
              await abortableSleep(3000, ctrl.signal);
            } catch {
              return;
            }
          }
        }

        if (lastErr) {
          try {
            await cancelPipeline(sJson.pipelineId);
          } catch {
            // cancel 실패는 치명적 아님 — heartbeat 가 결국 처리
          }
          throw lastErr;
        }
      }
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });

      // P1-1: synthesis 단독 시퀀스도 동일하게 background 본문 생성을 fire-and-forget.
      void runAiGuideBodyGenBackground(ctrl.signal);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        const msg = e instanceof Error ? e.message : "종합 파이프라인 실행 실패";
        showError(`종합 파이프라인 실행 실패: ${msg}`);
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
    runGradePreTask,
    runGradePhase,
    runSynthesisPhase,
    runSynthesisSequence,
    runPastAnalyticsPhase,
    runBlueprintPhase,
    runBootstrapPhase,
    runFullSequence,
    runGradeSequence,
    stopFullRun,
  };
}
