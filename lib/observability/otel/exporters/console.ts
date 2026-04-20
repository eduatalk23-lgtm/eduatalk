/**
 * Phase G-3: Console/JSONL exporter.
 *
 * 로컬 디버깅·CI 검증용. `OTEL_CONSOLE_EXPORT=1` 일 때만 활성화.
 * 프로덕션 로그 범람을 방지하기 위해 기본 OFF.
 *
 * 출력 포맷: 한 줄 JSON (1 trace = 1 line, spans 배열 포함).
 */

import type { ExporterAdapter, OtelTrace } from "../types";

const ENV_FLAG = "OTEL_CONSOLE_EXPORT";

export function createConsoleExporter(): ExporterAdapter {
  return {
    name: "console",
    isEnabled(): boolean {
      const v = process.env[ENV_FLAG];
      return v === "1" || v === "true";
    },
    async export(trace: OtelTrace): Promise<void> {
      const payload = {
        traceId: trace.traceId,
        spans: [trace.rootSpan, ...trace.childSpans].map((s) => ({
          spanId: s.spanId,
          parentSpanId: s.parentSpanId ?? null,
          name: s.name,
          kind: s.kind,
          startTimeMs: s.startTimeMs,
          endTimeMs: s.endTimeMs,
          durationMs: s.endTimeMs - s.startTimeMs,
          status: s.status,
          statusMessage: s.statusMessage ?? null,
          attributes: s.attributes,
          events: s.events ?? [],
        })),
      };
      // 한 줄 JSONL — jq / log aggregator 친화
      console.log(`[otel] ${JSON.stringify(payload)}`);
    },
  };
}
