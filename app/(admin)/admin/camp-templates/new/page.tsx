import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { NewCampTemplateForm } from "./NewCampTemplateForm";

export default async function NewCampTemplatePage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">캠프 템플릿 생성</h1>
          <p className="text-sm text-gray-500">
            템플릿 이름과 프로그램 유형을 입력하고 템플릿 생성을 시작하세요.
          </p>
        </div>

        <NewCampTemplateForm />
      </div>
    </section>
  );
}

