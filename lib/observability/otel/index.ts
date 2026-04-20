/**
 * Phase G-3: Observability 공용 진입점.
 *
 * session-logger 는 `exportAgentSession(params, startedAtMs)` 한 번 호출만 하면 된다.
 * 내부에서 enabled exporter 전부로 fan-out. 어떤 exporter 도 활성화 안 됐으면
 * no-op 으로 반환(프로덕션에서 로그 범람 방지).
 *
 * 새 exporter 추가:
 *   1. `exporters/{name}.ts` 에 `createXxxExporter()` 정의
 *   2. 아래 `buildEnabledExporters` 에 후보 추가
 *   3. env 변수로 게이트
 */

import { logActionError } from "@/lib/logging/actionLogger";
import type { AgentSessionParams } from "@/lib/agents/session-logger";

import { createConsoleExporter } from "./exporters/console";
import { createLangfuseExporter } from "./exporters/langfuse";
import { mapSessionToOtelTrace } from "./mapper";
import type { ExporterAdapter, OtelTrace } from "./types";

const LOG_CTX = { domain: "observability.otel", action: "export" };

function buildEnabledExporters(): ExporterAdapter[] {
  const candidates = [createConsoleExporter(), createLangfuseExporter()];
  return candidates.filter((e) => e.isEnabled());
}

/**
 * session-logger 가 호출. fire-and-forget 전제지만, exporter 내부 에러는
 * 잡아서 로깅만 하고 상위에 전파하지 않는다.
 */
export async function exportAgentSession(
  params: AgentSessionParams,
  startedAtMs: number,
): Promise<void> {
  const exporters = buildEnabledExporters();
  if (exporters.length === 0) return;

  let trace: OtelTrace;
  try {
    trace = mapSessionToOtelTrace(params, startedAtMs);
  } catch (e) {
    logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
    return;
  }

  await Promise.all(
    exporters.map(async (ex) => {
      try {
        await ex.export(trace);
      } catch (e) {
        logActionError(
          { ...LOG_CTX, action: `export.${ex.name}` },
          e instanceof Error ? e : new Error(String(e)),
        );
      }
    }),
  );
}

export { mapSessionToOtelTrace } from "./mapper";
export type {
  OtelSpan,
  OtelTrace,
  OtelAttribute,
  OtelEvent,
  OtelSpanKind,
  OtelStatusCode,
  ExporterAdapter,
} from "./types";
