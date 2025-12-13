export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { RangeRecommendationSettings } from "./_components/RangeRecommendationSettings";

export default async function RecommendationSettingsPage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-gray-900">추천 시스템 설정</h1>
        <p className="text-body-2 text-gray-600">
          추천 알고리즘의 파라미터를 조정합니다.
        </p>
      </div>

      <RangeRecommendationSettings />
    </div>
  );
}

