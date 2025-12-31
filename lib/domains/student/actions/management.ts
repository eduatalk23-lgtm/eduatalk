"use server";

import { redirect } from "next/navigation";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/errors";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";

/**
 * 학생 계정 비활성화/활성화
 */
export async function toggleStudentStatus(
  studentId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  // 권한 확인
  await requireAdminOrConsultant();
  
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

  const { data: updatedRows, error } = await supabase
    .from("students")
    .update({ is_active: isActive })
    .eq("id", studentId)
    .eq("tenant_id", tenantContext.tenantId)
    .select();

  if (error) {
    logActionError(
      { domain: "student", action: "toggleStudentStatus" },
      error,
      { studentId, isActive }
    );
    return {
      success: false,
      error: error.message || "상태 변경에 실패했습니다.",
    };
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "학생을 찾을 수 없습니다." };
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true };
}

/**
 * 학생 계정 삭제 (하드 삭제: 실제 DB에서 삭제)
 * NO ACTION 제약조건이 있는 테이블들을 먼저 삭제한 후 students 테이블 삭제
 */
export async function deleteStudent(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  // 권한 확인 (관리자만)
  const { role } = await requireAdminOrConsultant();
  if (role !== "admin") {
    return { success: false, error: "관리자만 학생을 삭제할 수 있습니다." };
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

  try {
    // NO ACTION 제약조건이 있는 테이블들을 먼저 삭제 (순서 중요)
    // 1. student_score_analysis_cache
    const { error: cacheError } = await supabase
      .from("student_score_analysis_cache")
      .delete()
      .eq("student_id", studentId);

    if (cacheError) {
      logActionWarn(
        { domain: "student", action: "deleteStudent" },
        "성적 분석 캐시 삭제 실패",
        { studentId, error: cacheError.message }
      );
      // 경고만 하고 계속 진행
    }

    // 2. student_score_events
    const { error: eventsError } = await supabase
      .from("student_score_events")
      .delete()
      .eq("student_id", studentId);

    if (eventsError) {
      logActionWarn(
        { domain: "student", action: "deleteStudent" },
        "성적 이벤트 삭제 실패",
        { studentId, error: eventsError.message }
      );
      // 경고만 하고 계속 진행
    }

    // 3. student_internal_scores
    const { error: internalScoresError } = await supabase
      .from("student_internal_scores")
      .delete()
      .eq("student_id", studentId);

    if (internalScoresError) {
      logActionError(
        { domain: "student", action: "deleteStudent" },
        internalScoresError,
        { studentId, step: "student_internal_scores" }
      );
      return {
        success: false,
        error: `내신 성적 삭제 실패: ${internalScoresError.message}`,
      };
    }

    // 4. student_mock_scores
    const { error: mockScoresError } = await supabase
      .from("student_mock_scores")
      .delete()
      .eq("student_id", studentId);

    if (mockScoresError) {
      logActionError(
        { domain: "student", action: "deleteStudent" },
        mockScoresError,
        { studentId, step: "student_mock_scores" }
      );
      return {
        success: false,
        error: `모의고사 성적 삭제 실패: ${mockScoresError.message}`,
      };
    }

    // 5. student_terms
    const { error: termsError } = await supabase
      .from("student_terms")
      .delete()
      .eq("student_id", studentId);

    if (termsError) {
      logActionError(
        { domain: "student", action: "deleteStudent" },
        termsError,
        { studentId, step: "student_terms" }
      );
      return {
        success: false,
        error: `학기 정보 삭제 실패: ${termsError.message}`,
      };
    }

    // 6. auth.users에서 사용자 삭제 (관리자 권한 필요)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
      studentId
    );

    if (authDeleteError) {
      logActionError(
        { domain: "student", action: "deleteStudent" },
        authDeleteError,
        { studentId, step: "auth.admin.deleteUser" }
      );
      return {
        success: false,
        error: `인증 사용자 삭제 실패: ${authDeleteError.message}`,
      };
    }

    // 7. students 테이블에서 삭제 (CASCADE로 나머지 관련 데이터 자동 삭제)
    const { data: deletedRows, error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId)
      .eq("tenant_id", tenantContext.tenantId)
      .select();

    if (deleteError) {
      logActionError(
        { domain: "student", action: "deleteStudent" },
        deleteError,
        { studentId, step: "students" }
      );
      return {
        success: false,
        error: deleteError.message || "학생 삭제에 실패했습니다.",
      };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return {
        success: false,
        error: "학생을 찾을 수 없습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "student", action: "deleteStudent" },
      error,
      { studentId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "학생 삭제 중 알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 학생의 상태를 일괄 변경 (활성화/비활성화)
 */
export async function bulkToggleStudentStatus(
  studentIds: string[],
  isActive: boolean
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  // 권한 확인
  await requireAdminOrConsultant();
  
  // 테넌트 컨텍스트 확인
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  if (studentIds.length === 0) {
    return { success: false, error: "선택된 학생이 없습니다." };
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { success: false, error: "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다." };
  }

  const { data, error, count } = await supabase
    .from("students")
    .update({ is_active: isActive })
    .in("id", studentIds)
    .eq("tenant_id", tenantContext.tenantId)
    .select("id");

  if (error) {
    logActionError(
      { domain: "student", action: "bulkToggleStudentStatus" },
      error,
      { studentIds, isActive }
    );
    return {
      success: false,
      error: error.message || "상태 변경에 실패했습니다.",
    };
  }

  revalidatePath("/admin/students");

  const updatedCount = data?.length ?? count ?? studentIds.length;
  return { success: true, updatedCount };
}

/**
 * 여러 학생을 일괄 삭제 (관리자 전용, 하드 삭제)
 * 각 학생에 대해 deleteStudent와 동일한 프로세스 수행
 */
export async function bulkDeleteStudents(
  studentIds: string[]
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  // 권한 확인 (관리자만)
  const { role } = await requireAdminOrConsultant();
  if (role !== "admin") {
    return { success: false, error: "관리자만 학생을 삭제할 수 있습니다." };
  }
  
  // 테넌트 컨텍스트 확인
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  if (studentIds.length === 0) {
    return { success: false, error: "선택된 학생이 없습니다." };
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { success: false, error: "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다." };
  }
  let successCount = 0;
  const errors: string[] = [];

  // NO ACTION 제약조건이 있는 테이블들을 배치 삭제 (N+1 → 5 쿼리로 최적화)
  // 이 테이블들은 개별 에러 추적이 필요 없으므로 배치 처리
  const batchDeleteResults = await Promise.all([
    supabase
      .from("student_score_analysis_cache")
      .delete()
      .in("student_id", studentIds),
    supabase
      .from("student_score_events")
      .delete()
      .in("student_id", studentIds),
    supabase
      .from("student_internal_scores")
      .delete()
      .in("student_id", studentIds),
    supabase
      .from("student_mock_scores")
      .delete()
      .in("student_id", studentIds),
    supabase
      .from("student_terms")
      .delete()
      .in("student_id", studentIds),
  ]);

  // 배치 삭제 에러 확인 (치명적 에러만 로깅)
  const batchErrors = batchDeleteResults
    .map((result, index) => {
      const tableNames = [
        "student_score_analysis_cache",
        "student_score_events",
        "student_internal_scores",
        "student_mock_scores",
        "student_terms",
      ];
      if (result.error) {
        return `${tableNames[index]}: ${result.error.message}`;
      }
      return null;
    })
    .filter(Boolean);

  if (batchErrors.length > 0) {
    logActionWarn(
      { domain: "student", action: "bulkDeleteStudents" },
      "배치 삭제 경고",
      { studentIds, batchErrors }
    );
  }

  // 1단계: auth.users에서 사용자 삭제 (Supabase API 제한으로 개별 처리 필요)
  const authDeletedIds: string[] = [];
  for (const studentId of studentIds) {
    try {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
        studentId
      );

      if (authDeleteError) {
        errors.push(
          `${studentId}: 인증 사용자 삭제 실패 - ${authDeleteError.message}`
        );
        continue;
      }

      authDeletedIds.push(studentId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "알 수 없는 오류";
      errors.push(`${studentId}: ${errorMessage}`);
      logActionError(
        { domain: "student", action: "bulkDeleteStudents" },
        err,
        { studentId, step: "auth.admin.deleteUser" }
      );
    }
  }

  // 2단계: students 테이블에서 배치 삭제 (N+1 방지)
  if (authDeletedIds.length > 0) {
    const { data: deletedRows, error: deleteError } = await supabase
      .from("students")
      .delete()
      .in("id", authDeletedIds)
      .eq("tenant_id", tenantContext.tenantId)
      .select("id");

    if (deleteError) {
      errors.push(`학생 테이블 배치 삭제 실패: ${deleteError.message}`);
    } else {
      successCount = deletedRows?.length || 0;

      // 삭제되지 않은 학생 확인
      const deletedIdSet = new Set(deletedRows?.map((r) => r.id) || []);
      for (const id of authDeletedIds) {
        if (!deletedIdSet.has(id)) {
          errors.push(`${id}: 학생을 찾을 수 없습니다.`);
        }
      }
    }
  }

  revalidatePath("/admin/students");

  if (errors.length > 0) {
    return {
      success: errors.length < studentIds.length,
      error: `일부 학생 삭제에 실패했습니다: ${errors.slice(0, 3).join(", ")}${
        errors.length > 3 ? "..." : ""
      }`,
      deletedCount: successCount,
    };
  }

  return { success: true, deletedCount: successCount };
}

/**
 * 학생 반 정보 업데이트 (관리자 전용)
 */
export async function updateStudentClass(
  studentId: string,
  classValue: string | null
): Promise<{ success: boolean; error?: string }> {
  // 권한 확인
  await requireAdminOrConsultant();
  
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

  // 빈 문자열을 null로 변환
  const normalizedClass = classValue?.trim() || null;

  const { data: updatedRows, error } = await supabase
    .from("students")
    .update({ class: normalizedClass })
    .eq("id", studentId)
    .eq("tenant_id", tenantContext.tenantId)
    .select();

  if (error) {
    logActionError(
      { domain: "student", action: "updateStudentClass" },
      error,
      { studentId, classValue }
    );
    return {
      success: false,
      error: error.message || "반 정보 변경에 실패했습니다.",
    };
  }

  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      error: "학생을 찾을 수 없습니다.",
    };
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true };
}

/**
 * 통합 학생 정보 업데이트 (관리자 전용)
 * 3개 테이블(students, student_profiles, student_career_goals)을 한 번에 업데이트
 */
export async function updateStudentInfo(
  studentId: string,
  payload: {
    basic?: {
      name?: string | null;
      grade?: string;
      class?: string | null;
      birth_date?: string;
      school_id?: string | null;
      division?: "고등부" | "중등부" | "기타" | null;
      memo?: string | null;
      status?: "enrolled" | "on_leave" | "graduated" | "transferred" | null;
      is_active?: boolean;
    };
    profile?: {
      gender?: "남" | "여" | null;
      phone?: string | null;
      mother_phone?: string | null;
      father_phone?: string | null;
      address?: string | null;
      emergency_contact?: string | null;
      emergency_contact_phone?: string | null;
      medical_info?: string | null;
    };
    career?: {
      exam_year?: number | null;
      curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
      desired_university_ids?: string[] | null;
      desired_career_field?: string | null;
    };
  }
): Promise<{ success: boolean; error?: string }> {
  // 권한 확인
  await requireAdminOrConsultant();
  
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

  // 기존 학생 정보 조회
  const { getStudentById } = await import("@/lib/data/students");
  const existingStudent = await getStudentById(studentId);

  if (!existingStudent) {
    return { success: false, error: "학생 정보를 찾을 수 없습니다." };
  }

  // 1. 기본 정보 업데이트
  if (payload.basic) {
    const {
      upsertStudent,
    } = await import("@/lib/data/students");
    const {
      normalizePhoneNumber,
      validatePhoneNumber,
    } = await import("@/lib/utils/studentFormUtils");

    // 이름 업데이트 시 user_metadata에도 동기화
    if (payload.basic.name !== undefined && payload.basic.name !== existingStudent.name) {
      const { data: authUser } = await supabase.auth.admin.getUserById(studentId);
      if (authUser?.user && payload.basic.name) {
        await supabase.auth.admin.updateUserById(studentId, {
          user_metadata: {
            ...authUser.user.user_metadata,
            display_name: payload.basic.name,
          },
        });
      }
    }

    const basicResult = await upsertStudent({
      id: studentId,
      tenant_id: existingStudent.tenant_id ?? null,
      name: payload.basic.name,
      grade: payload.basic.grade ?? existingStudent.grade ?? "",
      class: payload.basic.class ?? existingStudent.class ?? "",
      birth_date: payload.basic.birth_date ?? existingStudent.birth_date ?? "",
      school_id: payload.basic.school_id !== undefined 
        ? payload.basic.school_id 
        : existingStudent.school_id ?? null,
      division: payload.basic.division !== undefined
        ? payload.basic.division
        : existingStudent.division ?? null,
      status: payload.basic.status !== undefined
        ? payload.basic.status
        : existingStudent.status ?? null,
    });

    if (!basicResult.success) {
      return basicResult;
    }

    // memo와 is_active는 별도 업데이트 (upsertStudent에 포함되지 않음)
    if (payload.basic.memo !== undefined || payload.basic.is_active !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (payload.basic.memo !== undefined) {
        updateData.memo = payload.basic.memo;
      }
      if (payload.basic.is_active !== undefined) {
        updateData.is_active = payload.basic.is_active;
      }

      const { error: updateError } = await supabase
        .from("students")
        .update(updateData)
        .eq("id", studentId);

      if (updateError) {
        logActionError(
          { domain: "student", action: "updateStudentInfo" },
          updateError,
          { studentId, step: "memo/is_active" }
        );
        return {
          success: false,
          error: updateError.message || "학생 정보 업데이트에 실패했습니다.",
        };
      }
    }
  }

  // 2. 프로필 정보 업데이트
  if (payload.profile) {
    const {
      upsertStudentProfile,
    } = await import("@/lib/data/studentProfiles");
    const {
      normalizePhoneNumber,
      validatePhoneNumber,
    } = await import("@/lib/utils/studentFormUtils");

    // 전화번호 검증 및 정규화
    const phoneRaw = payload.profile.phone;
    const motherPhoneRaw = payload.profile.mother_phone;
    const fatherPhoneRaw = payload.profile.father_phone;
    const emergencyPhoneRaw = payload.profile.emergency_contact_phone;

    if (phoneRaw) {
      const phoneValidation = validatePhoneNumber(phoneRaw);
      if (!phoneValidation.valid) {
        return { success: false, error: `본인 연락처: ${phoneValidation.error}` };
      }
    }

    if (motherPhoneRaw) {
      const motherPhoneValidation = validatePhoneNumber(motherPhoneRaw);
      if (!motherPhoneValidation.valid) {
        return {
          success: false,
          error: `모 연락처: ${motherPhoneValidation.error}`,
        };
      }
    }

    if (fatherPhoneRaw) {
      const fatherPhoneValidation = validatePhoneNumber(fatherPhoneRaw);
      if (!fatherPhoneValidation.valid) {
        return {
          success: false,
          error: `부 연락처: ${fatherPhoneValidation.error}`,
        };
      }
    }

    if (emergencyPhoneRaw) {
      const emergencyPhoneValidation = validatePhoneNumber(emergencyPhoneRaw);
      if (!emergencyPhoneValidation.valid) {
        return {
          success: false,
          error: `비상연락처: ${emergencyPhoneValidation.error}`,
        };
      }
    }

    // 전화번호 정규화
    const phone = phoneRaw ? normalizePhoneNumber(phoneRaw) : null;
    const motherPhone = motherPhoneRaw ? normalizePhoneNumber(motherPhoneRaw) : null;
    const fatherPhone = fatherPhoneRaw ? normalizePhoneNumber(fatherPhoneRaw) : null;
    const emergencyPhone = emergencyPhoneRaw ? normalizePhoneNumber(emergencyPhoneRaw) : null;

    // 정규화 실패 시 에러 반환
    if (phoneRaw && !phone) {
      return {
        success: false,
        error: "본인 연락처 형식이 올바르지 않습니다 (010-1234-5678)",
      };
    }
    if (motherPhoneRaw && !motherPhone) {
      return {
        success: false,
        error: "모 연락처 형식이 올바르지 않습니다 (010-1234-5678)",
      };
    }
    if (fatherPhoneRaw && !fatherPhone) {
      return {
        success: false,
        error: "부 연락처 형식이 올바르지 않습니다 (010-1234-5678)",
      };
    }
    if (emergencyPhoneRaw && !emergencyPhone) {
      return {
        success: false,
        error: "비상연락처 형식이 올바르지 않습니다 (010-1234-5678)",
      };
    }

    const profileResult = await upsertStudentProfile({
      id: studentId,
      tenant_id: existingStudent.tenant_id ?? null,
      gender: payload.profile.gender,
      phone,
      mother_phone: motherPhone,
      father_phone: fatherPhone,
      address: payload.profile.address,
      emergency_contact: payload.profile.emergency_contact,
      emergency_contact_phone: emergencyPhone,
      medical_info: payload.profile.medical_info,
    });

    if (!profileResult.success) {
      return profileResult;
    }
  }

  // 3. 진로 정보 업데이트
  if (payload.career) {
    const {
      upsertStudentCareerGoal,
    } = await import("@/lib/data/studentCareerGoals");

    const careerGoalResult = await upsertStudentCareerGoal({
      student_id: studentId,
      tenant_id: existingStudent.tenant_id ?? null,
      exam_year: payload.career.exam_year,
      curriculum_revision: payload.career.curriculum_revision,
      desired_university_ids: payload.career.desired_university_ids,
      desired_career_field: payload.career.desired_career_field,
    });

    if (!careerGoalResult.success) {
      return careerGoalResult;
    }
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true };
}

/**
 * 연결 코드 생성 (STU-XXXX-XXXX 형식)
 * crypto.getRandomValues를 사용하여 보안 강화
 */
function generateConnectionCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
  // crypto.getRandomValues를 사용하여 보안 강화
  const getRandomChar = () => {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const index = randomArray[0] % chars.length;
    return chars[index];
  };
  
  const part1 = Array.from({ length: 4 }, getRandomChar).join("");
  const part2 = Array.from({ length: 4 }, getRandomChar).join("");
  
  return `STU-${part1}-${part2}`;
}

/**
 * 고유 연결 코드 생성 (중복 체크 포함)
 * 
 * @param supabase - Supabase 클라이언트
 * @param maxRetries - 최대 재시도 횟수 (기본값: 10)
 * @returns 고유한 연결 코드
 */
async function generateUniqueConnectionCode(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  maxRetries = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateConnectionCode();
    
    // 중복 체크
    const { data, error } = await supabase
      .from("student_connection_codes")
      .select("id")
      .eq("connection_code", code)
      .maybeSingle();
    
    if (error && error.code !== "PGRST116") {
      // PGRST116은 "no rows returned" 에러이므로 정상
      logActionError(
        { domain: "student", action: "generateUniqueConnectionCode" },
        error,
        { code, attempt }
      );
      throw new Error("연결 코드 생성 중 오류가 발생했습니다.");
    }
    
    // 중복이 없으면 반환
    if (!data) {
      return code;
    }
    
    // 중복이 있으면 재시도
    logActionWarn(
      { domain: "student", action: "generateUniqueConnectionCode" },
      `연결 코드 중복 감지, 재시도 ${attempt + 1}/${maxRetries}`,
      { code, attempt }
    );
  }
  
  // 최대 재시도 횟수 초과
  throw new Error("고유한 연결 코드를 생성할 수 없습니다. 다시 시도해주세요.");
}

/**
 * 신규 학생 등록 (인증 계정 없이)
 * 
 * @param formData - 학생 정보 FormData
 * @returns 학생 ID와 연결 코드
 */
export async function createStudent(
  formData: FormData
): Promise<{
  success: boolean;
  studentId?: string;
  connectionCode?: string;
  error?: string;
}> {
  const { role, tenantId, userId } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  if (!tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  if (!userId) {
    return { success: false, error: "사용자 정보를 찾을 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // FormData 필드 분리
  const { separateStudentFormFields } = await import("@/lib/utils/studentFormDataHelpers");
  const { formDataToObject } = await import("@/lib/validation/schemas");
  const { createStudentSchema } = await import("@/lib/validation/studentSchemas");
  
  // 필드를 기본정보, 프로필, 진로정보로 분리
  const { basic: basicFormData, profile: profileFormData, career: careerFormData } = 
    separateStudentFormFields(formData);
  
  // 각 필드 그룹을 객체로 변환
  const basicObj = formDataToObject(basicFormData);
  
  // 프로필과 진로 정보는 선택사항이므로 빈 FormData인지 확인
  const profileObj = profileFormData.keys().next().done ? null : formDataToObject(profileFormData);
  const careerObj = careerFormData.keys().next().done ? null : formDataToObject(careerFormData);
  
  // 스키마 검증
  const validationResult = createStudentSchema.safeParse({
    basic: basicObj,
    profile: profileObj,
    career: careerObj,
  });

  if (!validationResult.success) {
    const firstError = validationResult.error.errors[0];
    return {
      success: false,
      error: firstError?.message || "입력 정보가 올바르지 않습니다.",
    };
  }

  const { basic, profile, career } = validationResult.data;

  try {
    // 학생 ID 생성 (UUID)
    const studentId = crypto.randomUUID();

    // 1. students 테이블 레코드 생성
    const { upsertStudent } = await import("@/lib/data/students");
    const basicResult = await upsertStudent({
      id: studentId,
      tenant_id: tenantId,
      name: basic.name,
      grade: basic.grade,
      class: basic.class ?? "",
      birth_date: basic.birth_date,
      school_id: basic.school_id ?? null,
      school_type: basic.school_type ?? null,
      division: basic.division ?? null,
      student_number: basic.student_number ?? null,
      enrolled_at: basic.enrolled_at ?? null,
      status: basic.status ?? "enrolled",
    });

    if (!basicResult.success) {
      return { success: false, error: basicResult.error || "학생 정보 저장에 실패했습니다." };
    }

    // 2. student_profiles 테이블 레코드 생성 (데이터 있는 경우)
    if (profile) {
      const { upsertStudentProfile } = await import("@/lib/data/studentProfiles");
      const profileResult = await upsertStudentProfile({
        id: studentId,
        tenant_id: tenantId,
        gender: profile.gender ?? null,
        phone: profile.phone ?? null,
        mother_phone: profile.mother_phone ?? null,
        father_phone: profile.father_phone ?? null,
        address: profile.address ?? null,
        address_detail: profile.address_detail ?? null,
        postal_code: profile.postal_code ?? null,
        emergency_contact: profile.emergency_contact ?? null,
        emergency_contact_phone: profile.emergency_contact_phone ?? null,
        medical_info: profile.medical_info ?? null,
        bio: profile.bio ?? null,
        interests: profile.interests ?? null,
      });

      if (!profileResult.success) {
        // 프로필 저장 실패는 치명적이지 않으므로 경고만
        logActionWarn(
          { domain: "student", action: "createStudent" },
          "프로필 저장 실패",
          { studentId, error: profileResult.error }
        );
      }
    }

    // 3. student_career_goals 테이블 레코드 생성 (데이터 있는 경우)
    if (career) {
      const { upsertStudentCareerGoal } = await import("@/lib/data/studentCareerGoals");
      const careerResult = await upsertStudentCareerGoal({
        student_id: studentId,
        tenant_id: tenantId,
        exam_year: career.exam_year ?? null,
        curriculum_revision: career.curriculum_revision ?? null,
        desired_university_ids: career.desired_university_ids ?? null,
        desired_career_field: career.desired_career_field ?? null,
        target_major: career.target_major ?? null,
        target_major_2: career.target_major_2 ?? null,
        target_score: career.target_score ?? null,
        target_university_type: career.target_university_type ?? null,
        notes: career.notes ?? null,
      });

      if (!careerResult.success) {
        // 진로 정보 저장 실패는 치명적이지 않으므로 경고만
        logActionWarn(
          { domain: "student", action: "createStudent" },
          "진로 정보 저장 실패",
          { studentId, error: careerResult.error }
        );
      }
    }

    // 4. 연결 코드 생성 및 저장 (고유 코드 생성 함수 사용)
    const connectionCode = await generateUniqueConnectionCode(supabase);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후 만료

    const { error: codeError } = await supabase
      .from("student_connection_codes")
      .insert({
        student_id: studentId,
        connection_code: connectionCode,
        expires_at: expiresAt.toISOString(),
        created_by: userId,
      });

    if (codeError) {
      logActionError(
        { domain: "student", action: "createStudent" },
        codeError,
        { studentId, step: "student_connection_codes" }
      );
      return {
        success: false,
        error: `연결 코드 저장에 실패했습니다: ${codeError.message}`,
      };
    }

    revalidatePath("/admin/students");

    return {
      success: true,
      studentId,
      connectionCode,
    };
  } catch (error) {
    logActionError(
      { domain: "student", action: "createStudent" },
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "학생 등록 중 알 수 없는 오류가 발생했습니다.",
    };
  }
}

// validateConnectionCode 함수는 lib/utils/connectionCodeUtils.ts로 이동되었습니다.
// 사용처가 없으므로 제거되었습니다.

/**
 * 연결 코드 재발급
 * 
 * @param studentId - 학생 ID
 * @returns 새로운 연결 코드
 */
export async function regenerateConnectionCode(
  studentId: string
): Promise<{
  success: boolean;
  connectionCode?: string;
  error?: string;
}> {
  const { role, tenantId, userId } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  if (!tenantId || !userId) {
    return { success: false, error: "사용자 정보를 찾을 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // 기존 코드 비활성화 (used_at 설정)
  await supabase
    .from("student_connection_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .is("used_at", null);

  // 새 코드 생성 (고유 코드 생성 함수 사용)
  const connectionCode = await generateUniqueConnectionCode(supabase);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후 만료

  const { error: codeError } = await supabase
    .from("student_connection_codes")
    .insert({
      student_id: studentId,
      connection_code: connectionCode,
      expires_at: expiresAt.toISOString(),
      created_by: userId,
    });

  if (codeError) {
    logActionError(
      { domain: "student", action: "regenerateConnectionCode" },
      codeError,
      { studentId }
    );
    return {
      success: false,
      error: `연결 코드 재발급에 실패했습니다: ${codeError.message}`,
    };
  }

  revalidatePath(`/admin/students/${studentId}`);

  return {
    success: true,
    connectionCode,
  };
}

/**
 * 학생의 연결 코드 조회
 * 
 * @param studentId - 학생 ID
 * @returns 연결 코드 정보
 */
export async function getStudentConnectionCode(
  studentId: string
): Promise<{
  success: boolean;
  data?: {
    connection_code: string;
    expires_at: string;
    used_at: string | null;
  } | null;
  error?: string;
}> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_connection_codes")
    .select("connection_code, expires_at, used_at")
    .eq("student_id", studentId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logActionError(
      { domain: "student", action: "getStudentConnectionCode" },
      error,
      { studentId }
    );
    return { success: false, error: error.message || "연결 코드를 조회할 수 없습니다." };
  }

  return {
    success: true,
    data: data ?? null,
  };
}
