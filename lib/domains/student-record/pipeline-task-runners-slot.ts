// ============================================
// 슬롯 생성 태스크 러너 (Grade Pipeline G5)
// G5: runSlotGenerationForGrade
// ============================================

import {
  assertGradeCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "./pipeline-types";

// ============================================
// G5. 학년별 슬롯 생성 (컨설팅 학년만)
// ============================================

export async function runSlotGenerationForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, coursePlanData, supabase, targetGrade } = ctx;

  // 해당 학년이 NEIS 학년이면 슬롯 생성 불필요 (임포트된 데이터 이미 있음)
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 확보 — 슬롯 생성 불필요`;
  }

  const { ensureConsultingGradeSlots } = await import("./pipeline-slot-generator");
  const result = await ensureConsultingGradeSlots({
    studentId,
    tenantId,
    studentGrade,
    consultingGrades: [targetGrade],
    coursePlanData: coursePlanData ?? null,
    supabase,
  });

  return `${targetGrade}학년 슬롯: 세특 ${result.setekCount}과목, 창체 ${result.changcheCount}영역, 행특 ${result.haengteukCount}건`;
}
