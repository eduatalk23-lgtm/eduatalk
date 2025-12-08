"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  upsertStudent,
  getStudentById,
  type Student,
} from "@/lib/data/students";
import {
  upsertStudentProfile,
  getStudentProfileById,
  type StudentProfile,
} from "@/lib/data/studentProfiles";
import {
  upsertStudentCareerGoal,
  getStudentCareerGoalById,
  type StudentCareerGoal,
} from "@/lib/data/studentCareerGoals";
import type { CareerField } from "@/lib/data/studentCareerFieldPreferences";
import {
  normalizePhoneNumber,
  validatePhoneNumber,
} from "@/lib/utils/studentFormUtils";

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

  // 이름을 user_metadata에도 저장
  if (name && name !== user.user_metadata?.display_name) {
    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (updateError) {
      console.error("이름 업데이트 실패:", updateError);
      // 이름 업데이트 실패는 치명적이지 않으므로 계속 진행
    }
  }

  // user_metadata에서 tenant_id 가져오기 (회원가입 시 선택한 기관)
  const tenantIdFromMetadata = user.user_metadata?.tenant_id as
    | string
    | null
    | undefined;

  const result = await upsertStudent({
    id: user.id,
    tenant_id: tenantIdFromMetadata || null, // 회원가입 시 선택한 기관 사용, 없으면 기본 tenant 자동 할당
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
 * 마이페이지에서 학생 정보 업데이트 (기본 정보, 프로필, 진로 정보 분리)
 */
export async function updateStudentProfile(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 기존 학생 정보 조회 (없으면 새로 생성)
  let existingStudent = await getStudentById(user.id);
  if (!existingStudent) {
    // 학생 정보가 없으면 기본 정보로 생성
    const name =
      String(formData.get("name") ?? "").trim() ||
      (user.user_metadata?.display_name as string | undefined) ||
      "";
    const grade = String(formData.get("grade") ?? "").trim() || "";
    const birthDate = String(formData.get("birth_date") ?? "").trim() || "";

    if (!name || !grade || !birthDate) {
      return {
        success: false,
        error: "필수 정보(이름, 학년, 생년월일)를 입력해주세요.",
      };
    }

    // user_metadata에서 tenant_id 가져오기 (회원가입 시 선택한 기관)
    const tenantIdFromMetadata = user.user_metadata?.tenant_id as
      | string
      | null
      | undefined;

    const createResult = await upsertStudent({
      id: user.id,
      tenant_id: tenantIdFromMetadata || null, // 회원가입 시 선택한 기관 사용, 없으면 기본 tenant 자동 할당
      name,
      grade,
      class: "",
      birth_date: birthDate,
    });

    if (!createResult.success) {
      return createResult;
    }

    // 생성된 학생 정보 다시 조회 (약간의 지연 후 재시도)
    // Supabase의 eventual consistency를 고려하여 재시도 로직 추가
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 100; // 100ms

    while (retryCount < maxRetries) {
      existingStudent = await getStudentById(user.id);
      if (existingStudent) {
        break;
      }

      retryCount++;
      if (retryCount < maxRetries) {
        // 마지막 시도가 아니면 잠시 대기 후 재시도
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * retryCount)
        );
      }
    }

    if (!existingStudent) {
      console.error("[studentActions] 학생 정보 생성 후 조회 실패", {
        userId: user.id,
        retryCount,
        createResult,
      });
      return {
        success: false,
        error:
          "학생 정보 생성 후 조회에 실패했습니다. 잠시 후 다시 시도해주세요.",
      };
    }
  }

  // 0. 이름 업데이트 (user_metadata의 display_name)
  const name = String(formData.get("name") ?? "").trim();
  if (name && name !== user.user_metadata?.display_name) {
    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (updateError) {
      console.error("이름 업데이트 실패:", updateError);
      // 이름 업데이트 실패는 치명적이지 않으므로 계속 진행
    }
  }

  // 1. 기본 정보 업데이트
  const grade =
    String(formData.get("grade") ?? "").trim() || existingStudent.grade || "";
  const schoolId = String(formData.get("school_id") ?? "").trim() || null;
  const birthDate =
    String(formData.get("birth_date") ?? "").trim() ||
    existingStudent.birth_date ||
    "";

  // name이 없으면 기존 값 또는 user_metadata의 display_name 사용
  let nameValue = name || null;
  if (!nameValue) {
    nameValue =
      existingStudent.name || user.user_metadata?.display_name || null;
  }

  const basicResult = await upsertStudent({
    id: user.id,
    tenant_id: existingStudent.tenant_id ?? null,
    name: nameValue,
    grade,
    // 반 필드는 관리자만 수정 가능하므로 항상 기존 값 유지
    // 학생은 마이페이지에서 반 정보를 수정할 수 없음
    class: existingStudent.class || "",
    birth_date: birthDate,
    school_id: schoolId,
  });

  if (!basicResult.success) {
    return basicResult;
  }

  // 2. 프로필 정보 업데이트
  const gender = (formData.get("gender") as "남" | "여" | null) || null;

  // 전화번호 정규화 및 검증
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const motherPhoneRaw = String(formData.get("mother_phone") ?? "").trim();
  const fatherPhoneRaw = String(formData.get("father_phone") ?? "").trim();

  // 전화번호 검증
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

  // 전화번호 정규화 (010-1234-5678 형식으로 통일)
  const phone = phoneRaw ? normalizePhoneNumber(phoneRaw) : null;
  const motherPhone = motherPhoneRaw
    ? normalizePhoneNumber(motherPhoneRaw)
    : null;
  const fatherPhone = fatherPhoneRaw
    ? normalizePhoneNumber(fatherPhoneRaw)
    : null;

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

  const profileResult = await upsertStudentProfile({
    id: user.id,
    tenant_id: existingStudent.tenant_id,
    gender,
    phone,
    mother_phone: motherPhone,
    father_phone: fatherPhone,
  });

  if (!profileResult.success) {
    return profileResult;
  }

  // 3. 진로 목표 정보 업데이트
  const examYearStr = String(formData.get("exam_year") ?? "").trim();
  const examYear = examYearStr ? parseInt(examYearStr, 10) : null;
  const curriculumRevision =
    (formData.get("curriculum_revision") as
      | "2009 개정"
      | "2015 개정"
      | "2022 개정"
      | null) || null;

  // desired_university_ids 배열 처리
  const desiredUniversityIds = formData
    .getAll("desired_university_ids")
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  // 진로 계열 (단일 선택)
  const desiredCareerField =
    (formData.get("desired_career_field") as CareerField | null) || null;

  const careerGoalResult = await upsertStudentCareerGoal({
    student_id: user.id,
    tenant_id: existingStudent.tenant_id,
    exam_year: examYear,
    curriculum_revision: curriculumRevision,
    desired_university_ids:
      desiredUniversityIds.length > 0 ? desiredUniversityIds : null,
    desired_career_field: desiredCareerField,
  });

  if (!careerGoalResult.success) {
    return careerGoalResult;
  }

  return { success: true };
}

/**
 * 현재 로그인한 학생 정보 조회 (기본 정보 + 프로필 + 진로 정보 통합)
 */
export async function getCurrentStudent(): Promise<
  | (Student &
      Partial<StudentProfile> &
      Partial<StudentCareerGoal> & { desired_career_field?: string | null })
  | null
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const student = await getStudentById(user.id);
  if (!student) {
    return null;
  }

  // 이름은 user_metadata에서 가져오기
  const name = user.user_metadata?.display_name as string | undefined;

  // 프로필 정보 조회
  const profile = await getStudentProfileById(user.id);

  // 진로 목표 정보 조회
  const careerGoal = await getStudentCareerGoalById(user.id);

  return {
    ...student,
    name: name || student.name || null,
    ...profile,
    ...careerGoal,
    desired_career_field: careerGoal?.desired_career_field || null,
  };
}
