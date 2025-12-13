export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { CurriculumSettingsForm } from "./_components/CurriculumSettingsForm";

export default async function CurriculumSettingsPage() {
  const { userId, role } = await getCurrentUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 md:p-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">교육과정 설정</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          교육과정 계산 기준을 설정합니다. 중학교와 고등학교의 각 개정교육과정 시작년도를 관리할 수 있습니다.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">개정교육과정 시작년도</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            학생의 학년 정보를 바탕으로 자동으로 교육과정을 계산할 때 사용되는 기준년도입니다.
          </p>
        </div>

        <CurriculumSettingsForm />
      </div>

      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">설정 안내</h3>
        <ul className="flex flex-col gap-1 text-sm text-blue-800 dark:text-blue-200">
          <li>• 2015개정 교육과정: 2018년 중1, 고1 동시 시작</li>
          <li>• 2022개정 교육과정: 2025년 중1, 고1 동시 시작</li>
          <li>• 설정 변경 시 즉시 반영되며, 기존 학생 데이터에는 영향을 주지 않습니다.</li>
          <li>• 새로운 학생 정보 입력 시 변경된 기준으로 교육과정이 자동 계산됩니다.</li>
        </ul>
      </div>
    </div>
  );
}

