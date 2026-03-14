/**
 * 팀 데이터 조회 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import type {
  TeamMember,
  TeamOverview,
} from "../types";

/**
 * 현재 테넌트의 팀원 목록 조회
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { userId, role, tenantId } = await getCachedUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return [];
  }

  // Superadmin이 아니면 tenantId 필요
  if (role !== "superadmin" && !tenantId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // admin_users에서 팀원 조회 — name, phone, email, profile_image_url은 user_profiles JOIN
  let query = supabase
    .from("admin_users")
    .select("id, role, tenant_id, created_at, is_owner, job_title, department, user_profiles!inner(name, phone, email, profile_image_url)")
    .neq("role", "superadmin"); // superadmin은 목록에서 제외

  // 일반 admin/consultant는 자기 테넌트만 조회
  if (role !== "superadmin" && tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: adminUsers, error } = await query.order("created_at", { ascending: false });

  if (error || !adminUsers) {
    console.error("[getTeamMembers] Error:", error);
    return [];
  }

  // 결과 매핑 — user_profiles에서 email/name 모두 조회 (auth.admin.listUsers 제거)
  const members: TeamMember[] = adminUsers.map((admin) => {
    const up = admin.user_profiles as unknown as { name: string | null; phone: string | null; email: string | null; profile_image_url: string | null };
    return {
      id: admin.id,
      email: up?.email || "",
      displayName: up?.name || null,
      role: admin.role as "admin" | "consultant",
      isOwner: admin.is_owner,
      tenantId: admin.tenant_id,
      createdAt: admin.created_at,
      profileImageUrl: up?.profile_image_url ?? null,
      jobTitle: admin.job_title,
      department: admin.department,
      phone: up?.phone ?? null,
    };
  });

  return members;
}

/**
 * 팀 개요 조회 (대시보드용)
 */
export async function getTeamOverview(): Promise<TeamOverview | null> {
  const { userId, role, tenantId } = await getCachedUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return null;
  }

  if (role !== "superadmin" && !tenantId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  // 팀원 수 조회
  let membersQuery = supabase
    .from("admin_users")
    .select("role", { count: "exact" })
    .neq("role", "superadmin");

  if (role !== "superadmin" && tenantId) {
    membersQuery = membersQuery.eq("tenant_id", tenantId);
  }

  const { data: members, count: totalMembers } = await membersQuery;

  // 역할별 카운트
  const adminCount = members?.filter((m) => m.role === "admin").length || 0;
  const consultantCount = members?.filter((m) => m.role === "consultant").length || 0;

  // 대기 중인 초대 수 (통합 invitations 테이블)
  let invitationsQuery = supabase
    .from("invitations")
    .select("id", { count: "exact" })
    .in("target_role", ["admin", "consultant"])
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  if (role === "admin" && tenantId) {
    invitationsQuery = invitationsQuery.eq("tenant_id", tenantId);
  }

  const { count: pendingInvitations } = await invitationsQuery;

  return {
    totalMembers: totalMembers || 0,
    adminCount,
    consultantCount,
    pendingInvitations: pendingInvitations || 0,
  };
}
