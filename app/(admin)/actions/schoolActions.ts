"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

/**
 * 학교 생성
 */
export async function createSchool(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name || !type) {
    return { success: false, error: "학교명과 타입은 필수입니다." };
  }

  if (!["중학교", "고등학교", "대학교"].includes(type)) {
    return { success: false, error: "올바른 학교 타입을 선택하세요." };
  }

  const supabase = await createSupabaseServerClient();

  // 중복 확인
  const { data: existing } = await supabase
    .from("schools")
    .select("id")
    .eq("name", name)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "이미 등록된 학교입니다." };
  }

  const { error } = await supabase.from("schools").insert({
    name,
    type,
    region,
    address,
  });

  if (error) {
    console.error("[actions/schoolActions] 학교 생성 실패:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 학교 수정
 */
export async function updateSchool(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!id || !name || !type) {
    return { success: false, error: "필수 필드를 입력하세요." };
  }

  if (!["중학교", "고등학교", "대학교"].includes(type)) {
    return { success: false, error: "올바른 학교 타입을 선택하세요." };
  }

  const supabase = await createSupabaseServerClient();

  // 중복 확인 (자기 자신 제외)
  const { data: existing } = await supabase
    .from("schools")
    .select("id")
    .eq("name", name)
    .eq("type", type)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "이미 등록된 학교입니다." };
  }

  const { error } = await supabase
    .from("schools")
    .update({
      name,
      type,
      region,
      address,
    })
    .eq("id", id);

  if (error) {
    console.error("[actions/schoolActions] 학교 수정 실패:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 학교 삭제
 */
export async function deleteSchool(
  schoolId: string
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);

  if (error) {
    console.error("[actions/schoolActions] 학교 삭제 실패:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

