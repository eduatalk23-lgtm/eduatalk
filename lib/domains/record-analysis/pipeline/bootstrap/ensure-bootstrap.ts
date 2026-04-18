// ============================================
// Phase 1 Auto-Bootstrap
//
// target_major 설정된 학생이 파이프라인 진입 시, 빠진 선결 조건을 자동으로 채운다.
// - target_major 값이 표준 Tier 2 키인지 검증 (실패 시 hard fail)
// - 활성 main_exploration 없으면 LLM seed 로 초안 생성
// - 수강 계획(course_plan) 0건이면 추천 자동 생성
//
// Phase 2 에서 pipelineType="bootstrap" row 로 승격될 예정. 현재는 inline 실행.
// Phase 3 에서 k≥1 세특 요약 주입 + origin/edited_by_consultant_at 가드 추가 예정.
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { validateTargetMajor, MAJOR_TO_TIER1 } from "@/lib/constants/career-classification";
import { createMainExploration } from "@/lib/domains/student-record/repository/main-exploration-repository";
import { generateAndSaveRecommendations } from "@/lib/domains/student-record/course-plan/service";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { generateMainExplorationSeed } from "../../llm/actions/generateMainExplorationSeed";

const LOG_CTX = { domain: "record-analysis", action: "bootstrap" };

export class BootstrapError extends Error {
  constructor(
    message: string,
    public readonly step: "target_major" | "main_exploration" | "course_plan",
  ) {
    super(message);
    this.name = "BootstrapError";
  }
}

export interface BootstrapResult {
  targetMajorValid: boolean;
  mainExplorationCreated: boolean;
  coursePlanCreated: boolean;
  coursePlanCount: number;
}

/**
 * 파이프라인 진입 전 선결 조건 자동 채움.
 * - 이미 존재하는 항목은 skip (idempotent)
 * - LLM/service 실패 시 BootstrapError throw → 호출자가 파이프라인 진입 차단
 */
export async function ensureBootstrap(
  studentId: string,
  tenantId: string,
): Promise<BootstrapResult> {
  const supabase = await createSupabaseServerClient();

  // ── 1. 학생 + target_major 조회·검증 ─────────────────
  const { data: student, error: stuErr } = await supabase
    .from("students")
    .select("grade, target_major, target_major_2")
    .eq("id", studentId)
    .maybeSingle();
  if (stuErr || !student) {
    throw new BootstrapError(
      `학생 조회 실패: ${stuErr?.message ?? "not found"}`,
      "target_major",
    );
  }
  const v = validateTargetMajor(student.target_major);
  if (!v.ok) {
    throw new BootstrapError(v.reason, "target_major");
  }
  const major = student.target_major as string;
  const major2 = student.target_major_2 as string | null;
  const grade = (student.grade ?? 1) as 1 | 2 | 3;

  // ── 2. main_exploration 보장 ───────────────────────
  const mainCreated = await ensureMainExploration({
    studentId,
    tenantId,
    targetMajor: major,
    targetMajor2: major2,
    grade,
  });

  // ── 3. course_plan 보장 ────────────────────────────
  const { count: planCount } = await supabase
    .from("student_course_plans")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  let coursePlanCreated = false;
  let coursePlanCount = planCount ?? 0;
  if (coursePlanCount === 0) {
    try {
      const created = await generateAndSaveRecommendations(studentId, tenantId);
      coursePlanCreated = true;
      coursePlanCount = created.length;
      logActionDebug(LOG_CTX, "course_plan 자동 생성", {
        studentId,
        created: created.length,
      });
    } catch (err) {
      logActionError(LOG_CTX, err, { studentId, step: "course_plan" });
      throw new BootstrapError(
        `수강 계획 자동 생성 실패: ${err instanceof Error ? err.message : String(err)}`,
        "course_plan",
      );
    }
  }

  return {
    targetMajorValid: true,
    mainExplorationCreated: mainCreated,
    coursePlanCreated,
    coursePlanCount,
  };
}

async function ensureMainExploration(args: {
  studentId: string;
  tenantId: string;
  targetMajor: string;
  targetMajor2: string | null;
  grade: 1 | 2 | 3;
}): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("student_main_explorations")
    .select("id")
    .eq("student_id", args.studentId)
    .eq("tenant_id", args.tenantId)
    .eq("is_active", true)
    .limit(1);
  if (existing && existing.length > 0) {
    return false;
  }

  const tier1 = MAJOR_TO_TIER1[args.targetMajor] ?? null;
  if (!tier1) {
    throw new BootstrapError(
      `Tier 1 매핑 실패: target_major='${args.targetMajor}'`,
      "main_exploration",
    );
  }

  const seed = await generateMainExplorationSeed({
    targetMajor: args.targetMajor,
    targetMajor2: args.targetMajor2,
    tier1Code: tier1,
    currentGrade: args.grade,
  });
  if (!seed.success) {
    throw new BootstrapError(
      `LLM seed 생성 실패: ${seed.error}`,
      "main_exploration",
    );
  }

  const schoolYear = calculateSchoolYear();
  const currentMonth = new Date().getMonth() + 1;
  const semester: 1 | 2 = currentMonth >= 3 && currentMonth <= 8 ? 1 : 2;

  try {
    await createMainExploration({
      studentId: args.studentId,
      tenantId: args.tenantId,
      schoolYear,
      grade: args.grade,
      semester,
      scope: "overall",
      direction: "design",
      semanticRole: "hypothesis_root",
      source: "ai",
      themeLabel: seed.data.themeLabel,
      themeKeywords: seed.data.themeKeywords,
      careerField: tier1,
      tierPlan: seed.data.tierPlan,
      modelName: seed.modelName ?? null,
    });
    logActionDebug(LOG_CTX, "main_exploration 자동 생성", {
      studentId: args.studentId,
      themeLabel: seed.data.themeLabel,
      elapsedMs: seed.elapsedMs,
    });
    return true;
  } catch (err) {
    logActionError(LOG_CTX, err, { studentId: args.studentId, step: "main_exploration_insert" });
    throw new BootstrapError(
      `main_exploration 저장 실패: ${err instanceof Error ? err.message : String(err)}`,
      "main_exploration",
    );
  }
}
