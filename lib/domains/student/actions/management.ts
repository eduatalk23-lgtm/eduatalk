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
import { syncAuthBanStatus, bulkSyncAuthBanStatus } from "@/lib/auth/syncAuthBanStatus";

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

  // Supabase Auth ban_duration 동기화
  await syncAuthBanStatus(studentId, isActive);

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

    // 6. auth.users를 참조하는 NO ACTION/RESTRICT FK 컬럼들 정리 (auth.users 삭제 전 필수)
    // nullable 컬럼은 null로, NOT NULL 컬럼은 레코드 삭제
    await supabase.from("invite_codes").update({ used_by: null }).eq("used_by", studentId);
    await supabase.from("invite_codes").update({ created_by: null }).eq("created_by", studentId);
    await supabase.from("content_ai_extraction_logs").update({ created_by: null }).eq("created_by", studentId);
    await supabase.from("payment_records").update({ created_by: null }).eq("created_by", studentId);
    await supabase.from("files").delete().eq("uploaded_by", studentId);
    await supabase.from("file_distributions").delete().eq("distributed_by", studentId);
    await supabase.from("file_requests").delete().eq("created_by", studentId);
    await supabase.from("request_templates").delete().eq("created_by", studentId);
    await supabase.from("attendance_record_history").delete().eq("modified_by", studentId);

    // 7. soft-delete 트리거가 있는 콘텐츠 테이블 FK 정리
    // books, lectures, student_custom_contents에 prevent_content_deletion 트리거가 있어
    // students CASCADE 삭제 시 에러 발생 → 미리 FK를 끊거나 soft delete 처리
    await supabase.from("books").update({ student_id: null, is_active: false }).eq("student_id", studentId);
    await supabase.from("lectures").update({ student_id: null, is_active: false }).eq("student_id", studentId);
    // student_custom_contents는 student_id가 NOT NULL이므로 트리거를 일시 비활성화하여 삭제
    await supabase.rpc("delete_student_custom_contents", { p_student_id: studentId });

    // 8. auth.users에서 사용자 삭제 (관리자 권한 필요)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
      studentId
    );

    if (authDeleteError) {
      // auth user가 이미 없는 경우는 정상 처리 (고아 레코드 정리)
      if (authDeleteError.message === "User not found") {
        logActionWarn(
          { domain: "student", action: "deleteStudent" },
          "Auth user가 이미 존재하지 않음 (고아 레코드 정리)",
          { studentId, step: "auth.admin.deleteUser" }
        );
      } else {
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
    }

    // 8. students 테이블에서 삭제 (CASCADE로 나머지 관련 데이터 자동 삭제)
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

  // Supabase Auth ban_duration 벌크 동기화
  const updatedIds = data?.map((row) => row.id) ?? studentIds;
  await bulkSyncAuthBanStatus(updatedIds, isActive);

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

  // 1단계: auth.users를 참조하는 NO ACTION/RESTRICT FK 컬럼들 정리
  for (const studentId of studentIds) {
    await supabase.from("invite_codes").update({ used_by: null }).eq("used_by", studentId);
    await supabase.from("invite_codes").update({ created_by: null }).eq("created_by", studentId);
    await supabase.from("content_ai_extraction_logs").update({ created_by: null }).eq("created_by", studentId);
    await supabase.from("payment_records").update({ created_by: null }).eq("created_by", studentId);
    await supabase.from("files").delete().eq("uploaded_by", studentId);
    await supabase.from("file_distributions").delete().eq("distributed_by", studentId);
    await supabase.from("file_requests").delete().eq("created_by", studentId);
    await supabase.from("request_templates").delete().eq("created_by", studentId);
    await supabase.from("attendance_record_history").delete().eq("modified_by", studentId);
    // soft-delete 트리거가 있는 콘텐츠 테이블 FK 정리
    await supabase.from("books").update({ student_id: null, is_active: false }).eq("student_id", studentId);
    await supabase.from("lectures").update({ student_id: null, is_active: false }).eq("student_id", studentId);
    await supabase.rpc("delete_student_custom_contents", { p_student_id: studentId });
  }

  // 2단계: auth.users에서 사용자 삭제 (Supabase API 제한으로 개별 처리 필요)
  const authDeletedIds: string[] = [];
  for (const studentId of studentIds) {
    try {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
        studentId
      );

      if (authDeleteError) {
        // auth user가 이미 없는 경우는 정상 처리 (고아 레코드 정리)
        if (authDeleteError.message === "User not found") {
          logActionWarn(
            { domain: "student", action: "bulkDeleteStudents" },
            "Auth user가 이미 존재하지 않음 (고아 레코드 정리)",
            { studentId, step: "auth.admin.deleteUser" }
          );
          authDeletedIds.push(studentId);
        } else {
          errors.push(
            `${studentId}: 인증 사용자 삭제 실패 - ${authDeleteError.message}`
          );
          continue;
        }
      } else {
        authDeletedIds.push(studentId);
      }
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

  // 3단계: students 테이블에서 배치 삭제 (N+1 방지)
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
 * students 단일 테이블에서 기본 + 프로필 + 진로 정보 업데이트
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
      division?: "고등부" | "중등부" | "졸업" | null;
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
      birth_date: payload.basic.birth_date ?? existingStudent.birth_date ?? null,
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

      // is_active 변경 시 Supabase Auth ban_duration 동기화
      if (payload.basic.is_active !== undefined) {
        await syncAuthBanStatus(studentId, payload.basic.is_active);
      }
    }
  }

  // 2. 프로필 + 진로 정보 업데이트 (students 테이블에 통합됨 — 단일 UPDATE)
  if (payload.profile || payload.career) {
    const {
      normalizePhoneNumber,
      validatePhoneNumber,
    } = await import("@/lib/utils/studentFormUtils");

    const updateData: Record<string, unknown> = {};

    // 프로필 정보 처리
    if (payload.profile) {
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
          return { success: false, error: `모 연락처: ${motherPhoneValidation.error}` };
        }
      }

      if (fatherPhoneRaw) {
        const fatherPhoneValidation = validatePhoneNumber(fatherPhoneRaw);
        if (!fatherPhoneValidation.valid) {
          return { success: false, error: `부 연락처: ${fatherPhoneValidation.error}` };
        }
      }

      if (emergencyPhoneRaw) {
        const emergencyPhoneValidation = validatePhoneNumber(emergencyPhoneRaw);
        if (!emergencyPhoneValidation.valid) {
          return { success: false, error: `비상연락처: ${emergencyPhoneValidation.error}` };
        }
      }

      const normalizeOptional = (raw: string | null | undefined) =>
        raw !== undefined ? (raw ? normalizePhoneNumber(raw) : null) : undefined;

      const phone = normalizeOptional(phoneRaw);
      const motherPhone = normalizeOptional(motherPhoneRaw);
      const fatherPhone = normalizeOptional(fatherPhoneRaw);
      const emergencyPhone = normalizeOptional(emergencyPhoneRaw);

      if (phoneRaw && phone === null) {
        return { success: false, error: "본인 연락처 형식이 올바르지 않습니다 (010-1234-5678)" };
      }
      if (motherPhoneRaw && motherPhone === null) {
        return { success: false, error: "모 연락처 형식이 올바르지 않습니다 (010-1234-5678)" };
      }
      if (fatherPhoneRaw && fatherPhone === null) {
        return { success: false, error: "부 연락처 형식이 올바르지 않습니다 (010-1234-5678)" };
      }
      if (emergencyPhoneRaw && emergencyPhone === null) {
        return { success: false, error: "비상연락처 형식이 올바르지 않습니다 (010-1234-5678)" };
      }

      if (payload.profile.gender !== undefined) updateData.gender = payload.profile.gender;
      if (phone !== undefined) updateData.phone = phone;
      if (motherPhone !== undefined) updateData.mother_phone = motherPhone;
      if (fatherPhone !== undefined) updateData.father_phone = fatherPhone;
      if (payload.profile.address !== undefined) updateData.address = payload.profile.address;
      if (payload.profile.emergency_contact !== undefined) updateData.emergency_contact = payload.profile.emergency_contact;
      if (emergencyPhone !== undefined) updateData.emergency_contact_phone = emergencyPhone;
      if (payload.profile.medical_info !== undefined) updateData.medical_info = payload.profile.medical_info;
    }

    // 진로 정보 처리
    if (payload.career) {
      if (payload.career.exam_year !== undefined) updateData.exam_year = payload.career.exam_year;
      if (payload.career.curriculum_revision !== undefined) updateData.curriculum_revision = payload.career.curriculum_revision;
      if (payload.career.desired_university_ids !== undefined) updateData.desired_university_ids = payload.career.desired_university_ids ?? [];
      if (payload.career.desired_career_field !== undefined) updateData.desired_career_field = payload.career.desired_career_field;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: profileCareerError } = await supabase
        .from("students")
        .update(updateData)
        .eq("id", studentId);

      if (profileCareerError) {
        logActionError(
          { domain: "student", action: "updateStudentInfo" },
          profileCareerError,
          { studentId, step: "profile/career" }
        );
        return { success: false, error: profileCareerError.message || "프로필/진로 정보 업데이트에 실패했습니다." };
      }
    }
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true };
}

// Connection code helpers removed - now using invite domain

// generateUniqueConnectionCode removed - now using invite domain

/**
 * 신규 학생 등록 (인증 계정 없이)
 * 
 * @param formData - 학생 정보 FormData
 * @returns 학생 ID와 연결 코드
 */
export async function createStudent(
  input: import("@/lib/validation/studentSchemas").CreateStudentInput
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

  const { createStudentSchema } = await import("@/lib/validation/studentSchemas");

  // 빈 문자열을 null로 정규화 (Server Action 직렬화에서 null→"" 변환 방지)
  if (input.basic) {
    for (const [k, v] of Object.entries(input.basic)) {
      if (v === "") (input.basic as Record<string, unknown>)[k] = null;
    }
  }
  if (input.profile) {
    for (const [k, v] of Object.entries(input.profile)) {
      if (v === "") (input.profile as Record<string, unknown>)[k] = null;
    }
  }
  if (input.career) {
    for (const [k, v] of Object.entries(input.career)) {
      if (v === "") (input.career as Record<string, unknown>)[k] = null;
    }
  }

  // 스키마 검증
  const validationResult = createStudentSchema.safeParse(input);

  if (!validationResult.success) {
    const firstError = validationResult.error.errors[0];
    const fieldPath = firstError?.path?.join(".") || "unknown";
    return {
      success: false,
      error: firstError
        ? `${fieldPath}: ${firstError.message}`
        : "입력 정보가 올바르지 않습니다.",
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
      grade: basic.grade ?? null,
      class: basic.class ?? null,
      birth_date: basic.birth_date ?? null,
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

    // 2. 프로필 + 진로 정보 업데이트 (students 테이블에 통합됨)
    const extraFields: Record<string, unknown> = {};

    if (profile) {
      if (profile.gender != null) extraFields.gender = profile.gender;
      if (profile.phone != null) extraFields.phone = profile.phone;
      if (profile.mother_phone != null) extraFields.mother_phone = profile.mother_phone;
      if (profile.father_phone != null) extraFields.father_phone = profile.father_phone;
      if (profile.address != null) extraFields.address = profile.address;
      if (profile.address_detail != null) extraFields.address_detail = profile.address_detail;
      if (profile.postal_code != null) extraFields.postal_code = profile.postal_code;
      if (profile.emergency_contact != null) extraFields.emergency_contact = profile.emergency_contact;
      if (profile.emergency_contact_phone != null) extraFields.emergency_contact_phone = profile.emergency_contact_phone;
      if (profile.medical_info != null) extraFields.medical_info = profile.medical_info;
      if (profile.bio != null) extraFields.bio = profile.bio;
      if (profile.interests != null) extraFields.interests = profile.interests;
    }

    if (career) {
      if (career.exam_year != null) extraFields.exam_year = career.exam_year;
      if (career.curriculum_revision != null) extraFields.curriculum_revision = career.curriculum_revision;
      if (career.desired_university_ids != null) extraFields.desired_university_ids = career.desired_university_ids;
      if (career.desired_career_field != null) extraFields.desired_career_field = career.desired_career_field;
      if (career.target_major != null) extraFields.target_major = career.target_major;
      if (career.target_major_2 != null) extraFields.target_major_2 = career.target_major_2;
      if (career.target_score != null) extraFields.target_score = career.target_score;
      if (career.target_university_type != null) extraFields.target_university_type = career.target_university_type;
      if (career.notes != null) extraFields.career_notes = career.notes;
    }

    if (Object.keys(extraFields).length > 0) {
      const { error: updateError } = await supabase
        .from("students")
        .update(extraFields)
        .eq("id", studentId);

      if (updateError) {
        logActionWarn(
          { domain: "student", action: "createStudent" },
          "프로필/진로 정보 저장 실패",
          { studentId, error: updateError.message }
        );
      }
    }

    // 4. 초대 코드 생성 (invite_codes 테이블)
    const { createInviteCode } = await import("@/lib/domains/invite");
    const inviteResult = await createInviteCode({
      studentId,
      targetRole: "student",
    });

    if (!inviteResult.success) {
      logActionError(
        { domain: "student", action: "createStudent" },
        new Error(inviteResult.error || "초대 코드 생성 실패"),
        { studentId, step: "invite_codes" }
      );
      return {
        success: false,
        error: inviteResult.error || "초대 코드 생성에 실패했습니다.",
      };
    }
    const connectionCode = inviteResult.code;

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

// regenerateConnectionCode removed - use createInviteCode from invite domain

// getStudentConnectionCode removed - use getStudentInviteCodes from invite domain
