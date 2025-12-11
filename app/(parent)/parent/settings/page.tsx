export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents } from "../../_utils";
import Link from "next/link";
import { RoleChangeSection } from "./_components/RoleChangeSection";
import { StudentAttendanceNotificationSettings } from "./_components/StudentAttendanceNotificationSettings";
import { getStudentAttendanceNotificationSettings } from "@/app/(parent)/actions/parentSettingsActions";
import { LinkedStudentsSection } from "./_components/LinkedStudentsSection";
import { getLinkRequests } from "@/app/(parent)/actions/parentStudentLinkRequestActions";

export default async function ParentSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 학부모 정보 조회
  const { data: parent } = await supabase
    .from("parent_users")
    .select("id, name, created_at")
    .eq("id", userId)
    .maybeSingle();

  // 연결된 학생 목록 조회
  const linkedStudents = await getLinkedStudents(supabase, userId);

  // 연결 요청 목록 조회
  const linkRequestsResult = await getLinkRequests(userId);
  const linkRequests = linkRequestsResult.success && linkRequestsResult.data
    ? linkRequestsResult.data
    : [];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">설정</h1>
          <p className="mt-1 text-sm text-gray-500">
            계정 정보 및 연결된 자녀를 관리하세요
          </p>
        </div>
        <Link
          href="/parent/dashboard"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          대시보드로 돌아가기
        </Link>
      </div>

      <div className="space-y-6">
        {/* 나의 정보 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            나의 정보
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">이름</label>
              <div className="mt-1 text-base text-gray-900">
                {parent?.name || "이름 없음"}
              </div>
            </div>
            {parent?.created_at && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  가입일
                </label>
                <div className="mt-1 text-base text-gray-900">
                  {new Date(parent.created_at).toLocaleDateString("ko-KR")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 연결된 자녀 및 연결 요청 */}
        <LinkedStudentsSection
          linkedStudents={linkedStudents}
          parentId={userId}
          initialLinkRequests={linkRequests}
        />

        {/* 자녀별 출석 알림 설정 */}
        {linkedStudents.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              출석 알림 설정
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              각 자녀별로 출석 관련 SMS 알림을 받을 항목을 설정할 수 있습니다. 기본값이면 학원 기본 설정을 따릅니다.
            </p>
            <div className="space-y-4">
              {await Promise.all(
                linkedStudents.map(async (student) => {
                  const settingsResult =
                    await getStudentAttendanceNotificationSettings(student.id);
                  const settings = settingsResult.data || {
                    attendance_check_in_enabled: null,
                    attendance_check_out_enabled: null,
                    attendance_absent_enabled: null,
                    attendance_late_enabled: null,
                  };

                  return (
                    <StudentAttendanceNotificationSettings
                      key={student.id}
                      studentId={student.id}
                      studentName={student.name || "이름 없음"}
                      initialSettings={settings}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}


        {/* 권한 변경 섹션 */}
        <RoleChangeSection />
      </div>
    </section>
  );
}

