/**
 * AI 플랜 스트리밍 생성 액션
 *
 * Server-Sent Events를 사용하여 실시간으로 플랜 생성 진행 상황을 전달합니다.
 */

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getModelConfig, streamMessage, estimateCost, type WebSearchResult } from "../client";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts/planGeneration";
import { parseLLMResponse } from "../transformers/responseParser";
import type { ModelTier, LLMPlanGenerationResponse } from "../types";

// ============================================
// 스트리밍 이벤트 타입
// ============================================

export type StreamEventType =
  | "start"
  | "progress"
  | "text"
  | "parsing"
  | "complete"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: {
    message?: string;
    progress?: number;
    text?: string;
    response?: LLMPlanGenerationResponse;
    error?: string;
    cost?: { inputTokens: number; outputTokens: number; estimatedUSD: number };
    /** 웹 검색 결과 (grounding 사용 시) */
    webSearchResults?: {
      searchQueries: string[];
      resultsCount: number;
      results: WebSearchResult[];
    };
  };
}

// ============================================
// 스트리밍 생성 입력
// ============================================

export interface StreamPlanInput {
  contentIds: string[];
  startDate: string;
  endDate: string;
  dailyStudyMinutes?: number;
  excludeDays?: number[];
  prioritizeWeakSubjects?: boolean;
  balanceSubjects?: boolean;
  includeReview?: boolean;
  reviewRatio?: number;
  additionalInstructions?: string;
  modelTier?: ModelTier;
  /** 웹 검색 활성화 (Gemini Grounding) */
  enableWebSearch?: boolean;
  /** 웹 검색 설정 */
  webSearchConfig?: {
    mode?: "dynamic" | "always";
    dynamicThreshold?: number;
    saveResults?: boolean;
  };
}

// ============================================
// 헬퍼 함수
// ============================================

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function fetchStudentData(supabase: SupabaseClient, studentId: string) {
  // 학생 정보
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, school_name, target_university, target_major, tenant_id")
    .eq("id", studentId)
    .single();

  if (!student) {
    throw new Error("학생 정보를 찾을 수 없습니다.");
  }

  // 성적 정보
  const { data: scores } = await supabase
    .from("scores")
    .select("subject, subject_category, score, grade, percentile, standard_score")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);

  return { student, scores: scores || [] };
}

async function fetchContentsData(
  supabase: SupabaseClient,
  contentIds: string[]
) {
  const { data: contents } = await supabase
    .from("student_contents")
    .select(`
      id,
      title,
      subject,
      subject_category,
      content_type,
      total_pages,
      total_lectures,
      estimated_hours,
      difficulty
    `)
    .in("id", contentIds)
    .limit(20);

  return contents || [];
}

// ============================================
// 스트리밍 생성 (Generator 함수)
// ============================================

export async function* streamPlanGeneration(
  input: StreamPlanInput
): AsyncGenerator<StreamEvent, void, unknown> {
  // 시작 이벤트
  yield {
    type: "start",
    data: { message: "AI 플랜 생성을 시작합니다...", progress: 0 },
  };

  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user?.userId) {
      yield {
        type: "error",
        data: { error: "로그인이 필요합니다." },
      };
      return;
    }

    yield {
      type: "progress",
      data: { message: "데이터를 불러오는 중...", progress: 10 },
    };

    // 데이터 조회
    const supabase = await createSupabaseServerClient();

    // 학생 ID 조회
    const { data: studentData } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.userId)
      .single();

    if (!studentData) {
      yield {
        type: "error",
        data: { error: "학생 정보를 찾을 수 없습니다." },
      };
      return;
    }

    const { student, scores } = await fetchStudentData(supabase, studentData.id);
    const contents = await fetchContentsData(supabase, input.contentIds);

    if (contents.length === 0) {
      yield {
        type: "error",
        data: { error: "선택된 콘텐츠가 없습니다." },
      };
      return;
    }

    yield {
      type: "progress",
      data: { message: "프롬프트 구성 중...", progress: 20 },
    };

    // 프롬프트 구성
    const userPrompt = buildUserPrompt({
      student: {
        id: student.id,
        name: student.name || "학생",
        grade: student.grade || 3,
        school: student.school_name || undefined,
        targetUniversity: student.target_university || undefined,
        targetMajor: student.target_major || undefined,
      },
      scores: scores.map((s: {
        subject: string | null;
        subject_category: string | null;
        score: number | null;
        grade: number | null;
        percentile: number | null;
        standard_score: number | null;
      }) => ({
        subject: s.subject || "기타",
        subjectCategory: s.subject_category || undefined,
        score: s.score || undefined,
        grade: s.grade || undefined,
        percentile: s.percentile || undefined,
        standardScore: s.standard_score || undefined,
        isWeak: false,
      })),
      contents: contents.slice(0, 20).map((c: {
        id: string;
        title: string | null;
        subject: string | null;
        subject_category: string | null;
        content_type: string | null;
        total_pages: number | null;
        total_lectures: number | null;
        estimated_hours: number | null;
        difficulty: string | null;
      }) => ({
        id: c.id,
        title: c.title || "제목 없음",
        subject: c.subject || "기타",
        subjectCategory: c.subject_category || undefined,
        contentType: (c.content_type as "book" | "lecture" | "video" | "custom") || "custom",
        totalPages: c.total_pages || undefined,
        totalLectures: c.total_lectures || undefined,
        estimatedHoursTotal: c.estimated_hours || undefined,
        difficulty: (c.difficulty as "easy" | "medium" | "hard") || undefined,
      })),
      settings: {
        startDate: input.startDate,
        endDate: input.endDate,
        dailyStudyMinutes: input.dailyStudyMinutes || 180,
        excludeDays: input.excludeDays,
        prioritizeWeakSubjects: input.prioritizeWeakSubjects,
        balanceSubjects: input.balanceSubjects ?? true,
        includeReview: input.includeReview,
        reviewRatio: input.reviewRatio,
      },
      additionalInstructions: input.additionalInstructions,
    });

    yield {
      type: "progress",
      data: { message: "AI가 플랜을 생성하고 있습니다...", progress: 30 },
    };

    // 스트리밍 생성
    const modelConfig = getModelConfig(input.modelTier || "standard");
    let fullContent = "";
    let lastProgress = 30;

    // 웹 검색 설정 구성
    const groundingConfig = input.enableWebSearch
      ? {
          enabled: true,
          mode: input.webSearchConfig?.mode || ("dynamic" as const),
          dynamicThreshold: input.webSearchConfig?.dynamicThreshold,
        }
      : undefined;

    const result = await streamMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: input.modelTier || "standard",
      grounding: groundingConfig,
      onText: (text) => {
        fullContent += text;
        // 진행률 업데이트 (30% ~ 80%)
        const newProgress = Math.min(80, lastProgress + text.length / 100);
        if (newProgress > lastProgress + 5) {
          lastProgress = newProgress;
        }
      },
    });

    yield {
      type: "progress",
      data: { message: "생성된 플랜을 분석하고 있습니다...", progress: 85 },
    };

    yield {
      type: "parsing",
      data: { message: "결과를 파싱하는 중..." },
    };

    // 응답 파싱
    const parseResult = parseLLMResponse(result.content, result.modelId, result.usage);

    if (!parseResult.success || !parseResult.response) {
      yield {
        type: "error",
        data: { error: parseResult.error || "플랜 파싱에 실패했습니다." },
      };
      return;
    }

    // 비용 계산
    const estimatedUSD = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      input.modelTier || "standard"
    );

    yield {
      type: "progress",
      data: { message: "완료!", progress: 100 },
    };

    // 웹 검색 결과 처리
    const webSearchResults = result.groundingMetadata && result.groundingMetadata.webResults.length > 0
      ? {
          searchQueries: result.groundingMetadata.searchQueries,
          resultsCount: result.groundingMetadata.webResults.length,
          results: result.groundingMetadata.webResults,
        }
      : undefined;

    // 완료 이벤트
    yield {
      type: "complete",
      data: {
        response: parseResult.response,
        cost: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedUSD,
        },
        webSearchResults,
      },
    };
  } catch (error) {
    console.error("Stream plan generation error:", error);
    yield {
      type: "error",
      data: {
        error: error instanceof Error ? error.message : "플랜 생성 중 오류가 발생했습니다.",
      },
    };
  }
}

// ============================================
// 비동기 이터러블 변환 (클라이언트용)
// ============================================

export async function generatePlanStream(
  input: StreamPlanInput
): Promise<{ events: StreamEvent[] }> {
  const events: StreamEvent[] = [];

  for await (const event of streamPlanGeneration(input)) {
    events.push(event);
  }

  return { events };
}
