// ============================================
// S3.5: Gap Tracker — blueprint vs analysis 정합성
//
// 규칙 기반 (LLM 없음). blueprint 하이퍼엣지와 analysis 하이퍼엣지를
// 비교하여 bridge 하이퍼엣지 + 정합성 지표를 산출.
//
// 의존: (선행 파이프라인) blueprint_generation + (동일 파이프라인) ai_diagnosis
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import { deriveCurrentSemester, getTaskResult, setTaskResult } from "../pipeline-helpers";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

export async function runGapTracking(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, pipelineId } = ctx;

  // ── Blueprint 산출물 확인 ──────────────────────
  // 1순위: 현재 ctx.results (동일 파이프라인 내 _blueprintPhase) — legacy 호환
  // 2순위: DB에서 최근 completed blueprint 파이프라인 로드 (2026-04-16 D 분리 후 정상 경로)
  let blueprintOutput = getTaskResult(ctx.results, "_blueprintPhase");
  if (!blueprintOutput) {
    const { loadBlueprintForStudent } = await import("../../blueprint/loader");
    const loaded = await loadBlueprintForStudent(studentId, tenantId);
    if (loaded) {
      blueprintOutput = loaded as typeof blueprintOutput;
    }
  }
  if (!blueprintOutput) {
    return "Blueprint 미생성 — Gap Tracking 건너뜀";
  }

  // ── 하이퍼엣지 로드 (blueprint + analysis) ─────
  const { findHyperedges } = await import(
    "@/lib/domains/student-record/repository/hyperedge-repository"
  );

  const [blueprintHyperedges, analysisHyperedgesRaw] = await Promise.all([
    findHyperedges(studentId, tenantId, { contexts: ["blueprint" as "analysis"] }),
    findHyperedges(studentId, tenantId, { contexts: ["analysis"] }),
  ]);
  // C2: 설계 모드 폴백 — analysis hyperedges가 없으면 projected로 대체해 매칭 시도
  const analysisHyperedges = analysisHyperedgesRaw.length > 0
    ? analysisHyperedgesRaw
    : await findHyperedges(studentId, tenantId, { contexts: ["projected"] });

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
    currentSemester: deriveCurrentSemester(),
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
        // B3(2026-04-16): competencyGaps 는 score 기반 deficit만 포함.
        //   ai_projected가 이미 목표 이상이면 빈 배열이 되어 bridge 역량 정보가 손실됨.
        //   Blueprint convergence의 sharedCompetencies를 fallback으로 사용하여
        //   "이 bridge가 요구하는 역량" 원본 정보 유지.
        sharedCompetencies: b.competencyGaps.length > 0
          ? b.competencyGaps.map((g) => g.item)
          : b.blueprintSharedCompetencies,
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

  // Cross-run: 다음 실행 ai_strategy 가 "미해결 gap" 맥락 확보.
  // urgency high → medium → low 순 정렬 후 상위 8건만 유지.
  const urgencyRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const topBridges = [...gapOutput.bridgeProposals]
    .sort(
      (a, b) => (urgencyRank[a.urgency] ?? 3) - (urgencyRank[b.urgency] ?? 3),
    )
    .slice(0, 8)
    .map((b) => ({
      themeLabel: b.themeLabel,
      urgency: b.urgency,
      targetGrade: b.targetGrade ?? null,
      sharedCompetencies:
        b.competencyGaps.length > 0
          ? b.competencyGaps.map((g) => g.item)
          : b.blueprintSharedCompetencies,
    }));

  return {
    preview: `정합성 분석 완료 (커버리지 ${(gapOutput.metrics.coverage * 100).toFixed(0)}%, 정합성 ${(gapOutput.metrics.coherenceScore * 100).toFixed(0)}%, bridge ${gapOutput.bridgeProposals.length}건)`,
    result: {
      coverage: gapOutput.metrics.coverage,
      coherenceScore: gapOutput.metrics.coherenceScore,
      bridgeCount: gapOutput.bridgeProposals.length,
      driftCount: gapOutput.metrics.driftCount,
      feasibleGapCount: gapOutput.metrics.feasibleGapCount,
      topBridges,
    },
  };
}
