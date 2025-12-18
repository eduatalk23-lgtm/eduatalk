import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StudentPhoneData = {
  id: string;
  name: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  // 데이터 소스 정보 (디버깅/로깅용, 선택사항)
  mother_phone_source?: "linked_account" | "student_profile" | null;
  father_phone_source?: "linked_account" | "student_profile" | null;
};

/**
 * 단일 학생의 전화번호 정보 조회
 * students 테이블과 student_profiles 테이블을 조인하여 조회
 */
export async function getStudentPhones(
  studentId: string
): Promise<StudentPhoneData | null> {
  const supabase = await createSupabaseServerClient();

  // 1. students 테이블에서 기본 정보 조회
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return null;
  }

  // 2. student_profiles 테이블에서 전화번호 조회
  let profile: {
    phone?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
  } | null = null;
  try {
    const { data: profileData } = await supabase
      .from("student_profiles")
      .select("phone, mother_phone, father_phone")
      .eq("id", studentId)
      .maybeSingle();

    profile = profileData;
  } catch {
    // student_profiles 테이블이 없거나 조회 실패 시 무시
  }

  // 3. 결과 병합 (student_profiles 우선)
  return {
    id: student.id,
    name: student.name,
    phone: profile?.phone ?? null,
    mother_phone: profile?.mother_phone ?? null,
    father_phone: profile?.father_phone ?? null,
  };
}

/**
 * 여러 학생의 전화번호 정보 일괄 조회
 * parent_student_links (학부모 계정) 우선, 단 users.phone이 null이면 student_profiles (학생 입력) 사용
 */
export async function getStudentPhonesBatch(
  studentIds: string[]
): Promise<StudentPhoneData[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // 1. students 테이블에서 기본 정보 일괄 조회
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name")
    .in("id", studentIds);

  if (studentsError || !students) {
    console.error("[studentPhoneUtils] students 조회 실패", studentsError);
    return [];
  }

  // 2. student_profiles 테이블에서 전화번호 일괄 조회 (fallback 데이터)
  let profiles: Array<{
    id: string;
    phone?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
  }> = [];

  const { data: profilesData, error: profilesError } = await supabase
    .from("student_profiles")
    .select("id, phone, mother_phone, father_phone")
    .in("id", studentIds);

  if (profilesError) {
    console.error("[studentPhoneUtils] student_profiles 조회 실패", profilesError);
    // 에러가 있어도 계속 진행 (학부모 연결 정보로 보완 가능)
  } else if (profilesData) {
    profiles = profilesData;
    console.log("[studentPhoneUtils] student_profiles 조회 성공:", {
      count: profiles.length,
      withPhone: profiles.filter((p) => p.phone || p.mother_phone || p.father_phone).length,
    });
  } else {
    console.log("[studentPhoneUtils] student_profiles 데이터 없음");
  }

  // 3. parent_student_links를 통해 연결된 학부모 정보 조회
  let linkedParentPhones: Map<string, {
    mother?: { phone: string; parentId: string };
    father?: { phone: string; parentId: string };
  }> = new Map();

  try {
    const { data: links, error: linksError } = await supabase
      .from("parent_student_links")
      .select(`
        student_id,
        relation,
        parent_id
      `)
      .in("student_id", studentIds);

    if (linksError) {
      console.error("[studentPhoneUtils] parent_student_links 조회 실패", linksError);
    } else if (links && links.length > 0) {
      // 연결된 학부모 ID 수집
      const parentIds = Array.from(new Set(links.map((link: any) => link.parent_id)));

      // Admin 클라이언트를 사용하여 auth.users에서 phone 조회
      const adminClient = createSupabaseAdminClient();
      let parentPhonesMap = new Map<string, string | null>();

      if (adminClient && parentIds.length > 0) {
        try {
          const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers();

          if (!authError && authUsers?.users) {
            // parent_id와 매칭되는 phone 정보 수집
            authUsers.users.forEach((user) => {
              if (parentIds.includes(user.id) && user.phone) {
                parentPhonesMap.set(user.id, user.phone);
              }
            });
          }
        } catch (error) {
          console.error("[studentPhoneUtils] auth.users phone 조회 실패", error);
          // 에러가 있어도 계속 진행 (student_profiles 정보로 보완 가능)
        }
      }

      // student_id별로 mother/father 연락처 정리
      links.forEach((link: any) => {
        const studentId = link.student_id;
        const relation = link.relation;
        const parentId = link.parent_id;
        const phone = parentPhonesMap.get(parentId);

        // phone이 null이 아닐 때만 사용
        if (!phone) return;

        if (!linkedParentPhones.has(studentId)) {
          linkedParentPhones.set(studentId, {});
        }

        const current = linkedParentPhones.get(studentId)!;
        if (relation === "mother" && !current.mother) {
          current.mother = { phone, parentId };
        } else if (relation === "father" && !current.father) {
          current.father = { phone, parentId };
        }
      });

      console.log("[studentPhoneUtils] parent_student_links 처리 완료:", {
        linksCount: links.length,
        linkedParentsCount: linkedParentPhones.size,
        parentPhonesMapSize: parentPhonesMap.size,
      });
    }
  } catch (error) {
    console.error("[studentPhoneUtils] parent_student_links 처리 중 오류", error);
    // 에러가 있어도 계속 진행 (student_profiles 정보로 보완 가능)
  }

  // 4. 결과 병합
  // - 학부모 계정의 phone이 null이 아닐 때만 사용
  // - null이거나 없으면 student_profiles 사용
  const result = students.map((student) => {
    const profile = profiles.find((p) => p.id === student.id);
    const linkedParents = linkedParentPhones.get(student.id);

    // 모 연락처: 연결된 계정의 phone이 null이 아닐 때만 사용, 아니면 student_profiles
    const motherPhone = (linkedParents?.mother?.phone && linkedParents.mother.phone !== null)
      ? linkedParents.mother.phone
      : profile?.mother_phone ?? null;
    const motherPhoneSource = (linkedParents?.mother?.phone && linkedParents.mother.phone !== null)
      ? "linked_account"
      : profile?.mother_phone
        ? "student_profile"
        : null;

    // 부 연락처: 연결된 계정의 phone이 null이 아닐 때만 사용, 아니면 student_profiles
    const fatherPhone = (linkedParents?.father?.phone && linkedParents.father.phone !== null)
      ? linkedParents.father.phone
      : profile?.father_phone ?? null;
    const fatherPhoneSource = (linkedParents?.father?.phone && linkedParents.father.phone !== null)
      ? "linked_account"
      : profile?.father_phone
        ? "student_profile"
        : null;

    return {
      id: student.id,
      name: student.name,
      phone: profile?.phone ?? null,
      mother_phone: motherPhone,
      father_phone: fatherPhone,
      mother_phone_source: motherPhoneSource,
      father_phone_source: fatherPhoneSource,
    };
  });

  // 디버깅: 연락처 정보가 있는 학생 수 확인
  const studentsWithPhone = result.filter((r) => r.phone || r.mother_phone || r.father_phone);
  console.log("[studentPhoneUtils] 연락처 정보 조회 결과:", {
    total: result.length,
    withPhone: studentsWithPhone.length,
    profilesCount: profiles.length,
    linkedParentsCount: linkedParentPhones.size,
  });

  return result;
}

