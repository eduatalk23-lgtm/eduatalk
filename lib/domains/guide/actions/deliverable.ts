"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { resolveAuthContext } from "@/lib/auth/strategies";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOG_CTX = { domain: "guide", action: "deliverable" };

interface AssignmentFile {
  id: string;
  original_name: string;
  mime_type: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
}

/** 가이드 배정에 첨부된 결과물 파일 목록 조회 (관리자) */
export async function getAssignmentFilesAction(
  assignmentId: string,
): Promise<ActionResponse<AssignmentFile[]>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: contexts, error: ctxErr } = await supabase
      .from("file_contexts")
      .select("file_id")
      .eq("context_type", "guide")
      .eq("context_id", assignmentId);

    if (ctxErr) throw ctxErr;
    if (!contexts?.length) return createSuccessResponse([]);

    const fileIds = contexts.map((c) => c.file_id);
    const { data: files, error: fileErr } = await supabase
      .from("files")
      .select("id, original_name, mime_type, storage_path, size_bytes, created_at")
      .in("id", fileIds)
      .order("created_at", { ascending: false });

    if (fileErr) throw fileErr;
    return createSuccessResponse((files ?? []) as AssignmentFile[]);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getAssignmentFiles" }, error, {
      assignmentId,
    });
    return createErrorResponse("파일 목록을 불러올 수 없습니다.");
  }
}

/** 학생 본인 배정의 결과물 파일 목록 조회 */
export async function getMyAssignmentFilesAction(
  assignmentId: string,
): Promise<ActionResponse<AssignmentFile[]>> {
  try {
    const auth = await resolveAuthContext();
    const supabase = await createSupabaseServerClient();

    // 소유권 검증
    const { data: assignment } = await supabase
      .from("exploration_guide_assignments")
      .select("student_id")
      .eq("id", assignmentId)
      .single();

    if (!assignment || assignment.student_id !== auth.studentId) {
      return createErrorResponse("접근 권한이 없습니다.");
    }

    const { data: contexts, error: ctxErr } = await supabase
      .from("file_contexts")
      .select("file_id")
      .eq("context_type", "guide")
      .eq("context_id", assignmentId);

    if (ctxErr) throw ctxErr;
    if (!contexts?.length) return createSuccessResponse([]);

    const fileIds = contexts.map((c) => c.file_id);
    const { data: files, error: fileErr } = await supabase
      .from("files")
      .select("id, original_name, mime_type, storage_path, size_bytes, created_at")
      .in("id", fileIds)
      .order("created_at", { ascending: false });

    if (fileErr) throw fileErr;
    return createSuccessResponse((files ?? []) as AssignmentFile[]);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getMyAssignmentFiles" }, error, {
      assignmentId,
    });
    return createErrorResponse("파일 목록을 불러올 수 없습니다.");
  }
}
