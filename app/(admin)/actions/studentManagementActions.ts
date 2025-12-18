"use server";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * 학생 계정 비활성화/활성화
 */
export async function toggleStudentStatus(
  studentId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("students")
    .update({ is_active: isActive })
    .eq("id", studentId);

  if (error) {
    console.error("[admin/studentManagement] 학생 상태 변경 실패", error);
    return {
      success: false,
      error: error.message || "상태 변경에 실패했습니다.",
    };
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
  const { role } = await getCurrentUserRole();

  if (role !== "admin") {
    return { success: false, error: "관리자만 학생을 삭제할 수 있습니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // NO ACTION 제약조건이 있는 테이블들을 먼저 삭제 (순서 중요)
    // 1. student_score_analysis_cache
    const { error: cacheError } = await supabase
      .from("student_score_analysis_cache")
      .delete()
      .eq("student_id", studentId);

    if (cacheError) {
      console.error(
        "[admin/studentManagement] 성적 분석 캐시 삭제 실패",
        cacheError
      );
      // 경고만 하고 계속 진행
    }

    // 2. student_score_events
    const { error: eventsError } = await supabase
      .from("student_score_events")
      .delete()
      .eq("student_id", studentId);

    if (eventsError) {
      console.error(
        "[admin/studentManagement] 성적 이벤트 삭제 실패",
        eventsError
      );
      // 경고만 하고 계속 진행
    }

    // 3. student_internal_scores
    const { error: internalScoresError } = await supabase
      .from("student_internal_scores")
      .delete()
      .eq("student_id", studentId);

    if (internalScoresError) {
      console.error(
        "[admin/studentManagement] 내신 성적 삭제 실패",
        internalScoresError
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
      console.error(
        "[admin/studentManagement] 모의고사 성적 삭제 실패",
        mockScoresError
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
      console.error(
        "[admin/studentManagement] 학기 정보 삭제 실패",
        termsError
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
      console.error(
        "[admin/studentManagement] 인증 사용자 삭제 실패",
        authDeleteError
      );
      return {
        success: false,
        error: `인증 사용자 삭제 실패: ${authDeleteError.message}`,
      };
    }

    // 7. students 테이블에서 삭제 (CASCADE로 나머지 관련 데이터 자동 삭제)
    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId);

    if (deleteError) {
      console.error(
        "[admin/studentManagement] 학생 삭제 실패",
        deleteError
      );
      return {
        success: false,
        error: deleteError.message || "학생 삭제에 실패했습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    console.error("[admin/studentManagement] 학생 삭제 중 오류", error);
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
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  if (studentIds.length === 0) {
    return { success: false, error: "선택된 학생이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error, count } = await supabase
    .from("students")
    .update({ is_active: isActive })
    .in("id", studentIds)
    .select("id");

  if (error) {
    console.error("[admin/studentManagement] 학생 상태 일괄 변경 실패", error);
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
  const { role } = await getCurrentUserRole();

  if (role !== "admin") {
    return { success: false, error: "관리자만 학생을 삭제할 수 있습니다." };
  }

  if (studentIds.length === 0) {
    return { success: false, error: "선택된 학생이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();
  let successCount = 0;
  const errors: string[] = [];

  // 각 학생에 대해 삭제 작업 수행
  for (const studentId of studentIds) {
    try {
      // NO ACTION 제약조건이 있는 테이블들을 먼저 삭제
      // 1. student_score_analysis_cache
      await supabase
        .from("student_score_analysis_cache")
        .delete()
        .eq("student_id", studentId);

      // 2. student_score_events
      await supabase
        .from("student_score_events")
        .delete()
        .eq("student_id", studentId);

      // 3. student_internal_scores
      const { error: internalScoresError } = await supabase
        .from("student_internal_scores")
        .delete()
        .eq("student_id", studentId);

      if (internalScoresError) {
        errors.push(
          `${studentId}: 내신 성적 삭제 실패 - ${internalScoresError.message}`
        );
        continue;
      }

      // 4. student_mock_scores
      const { error: mockScoresError } = await supabase
        .from("student_mock_scores")
        .delete()
        .eq("student_id", studentId);

      if (mockScoresError) {
        errors.push(
          `${studentId}: 모의고사 성적 삭제 실패 - ${mockScoresError.message}`
        );
        continue;
      }

      // 5. student_terms
      const { error: termsError } = await supabase
        .from("student_terms")
        .delete()
        .eq("student_id", studentId);

      if (termsError) {
        errors.push(
          `${studentId}: 학기 정보 삭제 실패 - ${termsError.message}`
        );
        continue;
      }

      // 6. auth.users에서 사용자 삭제
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
        studentId
      );

      if (authDeleteError) {
        errors.push(
          `${studentId}: 인증 사용자 삭제 실패 - ${authDeleteError.message}`
        );
        continue;
      }

      // 7. students 테이블에서 삭제 (CASCADE로 나머지 관련 데이터 자동 삭제)
      const { error: deleteError } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId);

      if (deleteError) {
        errors.push(`${studentId}: 학생 삭제 실패 - ${deleteError.message}`);
        continue;
      }

      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      errors.push(`${studentId}: ${errorMessage}`);
      console.error(
        `[admin/studentManagement] 학생 삭제 중 오류 (${studentId}):`,
        error
      );
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
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // 빈 문자열을 null로 변환
  const normalizedClass = classValue?.trim() || null;

  const { error } = await supabase
    .from("students")
    .update({ class: normalizedClass })
    .eq("id", studentId);

  if (error) {
    console.error("[admin/studentManagement] 학생 반 정보 변경 실패", error);
    return {
      success: false,
      error: error.message || "반 정보 변경에 실패했습니다.",
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
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

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
      school_id: payload.basic.school_id,
      division: payload.basic.division,
      status: payload.basic.status,
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
        console.error("[admin/studentManagement] 학생 추가 정보 업데이트 실패", updateError);
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
 */
function generateConnectionCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const getRandomChar = () => chars[Math.floor(Math.random() * chars.length)];
  
  const part1 = Array.from({ length: 4 }, getRandomChar).join("");
  const part2 = Array.from({ length: 4 }, getRandomChar).join("");
  
  return `STU-${part1}-${part2}`;
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

  // FormData를 객체로 변환
  const { formDataToObject } = await import("@/lib/validation/schemas");
  const { createStudentSchema } = await import("@/lib/validation/studentSchemas");
  
  const obj = formDataToObject(formData);
  
  // 스키마 검증
  const validationResult = createStudentSchema.safeParse({
    basic: obj,
    profile: obj,
    career: obj,
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
        console.warn("[admin/studentManagement] 프로필 저장 실패:", profileResult.error);
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
        console.warn("[admin/studentManagement] 진로 정보 저장 실패:", careerResult.error);
      }
    }

    // 4. 연결 코드 생성 및 저장
    const connectionCode = generateConnectionCode();
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
      console.error("[admin/studentManagement] 연결 코드 저장 실패", codeError);
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
    console.error("[admin/studentManagement] 학생 등록 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "학생 등록 중 알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 연결 코드 검증 (회원가입 시 사용)
 * 
 * @param connectionCode - 연결 코드
 * @returns 학생 ID 또는 에러
 */
export async function validateConnectionCode(
  connectionCode: string
): Promise<{
  success: boolean;
  studentId?: string;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  // 코드 형식 검증
  if (!connectionCode.match(/^STU-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
    return { success: false, error: "연결 코드 형식이 올바르지 않습니다." };
  }

  // 코드 조회
  const { data, error } = await supabase
    .from("student_connection_codes")
    .select("student_id, expires_at, used_at")
    .eq("connection_code", connectionCode)
    .maybeSingle();

  if (error) {
    console.error("[admin/studentManagement] 연결 코드 조회 실패", error);
    return { success: false, error: "연결 코드를 확인할 수 없습니다." };
  }

  if (!data) {
    return { success: false, error: "유효하지 않은 연결 코드입니다." };
  }

  // 만료 확인
  const expiresAt = new Date(data.expires_at);
  if (expiresAt < new Date()) {
    return { success: false, error: "만료된 연결 코드입니다." };
  }

  // 사용 여부 확인
  if (data.used_at) {
    return { success: false, error: "이미 사용된 연결 코드입니다." };
  }

  return {
    success: true,
    studentId: data.student_id,
  };
}

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

  // 새 코드 생성
  const connectionCode = generateConnectionCode();
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
    console.error("[admin/studentManagement] 연결 코드 재발급 실패", codeError);
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
