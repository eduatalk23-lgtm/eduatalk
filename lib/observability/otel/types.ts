/**
 * Phase G-3: OpenTelemetry span 표현 (에듀엣톡 agent trace 전용 subset).
 *
 * `agent_sessions` + `agent_step_traces` 를 OTel GenAI semantic conventions
 * (gen_ai.*) 에 맞춰 span 배열로 변환하는 중간 타입. OTLP 직렬화 이전 단계로,
 * exporter 에 따라 Langfuse/Tempo/Jaeger 등으로 이어질 수 있다.
 *
 * 참고: https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */

export type OtelSpanKind =
  | "internal"
  | "client"
  | "server"
  | "producer"
  | "consumer";

export type OtelStatusCode = "unset" | "ok" | "error";

export interface OtelAttribute {
  /** dotted key, 예: "gen_ai.request.model" */
  key: string;
  /** JSON 직렬화 가능한 값. 배열은 primitive 만 허용 */
  value: string | number | boolean | null;
}

export interface OtelEvent {
  /** ISO 타임스탬프 또는 epoch ms — exporter 가 처리 */
  timestamp: number;
  name: string;
  attributes?: OtelAttribute[];
}

export interface OtelSpan {
  /** 세션 전체에 공유되는 trace id (agent_sessions.id 와 동일) */
  traceId: string;
  /** 각 span 고유 id. 루트=traceId, 자식=`${traceId}-${stepIndex}` */
  spanId: string;
  /** 부모 span id. 루트는 undefined */
  parentSpanId?: string;
  name: string;
  kind: OtelSpanKind;
  startTimeMs: number;
  endTimeMs: number;
  status: OtelStatusCode;
  statusMessage?: string;
  attributes: OtelAttribute[];
  events?: OtelEvent[];
}

/**
 * 단일 agent 실행(= 1 trace) 을 여러 span 으로 매핑한 결과.
 * `rootSpan` 은 agent_sessions row, `childSpans` 는 agent_step_traces row 들.
 */
export interface OtelTrace {
  traceId: string;
  rootSpan: OtelSpan;
  childSpans: OtelSpan[];
}

export interface ExporterAdapter {
  /** 사람 친화 이름 (로깅용) */
  readonly name: string;
  /** 환경 조건상 export 가능한지 (env 미설정 시 false) */
  isEnabled(): boolean;
  /** trace 하나를 외부 backend 로 보낸다. 실패 시 throw 하지 말고 내부 로깅 */
  export(trace: OtelTrace): Promise<void>;
}
