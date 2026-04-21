/**
 * Phase G-3: agent_sessions + agent_step_traces → OtelTrace 순수 매퍼.
 *
 * DB 의존 없이 로우 shape(session-logger.ts 의 AgentSessionParams + StepTrace[])
 * 을 받아 OTel span 배열로 변환한다. exporter 로 넘기기 위한 표준화 레이어.
 *
 * Span 규칙 (GenAI semantic conventions v1.30):
 *  - 루트 span: `agent_run ${modelId}` (kind=internal)
 *  - tool-call step: `execute_tool ${toolName}` (kind=client, parent=root)
 *  - think step: 루트 span 의 event (별도 span 없음)
 *  - text step: 루트 span 의 event
 *
 * 시간 계산: agent_sessions 에는 created_at + duration_ms 만 있고, 각 step 은
 * 상대 duration 만 저장된다. 따라서 step start 는 "이전 step end 직후" 로 근사.
 * 외부 backend 에서 순서만 유지되면 충분.
 */

import type { StepTrace, AgentSessionParams } from "@/lib/agents/session-logger";
import type {
  OtelAttribute,
  OtelEvent,
  OtelSpan,
  OtelTrace,
} from "./types";

const GEN_AI_SYSTEM = "eduatalk-agent";

function push<T>(arr: T[], value: T | undefined | null): void {
  if (value !== undefined && value !== null) arr.push(value);
}

function attr(
  key: string,
  value: string | number | boolean | null | undefined,
): OtelAttribute | null {
  if (value === undefined || value === null) return null;
  return { key, value };
}

function buildRootAttributes(p: AgentSessionParams): OtelAttribute[] {
  const out: OtelAttribute[] = [];
  push(out, attr("gen_ai.system", GEN_AI_SYSTEM));
  push(out, attr("gen_ai.operation.name", "agent_run"));
  push(out, attr("gen_ai.request.model", p.modelId));
  push(out, attr("gen_ai.response.model", p.modelId));
  push(out, attr("gen_ai.usage.input_tokens", p.totalInputTokens));
  push(out, attr("gen_ai.usage.output_tokens", p.totalOutputTokens));
  push(out, attr("gen_ai.response.finish_reasons", p.stopReason ?? null));
  push(out, attr("eduatalk.agent.total_steps", p.totalSteps));
  push(out, attr("eduatalk.agent.tenant_id", p.tenantId));
  push(out, attr("eduatalk.agent.user_id", p.userId));
  push(out, attr("eduatalk.agent.student_id", p.studentId));
  push(out, attr("eduatalk.agent.system_prompt_hash", p.systemPromptHash ?? null));
  return out;
}

function buildToolSpanAttributes(
  step: StepTrace,
  tenantId: string,
): OtelAttribute[] {
  const out: OtelAttribute[] = [];
  push(out, attr("gen_ai.system", GEN_AI_SYSTEM));
  push(out, attr("gen_ai.operation.name", "execute_tool"));
  push(out, attr("gen_ai.tool.name", step.toolName ?? null));
  if (step.toolInput !== undefined) {
    push(
      out,
      attr(
        "gen_ai.tool.arguments",
        typeof step.toolInput === "string"
          ? step.toolInput
          : JSON.stringify(step.toolInput),
      ),
    );
  }
  if (step.toolOutput !== undefined) {
    push(
      out,
      attr(
        "gen_ai.tool.result",
        typeof step.toolOutput === "string"
          ? step.toolOutput
          : JSON.stringify(step.toolOutput),
      ),
    );
  }
  push(out, attr("eduatalk.step.index", step.stepIndex));
  // G-6 Sprint 3 Gap #5: tenant scope propagation to child span.
  push(out, attr("eduatalk.agent.tenant_id", tenantId));
  return out;
}

function buildStepEvent(step: StepTrace, timestamp: number): OtelEvent {
  const attributes: OtelAttribute[] = [];
  push(attributes, attr("eduatalk.step.index", step.stepIndex));
  push(attributes, attr("eduatalk.step.type", step.stepType));
  if (step.stepType === "think") {
    push(attributes, attr("gen_ai.thought", step.reasoning ?? null));
  } else if (step.stepType === "text") {
    push(attributes, attr("gen_ai.output.message", step.textContent ?? null));
  }
  return {
    timestamp,
    name: step.stepType === "think" ? "gen_ai.think" : "gen_ai.text_output",
    attributes,
  };
}

/**
 * AgentSessionParams + StepTrace[] → OtelTrace.
 *
 * @param startTimeMs 루트 span 시작 시각(epoch ms). 호출자가 측정 시작점을
 *                    기록했으면 그것을 전달. 없으면 `Date.now()` 기반 fallback
 *                    (하지만 exporter 도달 시점이므로 약간 늦음).
 */
export function mapSessionToOtelTrace(
  params: AgentSessionParams,
  startTimeMs: number = Date.now() - (params.durationMs ?? 0),
): OtelTrace {
  const traceId = params.sessionId;
  const endTimeMs = startTimeMs + (params.durationMs ?? 0);
  const hasError = !!params.error;

  const rootSpan: OtelSpan = {
    traceId,
    spanId: traceId,
    name: `agent_run ${params.modelId}`,
    kind: "internal",
    startTimeMs,
    endTimeMs,
    status: hasError ? "error" : "ok",
    statusMessage: params.error,
    attributes: buildRootAttributes(params),
    events: [],
  };

  const childSpans: OtelSpan[] = [];
  let cursor = startTimeMs;

  for (const step of params.stepTraces) {
    const dur = step.durationMs ?? 0;
    const stepStart = cursor;
    const stepEnd = cursor + dur;

    if (step.stepType === "tool-call") {
      childSpans.push({
        traceId,
        spanId: `${traceId}-${step.stepIndex}`,
        parentSpanId: traceId,
        name: `execute_tool ${step.toolName ?? "unknown"}`,
        kind: "client",
        startTimeMs: stepStart,
        endTimeMs: stepEnd,
        status: "ok",
        attributes: buildToolSpanAttributes(step, params.tenantId),
      });
    } else {
      // think / text → root span event 로 흡수
      rootSpan.events = rootSpan.events ?? [];
      rootSpan.events.push(buildStepEvent(step, stepStart));
    }

    cursor = stepEnd;
  }

  // step durations 합이 session.durationMs 와 불일치할 수 있으나 tolerate.
  // 루트 span 의 endTimeMs 는 session.durationMs 를 신뢰한다.
  return { traceId, rootSpan, childSpans };
}
