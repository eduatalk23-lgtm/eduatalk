"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSubjectGroups, getSubjectsByGroup, getSubjectTypes } from "@/lib/data/subjects";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";

// 교과 그룹 목록 조회 (전역 관리)
export async function getSubjectGroupsAction(
  curriculumRevisionId?: string
): Promise<SubjectGroup[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return getSubjectGroups(curriculumRevisionId);
}

// 교과 그룹에 속한 과목 목록 조회 (전역 관리)
export async function getSubjectsByGroupAction(
  subjectGroupId: string
): Promise<Subject[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return getSubjectsByGroup(subjectGroupId);
}

// 과목구분 목록 조회 (개정교육과정별)
export async function getSubjectTypesAction(
  curriculumRevisionId?: string
): Promise<SubjectType[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  return getSubjectTypes(curriculumRevisionId);
}

// 교과 그룹 생성 (전역 관리)
export async function createSubjectGroup(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const curriculumRevisionId = String(formData.get("curriculum_revision_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!curriculumRevisionId) {
    throw new Error("개정교육과정을 선택해주세요.");
  }

  if (!name) {
    throw new Error("교과 그룹명을 입력해주세요.");
  }

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // display_order 자동 계산: 기존 항목의 최대값 + 1
  const { data: existingGroups, error: queryError } = await supabaseAdmin
    .from("subject_groups")
    .select("display_order")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (queryError) {
    throw new Error(`기존 교과 그룹 조회 실패: ${queryError.message}`);
  }

  const displayOrder = existingGroups && existingGroups.length > 0
    ? (existingGroups[0].display_order ?? 0) + 1
    : 0;

  const { error } = await supabaseAdmin
    .from("subject_groups")
    .insert({
      curriculum_revision_id: curriculumRevisionId,
      name,
      display_order: displayOrder,
    });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 교과 그룹명입니다.");
    }
    throw new Error(`교과 그룹 생성에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 교과 그룹 수정 (전역 관리)
export async function updateSubjectGroup(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const curriculumRevisionId = String(formData.get("curriculum_revision_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!curriculumRevisionId) {
    throw new Error("개정교육과정을 선택해주세요.");
  }

  if (!name) {
    throw new Error("교과 그룹명을 입력해주세요.");
  }

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // display_order는 수정 시 변경하지 않음 (기존 값 유지)
  const { error } = await supabaseAdmin
    .from("subject_groups")
    .update({
      curriculum_revision_id: curriculumRevisionId,
      name,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 교과 그룹명입니다.");
    }
    throw new Error(`교과 그룹 수정에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 교과 그룹 삭제 (전역 관리)
export async function deleteSubjectGroup(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // 관련 과목이 있는지 확인
  const { data: subjects, error: checkError } = await supabaseAdmin
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

  const { error } = await supabaseAdmin
    .from("subject_groups")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`교과 그룹 삭제에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 과목 생성 (전역 관리)
export async function createSubject(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const subjectTypeId = String(formData.get("subject_type_id") ?? "").trim() || null;

  if (!subjectGroupId) {
    throw new Error("교과 그룹을 선택해주세요.");
  }

  if (!name) {
    throw new Error("과목명을 입력해주세요.");
  }

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // display_order 자동 계산: 기존 항목의 최대값 + 1
  const { data: existingSubjects, error: queryError } = await supabaseAdmin
    .from("subjects")
    .select("display_order")
    .eq("subject_group_id", subjectGroupId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (queryError) {
    throw new Error(`기존 과목 조회 실패: ${queryError.message}`);
  }

  const displayOrder = existingSubjects && existingSubjects.length > 0
    ? (existingSubjects[0].display_order ?? 0) + 1
    : 0;

  const { error } = await supabaseAdmin
    .from("subjects")
    .insert({
      subject_group_id: subjectGroupId,
      name,
      display_order: displayOrder,
      subject_type_id: subjectTypeId,
    });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 과목명입니다.");
    }
    throw new Error(`과목 생성에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 과목 수정 (전역 관리)
export async function updateSubject(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const subjectGroupId = String(formData.get("subject_group_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const subjectTypeId = String(formData.get("subject_type_id") ?? "").trim() || null;

  if (!subjectGroupId) {
    throw new Error("교과 그룹을 선택해주세요.");
  }

  if (!name) {
    throw new Error("과목명을 입력해주세요.");
  }

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // display_order는 수정 시 변경하지 않음 (기존 값 유지)
  const { error } = await supabaseAdmin
    .from("subjects")
    .update({
      subject_group_id: subjectGroupId,
      name,
      subject_type_id: subjectTypeId,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 과목명입니다.");
    }
    throw new Error(`과목 수정에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 과목 삭제 (전역 관리)
export async function deleteSubject(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  const { error } = await supabaseAdmin
    .from("subjects")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`과목 삭제에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/subjects");
}

// 과목구분 생성 (개정교육과정별)
export async function createSubjectType(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const curriculumRevisionId = String(formData.get("curriculum_revision_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const isActiveInput = String(formData.get("is_active") ?? "true").trim();

  if (!curriculumRevisionId) {
    throw new Error("개정교육과정을 선택해주세요.");
  }

  if (!name) {
    throw new Error("과목구분명을 입력해주세요.");
  }

  const isActive = isActiveInput === "true" || isActiveInput === "on";

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // display_order 자동 계산: 기존 항목의 최대값 + 1
  const { data: existingTypes, error: queryError } = await supabaseAdmin
    .from("subject_types")
    .select("display_order")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (queryError) {
    throw new Error(`기존 과목구분 조회 실패: ${queryError.message}`);
  }

  const displayOrder = existingTypes && existingTypes.length > 0
    ? (existingTypes[0].display_order ?? 0) + 1
    : 0;

  const { error } = await supabaseAdmin
    .from("subject_types")
    .insert({
      curriculum_revision_id: curriculumRevisionId,
      name,
      display_order: displayOrder,
      is_active: isActive,
    });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 과목구분명입니다.");
    }
    throw new Error(`과목구분 생성에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/content-metadata");
  revalidatePath("/admin/subjects");
}

// 과목구분 수정 (개정교육과정별)
export async function updateSubjectType(
  id: string,
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const curriculumRevisionId = String(formData.get("curriculum_revision_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const isActiveInput = String(formData.get("is_active") ?? "true").trim();

  if (!curriculumRevisionId) {
    throw new Error("개정교육과정을 선택해주세요.");
  }

  if (!name) {
    throw new Error("과목구분명을 입력해주세요.");
  }

  const isActive = isActiveInput === "true" || isActiveInput === "on";

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // display_order는 수정 시 변경하지 않음 (기존 값 유지)
  const { error } = await supabaseAdmin
    .from("subject_types")
    .update({
      curriculum_revision_id: curriculumRevisionId,
      name,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 존재하는 과목구분명입니다.");
    }
    throw new Error(`과목구분 수정에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/content-metadata");
  revalidatePath("/admin/subjects");
}

// 과목구분 삭제 (개정교육과정별)
export async function deleteSubjectType(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  
  if (!supabaseAdmin) {
    throw new Error("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.");
  }

  // 사용 중인 과목이 있는지 확인
  const { data: subjects, error: checkError } = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("subject_type_id", id)
    .limit(1);

  if (checkError) {
    throw new Error(`과목 확인 중 오류가 발생했습니다: ${checkError.message}`);
  }

  if (subjects && subjects.length > 0) {
    throw new Error("과목구분을 사용 중인 과목이 있어 삭제할 수 없습니다. 먼저 해당 과목의 과목구분을 변경해주세요.");
  }

  const { error } = await supabaseAdmin
    .from("subject_types")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`과목구분 삭제에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/admin/content-metadata");
  revalidatePath("/admin/subjects");
}

