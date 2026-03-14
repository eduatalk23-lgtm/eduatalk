/**
 * Student Profile 데이터 접근 레이어
 *
 * 공통 필드(phone, profile_image_url)는 user_profiles에서,
 * 학생 고유 필드(gender, mother_phone 등)는 students에서 조회합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";

export type StudentProfile = {
  id: string;
  tenant_id?: string | null;
  gender?: "남" | "여" | null;
  phone?: string | null;
  profile_image_url?: string | null;
  mother_phone?: string | null;
  father_phone?: string | null;
  address?: string | null;
  address_detail?: string | null;
  postal_code?: string | null;
  emergency_contact?: string | null;
  emergency_contact_phone?: string | null;
  medical_info?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** students 고유 필드 */
const STUDENT_PROFILE_FIELDS =
  "id,tenant_id,gender,mother_phone,father_phone,address,address_detail,postal_code,emergency_contact,emergency_contact_phone,medical_info,bio,interests,created_at,updated_at";

/**
 * 학생 ID로 프로필 정보 조회
 * students(고유 필드) + user_profiles(phone, profile_image_url) 병렬 조회
 */
export async function getStudentProfileById(
  studentId: string
): Promise<StudentProfile | null> {
  const supabase = await createSupabaseServerClient();

  const [studentResult, profileResult] = await Promise.all([
    supabase.from("students").select(STUDENT_PROFILE_FIELDS).eq("id", studentId).maybeSingle(),
    supabase.from("user_profiles").select("phone, profile_image_url").eq("id", studentId).maybeSingle(),
  ]);

  if (studentResult.error) {
    handleQueryError(studentResult.error, {
      context: "[data/studentProfiles] getStudentProfileById",
    });
    return null;
  }

  if (!studentResult.data) return null;

  return {
    ...studentResult.data,
    phone: profileResult.data?.phone ?? null,
    profile_image_url: profileResult.data?.profile_image_url ?? null,
  } as StudentProfile;
}

/**
 * 프로필 정보 업데이트
 * phone, profile_image_url → user_profiles / 나머지 → students
 */
export async function upsertStudentProfile(
  profile: {
    id: string;
    tenant_id?: string | null;
    gender?: "남" | "여" | null;
    phone?: string | null;
    profile_image_url?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
    address?: string | null;
    address_detail?: string | null;
    postal_code?: string | null;
    emergency_contact?: string | null;
    emergency_contact_phone?: string | null;
    medical_info?: string | null;
    bio?: string | null;
    interests?: string[] | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    return { success: false, error: "Admin client를 초기화할 수 없습니다." };
  }

  // user_profiles 필드 분리
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profilePayload: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentPayload: Record<string, any> = {};

  const userProfileFields = ["phone", "profile_image_url"] as const;
  const studentFields = [
    "gender", "mother_phone", "father_phone", "address", "address_detail",
    "postal_code", "emergency_contact", "emergency_contact_phone",
    "medical_info", "bio", "interests",
  ] as const;

  for (const field of userProfileFields) {
    if (profile[field] !== undefined) {
      profilePayload[field] = profile[field] ?? null;
    }
  }

  for (const field of studentFields) {
    if (profile[field] !== undefined) {
      studentPayload[field] = profile[field] ?? null;
    }
  }

  // 병렬 업데이트
  if (Object.keys(profilePayload).length === 0 && Object.keys(studentPayload).length === 0) {
    return { success: true };
  }

  const [profileResult, studentResult] = await Promise.all([
    Object.keys(profilePayload).length > 0
      ? adminClient.from("user_profiles").update(profilePayload).eq("id", profile.id)
      : Promise.resolve({ error: null }),
    Object.keys(studentPayload).length > 0
      ? adminClient.from("students").update(studentPayload).eq("id", profile.id)
      : Promise.resolve({ error: null }),
  ]);

  const firstError = profileResult.error || studentResult.error;
  if (firstError) {
    handleQueryError(firstError as Parameters<typeof handleQueryError>[0], {
      context: "[data/studentProfiles] upsertStudentProfile",
    });
    return { success: false, error: (firstError as { message: string }).message };
  }

  return { success: true };
}

/**
 * 여러 학생의 성별 정보 일괄 조회 (students 테이블에서 직접 조회)
 */
export async function getStudentGendersBatch(
  studentIds: string[]
): Promise<Map<string, "남" | "여" | null>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    throw new Error("Admin client를 초기화할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.");
  }

  const { data, error } = await adminClient
    .from("students")
    .select("id, gender")
    .in("id", studentIds);

  if (error) {
    handleQueryError(error, {
      context: "[data/studentProfiles] getStudentGendersBatch",
    });
    return new Map();
  }

  const genderMap = new Map<string, "남" | "여" | null>();
  data?.forEach((p) => {
    genderMap.set(p.id, (p.gender as "남" | "여" | null) ?? null);
  });

  studentIds.forEach((id) => {
    if (!genderMap.has(id)) {
      genderMap.set(id, null);
    }
  });

  return genderMap;
}
