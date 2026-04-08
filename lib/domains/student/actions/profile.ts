"use server";

/**
 * Student Profile Actions
 *
 * 학생이 자신의 프로필을 관리하는 Server Actions.
 */

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import {
  upsertStudent,
  getStudentById,
  type Student,
} from "@/lib/data/students";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import type { StudentProfile } from "@/lib/data/studentProfiles";
import type { StudentCareerGoal } from "@/lib/data/studentCareerGoals";
import type { CareerField } from "@/lib/data/studentCareerFieldPreferences";
import type { StudentDivision } from "@/lib/constants/students";
import {
  normalizePhoneNumber,
  validatePhoneNumber,
} from "@/lib/utils/studentFormUtils";

/**
 * 학생 정보 저장 (회원가입 시)
 */
export async function saveStudentInfo(formData: FormData): Promise<void> {
  const user = await getCachedAuthUser();
  const supabase = await createSupabaseServerClient();

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
      logActionWarn(
        { domain: "student", action: "saveStudentInfo" },
        "이름 업데이트 실패 (계속 진행)",
        { error: updateError.message }
      );
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
  const user = await getCachedAuthUser();
  const supabase = await createSupabaseServerClient();

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
      logActionError(
        { domain: "student", action: "updateStudentProfile", userId: user.id },
        new Error("학생 정보 생성 후 조회 실패"),
        { retryCount, createResult }
      );
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
      logActionWarn(
        { domain: "student", action: "updateStudentProfile", userId: user.id },
        "이름 업데이트 실패 (계속 진행)",
        { error: updateError.message }
      );
    }
  }

  // 1. 기본 정보 업데이트
  const grade =
    String(formData.get("grade") ?? "").trim() || existingStudent.grade || "";
  const schoolId = String(formData.get("school_id") ?? "").trim() || null;
  const birthDate =
    String(formData.get("birth_date") ?? "").trim() ||
    existingStudent.birth_date ||
    null;

  // name이 없으면 기존 값 또는 user_metadata의 display_name 사용
  let nameValue = name || null;
  if (!nameValue) {
    nameValue =
      existingStudent.name || user.user_metadata?.display_name || null;
  }

  const klass = String(formData.get("class") ?? "").trim() || existingStudent.class || "";
  const divisionRaw = String(formData.get("division") ?? "").trim() || null;
  const division = (divisionRaw === "고등부" || divisionRaw === "중등부" || divisionRaw === "졸업")
    ? (divisionRaw as StudentDivision)
    : null;

  const basicResult = await upsertStudent({
    id: user.id,
    tenant_id: existingStudent.tenant_id ?? null,
    name: nameValue,
    grade,
    class: klass,
    birth_date: birthDate,
    school_id: schoolId,
    division,
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

  const address = String(formData.get("address") ?? "").trim() || null;

  // 3. 진로 목표 정보 파싱
  // exam_year / curriculum_revision은 grade에서 자동 산출
  const gradeStr = String(formData.get("grade") ?? "").trim();
  let examYear: number | null = null;
  let curriculumRevision: string | null = null;
  if (gradeStr) {
    const { getStudentExamTimeline } = await import("@/lib/utils/studentProfile");
    const schoolTypeRaw = formData.get("school_type") as string | null;
    const schoolTypeForTimeline = schoolTypeRaw === "MIDDLE" || schoolTypeRaw === "중학교" ? "중학교" : "고등학교";
    const timeline = getStudentExamTimeline(
      gradeStr,
      schoolTypeForTimeline,
    );
    if (timeline) {
      examYear = timeline.examYear;
      curriculumRevision = timeline.curriculumRevision;
    }
  }

  const desiredUniversityIds = formData
    .getAll("desired_university_ids")
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  const desiredCareerField =
    (formData.get("desired_career_field") as CareerField | null) || null;

  const targetMajor =
    (formData.get("target_major") as string | null) || null;

  const targetSubRaw = formData.get("target_sub_classification_id") as string | null;
  const targetSubClassificationId = targetSubRaw ? parseInt(targetSubRaw, 10) : null;

  const targetSchoolTier =
    (formData.get("target_school_tier") as string | null) || null;

  // 프로필 + 진로 정보 UPDATE
  // phone은 user_profiles에서 관리
  if (phone !== null || phoneRaw === "") {
    await supabase.from("user_profiles").update({ phone }).eq("id", user.id);
  }

  // mother_phone/father_phone → parent_student_links + user_profiles (ghost parent)
  const { data: studentRow } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  const tenantId = studentRow?.tenant_id;

  if (tenantId) {
    const { upsertParentContact } = await import("@/lib/utils/studentPhoneUtils");
    if (motherPhone) {
      await upsertParentContact(supabase, user.id, tenantId, "mother", motherPhone);
    } else if (motherPhoneRaw === "") {
      // 빈 문자열 → 기존 link의 parent phone을 null로 설정
      const { data: existingLink } = await supabase
        .from("parent_student_links")
        .select("parent_id")
        .eq("student_id", user.id)
        .eq("relation", "mother")
        .maybeSingle();
      if (existingLink) {
        await supabase.from("user_profiles").update({ phone: null }).eq("id", existingLink.parent_id);
      }
    }
    if (fatherPhone) {
      await upsertParentContact(supabase, user.id, tenantId, "father", fatherPhone);
    } else if (fatherPhoneRaw === "") {
      const { data: existingLink } = await supabase
        .from("parent_student_links")
        .select("parent_id")
        .eq("student_id", user.id)
        .eq("relation", "father")
        .maybeSingle();
      if (existingLink) {
        await supabase.from("user_profiles").update({ phone: null }).eq("id", existingLink.parent_id);
      }
    }
  }

  // students 테이블에는 phone/mother_phone/father_phone 이외의 필드만 업데이트
  const updatePayload: Record<string, unknown> = {
    gender,
    address,
    exam_year: examYear,
    curriculum_revision: curriculumRevision,
    desired_university_ids: desiredUniversityIds.length > 0 ? desiredUniversityIds : [],
    desired_career_field: desiredCareerField,
    target_major: targetMajor,
    target_sub_classification_id: targetSubClassificationId,
    target_school_tier: targetSchoolTier,
  };

  const { error: updateError } = await supabase
    .from("students")
    .update(updatePayload)
    .eq("id", user.id);

  if (updateError) {
    logActionError(
      { domain: "student", action: "updateStudentProfile", userId: user.id },
      updateError,
      { step: "profile/career update" }
    );
    return { success: false, error: updateError.message || "프로필 업데이트에 실패했습니다." };
  }

  return { success: true };
}

/**
 * 현재 로그인한 학생 정보 조회
 * students + user_profiles(phone) + parent_student_links(학부모 phone)
 */
export async function getCurrentStudent(): Promise<
  | (Student &
      Partial<StudentProfile> &
      Partial<StudentCareerGoal> & { desired_career_field?: string | null })
  | null
> {
  const user = await getCachedAuthUser();
  const supabase = await createSupabaseServerClient();

  if (!user) {
    return null;
  }

  // students + user_profiles(phone) + parent_student_links(학부모 phone) 병렬 조회
  const [studentResult, profileResult, linksResult] = await Promise.all([
    supabase.from("students").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_profiles").select("phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("parent_student_links")
      .select("relation, parent:user_profiles!parent_student_links_parent_id_fkey(phone)")
      .eq("student_id", user.id),
  ]);

  if (studentResult.error || !studentResult.data) {
    return null;
  }

  const student = studentResult.data;

  // 학부모 전화번호 추출
  let motherPhone: string | null = null;
  let fatherPhone: string | null = null;

  if (linksResult.data) {
    for (const link of linksResult.data) {
      const parentRaw = link.parent as unknown;
      const parent = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
      const phone = (parent as { phone: string | null } | null)?.phone;
      if (!phone) continue;

      if (link.relation === "mother" && !motherPhone) {
        motherPhone = phone;
      } else if (link.relation === "father" && !fatherPhone) {
        fatherPhone = phone;
      }
    }
  }

  // 이름은 user_metadata에서 가져오기
  const name = user.user_metadata?.display_name as string | undefined;

  return {
    ...student,
    student_id: student.id,
    name: name || student.name || null,
    phone: profileResult.data?.phone ?? null,
    mother_phone: motherPhone,
    father_phone: fatherPhone,
    notes: student.career_notes,
    desired_career_field: student.desired_career_field || null,
  } as Student & Partial<StudentProfile> & Partial<StudentCareerGoal> & { desired_career_field?: string | null };
}
