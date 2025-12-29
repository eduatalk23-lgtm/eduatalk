import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getContainerClass } from "@/lib/constants/layout";
import { ModeSelector } from "./_components/ModeSelector";

type CreatePageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const mode = resolvedSearchParams.mode as "full" | "content" | "quick" | undefined;

  // mode 파라미터가 있으면 해당 페이지로 리다이렉트
  if (mode === "full") {
    redirect("/plan/new-group");
  }
  if (mode === "quick") {
    redirect("/plan/quick-create");
  }
  // content 모드는 templateId가 필요하므로 플랜 목록 페이지로 이동
  if (mode === "content") {
    redirect("/plan");
  }

  return (
    <div className={getContainerClass("DASHBOARD", "md")}>
      <div className="py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            플랜 생성
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            학습 목표에 맞는 플랜을 만들어보세요
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <ModeSelector />
          </div>
        </div>
      </div>
    </div>
  );
}
