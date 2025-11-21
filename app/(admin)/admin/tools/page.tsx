export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export default async function AdminToolsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || (role !== "admin" && role !== "consultant")) {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">관리 도구</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 플랜 대량 생성 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-2xl">📋</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">플랜 대량 생성</h2>
          <p className="mb-4 text-sm text-gray-500">
            여러 학생에게 동일한 플랜을 일괄 생성합니다.
          </p>
          <button
            disabled
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500"
          >
            준비 중
          </button>
        </div>

        {/* 성적 일괄 입력 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-2xl">📊</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">성적 일괄 입력</h2>
          <p className="mb-4 text-sm text-gray-500">
            엑셀 파일을 업로드하여 여러 학생의 성적을 한 번에 입력합니다.
          </p>
          <button
            disabled
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500"
          >
            준비 중
          </button>
        </div>

        {/* 목표 관리 도우미 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-2xl">🎯</div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">목표 관리 도우미</h2>
          <p className="mb-4 text-sm text-gray-500">
            학생별 목표를 효율적으로 생성하고 관리합니다.
          </p>
          <button
            disabled
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500"
          >
            준비 중
          </button>
        </div>
      </div>
    </div>
  );
}

