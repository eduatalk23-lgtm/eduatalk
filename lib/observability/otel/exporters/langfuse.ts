/**
 * Phase G-3: Langfuse exporter 스켈레톤.
 *
 * 현재는 env 게이트 + 매핑 검증용 로깅만. 실제 HTTP 전송(`POST
 * /api/public/traces`) 은 후속(G-4 실호출 trace 검증 단계) 에서 연결.
 *
 * 활성화 조건: `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` + `LANGFUSE_HOST`
 *   세 환경변수 모두 설정.
 *
 * 향후 확장 지점:
 *   - Basic auth header (pk + sk base64)
 *   - Ingestion batch (Langfuse 는 /api/public/ingestion 이벤트 배치 지원)
 *   - Retry + deduplication (id = traceId)
 */

import { logActionDebug } from "@/lib/logging/actionLogger";
import type { ExporterAdapter, OtelTrace } from "../types";

const LOG_CTX = { domain: "observability.otel", action: "langfuse-export" };

export function createLangfuseExporter(): ExporterAdapter {
  return {
    name: "langfuse",
    isEnabled(): boolean {
      return (
        !!process.env.LANGFUSE_PUBLIC_KEY &&
        !!process.env.LANGFUSE_SECRET_KEY &&
        !!process.env.LANGFUSE_HOST
      );
    },
    async export(trace: OtelTrace): Promise<void> {
      // Skeleton: 실제 네트워크 호출은 G-4 때 추가.
      // 지금은 "활성화돼 있고 매핑은 통과한다" 까지만 보장.
      logActionDebug(
        LOG_CTX,
        `langfuse export skeleton traceId=${trace.traceId} spans=${
          trace.childSpans.length + 1
        }`,
      );
    },
  };
}
