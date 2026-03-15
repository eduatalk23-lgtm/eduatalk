"use server";

/**
 * 멤버 탭용 Server Actions
 *
 * 테넌트 내 멤버 목록을 역할별로 조회합니다.
 * 역할에 따라 볼 수 있는 멤버 범위가 다릅니다:
 * - Admin: 팀(관리자/상담사) + 학생 + 학부모 전체
 * - Student: 팀 + 자신의 연결 학부모
 * - Parent: 팀 + 자신의 연결 자녀
 */

import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserType, type ChatActionResult, type ChatUserType } from "../types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const SCHOOL_TYPE_PREFIX: Record<string, string> = {
  ELEMENTARY: "초",
  MIDDLE: "중",
  HIGH: "고",
};

function formatGradeLabel(schoolType: string | null, grade: number | null): string | null {
  if (!grade) return null;
  const prefix = schoolType ? SCHOOL_TYPE_PREFIX[schoolType] : null;
  return prefix ? `${prefix}${grade}` : `${grade}학년`;
}

// ============================================
// 타입 정의
// ============================================

/** 멤버 역할 필터 */
export type MemberRoleFilter = "all" | "team" | "student" | "parent" | "children";

/** 연결된 학부모 정보 */
export interface LinkedParentInfo {
  id: string;
  name: string;
  relation: string;
}

/** 멤버 목록 아이템 */
export interface MemberListItem {
  userId: string;
  userType: ChatUserType;
  name: string;
  profileImageUrl?: string | null;
  schoolName?: string | null;
  gradeDisplay?: string | null;
  /** 관리자/상담사 역할 (team 멤버만) */
  adminRole?: string | null;
  /** 연결된 학부모 (학생 프로필 카드에서 표시, admin 조회 시만) */
  linkedParents?: LinkedParentInfo[];
  /** 학부모-학생 관계 (parent 타입일 때, 학생 시점에서 표시) */
  relation?: string;
}

/** 멤버 목록 응답 */
export interface MemberListResponse {
  members: MemberListItem[];
  /** 현재 사용자가 볼 수 있는 필터 목록 */
  availableFilters: MemberRoleFilter[];
}

// ============================================
// 메인 액션
// ============================================

/**
 * 테넌트 멤버 목록 조회 (멤버 탭용)
 */
export async function getTenantMembersAction(
  filter: MemberRoleFilter = "all"
): Promise<ChatActionResult<MemberListResponse>> {
  try {
    const { userId, role, tenantId } = await getCachedUserRole();

    if (!userId || !role || !tenantId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);
    const supabase = await createSupabaseServerClient();

    let members: MemberListItem[] = [];
    let availableFilters: MemberRoleFilter[] = ["all"];

    switch (userType) {
      case "admin": {
        availableFilters = ["all", "team", "student", "parent"];
        members = await getAdminViewMembers(supabase, tenantId, userId, filter);
        break;
      }
      case "student": {
        availableFilters = ["all", "team", "parent"];
        members = await getStudentViewMembers(supabase, tenantId, userId, filter);
        break;
      }
      case "parent": {
        availableFilters = ["all", "team", "children"];
        members = await getParentViewMembers(supabase, userId, filter);
        break;
      }
    }

    return { success: true, data: { members, availableFilters } };
  } catch (error) {
    console.error("[getTenantMembersAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "멤버 목록 조회 실패",
    };
  }
}

// ============================================
// 역할별 멤버 조회 함수
// ============================================

type SupabaseClient = SupabaseServerClient;

/** Admin: 팀 + 학생 + 학부모 전체 */
async function getAdminViewMembers(
  supabase: SupabaseClient,
  tenantId: string,
  currentUserId: string,
  filter: MemberRoleFilter
): Promise<MemberListItem[]> {
  const results: MemberListItem[] = [];

  // 팀 멤버 (관리자/상담사) — user_profiles 기반
  if (filter === "all" || filter === "team") {
    const { data: teamMembers, error } = await supabase
      .from("user_profiles")
      .select("id, name, role, profile_image_url")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("role", ["admin", "consultant"])
      .neq("id", currentUserId)
      .order("name");

    if (error) throw new Error(`팀 멤버 조회 실패: ${error.message}`);
    if (teamMembers) {
      results.push(
        ...teamMembers.map((m: { id: string; name: string; role: string; profile_image_url: string | null }) => ({
          userId: m.id,
          userType: "admin" as ChatUserType,
          name: m.name,
          profileImageUrl: m.profile_image_url,
          adminRole: m.role,
        }))
      );
    }
  }

  // 학생 — user_profiles JOIN으로 name, is_active, profile_image_url 조회
  if (filter === "all" || filter === "student") {
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, school_name, grade, school_type, user_profiles!inner(name, is_active, profile_image_url)")
      .eq("tenant_id", tenantId)
      .eq("user_profiles.is_active", true)
      .order("user_profiles(name)");

    if (studentsError) throw new Error(`학생 조회 실패: ${studentsError.message}`);
    if (students && students.length > 0) {
      // 학생별 연결 학부모 일괄 조회
      const studentIds = students.map((s: { id: string }) => s.id);
      const { data: parentLinks } = await supabase
        .from("parent_student_links")
        .select("student_id, relation, parent:user_profiles!parent_student_links_parent_id_fkey(id, name)")
        .in("student_id", studentIds);

      // 학생ID → 학부모 목록 맵
      const parentMap = new Map<string, LinkedParentInfo[]>();
      if (parentLinks) {
        for (const link of parentLinks) {
          const parentRaw = link.parent as unknown;
          const parent = Array.isArray(parentRaw) ? parentRaw[0] as { id: string; name: string } | undefined : parentRaw as { id: string; name: string } | null;
          if (!parent) continue;
          const list = parentMap.get(link.student_id) ?? [];
          list.push({ id: parent.id, name: parent.name, relation: link.relation });
          parentMap.set(link.student_id, list);
        }
      }

      results.push(
        ...students.map((s) => {
          const up = s.user_profiles as unknown as { name: string; is_active: boolean; profile_image_url: string | null };
          return {
            userId: s.id,
            userType: "student" as ChatUserType,
            name: up.name,
            profileImageUrl: up.profile_image_url,
            schoolName: s.school_name,
            gradeDisplay: formatGradeLabel(s.school_type, s.grade),
            linkedParents: parentMap.get(s.id) ?? [],
          };
        })
      );
    }
  }

  // 학부모 — user_profiles 기반
  if (filter === "all" || filter === "parent") {
    const { data: parents, error: parentsError } = await supabase
      .from("user_profiles")
      .select("id, name, profile_image_url")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("role", "parent")
      .order("name");

    if (parentsError) throw new Error(`학부모 조회 실패: ${parentsError.message}`);
    if (parents) {
      results.push(
        ...parents.map((p: { id: string; name: string; profile_image_url: string | null }) => ({
          userId: p.id,
          userType: "parent" as ChatUserType,
          name: p.name,
          profileImageUrl: p.profile_image_url,
        }))
      );
    }
  }

  return results;
}

/** Student: 팀 + 자신의 연결 학부모 */
async function getStudentViewMembers(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  filter: MemberRoleFilter
): Promise<MemberListItem[]> {
  const results: MemberListItem[] = [];

  // 팀 멤버 — user_profiles 기반
  if (filter === "all" || filter === "team") {
    const { data: teamMembers, error } = await supabase
      .from("user_profiles")
      .select("id, name, role, profile_image_url")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("role", ["admin", "consultant"])
      .order("name");

    if (error) throw new Error(`팀 멤버 조회 실패: ${error.message}`);
    if (teamMembers) {
      results.push(
        ...teamMembers.map((m: { id: string; name: string; role: string; profile_image_url: string | null }) => ({
          userId: m.id,
          userType: "admin" as ChatUserType,
          name: m.name,
          profileImageUrl: m.profile_image_url,
          adminRole: m.role,
        }))
      );
    }
  }

  // 연결된 학부모
  if (filter === "all" || filter === "parent") {
    const { data: parentLinks } = await supabase
      .from("parent_student_links")
      .select("relation, parent:user_profiles!parent_student_links_parent_id_fkey(id, name, profile_image_url)")
      .eq("student_id", studentId);

    if (parentLinks) {
      for (const link of parentLinks) {
        const parentRaw = link.parent as unknown;
        const parent = Array.isArray(parentRaw) ? parentRaw[0] as { id: string; name: string; profile_image_url: string | null } | undefined : parentRaw as { id: string; name: string; profile_image_url: string | null } | null;
        if (!parent) continue;
        results.push({
          userId: parent.id,
          userType: "parent",
          name: parent.name,
          profileImageUrl: parent.profile_image_url,
          relation: link.relation,
        });
      }
    }
  }

  return results;
}

/** Parent: 팀 + 자신의 연결 자녀 */
async function getParentViewMembers(
  supabase: SupabaseClient,
  parentId: string,
  filter: MemberRoleFilter
): Promise<MemberListItem[]> {
  const results: MemberListItem[] = [];

  // 연결된 자녀 정보 조회 (tenantId 확보 용도) — name, profile_image_url은 user_profiles에서
  const { data: childLinks } = await supabase
    .from("parent_student_links")
    .select("relation, student:students(id, school_name, grade, school_type, tenant_id, user_profiles(name, profile_image_url))")
    .eq("parent_id", parentId);

  const tenantIds = new Set<string>();
  if (childLinks) {
    for (const link of childLinks) {
      const studentRaw = link.student as unknown;
      const student = Array.isArray(studentRaw) ? studentRaw[0] as { tenant_id: string } | undefined : studentRaw as { tenant_id: string } | null;
      if (student?.tenant_id) tenantIds.add(student.tenant_id);
    }
  }

  // 팀 멤버 (자녀의 테넌트 기반) — user_profiles 기반
  if ((filter === "all" || filter === "team") && tenantIds.size > 0) {
    const { data: teamMembers } = await supabase
      .from("user_profiles")
      .select("id, name, role, profile_image_url")
      .in("tenant_id", Array.from(tenantIds))
      .eq("is_active", true)
      .in("role", ["admin", "consultant"])
      .order("name");

    if (teamMembers) {
      results.push(
        ...teamMembers.map((m: { id: string; name: string; role: string; profile_image_url: string | null }) => ({
          userId: m.id,
          userType: "admin" as ChatUserType,
          name: m.name,
          profileImageUrl: m.profile_image_url,
          adminRole: m.role,
        }))
      );
    }
  }

  // 연결된 자녀 — filter "children"은 실제로 "student" 역할이지만 학부모에게는 "내 자녀"로 표시
  if (filter === "all" || filter === "children") {
    if (childLinks) {
      for (const link of childLinks) {
        type StudentInfo = {
          id: string;
          school_name: string | null;
          grade: number | null;
          school_type: string | null;
          user_profiles: { name: string; profile_image_url: string | null } | null;
        };
        const studentRaw2 = link.student as unknown;
        const student = Array.isArray(studentRaw2) ? studentRaw2[0] as StudentInfo | undefined : studentRaw2 as StudentInfo | null;
        if (!student) continue;
        const up = student.user_profiles;
        results.push({
          userId: student.id,
          userType: "student",
          name: up?.name ?? "",
          profileImageUrl: up?.profile_image_url ?? null,
          schoolName: student.school_name,
          gradeDisplay: formatGradeLabel(student.school_type, student.grade),
          relation: link.relation,
        });
      }
    }
  }

  return results;
}
