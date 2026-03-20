"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GoogleGenAI, ImagePromptLanguage } from "@google/genai";
import {
  geminiRateLimiter,
  geminiQuotaTracker,
} from "@/lib/domains/plan/llm/providers/gemini";

const LOG_CTX = { domain: "guide", action: "ai-image" };

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

/**
 * Imagen 3로 이미지 생성 → Storage 업로드 → public URL 반환
 */
export async function generateGuideImageAction(input: {
  guideId: string;
  prompt: string;
  aspectRatio?: AspectRatio;
}): Promise<
  ActionResponse<{ url: string; prompt: string; aspectRatio: string }>
> {
  try {
    await requireAdminOrConsultant();

    const { guideId, prompt, aspectRatio = "1:1" } = input;

    // 프롬프트 검증
    if (!prompt.trim()) {
      return createErrorResponse("프롬프트를 입력해주세요.");
    }
    if (prompt.length > 500) {
      return createErrorResponse("프롬프트는 500자 이하여야 합니다.");
    }

    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return createErrorResponse(
        "오늘의 AI 사용 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return createErrorResponse("서버 설정 오류: AI API 키가 설정되지 않았습니다.");
    }

    // Imagen 3 호출 (Rate Limiter 적용)
    const ai = new GoogleGenAI({ apiKey });

    let imageBytes: string;
    try {
      const response = await geminiRateLimiter.execute(async () => {
        return ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt,
          config: {
            numberOfImages: 1,
            aspectRatio,
            language: ImagePromptLanguage.ko,
          },
        });
      });

      geminiQuotaTracker.recordRequest();

      const image = response.generatedImages?.[0];
      if (!image?.image?.imageBytes) {
        return createErrorResponse(
          "이미지 생성에 실패했습니다. 프롬프트를 수정해 다시 시도해주세요.",
        );
      }

      imageBytes = image.image.imageBytes;
    } catch (error: unknown) {
      geminiQuotaTracker.recordRateLimitHit();

      // Safety filter 거부 등 API 에러 처리
      const message =
        error instanceof Error ? error.message : String(error);

      if (
        message.includes("safety") ||
        message.includes("SAFETY") ||
        message.includes("blocked")
      ) {
        return createErrorResponse(
          "안전 정책에 의해 이미지가 거부되었습니다. 프롬프트를 수정해주세요.",
        );
      }
      if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
        return createErrorResponse(
          "API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.",
        );
      }

      throw error; // 알 수 없는 에러는 외부 catch로
    }

    // base64 → Buffer → Storage 업로드
    const buffer = Buffer.from(imageBytes, "base64");
    const filePath = `${guideId}/ai-${Date.now()}.png`;

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return createErrorResponse("서버 설정 오류: 스토리지에 접근할 수 없습니다.");
    }

    const { error: uploadError } = await supabase.storage
      .from("guide-images")
      .upload(filePath, buffer, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("guide-images").getPublicUrl(filePath);

    return createSuccessResponse({
      url: publicUrl,
      prompt,
      aspectRatio,
    });
  } catch (error) {
    logActionError(LOG_CTX, error, {
      guideId: input.guideId,
      prompt: input.prompt?.slice(0, 100),
    });
    return createErrorResponse("AI 이미지 생성에 실패했습니다.");
  }
}
