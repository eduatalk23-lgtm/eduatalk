import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getContainerClass } from "@/lib/constants/layout";
import { QuickPlanWizardWrapper } from "./_components/QuickPlanWizardWrapper";

type QuickCreatePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function QuickCreatePage({
  searchParams,
}: QuickCreatePageProps) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  const resolvedSearchParams = await searchParams;

  // URL에서 날짜 파라미터 추출
  const dateParam = resolvedSearchParams.date;
  const defaultDate =
    typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10);

  return (
    <div className={getContainerClass("DASHBOARD", "md")}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            빠른 플랜 생성
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            3단계로 간편하게 학습 플랜을 만들어보세요
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <QuickPlanWizardWrapper
            studentId={userId}
            tenantId={tenantContext?.tenantId || null}
            defaultDate={defaultDate}
          />
        </div>
      </div>
    </div>
  );
}
