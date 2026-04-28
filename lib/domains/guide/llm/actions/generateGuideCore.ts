// ============================================
// C3 + C3.1 — AI 가이드 생성 핵심 로직 (공유)
// Server Action + API Route 양쪽에서 사용
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import {
  generateObjectWithRateLimit,
  streamObjectWithRateLimit,
} from "@/lib/domains/plan/llm/ai-sdk";
import { geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { zodSchema } from "ai";
import {
  findGuideByIdPublic,
} from "../../repository";
import {
  generatedGuideSchema,
  type GuideGenerationInput,
  type GeneratedGuideOutput,
} from "../types";
import type { GuideSourceType } from "../../types";
import {
  buildKeywordSystemPrompt,
  buildKeywordUserPrompt,
} from "../prompts/keyword-guide";
import {
  buildCloneSystemPrompt,
  buildCloneUserPrompt,
} from "../prompts/clone-variant";
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
} from "../prompts/extraction-guide";
import { extractTextFromPdfUrl } from "../extract/pdf-extractor";
import { extractTextFromUrl } from "../extract/url-extractor";
import { enrichGuideResources } from "../services/enrich-sources";
import { validateGuideOutput } from "../validators/deterministic-validator";
import { checkCoherence } from "../validators/coherence-checker";
import {
  repairViolations,
  MAX_REPAIR_ATTEMPTS,
} from "../validators/targeted-repair";

const LOG_CTX = { domain: "guide", action: "generateGuide" };
const AI_PROMPT_VERSION = "c3.3-v1";

/** 진행 단계 콜백 타입 */
export type GenerateProgressCallback = (
  step: "preparing" | "generating" | "enriching" | "saving",
  detail?: string,
) => void;

/** B1 Stream-to-DB: LLM 부분 객체 콜백. 호출자가 throttle/persistence 담당. */
export type GeneratePartialCallback = (
  partial: Partial<GeneratedGuideOutput>,
  chunkIndex: number,
) => void | Promise<void>;

/** generateGuideCore 성공 결과 (AI 생성 결과만 반환, DB 저장 안 함) */
export interface GenerateGuideCoreSuccess {
  preview: GeneratedGuideOutput;
  modelId: string;
  sourceType: GuideSourceType;
  parentGuideId?: string;
}

/** generateGuideCore 실패 결과 */
export interface GenerateGuideCoreError {
  error: string;
}

export type GenerateGuideCoreResult =
  | ({ ok: true } & GenerateGuideCoreSuccess)
  | ({ ok: false } & GenerateGuideCoreError);

// ============================================
// 핵심 로직: generateGuideCore
// ============================================

export async function generateGuideCore(
  input: GuideGenerationInput,
  userId: string,
  onProgress?: GenerateProgressCallback,
  options?: {
    modelStartIndex?: number;
    /** B1: streamObject 부분 객체 콜백. 미지정 시 stream 미사용 (generateObject 경로). */
    onPartial?: GeneratePartialCallback;
  },
): Promise<GenerateGuideCoreResult> {
  try {
    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return {
        ok: false,
        error: "오늘의 AI 사용 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      };
    }

    // 학생 프로필 자동 로드 (studentId가 있고 studentProfile이 없을 때)
    if (input.studentId && !input.studentProfile) {
      const { loadStudentProfileForGuide } = await import(
        "../loaders/student-profile-loader"
      );
      const profile = await loadStudentProfileForGuide(input.studentId);
      if (profile) {
        input.studentProfile = profile;
      }
    }

    // 난이도 자동 차등: difficultyLevel 미지정 시 학생 내신 기반 추론값 사용
    if (!input.difficultyLevel && input.studentProfile?.suggestedDifficulty) {
      input.difficultyLevel = input.studentProfile.suggestedDifficulty;
    }

    // 입력 검증 + 프롬프트 빌드
    onProgress?.("preparing", "프롬프트 생성 중");
    const promptResult = await buildPrompt(input);
    if (!promptResult.ok) {
      return { ok: false, error: promptResult.error };
    }

    const { systemPrompt, userPrompt, sourceType, parentGuideId } = promptResult;

    // AI 생성 — advanced(2.5-pro) 우선, 과부하 시 fast(2.5-flash) fallback
    onProgress?.("generating", "AI 가이드 생성 중 (30~90초 소요)");

    let generated: GeneratedGuideOutput;
    let modelId: string;
    const useStream = !!options?.onPartial;
    try {
      const baseArgs = {
        system: systemPrompt,
        messages: [{ role: "user" as const, content: userPrompt }],
        schema: zodSchema(generatedGuideSchema),
        modelTier: "advanced" as const,
        temperature: 0.5,
        maxTokens: 65536,
        timeoutMs: 300_000, // API Route maxDuration=300 (5분)
        modelStartIndex: options?.modelStartIndex,
      };
      const result = useStream
        ? await streamObjectWithRateLimit({
            ...baseArgs,
            onPartial: options!.onPartial,
          })
        : await generateObjectWithRateLimit(baseArgs);
      generated = result.object;
      modelId = result.modelId;
    } catch (primaryError) {
      const msg = primaryError instanceof Error ? primaryError.message : "";
      if (
        msg.includes("high demand") ||
        msg.includes("429") ||
        msg.includes("overloaded")
      ) {
        const { logActionWarn } = await import("@/lib/logging/actionLogger");
        logActionWarn(LOG_CTX, "2.5-pro 과부하 → 2.5-flash fallback", {
          source: input.source,
        });
        const fbArgs = {
          system: systemPrompt,
          messages: [{ role: "user" as const, content: userPrompt }],
          schema: zodSchema(generatedGuideSchema),
          modelTier: "fast" as const,
          temperature: 0.5,
          maxTokens: 40960,
          timeoutMs: 300_000, // API Route maxDuration=300 (5분)
        };
        const result = useStream
          ? await streamObjectWithRateLimit({
              ...fbArgs,
              onPartial: options!.onPartial,
            })
          : await generateObjectWithRateLimit(fbArgs);
        generated = result.object;
        modelId = result.modelId + " (fallback)";
      } else {
        throw primaryError;
      }
    }

    // selectedSectionKeys가 있으면 AI 출력을 필터링
    if (input.selectedSectionKeys?.length) {
      const { getCoreSections } = await import("../../section-config");
      const guideType = generated.guideType as import("../../types").GuideType;
      const coreKeys = new Set(getCoreSections(guideType).map((s) => s.key));
      const allowedKeys = new Set([
        ...coreKeys,
        ...input.selectedSectionKeys,
      ]);
      generated.sections = generated.sections.filter((s) =>
        allowedKeys.has(s.key),
      );
    }

    if (generated.sections.length === 0) {
      return {
        ok: false,
        error: "AI가 유효한 섹션을 생성하지 못했습니다. 다시 시도해주세요.",
      };
    }

    // ── Deterministic Validation ─────────────────────────────
    // 기본 보정: confidence 미지정 → medium 기본값
    if (generated.guideType === "reading") {
      if (!generated.bookConfidence && generated.bookTitle) {
        generated.bookConfidence = "medium";
        if (!generated.bookVerificationNote) {
          generated.bookVerificationNote =
            "AI 생성 시 confidence 미지정 — 컨설턴트 검수 필요";
        }
      }
    }
    if (generated.relatedPapers?.length) {
      for (const paper of generated.relatedPapers) {
        if (!paper.confidence) {
          paper.confidence = "medium";
          if (!paper.verificationNote) {
            paper.verificationNote =
              "AI 생성 시 confidence 미지정 — 컨설턴트 검수 필요";
          }
        }
      }
    }

    // 자동 필터: low confidence 논문 제거
    if (generated.relatedPapers?.length) {
      const lowPapers = generated.relatedPapers.filter(
        (p) => p.confidence === "low",
      );
      if (lowPapers.length > 0) {
        generated.relatedPapers = generated.relatedPapers.filter(
          (p) => p.confidence !== "low",
        );
      }
    }

    // ── A-L1: Deterministic Validation ────────────────────────
    const guideType = generated.guideType as import("../../types").GuideType;
    const l1Validation = validateGuideOutput(
      generated,
      guideType,
      input.selectedSectionKeys,
    );

    // ── A-L2: Coherence Check (Flash LLM) ───────────────────
    let allViolations = [...l1Validation.violations];
    try {
      const coherenceResult = await checkCoherence(generated);
      allViolations = [...allViolations, ...coherenceResult.violations];

      if (coherenceResult.violations.length > 0) {
        const { logActionWarn } = await import("@/lib/logging/actionLogger");
        for (const v of coherenceResult.violations) {
          logActionWarn(LOG_CTX, `[coherence] [${v.rule}] ${v.message}`, {
            severity: v.severity,
            sectionKey: v.sectionKey,
            source: input.source,
          });
        }
      }
    } catch (coherenceError) {
      // Coherence check 실패는 non-fatal — L1 결과만으로 진행
      const { logActionWarn } = await import("@/lib/logging/actionLogger");
      logActionWarn(LOG_CTX, "Coherence check failed (non-fatal)", {
        error:
          coherenceError instanceof Error
            ? coherenceError.message
            : String(coherenceError),
      });
    }

    // 검증 결과 로깅 (L1)
    if (l1Validation.violations.length > 0) {
      const { logActionWarn } = await import("@/lib/logging/actionLogger");
      for (const v of l1Validation.violations) {
        logActionWarn(LOG_CTX, `[L1] [${v.rule}] ${v.message}`, {
          severity: v.severity,
          sectionKey: v.sectionKey,
          actual: v.actual,
          expected: v.expected,
          source: input.source,
        });
      }
    }

    // ── Targeted Repair (DeCRIM) ────────────────────────────
    const hasErrors = allViolations.some((v) => v.severity === "error");
    if (hasErrors) {
      try {
        for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt++) {
          const repairResult = await repairViolations(
            generated,
            allViolations,
          );

          if (repairResult.repaired) {
            const { logActionDebug: logRepairDebug } = await import(
              "@/lib/logging/actionLogger"
            );
            logRepairDebug(
              LOG_CTX,
              `Targeted repair attempt ${attempt + 1}: ${repairResult.repairedSectionKeys.join(", ")}`,
              {
                repairedKeys: repairResult.repairedSectionKeys,
                remainingErrors: repairResult.remainingViolations.filter(
                  (v) => v.severity === "error",
                ).length,
                usage: repairResult.usage,
                source: input.source,
              },
            );

            // 수리 결과 반영
            generated = repairResult.output;
            allViolations = repairResult.remainingViolations;

            // 남은 error가 없으면 루프 종료
            if (!allViolations.some((v) => v.severity === "error")) break;
          } else {
            break;
          }
        }
      } catch (repairError) {
        // Repair 실패는 non-fatal — 원본 출력 유지
        const { logActionWarn } = await import("@/lib/logging/actionLogger");
        logActionWarn(LOG_CTX, "Targeted repair failed (non-fatal)", {
          error:
            repairError instanceof Error
              ? repairError.message
              : String(repairError),
        });
      }
    }
    // ── End Validation + Repair ──────────────────────────────

    // 출처 수집 (non-fatal)
    onProgress?.("enriching", "출처 검증 및 수집 중");
    try {
      const enrichResult = await enrichGuideResources(
        generated.sections.map((s) => ({
          key: s.key,
          label: s.label,
          content: s.content,
          content_format: "html" as const,
          items: s.items,
          order: s.order,
          outline: s.outline,
        })),
        generated.relatedPapers ?? [],
        generated.title,
        { maxResources: 8, validateUrls: true },
      );

      for (let i = 0; i < generated.sections.length; i++) {
        const enrichedOutline = enrichResult.enrichedSections[i]?.outline;
        if (enrichedOutline) {
          generated.sections[i].outline = enrichedOutline;
        }
      }
      if (enrichResult.enrichedPapers.length > 0) {
        generated.relatedPapers = enrichResult.enrichedPapers;
      }

      const { logActionDebug: logDebug } = await import(
        "@/lib/logging/actionLogger"
      );
      logDebug(
        LOG_CTX,
        `Source enrichment: ${enrichResult.stats.urlsValidated}/${enrichResult.stats.totalResources} URLs`,
        enrichResult.stats,
      );
    } catch (enrichError) {
      const { logActionWarn: logWarn } = await import(
        "@/lib/logging/actionLogger"
      );
      logWarn(LOG_CTX, "Source enrichment failed (non-fatal)", {
        error:
          enrichError instanceof Error
            ? enrichError.message
            : String(enrichError),
      });
    }

    // AI 결과 + 메타데이터만 반환 (DB 저장은 API route에서 처리)
    return { ok: true, preview: generated, modelId, sourceType, parentGuideId };
  } catch (error) {
    logActionError(LOG_CTX, error, { source: input.source });

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return {
        ok: false,
        error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
      };
    }
    if (msg.includes("PDF") || msg.includes("페이지")) {
      return { ok: false, error: msg };
    }

    return { ok: false, error: `AI 가이드 생성 실패: ${msg.slice(0, 500)}` };
  }
}

// ============================================
// 내부: 소스별 프롬프트 빌드
// ============================================

type PromptBuildResult =
  | {
      ok: true;
      systemPrompt: string;
      userPrompt: string;
      sourceType: GuideSourceType;
      parentGuideId?: string;
    }
  | { ok: false; error: string };

async function buildPrompt(
  input: GuideGenerationInput,
): Promise<PromptBuildResult> {
  switch (input.source) {
    case "keyword": {
      if (!input.keyword?.keyword?.trim()) {
        return { ok: false, error: "키워드를 입력해주세요." };
      }
      return {
        ok: true,
        systemPrompt: buildKeywordSystemPrompt(
          input.keyword.guideType,
          input.studentProfile,
          input.selectedSectionKeys,
          input.difficultyLevel,
        ),
        userPrompt: buildKeywordUserPrompt(input.keyword),
        sourceType: "ai_keyword",
      };
    }

    case "clone_variant": {
      if (!input.clone?.sourceGuideId) {
        return { ok: false, error: "원본 가이드를 선택해주세요." };
      }
      const sourceGuide = await findGuideByIdPublic(input.clone.sourceGuideId);
      if (!sourceGuide) {
        return { ok: false, error: "원본 가이드를 찾을 수 없습니다." };
      }
      return {
        ok: true,
        systemPrompt: buildCloneSystemPrompt(
          sourceGuide.guide_type as import("../../types").GuideType,
          input.studentProfile,
          input.selectedSectionKeys,
          input.difficultyLevel,
        ),
        userPrompt: buildCloneUserPrompt(sourceGuide, input.clone),
        sourceType: "ai_clone_variant",
        parentGuideId: input.clone.sourceGuideId,
      };
    }

    case "pdf_extract": {
      if (!input.pdf?.pdfUrl?.trim()) {
        return { ok: false, error: "PDF URL을 입력해주세요." };
      }
      const pdfResult = await extractTextFromPdfUrl(input.pdf.pdfUrl);
      return {
        ok: true,
        systemPrompt: buildExtractionSystemPrompt(
          input.pdf.guideType,
          input.studentProfile,
          input.selectedSectionKeys,
          input.difficultyLevel,
        ),
        userPrompt: buildExtractionUserPrompt({
          extractedText: pdfResult.text,
          sourceTitle: pdfResult.title,
          sourceUrl: input.pdf.pdfUrl,
          sourceType: "pdf",
          guideType: input.pdf.guideType,
          targetSubject: input.pdf.targetSubject,
          targetCareerField: input.pdf.targetCareerField,
          additionalContext: input.pdf.additionalContext,
        }),
        sourceType: "ai_pdf_extract",
      };
    }

    case "url_extract": {
      if (!input.url?.url?.trim()) {
        return { ok: false, error: "URL을 입력해주세요." };
      }
      const urlResult = await extractTextFromUrl(input.url.url);
      return {
        ok: true,
        systemPrompt: buildExtractionSystemPrompt(
          input.url.guideType,
          input.studentProfile,
          input.selectedSectionKeys,
          input.difficultyLevel,
        ),
        userPrompt: buildExtractionUserPrompt({
          extractedText: urlResult.text,
          sourceTitle: urlResult.title,
          sourceUrl: urlResult.url,
          sourceType: "url",
          guideType: input.url.guideType,
          targetSubject: input.url.targetSubject,
          targetCareerField: input.url.targetCareerField,
          additionalContext: input.url.additionalContext,
        }),
        sourceType: "ai_url_extract",
      };
    }

    default:
      return { ok: false, error: "지원하지 않는 생성 방식입니다." };
  }
}

