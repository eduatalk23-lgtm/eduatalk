import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudentPhoneData = {
  id: string;
  name: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
};

/**
 * 단일 학생의 전화번호 정보 조회
 * students 테이블과 student_profiles 테이블을 조인하여 조회
 */
export async function getStudentPhones(
  studentId: string
): Promise<StudentPhoneData | null> {
  const supabase = await createSupabaseServerClient();

  // 1. students 테이블에서 기본 정보 조회
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return null;
  }

  // 2. student_profiles 테이블에서 전화번호 조회
  let profile: {
    phone?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
  } | null = null;
  try {
    const { data: profileData } = await supabase
      .from("student_profiles")
      .select("phone, mother_phone, father_phone")
      .eq("id", studentId)
      .maybeSingle();

    profile = profileData;
  } catch {
    // student_profiles 테이블이 없거나 조회 실패 시 무시
  }

  // 3. 결과 병합 (student_profiles 우선)
  return {
    id: student.id,
    name: student.name,
    phone: profile?.phone ?? null,
    mother_phone: profile?.mother_phone ?? null,
    father_phone: profile?.father_phone ?? null,
  };
}

/**
 * 여러 학생의 전화번호 정보 일괄 조회
 */
export async function getStudentPhonesBatch(
  studentIds: string[]
): Promise<StudentPhoneData[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // 1. students 테이블에서 기본 정보 일괄 조회
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name")
    .in("id", studentIds);

  if (studentsError || !students) {
    return [];
  }

  // 2. student_profiles 테이블에서 전화번호 일괄 조회
  let profiles: Array<{
    id: string;
    phone?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
  }> = [];
  try {
    const { data: profilesData } = await supabase
      .from("student_profiles")
      .select("id, phone, mother_phone, father_phone")
      .in("id", studentIds);

    if (profilesData) {
      profiles = profilesData;
    }
  } catch {
    // student_profiles 테이블이 없거나 조회 실패 시 무시
  }

  // 3. 결과 병합 (student_profiles 우선)
  return students.map((student) => {
    const profile = profiles.find((p) => p.id === student.id);
    return {
      id: student.id,
      name: student.name,
      phone: profile?.phone ?? null,
      mother_phone: profile?.mother_phone ?? null,
      father_phone: profile?.father_phone ?? null,
    };
  });
}

