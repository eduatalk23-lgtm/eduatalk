// ============================================
// Agent 읽기 전용 데이터 도구
// 학생 생기부 데이터 조회 (분석 전 데이터 수집용)
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../types";
import { getRecordTabData, getStorylineTabData } from "@/lib/domains/student-record/service";
import {
  findCompetencyScores,
  findActivityTags,
} from "@/lib/domains/student-record/competency-repository";
import {
  findDiagnosisPair,
  findStrategies,
} from "@/lib/domains/student-record/diagnosis-repository";
import { findStorylinesByStudent } from "@/lib/domains/student-record/repository";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "data-tools" };

export function createDataTools(ctx: AgentContext) {
  return {
    /**
     * 학생의 생기부 기록(세특/창체/행특/독서) 조회
     */
    getStudentRecords: tool({
      description:
        "학생의 생기부 기록을 조회합니다. 세특(교과 세부능력특기사항), 개인 세특, 창체(창의적 체험활동), 행특(행동특성 및 종합의견), 독서 기록을 모두 반환합니다. 분석 전에 반드시 먼저 호출하세요.",
      inputSchema: z.object({
        schoolYear: z
          .number()
          .optional()
          .describe("조회할 학년도 (기본: 현재 학년도)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getStudentRecords: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return { success: false, error: "테넌트 정보가 없습니다." };
          }
          const data = await getRecordTabData(ctx.studentId, year, ctx.tenantId);
          // 요약본으로 변환 (토큰 절약)
          const summary = {
            seteks: data.seteks.map((s) => ({
              subjectId: s.subject_id,
              grade: s.grade,
              semester: s.semester,
              content: s.content?.slice(0, 500),
            })),
            personalSeteks: data.personalSeteks.map((s) => ({
              title: s.title,
              grade: s.grade,
              content: s.content?.slice(0, 500),
            })),
            changche: data.changche.map((c) => ({
              activityType: c.activity_type,
              grade: c.grade,
              content: c.content?.slice(0, 500),
            })),
            haengteuk: data.haengteuk
              ? { content: data.haengteuk.content?.slice(0, 500) }
              : null,
            readings: data.readings.map((r) => ({
              bookTitle: r.book_title,
              author: r.author,
              subjectArea: r.subject_area,
              notes: r.notes?.slice(0, 300),
            })),
          };
          return { success: true, data: summary };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "생기부 기록 조회에 실패했습니다." };
        }
      },
    }),

    /**
     * 학생의 진단 데이터 조회 (역량 등급 + 활동 태그 + AI/수동 진단)
     */
    getStudentDiagnosis: tool({
      description:
        "학생의 역량 진단 데이터를 조회합니다. 10개 역량 등급, 활동 태그, AI/컨설턴트 진단 결과, 보완전략을 반환합니다.",
      inputSchema: z.object({
        schoolYear: z
          .number()
          .optional()
          .describe("조회할 학년도 (기본: 현재 학년도)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getStudentDiagnosis: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return { success: false, error: "테넌트 정보가 없습니다." };
          }
          const [scores, tags, diagPair, strategies] = await Promise.all([
            findCompetencyScores(ctx.studentId, year, ctx.tenantId),
            findActivityTags(ctx.studentId, ctx.tenantId),
            findDiagnosisPair(ctx.studentId, year, ctx.tenantId),
            findStrategies(ctx.studentId, year, ctx.tenantId),
          ]);
          return {
            success: true,
            data: {
              competencyScores: scores.map((s) => ({
                item: s.competency_item,
                grade: s.grade_value,
                source: s.source,
              })),
              activityTagCount: tags.length,
              positiveTags: tags
                .filter((t) => t.evaluation === "positive")
                .slice(0, 10)
                .map((t) => ({
                  item: t.competency_item,
                  evidence: t.evidence_summary?.slice(0, 100),
                })),
              negativeTags: tags
                .filter((t) => t.evaluation === "negative")
                .slice(0, 10)
                .map((t) => ({
                  item: t.competency_item,
                  evidence: t.evidence_summary?.slice(0, 100),
                })),
              aiDiagnosis: diagPair.ai
                ? {
                    overallGrade: diagPair.ai.overall_grade,
                    strengths: diagPair.ai.strengths,
                    weaknesses: diagPair.ai.weaknesses,
                    recommendedMajors: diagPair.ai.recommended_majors,
                  }
                : null,
              consultantDiagnosis: diagPair.consultant
                ? {
                    overallGrade: diagPair.consultant.overall_grade,
                    strengths: diagPair.consultant.strengths,
                    weaknesses: diagPair.consultant.weaknesses,
                  }
                : null,
              strategies: strategies.slice(0, 5).map((s) => ({
                targetArea: s.target_area,
                content: s.strategy_content?.slice(0, 200),
                status: s.status,
              })),
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "진단 데이터 조회에 실패했습니다." };
        }
      },
    }),

    /**
     * 학생의 스토리라인 조회
     */
    getStudentStorylines: tool({
      description:
        "학생의 탐구 스토리라인 데이터를 조회합니다. 학년간 탐구 연결과 로드맵 정보를 반환합니다.",
      inputSchema: z.object({
        schoolYear: z
          .number()
          .optional()
          .describe("조회할 학년도 (기본: 현재 학년도)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getStudentStorylines: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return { success: false, error: "테넌트 정보가 없습니다." };
          }
          const [storylineData, storylines] = await Promise.all([
            getStorylineTabData(ctx.studentId, year, ctx.tenantId),
            findStorylinesByStudent(ctx.studentId, ctx.tenantId),
          ]);
          return {
            success: true,
            data: {
              storylines: storylines.map((s) => ({
                id: s.id,
                title: s.title,
                careerField: s.career_field,
                keywords: s.keywords,
              })),
              roadmapItems: storylineData.roadmapItems.map((r) => ({
                storylineId: r.storyline_id,
                grade: r.grade,
                semester: r.semester,
                area: r.area,
                planContent: r.plan_content?.slice(0, 200),
              })),
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "스토리라인 조회에 실패했습니다." };
        }
      },
    }),
  };
}
