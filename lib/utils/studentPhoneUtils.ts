/**
 * 학생/학부모 전화번호 조회·저장 유틸리티
 *
 * 단일 소스: parent_student_links → user_profiles.phone
 * 학생 본인 phone: user_profiles.phone
 * 학부모 phone: parent_student_links(relation) → user_profiles.phone
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError } from "@/lib/logging/actionLogger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentPhoneData = {
  id: string;
  name: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
};

/**
 * 단일 학생의 전화번호 정보 조회
 * user_profiles(본인) + parent_student_links→user_profiles(학부모) 2쿼리
 */
export async function getStudentPhones(
  studentId: string
): Promise<StudentPhoneData | null> {
  const supabase = await createSupabaseServerClient();

  // 학생 본인 정보 + 학부모 연결 병렬 조회
  const [profileResult, linksResult] = await Promise.all([
    supabase.from("user_profiles").select("id, name, phone").eq("id", studentId).maybeSingle(),
    supabase
      .from("parent_student_links")
      .select("relation, parent:user_profiles!parent_student_links_parent_id_fkey(phone)")
      .eq("student_id", studentId),
  ]);

  if (profileResult.error || !profileResult.data) {
    return null;
  }

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
    id: profileResult.data.id,
    name: profileResult.data.name,
    phone: profileResult.data.phone,
    mother_phone: motherPhone,
    father_phone: fatherPhone,
  };
}

/**
 * 여러 학생의 전화번호 정보 일괄 조회
 * user_profiles(본인) + parent_student_links→user_profiles(학부모) 2쿼리
 */
export async function getStudentPhonesBatch(
  studentIds: string[]
): Promise<StudentPhoneData[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const adminClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: true,
  });

  if (!adminClient) {
    throw new Error("Admin client를 초기화할 수 없습니다.");
  }

  // 1. 학생 프로필 + 학부모 연결 병렬 조회 (2쿼리)
  const [profilesResult, linksResult] = await Promise.all([
    adminClient.from("user_profiles").select("id, name, phone").in("id", studentIds),
    adminClient
      .from("parent_student_links")
      .select("student_id, relation, parent_id")
      .in("student_id", studentIds),
  ]);

  if (profilesResult.error || !profilesResult.data) {
    logActionError(
      { domain: "utils", action: "getStudentPhonesBatch" },
      profilesResult.error,
      { context: "user_profiles 조회", studentIdsCount: studentIds.length }
    );
    return [];
  }

  const profileMap = new Map(
    profilesResult.data.map((p) => [p.id, { name: p.name, phone: p.phone }])
  );

  // 2. 학부모 전화번호 조회 (parent_student_links → user_profiles)
  const parentPhoneMap = new Map<string, { mother: string | null; father: string | null }>();

  if (linksResult.data && linksResult.data.length > 0) {
    const parentIds = Array.from(new Set(linksResult.data.map((l) => l.parent_id)));

    const { data: parentProfiles } = await adminClient
      .from("user_profiles")
      .select("id, phone")
      .in("id", parentIds);

    const parentPhonesLookup = new Map<string, string | null>();
    if (parentProfiles) {
      for (const p of parentProfiles) {
        if (p.phone) parentPhonesLookup.set(p.id, p.phone);
      }
    }

    for (const link of linksResult.data) {
      const phone = parentPhonesLookup.get(link.parent_id) ?? null;
      if (!phone) continue;

      if (!parentPhoneMap.has(link.student_id)) {
        parentPhoneMap.set(link.student_id, { mother: null, father: null });
      }
      const entry = parentPhoneMap.get(link.student_id)!;
      if (link.relation === "mother" && !entry.mother) entry.mother = phone;
      else if (link.relation === "father" && !entry.father) entry.father = phone;
    }
  }

  // 3. 결과 매핑
  return studentIds.map((id) => {
    const profile = profileMap.get(id);
    const parents = parentPhoneMap.get(id);
    return {
      id,
      name: profile?.name ?? null,
      phone: profile?.phone ?? null,
      mother_phone: parents?.mother ?? null,
      father_phone: parents?.father ?? null,
    };
  });
}

/**
 * 학부모 연락처 저장 (ghost parent user_profiles + parent_student_links)
 *
 * 기존 link가 있으면 해당 parent의 phone을 업데이트,
 * 없으면 ghost parent user_profiles를 생성하고 link를 삽입.
 */
export async function upsertParentContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _supabase: SupabaseClient<any, any, any>,
  studentId: string,
  tenantId: string,
  relation: "mother" | "father",
  phone: string
): Promise<void> {
  // RLS bypass 클라이언트 사용 — 관리자가 ghost parent의 user_profiles를 INSERT할 때
  // user_profiles_insert_own 정책(auth.uid() = id)에 의해 차단되므로 admin 클라이언트 필요
  const supabase = await getSupabaseClientForRLSBypass();

  // 기존 link 조회
  const { data: existing } = await supabase
    .from("parent_student_links")
    .select("parent_id")
    .eq("student_id", studentId)
    .eq("relation", relation)
    .maybeSingle();

  if (existing) {
    // 기존 parent의 phone 업데이트
    const { error } = await supabase
      .from("user_profiles")
      .update({ phone })
      .eq("id", existing.parent_id);

    if (error) {
      console.error(`[upsertParentContact] ${relation} phone 업데이트 실패:`, error.message);
    }
  } else {
    // ghost parent 생성
    const parentId = crypto.randomUUID();
    const { error: profileError } = await supabase.from("user_profiles").insert({
      id: parentId,
      tenant_id: tenantId,
      role: "parent",
      name: "",
      phone,
    });

    if (profileError) {
      console.error(`[upsertParentContact] ghost parent 프로필 생성 실패:`, profileError.message);
      return;
    }

    const { error: linkError } = await supabase.from("parent_student_links").insert({
      id: crypto.randomUUID(),
      parent_id: parentId,
      student_id: studentId,
      relation,
      tenant_id: tenantId,
    });

    if (linkError) {
      console.error(`[upsertParentContact] parent_student_links 생성 실패:`, linkError.message);
    }
  }
}
