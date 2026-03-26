// ============================================
// Agent 2: 탐구 가이드 RAG 검색 도구
// 벡터 검색 + 메타데이터 필터 + 상세 조회
// ============================================

import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, truncateWithMarker } from "../types";
import { findGuideById, findAssignmentsWithGuides } from "@/lib/domains/guide/repository";
import { searchGuidesByVector } from "@/lib/domains/guide/vector/search-service";
import { generateGuideAction } from "@/lib/domains/guide/llm/actions/generateGuide";
import { resolveContentSections } from "@/lib/domains/guide/section-config";
import { loadStudentProfileForGuide } from "@/lib/domains/guide/llm/loaders/student-profile-loader";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { GuideType } from "@/lib/domains/guide/types";

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
                motivation: truncateWithMarker(r.motivation, 200),
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
                ? (() => {
                    const sections = resolveContentSections(
                      guide.guide_type as GuideType,
                      guide.content,
                    );
                    return {
                      sections: sections
                        .filter((s) => s.key !== "setek_examples")
                        .map((s) => ({
                          key: s.key,
                          label: s.label,
                          content: truncateWithMarker(s.content, 500),
                          outline: s.outline?.slice(0, 15).map((item) => ({
                            depth: item.depth,
                            text: item.text,
                            tip: item.tip,
                          })),
                        })),
                      setekExamples: guide.content.setek_examples?.slice(0, 3),
                    };
                  })()
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
     * AI 가이드 생성 (키워드/PDF/URL/클론)
     */
    generateGuide: tool({
      description:
        "새 탐구 가이드를 AI로 생성합니다. 키워드, PDF URL, 웹페이지 URL, 기존 가이드 변형 중 하나를 소스로 사용합니다.",
      inputSchema: z.object({
        source: z
          .enum(["keyword", "pdf_extract", "url_extract", "clone_variant"])
          .describe("생성 소스: keyword(키워드), pdf_extract(PDF), url_extract(웹페이지), clone_variant(기존 가이드 변형)"),
        input: z
          .string()
          .describe("소스에 따른 입력: keyword→키워드, pdf_extract→PDF URL, url_extract→웹 URL, clone_variant→원본 가이드 ID"),
        guideType: z
          .enum(["reading", "topic_exploration", "subject_performance", "experiment", "program"])
          .default("topic_exploration")
          .describe("생성할 가이드 유형"),
        targetSubject: z
          .string()
          .optional()
          .describe("관련 과목명 (한글)"),
        targetCareerField: z
          .string()
          .optional()
          .describe("관련 계열 (예: 공학계열, 의약계열)"),
        additionalContext: z
          .string()
          .optional()
          .describe("추가 요청사항"),
        useStudentProfile: z
          .boolean()
          .default(true)
          .describe("학생 프로필 기반 진로 연계 가이드 생성 여부 (기본: true)"),
        selectedSectionKeys: z
          .array(z.string())
          .optional()
          .describe("생성할 섹션 key 목록 (미지정 시 유형 기본 섹션 전체 생성)"),
      }),
      execute: async ({ source, input: inputValue, guideType, targetSubject, targetCareerField, additionalContext, useStudentProfile, selectedSectionKeys }) => {
        logActionDebug(LOG_CTX, `generateGuide: source=${source}, input=${inputValue.slice(0, 50)}`);
        try {
          // 학생 프로필 로드 (Agent 컨텍스트에서)
          const studentProfile =
            useStudentProfile && ctx.studentId
              ? await loadStudentProfileForGuide(ctx.studentId)
              : null;

          // 소스별 입력 구성
          const generationInput = buildGenerationInput(
            source,
            inputValue,
            guideType,
            targetSubject,
            targetCareerField,
            additionalContext,
          );

          // 학생 프로필 주입
          if (studentProfile) {
            generationInput.studentProfile = studentProfile;
          }

          // 섹션 선택 주입
          if (selectedSectionKeys?.length) {
            generationInput.selectedSectionKeys = selectedSectionKeys;
          }

          const result = await generateGuideAction(generationInput);

          if (!result.success) {
            return { success: false, error: result.error ?? "가이드 생성에 실패했습니다." };
          }
          if (!result.data) {
            return { success: false, error: "가이드 생성 결과가 없습니다." };
          }

          const { guideId, preview } = result.data;
          return {
            success: true,
            data: {
              guideId,
              title: preview.title,
              guideType: preview.guideType,
              subjects: preview.suggestedSubjects,
              careerFields: preview.suggestedCareerFields,
              theorySectionCount: preview.sections.length,
              message: `가이드 "${preview.title}"가 생성되었습니다. /admin/guides/${guideId} 에서 편집할 수 있습니다.`,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "가이드 생성에 실패했습니다." };
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
                notes: truncateWithMarker(a.notes, 200),
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

// ============================================
// 내부: Agent 도구 입력 → generateGuideAction 입력 변환
// ============================================

import type { GuideGenerationInput } from "@/lib/domains/guide/llm/types";

function buildGenerationInput(
  source: string,
  inputValue: string,
  guideType: string,
  targetSubject?: string,
  targetCareerField?: string,
  additionalContext?: string,
): GuideGenerationInput {
  const gt = guideType as GuideType;

  switch (source) {
    case "keyword":
      return {
        source: "keyword",
        keyword: {
          keyword: inputValue,
          guideType: gt,
          targetSubject,
          targetCareerField,
          additionalContext,
        },
      };
    case "pdf_extract":
      return {
        source: "pdf_extract",
        pdf: {
          pdfUrl: inputValue,
          guideType: gt,
          targetSubject,
          targetCareerField,
          additionalContext,
        },
      };
    case "url_extract":
      return {
        source: "url_extract",
        url: {
          url: inputValue,
          guideType: gt,
          targetSubject,
          targetCareerField,
          additionalContext,
        },
      };
    case "clone_variant":
      return {
        source: "clone_variant",
        clone: {
          sourceGuideId: inputValue,
          targetSubject,
          targetCareerField,
          variationNote: additionalContext,
        },
      };
    default:
      return {
        source: "keyword",
        keyword: {
          keyword: inputValue,
          guideType: gt,
          targetSubject,
          targetCareerField,
          additionalContext,
        },
      };
  }
}
