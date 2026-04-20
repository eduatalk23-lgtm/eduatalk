/**
 * Phase G S-3-b: analyzeAdmission — admission-sub 위임 MCP tool.
 *
 * Shell 이 조회 tool 만으로 해결할 수 없는 "입시 배치·면접·교차지원 복합
 * 의사결정" 요청을 만나면 이 tool 을 호출한다. 내부적으로 admissionSub
 * 서브에이전트가 21 tool 로 end-to-end 처리한 뒤 구조화된 요약을 반환한다.
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
import { admissionSub } from "@/lib/mcp/subagents/admission-sub";

function resolveSchoolYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export type AnalyzeAdmissionOutput =
  | {
      ok: true;
      runId: string;
      studentId: string;
      studentName: string | null;
      durationMs: number;
      stepCount: number;
      summary: {
        headline: string;
        recommendedUniversities: string[];
        keyFindings: string[];
        strategyNotes: string[];
        warnings: string[];
        recommendedActions: string[];
        artifactIds: string[];
        followUpQuestions?: string[];
      };
    }
  | { ok: false; reason: string; runId?: string | null };

export const analyzeAdmissionDescription =
  "학생의 입시 배치·면접·교차지원을 분석합니다. 조회 tool 만으로는 해결할 수 없는 요청 — 6장 배분 시뮬레이션·배치 verdict 조합·면접 준비·교차지원 탐색·수능최저 충족 판단·예측 정확도 기반 의사결정 — 에만 호출합니다. admin/consultant 전용. 실행에 최대 55초가 걸리므로 사용자에게 '입시 분석을 시작했습니다, 잠시만 기다려 주세요'로 먼저 안내하세요. 내부에서 admission-sub 서브에이전트가 end-to-end 처리 후 요약 카드를 반환합니다.";

export const analyzeAdmissionInputShape = {
  studentName: z
    .string()
    .min(1)
    .describe("대상 학생 이름. 같은 테넌트에서만 검색됨."),
  request: z
    .string()
    .min(4)
    .max(1000)
    .describe(
      "자연어로 서브에이전트가 수행할 작업 요약. 예: '6장 배분 추천해줘', '고려대 경영 배치 verdict', '연세대 활동우수형 면접 준비', '교차지원 후보 탐색', '수능최저 충족 점검'",
    ),
} as const;

export const analyzeAdmissionInputSchema = z.object(
  analyzeAdmissionInputShape,
);

export type AnalyzeAdmissionInput = z.infer<
  typeof analyzeAdmissionInputSchema
>;

export async function analyzeAdmissionExecute({
  studentName,
  request,
}: AnalyzeAdmissionInput): Promise<AnalyzeAdmissionOutput> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (
    user.role !== "admin" &&
    user.role !== "consultant" &&
    user.role !== "superadmin"
  ) {
    return {
      ok: false,
      reason: "analyzeAdmission 은 admin/consultant 전용입니다.",
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
    def: admissionSub,
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
      recommendedUniversities: result.summary.recommendedUniversities ?? [],
      keyFindings: result.summary.keyFindings ?? [],
      strategyNotes: result.summary.strategyNotes ?? [],
      warnings: result.summary.warnings ?? [],
      recommendedActions: result.summary.recommendedActions ?? [],
      artifactIds: result.summary.artifactIds ?? [],
      followUpQuestions: result.summary.followUpQuestions,
    },
  };
}
