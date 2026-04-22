/**
 * Phase E-1 Sprint 1: findGuide tool 공유 정의.
 *
 * admin/consultant/superadmin 이 **신규 탐구 주제 후보**를 자연어로 탐색.
 * 예: "양자 물리 주제 읽을만한 거", "이과 세특용 논문 추천", "경영 동아리 심화".
 *
 * 기존 `getStudentAssignments` (guide-tools, record-sub/plan-sub) 와 역할 구분:
 *  - getStudentAssignments = **이미 배정된** 과제 조회
 *  - findGuide = **신규 후보** 벡터 탐색 (exploration_guides 전체에서 유사도)
 *
 * 실행 본체 `searchGuidesByVector` 는 Gemini embedding + pgvector RPC. tool
 * 은 입출력 스키마 축약만 담당. 학생 맥락 기반 자동 주입은 E-2 Persona
 * 라우터에서 확장.
 */

import { z } from "zod";
import {
  searchGuidesByVector,
  type GuideSearchResult,
} from "@/lib/domains/guide/vector/search-service";
import {
  GUIDE_TYPES,
  type GuideType,
} from "@/lib/domains/guide/types";

export type FindGuideItem = {
  guideId: string;
  title: string;
  type: GuideType | string;
  bookTitle: string | null;
  bookAuthor: string | null;
  motivation: string | null;
  similarity: number;
};

export type FindGuideOutput =
  | { ok: true; results: FindGuideItem[]; query: string }
  | { ok: false; reason: string };

export const findGuideDescription =
  "탐구 가이드 DB 에서 **신규 후보**를 자연어 벡터 검색으로 탐색합니다. " +
  "admin/consultant/superadmin 전용. '양자 물리 주제', '경영 동아리 심화', " +
  "'세특용 환경 논문' 같이 **주제·과목·진로 자연어 키워드**로 후보 가이드를 찾을 때 호출하세요. " +
  "이미 학생에게 배정된 과제 조회는 getStudentAssignments 를 사용하세요 — 이 도구는 새 후보 탐색 전용. " +
  "limit 기본 5, 최대 10. guideType 으로 가이드 유형 필터링 가능.";

export const findGuideInputShape = {
  query: z
    .string()
    .min(2)
    .max(200)
    .describe(
      "자연어 검색어. 주제·과목·진로 키워드 자유 조합 (예: '양자역학 실험', '경영 동아리 사례').",
    ),
  guideType: z
    .enum(GUIDE_TYPES)
    .nullable()
    .optional()
    .describe(
      "가이드 유형 필터. 세특용: reading/topic_exploration/subject_performance/experiment/program. 창체용: reflection_program/club_deep_dive/career_exploration_project. 생략 시 전체.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .nullable()
    .optional()
    .describe("반환 개수 상한. 기본 5, 최대 10."),
  similarityThreshold: z
    .number()
    .min(0.3)
    .max(0.9)
    .nullable()
    .optional()
    .describe(
      "유사도 하한 (0.3~0.9). 기본 0.45. 높일수록 정밀도↑·재현율↓. 결과가 너무 적으면 0.4 로 낮추도록 안내.",
    ),
} as const;

export const findGuideInputSchema = z.object(findGuideInputShape);

export type FindGuideInput = z.infer<typeof findGuideInputSchema>;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_THRESHOLD = 0.45;

export async function findGuideExecute({
  query,
  guideType,
  limit,
  similarityThreshold,
}: FindGuideInput): Promise<FindGuideOutput> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return { ok: false, reason: "검색어는 2자 이상이어야 합니다." };
  }

  const effectiveLimit = Math.min(
    Math.max(1, limit ?? DEFAULT_LIMIT),
    MAX_LIMIT,
  );
  const effectiveThreshold = similarityThreshold ?? DEFAULT_THRESHOLD;

  try {
    const rows: GuideSearchResult[] = await searchGuidesByVector({
      query: normalizedQuery,
      guideType: guideType ?? undefined,
      matchCount: effectiveLimit,
      similarityThreshold: effectiveThreshold,
    });

    const results: FindGuideItem[] = rows.map((r) => ({
      guideId: r.guide_id,
      title: r.title,
      type: r.guide_type,
      bookTitle: r.book_title,
      bookAuthor: r.book_author,
      motivation: r.motivation,
      similarity: r.score,
    }));

    return { ok: true, results, query: normalizedQuery };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "가이드 검색 중 오류가 발생했습니다.",
    };
  }
}
