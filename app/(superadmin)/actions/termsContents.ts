"use server";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TermsContentType, TermsContentInput, TermsContent } from "@/lib/types/terms";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 새 약관 버전 생성 (Super Admin 전용)
 * 
 * Super Admin만 사용 가능하며, 모든 버전을 생성/수정/활성화할 수 있습니다.
 * RLS 정책을 우회하여 접근합니다.
 */
export const createTermsContent = withErrorHandling(
  async (input: TermsContentInput): Promise<{ success: boolean; data?: TermsContent; error?: string }> => {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin 권한 확인
    if (!userId || role !== "superadmin") {
      throw new AppError("Super Admin 권한이 필요합니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();

    // 현재 최대 버전 조회
    const { data: maxVersionData, error: maxVersionError } = await supabase
      .from("terms_contents")
      .select("version")
      .eq("content_type", input.content_type)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = maxVersionData?.version ? maxVersionData.version + 1 : 1;

    // 새 약관 버전 생성
    const { data, error } = await supabase
      .from("terms_contents")
      .insert({
        content_type: input.content_type,
        version: nextVersion,
        title: input.title,
        content: input.content,
        is_active: false, // 새 버전은 기본적으로 비활성화
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      console.error("[termsContents] 약관 생성 실패:", {
        input,
        error: error.message,
        code: error.code,
      });
      throw new AppError(
        error.message || "약관 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return { success: true, data: data as TermsContent };
  }
);

/**
 * 약관 내용 수정 (Super Admin 전용)
 * 
 * Super Admin만 사용 가능하며, 모든 버전을 수정할 수 있습니다.
 * RLS 정책을 우회하여 접근합니다.
 */
export const updateTermsContent = withErrorHandling(
  async (
    id: string,
    input: Partial<Pick<TermsContentInput, "title" | "content">>
  ): Promise<{ success: boolean; data?: TermsContent; error?: string }> => {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin 권한 확인
    if (!userId || role !== "superadmin") {
      throw new AppError("Super Admin 권한이 필요합니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();

    // 약관 존재 확인
    const { data: existing, error: checkError } = await supabase
      .from("terms_contents")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError) {
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (checkError.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      throw new AppError("약관을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    if (!existing) {
      throw new AppError("약관을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    // 약관 수정
    const updateData: Partial<{
      title: string;
      content: string;
    }> = {};

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.content !== undefined) {
      updateData.content = input.content;
    }

    const { data, error } = await supabase
      .from("terms_contents")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      console.error("[termsContents] 약관 수정 실패:", {
        id,
        input,
        error: error.message,
        code: error.code,
      });
      throw new AppError(
        error.message || "약관 수정에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return { success: true, data: data as TermsContent };
  }
);

/**
 * 특정 버전 활성화 (이전 버전 자동 비활성화) (Super Admin 전용)
 * 
 * Super Admin만 사용 가능하며, 모든 버전을 활성화할 수 있습니다.
 * RLS 정책을 우회하여 접근합니다.
 */
export const activateTermsContent = withErrorHandling(
  async (id: string): Promise<{ success: boolean; error?: string }> => {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin 권한 확인
    if (!userId || role !== "superadmin") {
      throw new AppError("Super Admin 권한이 필요합니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();

    // 활성화할 약관 조회
    const { data: target, error: targetError } = await supabase
      .from("terms_contents")
      .select("content_type")
      .eq("id", id)
      .single();

    if (targetError) {
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (targetError.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      throw new AppError("약관을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    if (!target) {
      throw new AppError("약관을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    // 같은 content_type의 모든 버전 비활성화
    const { error: deactivateError } = await supabase
      .from("terms_contents")
      .update({ is_active: false })
      .eq("content_type", target.content_type);

    if (deactivateError) {
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (deactivateError.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      console.error("[termsContents] 약관 비활성화 실패:", {
        contentType: target.content_type,
        error: deactivateError.message,
        code: deactivateError.code,
      });
      throw new AppError(
        deactivateError.message || "약관 비활성화에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 선택한 버전 활성화
    const { error: activateError } = await supabase
      .from("terms_contents")
      .update({ is_active: true })
      .eq("id", id);

    if (activateError) {
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (activateError.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      console.error("[termsContents] 약관 활성화 실패:", {
        id,
        error: activateError.message,
        code: activateError.code,
      });
      throw new AppError(
        activateError.message || "약관 활성화에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return { success: true };
  }
);

/**
 * 약관 목록 조회 (Super Admin 전용)
 * 
 * Super Admin만 사용 가능하며, 모든 버전을 조회할 수 있습니다.
 * RLS 정책을 우회하여 접근합니다.
 */
export const getTermsContents = withErrorHandling(
  async (contentType: TermsContentType): Promise<{ success: boolean; data?: TermsContent[]; error?: string }> => {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin 권한 확인
    if (!userId || role !== "superadmin") {
      throw new AppError("Super Admin 권한이 필요합니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("terms_contents")
      .select("*")
      .eq("content_type", contentType)
      .order("version", { ascending: false });

    if (error) {
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      console.error("[termsContents] 약관 목록 조회 실패:", {
        contentType,
        error: error.message,
        code: error.code,
      });
      throw new AppError(
        error.message || "약관 목록 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return { success: true, data: (data as TermsContent[]) || [] };
  }
);

/**
 * 활성 약관 조회 (Super Admin 전용)
 * 
 * Super Admin만 사용 가능하며, 모든 버전을 조회할 수 있습니다.
 * RLS 정책을 우회하여 접근합니다.
 */
export const getActiveTermsContent = withErrorHandling(
  async (contentType: TermsContentType): Promise<{ success: boolean; data?: TermsContent; error?: string }> => {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin 권한 확인
    if (!userId || role !== "superadmin") {
      throw new AppError("Super Admin 권한이 필요합니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("terms_contents")
      .select("*")
      .eq("content_type", contentType)
      .eq("is_active", true)
      .single();

    if (error) {
      // PGRST116: No rows returned
      if (error.code === "PGRST116") {
        return { success: true, data: undefined };
      }
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      console.error("[termsContents] 활성 약관 조회 실패:", {
        contentType,
        error: error.message,
        code: error.code,
      });
      throw new AppError(
        error.message || "활성 약관 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return { success: true, data: data as TermsContent };
  }
);

/**
 * ID로 약관 내용 조회 (Super Admin 전용)
 * 
 * Super Admin만 사용 가능하며, 모든 버전을 조회할 수 있습니다.
 * RLS 정책을 우회하여 접근합니다.
 */
export const getTermsContentById = withErrorHandling(
  async (id: string): Promise<{ success: boolean; data?: TermsContent; error?: string }> => {
    const { userId, role } = await getCurrentUserRole();

    // Super Admin 권한 확인
    if (!userId || role !== "superadmin") {
      throw new AppError("Super Admin 권한이 필요합니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("terms_contents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // PGRST116: No rows returned
      if (error.code === "PGRST116") {
        return { success: true, data: undefined };
      }
      // PGRST205: 테이블이 스키마 캐시에 없음
      if (error.code === "PGRST205") {
        throw new AppError(
          "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      console.error("[termsContents] 약관 조회 실패:", {
        id,
        error: error.message,
        code: error.code,
      });
      throw new AppError(
        error.message || "약관 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return { success: true, data: data as TermsContent };
  }
);

