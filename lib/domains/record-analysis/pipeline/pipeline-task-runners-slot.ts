// ============================================
// 슬롯 생성 태스크 러너 (Grade Pipeline G5)
// G5: runSlotGenerationForGrade
// ============================================

import {
  assertGradeCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "./pipeline-types";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

/** 창체 활동 유형 (고정 3종) — pipeline-slot-generator와 동일 */
const CHANGCHE_ACTIVITY_TYPES = ["autonomy", "club", "career"] as const;

// ============================================
// G5. 학년별 슬롯 생성
// ============================================

export async function runSlotGenerationForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, coursePlanData, supabase, targetGrade } = ctx;

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];

  // NEIS 학년: 임포트 데이터가 있으나, 누락된 창체 슬롯만 보충
  if (gradeResolved?.hasAnyNeis) {
    const backfilled = await backfillMissingChangcheSlots(ctx);
    if (backfilled > 0) {
      return `${targetGrade}학년 NEIS 확보 — 누락 창체 ${backfilled}건 보충`;
    }
    return `${targetGrade}학년 NEIS 확보 — 슬롯 보충 불필요`;
  }

  // 컨설팅 학년: 세특/창체/행특 전체 슬롯 생성
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

/**
 * NEIS 학년에서 누락된 창체 슬롯(autonomy/club/career)을 보충 생성.
 * NEIS 임포트가 PDF에 있는 활동 유형만 생성하므로,
 * 없는 유형은 빈 슬롯을 추가하여 파이프라인 연쇄 스킵을 방지한다.
 */
async function backfillMissingChangcheSlots(ctx: PipelineContext): Promise<number> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, supabase, targetGrade } = ctx;

  // 현재 해당 학년의 창체 레코드에서 이미 있는 activity_type 확인
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const existingTypes = new Set(
    (gradeResolved?.changche ?? [])
      .map((c) => c.activityType)
      .filter(Boolean),
  );

  const missingTypes = CHANGCHE_ACTIVITY_TYPES.filter((t) => !existingTypes.has(t));
  if (missingTypes.length === 0) return 0;

  const baseSchoolYear = calculateSchoolYear();
  const schoolYear = baseSchoolYear - studentGrade + targetGrade;

  let created = 0;
  for (const activityType of missingTypes) {
    const { error } = await supabase
      .from("student_record_changche")
      .upsert(
        {
          tenant_id: tenantId,
          student_id: studentId,
          school_year: schoolYear,
          grade: targetGrade,
          activity_type: activityType,
          content: "",
          status: "draft",
        },
        {
          onConflict: "tenant_id,student_id,school_year,grade,activity_type",
          ignoreDuplicates: true,
        },
      );

    if (!error) created++;
  }

  return created;
}
