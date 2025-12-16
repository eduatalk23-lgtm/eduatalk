/**
 * 난이도 마스터 데이터 CRUD
 * 패턴: lib/data/contentMetadata.ts의 publishers/platforms 패턴 참고
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DifficultyLevel = {
  id: string;
  name: string;
  content_type: "book" | "lecture" | "custom" | "common";
  display_order: number;
  is_active: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * 난이도 목록 조회
 * @param contentType 콘텐츠 타입 필터 (선택사항)
 */
export async function getDifficultyLevels(
  contentType?: "book" | "lecture" | "custom" | "common"
): Promise<DifficultyLevel[]> {
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  let query = supabase
    .from("difficulty_levels")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (contentType) {
    // 특정 타입 또는 common 타입 조회
    query = query.or(`content_type.eq.${contentType},content_type.eq.common`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[difficultyLevels] 난이도 조회 실패", error);
    throw new Error(`난이도 조회 실패: ${error.message}`);
  }

  return (data as DifficultyLevel[]) ?? [];
}

/**
 * ID로 난이도 조회
 */
export async function getDifficultyLevelById(id: string): Promise<DifficultyLevel | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("difficulty_levels")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[difficultyLevels] 난이도 조회 실패", error);
    throw new Error(`난이도 조회 실패: ${error.message}`);
  }

  return data as DifficultyLevel | null;
}

/**
 * 난이도 생성
 */
export async function createDifficultyLevel(data: {
  name: string;
  content_type: "book" | "lecture" | "custom" | "common";
  display_order?: number;
  description?: string;
}): Promise<DifficultyLevel> {
  // 관리자 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    const supabase = await createSupabaseServerClient();
    const { data: result, error } = await supabase
      .from("difficulty_levels")
      .insert({
        name: data.name,
        content_type: data.content_type,
        display_order: data.display_order ?? 0,
        description: data.description,
      })
      .select()
      .single();

    if (error) {
      console.error("[difficultyLevels] 난이도 생성 실패", error);

      // 중복 키 에러 처리
      if (error.code === "23505") {
        if (error.message.includes("difficulty_levels_name_content_type_key")) {
          throw new Error(
            `이미 존재하는 난이도입니다: "${data.name}" (${data.content_type})`
          );
        }
        throw new Error("이미 존재하는 데이터입니다.");
      }

      throw new Error(`난이도 생성 실패: ${error.message}`);
    }

    return result as DifficultyLevel;
  }

  const { data: result, error } = await supabaseAdmin
    .from("difficulty_levels")
    .insert({
      name: data.name,
      content_type: data.content_type,
      display_order: data.display_order ?? 0,
      description: data.description,
    })
    .select()
    .single();

  if (error) {
    console.error("[difficultyLevels] 난이도 생성 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("difficulty_levels_name_content_type_key")) {
        throw new Error(
          `이미 존재하는 난이도입니다: "${data.name}" (${data.content_type})`
        );
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`난이도 생성 실패: ${error.message}`);
  }

  return result as DifficultyLevel;
}

/**
 * 난이도 수정
 */
export async function updateDifficultyLevel(
  id: string,
  updates: Partial<{
    name: string;
    display_order: number;
    is_active: boolean;
    description: string;
  }>
): Promise<DifficultyLevel> {
  // 관리자 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("difficulty_levels")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[difficultyLevels] 난이도 수정 실패", error);

      // 중복 키 에러 처리
      if (error.code === "23505") {
        if (
          error.message.includes("difficulty_levels_name_content_type_key") &&
          updates.name
        ) {
          throw new Error(`이미 존재하는 난이도입니다: "${updates.name}"`);
        }
        throw new Error("이미 존재하는 데이터입니다.");
      }

      throw new Error(`난이도 수정 실패: ${error.message}`);
    }

    return data as DifficultyLevel;
  }

  const { data, error } = await supabaseAdmin
    .from("difficulty_levels")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[difficultyLevels] 난이도 수정 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (
        error.message.includes("difficulty_levels_name_content_type_key") &&
        updates.name
      ) {
        throw new Error(`이미 존재하는 난이도입니다: "${updates.name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`난이도 수정 실패: ${error.message}`);
  }

  return data as DifficultyLevel;
}

/**
 * 난이도 삭제 (사용 중인 경우 체크)
 */
export async function deleteDifficultyLevel(id: string): Promise<void> {
  // 관리자 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();

  // 사용 중인지 확인
  const [booksCheck, lecturesCheck, customCheck] = await Promise.all([
    supabase
      .from("master_books")
      .select("id")
      .eq("difficulty_level_id", id)
      .limit(1),
    supabase
      .from("master_lectures")
      .select("id")
      .eq("difficulty_level_id", id)
      .limit(1),
    supabase
      .from("master_custom_contents")
      .select("id")
      .eq("difficulty_level_id", id)
      .limit(1),
  ]);

  if (booksCheck.data && booksCheck.data.length > 0) {
    throw new Error("이 난이도는 교재에서 사용 중이어서 삭제할 수 없습니다.");
  }

  if (lecturesCheck.data && lecturesCheck.data.length > 0) {
    throw new Error("이 난이도는 강의에서 사용 중이어서 삭제할 수 없습니다.");
  }

  if (customCheck.data && customCheck.data.length > 0) {
    throw new Error(
      "이 난이도는 커스텀 콘텐츠에서 사용 중이어서 삭제할 수 없습니다."
    );
  }

  const { error } = await supabase
    .from("difficulty_levels")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[difficultyLevels] 난이도 삭제 실패", error);
    throw new Error(`난이도 삭제 실패: ${error.message}`);
  }
}

