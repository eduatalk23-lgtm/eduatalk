/**
 * Phase G S-1: analyzeRecordDeep — record-sub 위임 MCP tool.
 *
 * Shell 이 직속 data-tools 로 해결할 수 없는 "분석·진단·생성" 요청을 만나면
 * 이 tool 1 개를 호출한다. 내부적으로 recordSub 서브에이전트가 28 tool 로
 * end-to-end 처리한 뒤 구조화된 요약을 반환한다.
 *
 * Layer 1 가드: admin/consultant/superadmin 만 tool 을 볼 수 있어야 한다.
 *  → Shell 측 user role 분기 또는 향후 tool dynamic filter 로 처리 (S-2).
 *  현재는 runSubagent 내부 Layer 2 만 즉시 유효.
 */

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgentContext } from "@/lib/agents/types";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";
import { runSubagent } from "@/lib/mcp/subagents/_shared/subagentRunner";
import { recordSub } from "@/lib/mcp/subagents/record-sub";

function resolveSchoolYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export type AnalyzeRecordDeepOutput =
  | {
      ok: true;
      runId: string;
      studentId: string;
      studentName: string | null;
      durationMs: number;
      stepCount: number;
      summary: {
        headline: string;
        keyFindings: string[];
        recommendedActions: string[];
        artifactIds: string[];
        followUpQuestions?: string[];
      };
    }
  | { ok: false; reason: string; runId?: string | null };

export const analyzeRecordDeepDescription =
  "학생 생기부를 심층 분석합니다. 단순 조회(getStudentRecords/getStudentDiagnosis/getStudentStorylines/getStudentOverview)로 해결되지 않는 요청 — 새 진단 생성·세특 초안 작성·역량 종합 분석·리포트 작성·복합 전략 제안 — 에만 호출합니다. admin/consultant 전용. 실행에 최대 45초가 걸리므로 사용자에게 '분석을 시작했습니다, 잠시만 기다려 주세요'로 먼저 안내하세요. 내부에서 record-sub 서브에이전트가 28 tool 로 end-to-end 처리 후 요약 카드를 반환합니다.";

export const analyzeRecordDeepInputShape = {
  studentName: z
    .string()
    .min(1)
    .describe("대상 학생 이름. 같은 테넌트에서만 검색됨."),
  request: z
    .string()
    .min(4)
    .max(1000)
    .describe(
      "자연어로 서브에이전트가 수행할 작업 요약. 예: '2학년 세특 역량 종합 분석해줘', '김세린 리포트 초안 생성', '국어 세특 개선안 제시'",
    ),
} as const;

export const analyzeRecordDeepInputSchema = z.object(
  analyzeRecordDeepInputShape,
);

export type AnalyzeRecordDeepInput = z.infer<
  typeof analyzeRecordDeepInputSchema
>;

export async function analyzeRecordDeepExecute({
  studentName,
  request,
}: AnalyzeRecordDeepInput): Promise<AnalyzeRecordDeepOutput> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (
    user.role !== "admin" &&
    user.role !== "consultant" &&
    user.role !== "superadmin"
  ) {
    return {
      ok: false,
      reason: "analyzeRecordDeep 은 admin/consultant 전용입니다.",
    };
  }

  const target = await resolveStudentTarget({ studentName });
  if (!target.ok) return { ok: false, reason: target.reason };

  // 학생 프로필 보강 (orchestrator 와 동일 경로)
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
    def: recordSub,
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
      keyFindings: result.summary.keyFindings ?? [],
      recommendedActions: result.summary.recommendedActions ?? [],
      artifactIds: result.summary.artifactIds ?? [],
      followUpQuestions: result.summary.followUpQuestions,
    },
  };
}
