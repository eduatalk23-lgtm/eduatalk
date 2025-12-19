"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/requireAdminOrConsultant";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function addConsultingNote(
  studentId: string,
  consultantId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string } | null> {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "admin" && user.role !== "consultant")) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (user.userId !== consultantId) {
      return { success: false, error: "잘못된 요청입니다." };
    }

    const note = String(formData.get("note") ?? "").trim();

    if (!note) {
      return { success: false, error: "상담 내용을 입력해주세요." };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("student_consulting_notes").insert({
      student_id: studentId,
      consultant_id: consultantId,
      note,
    });

    if (error) {
      console.error("[consultingNotes] 상담노트 저장 실패", error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch (error) {
    console.error("[consultingNotes] 상담노트 저장 실패", error);
    return { success: false, error: "상담노트 저장에 실패했습니다." };
  }
}

export async function deleteConsultingNote(
  noteId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 권한 확인
    const { role } = await requireAdminOrConsultant();
    const user = await getCurrentUser();
    
    if (!user) {
      return { success: false, error: "사용자 정보를 찾을 수 없습니다." };
    }

    // 테넌트 컨텍스트 확인
    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return { success: false, error: "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다." };
    }

    // 상담노트 조회 및 권한 확인
    const { data: note, error: fetchError } = await supabase
      .from("student_consulting_notes")
      .select("consultant_id")
      .eq("id", noteId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (fetchError || !note) {
      return { success: false, error: "상담노트를 찾을 수 없습니다." };
    }

    // 본인이 작성한 노트만 삭제 가능 (또는 admin은 모든 노트 삭제 가능)
    if (role !== "admin" && note.consultant_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { data: deletedRows, error } = await supabase
      .from("student_consulting_notes")
      .delete()
      .eq("id", noteId)
      .select();

    if (error) {
      console.error("[consultingNotes] 상담노트 삭제 실패", error);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return { success: false, error: "상담노트를 찾을 수 없습니다." };
    }

    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch (error) {
    console.error("[consultingNotes] 상담노트 삭제 실패", error);
    return { success: false, error: "상담노트 삭제에 실패했습니다." };
  }
}

