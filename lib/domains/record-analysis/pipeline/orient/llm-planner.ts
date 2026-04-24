// ============================================
// β LLM Planner — S1 스켈레톤 (2026-04-24)
//
// 비선형 재조직 로드맵 β 단계:
// `runOrientPhase` 의 규칙 기반 판정을 보완·대체하는 LLM Planner.
// 컨설턴트 메타 판단(NEIS 풍부도·약점 분포·레코드 중요도)을 LLM 에 위임.
//
// S1 범위: 타입 정의 + serializer + runLlmPlanner 스켈레톤.
// ENABLE_ORIENT_LLM_PLANNER=false(기본) 시 null 즉시 반환 → 기존 동작 무영향.
//
// S2 에서 pipeline-orient-phase.ts 가 이 함수를 호출하여 merged 판정.
// S3 에서 테스트 추가.
//
// 전체 흐름: memory/pipeline-nonlinear-reorganization-roadmap.md
// ============================================

import type { PipelineContext } from "../pipeline-types";
import type { BeliefState } from "../belief-state";
import { buildOrientPlannerPrompt } from "../../llm/prompts/orientPlannerPrompt";
import { generateTextWithRateLimit } from "../../llm/ai-client";
import { extractJson } from "../../llm/extractJson";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// PlanDecision 타입 — OrientDecision(PlannerDirective) 의 superset
// ============================================

/**
 * LLM Planner 가 내리는 판정 결과.
 *
 * 기존 `PlannerDirective` (pipeline-orient-phase.ts) 의 superset:
 * - `skipTasks`, `modelTier`, `rationale` 은 PlannerDirective 와 구조 호환 유지
 * - `recordPriorityOverride`, `plannerSource`, `llmRationale`, `llmDurationMs` 신설
 *
 * S2 에서 규칙 판정 + LLM 판정을 merge → plannerSource="merged"
 */
export interface PlanDecision {
  /**
   * 이번 run 에서 실행을 건너뛸 태스크 키 목록.
   * skipIfOrientSkipped() 가 소비한다.
   */
  skipTasks: string[];

  /**
   * 태스크별 모델 티어 권고.
   * "fast" | "standard" | "advanced" 중 하나.
   * 러너가 tierOverride 로 참조한다 (MVP 에서는 기록만).
   */
  modelTier: "fast" | "standard" | "advanced";

  /**
   * 레코드별 중요도 점수 덮어쓰기. recordId → priority score (0~100).
   * narrativeContext.recordPriorityOrder 를 보완·대체한다.
   * 미지정이면 기존 우선순위 순서 그대로 유지.
   */
  recordPriorityOverride?: Record<string, number>;

  /**
   * 판정 근거 문자열 (규칙 기반 rationale 채널).
   * 디버그 로그·향후 UI 제안 카드에 표시.
   */
  rationale: string[];

  /**
   * 판정 출처:
   * - "rule"    : 규칙 엔진만 사용 (S1/S2 기본 fallback)
   * - "llm"     : LLM Planner 단독 판정
   * - "merged"  : 규칙 + LLM 병합 (S2 에서 활성화)
   */
  plannerSource: "rule" | "llm" | "merged";

  /**
   * LLM Planner 의 한국어 판정 근거 bullet (LLM 응답 원문).
   * plannerSource="llm" 또는 "merged" 일 때만 존재.
   */
  llmRationale?: string[];

  /**
   * LLM Planner 호출 소요 시간 (ms).
   * 텔레메트리 목적; plannerSource="llm"/"merged" 일 때만 존재.
   */
  llmDurationMs?: number;
}

// ============================================
// LLM Planner 입력 JSON 스키마 (파싱용 내부 타입)
// ============================================

interface PlannerLlmOutput {
  skipTasks: string[];
  modelTier: "fast" | "standard" | "advanced";
  recordPriorityOverride?: Record<string, number>;
  rationale: string[];
}

// ============================================
// serializeBeliefForPlanner
// ============================================

/**
 * BeliefState 를 Planner 프롬프트용 요약 문자열로 렌더한다.
 *
 * - 토큰 절약: 각 필드는 있을 때만 섹션 추가. 장황한 JSON 덤프 금지.
 * - 학년 컨텍스트(studentGrade, gradeMode, targetGrade) 는 ctx 에서 직접 받는다.
 * - previousRunOutputs 는 간략 1줄 요약만 (runId 있음 여부 + completedAt).
 */
export function serializeBeliefForPlanner(
  belief: BeliefState,
  ctx: Pick<PipelineContext, "studentGrade" | "gradeMode" | "targetGrade">,
): string {
  const sections: string[] = [];

  // ── 학생 프로필 섹션 ─────────────────────────────────────
  const profileCard = belief.profileCard;
  if (profileCard && profileCard.length > 0) {
    // profileCard 는 이미 마크다운 형식이므로 그대로 삽입 (200자 상한)
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

  // ── 학년별 약점 요약 섹션 ────────────────────────────────
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

  // ── 테마·품질 패턴 섹션 ─────────────────────────────────
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
// runLlmPlanner — 스켈레톤 (S1)
// ============================================

/**
 * Orient Phase LLM Planner.
 *
 * **S1 단계**: ENABLE_ORIENT_LLM_PLANNER env flag 가 "true" 가 아니면 null 반환(즉시).
 * 기존 `runOrientPhase` 동작에 영향 없음.
 *
 * S2 에서 pipeline-orient-phase.ts 의 `runOrientPhase` 가 이 함수를 호출하여
 * 규칙 판정 결과와 merge, `plannerSource="merged"` 로 반환.
 *
 * @param ctx - PipelineContext (belief + studentGrade + gradeMode + targetGrade 소비)
 * @returns PlanDecision (plannerSource="llm") 또는 null (flag off / 파싱 실패 / 타임아웃)
 */
export async function runLlmPlanner(
  ctx: PipelineContext,
): Promise<PlanDecision | null> {
  // ── env flag 가드 ────────────────────────────────────────
  if (process.env.ENABLE_ORIENT_LLM_PLANNER !== "true") {
    return null;
  }

  const startMs = Date.now();

  try {
    // ── belief 직렬화 ────────────────────────────────────────
    const beliefSummary = serializeBeliefForPlanner(ctx.belief, {
      studentGrade: ctx.studentGrade,
      gradeMode: ctx.gradeMode,
      targetGrade: ctx.targetGrade,
    });

    // ── 프롬프트 빌드 ────────────────────────────────────────
    const { system, user } = buildOrientPlannerPrompt(beliefSummary);

    // ── Flash tier LLM 호출 ──────────────────────────────────
    const result = await generateTextWithRateLimit(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { tier: "fast" },
    );

    const llmDurationMs = Date.now() - startMs;
    const rawText = result.text ?? "";

    // ── JSON 파싱 ────────────────────────────────────────────
    const parsed = extractJson<PlannerLlmOutput>(rawText);

    // ── 필수 필드 검증 ───────────────────────────────────────
    if (
      !Array.isArray(parsed.skipTasks) ||
      !["fast", "standard", "advanced"].includes(parsed.modelTier) ||
      !Array.isArray(parsed.rationale)
    ) {
      logActionError(
        { domain: "record-analysis", action: "runLlmPlanner" },
        `LLM Planner 응답 스키마 불일치 — modelTier=${parsed.modelTier}, skipTasks=${JSON.stringify(parsed.skipTasks)}, fallback null`,
      );
      return null;
    }

    const decision: PlanDecision = {
      skipTasks: parsed.skipTasks,
      modelTier: parsed.modelTier,
      recordPriorityOverride: parsed.recordPriorityOverride,
      rationale: [],
      plannerSource: "llm",
      llmRationale: parsed.rationale,
      llmDurationMs,
    };

    return decision;
  } catch (err) {
    logActionError(
      { domain: "record-analysis", action: "runLlmPlanner" },
      `LLM Planner 호출 실패 — fallback null: ${String(err)}`,
    );
    return null;
  }
}
