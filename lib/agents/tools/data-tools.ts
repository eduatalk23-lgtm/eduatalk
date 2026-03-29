// ============================================
// Agent 읽기 전용 데이터 도구
// 학생 생기부 데이터 조회 (분석 전 데이터 수집용)
// ============================================

import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, truncateWithMarker, TOOL_ERRORS } from "../types";
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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

interface CacheEntry {
  success: boolean;
  data?: unknown;
  error?: string;
  cachedAt: number;
}

export function createDataTools(ctx: AgentContext) {
  // 요청 스코프 캐시 — 동일 조회 중복 방지 (5분 TTL)
  const cache = new Map<string, CacheEntry>();

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
        const cacheKey = `records:${year}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
          logActionDebug(LOG_CTX, `getStudentRecords: cache hit (year=${year})`);
          return cached;
        }
        logActionDebug(LOG_CTX, `getStudentRecords: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }
          const data = await getRecordTabData(ctx.studentId, year, ctx.tenantId);
          // 요약본으로 변환 (토큰 절약)
          const summary = {
            seteks: data.seteks.map((s) => ({
              subjectId: s.subject_id,
              grade: s.grade,
              semester: s.semester,
              content: truncateWithMarker(s.content, 300),
            })),
            personalSeteks: data.personalSeteks.map((s) => ({
              title: s.title,
              grade: s.grade,
              content: truncateWithMarker(s.content, 300),
            })),
            changche: data.changche.map((c) => ({
              activityType: c.activity_type,
              grade: c.grade,
              content: truncateWithMarker(c.content, 300),
            })),
            haengteuk: data.haengteuk
              ? { content: truncateWithMarker(data.haengteuk.content, 300) }
              : null,
            readings: data.readings.map((r) => ({
              bookTitle: r.book_title,
              author: r.author,
              subjectArea: r.subject_area,
              notes: truncateWithMarker(r.notes, 300),
            })),
          };
          const isEmpty = summary.seteks.length === 0 && summary.personalSeteks.length === 0
            && summary.changche.length === 0 && !summary.haengteuk && summary.readings.length === 0;
          const result = {
            success: true as const,
            data: summary,
            ...(isEmpty && { actionHint: "이 학생은 아직 생기부 기록이 없습니다. 기록을 먼저 입력하거나 HTML 임포트를 진행하세요. 분석 도구는 기록이 있어야 사용할 수 있습니다." }),
          };
          cache.set(cacheKey, { ...result, cachedAt: Date.now() });
          return result;
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("생기부 기록");
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
        const cacheKey = `diagnosis:${year}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
          logActionDebug(LOG_CTX, `getStudentDiagnosis: cache hit (year=${year})`);
          return cached;
        }
        logActionDebug(LOG_CTX, `getStudentDiagnosis: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }
          const [scoresRes, tagsRes, diagRes, stratRes] = await Promise.allSettled([
            findCompetencyScores(ctx.studentId, year, ctx.tenantId),
            findActivityTags(ctx.studentId, ctx.tenantId),
            findDiagnosisPair(ctx.studentId, year, ctx.tenantId),
            findStrategies(ctx.studentId, year, ctx.tenantId),
          ]);
          const scores = scoresRes.status === "fulfilled" ? scoresRes.value : [];
          const tags = tagsRes.status === "fulfilled" ? tagsRes.value : [];
          const diagPair = diagRes.status === "fulfilled" ? diagRes.value : { ai: null, consultant: null };
          const strategies = stratRes.status === "fulfilled" ? stratRes.value : [];
          const queryNames = ["competencyScores", "activityTags", "diagnosisPair", "strategies"];
          const queryResults = [scoresRes, tagsRes, diagRes, stratRes];
          for (let i = 0; i < queryResults.length; i++) {
            if (queryResults[i].status === "rejected") {
              logActionError(LOG_CTX, `${queryNames[i]} 조회 실패: ${(queryResults[i] as PromiseRejectedResult).reason}`);
            }
          }
          const result = {
            success: true as const,
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
                  evidence: truncateWithMarker(t.evidence_summary, 100),
                })),
              negativeTags: tags
                .filter((t) => t.evaluation === "negative")
                .slice(0, 10)
                .map((t) => ({
                  item: t.competency_item,
                  evidence: truncateWithMarker(t.evidence_summary, 100),
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
                content: truncateWithMarker(s.strategy_content, 200),
                status: s.status,
              })),
            },
          };
          cache.set(cacheKey, { ...result, cachedAt: Date.now() });
          return result;
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("진단 데이터");
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
        const cacheKey = `storylines:${year}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
          logActionDebug(LOG_CTX, `getStudentStorylines: cache hit (year=${year})`);
          return cached;
        }
        logActionDebug(LOG_CTX, `getStudentStorylines: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }
          const [storylineData, storylines] = await Promise.all([
            getStorylineTabData(ctx.studentId, year, ctx.tenantId),
            findStorylinesByStudent(ctx.studentId, ctx.tenantId),
          ]);
          const result = {
            success: true as const,
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
                planContent: truncateWithMarker(r.plan_content, 200),
              })),
            },
          };
          cache.set(cacheKey, { ...result, cachedAt: Date.now() });
          return result;
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("스토리라인");
        }
      },
    }),
  };
}
