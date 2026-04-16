// ============================================
// S3.5: Gap Tracker — blueprint vs analysis 정합성
//
// 규칙 기반 (LLM 없음). blueprint 하이퍼엣지와 analysis 하이퍼엣지를
// 비교하여 bridge 하이퍼엣지 + 정합성 지표를 산출.
//
// 의존: blueprint_generation + ai_diagnosis (역량 점수)
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import { getTaskResult, setTaskResult } from "../pipeline-helpers";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

export async function runGapTracking(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, pipelineId } = ctx;

  // ── Blueprint 산출물 확인 ──────────────────────
  const blueprintOutput = getTaskResult(ctx.results, "_blueprintPhase");
  if (!blueprintOutput) {
    return "Blueprint 미생성 — Gap Tracking 건너뜀";
  }

  // ── 하이퍼엣지 로드 (blueprint + analysis) ─────
  const { findHyperedges } = await import(
    "@/lib/domains/student-record/repository/hyperedge-repository"
  );

  const [blueprintHyperedges, analysisHyperedges] = await Promise.all([
    findHyperedges(studentId, tenantId, { contexts: ["blueprint" as "analysis"] }),
    findHyperedges(studentId, tenantId, { contexts: ["analysis"] }),
  ]);

  if (blueprintHyperedges.length === 0) {
    return "Blueprint 하이퍼엣지 0건 — Gap Tracking 건너뜀";
  }

  // ── 역량 점수 로드 ────────────────────────────
  const { findCompetencyScores } = await import(
    "@/lib/domains/student-record/repository/competency-repository"
  );
  const currentSchoolYear = calculateSchoolYear();

  // ai + ai_projected 모두 조회 (설계 모드 호환)
  const [aiScores, projectedScores] = await Promise.all([
    findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai"),
    findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai_projected"),
  ]);
  const allScores = aiScores.length > 0 ? aiScores : projectedScores;

  // ── Gap Tracker 실행 ──────────────────────────
  const { runGapTracker } = await import("../../blueprint/gap-tracker");

  const gapInput = {
    studentId,
    tenantId,
    pipelineId,
    blueprintHyperedges: blueprintHyperedges.map((he) => ({
      id: he.id,
      themeLabel: he.theme_label,
      themeSlug: he.theme_slug,
      members: he.members.map((m) => ({
        recordType: m.recordType,
        label: m.label,
        grade: m.grade,
        role: m.role,
      })),
      sharedKeywords: he.shared_keywords,
      sharedCompetencies: he.shared_competencies,
      confidence: he.confidence,
      grade: he.members[0]?.grade ?? null,
    })),
    analysisHyperedges: analysisHyperedges.map((he) => ({
      id: he.id,
      themeLabel: he.theme_label,
      themeSlug: he.theme_slug,
      members: he.members.map((m) => ({
        recordType: m.recordType,
        label: m.label,
        grade: m.grade,
        role: m.role,
      })),
      sharedKeywords: he.shared_keywords,
      sharedCompetencies: he.shared_competencies,
      confidence: he.confidence,
    })),
    competencyGrowthTargets: blueprintOutput.competencyGrowthTargets ?? [],
    currentCompetencyScores: allScores.map((s) => ({
      item: s.competency_item,
      gradeValue: s.grade_value,
      source: (s.source ?? "ai") as "ai" | "ai_projected",
    })),
    currentGrade: ctx.studentGrade,
    currentSemester: 1 as 1 | 2, // TODO: 실제 학기 판정
  };

  const gapOutput = runGapTracker(gapInput);

  // ── Bridge 하이퍼엣지 DB 저장 (best-effort) ────
  if (gapOutput.bridgeProposals.length > 0) {
    try {
      const { replaceHyperedges } = await import(
        "@/lib/domains/student-record/repository/hyperedge-repository"
      );

      const bridgeInputs = gapOutput.bridgeProposals.map((b) => ({
        themeSlug: `bridge:${b.blueprintHyperedgeId}:${b.gapType}`,
        themeLabel: b.themeLabel,
        hyperedgeType: "theme_convergence" as const,
        members: b.missingMembers.map((m) => ({
          recordType: m.recordType,
          recordId: `bridge:${m.subjectOrActivity}`,
          label: `[${b.urgency}] ${m.subjectOrActivity}: ${m.description}`,
          grade: b.targetGrade,
          role: "support" as const,
        })),
        confidence: b.confidence,
        evidence: b.recommendedAction,
        sharedKeywords: b.themeKeywords,
        sharedCompetencies: b.competencyGaps.map((g) => g.item),
      })).filter((input) => input.members.length >= 2); // member_count >= 2 제약

      if (bridgeInputs.length > 0) {
        await replaceHyperedges(
          studentId,
          tenantId,
          pipelineId,
          bridgeInputs,
          "bridge" as "analysis", // 마이그레이션 적용 후 정상 동작
        );
      }
    } catch (dbErr) {
      logActionError(LOG_CTX, dbErr);
    }
  }

  // ── 결과 캐시 ─────────────────────────────────
  setTaskResult(ctx.results, "_gapTracker", gapOutput);

  logActionDebug(LOG_CTX, "Gap Tracker 완료", {
    pipelineId,
    coverage: gapOutput.metrics.coverage,
    coherence: gapOutput.metrics.coherenceScore,
    bridgeCount: gapOutput.bridgeProposals.length,
    driftCount: gapOutput.metrics.driftCount,
  });

  return {
    preview: `정합성 분석 완료 (커버리지 ${(gapOutput.metrics.coverage * 100).toFixed(0)}%, 정합성 ${(gapOutput.metrics.coherenceScore * 100).toFixed(0)}%, bridge ${gapOutput.bridgeProposals.length}건)`,
    result: {
      coverage: gapOutput.metrics.coverage,
      coherenceScore: gapOutput.metrics.coherenceScore,
      bridgeCount: gapOutput.bridgeProposals.length,
      driftCount: gapOutput.metrics.driftCount,
      feasibleGapCount: gapOutput.metrics.feasibleGapCount,
    },
  };
}
