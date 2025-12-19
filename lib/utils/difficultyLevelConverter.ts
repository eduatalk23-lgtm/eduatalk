/**
 * difficulty_level 문자열을 difficulty_level_id로 변환하는 유틸리티
 * 
 * Phase 3: difficulty_level → difficulty_level_id 마이그레이션
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * difficulty_level 문자열을 difficulty_level_id로 변환
 * 
 * @param supabase Supabase 클라이언트
 * @param difficultyLevel 난이도 문자열 (예: "개념", "기본", "심화")
 * @param contentType 콘텐츠 타입 ("book", "lecture", "custom")
 * @returns difficulty_level_id (uuid) 또는 null
 */
export async function convertDifficultyLevelToId(
  supabase: SupabaseClient,
  difficultyLevel: string | null | undefined,
  contentType: "book" | "lecture" | "custom"
): Promise<string | null> {
  if (!difficultyLevel) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("difficulty_levels")
      .select("id")
      .eq("name", difficultyLevel)
      .eq("content_type", contentType)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[difficultyLevelConverter] 난이도 조회 실패:", error);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error("[difficultyLevelConverter] 난이도 변환 실패:", error);
    return null;
  }
}

/**
 * 여러 difficulty_level 문자열을 difficulty_level_id로 배치 변환
 * 
 * @param supabase Supabase 클라이언트
 * @param difficultyLevels 난이도 문자열 배열
 * @param contentType 콘텐츠 타입 ("book", "lecture", "custom")
 * @returns Map<difficulty_level, difficulty_level_id>
 */
export async function convertDifficultyLevelsToIds(
  supabase: SupabaseClient,
  difficultyLevels: Array<{ level: string | null | undefined; contentType: "book" | "lecture" | "custom" }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (difficultyLevels.length === 0) {
    return result;
  }

  // contentType별로 그룹화
  const byContentType = new Map<"book" | "lecture" | "custom", Set<string>>();
  for (const { level, contentType } of difficultyLevels) {
    if (!level) continue;
    if (!byContentType.has(contentType)) {
      byContentType.set(contentType, new Set());
    }
    byContentType.get(contentType)!.add(level);
  }

  // 각 contentType별로 배치 조회
  for (const [contentType, levels] of byContentType.entries()) {
    if (levels.size === 0) continue;

    try {
      const { data, error } = await supabase
        .from("difficulty_levels")
        .select("id, name")
        .eq("content_type", contentType)
        .eq("is_active", true)
        .in("name", Array.from(levels));

      if (error) {
        console.error(`[difficultyLevelConverter] ${contentType} 난이도 배치 조회 실패:`, error);
        continue;
      }

      (data || []).forEach((level) => {
        result.set(level.name, level.id);
      });
    } catch (error) {
      console.error(`[difficultyLevelConverter] ${contentType} 난이도 변환 실패:`, error);
    }
  }

  return result;
}

