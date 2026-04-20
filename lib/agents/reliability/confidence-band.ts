// ============================================
// M2 Reliability 신뢰도 밴드 primitive (2026-04-20)
//
// docs/student-facing-agent-design.md §5.3.2 Confidence Self-Report 근거:
//   ≥0.85 → high  (일반 표시)
//   0.6 ~ 0.85 → medium (컨설턴트 확인 권장)
//   < 0.6 → low (자동 defer)
//
// 이 모듈은 **순수 함수** 만 제공. 호출자 (Proposal Drawer / α5 UI / 학생 Chat)
// 가 측정 가능한 시그널을 전달하면 밴드 + 한국어 가이드 텍스트 + 근거 신호를 반환.
//
// 학생 대면 기능이 나오기 전에도 Proposal/Interview 출력에 붙여 컨설턴트가
// "이걸 얼마나 믿을 수 있나"를 한눈에 판정하도록.
// ============================================

// ─── 공개 타입 ───────────────────────────────────────────────

export type ConfidenceBand = "high" | "medium" | "low";

export interface ConfidenceReasonSignal {
  /** 약한 부정 신호 이름 (예: 'rule_v1_fallback', 'low_token_usage'). */
  readonly code: string;
  /** 사람이 읽을 짧은 설명. */
  readonly description: string;
  /** 점수에 곱해질 페널티 (0~1). 1 = 감점 없음. */
  readonly weight: number;
}

export interface ConfidenceSelfReport {
  readonly band: ConfidenceBand;
  /** 0~1 원점수 — 투명성 용도. band 계산 후에도 보존. */
  readonly score: number;
  /** 밴드별 한국어 UI 가이드 문구. */
  readonly guidance: string;
  /** 학생 대면 시 defer 여부 판정 (<0.6 → true). */
  readonly deferToConsultant: boolean;
  /** 점수 차감에 기여한 신호들 (투명성 + 디버깅). */
  readonly reasons: readonly ConfidenceReasonSignal[];
}

// ─── 임계값·가이드 ──────────────────────────────────────────

export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.6,
} as const;

const GUIDANCE_BY_BAND: Record<ConfidenceBand, string> = {
  high: "AI 판정이 안정적으로 일치합니다. 일반 프로세스로 진행하세요.",
  medium: "AI 판정에 일부 불확실 요소가 있습니다. 컨설턴트 검토를 권장합니다.",
  low: "AI 신뢰도가 낮아 자동 defer 대상입니다. 컨설턴트 판정으로 갈음하세요.",
};

// ─── 공통: score → band ─────────────────────────────────────

export function bandFromScore(score: number): ConfidenceBand {
  if (!Number.isFinite(score)) return "low";
  if (score >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (score >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * reasons 의 weight 를 순차 곱. 모든 weight=1 이면 baseScore 그대로.
 * 각 신호는 (0~1] 감점. 예: rule_v1 fallback = weight 0.7.
 */
export function scoreFromSignals(
  baseScore: number,
  reasons: readonly ConfidenceReasonSignal[],
): number {
  let s = clamp01(baseScore);
  for (const r of reasons) s *= clamp01(r.weight);
  return clamp01(s);
}

function buildReport(
  score: number,
  reasons: readonly ConfidenceReasonSignal[],
): ConfidenceSelfReport {
  const band = bandFromScore(score);
  return {
    band,
    score: Number(score.toFixed(3)),
    guidance: GUIDANCE_BY_BAND[band],
    deferToConsultant: score < CONFIDENCE_THRESHOLDS.medium,
    reasons,
  };
}

// ─── LLM 실행 메타 → 밴드 ────────────────────────────────────

export interface LlmMetaSignals {
  /** engine — rule_v1 은 baseScore 고정 (0.75) · llm_v1 은 tier 에 따라 차등. */
  readonly engine: "rule_v1" | "llm_v1";
  /** llm_v1 의 실제 사용 tier. */
  readonly tier?: "fast" | "standard" | "advanced" | null;
  /** llm_v1 에서 fallback 발생 여부 (=rule_v1 으로 polyfill 등). */
  readonly fallbackOccurred?: boolean;
  /** LLM 에러 메시지 — 존재 시 신뢰도 추가 하락. */
  readonly engineError?: string | null;
  /** usage — output 토큰 < 50 이면 응답 빈약 의심. */
  readonly outputTokens?: number | null;
  /** 실행 시간 — 비정상적으로 빠르거나 느리면 감점. */
  readonly elapsedMs?: number | null;
}

const TIER_BASE: Record<"fast" | "standard" | "advanced", number> = {
  fast: 0.72,
  standard: 0.82,
  advanced: 0.92,
};

/**
 * LLM 실행 메타 → 신뢰도 밴드.
 *
 * 기본 점수:
 *   - rule_v1: 0.75 (fixed, 규칙 기반은 결정적이지만 일반화 한계)
 *   - llm_v1 + tier=fast: 0.72 · standard: 0.82 · advanced: 0.92
 *
 * 감점 신호:
 *   - fallbackOccurred=true → 0.7배
 *   - engineError 존재 → 0.85배
 *   - outputTokens < 50 → 0.88배 (응답 빈약)
 *   - elapsedMs > 60s → 0.92배 (타임아웃 근접)
 */
export function deriveConfidenceFromLlmMeta(
  meta: LlmMetaSignals,
): ConfidenceSelfReport {
  const reasons: ConfidenceReasonSignal[] = [];

  let base: number;
  if (meta.engine === "rule_v1") {
    base = 0.75;
  } else {
    const tier = meta.tier ?? "standard";
    base = tier in TIER_BASE ? TIER_BASE[tier as "fast" | "standard" | "advanced"] : 0.75;
  }

  if (meta.fallbackOccurred) {
    reasons.push({
      code: "fallback_occurred",
      description: "LLM 호출 실패로 rule_v1 대체 경로가 사용됨",
      weight: 0.7,
    });
  }
  if (meta.engineError) {
    reasons.push({
      code: "engine_error",
      description: `엔진 에러 발생 — ${truncate(meta.engineError, 120)}`,
      weight: 0.85,
    });
  }
  if (meta.outputTokens !== null && meta.outputTokens !== undefined && meta.outputTokens < 50) {
    reasons.push({
      code: "low_token_usage",
      description: `출력 토큰 ${meta.outputTokens}개 — 응답 빈약 가능`,
      weight: 0.88,
    });
  }
  if (meta.elapsedMs !== null && meta.elapsedMs !== undefined && meta.elapsedMs > 60_000) {
    reasons.push({
      code: "slow_execution",
      description: `실행 ${Math.round(meta.elapsedMs / 1000)}s — 타임아웃 근접`,
      weight: 0.92,
    });
  }

  const score = scoreFromSignals(base, reasons);
  return buildReport(score, reasons);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

// ─── 0~100 점수 시그널 → 밴드 (α5 analyzer 용) ─────────────────

export interface AnswerQualitySignals {
  /** 0~100. consistencyScore 등. */
  readonly consistencyScore: number;
  /** 0~100. authenticityScore 등. */
  readonly authenticityScore: number;
  /** 0 이상. gap 발견 수. 많을수록 감점. */
  readonly gapCount?: number;
}

/**
 * α5 답변 분석 결과에서 "분석 자체의 신뢰도" 가 아니라
 * "답변의 품질" 밴드를 도출 (UI 뱃지 용).
 * 두 점수 평균 + gap 감점.
 */
export function deriveBandFromAnswerQuality(
  sig: AnswerQualitySignals,
): ConfidenceSelfReport {
  const reasons: ConfidenceReasonSignal[] = [];
  const avg = (sig.consistencyScore + sig.authenticityScore) / 2;
  const base = clamp01(avg / 100);

  if ((sig.gapCount ?? 0) >= 3) {
    reasons.push({
      code: "many_gaps",
      description: `gap ${sig.gapCount}건 — 답변 정합성 약화`,
      weight: 0.85,
    });
  } else if ((sig.gapCount ?? 0) >= 1) {
    reasons.push({
      code: "some_gaps",
      description: `gap ${sig.gapCount}건 존재`,
      weight: 0.95,
    });
  }

  const score = scoreFromSignals(base, reasons);
  return buildReport(score, reasons);
}
