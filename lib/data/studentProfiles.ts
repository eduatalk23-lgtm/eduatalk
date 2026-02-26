/**
 * Student Profile 데이터 접근 레이어
 *
 * student_profiles 테이블이 students로 통합되었으므로
 * 모든 함수가 students 테이블을 직접 조회/수정합니다.
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

const PROFILE_FIELDS =
  "id,tenant_id,gender,phone,profile_image_url,mother_phone,father_phone,address,address_detail,postal_code,emergency_contact,emergency_contact_phone,medical_info,bio,interests,created_at,updated_at";

/**
 * 학생 ID로 프로필 정보 조회 (students 테이블에서 직접 조회)
 */
export async function getStudentProfileById(
  studentId: string
): Promise<StudentProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("students")
    .select(PROFILE_FIELDS)
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    handleQueryError(error, {
      context: "[data/studentProfiles] getStudentProfileById",
    });
    return null;
  }

  return (data as StudentProfile | null) ?? null;
}

/**
 * 프로필 정보 업데이트 (students 테이블 직접 UPDATE)
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

  // 명시적으로 전달된 필드만 payload에 포함 (undefined 필드는 기존 값 보존)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {};

  const optionalFields = [
    "gender", "phone", "profile_image_url",
    "mother_phone", "father_phone", "address", "address_detail",
    "postal_code", "emergency_contact", "emergency_contact_phone",
    "medical_info", "bio", "interests",
  ] as const;

  for (const field of optionalFields) {
    if (profile[field] !== undefined) {
      payload[field] = profile[field] ?? null;
    }
  }

  if (Object.keys(payload).length === 0) {
    return { success: true };
  }

  const { error } = await adminClient
    .from("students")
    .update(payload)
    .eq("id", profile.id);

  if (error) {
    handleQueryError(error, {
      context: "[data/studentProfiles] upsertStudentProfile",
    });
    return { success: false, error: error.message };
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

  // 누락된 학생은 null로 설정
  studentIds.forEach((id) => {
    if (!genderMap.has(id)) {
      genderMap.set(id, null);
    }
  });

  return genderMap;
}





