import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/layout/PageHeader";
import { getStudentPhonesBatch } from "@/lib/utils/studentPhoneUtils";
import { getStudentSchoolsBatch } from "@/lib/data/studentSchools";
import { PlanCreationClient } from "./_components/PlanCreationClient";
import type { StudentDivision } from "@/lib/constants/students";

type StudentRow = {
  id: string;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  school_id?: string | null;
  school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  division?: StudentDivision | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

export const metadata = {
  title: "플랜 생성 관리 | TimeLevelUp",
  description: "학생들의 학습 플랜을 통합 생성하고 관리합니다",
};

export default async function PlanCreationPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // 활성 학생 목록 조회 (플랜 생성 대상)
  const selectFields =
    "id,name,grade,class,school_id,school_type,division,created_at,is_active";

  const { data: students, error } = await supabase
    .from("students")
    .select(selectFields)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[plan-creation] 학생 목록 조회 실패", {
      message: error.message,
      code: error.code,
    });

    return (
      <div className="p-6 md:p-10">
        <div className="flex flex-col gap-6">
          <PageHeader title="플랜 생성 관리" />
          <ErrorState
            title="학생 목록을 불러올 수 없습니다"
            message="학생 목록을 조회하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
            actionHref="/admin/plan-creation"
            actionLabel="새로고침"
          />
        </div>
      </div>
    );
  }

  const studentRows = (students as StudentRow[] | null) ?? [];

  // 배치 쿼리로 학교 정보 및 연락처 정보 일괄 조회
  const studentIds = studentRows.map((s) => s.id);

  // 성별 조회를 위한 import
  const { getStudentGendersBatch } = await import(
    "@/lib/data/studentProfiles"
  );
  const { getAuthUserMetadata } = await import(
    "@/lib/utils/authUserMetadata"
  );
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();

  // 병렬로 데이터 페칭
  const [phoneDataList, schoolMap, genderMap, userMetadata] = await Promise.all(
    [
      getStudentPhonesBatch(studentIds),
      getStudentSchoolsBatch(
        supabase,
        studentRows.map((s) => ({
          id: s.id,
          school_id: s.school_id ?? null,
          school_type: s.school_type ?? null,
        }))
      ),
      getStudentGendersBatch(studentIds),
      getAuthUserMetadata(adminClient, studentIds),
    ]
  );

  // 연락처 데이터를 Map으로 변환
  const phoneDataMap = new Map(phoneDataList.map((p) => [p.id, p]));

  // 데이터를 학생 정보와 결합
  const studentsWithData = studentRows.map((student) => {
    const phoneData = phoneDataMap.get(student.id);
    const schoolName = schoolMap.get(student.id) ?? "-";
    const gender = genderMap.get(student.id) ?? null;
    const email = userMetadata.get(student.id)?.email ?? null;

    return {
      id: student.id,
      name: student.name ?? null,
      grade: student.grade ? String(student.grade) : null,
      class: student.class ?? null,
      division: student.division ?? null,
      schoolName,
      phone: phoneData?.phone ?? null,
      mother_phone: phoneData?.mother_phone ?? null,
      father_phone: phoneData?.father_phone ?? null,
      is_active: student.is_active ?? null,
      gender,
      email,
    };
  });

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader title="플랜 생성 관리" />
        <PlanCreationClient
          students={studentsWithData}
          isAdmin={role === "admin"}
        />
      </div>
    </div>
  );
}
