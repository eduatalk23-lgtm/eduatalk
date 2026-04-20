/**
 * Phase G S-3-a: designStudentPlan — plan-sub 위임 MCP tool.
 *
 * Shell 이 조회 tool 만으로 해결할 수 없는 "수강 계획 설계·적합도 분석·충돌 해결"
 * 요청을 만나면 이 tool 을 호출한다. 내부적으로 planSub 서브에이전트가 6 tool 로
 * end-to-end 처리한 뒤 구조화된 요약을 반환한다.
 *
 * Layer 1 가드: admin/consultant/superadmin 만 tool 을 볼 수 있어야 한다
 *  (roleFilter.ADMIN_ONLY_TOOL_NAMES 에 등록). Layer 2 는 runSubagent 내부.
 */

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgentContext } from "@/lib/agents/types";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";
import { runSubagent } from "@/lib/mcp/subagents/_shared/subagentRunner";
import { planSub } from "@/lib/mcp/subagents/plan-sub";

function resolveSchoolYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export type DesignStudentPlanOutput =
  | {
      ok: true;
      runId: string;
      studentId: string;
      studentName: string | null;
      durationMs: number;
      stepCount: number;
      summary: {
        headline: string;
        adequacyScore?: number;
        keyFindings: string[];
        conflicts: string[];
        recommendedCourses: string[];
        recommendedActions: string[];
        artifactIds: string[];
        followUpQuestions?: string[];
      };
    }
  | { ok: false; reason: string; runId?: string | null };

export const designStudentPlanDescription =
  "학생의 수강 계획을 설계합니다. 조회 tool(getStudentOverview/getStudentRecords) 만으로는 해결할 수 없는 요청 — 전공 계열 교과이수적합도 계산·추천 과목 생성·수강 계획 충돌 검사·계획 개선안 제시 — 에만 호출합니다. admin/consultant 전용. 실행에 최대 40초가 걸리므로 사용자에게 '수강 계획을 분석 중입니다, 잠시만 기다려 주세요'로 먼저 안내하세요. 내부에서 plan-sub 서브에이전트가 end-to-end 처리 후 요약 카드를 반환합니다.";

export const designStudentPlanInputShape = {
  studentName: z
    .string()
    .min(1)
    .describe("대상 학생 이름. 같은 테넌트에서만 검색됨."),
  request: z
    .string()
    .min(4)
    .max(1000)
    .describe(
      "자연어로 서브에이전트가 수행할 작업 요약. 예: '경영 계열로 추천 과목 다시 뽑고 충돌 검사해줘', '2학년 2학기 수강 계획 적합도 점검', '국제통상학 기준 수강 로드맵 제안'",
    ),
} as const;

export const designStudentPlanInputSchema = z.object(
  designStudentPlanInputShape,
);

export type DesignStudentPlanInput = z.infer<
  typeof designStudentPlanInputSchema
>;

export async function designStudentPlanExecute({
  studentName,
  request,
}: DesignStudentPlanInput): Promise<DesignStudentPlanOutput> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (
    user.role !== "admin" &&
    user.role !== "consultant" &&
    user.role !== "superadmin"
  ) {
    return {
      ok: false,
      reason: "designStudentPlan 은 admin/consultant 전용입니다.",
    };
  }

  const target = await resolveStudentTarget({ studentName });
  if (!target.ok) return { ok: false, reason: target.reason };

  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("grade, school_name, target_major, curriculum_revision")
    .eq("id", target.studentId)
    .eq("tenant_id", target.tenantId)
    .maybeSingle();

  if (!student) {
    return { ok: false, reason: "학생 프로필을 조회할 수 없습니다." };
  }

  let schoolCategory: string | null = null;
  if (student.school_name) {
    const { data: profile } = await supabase
      .from("school_profiles")
      .select("school_category")
      .eq("school_name", student.school_name)
      .eq("tenant_id", target.tenantId)
      .maybeSingle();
    schoolCategory = profile?.school_category ?? null;
  }

  const ctx: AgentContext = {
    userId: user.userId,
    role: user.role,
    tenantId: target.tenantId,
    studentId: target.studentId,
    studentName: target.studentName ?? studentName,
    schoolYear: resolveSchoolYear(),
    uiState: null,
    studentGrade: student.grade ?? null,
    schoolName: student.school_name ?? null,
    schoolCategory,
    targetMajor: student.target_major ?? null,
    curriculumRevision: student.curriculum_revision ?? null,
  };

  const result = await runSubagent({
    def: planSub,
    ctx,
    input: request,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, runId: result.runId };
  }

  return {
    ok: true,
    runId: result.runId,
    studentId: target.studentId,
    studentName: target.studentName,
    durationMs: result.durationMs,
    stepCount: result.stepCount,
    summary: {
      headline: result.summary.headline,
      adequacyScore: result.summary.adequacyScore,
      keyFindings: result.summary.keyFindings ?? [],
      conflicts: result.summary.conflicts ?? [],
      recommendedCourses: result.summary.recommendedCourses ?? [],
      recommendedActions: result.summary.recommendedActions ?? [],
      artifactIds: result.summary.artifactIds ?? [],
      followUpQuestions: result.summary.followUpQuestions,
    },
  };
}
