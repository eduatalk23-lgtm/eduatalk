import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 개발환경 전용 - 테스트 초대 생성 API
 *
 * 사용법:
 *   GET /api/dev/test-invitation
 *   GET /api/dev/test-invitation?role=parent&student_id=xxx
 *   GET /api/dev/test-invitation?role=admin
 *   GET /api/dev/test-invitation?role=consultant&email=test@test.com
 *
 * 쿼리 파라미터:
 *   role       - admin | consultant | student | parent (기본: student)
 *   student_id - student/parent 역할 시 연결할 학생 ID
 *   email      - 초대 이메일 (선택)
 *   phone      - 초대 전화번호 (선택)
 *   relation   - parent 역할 시 관계: father | mother | guardian (기본: mother)
 *   redirect   - true면 /join/[token]으로 바로 이동 (기본: false)
 */
export async function GET(request: NextRequest) {
  // 프로덕션 환경 차단
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const role = searchParams.get("role") || "student";
  const studentId = searchParams.get("student_id");
  const email = searchParams.get("email");
  const phone = searchParams.get("phone");
  const relation = searchParams.get("relation") || "mother";
  const shouldRedirect = searchParams.get("redirect") === "true";

  // role 검증
  const validRoles = ["admin", "consultant", "student", "parent"];
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
      { status: 400 }
    );
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Admin client not available" }, { status: 500 });
  }

  // 테넌트 조회 (첫 번째 테넌트 사용)
  const { data: tenant, error: tenantError } = await adminClient
    .from("tenants")
    .select("id, name")
    .limit(1)
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json(
      { error: "No tenant found. Create a tenant first.", detail: tenantError?.message },
      { status: 500 }
    );
  }

  // admin 사용자 조회 (invited_by 필드용)
  const { data: adminUser, error: adminError } = await adminClient
    .from("admin_users")
    .select("id")
    .eq("tenant_id", tenant.id)
    .limit(1)
    .single();

  if (adminError || !adminUser) {
    return NextResponse.json(
      { error: "No admin user found for tenant.", detail: adminError?.message },
      { status: 500 }
    );
  }

  // student/parent 역할이면 학생 필요
  let resolvedStudentId = studentId;
  let studentName: string | null = null;

  if ((role === "student" || role === "parent") && !resolvedStudentId) {
    const { data: student } = await adminClient
      .from("students")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .limit(1)
      .single();

    if (student) {
      resolvedStudentId = student.id;
      studentName = student.name;
    }
  } else if (resolvedStudentId) {
    const { data: student } = await adminClient
      .from("students")
      .select("name")
      .eq("id", resolvedStudentId)
      .single();
    studentName = student?.name ?? null;
  }

  // 초대 생성
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const insertData: Record<string, unknown> = {
    tenant_id: tenant.id,
    target_role: role,
    email: email || null,
    phone: phone || null,
    delivery_method: "manual",
    delivery_status: "skipped",
    status: "pending",
    expires_at: expiresAt.toISOString(),
    invited_by: adminUser.id,
  };

  if (resolvedStudentId && (role === "student" || role === "parent")) {
    insertData.student_id = resolvedStudentId;
  }
  if (role === "parent") {
    insertData.relation = relation;
  }

  const { data: invitation, error: insertError } = await adminClient
    .from("invitations")
    .insert(insertData as never)
    .select("id, token, target_role, student_id, email, expires_at")
    .single();

  if (insertError || !invitation) {
    return NextResponse.json(
      { error: "Failed to create test invitation", detail: insertError?.message },
      { status: 500 }
    );
  }

  // API 라우트에서는 실제 요청 origin 사용 (로컬 개발 환경 대응)
  const baseUrl = request.nextUrl.origin;
  const joinUrl = `${baseUrl}/join/${invitation.token}`;

  // redirect=true면 바로 이동
  if (shouldRedirect) {
    return NextResponse.redirect(joinUrl);
  }

  return NextResponse.json({
    message: "Test invitation created successfully",
    invitation: {
      id: invitation.id,
      token: invitation.token,
      role: invitation.target_role,
      studentId: invitation.student_id,
      studentName,
      email: invitation.email,
      expiresAt: invitation.expires_at,
      tenant: tenant.name,
    },
    urls: {
      join: joinUrl,
      joinDirect: `/join/${invitation.token}`,
      redirectUrl: `${baseUrl}/api/dev/test-invitation?role=${role}&redirect=true`,
    },
    usage: {
      "브라우저에서 바로 테스트": joinUrl,
      "다른 역할 테스트": `${baseUrl}/api/dev/test-invitation?role=parent`,
      "바로 리다이렉트": `${baseUrl}/api/dev/test-invitation?role=${role}&redirect=true`,
    },
  });
}
