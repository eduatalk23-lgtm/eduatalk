"use server";

import { revalidatePath } from "next/cache";
import {
  resolveAuthContext,
  isAdminContext,
  isStudentContext,
} from "@/lib/auth/strategies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  CalendarMemoRow,
  CalendarMemoWithAuthor,
  CreateMemoInput,
  UpdateMemoInput,
  MemoActionResult,
  MemoVisibility,
} from "../types";

const LOG_CTX = { domain: "memo", action: "" };

// ============================================================
// READ
// ============================================================

/** 학생의 메모 목록 조회 */
export async function getMemos(
  studentId: string,
  options?: {
    authorRole?: "student" | "admin";
    memoDate?: string;
    limit?: number;
    /** G3-4: 영역 필터 */
    recordAreaType?: string;
    recordAreaId?: string;
  }
): Promise<MemoActionResult<CalendarMemoWithAuthor[]>> {
  try {
    const auth = await resolveAuthContext({ studentId });
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("calendar_memos")
      .select("*, user_profiles!calendar_memos_author_id_fkey(name)")
      .eq("student_id", auth.studentId)
      .is("deleted_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (options?.authorRole === "student") {
      query = query.eq("author_role", "student");
    } else if (options?.authorRole === "admin") {
      query = query.in("author_role", ["admin", "consultant"]);
    }

    if (options?.memoDate) {
      query = query.eq("memo_date", options.memoDate);
    }

    // G3-4: 영역 필터
    if (options?.recordAreaType) {
      query = query.eq("record_area_type", options.recordAreaType);
      if (options?.recordAreaId) {
        query = query.eq("record_area_id", options.recordAreaId);
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;

    if (error) throw error;

    const memos: CalendarMemoWithAuthor[] = (data ?? []).map((row: Record<string, unknown>) => {
      const profiles = row.user_profiles as { name: string | null } | null;
      const { user_profiles: _, ...rest } = row;
      return {
        ...rest,
        author_name: profiles?.name ?? null,
      } as CalendarMemoWithAuthor;
    });

    return { success: true, data: memos };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getMemos" }, error, { studentId });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "메모 조회에 실패했습니다.",
    };
  }
}

// ============================================================
// CREATE
// ============================================================

/** 새 메모 생성 */
export async function createMemo(
  input: CreateMemoInput
): Promise<MemoActionResult<CalendarMemoRow>> {
  try {
    const auth = await resolveAuthContext({ studentId: input.studentId });
    const supabase = await createSupabaseServerClient();

    const authorRole = isAdminContext(auth) ? auth.adminRole : "student";

    // 학생은 visibility를 private으로 설정할 수 없음
    const visibility: MemoVisibility =
      isStudentContext(auth) ? "public" : (input.visibility ?? "public");

    const { data, error } = await supabase
      .from("calendar_memos")
      .insert({
        tenant_id: auth.tenantId,
        student_id: auth.studentId,
        author_id: auth.userId,
        author_role: authorRole,
        title: input.title?.trim() || null,
        content: input.content.trim(),
        is_checklist: input.isChecklist ?? false,
        memo_date: input.memoDate ?? null,
        visibility,
        color: input.color ?? null,
        record_area_type: input.recordAreaType ?? null,
        record_area_id: input.recordAreaId ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: data as CalendarMemoRow };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "createMemo" }, error, {
      studentId: input.studentId,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "메모 생성에 실패했습니다.",
    };
  }
}

// ============================================================
// UPDATE
// ============================================================

/** 메모 수정 */
export async function updateMemo(
  memoId: string,
  studentId: string,
  input: UpdateMemoInput
): Promise<MemoActionResult<CalendarMemoRow>> {
  try {
    const auth = await resolveAuthContext({ studentId });
    const supabase = await createSupabaseServerClient();

    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined)
      updateData.title = input.title?.trim() || null;
    if (input.content !== undefined)
      updateData.content = input.content.trim();
    if (input.isChecklist !== undefined)
      updateData.is_checklist = input.isChecklist;
    if (input.memoDate !== undefined)
      updateData.memo_date = input.memoDate;
    if (input.visibility !== undefined) {
      // 학생은 visibility 변경 불가
      if (!isStudentContext(auth)) {
        updateData.visibility = input.visibility;
      }
    }
    if (input.pinned !== undefined) updateData.pinned = input.pinned;
    if (input.color !== undefined) updateData.color = input.color;

    const { data, error } = await supabase
      .from("calendar_memos")
      .update(updateData)
      .eq("id", memoId)
      .eq("student_id", auth.studentId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: data as CalendarMemoRow };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateMemo" }, error, {
      memoId,
      studentId,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "메모 수정에 실패했습니다.",
    };
  }
}

// ============================================================
// DELETE (soft)
// ============================================================

/** 메모 소프트 삭제 */
export async function deleteMemo(
  memoId: string,
  studentId: string
): Promise<MemoActionResult> {
  try {
    const auth = await resolveAuthContext({ studentId });
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("calendar_memos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", memoId)
      .eq("student_id", auth.studentId)
      .is("deleted_at", null);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteMemo" }, error, {
      memoId,
      studentId,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "메모 삭제에 실패했습니다.",
    };
  }
}

// ============================================================
// TOGGLE ACTIONS
// ============================================================

/** 메모 가시성 토글 (관리자 전용) */
export async function toggleMemoVisibility(
  memoId: string,
  studentId: string
): Promise<MemoActionResult<{ visibility: MemoVisibility }>> {
  try {
    const auth = await resolveAuthContext({ studentId });

    if (!isAdminContext(auth)) {
      return { success: false, error: "관리자만 가시성을 변경할 수 있습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 현재 값 조회
    const { data: current, error: fetchError } = await supabase
      .from("calendar_memos")
      .select("visibility")
      .eq("id", memoId)
      .eq("student_id", auth.studentId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "메모를 찾을 수 없습니다." };
    }

    const newVisibility: MemoVisibility =
      current.visibility === "public" ? "private" : "public";

    const { error } = await supabase
      .from("calendar_memos")
      .update({ visibility: newVisibility })
      .eq("id", memoId);

    if (error) throw error;

    return { success: true, data: { visibility: newVisibility } };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "toggleMemoVisibility" }, error, {
      memoId,
      studentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "변경에 실패했습니다.",
    };
  }
}

/** 메모 핀 토글 */
export async function toggleMemoPin(
  memoId: string,
  studentId: string
): Promise<MemoActionResult<{ pinned: boolean }>> {
  try {
    const auth = await resolveAuthContext({ studentId });
    const supabase = await createSupabaseServerClient();

    const { data: current, error: fetchError } = await supabase
      .from("calendar_memos")
      .select("pinned, author_id")
      .eq("id", memoId)
      .eq("student_id", auth.studentId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "메모를 찾을 수 없습니다." };
    }

    // 학생은 본인 메모만 핀 가능
    if (isStudentContext(auth) && current.author_id !== auth.userId) {
      return { success: false, error: "본인 메모만 고정할 수 있습니다." };
    }

    const newPinned = !current.pinned;

    const { error } = await supabase
      .from("calendar_memos")
      .update({ pinned: newPinned })
      .eq("id", memoId);

    if (error) throw error;

    return { success: true, data: { pinned: newPinned } };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "toggleMemoPin" }, error, {
      memoId,
      studentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "변경에 실패했습니다.",
    };
  }
}
