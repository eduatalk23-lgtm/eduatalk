import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeQuery, executeSingleQuery } from "./core/queryBuilder";
import type { SupabaseServerClient } from "./core/types";

export type Student = {
  id: string;
  tenant_id?: string | null;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  birth_date?: string | null;
  school_id?: string | null; // 통합 ID (SCHOOL_123 또는 UNIV_456)
  school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  student_number?: string | null;
  enrolled_at?: string | null;
  status?: "enrolled" | "on_leave" | "graduated" | "transferred" | null;
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

  // 기본 학적 정보만 조회 (프로필/진로 정보는 별도 테이블에서 조회)
  // name 필드도 포함하여 조회
  const { data, error } = await supabase
    .from("students")
    .select("id,tenant_id,name,grade,class,birth_date,school_id,school_type,student_number,enrolled_at,status,created_at,updated_at")
    .eq("id", studentId)
    .maybeSingle<Student>();

  if (error) {
    // PGRST116은 레코드가 없는 경우이므로 null 반환
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[data/students] 학생 정보 조회 실패", {
      studentId,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
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

  // 기본 학적 정보만 조회
  const result = await executeQuery<Student[]>(
    () =>
      supabase
        .from("students")
        .select("id,tenant_id,grade,class,birth_date,school_id,school_type,student_number,enrolled_at,status,created_at,updated_at")
        .order("created_at", { ascending: false }),
    {
      context: "[data/students]",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 학생 기본 정보 생성/업데이트
 */
/**
 * school_id에서 school_type 추출
 */
function extractSchoolType(schoolId: string | null | undefined): "MIDDLE" | "HIGH" | "UNIVERSITY" | null {
  if (!schoolId) return null;
  
  if (schoolId.startsWith("SCHOOL_")) {
    // school_info 테이블의 경우, 실제 조회해서 school_level 확인 필요
    // 하지만 여기서는 일단 null 반환 (나중에 조회해서 설정)
    return null;
  } else if (schoolId.startsWith("UNIV_")) {
    return "UNIVERSITY";
  }
  
  return null;
}

export async function upsertStudent(
  student: {
    id: string;
    tenant_id: string | null;
    name?: string | null;
    grade: string;
    class: string;
    birth_date: string;
    school_id?: string | null;
    school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
    student_number?: string | null;
    enrolled_at?: string | null;
    status?: "enrolled" | "on_leave" | "graduated" | "transferred" | null;
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

  // 기존 학생 정보 조회 (name이 없을 경우 기존 값 유지)
  let nameValue = student.name;
  if (!nameValue) {
    const { data: existingStudent } = await supabase
      .from("students")
      .select("name")
      .eq("id", student.id)
      .maybeSingle();
    
    if (existingStudent?.name) {
      nameValue = existingStudent.name;
    }
  }

  // school_type 자동 추출 (school_id에서)
  let schoolType = student.school_type;
  if (!schoolType && student.school_id) {
    schoolType = extractSchoolType(student.school_id);
    
    // SCHOOL_로 시작하는 경우 실제 조회해서 school_level 확인
    if (!schoolType && student.school_id.startsWith("SCHOOL_")) {
      try {
        const { getSchoolByUnifiedId } = await import("@/lib/data/schools");
        const school = await getSchoolByUnifiedId(student.school_id);
        if (school) {
          schoolType = school.school_type;
        }
      } catch (error) {
        console.error("[data/students] school_type 조회 실패:", error);
      }
    }
  }

  const payload: {
    id: string;
    tenant_id: string;
    name?: string | null;
    grade: string;
    class: string;
    birth_date: string;
    school_id: string | null;
    school_type: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
    student_number: string | null;
    enrolled_at: string | null;
    status: string;
  } = {
    id: student.id,
    tenant_id: tenantId,
    grade: student.grade,
    class: student.class,
    birth_date: student.birth_date,
    school_id: student.school_id ?? null,
    school_type: schoolType ?? null,
    student_number: student.student_number ?? null,
    enrolled_at: student.enrolled_at ?? null,
    status: student.status ?? "enrolled",
  };

  // name이 있으면 payload에 추가
  if (nameValue !== undefined) {
    payload.name = nameValue;
  }

  const { error } = await supabase
    .from("students")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    console.error("[data/students] 학생 정보 저장 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

