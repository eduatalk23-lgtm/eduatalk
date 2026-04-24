// ============================================
// β(A) MidPlanner — P3.5 완료 후 LLM 메타 판정 (2026-04-24)
//
// 비선형 재조직 로드맵 β 재포지셔닝(A안):
// - 구 LLM Planner(Orient 시점)를 P3.5 완료 직후로 이동.
// - 이 시점엔 analysisContext + gradeThemes + qualityPatterns 전부 채워짐 → 진짜 메타 판단 가능.
//
// ENABLE_MID_PIPELINE_PLANNER=false(기본) 시 null 즉시 반환 → 기존 동작 무영향.
// 소비처: pipeline-grade-phases.ts(executeGradePhase4) — P3.5 완료 직후, P4 setek_guide 진입 전.
//         이번 작업에서는 telemetry 전용(ctx.midPlan 저장 + task_results 영속).
//         가이드 러너 소비 재배선은 β+1 작업.
//
// 전체 흐름: memory/pipeline-nonlinear-reorganization-roadmap.md
// ============================================

import type { PipelineContext } from "../pipeline-types";
import type { BeliefState } from "../belief-state";
import { buildMidPipelinePlannerPrompt } from "../../llm/prompts/midPipelinePlannerPrompt";
import { generateTextWithRateLimit } from "../../llm/ai-client";
import { extractJson } from "../../llm/extractJson";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// MidPlan 타입 — β(A) 재포지셔닝 후 MidPlanner 출력
// ============================================

/**
 * MidPlanner(P3.5 직후)가 내리는 메타 판정 결과.
 *
 * β(A) 2026-04-24 재포지셔닝:
 * - skipTasks / modelTier / plannerSource 는 Orient 규칙 엔진 전담으로 이동 → 여기서 제거.
 * - MidPlanner 는 analysisContext + gradeThemes + qualityPatterns 이 채워진 시점에서
 *   컨설턴트가 즉시 주목할 레코드 중요도 / 탐구 축 가설 / 우려 플래그만 판정.
 */
export interface MidPlan {
  /**
   * 레코드별 우선순위 점수 덮어쓰기. recordId → 0~100.
   * narrativeContext.recordPriorityOrder 를 보완하는 메타 판정.
   * 정보 부족 시 생략(undefined). 가이드 러너 소비는 β+1 작업.
   */
  recordPriorityOverride?: Record<string, number>;

  /**
   * 이 학생의 핵심 탐구 축에 대한 컨설턴트 가설 (1~2줄, 한국어).
   * belief 실 데이터 기반 — "academic_inquiry 축이 약하나 community 축은 강함" 등.
   * 정보 부족 시 undefined.
   */
  focusHypothesis?: string;

  /**
   * 컨설턴트가 즉시 플래그할 우려사항 (0~3건, 한국어 bullet).
   * "레코드 N개에 반복 품질 패턴 집중", "직전 run 대비 회귀", "특정 학기 공백" 등.
   * 없으면 빈 배열.
   */
  concernFlags?: string[];

  /**
   * LLM 한국어 판정 근거 bullet (최소 1건 필수, belief 실 데이터 인용).
   * 예: "P1_나열식 22건 집중", "직전 run 대비 academic_inquiry 0.3 하락" 등.
   */
  rationale: string[];

  /** 판정 출처 — 현재 "llm" 고정 (MidPlanner 는 LLM 전용). */
  source: "llm";

  /** LLM 호출 소요 시간 (ms). 텔레메트리 목적. */
  llmDurationMs: number;
}

// ============================================
// LLM 응답 파싱용 내부 타입
// ============================================

interface MidPlannerLlmOutput {
  recordPriorityOverride?: Record<string, number>;
  focusHypothesis?: string;
  concernFlags?: string[];
  rationale: string[];
}

// ============================================
// serializeBeliefForPlanner (재사용)
// ============================================

/**
 * BeliefState 를 MidPlanner 프롬프트용 요약 문자열로 렌더한다.
 *
 * P3.5 완료 이후 호출되므로 아래 필드가 채워진 상태:
 * - profileCard (P1 진입 시 빌드)
 * - analysisContext (P1~P3 완료 시 축적)
 * - gradeThemes (P3.5 완료 시 세팅)
 * - qualityPatterns (이전 run Synthesis ai_diagnosis 에서 복원)
 * - resolvedRecords, previousRunOutputs (파이프라인 시작 시 로드)
 *
 * 토큰 절약: 각 필드는 있을 때만 섹션 추가. 장황한 JSON 덤프 금지.
 */
export function serializeBeliefForPlanner(
  belief: BeliefState,
  ctx: Pick<PipelineContext, "studentGrade" | "gradeMode" | "targetGrade">,
): string {
  const sections: string[] = [];

  // ── 학생 프로필 섹션 ─────────────────────────────────────
  const profileCard = belief.profileCard;
  if (profileCard && profileCard.length > 0) {
    const trimmed =
      profileCard.length > 200
        ? profileCard.slice(0, 200) + "…(생략)"
        : profileCard;
    sections.push(`## 학생 프로필\n${trimmed}`);
  } else {
    sections.push(`## 학생 프로필\n(없음)`);
  }

  // ── 학년/모드 섹션 ───────────────────────────────────────
  const gradeMode = ctx.gradeMode ?? "unknown";
  const targetGrade = ctx.targetGrade != null ? `${ctx.targetGrade}학년` : "전체";
  sections.push(
    `## 학년/모드\n- 현재 학년: ${ctx.studentGrade}\n- 모드: ${gradeMode}\n- 대상 학년: ${targetGrade}`,
  );

  // ── NEIS 레코드 커버리지 섹션 ────────────────────────────
  const resolved = belief.resolvedRecords;
  if (resolved && Object.keys(resolved).length > 0) {
    const lines: string[] = [];
    for (const [grade, bucket] of Object.entries(resolved)) {
      if (!bucket) continue;
      const hasNeis = bucket.hasAnyNeis ? "true" : "false";
      const setekCount = bucket.seteks?.length ?? 0;
      const changcheCount = bucket.changche?.length ?? 0;
      const haengteuk = bucket.haengteuk ? "yes" : "no";
      lines.push(
        `- ${grade}학년: hasAnyNeis=${hasNeis}, seteks=${setekCount}, changche=${changcheCount}, haengteuk=${haengteuk}`,
      );
    }
    if (lines.length > 0) {
      sections.push(`## NEIS 레코드 커버리지\n${lines.join("\n")}`);
    }
  }

  // ── 학년별 약점 요약 섹션 (analysisContext — P1~P3 완료 후 풍부) ───────────
  const analysisContext = belief.analysisContext;
  if (analysisContext && Object.keys(analysisContext).length > 0) {
    const lines: string[] = [];
    for (const [grade, gradeCtx] of Object.entries(analysisContext)) {
      if (!gradeCtx) continue;
      const qualityIssueCount = gradeCtx.qualityIssues?.length ?? 0;
      const weakCompCount = gradeCtx.weakCompetencies?.length ?? 0;
      const top3Issues = gradeCtx.qualityIssues
        ?.slice(0, 3)
        .map((i) => i.recordType ?? "unknown")
        .join(", ");
      lines.push(
        `- ${grade}학년: 품질이슈 ${qualityIssueCount}건, 약점역량 ${weakCompCount}건${top3Issues ? ` (주요: ${top3Issues})` : ""}`,
      );
    }
    if (lines.length > 0) {
      sections.push(`## 학년별 약점 요약 (analysisContext)\n${lines.join("\n")}`);
    }
  }

  // ── 테마·품질 패턴 섹션 (P3.5 완료 후 gradeThemes 채워짐) ──────────────────
  const gradeThemes = belief.gradeThemes;
  const qualityPatterns = belief.qualityPatterns;

  const themeQualityLines: string[] = [];
  if (gradeThemes?.dominantThemeIds && gradeThemes.dominantThemeIds.length > 0) {
    const top5 = gradeThemes.dominantThemeIds.slice(0, 5).join(", ");
    themeQualityLines.push(`- 주요 테마 ID(상위 5): ${top5}`);
  }
  if (qualityPatterns && qualityPatterns.length > 0) {
    const top3 = qualityPatterns
      .slice(0, 3)
      .map((p) => `${p.pattern}(${p.count}건)`)
      .join(", ");
    themeQualityLines.push(`- 반복 품질 패턴(상위 3): ${top3}`);
  }
  if (themeQualityLines.length > 0) {
    sections.push(
      `## 테마·품질 패턴\n${themeQualityLines.join("\n")}`,
    );
  }

  // ── 이전 run 결과 섹션 ───────────────────────────────────
  const prev = belief.previousRunOutputs;
  if (prev) {
    if (prev.runId) {
      const completed = prev.completedAt
        ? prev.completedAt.slice(0, 10)
        : "날짜 미상";
      sections.push(
        `## 이전 run 결과\n- 직전 run: ${prev.runId.slice(0, 8)}… (완료: ${completed})`,
      );
    } else {
      sections.push(`## 이전 run 결과\n- 최초 실행 (직전 run 없음)`);
    }
  }

  return sections.join("\n\n");
}

// ============================================
// runMidPipelinePlanner
// ============================================

/**
 * MidPipeline Planner — P3.5(cross_subject_theme_extraction) 완료 직후, P4 진입 전에 호출.
 *
 * 이 시점엔 belief 에 다음 필드가 채워진 상태:
 * - analysisContext: P1~P3 역량 분석 완료 → 품질 이슈·약점 역량 풍부
 * - gradeThemes: P3.5 완료 → 과목 교차 주요 테마 세팅
 * - qualityPatterns: 이전 run Synthesis ai_diagnosis 에서 복원(있으면)
 *
 * ENABLE_MID_PIPELINE_PLANNER env flag 가 "true" 가 아니면 null 즉시 반환.
 * 실패/파싱 오류 시 null fallback → 파이프라인 계속 진행.
 *
 * @param ctx - PipelineContext (P3.5 완료 이후 상태)
 * @returns MidPlan (source="llm") 또는 null (flag off / 파싱 실패 / 타임아웃)
 */
export async function runMidPipelinePlanner(
  ctx: PipelineContext,
): Promise<MidPlan | null> {
  // ── env flag 가드 ────────────────────────────────────────
  if (process.env.ENABLE_MID_PIPELINE_PLANNER !== "true") {
    return null;
  }

  const startMs = Date.now();

  try {
    // ── belief 직렬화 (P3.5 이후 상태 — analysisContext + gradeThemes 풍부) ──
    const beliefSummary = serializeBeliefForPlanner(ctx.belief, {
      studentGrade: ctx.studentGrade,
      gradeMode: ctx.gradeMode,
      targetGrade: ctx.targetGrade,
    });

    // ── 프롬프트 빌드 ────────────────────────────────────────
    const { system, user } = buildMidPipelinePlannerPrompt(beliefSummary);

    // ── Flash tier LLM 호출 ──────────────────────────────────
    const result = await generateTextWithRateLimit({
      system,
      messages: [{ role: "user", content: user }],
      modelTier: "fast",
      responseFormat: "json",
    });

    const llmDurationMs = Date.now() - startMs;
    const rawText =
      (result as { text?: string; content?: string }).text ??
      (result as { content?: string }).content ??
      "";

    // ── JSON 파싱 ────────────────────────────────────────────
    const parsed = extractJson<MidPlannerLlmOutput>(rawText);

    // ── 필수 필드 검증 ───────────────────────────────────────
    if (!Array.isArray(parsed.rationale) || parsed.rationale.length === 0) {
      logActionError(
        { domain: "record-analysis", action: "runMidPipelinePlanner" },
        `MidPlanner 응답 스키마 불일치 — rationale 누락 또는 빈 배열, fallback null`,
      );
      return null;
    }

    // ── recordPriorityOverride 0~100 clamp ──────────────────
    let recordPriorityOverride: Record<string, number> | undefined;
    if (
      parsed.recordPriorityOverride &&
      Object.keys(parsed.recordPriorityOverride).length > 0
    ) {
      recordPriorityOverride = {};
      for (const [recordId, score] of Object.entries(parsed.recordPriorityOverride)) {
        recordPriorityOverride[recordId] = Math.max(0, Math.min(100, score));
      }
    }

    const midPlan: MidPlan = {
      recordPriorityOverride,
      focusHypothesis: typeof parsed.focusHypothesis === "string" ? parsed.focusHypothesis : undefined,
      concernFlags: Array.isArray(parsed.concernFlags) ? parsed.concernFlags : [],
      rationale: parsed.rationale,
      source: "llm",
      llmDurationMs,
    };

    return midPlan;
  } catch (err) {
    logActionError(
      { domain: "record-analysis", action: "runMidPipelinePlanner" },
      `MidPlanner 호출 실패 — fallback null: ${String(err)}`,
    );
    return null;
  }
}
