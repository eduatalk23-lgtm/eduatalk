/**
 * 팀 데이터 조회 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import type {
  TeamMember,
  TeamInvitation,
  TeamOverview,
  InvitationRole,
  InvitationStatus,
} from "../types";

/**
 * 현재 테넌트의 팀원 목록 조회
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return [];
  }

  // Superadmin이 아니면 tenantId 필요
  if (role !== "superadmin" && !tenantId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    return [];
  }

  // admin_users에서 팀원 조회 (name 포함)
  let query = supabase
    .from("admin_users")
    .select("id, name, role, tenant_id, created_at")
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

  // auth.users에서 이메일과 이름 정보 조회
  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const authUserMap = new Map(
    authUsers?.users.map((u) => [u.id, u]) || []
  );

  // 결과 매핑 (admin_users.name 우선, fallback으로 auth.users.user_metadata)
  const members: TeamMember[] = adminUsers.map((admin) => {
    const authUser = authUserMap.get(admin.id);
    return {
      id: admin.id,
      email: authUser?.email || "",
      displayName: admin.name || authUser?.user_metadata?.display_name || null,
      role: admin.role as "admin" | "consultant",
      tenantId: admin.tenant_id,
      createdAt: admin.created_at,
    };
  });

  return members;
}

/**
 * 현재 테넌트의 대기 중인 초대 목록 조회
 */
export async function getPendingInvitations(): Promise<TeamInvitation[]> {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId || !["admin", "superadmin"].includes(role || "")) {
    return [];
  }

  // 일반 admin은 tenantId 필요
  if (role === "admin" && !tenantId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("team_invitations")
    .select("*")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // 일반 admin은 자기 테넌트만 조회
  if (role === "admin" && tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: invitations, error } = await query;

  if (error || !invitations) {
    console.error("[getPendingInvitations] Error:", error);
    return [];
  }

  return invitations.map((inv) => ({
    id: inv.id,
    tenantId: inv.tenant_id,
    email: inv.email,
    role: inv.role as InvitationRole,
    status: inv.status as InvitationStatus,
    token: inv.token,
    invitedBy: inv.invited_by,
    expiresAt: inv.expires_at,
    acceptedAt: inv.accepted_at,
    acceptedBy: inv.accepted_by,
    createdAt: inv.created_at,
  }));
}

/**
 * 모든 초대 목록 조회 (취소됨/만료됨 포함)
 */
export async function getAllInvitations(): Promise<TeamInvitation[]> {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId || !["admin", "superadmin"].includes(role || "")) {
    return [];
  }

  if (role === "admin" && !tenantId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("team_invitations")
    .select("*")
    .order("created_at", { ascending: false });

  if (role === "admin" && tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: invitations, error } = await query;

  if (error || !invitations) {
    return [];
  }

  return invitations.map((inv) => ({
    id: inv.id,
    tenantId: inv.tenant_id,
    email: inv.email,
    role: inv.role as InvitationRole,
    status: inv.status as InvitationStatus,
    token: inv.token,
    invitedBy: inv.invited_by,
    expiresAt: inv.expires_at,
    acceptedAt: inv.accepted_at,
    acceptedBy: inv.accepted_by,
    createdAt: inv.created_at,
  }));
}

/**
 * 팀 개요 조회 (대시보드용)
 */
export async function getTeamOverview(): Promise<TeamOverview | null> {
  const { userId, role, tenantId } = await getCurrentUserRole();

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

  // 대기 중인 초대 수
  let invitationsQuery = supabase
    .from("team_invitations")
    .select("id", { count: "exact" })
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
