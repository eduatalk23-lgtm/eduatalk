/**
 * Phase F-4: Tier Routing 분류기.
 *
 * 사용자 메시지를 Chat Shell(L2) 적합 / Agent(L3) 권장 으로 사전 분류.
 * 선두 6 패턴 중 Tiered Cascade 축의 진입부 — 작은 모델이 먼저 판정해
 * 큰 L3 파이프라인으로 불필요한 호출이 흘러가지 않게 한다.
 *
 * 판정 축(v0):
 * - L2 = 단순 조회·이동·요약·질문 — Chat Shell 에서 3초 내 해결 가능
 * - L3 = 심화 분석·리포트·멀티스튜던트 비교·다단계 설계 — Domain Agent 권장
 *
 * Ollama 로컬 소형 모델 기본 사용. think:false + num_predict 제한으로
 * 저지연 (목표 <1s). 환경변수 `OLLAMA_CLASSIFIER_MODEL` 로 모델 교체 가능.
 * 실패 시 보수적 폴백 `{tier:"L2", confidence:0}` — 분류기 장애가 전체
 * 흐름을 막지 않도록 L2 가 기본값.
 */

export type Tier = "L2" | "L3";

export type TierClassification = {
  tier: Tier;
  /** 0~1 모델 자기보고 자신감. 폴백이면 0. */
  confidence: number;
  /** 1문장 판정 근거. */
  reason: string;
  /** 판정에 소요된 ms. latency SLO 감시용. */
  latencyMs: number;
  /** 실제 사용 모델. */
  model: string;
  /** true 면 Ollama 호출 실패로 fallback 경로. */
  fallback: boolean;
};

const CLASSIFIER_PROMPT = `당신은 에듀엣톡 AI 티어 분류기입니다. 사용자 요청을 두 범주로 판정합니다.

[L2 — Chat Shell 적합]
- 단순 조회: 성적·내신·생기부 본문 보여줘
- 페이지 이동: 화면 열어줘, 이동해줘
- 짧은 질문: 오늘 뭐해야 해, 설명해줘
- 상태 확인: 분석 어디까지 됐어, 파이프라인 상태
- 1~2 단계 요약: @학생 종합 프로필, 역량 진단

[L3 — Agent 권장]
- 리포트 생성: 자소서·추천서·생기부 리포트 작성
- 심화 분석: 여러 학생 비교, 반사실 시뮬레이션, 입결 배분
- 다단계 설계: 진단+전략+로드맵 체인
- 수정 작업: 세특 초안 작성·개선, 스토리라인 재구성
- 장기 실행: 5 분 넘는 파이프라인 트리거

반드시 JSON 1 개만 반환: {"tier":"L2"|"L3","confidence":0~1,"reason":"한 문장"}

사용자 요청: {{INPUT}}`;

const DEFAULT_MODEL = "gemma4:latest";
const TIMEOUT_MS = 8_000;
const MAX_INPUT_CHARS = 400;

export type ClassifyOptions = {
  model?: string;
  timeoutMs?: number;
  /** 제공 시 fetch 재정의 (테스트 용). */
  fetchImpl?: typeof fetch;
};

function resolveModel(override?: string): string {
  return override ?? process.env.OLLAMA_CLASSIFIER_MODEL ?? DEFAULT_MODEL;
}

function fallback(reason: string, startedAt: number, model: string): TierClassification {
  return {
    tier: "L2",
    confidence: 0,
    reason,
    latencyMs: Date.now() - startedAt,
    model,
    fallback: true,
  };
}

function normalizeTier(raw: unknown): Tier | null {
  if (raw === "L2" || raw === "L3") return raw;
  if (typeof raw === "string") {
    const upper = raw.toUpperCase().trim();
    if (upper === "L2" || upper === "L3") return upper;
  }
  return null;
}

function clampConfidence(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

function parseClassifierJson(text: string): {
  tier: Tier;
  confidence: number;
  reason: string;
} | null {
  // Ollama 가 ```json ... ``` 로 감싸는 경우 대응.
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // 첫 { 부터 마지막 } 까지만 추출 (prefix 설명 무시).
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  const jsonStr = cleaned.slice(first, last + 1);

  let obj: unknown;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as { tier?: unknown; confidence?: unknown; reason?: unknown };
  const tier = normalizeTier(o.tier);
  if (!tier) return null;
  return {
    tier,
    confidence: clampConfidence(o.confidence),
    reason:
      typeof o.reason === "string" && o.reason.length > 0
        ? o.reason.slice(0, 200)
        : tier === "L3"
          ? "심화 분석 권장"
          : "단순 요청",
  };
}

export async function classifyTier(
  input: string,
  options: ClassifyOptions = {},
): Promise<TierClassification> {
  const startedAt = Date.now();
  const model = resolveModel(options.model);
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return fallback("빈 입력 — 기본 L2", startedAt, model);
  }
  const truncated =
    trimmed.length <= MAX_INPUT_CHARS
      ? trimmed
      : `${trimmed.slice(0, MAX_INPUT_CHARS)}…`;

  const prompt = CLASSIFIER_PROMPT.replace("{{INPUT}}", truncated);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await doFetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        think: false,
        options: {
          num_ctx: 1024,
          num_predict: 120,
          temperature: 0.1,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return fallback(
        `Ollama HTTP ${res.status}`,
        startedAt,
        model,
      );
    }

    const body = (await res.json()) as { response?: string };
    const text = body.response ?? "";
    const parsed = parseClassifierJson(text);
    if (!parsed) {
      return fallback("파싱 실패 — 원문 비JSON", startedAt, model);
    }

    return {
      ...parsed,
      latencyMs: Date.now() - startedAt,
      model,
      fallback: false,
    };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? `timeout ${timeoutMs}ms`
        : err instanceof Error
          ? err.message.slice(0, 120)
          : "unknown";
    return fallback(reason, startedAt, model);
  } finally {
    clearTimeout(timer);
  }
}
