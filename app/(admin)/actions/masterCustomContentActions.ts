"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  createMasterCustomContent,
  updateMasterCustomContent,
  deleteMasterCustomContent,
} from "@/lib/data/contentMasters";
import { MasterCustomContent } from "@/lib/types/plan";

/**
 * 서비스 마스터 커스텀 콘텐츠 생성
 */
export async function addMasterCustomContent(formData: FormData) {
  const { role } = await getCurrentUserRole();

  // 관리자 권한 확인
  if (role !== "admin" && role !== "consultant") {
    throw new Error("권한이 없습니다.");
  }

  const tenantContext = await getTenantContext();
  const supabase = await createSupabaseServerClient();

  // subject_id 처리 (빈 문자열 체크)
  const subjectIdRaw = formData.get("subject_id")?.toString();
  const subjectId = subjectIdRaw && subjectIdRaw.trim() !== "" ? subjectIdRaw.trim() : null;

  const contentData: Omit<MasterCustomContent, "id" | "created_at" | "updated_at"> = {
    tenant_id: tenantContext?.tenantId || null,
    revision: formData.get("revision")?.toString() || null,
    content_category: formData.get("content_category")?.toString() || null,
    title: formData.get("title")?.toString() || "",
    difficulty_level: formData.get("difficulty_level")?.toString() || null,
    notes: formData.get("notes")?.toString() || null,
    content_type: formData.get("content_type")?.toString() || null,
    total_page_or_time: formData.get("total_page_or_time") 
      ? parseInt(formData.get("total_page_or_time")!.toString()) 
      : null,
    subject: formData.get("subject")?.toString() || null,
    subject_category: formData.get("subject_category")?.toString() || null,
    curriculum_revision_id: formData.get("curriculum_revision_id")?.toString() || null,
    subject_id: subjectId,
    subject_group_id: formData.get("subject_group_id")?.toString() || null,
  };

  if (!contentData.title) {
    throw new Error("제목은 필수입니다.");
  }

  await createMasterCustomContent(contentData);

  redirect("/admin/master-custom-contents");
}

/**
 * 서비스 마스터 커스텀 콘텐츠 수정
 */
export async function updateMasterCustomContentAction(
  id: string,
  formData: FormData
) {
  const { role } = await getCurrentUserRole();

  // 관리자 권한 확인
  if (role !== "admin" && role !== "consultant") {
    throw new Error("권한이 없습니다.");
  }

  // subject_id 처리 (빈 문자열 체크)
  const subjectIdRaw = formData.get("subject_id")?.toString();
  const subjectId = subjectIdRaw && subjectIdRaw.trim() !== "" ? subjectIdRaw.trim() : null;

  const updates: Partial<Omit<MasterCustomContent, "id" | "created_at" | "updated_at">> = {
    revision: formData.get("revision")?.toString() || null,
    content_category: formData.get("content_category")?.toString() || null,
    title: formData.get("title")?.toString() || "",
    difficulty_level: formData.get("difficulty_level")?.toString() || null,
    notes: formData.get("notes")?.toString() || null,
    content_type: formData.get("content_type")?.toString() || null,
    total_page_or_time: formData.get("total_page_or_time") 
      ? parseInt(formData.get("total_page_or_time")!.toString()) 
      : null,
    subject: formData.get("subject")?.toString() || null,
    subject_category: formData.get("subject_category")?.toString() || null,
    curriculum_revision_id: formData.get("curriculum_revision_id")?.toString() || null,
    subject_id: subjectId,
    subject_group_id: formData.get("subject_group_id")?.toString() || null,
  };

  if (!updates.title) {
    throw new Error("제목은 필수입니다.");
  }

  await updateMasterCustomContent(id, updates);

  revalidatePath("/admin/master-custom-contents");
  revalidatePath(`/admin/master-custom-contents/${id}`);
  redirect(`/admin/master-custom-contents/${id}`);
}

/**
 * 서비스 마스터 커스텀 콘텐츠 삭제
 */
export async function deleteMasterCustomContentAction(id: string) {
  const { role } = await getCurrentUserRole();

  // 관리자 권한 확인
  if (role !== "admin" && role !== "consultant") {
    throw new Error("권한이 없습니다.");
  }

  await deleteMasterCustomContent(id);

  revalidatePath("/admin/master-custom-contents");
  redirect("/admin/master-custom-contents");
}

