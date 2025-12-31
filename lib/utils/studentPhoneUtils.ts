import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError } from "@/lib/logging/actionLogger";

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

// parent_student_links 테이블 조회 결과 타입
type ParentStudentLink = {
  student_id: string;
  relation: string | null;
  parent_id: string;
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
  
  // RLS 우회가 필요한 쿼리를 위한 Admin Client (student_profiles는 RLS 정책이 없을 수 있음)
  const adminClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: true,
  });

  // 1. students 테이블에서 기본 정보 일괄 조회
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name")
    .in("id", studentIds);

  if (studentsError || !students) {
    logActionError(
      { domain: "utils", action: "getStudentPhonesBatch" },
      studentsError,
      { context: "students 조회", studentIdsCount: studentIds.length }
    );
    return [];
  }

  // 2. student_profiles 테이블에서 전화번호 일괄 조회 (RLS 우회를 위해 Admin Client 사용)
  let profiles: Array<{
    id: string;
    phone?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
  }> = [];

  if (!adminClient) {
    throw new Error("Admin client를 초기화할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.");
  }

  const { data: profilesData, error: profilesError } = await adminClient
    .from("student_profiles")
    .select("id, phone, mother_phone, father_phone")
    .in("id", studentIds);

  if (profilesError) {
    logActionError(
      { domain: "utils", action: "getStudentPhonesBatch" },
      profilesError,
      { context: "student_profiles 조회" }
    );
    // 에러가 있어도 계속 진행 (학부모 연결 정보로 보완 가능)
  } else if (profilesData) {
    profiles = profilesData;
  }

  // 3. parent_student_links를 통해 연결된 학부모 정보 조회 (RLS 우회를 위해 Admin Client 사용)
  const linkedParentPhones: Map<string, {
    mother?: { phone: string; parentId: string };
    father?: { phone: string; parentId: string };
  }> = new Map();

  try {
    const { data: links, error: linksError } = await adminClient
      .from("parent_student_links")
      .select(`
        student_id,
        relation,
        parent_id
      `)
      .in("student_id", studentIds);

    if (linksError) {
      logActionError(
        { domain: "utils", action: "getStudentPhonesBatch" },
        linksError,
        { context: "parent_student_links 조회" }
      );
    } else if (links && links.length > 0) {
      // 연결된 학부모 ID 수집
      const parentIds = Array.from(new Set((links as ParentStudentLink[]).map((link) => link.parent_id)));

      // Admin 클라이언트를 사용하여 auth.users에서 phone 조회
      const adminClient = createSupabaseAdminClient();
      const parentPhonesMap = new Map<string, string | null>();

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
          logActionError(
            { domain: "utils", action: "getStudentPhonesBatch" },
            error,
            { context: "auth.users phone 조회" }
          );
          // 에러가 있어도 계속 진행 (student_profiles 정보로 보완 가능)
        }
      }

      // student_id별로 mother/father 연락처 정리
      (links as ParentStudentLink[]).forEach((link) => {
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
    }
  } catch (error) {
    logActionError(
      { domain: "utils", action: "getStudentPhonesBatch" },
      error,
      { context: "parent_student_links 처리" }
    );
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
      mother_phone_source: motherPhoneSource as "linked_account" | "student_profile" | null | undefined,
      father_phone_source: fatherPhoneSource as "linked_account" | "student_profile" | null | undefined,
    };
  });

  return result;
}

