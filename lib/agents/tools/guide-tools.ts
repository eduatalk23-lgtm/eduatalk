// ============================================
// Agent 2: 탐구 가이드 RAG 검색 도구
// 벡터 검색 + 메타데이터 필터 + 상세 조회
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../types";
import { findGuideById, findAssignmentsWithGuides } from "@/lib/domains/guide/repository";
import { searchGuidesByVector } from "@/lib/domains/guide/vector/search-service";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "guide-tools" };

export function createGuideTools(ctx: AgentContext) {
  return {
    /**
     * 자연어 쿼리로 관련 탐구 가이드 검색 (벡터 + 메타데이터)
     */
    searchGuides: tool({
      description:
        "자연어 쿼리로 관련 탐구 가이드를 검색합니다. 벡터 유사도와 메타데이터 필터(계열, 과목, 유형)를 조합하여 가장 관련성 높은 가이드를 반환합니다. 예: '법학 계열 수학 탐구', '물리학 실험 가이드'",
      inputSchema: z.object({
        query: z.string().describe("검색 쿼리 (자연어)"),
        careerFieldId: z
          .number()
          .optional()
          .describe("계열 필터 (career_fields.id)"),
        subjectId: z
          .string()
          .optional()
          .describe("과목 필터 (subjects.id)"),
        guideType: z
          .enum([
            "reading",
            "topic_exploration",
            "subject_performance",
            "experiment",
            "program",
          ])
          .optional()
          .describe("가이드 유형 필터"),
        limit: z
          .number()
          .optional()
          .describe("반환할 최대 개수 (기본: 5)"),
      }),
      execute: async ({ query, careerFieldId, subjectId, guideType, limit }) => {
        logActionDebug(LOG_CTX, `searchGuides: query="${query}"`);
        try {
          const results = await searchGuidesByVector({
            query,
            careerFieldId,
            subjectId,
            guideType,
            matchCount: limit ?? 5,
          });

          if (results.length === 0) {
            return {
              success: true,
              data: {
                guides: [],
                message: "검색 결과가 없습니다. 다른 키워드로 시도해보세요.",
              },
            };
          }

          return {
            success: true,
            data: {
              guides: results.map((r) => ({
                id: r.guide_id,
                title: r.title,
                guideType: r.guide_type,
                bookTitle: r.book_title,
                bookAuthor: r.book_author,
                motivation: r.motivation?.slice(0, 200),
                score: r.score,
              })),
              totalFound: results.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "가이드 검색에 실패했습니다." };
        }
      },
    }),

    /**
     * 가이드 상세 조회
     */
    getGuideDetail: tool({
      description:
        "특정 탐구 가이드의 상세 내용을 조회합니다. 동기, 이론, 고찰, 세특 예시 등 전체 콘텐츠를 반환합니다.",
      inputSchema: z.object({
        guideId: z.string().describe("가이드 ID"),
      }),
      execute: async ({ guideId }) => {
        logActionDebug(LOG_CTX, `getGuideDetail: id=${guideId}`);
        try {
          const guide = await findGuideById(guideId);
          if (!guide) {
            return { success: false, error: "가이드를 찾을 수 없습니다." };
          }

          return {
            success: true,
            data: {
              id: guide.id,
              title: guide.title,
              guideType: guide.guide_type,
              bookTitle: guide.book_title,
              bookAuthor: guide.book_author,
              subjects: guide.subjects.map((s) => s.name),
              careerFields: guide.career_fields.map((c) => c.name_kor),
              content: guide.content
                ? {
                    motivation: guide.content.motivation,
                    theorySections: guide.content.theory_sections
                      .map((s) => ({
                        title: s.title,
                        content: s.content?.slice(0, 500),
                      })),
                    reflection: guide.content.reflection?.slice(0, 300),
                    summary: guide.content.summary?.slice(0, 300),
                    setekExamples: guide.content.setek_examples?.slice(0, 3),
                  }
                : null,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "가이드 상세 조회에 실패했습니다." };
        }
      },
    }),

    /**
     * 학생에게 배정된 가이드 목록
     */
    getStudentAssignments: tool({
      description:
        "현재 학생에게 배정된 탐구 가이드 목록을 조회합니다. 배정 상태(배정됨/진행중/완료/취소)와 연결된 기록 정보를 포함합니다.",
      inputSchema: z.object({
        schoolYear: z
          .number()
          .optional()
          .describe("조회할 학년도 (기본: 현재 학년도)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getStudentAssignments: year=${year}`);
        try {
          const assignments = await findAssignmentsWithGuides(
            ctx.studentId,
            year,
          );

          return {
            success: true,
            data: {
              assignments: assignments.map((a) => ({
                id: a.id,
                status: a.status,
                grade: a.grade,
                guideTitle: a.exploration_guides.title,
                guideType: a.exploration_guides.guide_type,
                linkedRecordType: a.linked_record_type,
                notes: a.notes?.slice(0, 200),
              })),
              total: assignments.length,
              completed: assignments.filter((a) => a.status === "completed")
                .length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "가이드 배정 목록 조회에 실패했습니다." };
        }
      },
    }),
  };
}
