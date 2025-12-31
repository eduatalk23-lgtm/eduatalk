/**
 * 마스터 커스텀 콘텐츠 관련 함수
 */

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import type { MasterCustomContent } from "@/lib/types/plan";
import type { MasterCustomContentFilters } from "@/lib/types/contentFilters";
import { normalizeError } from "@/lib/errors";
import { logActionError } from "@/lib/logging/actionLogger";
import { buildContentQuery } from "@/lib/data/contentQueryBuilder";
import { extractJoinedData } from "@/lib/utils/supabaseHelpers";
import { createTypedSingleQuery } from "@/lib/data/core/typedQueryBuilder";

/**
 * 커스텀 콘텐츠 검색
 * @param filters 검색 필터
 * @param supabase Supabase 클라이언트 (선택적, 전달하지 않으면 일반 서버 클라이언트 사용)
 */
export async function searchMasterCustomContents(
  filters: MasterCustomContentFilters,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ data: MasterCustomContent[]; total: number }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 공통 쿼리 빌더 사용 (JOIN 포함)
  const result = await buildContentQuery<
    MasterCustomContent & {
      difficulty_levels?: Array<{ id: string; name: string }> | null;
    }
  >(queryClient, "master_custom_contents", filters);

  // JOIN된 difficulty_levels 데이터를 difficulty_level 필드에 매핑
  const enrichedData = result.data.map((item) => {
    const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
      item.difficulty_levels
    );
    return {
      ...item,
      difficulty_level: difficultyLevel?.name || item.difficulty_level || null,
    } as MasterCustomContent;
  });

  return {
    data: enrichedData,
    total: result.total,
  };
}

/**
 * 커스텀 콘텐츠 상세 조회
 */
export async function getMasterCustomContentById(
  contentId: string
): Promise<{ content: MasterCustomContent | null }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedSingleQuery<
    MasterCustomContent & {
      difficulty_levels?: Array<{ id: string; name: string }> | null;
    }
  >(
    async () => {
      return await supabase
        .from("master_custom_contents")
        .select(
          `
      *,
      difficulty_levels:difficulty_level_id (
        id,
        name
      )
    `
        )
        .eq("id", contentId);
    },
    {
      context: "[data/contentMasters] getMasterCustomContentById",
      defaultValue: null,
    }
  );

  if (!result) {
    return {
      content: null,
    };
  }

  // JOIN된 데이터 처리
  const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
    result.difficulty_levels
  );

  // difficulty_level을 JOIN된 name으로 덮어쓰기 (fallback: 기존 값)
  const content = {
    ...result,
    difficulty_level: difficultyLevel?.name || result.difficulty_level || null,
  } as MasterCustomContent;

  return {
    content,
  };
}

/**
 * 커스텀 콘텐츠 생성
 */
export async function createMasterCustomContent(
  data: Omit<MasterCustomContent, "id" | "created_at" | "updated_at">
): Promise<MasterCustomContent> {
  const supabase = await createSupabaseServerClient();

  const { data: content, error } = await supabase
    .from("master_custom_contents")
    .insert(data)
    .select("*")
    .single<MasterCustomContent>();

  if (error) {
    const normalizedError = normalizeError(error);
    logActionError(
      { domain: "data", action: "createMasterCustomContent" },
      normalizedError,
      { data: { ...data, notes: data.notes ? "[REDACTED]" : null } }
    );
    throw normalizedError;
  }

  return content;
}

/**
 * 커스텀 콘텐츠 수정
 */
export async function updateMasterCustomContent(
  contentId: string,
  updates: Partial<
    Omit<MasterCustomContent, "id" | "created_at" | "updated_at">
  >
): Promise<MasterCustomContent> {
  const supabase = await createSupabaseServerClient();

  const { data: content, error } = await supabase
    .from("master_custom_contents")
    .update(updates)
    .eq("id", contentId)
    .select("*")
    .single<MasterCustomContent>();

  if (error) {
    const normalizedError = normalizeError(error);
    logActionError(
      { domain: "data", action: "updateMasterCustomContent" },
      normalizedError,
      {
        contentId,
        updates: { ...updates, notes: updates.notes ? "[REDACTED]" : null },
      }
    );
    throw normalizedError;
  }

  return content;
}

/**
 * 커스텀 콘텐츠 삭제
 */
export async function deleteMasterCustomContent(
  contentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("master_custom_contents")
    .delete()
    .eq("id", contentId);

  if (error) {
    const normalizedError = normalizeError(error);
    logActionError(
      { domain: "data", action: "deleteMasterCustomContent" },
      normalizedError,
      { contentId }
    );
    throw normalizedError;
  }
}

/**
 * 마스터 커스텀 콘텐츠를 학생 커스텀 콘텐츠로 복사
 * 주의: Admin 클라이언트를 사용하여 RLS 정책을 우회합니다.
 */
export async function copyMasterCustomContentToStudent(
  contentId: string,
  studentId: string,
  tenantId: string
): Promise<{ contentId: string }> {
  // Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요."
    );
  }

  const { content } = await getMasterCustomContentById(contentId);
  if (!content) {
    throw new Error("커스텀 콘텐츠를 찾을 수 없습니다.");
  }

  // 중복 체크: 같은 master_content_id를 가진 학생 커스텀 콘텐츠가 이미 있는지 확인
  const { data: existingContent } = await supabase
    .from("student_custom_contents")
    .select("id")
    .eq("student_id", studentId)
    .eq("title", content.title) // 제목으로 중복 체크 (master_content_id가 없을 수 있음)
    .maybeSingle();

  if (existingContent) {
    // 이미 복사된 콘텐츠가 있으면 기존 ID 반환
    return { contentId: existingContent.id };
  }

  const { data: studentContent, error } = await supabase
    .from("student_custom_contents")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: content.title,
      content_type: content.content_type,
      total_page_or_time: content.total_page_or_time,
      subject: content.subject,
    })
    .select("id")
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "copyMasterCustomContentToStudent" },
      error,
      { contentId, studentId, tenantId, code: error.code, hint: error.hint }
    );
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 커스텀 콘텐츠 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "커스텀 콘텐츠 복사에 실패했습니다."
    );
  }

  return { contentId: studentContent.id };
}
