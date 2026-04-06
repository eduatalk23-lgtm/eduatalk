// ============================================
// Agent 6: 리포트 생성 도구
// 활동 요약서, 세특 가이드, 학생 종합 프로필
// ============================================

import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, truncateWithMarker } from "../types";
import { toolError, TOOL_ERRORS } from "../types";
import { generateActivitySummary } from "@/lib/domains/student-record/llm/actions/generateActivitySummary";
import { generateSetekGuide } from "@/lib/domains/student-record/llm/actions/generateSetekGuide";
import { fetchActivitySummaries, fetchSetekGuides } from "@/lib/domains/student-record/actions/activitySummary";
import { getRecordTabData, getStorylineTabData } from "@/lib/domains/student-record/service";
import { findDiagnosisPair } from "@/lib/domains/student-record/repository/diagnosis-repository";
import { findCompetencyScores } from "@/lib/domains/student-record/repository/competency-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "report-tools" };

export function createReportTools(ctx: AgentContext) {
  return {
    /**
     * AI 활동 요약서 또는 세특 방향 가이드 생성
     */
    generateReport: tool({
      description:
        "AI 활동 요약서 또는 세특 방향 가이드를 생성합니다. 30-45초 소요될 수 있습니다. 생성된 리포트의 ID와 미리보기를 반환합니다.",
      inputSchema: z.object({
        reportType: z
          .enum(["activity_summary", "setek_guide"])
          .describe("리포트 유형: activity_summary(활동 요약서) 또는 setek_guide(세특 방향 가이드)"),
        targetGrades: z
          .array(z.number())
          .optional()
          .describe("대상 학년 배열 (기본: 전 학년)"),
      }),
      execute: async ({ reportType, targetGrades }) => {
        logActionDebug(LOG_CTX, `generateReport: type=${reportType}`);
        try {
          const result = reportType === "activity_summary"
            ? await generateActivitySummary(ctx.studentId, targetGrades)
            : await generateSetekGuide(ctx.studentId, targetGrades);

          if (!result.success) {
            return toolError(result.error ?? "리포트 생성에 실패했습니다.", { retryable: true, actionHint: "다시 시도하세요." });
          }

          const data = result.data!;

          return {
            success: true,
            data: {
              summaryId: data.summaryId,
              title: "title" in data ? data.title : "",
              preview: "fullText" in data
                ? (truncateWithMarker(data.fullText as string, 500) ?? "")
                : "guides" in data
                  ? (truncateWithMarker(
                      (data.guides as Array<{ subjectName: string; direction: string }>)
                        .map((g) => `[${g.subjectName}] ${truncateWithMarker(g.direction, 80) ?? ""}`)
                        .join("\n"),
                      500,
                    ) ?? "")
                  : "",
              sectionCount: "sections" in data
                ? (data.sections as unknown[]).length
                : "guides" in data
                  ? (data.guides as unknown[]).length
                  : 0,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("리포트 생성에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 기존 생성된 리포트 목록 조회
     */
    fetchSavedReports: tool({
      description:
        "기존에 생성된 활동 요약서 또는 세특 방향 가이드 목록을 조회합니다. 메타데이터만 반환합니다 (본문 생략).",
      inputSchema: z.object({
        reportType: z
          .enum(["activity_summary", "setek_guide", "all"])
          .optional()
          .describe("리포트 유형 필터 (기본: all)"),
        limit: z.number().optional().describe("최대 반환 수 (기본: 10)"),
      }),
      execute: async ({ reportType, limit }) => {
        const type = reportType ?? "all";
        const maxItems = limit ?? 10;
        logActionDebug(LOG_CTX, `fetchSavedReports: type=${type}`);
        try {
          const results: Array<{
            id: string;
            title: string;
            status: string;
            createdAt: string;
            reportType: string;
          }> = [];

          if (type === "all" || type === "activity_summary") {
            const res = await fetchActivitySummaries(ctx.studentId);
            if (res.success && res.data) {
              for (const r of res.data) {
                results.push({
                  id: r.id,
                  title: r.summary_title,
                  status: r.status,
                  createdAt: r.created_at,
                  reportType: "activity_summary",
                });
              }
            }
          }

          if (type === "all" || type === "setek_guide") {
            const res = await fetchSetekGuides(ctx.studentId);
            if (res.success && res.data) {
              for (const r of res.data) {
                results.push({
                  id: r.id,
                  title: `[${r.subject_id}] ${truncateWithMarker(r.direction, 50) ?? ""}`,
                  status: r.status,
                  createdAt: r.created_at,
                  reportType: "setek_guide",
                });
              }
            }
          }

          // 날짜 정렬 + 제한
          results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          return {
            success: true,
            data: {
              reports: results.slice(0, maxItems),
              totalCount: results.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("리포트 목록 ");
        }
      },
    }),

    /**
     * 학생 종합 프로필 (리포트 컨텍스트)
     */
    getStudentOverview: tool({
      description:
        "학생의 종합 프로필을 조회합니다. 기본정보(이름, 학년, 목표전공)와 선택적으로 기록 요약, 진단 데이터, 스토리라인을 포함합니다. 리포트 생성 전 맥락 구성에 활용하세요.",
      inputSchema: z.object({
        includeRecords: z.boolean().optional().describe("생기부 기록 요약 포함 (기본: false)"),
        includeDiagnosis: z.boolean().optional().describe("진단 데이터 포함 (기본: false)"),
        includeStorylines: z.boolean().optional().describe("스토리라인 포함 (기본: false)"),
        schoolYear: z.number().optional().describe("학년도 (기본: 현재)"),
      }),
      execute: async ({ includeRecords, includeDiagnosis, includeStorylines, schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getStudentOverview: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }

          // 학생 기본정보 조회
          const supabase = await createSupabaseServerClient();
          const { data: student, error: studentError } = await supabase
            .from("students")
            .select("id, grade, class, school_name, target_major, user_profiles(name)")
            .eq("id", ctx.studentId)
            .eq("tenant_id", ctx.tenantId)
            .maybeSingle();

          if (studentError || !student) {
            return TOOL_ERRORS.RESOURCE_NOT_FOUND("학생 정보");
          }

          const profile = student.user_profiles as unknown as { name: string | null } | null;

          const overview: Record<string, unknown> = {
            name: profile?.name ?? ctx.studentName,
            grade: student.grade,
            className: student.class,
            schoolName: student.school_name,
            targetMajor: student.target_major,
          };

          // 선택적 데이터 병렬 조회
          const promises: Promise<void>[] = [];

          if (includeRecords) {
            promises.push(
              getRecordTabData(ctx.studentId, year, ctx.tenantId).then((data) => {
                overview.recordSummary = {
                  setekCount: data.seteks.length,
                  personalSetekCount: data.personalSeteks.length,
                  changcheCount: data.changche.length,
                  hasHaengteuk: data.haengteuk !== null,
                  readingCount: data.readings.length,
                  subjects: data.seteks.map((s) => s.subject_id),
                };
              }),
            );
          }

          if (includeDiagnosis) {
            promises.push(
              Promise.all([
                findCompetencyScores(ctx.studentId, year, ctx.tenantId),
                findDiagnosisPair(ctx.studentId, year, ctx.tenantId),
              ]).then(([scores, diagPair]) => {
                const diag = diagPair.consultant ?? diagPair.ai;
                overview.diagnosis = {
                  competencyScores: scores.map((s) => ({
                    item: s.competency_item,
                    grade: s.grade_value,
                    source: s.source,
                  })),
                  overallGrade: diag?.overall_grade ?? null,
                  strengths: diag?.strengths ?? [],
                  weaknesses: diag?.weaknesses ?? [],
                  targetMajorMatch: diag?.recommended_majors ?? [],
                };
              }),
            );
          }

          if (includeStorylines) {
            promises.push(
              getStorylineTabData(ctx.studentId, year, ctx.tenantId).then((data) => {
                overview.storylines = data.storylines.map((s) => ({
                  title: s.title,
                  careerField: s.career_field,
                  keywords: s.keywords,
                }));
              }),
            );
          }

          const settled = await Promise.allSettled(promises);
          for (const result of settled) {
            if (result.status === "rejected") {
              logActionError(LOG_CTX, result.reason);
            }
          }

          return { success: true, data: overview };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("학생 프로필 ");
        }
      },
    }),
  };
}
