import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

/**
 * 학생 ID로 프로필 정보 조회
 */
export async function getStudentProfileById(
  studentId: string
): Promise<StudentProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("id", studentId)
    .maybeSingle<StudentProfile>();

  if (error && error.code !== "PGRST116") {
    console.error("[data/studentProfiles] 프로필 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * 프로필 정보 생성/업데이트
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
  const supabase = await createSupabaseServerClient();

  const payload = {
    id: profile.id,
    tenant_id: profile.tenant_id ?? null,
    gender: profile.gender ?? null,
    phone: profile.phone ?? null,
    profile_image_url: profile.profile_image_url ?? null,
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
  };

  const { error } = await supabase
    .from("student_profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    console.error("[data/studentProfiles] 프로필 저장 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 여러 학생의 성별 정보 일괄 조회
 */
export async function getStudentGendersBatch(
  studentIds: string[]
): Promise<Map<string, "남" | "여" | null>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();

  const { data: profiles, error } = await adminClient
    .from("student_profiles")
    .select("id, gender")
    .in("id", studentIds);

  if (error) {
    console.error("[data/studentProfiles] 성별 조회 실패", error);
    return new Map();
  }

  const genderMap = new Map<string, "남" | "여" | null>();
  profiles?.forEach((p) => {
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





