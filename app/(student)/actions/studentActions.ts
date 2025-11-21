"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertStudent, getStudentById, type Student } from "@/lib/data/students";

export async function saveStudentInfo(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const klass = String(formData.get("class") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "").trim();

  if (!name || !grade || !klass || !birthDate) {
    throw new Error("모든 필드를 입력해주세요.");
  }

  const result = await upsertStudent({
    id: user.id,
    tenant_id: null, // null이면 upsertStudent에서 기본 tenant 자동 할당
    name,
    grade,
    class: klass,
    birth_date: birthDate,
  });

  if (!result.success) {
    throw new Error(result.error || "학생 정보 저장에 실패했습니다.");
  }

  redirect("/dashboard");
}

/**
 * 마이페이지에서 학생 정보 업데이트
 */
export async function updateStudentProfile(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 기존 학생 정보 조회 (필수 필드)
  const { data: existingStudent } = await supabase
    .from("students")
    .select("name, grade, class, birth_date, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingStudent) {
    return { success: false, error: "학생 정보를 찾을 수 없습니다." };
  }

  // 모든 필드 업데이트 가능
  const name = String(formData.get("name") ?? "").trim() || existingStudent.name || "";
  const grade = String(formData.get("grade") ?? "").trim() || existingStudent.grade || "";
  const school = String(formData.get("school") ?? "").trim() || null;
  const gender = (formData.get("gender") as "남" | "여" | null) || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const motherPhone = String(formData.get("mother_phone") ?? "").trim() || null;
  const fatherPhone = String(formData.get("father_phone") ?? "").trim() || null;
  
  const examYearStr = String(formData.get("exam_year") ?? "").trim();
  const examYear = examYearStr ? parseInt(examYearStr, 10) : null;
  
  const curriculumRevision = (formData.get("curriculum_revision") as "2009 개정" | "2015 개정" | "2022 개정" | null) || null;
  
  const desiredUniversity1 = String(formData.get("desired_university_1") ?? "").trim() || null;
  const desiredUniversity2 = String(formData.get("desired_university_2") ?? "").trim() || null;
  const desiredUniversity3 = String(formData.get("desired_university_3") ?? "").trim() || null;
  
  const desiredCareerField = (formData.get("desired_career_field") as string | null) || null;

  const result = await upsertStudent({
    id: user.id,
    tenant_id: existingStudent.tenant_id,
    name,
    grade,
    class: existingStudent.class || "",
    birth_date: existingStudent.birth_date || "",
    school,
    gender,
    phone,
    mother_phone: motherPhone,
    father_phone: fatherPhone,
    exam_year: examYear,
    curriculum_revision: curriculumRevision,
    desired_university_1: desiredUniversity1,
    desired_university_2: desiredUniversity2,
    desired_university_3: desiredUniversity3,
    desired_career_field: desiredCareerField as any,
  });

  return result;
}

/**
 * 현재 로그인한 학생 정보 조회
 */
export async function getCurrentStudent(): Promise<Student | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const student = await getStudentById(user.id);
  
  // 학생 정보가 없거나 이름이 없으면 user_metadata에서 가져오기
  if (student && !student.name && user.user_metadata?.display_name) {
    student.name = user.user_metadata.display_name as string;
  }
  
  return student;
}

