export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import Link from "next/link";
import { SMSSendForm } from "../_components/SMSSendForm";

export default async function SMSSendPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();

  // SMS 발송 폼용 학생 목록 조회 (모든 학생, 연락처 포함)
  // RLS 정책이 자동으로 tenant_id 필터링을 처리합니다
  let studentsSelectFields = "id, name, grade, class";

  // 학부모 연락처 컬럼 확인 (mother_phone, father_phone 사용)
  try {
    const testQuery = supabase.from("students").select("mother_phone, father_phone").limit(1);
    const { error: testError } = await testQuery;
    if (!testError) {
      studentsSelectFields += ",mother_phone,father_phone";
    }
  } catch (e) {
    // 컬럼이 없으면 무시
  }

  try {
    // is_active 컬럼이 있는지 테스트
    const testQuery = supabase.from("students").select("is_active").limit(1);
    const { error: testError } = await testQuery;
    if (!testError) {
      studentsSelectFields += ",is_active";
    }
  } catch (e) {
    // 컬럼이 없으면 무시
  }

  const { data: studentsForSMS, error: studentsError } = await supabase
    .from("students")
    .select(studentsSelectFields)
    .order("name", { ascending: true });

  // student_profiles 테이블에서 phone 정보 조회 (학생 본인 연락처)
  const studentIds = (studentsForSMS ?? []).map((s: any) => s.id);
  let profiles: Array<{
    id: string;
    phone?: string | null;
    mother_phone?: string | null;
    father_phone?: string | null;
  }> = [];

  if (studentIds.length > 0) {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("student_profiles")
        .select("id, phone, mother_phone, father_phone")
        .in("id", studentIds);

      if (!profilesError && profilesData) {
        profiles = profilesData;
      }
    } catch (e) {
      // student_profiles 테이블이 없으면 무시
    }
  }

  // 프로필 정보를 학생 정보와 병합 (student_profiles 우선, 없으면 students 테이블 사용)
  const studentsWithPhones = (studentsForSMS ?? []).map((s: any) => {
    const profile = profiles.find((p: any) => p.id === s.id);
    return {
      ...s,
      phone: profile?.phone ?? null, // student_profiles 우선
      mother_phone: profile?.mother_phone ?? s.mother_phone ?? null,
      father_phone: profile?.father_phone ?? s.father_phone ?? null,
    };
  });

  // 에러 처리 및 디버깅
  if (studentsError) {
    const errorInfo: Record<string, unknown> = {
      message:
        studentsError?.message ||
        studentsError?.toString() ||
        String(studentsError) ||
        "알 수 없는 에러",
      code: studentsError?.code || "UNKNOWN",
    };

    if (studentsError && typeof studentsError === "object") {
      if ("details" in studentsError) {
        errorInfo.details = (studentsError as { details?: unknown }).details;
      }
      if ("hint" in studentsError) {
        errorInfo.hint = (studentsError as { hint?: unknown }).hint;
      }
      if ("statusCode" in studentsError) {
        errorInfo.statusCode = (studentsError as { statusCode?: unknown }).statusCode;
      }
    }

    console.error("[admin/sms/send] 학생 목록 조회 실패:", errorInfo);
  }

  // 학원명 조회
  let academyName = "학원";
  if (tenantContext?.tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantContext.tenantId)
      .single();
    if (tenant?.name) {
      academyName = tenant.name;
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">SMS 발송</h1>
        <Link
          href="/admin/sms/results"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          발송 이력 보기
        </Link>
      </div>

      {/* 학생 목록 조회 에러 안내 */}
      {studentsError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            학생 목록을 불러오는 중 오류가 발생했습니다.
          </p>
          <p className="mt-1 text-xs text-red-700">
            에러 코드: {studentsError.code || "알 수 없음"}
          </p>
          <p className="mt-1 text-xs text-red-600">
            {studentsError.message || "알 수 없는 오류"}
          </p>
          {studentsError.hint && (
            <p className="mt-1 text-xs text-red-600">힌트: {studentsError.hint}</p>
          )}
        </div>
      )}

      {/* 학생이 없는 경우 안내 */}
      {!studentsError && (!studentsForSMS || studentsForSMS.length === 0) && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            등록된 학생이 없습니다.
          </p>
          <p className="mt-1 text-xs text-yellow-700">
            학생 관리 페이지에서 학생을 등록한 후 SMS 발송을 이용할 수 있습니다.
          </p>
        </div>
      )}

      {/* SMS 발송 폼 */}
      <SMSSendForm
        students={studentsWithPhones.map((s: any) => ({
          id: s.id,
          name: s.name ?? null,
          grade: s.grade ?? null,
          class: s.class ?? null,
          phone: s.phone ?? null,
          mother_phone: s.mother_phone ?? null,
          father_phone: s.father_phone ?? null,
          is_active: s.is_active ?? null,
        }))}
        academyName={academyName}
      />
    </div>
  );
}

