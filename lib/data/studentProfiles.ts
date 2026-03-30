/**
 * Student Profile 데이터 접근 레이어
 *
 * 공통 필드(phone, profile_image_url)는 user_profiles에서,
 * 학생 고유 필드(gender 등)는 students에서 조회합니다.
 * 학부모 연락처(mother_phone, father_phone)는 parent_student_links → user_profiles에서 조회합니다.
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

/** students 고유 필드 (mother_phone, father_phone은 parent_student_links에서 조회) */
const STUDENT_PROFILE_FIELDS =
  "id,tenant_id,gender,address,address_detail,postal_code,emergency_contact,emergency_contact_phone,medical_info,bio,interests,created_at,updated_at";

/**
 * 학생 ID로 프로필 정보 조회
 * students(고유 필드) + user_profiles(phone, profile_image_url)
 * + parent_student_links → user_profiles(학부모 phone) 병렬 조회
 */
export async function getStudentProfileById(
  studentId: string
): Promise<StudentProfile | null> {
  const supabase = await createSupabaseServerClient();

  const [studentResult, profileResult, linksResult] = await Promise.all([
    supabase.from("students").select(STUDENT_PROFILE_FIELDS).eq("id", studentId).maybeSingle(),
    supabase.from("user_profiles").select("phone, profile_image_url").eq("id", studentId).maybeSingle(),
    supabase
      .from("parent_student_links")
      .select("relation, parent:user_profiles!parent_student_links_parent_id_fkey(phone)")
      .eq("student_id", studentId),
  ]);

  if (studentResult.error) {
    handleQueryError(studentResult.error, {
      context: "[data/studentProfiles] getStudentProfileById",
    });
    return null;
  }

  if (!studentResult.data) return null;

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

  return {
    ...studentResult.data,
    phone: profileResult.data?.phone ?? null,
    profile_image_url: profileResult.data?.profile_image_url ?? null,
    mother_phone: motherPhone,
    father_phone: fatherPhone,
  } as StudentProfile;
}

/**
 * 프로필 정보 업데이트
 * phone, profile_image_url → user_profiles
 * mother_phone, father_phone → parent_student_links + user_profiles (ghost parent)
 * 나머지 → students
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
  const profilePayload: Record<string, unknown> = {};
  const studentPayload: Record<string, unknown> = {};

  const userProfileFields = ["phone", "profile_image_url"] as const;
  const studentFields = [
    "gender", "address", "address_detail",
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

  // 병렬 업데이트 (user_profiles + students)
  const promises: Promise<{ error: string | null }>[] = [];

  if (Object.keys(profilePayload).length > 0) {
    promises.push((async () => {
      const { error } = await adminClient.from("user_profiles").update(profilePayload).eq("id", profile.id);
      return { error: error?.message ?? null };
    })());
  }
  if (Object.keys(studentPayload).length > 0) {
    promises.push((async () => {
      const { error } = await adminClient.from("students").update(studentPayload).eq("id", profile.id);
      return { error: error?.message ?? null };
    })());
  }

  // mother_phone/father_phone → parent_student_links + user_profiles (ghost parent)
  if (profile.mother_phone !== undefined || profile.father_phone !== undefined) {
    // tenant_id 조회 (ghost parent 생성에 필요)
    let tenantId = profile.tenant_id;
    if (!tenantId) {
      const { data: studentRow } = await adminClient
        .from("students")
        .select("tenant_id")
        .eq("id", profile.id)
        .maybeSingle();
      tenantId = studentRow?.tenant_id ?? null;
    }

    if (tenantId) {
      const { upsertParentContact } = await import("@/lib/utils/studentPhoneUtils");
      if (profile.mother_phone !== undefined) {
        if (profile.mother_phone) {
          promises.push(
            (async () => { await upsertParentContact(adminClient, profile.id, tenantId, "mother", profile.mother_phone!); return { error: null }; })()
          );
        } else {
          // null인 경우 기존 link의 parent phone을 null로 설정
          const { data: existingLink } = await adminClient
            .from("parent_student_links")
            .select("parent_id")
            .eq("student_id", profile.id)
            .eq("relation", "mother")
            .maybeSingle();
          if (existingLink) {
            promises.push((async () => { const { error } = await adminClient.from("user_profiles").update({ phone: null }).eq("id", existingLink.parent_id); return { error: error?.message ?? null }; })());
          }
        }
      }
      if (profile.father_phone !== undefined) {
        if (profile.father_phone) {
          promises.push(
            (async () => { await upsertParentContact(adminClient, profile.id, tenantId, "father", profile.father_phone!); return { error: null }; })()
          );
        } else {
          const { data: existingLink } = await adminClient
            .from("parent_student_links")
            .select("parent_id")
            .eq("student_id", profile.id)
            .eq("relation", "father")
            .maybeSingle();
          if (existingLink) {
            promises.push((async () => { const { error } = await adminClient.from("user_profiles").update({ phone: null }).eq("id", existingLink.parent_id); return { error: error?.message ?? null }; })());
          }
        }
      }
    }
  }

  if (promises.length === 0) {
    return { success: true };
  }

  const results = await Promise.all(promises);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    return { success: false, error: firstError };
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
