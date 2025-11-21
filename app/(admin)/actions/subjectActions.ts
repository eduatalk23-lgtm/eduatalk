"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 교과 그룹 생성
export async function createSubjectGroup(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const displayOrderInput = String(formData.get("display_order") ?? "").trim();
  const defaultSubjectType = String(formData.get("default_subject_type") ?? "").trim() || null;

  if (!name) {
    throw new Error("교과 그룹명을 입력해주세요.");
  }

  const displayOrder = displayOrderInput ? Number(displayOrderInput) : 0;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subject_groups")
    .insert({
      tenant_id: tenantContext.tenantId,
      name,
      display_order: displayOrder,
      default_subject_type: defaultSubjectType,
    });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 교과 그룹명입니다.");
    }
    throw new Error(`교과 그룹 생성에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 교과 그룹 수정
export async function updateSubjectGroup(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const displayOrderInput = String(formData.get("display_order") ?? "").trim();
  const defaultSubjectType = String(formData.get("default_subject_type") ?? "").trim() || null;

  if (!name) {
    throw new Error("교과 그룹명을 입력해주세요.");
  }

  const displayOrder = displayOrderInput ? Number(displayOrderInput) : 0;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subject_groups")
    .update({
      name,
      display_order: displayOrder,
      default_subject_type: defaultSubjectType,
    })
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 교과 그룹명입니다.");
    }
    throw new Error(`교과 그룹 수정에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 교과 그룹 삭제
export async function deleteSubjectGroup(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다.");
  }

  const supabase = await createSupabaseServerClient();

  // 관련 과목이 있는지 확인
  const { data: subjects, error: checkError } = await supabase
    .from("subjects")
    .select("id")
    .eq("subject_group_id", id)
    .limit(1);

  if (checkError) {
    throw new Error(`과목 확인 중 오류가 발생했습니다: ${checkError.message}`);
  }

  if (subjects && subjects.length > 0) {
    throw new Error("과목이 있는 교과 그룹은 삭제할 수 없습니다. 먼저 모든 과목을 삭제해주세요.");
  }

  const { error } = await supabase
    .from("subject_groups")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    throw new Error(`교과 그룹 삭제에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 과목 생성
export async function createSubject(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다.");
  }

  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const displayOrderInput = String(formData.get("display_order") ?? "").trim();
  const subjectType = String(formData.get("subject_type") ?? "").trim() || null;

  if (!subjectGroupId) {
    throw new Error("교과 그룹을 선택해주세요.");
  }

  if (!name) {
    throw new Error("과목명을 입력해주세요.");
  }

  const displayOrder = displayOrderInput ? Number(displayOrderInput) : 0;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subjects")
    .insert({
      tenant_id: tenantContext.tenantId,
      subject_group_id: subjectGroupId,
      name,
      display_order: displayOrder,
      subject_type: subjectType,
    });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 과목명입니다.");
    }
    throw new Error(`과목 생성에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 과목 수정
export async function updateSubject(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다.");
  }

  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const displayOrderInput = String(formData.get("display_order") ?? "").trim();
  const subjectType = String(formData.get("subject_type") ?? "").trim() || null;

  if (!subjectGroupId) {
    throw new Error("교과 그룹을 선택해주세요.");
  }

  if (!name) {
    throw new Error("과목명을 입력해주세요.");
  }

  const displayOrder = displayOrderInput ? Number(displayOrderInput) : 0;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subjects")
    .update({
      subject_group_id: subjectGroupId,
      name,
      display_order: displayOrder,
      subject_type: subjectType,
    })
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 과목명입니다.");
    }
    throw new Error(`과목 수정에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 과목 삭제
export async function deleteSubject(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId);

  if (error) {
    throw new Error(`과목 삭제에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

