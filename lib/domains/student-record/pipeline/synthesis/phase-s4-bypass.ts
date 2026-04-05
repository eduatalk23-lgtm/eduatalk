// ============================================
// S4: runBypassAnalysis
// ============================================

import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../../pipeline-types";
import * as diagnosisRepo from "../../diagnosis-repository";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// 12. 우회학과 분석
// ============================================

export async function runBypassAnalysis(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId } = ctx;

  const { discoverDepartmentsFromDiagnosis } = await import("@/lib/domains/bypass-major/department-discovery");
  const currentSchoolYear = calculateSchoolYear();

  const discovery = await discoverDepartmentsFromDiagnosis(studentId, tenantId, currentSchoolYear);

  if (discovery.targetDepartments.length === 0) {
    return "매칭 학과 없음 — 건너뜀";
  }

  const { runBypassPipeline } = await import("@/lib/domains/bypass-major/pipeline");
  let totalGenerated = 0;
  let totalEnriched = 0;
  let totalCompetency = 0;
  const targetNames: string[] = [];

  // 발견된 대표 학과별로 우회학과 파이프라인 실행 (최대 3개)
  // O3: 진단 약점을 우회학과 3축 평가에 전달
  const bypassDiagnosis = await diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai");
  const bypassWeaknesses = (bypassDiagnosis?.weaknesses as string[]) ?? [];
  const bypassImprovements = Array.isArray(bypassDiagnosis?.improvements)
    ? (bypassDiagnosis.improvements as Array<{ priority: string; area: string }>)
    : [];

  for (const target of discovery.targetDepartments.slice(0, 3)) {
    try {
      const result = await runBypassPipeline({
        studentId,
        tenantId,
        targetDeptId: target.departmentId,
        schoolYear: currentSchoolYear,
        diagnosticWeaknesses: bypassWeaknesses.length > 0 ? bypassWeaknesses : undefined,
        diagnosticImprovements: bypassImprovements.length > 0 ? bypassImprovements : undefined,
      });
      totalGenerated += result.totalGenerated;
      totalEnriched += result.enriched;
      totalCompetency += result.withCompetency;
      targetNames.push(target.midClassification ?? target.departmentName);
    } catch (err) {
      logActionError({ ...LOG_CTX, action: "pipeline.bypass.target" }, err, {
        targetDeptId: target.departmentId,
      });
    }
  }

  // D-3: 모의고사 존재 시 자동 배치 분석 + placement_grade 백필
  let placementInfo = "";
  try {
    const { autoRunPlacement, backfillPlacementGrades } = await import("@/lib/domains/admission/placement/auto-placement");
    const placementResult = await autoRunPlacement(studentId, tenantId);
    if (placementResult) {
      const backfilled = await backfillPlacementGrades(studentId, tenantId, currentSchoolYear);
      placementInfo = ` + 배치 ${placementResult.verdictCount}개 대학 (${backfilled}건 연동)`;
    }
  } catch (err) {
    logActionDebug(LOG_CTX, `자동 배치 스킵: ${err}`);
  }

  const sourceLabel = discovery.source === "diagnosis_recommended" ? "AI진단" : "희망학과";
  const extras: string[] = [];
  if (totalCompetency > 0) extras.push(`역량 ${totalCompetency}건`);
  if (totalEnriched > 0) extras.push(`확충 ${totalEnriched}건`);
  const extrasStr = extras.length > 0 ? ` [${extras.join(", ")}]` : "";
  return `${totalGenerated}건 우회학과 후보 생성 (${sourceLabel}: ${targetNames.join(", ")})${extrasStr}${placementInfo}`;
}
