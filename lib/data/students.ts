import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type Student = {
  id: string;
  tenant_id?: string | null;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  birth_date?: string | null;
  // 마이페이지 필드
  school?: string | null;
  gender?: "남" | "여" | null;
  phone?: string | null;
  mother_phone?: string | null;
  father_phone?: string | null;
  exam_year?: number | null;
  curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
  desired_university_1?: string | null;
  desired_university_2?: string | null;
  desired_university_3?: string | null;
  desired_career_field?: "인문계열" | "사회계열" | "자연계열" | "공학계열" | "의약계열" | "예체능계열" | "교육계열" | "농업계열" | "해양계열" | "기타" | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * 학생 ID로 학생 정보 조회
 */
export async function getStudentById(
  studentId: string,
  tenantId?: string | null
): Promise<Student | null> {
  const supabase = await createSupabaseServerClient();

  // tenant_id는 더 이상 사용하지 않으므로 조회하지 않음
  const selectStudent = () =>
    supabase
      .from("students")
      .select("id,name,grade,class,birth_date,school,gender,phone,mother_phone,father_phone,exam_year,curriculum_revision,desired_university_1,desired_university_2,desired_university_3,desired_career_field,created_at,updated_at")
      .eq("id", studentId);

  let { data, error } = await selectStudent().maybeSingle<Student>();

  if (error && error.code !== "PGRST116") {
    console.error("[data/students] 학생 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * Tenant ID로 학생 목록 조회
 * @deprecated tenant_id는 더 이상 사용하지 않습니다. 모든 학생을 반환합니다.
 */
export async function listStudentsByTenant(
  tenantId: string | null
): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();

  // tenant_id는 더 이상 사용하지 않으므로 모든 학생 조회
  const selectStudents = () =>
    supabase
      .from("students")
      .select("id,name,grade,class,birth_date,school,gender,phone,mother_phone,father_phone,exam_year,curriculum_revision,desired_university_1,desired_university_2,desired_university_3,desired_career_field,created_at,updated_at")
      .order("created_at", { ascending: false });

  let { data, error } = await selectStudents();

  if (error) {
    console.error("[data/students] 학생 목록 조회 실패", error);
    return [];
  }

  return (data as Student[] | null) ?? [];
}

/**
 * 학생 정보 생성/업데이트
 */
export async function upsertStudent(
  student: {
    id: string;
    tenant_id: string | null;
    name: string;
    grade: string;
    class: string;
    birth_date: string;
    // 마이페이지 필드 (선택사항)
    school?: string | null;
    gender?: "남" | "여" | null;
    phone?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
    exam_year?: number | null;
    curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
    desired_university_1?: string | null;
    desired_university_2?: string | null;
    desired_university_3?: string | null;
    desired_career_field?: "인문계열" | "사회계열" | "자연계열" | "공학계열" | "의약계열" | "예체능계열" | "교육계열" | "농업계열" | "해양계열" | "기타" | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // tenant_id가 없으면 기본 tenant 조회
  let tenantId = student.tenant_id;
  if (!tenantId) {
    const { data: defaultTenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("name", "Default Tenant")
      .maybeSingle();

    if (tenantError) {
      console.error("[data/students] Default Tenant 조회 실패", tenantError);
      return {
        success: false,
        error: "기본 기관 정보를 조회할 수 없습니다.",
      };
    }

    if (!defaultTenant) {
      console.error("[data/students] Default Tenant가 존재하지 않습니다.");
      return {
        success: false,
        error:
          "기본 기관 정보가 설정되지 않았습니다. 관리자에게 문의하세요.",
      };
    }

    tenantId = defaultTenant.id;
  }

  const payload = {
    id: student.id,
    tenant_id: tenantId,
    name: student.name,
    grade: student.grade,
    class: student.class,
    birth_date: student.birth_date,
    school: student.school ?? null,
    gender: student.gender ?? null,
    phone: student.phone ?? null,
    mother_phone: student.mother_phone ?? null,
    father_phone: student.father_phone ?? null,
    exam_year: student.exam_year ?? null,
    curriculum_revision: student.curriculum_revision ?? null,
    desired_university_1: student.desired_university_1 ?? null,
    desired_university_2: student.desired_university_2 ?? null,
    desired_university_3: student.desired_university_3 ?? null,
    desired_career_field: student.desired_career_field ?? null,
  };

  const { error } = await supabase
    .from("students")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    console.error("[data/students] 학생 정보 저장 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

