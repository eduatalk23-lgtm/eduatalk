import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeQuery, executeSingleQuery } from "./core/queryBuilder";
import type { SupabaseServerClient } from "./core/types";
import { createTypedConditionalQuery } from "./core/typedQueryBuilder";
import type { StudentDivision } from "@/lib/constants/students";

export type Student = {
  id: string;
  tenant_id?: string | null;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  birth_date?: string | null;
  school_id?: string | null; // 통합 ID (SCHOOL_123 또는 UNIV_456)
  school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  division?: "고등부" | "중등부" | "기타" | null;
  student_number?: string | null;
  enrolled_at?: string | null;
  status?: "enrolled" | "on_leave" | "graduated" | "transferred" | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * 학생 기본 필드 목록 (동적 필드 포함)
 */
const STUDENT_BASE_FIELDS = "id,tenant_id,name,grade,class,birth_date,school_id,student_number,enrolled_at,status,created_at,updated_at";
const STUDENT_OPTIONAL_FIELDS = ["school_type", "division"];

/**
 * 학생 쿼리 빌더 - 동적 필드 선택
 * 선택적 필드를 병렬로 확인하여 성능 최적화
 */
async function buildStudentQuery(
  supabase: SupabaseServerClient,
  baseSelect: string = STUDENT_BASE_FIELDS
): Promise<string> {
  let selectFields = baseSelect;
  
  // 선택적 필드를 병렬로 확인 (성능 최적화)
  const fieldChecks = await Promise.allSettled(
    STUDENT_OPTIONAL_FIELDS.map(async (field) => {
      try {
        const testQuery = supabase.from("students").select(field).limit(1);
        const { error: testError } = await testQuery;
        return { field, exists: !testError };
      } catch (e) {
        return { field, exists: false };
      }
    })
  );
  
  // 존재하는 필드만 추가
  for (const result of fieldChecks) {
    if (result.status === "fulfilled" && result.value.exists) {
      selectFields += `,${result.value.field}`;
    }
  }
  
  return selectFields;
}

/**
 * 학생 ID로 학생 정보 조회
 */
export async function getStudentById(
  studentId: string,
  tenantId?: string | null
): Promise<Student | null> {
  const supabase = await createSupabaseServerClient();

  // 동적 필드 선택을 사용한 타입 안전한 쿼리
  return await createTypedConditionalQuery<Student>(
    async () => {
      const selectFields = await buildStudentQuery(supabase);
      return await supabase
        .from("students")
        .select(selectFields)
        .eq("id", studentId)
        .maybeSingle<Student>();
    },
    {
      context: "[data/students] getStudentById",
      defaultValue: null,
      fallbackQuery: async () => {
        // fallback: 기본 필드만 사용
        return await supabase
          .from("students")
          .select(STUDENT_BASE_FIELDS)
          .eq("id", studentId)
          .maybeSingle<Student>();
      },
      shouldFallback: (error) => {
        return error?.code === "42703" || error?.code === "PGRST116";
      },
    }
  );
}

/**
 * Tenant ID로 학생 목록 조회
 * @deprecated tenant_id는 더 이상 사용하지 않습니다. 모든 학생을 반환합니다.
 */
export async function listStudentsByTenant(
  tenantId: string | null
): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();

  // 기본 학적 정보만 조회 (동적 필드 포함)
  const selectFields = await buildStudentQuery(supabase);
  
  const result = await executeQuery<Student[]>(
    async () => {
      const queryResult = await supabase
        .from("students")
        .select(selectFields)
        .order("created_at", { ascending: false });
      return queryResult as { data: Student[] | null; error: import("@supabase/supabase-js").PostgrestError | null };
    },
    {
      context: "[data/students] listStudentsByTenant",
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
    division?: StudentDivision | null;
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

  const payload: Record<string, unknown> = {
    id: student.id,
    tenant_id: tenantId,
    grade: student.grade,
    class: student.class,
    birth_date: student.birth_date,
    school_id: student.school_id ?? null,
    student_number: student.student_number ?? null,
    enrolled_at: student.enrolled_at ?? null,
    status: student.status ?? "enrolled",
  };
  
  // name이 있으면 payload에 추가
  if (nameValue !== undefined) {
    payload.name = nameValue;
  }
  
  // school_type이 있으면 추가 (마이그레이션 후 컬럼이 있을 때만)
  if (schoolType) {
    payload.school_type = schoolType;
  }

  // division이 있으면 추가
  if (student.division !== undefined) {
    payload.division = student.division;
  }

  // 타입 안전한 upsert 시도
  const { error } = await supabase
    .from("students")
    .upsert(payload, { onConflict: "id" });

  // 선택적 필드가 없어서 에러가 발생하면 해당 필드 제거하고 재시도
  if (error && error.code === "42703") {
    const errorMessage = error.message?.toLowerCase() || "";
    
    // school_type 컬럼이 없으면 제거
    if (errorMessage.includes("school_type") && payload.school_type) {
      delete payload.school_type;
    }
    
    // division 컬럼이 없으면 제거
    if (errorMessage.includes("division") && payload.division) {
      delete payload.division;
    }
    
    // 재시도
    const retryResult = await supabase
      .from("students")
      .upsert(payload, { onConflict: "id" });
    
    if (retryResult.error) {
      console.error("[data/students] 학생 정보 저장 실패", retryResult.error);
      return { success: false, error: retryResult.error.message };
    }
    
    if (errorMessage.includes("school_type") || errorMessage.includes("division")) {
      console.warn("[data/students] 선택적 컬럼이 없습니다. 마이그레이션을 실행해주세요.");
    }
  } else if (error) {
    console.error("[data/students] 학생 정보 저장 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * SMS 발송용 활성화된 학생 목록 조회
 * is_active 필터를 자동으로 적용하고, 동적으로 필드를 확인하여 조회
 */
export async function getActiveStudentsForSMS(): Promise<{
  data: Array<{
    id: string;
    name?: string | null;
    grade?: string | null;
    class?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
    is_active?: boolean | null;
  }>;
  error: unknown;
}> {
  const supabase = await createSupabaseServerClient();

  // 기본 필드
  let studentsSelectFields = "id, name, grade, class";

  // 학부모 연락처 컬럼 확인 (mother_phone, father_phone 사용)
  try {
    const testQuery = supabase
      .from("students")
      .select("mother_phone, father_phone")
      .limit(1);
    const { error: testError } = await testQuery;
    if (!testError) {
      studentsSelectFields += ",mother_phone,father_phone";
    }
  } catch (e) {
    // 컬럼이 없으면 무시
  }

  // is_active 컬럼 확인
  try {
    const testQuery = supabase.from("students").select("is_active").limit(1);
    const { error: testError } = await testQuery;
    if (!testError) {
      studentsSelectFields += ",is_active";
    }
  } catch (e) {
    // 컬럼이 없으면 무시
  }

  // 활성화된 학생만 조회
  const { data, error } = await supabase
    .from("students")
    .select(studentsSelectFields)
    .eq("is_active", true)
    .order("name", { ascending: true });

  return { 
    data: (data ?? []) as unknown as Array<{
      id: string;
      name?: string | null;
      grade?: string | null;
      class?: string | null;
      mother_phone?: string | null;
      father_phone?: string | null;
      is_active?: boolean | null;
    }>, 
    error 
  };
}

/**
 * 학생 구분 업데이트
 */
export async function updateStudentDivision(
  studentId: string,
  division: StudentDivision | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("students")
    .update({ division })
    .eq("id", studentId);

  if (error) {
    console.error("[data/students] 학생 구분 업데이트 실패", {
      studentId,
      division,
      error: error.message,
      code: error.code,
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 구분별 학생 목록 조회
 * @param division - 구분 필터 (undefined: 전체, null: 미설정, "고등부"|"중등부"|"기타": 특정 구분)
 */
export async function getStudentsByDivision(
  division: StudentDivision | null | undefined
): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();

  const selectFields = await buildStudentQuery(supabase);

  let query = supabase
    .from("students")
    .select(selectFields)
    .order("name", { ascending: true });

  // undefined인 경우 모든 학생 조회 (필터 없음)
  if (division !== undefined) {
    if (division !== null) {
      query = query.eq("division", division);
    } else {
      query = query.is("division", null);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[data/students] 구분별 학생 목록 조회 실패", {
      division,
      error: error.message,
      code: error.code,
    });
    return [];
  }

  return (data as unknown as Student[]) ?? [];
}

/**
 * 구분별 학생 통계 조회
 */
export async function getStudentDivisionStats(): Promise<Array<{
  division: StudentDivision | null;
  count: number;
}>> {
  const supabase = await createSupabaseServerClient();

  // division 필드 존재 여부 확인
  try {
    const testQuery = supabase.from("students").select("division").limit(1);
    const { error: testError } = await testQuery;
    
    if (testError && testError.code === "42703") {
      // division 컬럼이 없으면 빈 배열 반환
      return [];
    }
  } catch (e) {
    return [];
  }

  // 구분별 통계 조회
  const { data, error } = await supabase
    .from("students")
    .select("division");

  if (error) {
    console.error("[data/students] 구분별 통계 조회 실패", error);
    return [];
  }

  if (!data) {
    return [];
  }

  // 통계 집계
  const stats = new Map<StudentDivision | null, number>();
  stats.set("고등부", 0);
  stats.set("중등부", 0);
  stats.set("기타", 0);
  stats.set(null, 0);

  for (const student of data) {
    const division = student.division as StudentDivision | null;
    const current = stats.get(division) ?? 0;
    stats.set(division, current + 1);
  }

  return Array.from(stats.entries()).map(([division, count]) => ({
    division,
    count,
  }));
}

/**
 * 학생 구분 일괄 업데이트
 * 배치 처리로 성능 최적화 (500개씩)
 */
export async function batchUpdateStudentDivision(
  studentIds: string[],
  division: StudentDivision | null
): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Array<{ studentId: string; error: string }>;
}> {
  const supabase = await createSupabaseServerClient();

  // 입력 검증
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return {
      success: false,
      successCount: 0,
      failureCount: 0,
      errors: [{ studentId: "", error: "학생을 선택해주세요." }],
    };
  }

  // 중복 제거
  const uniqueStudentIds = Array.from(new Set(studentIds));

  // division 값 검증
  if (division !== null && division !== "고등부" && division !== "중등부" && division !== "기타") {
    return {
      success: false,
      successCount: 0,
      failureCount: uniqueStudentIds.length,
      errors: uniqueStudentIds.map((id) => ({
        studentId: id,
        error: "유효하지 않은 구분입니다.",
      })),
    };
  }

  const errors: Array<{ studentId: string; error: string }> = [];
  let successCount = 0;
  const batchSize = 500;

  // 배치 처리
  for (let i = 0; i < uniqueStudentIds.length; i += batchSize) {
    const batch = uniqueStudentIds.slice(i, i + batchSize);

    const { error: updateError } = await supabase
      .from("students")
      .update({ division, updated_at: new Date().toISOString() })
      .in("id", batch);

    if (updateError) {
      console.error("[data/students] 일괄 구분 업데이트 실패", {
        batchSize: batch.length,
        error: updateError.message,
        code: updateError.code,
      });

      // 배치 전체 실패로 처리
      batch.forEach((studentId) => {
        errors.push({
          studentId,
          error: updateError.message || "구분 업데이트에 실패했습니다.",
        });
      });
    } else {
      successCount += batch.length;
    }
  }

  const failureCount = errors.length;

  return {
    success: failureCount === 0,
    successCount,
    failureCount,
    errors: failureCount > 0 ? errors : undefined,
  };
}

