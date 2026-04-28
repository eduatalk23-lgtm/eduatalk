// ============================================
// B2 (2026-04-28): D6 가이드 본문 cross-student 캐시 헬퍼
//
// synthesis cache-helper.ts (record-analysis) 패턴 차용:
//   - djb2 8자리 hex
//   - stable JSON stringify (key 정렬)
// 다른 점:
//   - 캐시 store 가 별도 테이블 아닌 exploration_guides 자체 (ai_input_hash 컬럼)
//   - 캐시 소스 조건: status='approved' (검증 끝난 본문만)
//   - 무효화: AI_PROMPT_VERSION 을 hash 입력에 포함 → 프롬프트 버전 bump 시 자동 miss
// ============================================

import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import type { GuideGenerationInput } from "./types";

// djb2 8자리 hex (외부 의존성 0)
function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/**
 * GuideGenerationInput 에서 학생 식별자/storyline 등 학생 특화 필드를 제외한
 * 핵심 입력만 추려 hash 계산.
 *
 * 포함 필드:
 *   - source (keyword/clone_variant/pdf_extract/url_extract)
 *   - keyword.keyword / keyword.guideType / keyword.targetSubject /
 *     keyword.targetCareerField / keyword.additionalContext (= keyTopics 직렬화 포함)
 *   - difficultyLevel
 *   - selectedSectionKeys (정렬 후)
 *   - promptVersion (AI_PROMPT_VERSION) — bump 시 자동 invalidation
 *
 * 제외 필드 (학생 특화):
 *   - studentId / studentProfile / userId
 *
 * keyword 외 source(clone_variant/pdf_extract/url_extract)는 학생 무관 입력이라
 * 그대로 hash 에 포함.
 */
export function computeGuideInputHash(
  input: GuideGenerationInput,
  promptVersion: string,
): string {
  const normalized: Record<string, unknown> = {
    promptVersion,
    source: input.source,
    difficultyLevel: input.difficultyLevel ?? null,
    selectedSectionKeys: [...(input.selectedSectionKeys ?? [])].sort(),
  };
  if (input.source === "keyword" && input.keyword) {
    normalized.keyword = {
      keyword: input.keyword.keyword.trim(),
      guideType: input.keyword.guideType,
      targetSubject: input.keyword.targetSubject ?? null,
      targetCareerField: input.keyword.targetCareerField ?? null,
      additionalContext: input.keyword.additionalContext ?? null,
    };
  } else if (input.source === "clone_variant" && input.clone) {
    normalized.clone = {
      sourceGuideId: input.clone.sourceGuideId,
      // mutationHints / 기타 변형 옵션이 있으면 포함하되, 없으면 omit
    };
  } else if (input.source === "pdf_extract" && input.pdf) {
    normalized.pdf = {
      pdfUrl: input.pdf.pdfUrl,
      guideType: input.pdf.guideType,
      targetSubject: input.pdf.targetSubject ?? null,
      targetCareerField: input.pdf.targetCareerField ?? null,
      additionalContext: input.pdf.additionalContext ?? null,
    };
  } else if (input.source === "url_extract" && input.url) {
    normalized.url = {
      url: input.url.url,
      guideType: input.url.guideType,
      targetSubject: input.url.targetSubject ?? null,
      targetCareerField: input.url.targetCareerField ?? null,
      additionalContext: input.url.additionalContext ?? null,
    };
  }
  return djb2Hex(stableStringify(normalized));
}

/**
 * cache 소스 가이드 검색.
 *
 * 조건: ai_input_hash = hash AND status='approved'
 * 동일 hash 가 복수면 가장 최근 updated_at 1건 선택.
 * 자기 자신(currentGuideId) 은 제외 — 자신을 캐시 소스로 쓰는 일은 무의미.
 */
export interface CacheSourceGuide {
  id: string;
  guide_type: string;
  title: string;
  book_title: string | null;
  book_author: string | null;
  book_publisher: string | null;
  source_type: string;
  quality_tier: string | null;
  ai_model_version: string | null;
  ai_prompt_version: string | null;
  difficulty_level: string | null;
  ai_input_hash: string | null;
}

export async function findCacheableGuide(
  admin: SupabaseAdminClient,
  hash: string,
  currentGuideId: string,
): Promise<CacheSourceGuide | null> {
  const { data } = await admin
    .from("exploration_guides")
    .select(
      "id, guide_type, title, book_title, book_author, book_publisher, source_type, quality_tier, ai_model_version, ai_prompt_version, difficulty_level, ai_input_hash",
    )
    .eq("ai_input_hash", hash)
    .eq("status", "approved")
    .neq("id", currentGuideId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CacheSourceGuide | null) ?? null;
}
