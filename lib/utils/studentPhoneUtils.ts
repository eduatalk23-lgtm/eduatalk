import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError } from "@/lib/logging/actionLogger";

export type StudentPhoneData = {
  id: string;
  name: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  mother_phone_source?: "linked_account" | "student_profile" | null;
  father_phone_source?: "linked_account" | "student_profile" | null;
};

type ParentStudentLink = {
  student_id: string;
  relation: string | null;
  parent_id: string;
};

/**
 * 단일 학생의 전화번호 정보 조회
 */
export async function getStudentPhones(
  studentId: string
): Promise<StudentPhoneData | null> {
  const supabase = await createSupabaseServerClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, phone, mother_phone, father_phone")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return null;
  }

  return {
    id: student.id,
    name: student.name,
    phone: student.phone ?? null,
    mother_phone: student.mother_phone ?? null,
    father_phone: student.father_phone ?? null,
  };
}

/**
 * 여러 학생의 전화번호 정보 일괄 조회
 * user_profiles를 사용하여 학부모 전화번호 조회 (auth.admin.listUsers 제거)
 */
export async function getStudentPhonesBatch(
  studentIds: string[]
): Promise<StudentPhoneData[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const adminClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: true,
  });

  if (!adminClient) {
    throw new Error("Admin client를 초기화할 수 없습니다.");
  }

  // 1. students 테이블에서 기본 정보 + 전화번호 일괄 조회
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name, phone, mother_phone, father_phone")
    .in("id", studentIds);

  if (studentsError || !students) {
    logActionError(
      { domain: "utils", action: "getStudentPhonesBatch" },
      studentsError,
      { context: "students 조회", studentIdsCount: studentIds.length }
    );
    return [];
  }

  // 2. parent_student_links → user_profiles JOIN으로 학부모 전화번호 조회
  //    (기존: auth.admin.listUsers() 전체 유저 로드 → 필터)
  const linkedParentPhones: Map<string, {
    mother?: { phone: string; parentId: string };
    father?: { phone: string; parentId: string };
  }> = new Map();

  try {
    const { data: links, error: linksError } = await adminClient
      .from("parent_student_links")
      .select("student_id, relation, parent_id")
      .in("student_id", studentIds);

    if (linksError) {
      logActionError(
        { domain: "utils", action: "getStudentPhonesBatch" },
        linksError,
        { context: "parent_student_links 조회" }
      );
    } else if (links && links.length > 0) {
      // user_profiles에서 학부모 전화번호 조회 (auth.admin.listUsers 대체)
      const parentIds = Array.from(new Set((links as ParentStudentLink[]).map((link) => link.parent_id)));

      const { data: parentProfiles } = await adminClient
        .from("user_profiles")
        .select("id, phone")
        .in("id", parentIds);

      const parentPhonesMap = new Map<string, string | null>();
      if (parentProfiles) {
        for (const p of parentProfiles) {
          if (p.phone) parentPhonesMap.set(p.id, p.phone);
        }
      }

      // student_id별로 mother/father 연락처 정리
      (links as ParentStudentLink[]).forEach((link) => {
        const studentId = link.student_id;
        const relation = link.relation;
        const parentId = link.parent_id;
        const phone = parentPhonesMap.get(parentId);

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
  }

  // 3. 결과 병합
  return students.map((student) => {
    const linkedParents = linkedParentPhones.get(student.id);

    const motherPhone = linkedParents?.mother?.phone ?? student.mother_phone ?? null;
    const motherPhoneSource: "linked_account" | "student_profile" | null =
      linkedParents?.mother?.phone ? "linked_account" : student.mother_phone ? "student_profile" : null;

    const fatherPhone = linkedParents?.father?.phone ?? student.father_phone ?? null;
    const fatherPhoneSource: "linked_account" | "student_profile" | null =
      linkedParents?.father?.phone ? "linked_account" : student.father_phone ? "student_profile" : null;

    return {
      id: student.id,
      name: student.name,
      phone: student.phone ?? null,
      mother_phone: motherPhone,
      father_phone: fatherPhone,
      mother_phone_source: motherPhoneSource,
      father_phone_source: fatherPhoneSource,
    };
  });
}
